import type {
  ListedSandbox,
  ProfileDefinition,
  SandboxDetail,
} from "$lib/devbox/types";

const defaultDomain = "e2b.app";
const defaultTerminalPort = 7681;

function getDomain(env: Env) {
  return env.E2B_DOMAIN || defaultDomain;
}

function getApiBaseUrl(env: Env) {
  return `https://api.${getDomain(env)}`;
}

function getTimeoutSeconds(timeoutMs: number) {
  return Math.max(15, Math.ceil(timeoutMs / 1000));
}

function getDefaultTimeoutMs(env: Env) {
  return Number(env.E2B_SANDBOX_TIMEOUT_MS ?? 3600000);
}

function getTerminalPort(env: Env) {
  return Number(env.E2B_TERMINAL_PORT ?? defaultTerminalPort);
}

async function e2bFetch<T>(env: Env, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl(env)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": env.E2B_API_KEY,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`E2B ${response.status}: ${message || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function listSandboxes(env: Env) {
  const sandboxes = await e2bFetch<ListedSandbox[]>(env, "/sandboxes", {
    method: "GET",
  });

  return sandboxes.sort(
    (left, right) =>
      new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  );
}

export async function getSandboxDetail(env: Env, sandboxId: string) {
  return e2bFetch<SandboxDetail>(env, `/sandboxes/${sandboxId}`, {
    method: "GET",
  });
}

export async function createSandbox(env: Env, profile: ProfileDefinition) {
  const timeoutMs = profile.timeoutMs || getDefaultTimeoutMs(env);

  return e2bFetch<{
    alias?: string;
    domain?: string | null;
    sandboxID: string;
    templateID: string;
  }>(env, "/sandboxes", {
    method: "POST",
    body: JSON.stringify({
      templateID: profile.template || env.E2B_TEMPLATE,
      timeout: getTimeoutSeconds(timeoutMs),
      autoPause: true,
      metadata: {
        ...profile.metadata,
        profileId: profile.id,
        profileLabel: profile.label,
      },
      envVars: {
        DEVBOX_PROFILE_ID: profile.id,
        DEVBOX_PROFILE_LABEL: profile.label,
        DEVBOX_CWD: profile.cwd,
        DEVBOX_TERMINAL_COMMAND: profile.terminalCommand,
        DEVBOX_BOOTSTRAP_COMMAND: profile.bootstrapCommand ?? "",
        E2B_TERMINAL_PORT: String(getTerminalPort(env)),
        ...profile.env,
      },
    }),
  });
}

export async function resumeSandbox(env: Env, sandboxId: string, timeoutMs?: number) {
  return e2bFetch<{
    alias?: string;
    domain?: string | null;
    sandboxID: string;
    templateID: string;
  }>(env, `/sandboxes/${sandboxId}/connect`, {
    method: "POST",
    body: JSON.stringify({
      timeout: getTimeoutSeconds(timeoutMs ?? getDefaultTimeoutMs(env)),
    }),
  });
}

export async function pauseSandbox(env: Env, sandboxId: string) {
  await e2bFetch<void>(env, `/sandboxes/${sandboxId}/pause`, {
    method: "POST",
  });
}

export async function killSandbox(env: Env, sandboxId: string) {
  await e2bFetch<void>(env, `/sandboxes/${sandboxId}`, {
    method: "DELETE",
  });
}

export function getSandboxTerminalUrl(
  env: Env,
  sandbox: Pick<SandboxDetail, "domain" | "sandboxID">,
) {
  const domain = sandbox.domain || getDomain(env);
  const port = getTerminalPort(env);
  return `wss://${port}-${sandbox.sandboxID}.${domain}`;
}
