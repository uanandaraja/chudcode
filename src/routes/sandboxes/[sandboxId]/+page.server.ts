import { error } from "@sveltejs/kit";
import { getSandboxDetail } from "$lib/server/e2b/client";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, platform }) => {
  if (!platform) {
    throw new Error("Cloudflare platform bindings are unavailable");
  }

  try {
    return {
      sandbox: await getSandboxDetail(platform.env, params.sandboxId),
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Sandbox lookup failed";

    if (message.startsWith("E2B 404:")) {
      error(404, "Sandbox not found");
    }

    throw cause;
  }
};
