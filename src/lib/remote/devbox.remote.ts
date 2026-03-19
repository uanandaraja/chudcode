import { command, query } from "$app/server";
import type { DashboardData } from "$lib/devbox/types";
import { getPlatformEnv } from "$lib/server/env";
import {
  createSandbox,
  getSandboxDetail,
  killSandbox,
  listSandboxes,
  pauseSandbox,
  resumeSandbox,
} from "$lib/server/e2b/client";
import { getProfile, getProfiles } from "$lib/server/profiles";

export const getDashboard = query(async (): Promise<DashboardData> => {
  const env = getPlatformEnv();

  return {
    profiles: getProfiles(env),
    sandboxes: await listSandboxes(env),
  };
});

export const getSandbox = query(
  "unchecked",
  async ({ sandboxId }: { sandboxId: string }) => {
    const env = getPlatformEnv();
    return getSandboxDetail(env, sandboxId);
  },
);

export const launchProfile = command(
  "unchecked",
  async ({ profileId }: { profileId: string }) => {
    const env = getPlatformEnv();
    const profile = getProfile(env, profileId);
    return createSandbox(env, profile);
  },
);

export const resumeSandboxCommand = command(
  "unchecked",
  async ({ sandboxId, timeoutMs }: { sandboxId: string; timeoutMs?: number }) => {
    const env = getPlatformEnv();
    return resumeSandbox(env, sandboxId, timeoutMs);
  },
);

export const pauseSandboxCommand = command(
  "unchecked",
  async ({ sandboxId }: { sandboxId: string }) => {
    const env = getPlatformEnv();
    await pauseSandbox(env, sandboxId);
    return { sandboxId };
  },
);

export const killSandboxCommand = command(
  "unchecked",
  async ({ sandboxId }: { sandboxId: string }) => {
    const env = getPlatformEnv();
    await killSandbox(env, sandboxId);
    return { sandboxId };
  },
);
