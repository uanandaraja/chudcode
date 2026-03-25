import { getRequestEvent } from "$app/server";

export type PlatformEnv = Env & {
  BACKUP_BUCKET: R2Bucket;
  BACKUP_BUCKET_NAME?: string;
  CHUDCODE_HOSTNAME?: string;
  GITHUB_TOKEN?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  SANDBOX_BACKUP_TTL_SECONDS?: string;
  SANDBOX_PREVIEW_PORTS?: string;
  SANDBOX_SLEEP_AFTER?: string;
  Sandbox: App.Platform["env"]["Sandbox"];
};

export type WorkspaceLaunchEnv = PlatformEnv & {
  GITHUB_TOKEN: string;
};

export function getPlatformEnv(): PlatformEnv {
  const event = getRequestEvent();

  if (!event.platform) {
    throw new Error("Cloudflare platform bindings are unavailable");
  }

  return event.platform.env as PlatformEnv;
}
