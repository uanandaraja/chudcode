import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Workspace, WorkspaceInput } from "$lib/chudcode/types";
import type { PlatformEnv } from "$lib/server/env";
import { workspacesTable } from "./schema";

const githubNamePattern = /^[A-Za-z0-9_.-]+$/;

function getDb(env: Pick<PlatformEnv, "DB">) {
  return drizzle(env.DB);
}

function normalizeRequired(value: string, field: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${field} is required`);
  }

  return normalized;
}

function normalizeOptional(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validateGithubName(value: string, field: string) {
  if (!githubNamePattern.test(value)) {
    throw new Error(`${field} must be a valid GitHub name`);
  }

  return value;
}

function parseGithubRepo(repoUrl: string) {
  const normalized = normalizeRequired(repoUrl, "GitHub repo").replace(/\/+$/, "");

  const sshMatch = normalized.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);

  if (sshMatch) {
    return {
      owner: validateGithubName(sshMatch[1], "GitHub owner"),
      repo: validateGithubName(sshMatch[2], "GitHub repo"),
    };
  }

  const httpsMatch = normalized.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/)?$/i,
  );

  if (httpsMatch) {
    return {
      owner: validateGithubName(httpsMatch[1], "GitHub owner"),
      repo: validateGithubName(httpsMatch[2], "GitHub repo"),
    };
  }

  const shortMatch = normalized.match(/^([^/]+)\/([^/]+)$/);

  if (shortMatch) {
    return {
      owner: validateGithubName(shortMatch[1], "GitHub owner"),
      repo: validateGithubName(shortMatch[2].replace(/\.git$/i, ""), "GitHub repo"),
    };
  }

  throw new Error("GitHub repo must be a GitHub URL or owner/repo");
}

function mapWorkspaceRow(row: typeof workspacesTable.$inferSelect): Workspace {
  return {
    id: row.id,
    name: row.name,
    owner: row.owner,
    repo: row.repo,
    defaultBranch: row.defaultBranch,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function sanitizeWorkspaceInput(input: WorkspaceInput) {
  const parsedRepo = parseGithubRepo(input.repoUrl);

  return {
    name: normalizeRequired(input.name, "Workspace name"),
    owner: parsedRepo.owner,
    repo: parsedRepo.repo,
    defaultBranch: normalizeOptional(input.defaultBranch) ?? "main",
    notes: normalizeOptional(input.notes),
  };
}

function asWorkspaceError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "Workspace operation failed";

  if (message.includes("UNIQUE constraint failed")) {
    return new Error("Workspace repo already exists");
  }

  return cause instanceof Error ? cause : new Error(message);
}

export async function listWorkspaces(env: Pick<PlatformEnv, "DB">) {
  const rows = await getDb(env)
    .select()
    .from(workspacesTable)
    .orderBy(sql`${workspacesTable.updatedAt} desc`);

  return rows.map(mapWorkspaceRow);
}

export async function getWorkspace(
  env: Pick<PlatformEnv, "DB">,
  workspaceId: string,
) {
  const [row] = await getDb(env)
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  return row ? mapWorkspaceRow(row) : null;
}

export async function getWorkspaceOrThrow(
  env: Pick<PlatformEnv, "DB">,
  workspaceId: string,
) {
  const workspace = await getWorkspace(env, workspaceId);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  return workspace;
}

export async function createWorkspace(
  env: Pick<PlatformEnv, "DB">,
  input: WorkspaceInput,
) {
  const db = getDb(env);
  const now = new Date().toISOString();
  const workspace = sanitizeWorkspaceInput(input);
  const id = crypto.randomUUID();

  try {
    await db.insert(workspacesTable).values({
      id,
      name: workspace.name,
      owner: workspace.owner,
      repo: workspace.repo,
      defaultBranch: workspace.defaultBranch,
      notes: workspace.notes,
      createdAt: now,
      updatedAt: now,
    });
  } catch (cause) {
    throw asWorkspaceError(cause);
  }

  return getWorkspaceOrThrow(env, id);
}

export async function updateWorkspace(
  env: Pick<PlatformEnv, "DB">,
  workspaceId: string,
  input: WorkspaceInput,
) {
  const db = getDb(env);
  const workspace = sanitizeWorkspaceInput(input);

  try {
    const result = await db
      .update(workspacesTable)
      .set({
        name: workspace.name,
        owner: workspace.owner,
        repo: workspace.repo,
        defaultBranch: workspace.defaultBranch,
        notes: workspace.notes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(workspacesTable.id, workspaceId));

    if (!result.meta.changes) {
      throw new Error("Workspace not found");
    }
  } catch (cause) {
    throw asWorkspaceError(cause);
  }

  return getWorkspaceOrThrow(env, workspaceId);
}

export async function deleteWorkspace(
  env: Pick<PlatformEnv, "DB">,
  workspaceId: string,
) {
  const result = await getDb(env)
    .delete(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));

  if (!result.meta.changes) {
    throw new Error("Workspace not found");
  }

  return { workspaceId };
}
