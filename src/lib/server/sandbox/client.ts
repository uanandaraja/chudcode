import type {
  DirectoryBackup,
  ExecutionSession,
} from "@cloudflare/sandbox";
import { desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  BrowserSession,
  ListedSandbox,
  PreviewCandidate,
  SandboxDetail,
  Workspace,
} from "$lib/chudcode/types";
import type { PlatformEnv, WorkspaceLaunchEnv } from "$lib/server/env";
import { sandboxInstancesTable } from "$lib/server/sandboxes/schema";
import { workspacesTable } from "$lib/server/workspaces/schema";

const defaultPreviewPorts = [3000, 3001, 4173, 5173, 8000, 8080, 8787, 4321];
const defaultSleepAfter = "10m";
const defaultBackupTtlSeconds = 60 * 60 * 24 * 14;

type SandboxRow = typeof sandboxInstancesTable.$inferSelect;
type SandboxInsert = typeof sandboxInstancesTable.$inferInsert;
type WorkspaceRow = typeof workspacesTable.$inferSelect;

function getDb(env: Pick<PlatformEnv, "DB">) {
  return drizzle(env.DB);
}

function getSandboxSleepAfter(env: PlatformEnv) {
  return env.SANDBOX_SLEEP_AFTER?.trim() || defaultSleepAfter;
}

function getBackupTtlSeconds(env: PlatformEnv) {
  const raw = Number(env.SANDBOX_BACKUP_TTL_SECONDS ?? defaultBackupTtlSeconds);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : defaultBackupTtlSeconds;
}

function getConfiguredHostname(env: PlatformEnv, requestHost?: string) {
  return env.CHUDCODE_HOSTNAME?.trim() || requestHost || "chudcode.xyz";
}

function getPreviewPorts(env: PlatformEnv) {
  const raw = env.SANDBOX_PREVIEW_PORTS?.trim();
  if (!raw) {
    return defaultPreviewPorts;
  }

  const ports = raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return ports.length > 0 ? [...new Set(ports)] : defaultPreviewPorts;
}

function getWorkspaceSandboxId(workspaceId: string) {
  return `workspace-${workspaceId}`.toLowerCase();
}

function getWorkspaceDir(workspace: Pick<Workspace, "repo">) {
  return `/workspace/${workspace.repo}`;
}

function shellEscape(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function getRepoUrl(workspace: Pick<Workspace, "owner" | "repo">) {
  return `https://github.com/${workspace.owner}/${workspace.repo}.git`;
}

function getSandboxMetadata(workspace: Workspace) {
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    repoOwner: workspace.owner,
    repoName: workspace.repo,
    repoFullName: `${workspace.owner}/${workspace.repo}`,
  };
}

function mapSandboxRecord(
  row: Pick<SandboxRow, "sandboxId" | "startedAt">,
  workspace: Workspace,
): ListedSandbox {
  return {
    sandboxID: row.sandboxId,
    startedAt: row.startedAt ?? workspace.updatedAt,
    state: "running",
    metadata: getSandboxMetadata(workspace),
  };
}

async function getSandboxHandle(env: PlatformEnv, sandboxId: string) {
  const { getSandbox } = await import("@cloudflare/sandbox");

  return getSandbox(env.Sandbox, sandboxId, {
    keepAlive: true,
    sleepAfter: getSandboxSleepAfter(env),
    normalizeId: true,
  });
}

function getSandboxEnv(env: PlatformEnv) {
  const baseEnv = {
    HOME: "/workspace",
    XDG_CONFIG_HOME: "/workspace/.config",
    LOGNAME: "workspace",
    USER: "workspace",
    SHELL: "/bin/bash",
    EDITOR: "nvim",
    VISUAL: "nvim",
    PAGER: "less",
    PATH: [
      "/workspace/.bun/bin",
      "/workspace/.local/bin",
      "/workspace/.npm-global/bin",
      "/workspace/.opencode/bin",
      "/usr/local/bin",
      "/usr/local/sbin",
      "/usr/bin",
      "/usr/sbin",
      "/bin",
      "/sbin",
    ].join(":"),
  } satisfies Record<string, string>;

  if (!env.GITHUB_TOKEN) {
    return baseEnv;
  }

  return {
    ...baseEnv,
    GH_TOKEN: env.GITHUB_TOKEN,
    GITHUB_TOKEN: env.GITHUB_TOKEN,
  } satisfies Record<string, string>;
}

