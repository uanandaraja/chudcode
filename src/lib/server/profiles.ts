import type { ProfileDefinition } from "$lib/devbox/types";

const workspace = "/home/user/workspace";

function createProfiles(template: string): ProfileDefinition[] {
  return [
    {
      id: "main",
      label: "Main",
      description: "Default daily sandbox with the full toolchain and a plain shell.",
      template,
      timeoutMs: 60 * 60 * 1000,
      cwd: workspace,
      terminalCommand: "bash -l",
      env: {},
      metadata: {
        kind: "devbox",
        profile: "main",
      },
    },
    {
      id: "research",
      label: "Research",
      description: "Longer-lived shell for docs, experiments, and one-off scripts.",
      template,
      timeoutMs: 2 * 60 * 60 * 1000,
      cwd: workspace,
      terminalCommand: "bash -l",
      env: {
        DEVBOX_MODE: "research",
      },
      metadata: {
        kind: "devbox",
        profile: "research",
      },
    },
    {
      id: "scratch",
      label: "Scratch",
      description: "Fast disposable sandbox for testing commands and quick repros.",
      template,
      timeoutMs: 30 * 60 * 1000,
      cwd: workspace,
      terminalCommand: "bash -l",
      env: {
        DEVBOX_MODE: "scratch",
      },
      metadata: {
        kind: "devbox",
        profile: "scratch",
      },
    },
  ];
}

export function getProfiles(env: Pick<Env, "E2B_TEMPLATE">): ProfileDefinition[] {
  return createProfiles(env.E2B_TEMPLATE || "devbox-dev");
}

export function getProfile(env: Pick<Env, "E2B_TEMPLATE">, profileId: string) {
  const profileLookup = new Map(getProfiles(env).map((profile) => [profile.id, profile]));
  const profile = profileLookup.get(profileId);

  if (!profile) {
    throw new Error(`Unknown profile: ${profileId}`);
  }

  return profile;
}
