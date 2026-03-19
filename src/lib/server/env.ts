import { getRequestEvent } from "$app/server";

export function getPlatformEnv() {
  const event = getRequestEvent();

  if (!event.platform) {
    throw new Error("Cloudflare platform bindings are unavailable");
  }

  return event.platform.env;
}
