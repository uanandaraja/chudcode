import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getOrCreateSandboxSession,
  getSandboxDetail,
} from "$lib/server/sandbox/client";
import type { WorkspaceLaunchEnv } from "$lib/server/env";

export const GET: RequestHandler = async ({ params, platform, request, url }) => {
  if (!platform) {
    throw error(500, "Cloudflare platform unavailable");
  }

  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected websocket upgrade", { status: 426 });
  }

  const sandbox = await getSandboxDetail(platform.env, params.sandboxId);
  const sessionId = url.searchParams.get("session") ?? crypto.randomUUID();
  const session = await getOrCreateSandboxSession(
    platform.env as WorkspaceLaunchEnv,
    sandbox.sandboxID,
    sessionId,
  );

  return session.terminal(request, { shell: "/bin/bash" });
};
