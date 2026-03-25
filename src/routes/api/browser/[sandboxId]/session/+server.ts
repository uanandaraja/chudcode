import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getSandboxBrowserSession,
  getSandboxDetail,
} from "$lib/server/sandbox/client";
import type { WorkspaceLaunchEnv } from "$lib/server/env";

export const GET: RequestHandler = async ({ params, platform, url }) => {
  if (!platform) {
    throw error(500, "Cloudflare platform unavailable");
  }

  const sandbox = await getSandboxDetail(platform.env, params.sandboxId);
  const portParam = Number(url.searchParams.get("port") ?? "");
  const session = await getSandboxBrowserSession(
    platform.env as WorkspaceLaunchEnv,
    sandbox,
    platform.env.CHUDCODE_HOSTNAME ?? url.hostname,
    Number.isInteger(portParam) && portParam > 0 ? portParam : undefined,
  );

  return json(session);
};
