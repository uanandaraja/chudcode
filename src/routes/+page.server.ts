import type { PageServerLoad } from "./$types";
import { listSandboxes } from "$lib/server/e2b/client";
import { getProfiles } from "$lib/server/profiles";

export const load: PageServerLoad = async ({ platform }) => {
  if (!platform) {
    throw new Error("Cloudflare platform bindings are unavailable");
  }

  return {
    dashboard: {
      profiles: getProfiles(platform.env),
      sandboxes: await listSandboxes(platform.env),
    },
  };
};
