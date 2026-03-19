import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSandboxDetail, getSandboxTerminalUrl } from "$lib/server/e2b/client";

export const GET: RequestHandler = async ({ params, platform, request, url }) => {
  if (!platform) {
    throw error(500, "Cloudflare platform unavailable");
  }

  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected websocket upgrade", { status: 426 });
  }

  const sandbox = await getSandboxDetail(platform.env, params.sandboxId);

  if (sandbox.state !== "running") {
    return new Response("Sandbox is not running", { status: 409 });
  }

  const sessionId = url.searchParams.get("session") ?? crypto.randomUUID();
  const target = getSandboxTerminalUrl(platform.env, sandbox);
  const namespace = platform.env.TERMINAL_SESSIONS;
  const stub = namespace.get(
    namespace.idFromName(`${params.sandboxId}:${sessionId}`),
  );
  const proxyUrl = new URL(request.url);
  proxyUrl.searchParams.set("target", target);

  return stub.fetch(proxyUrl.toString(), request);
};