function getPreviewToken(sandboxId: string, port: number) {
  const normalized = sandboxId.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const token = `${normalized.slice(-10)}${port}`.slice(0, 16);
  return token || `port${port}`;
}

function canCreateBackups(env: PlatformEnv) {
  return Boolean(
    env.BACKUP_BUCKET &&
      env.BACKUP_BUCKET_NAME?.trim() &&
      env.R2_ACCESS_KEY_ID?.trim() &&
      env.R2_SECRET_ACCESS_KEY?.trim(),
  );
}

async function getWorkspaceById(env: Pick<PlatformEnv, "DB">, workspaceId: string) {
  const [workspace] = await getDb(env)
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  return workspace ?? null;
}

async function getSandboxRowByWorkspaceId(env: Pick<PlatformEnv, "DB">, workspaceId: string) {
  const [row] = await getDb(env)
    .select()
    .from(sandboxInstancesTable)
    .where(eq(sandboxInstancesTable.workspaceId, workspaceId))
    .limit(1);

  return row ?? null;
}

async function getSandboxRowBySandboxId(env: Pick<PlatformEnv, "DB">, sandboxId: string) {
  const [row] = await getDb(env)
    .select()
    .from(sandboxInstancesTable)
    .where(eq(sandboxInstancesTable.sandboxId, sandboxId))
    .limit(1);

  return row ?? null;
}

async function upsertSandboxRow(env: Pick<PlatformEnv, "DB">, values: SandboxInsert) {
  await getDb(env)
    .insert(sandboxInstancesTable)
    .values(values)
    .onConflictDoUpdate({
      target: sandboxInstancesTable.workspaceId,
      set: {
        sandboxId: values.sandboxId,
        active: values.active,
        backupId: values.backupId ?? null,
        backupDir: values.backupDir ?? null,
        startedAt: values.startedAt ?? null,
        updatedAt: values.updatedAt,
      },
    });
}

