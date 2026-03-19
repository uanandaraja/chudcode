import { DurableObject } from "cloudflare:workers";

function asWsMessage(data: string | ArrayBuffer | Uint8Array) {
  return data;
}

export class TerminalSession extends DurableObject<Env> {
  browserSocket: WebSocket | null = null;
  upstreamSocket: WebSocket | null = null;
  pendingMessages: Array<string | ArrayBuffer | Uint8Array> = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    const target = new URL(request.url).searchParams.get("target");

    if (!target) {
      return new Response("Missing target websocket", { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const upstream = new WebSocket(target);
    upstream.binaryType = "arraybuffer";

    this.browserSocket = server;
    this.upstreamSocket = upstream;
    this.pendingMessages = [];

    const closeAll = (code = 1000, reason = "") => {
      try {
        server.close(code, reason);
      } catch {}

      try {
        upstream.close(code, reason);
      } catch {}

      this.browserSocket = null;
      this.upstreamSocket = null;
      this.pendingMessages = [];
    };

    server.addEventListener("message", (event) => {
      const data = event.data;

      if (typeof data === "string") {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(data);
        } else if (upstream.readyState === WebSocket.CONNECTING) {
          this.pendingMessages.push(data);
        }
        return;
      }

      if (data instanceof ArrayBuffer) {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(data);
        } else if (upstream.readyState === WebSocket.CONNECTING) {
          this.pendingMessages.push(new Uint8Array(data));
        }
      }
    });

    server.addEventListener("close", () => {
      closeAll(1000, "browser closed");
    });

    server.addEventListener("error", () => {
      closeAll(1011, "browser error");
    });

    upstream.addEventListener("open", () => {
      for (const message of this.pendingMessages) {
        upstream.send(asWsMessage(message));
      }
      this.pendingMessages = [];
    });

    upstream.addEventListener("message", (event) => {
      if (!this.browserSocket) {
        return;
      }

      this.browserSocket.send(event.data);
    });

    upstream.addEventListener("close", (event) => {
      try {
        server.close(event.code || 1000, "upstream closed");
      } catch {}

      this.browserSocket = null;
      this.upstreamSocket = null;
      this.pendingMessages = [];
    });

    upstream.addEventListener("error", () => {
      try {
        server.close(1011, "upstream error");
      } catch {}

      this.browserSocket = null;
      this.upstreamSocket = null;
      this.pendingMessages = [];
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit);
  }
}
