import { getSandboxDetail } from "$lib/server/sandbox/client";

export async function proxyBrowserDevtoolsRequest(
  request: Request,
  platform: App.Platform,
  sandboxId: string,
  path: string,
) {
  const sandbox = await getSandboxDetail(platform.env, sandboxId);

  return new Response(
    `Chrome DevTools proxy is not implemented for Cloudflare Sandbox (${sandbox.sandboxID}${path ? `:${path}` : ""}).`,
    {
      status: 501,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    },
  );
}