async function markSandboxInactive(
  env: Pick<PlatformEnv, "DB">,
  workspaceId: string,
  backup?: DirectoryBackup | null,
) {
  await getDb(env)
    .update(sandboxInstancesTable)
    .set({
      active: false,
      backupId: backup?.id ?? null,
      backupDir: backup?.dir ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(sandboxInstancesTable.workspaceId, workspaceId));
}

async function clearSandboxBackup(env: Pick<PlatformEnv, "DB">, workspaceId: string) {
  await getDb(env)
    .update(sandboxInstancesTable)
    .set({
      backupId: null,
      backupDir: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(sandboxInstancesTable.workspaceId, workspaceId));
}

async function restoreWorkspaceBackup(
  env: PlatformEnv,
  sandboxId: string,
  workspace: Workspace,
  row: SandboxRow | null,
) {
  if (!row?.backupId) {
    return false;
  }

  try {
    const sandbox = await getSandboxHandle(env, sandboxId);
    await sandbox.restoreBackup({
      id: row.backupId,
      dir: row.backupDir ?? getWorkspaceDir(workspace),
    });
    return true;
  } catch {
    await clearSandboxBackup(env, workspace.id);
    return false;
  }
}

async function bootstrapWorkspace(
  env: PlatformEnv,
  sandboxId: string,
  workspace: Workspace,
  row: SandboxRow | null,
) {
  const sandbox = await getSandboxHandle(env, sandboxId);
  const cwd = getWorkspaceDir(workspace);
  const repoUrl = getRepoUrl(workspace);

  await sandbox.setEnvVars(getSandboxEnv(env));
  await sandbox.mkdir("/workspace", { recursive: true });
  await sandbox.mkdir("/workspace/.config/gh", { recursive: true });

  await restoreWorkspaceBackup(env, sandboxId, workspace, row);

  const cloneCommand = workspace.defaultBranch
    ? `git clone --branch ${shellEscape(workspace.defaultBranch)} --single-branch ${shellEscape(repoUrl)} ${shellEscape(cwd)}`
    : `git clone ${shellEscape(repoUrl)} ${shellEscape(cwd)}`;

  const bootstrapCommands = [
    "mkdir -p /workspace/.config/gh",
    env.GITHUB_TOKEN
      ? [
          "printf '%s' \"$GITHUB_TOKEN\" | HOME=/workspace XDG_CONFIG_HOME=/workspace/.config gh auth login --hostname github.com --with-token >/dev/null 2>&1 || true",
          "HOME=/workspace XDG_CONFIG_HOME=/workspace/.config gh auth setup-git >/dev/null 2>&1 || true",
        ].join(" && ")
      : null,
    `if [ ! -d ${shellEscape(`${cwd}/.git`)} ]; then rm -rf ${shellEscape(cwd)} && ${cloneCommand}; fi`,
    `git -C ${shellEscape(cwd)} remote set-url origin ${shellEscape(repoUrl)}`,
    workspace.defaultBranch
      ? `git -C ${shellEscape(cwd)} checkout ${shellEscape(workspace.defaultBranch)} || true`
      : null,
  ].filter((value): value is string => Boolean(value));

  await sandbox.exec(bootstrapCommands.join(" && "), {
    cwd: "/workspace",
    env: getSandboxEnv(env),
  });
}

async function getSessionWorkspace(env: Pick<PlatformEnv, "DB">, sandboxId: string) {
  const row = await getSandboxRowBySandboxId(env, sandboxId);
  if (!row?.active) {
    throw new Error("Sandbox is not running");
  }

  const workspaceRow = await getWorkspaceById(env, row.workspaceId);
  if (!workspaceRow) {
    throw new Error("Workspace not found");
  }

  return { row, workspace: workspaceRow as Workspace };
}

export async function listSandboxes(env: PlatformEnv) {
  const rows = await getDb(env)
    .select()
    .from(sandboxInstancesTable)
    .where(eq(sandboxInstancesTable.active, true))
    .orderBy(desc(sandboxInstancesTable.startedAt), desc(sandboxInstancesTable.updatedAt));

  if (rows.length === 0) {
    return [] as ListedSandbox[];
  }

  const workspaceIds = rows.map((row) => row.workspaceId);
  const workspaceRows = await getDb(env)
    .select()
    .from(workspacesTable)
    .where(inArray(workspacesTable.id, workspaceIds));

  const workspaceMap = new Map(
    workspaceRows.map((workspace) => [workspace.id, workspace as Workspace]),
  );

  return rows
    .map((row) => {
      const workspace = workspaceMap.get(row.workspaceId);
      if (!workspace) return null;
      return mapSandboxRecord(row, workspace);
    })
    .filter((row): row is ListedSandbox => row !== null);
}

export async function getSandboxDetail(env: PlatformEnv, sandboxId: string) {
  const { row, workspace } = await getSessionWorkspace(env, sandboxId);
  return mapSandboxRecord(row, workspace);
}

export async function createSandbox(env: WorkspaceLaunchEnv, workspace: Workspace) {
  if (!env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is not configured");
  }

  const sandboxId = getWorkspaceSandboxId(workspace.id);
  const now = new Date().toISOString();
  const existing = await getSandboxRowByWorkspaceId(env, workspace.id);

  await bootstrapWorkspace(env, sandboxId, workspace, existing);
  const latest = await getSandboxRowByWorkspaceId(env, workspace.id);

  await upsertSandboxRow(env, {
    workspaceId: workspace.id,
    sandboxId,
    active: true,
    backupId: latest?.backupId ?? null,
    backupDir: latest?.backupDir ?? getWorkspaceDir(workspace),
    startedAt: existing?.active ? existing.startedAt ?? now : now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  return getSandboxDetail(env, sandboxId);
}

export async function killSandbox(env: PlatformEnv, sandboxId: string) {
  const row = await getSandboxRowBySandboxId(env, sandboxId);
  if (!row) {
    return;
  }

  const workspace = await getWorkspaceById(env, row.workspaceId);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const sandbox = await getSandboxHandle(env, sandboxId);
  let backup: DirectoryBackup | null = null;

  if (canCreateBackups(env)) {
    try {
      backup = await sandbox.createBackup({
        dir: row.backupDir ?? getWorkspaceDir(workspace as Workspace),
        name: workspace.name,
        ttl: getBackupTtlSeconds(env),
      });
    } catch (error) {
      console.error("Failed to create sandbox backup before destroy", {
        sandboxId,
        workspaceId: row.workspaceId,
        error,
      });
    }
  }

  await sandbox.destroy();
  await markSandboxInactive(env, row.workspaceId, backup);
}

export async function getOrCreateSandboxSession(
  env: PlatformEnv,
  sandboxId: string,
  sessionId: string,
): Promise<ExecutionSession> {
  const { row, workspace } = await getSessionWorkspace(env, sandboxId);
  const sandbox = await getSandboxHandle(env, sandboxId);
  const envVars = getSandboxEnv(env);

  await bootstrapWorkspace(env, sandboxId, workspace, row);

  try {
    return await sandbox.createSession({
      id: sessionId,
      name: sessionId,
      cwd: getWorkspaceDir(workspace),
      env: envVars,
      commandTimeoutMs: 1000 * 60 * 60,
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.toLowerCase().includes("already")) {
      throw error;
    }

    return sandbox.getSession(sessionId);
  }
}

export async function detectSandboxPreviewCandidates(
  env: PlatformEnv,
  sandboxId: string,
): Promise<PreviewCandidate[]> {
  const ports = getPreviewPorts(env);
  const sandbox = await getSandboxHandle(env, sandboxId);
  const probeScript = ports
    .map(
      (port) =>
        `code="$(curl -sS -o /dev/null --max-time 1 -w '%{http_code}' http://127.0.0.1:${port}/ || true)"; if [ "$code" = "000" ]; then echo "${port}:inactive"; else echo "${port}:active"; fi`,
    )
    .join("; ");

  try {
    const result = await sandbox.exec(probeScript, {
      env: getSandboxEnv(env),
      cwd: "/workspace",
    });
    const activeByPort = new Map<number, boolean>();

    for (const line of result.stdout.split("\n")) {
      const [portRaw, state] = line.trim().split(":");
      const port = Number(portRaw);
      if (Number.isInteger(port)) {
        activeByPort.set(port, state === "active");
      }
    }

    return ports.map((port) => ({
      port,
      url: "",
      active: activeByPort.get(port) ?? false,
    }));
  } catch {
    return ports.map((port) => ({
      port,
      url: "",
      active: false,
    }));
  }
}

export async function getSandboxBrowserSession(
  env: PlatformEnv,
  sandbox: Pick<SandboxDetail, "sandboxID" | "state">,
  hostname: string,
  requestedPort?: number,
): Promise<BrowserSession> {
  if (sandbox.state !== "running") {
    throw new Error("Sandbox is not running");
  }

  const handle = await getSandboxHandle(env, sandbox.sandboxID);
  const candidates = await detectSandboxPreviewCandidates(env, sandbox.sandboxID);
  const defaultCandidate = candidates.find((candidate) => candidate.active);
  const selectedPort = requestedPort ?? defaultCandidate?.port;

  if (!selectedPort) {
    return {
      sandboxId: sandbox.sandboxID,
      status: "empty",
      candidates,
      message: "No preview detected. Start your app on 0.0.0.0 and choose a port.",
    };
  }

  const exposed = await handle.exposePort(selectedPort, {
    hostname: getConfiguredHostname(env, hostname),
    token: getPreviewToken(sandbox.sandboxID, selectedPort),
    name: `port-${selectedPort}`,
  });

  return {
    sandboxId: sandbox.sandboxID,
    status: "open",
    selectedPort,
    url: exposed.url,
    candidates,
  };
}
