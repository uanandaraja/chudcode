import { command, query } from "$app/server";
import type { DashboardData } from "$lib/chudcode/types";
import { getPlatformEnv, type WorkspaceLaunchEnv } from "$lib/server/env";
import {
  createSandbox,
  getSandboxDetail,
  killSandbox,
  listSandboxes,
} from "$lib/server/sandbox/client";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaceOrThrow,
  listWorkspaces,
  updateWorkspace,
} from "$lib/server/workspaces/service";

export const getDashboard = query(async (): Promise<DashboardData> => {
  const env = getPlatformEnv();

  return {
    workspaces: await listWorkspaces(env),
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

export const launchWorkspace = command(
  "unchecked",
  async ({ workspaceId }: { workspaceId: string }) => {
    const env = getPlatformEnv();
    const workspace = await getWorkspaceOrThrow(env, workspaceId);
    return createSandbox(env as WorkspaceLaunchEnv, workspace);
  },
);

export const createWorkspaceCommand = command(
  "unchecked",
  async (input: {
    name: string;
    repoUrl: string;
    defaultBranch?: string | null;
    notes?: string | null;
  }) => {
    const env = getPlatformEnv();
    return createWorkspace(env, input);
  },
);

export const updateWorkspaceCommand = command(
  "unchecked",
  async ({
    workspaceId,
    ...input
  }: {
    workspaceId: string;
    name: string;
    repoUrl: string;
    defaultBranch?: string | null;
    notes?: string | null;
  }) => {
    const env = getPlatformEnv();
    return updateWorkspace(env, workspaceId, input);
  },
);

export const deleteWorkspaceCommand = command(
  "unchecked",
  async ({ workspaceId }: { workspaceId: string }) => {
    const env = getPlatformEnv();
    return deleteWorkspace(env, workspaceId);
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
