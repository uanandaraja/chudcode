/// <reference path="../worker-configuration.d.ts" />
import type { Sandbox as CloudflareSandbox } from "@cloudflare/sandbox";

declare global {
  namespace App {
    interface Platform {
      env: Env & {
        BACKUP_BUCKET: R2Bucket;
        BACKUP_BUCKET_NAME?: string;
        CHUDCODE_HOSTNAME?: string;
        GITHUB_TOKEN?: string;
        R2_ACCESS_KEY_ID?: string;
        R2_SECRET_ACCESS_KEY?: string;
        SANDBOX_BACKUP_TTL_SECONDS?: string;
        SANDBOX_PREVIEW_PORTS?: string;
        SANDBOX_SLEEP_AFTER?: string;
        Sandbox: DurableObjectNamespace<CloudflareSandbox>;
      };
      ctx: ExecutionContext;
      caches: CacheStorage;
      cf?: IncomingRequestCfProperties;
    }
  }
}

export {};
