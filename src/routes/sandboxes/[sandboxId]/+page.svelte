<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { onMount, tick } from "svelte";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import "@xterm/xterm/css/xterm.css";
  import { formatDateTime, formatRelativeExpiry } from "$lib/devbox/format";
  import { killSandboxCommand, pauseSandboxCommand, resumeSandboxCommand } from "$lib/remote/devbox.remote";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const sandboxId = $derived(data.sandbox.sandboxID);
  const sandbox = $derived(data.sandbox);

  let terminalElement = $state<HTMLDivElement | null>(null);
  let terminalState = $state<"idle" | "connecting" | "open" | "closed" | "error">("idle");
  let terminalError = $state("");
  let actionPending = $state(false);
  let pageError = $state("");

  let terminal: Terminal | null = null;
  let fitAddon: FitAddon | null = null;
  let socket: WebSocket | null = null;
  let sessionId = "";
  let resizeObserver: ResizeObserver | null = null;

  async function refreshSandbox() {
    pageError = "";

    try {
      await invalidateAll();
    } catch (error) {
      pageError = error instanceof Error ? error.message : "Failed to refresh sandbox";
    }
  }

  function cleanupSocket() {
    resizeObserver?.disconnect();
    resizeObserver = null;

    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
      socket = null;
    }
  }

  function sendResize() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !terminal) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: "resize",
        cols: terminal.cols,
        rows: terminal.rows,
      }),
    );
  }

  async function openTerminal() {
    if (!terminal || sandbox.state !== "running") {
      return;
    }

    cleanupSocket();
    terminal.reset();
    terminal.clear();
    terminalState = "connecting";
    terminalError = "";
    sessionId = crypto.randomUUID();

    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const url = new URL(
      `${protocol}://${location.host}/api/terminal/${sandbox.sandboxID}`,
    );
    url.searchParams.set("session", sessionId);

    socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      const currentTerminal = terminal;
      if (!currentTerminal) {
        return;
      }

      terminalState = "open";
      currentTerminal.focus();
      sendResize();
      resizeObserver = new ResizeObserver(() => {
        fitAddon?.fit();
        sendResize();
      });
      if (terminalElement) {
        resizeObserver.observe(terminalElement);
      }
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        terminal?.write(event.data);
        return;
      }

      terminal?.write(new Uint8Array(event.data));
    };

    socket.onerror = () => {
      terminalState = "error";
      terminalError = "Terminal socket failed";
    };

    socket.onclose = () => {
      if (terminalState !== "error") {
        terminalState = "closed";
      }
    };
  }

  async function handleResume() {
    actionPending = true;
    pageError = "";

    try {
      await resumeSandboxCommand({ sandboxId });
      await invalidateAll();
      await tick();
      await openTerminal();
    } catch (error) {
      pageError = error instanceof Error ? error.message : "Failed to resume sandbox";
    } finally {
      actionPending = false;
    }
  }

  async function handlePause() {
    actionPending = true;
    pageError = "";

    try {
      cleanupSocket();
      await pauseSandboxCommand({ sandboxId });
      await refreshSandbox();
      terminalState = "idle";
    } catch (error) {
      pageError = error instanceof Error ? error.message : "Failed to pause sandbox";
    } finally {
      actionPending = false;
    }
  }

  async function handleKill() {
    actionPending = true;
    pageError = "";

    try {
      cleanupSocket();
      await killSandboxCommand({ sandboxId });
      await goto("/");
    } catch (error) {
      pageError = error instanceof Error ? error.message : "Failed to kill sandbox";
    } finally {
      actionPending = false;
    }
  }

  onMount(() => {
    if (!terminalElement) {
      return;
    }

    terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily:
        '"Berkeley Mono", "JetBrains Mono", "SFMono-Regular", Menlo, monospace',
      fontSize: 14,
      theme: {
        background: "#0b0f14",
        foreground: "#edf4ff",
        cursor: "#6ee7b7",
        selectionBackground: "rgba(103, 200, 255, 0.22)",
      },
    });
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalElement);
    fitAddon.fit();

    terminal.onData((data) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "input", data }));
      }
    });

    if (sandbox.state === "running") {
      void openTerminal();
    }

    return () => {
      cleanupSocket();
      terminal?.dispose();
      terminal = null;
      fitAddon = null;
    };
  });

  $effect(() => {
    if (sandbox.state === "running" && terminalState === "idle" && terminal) {
      void openTerminal();
    }
  });
</script>

<svelte:head>
  <title>{sandboxId} · Devbox</title>
</svelte:head>

<div class="shell">
  <div class="topbar">
    <a href="/">← Back</a>
    <div class="topbar-actions">
      <button onclick={refreshSandbox} disabled={actionPending}>Refresh status</button>
      {#if sandbox.state === "paused"}
        <button data-variant="accent" onclick={handleResume} disabled={actionPending}>
          Resume
        </button>
      {:else}
        <button onclick={handlePause} disabled={actionPending}>Pause</button>
      {/if}
      <button data-variant="danger" onclick={handleKill} disabled={actionPending}>
        Kill
      </button>
    </div>
  </div>

  {#if pageError}
    <p class="error-banner">{pageError}</p>
  {/if}

  <section class="surface header-card">
    <div>
      <div class="header-row">
        <h1>{sandbox.sandboxID}</h1>
        <span class="pill" data-state={sandbox.state}>{sandbox.state}</span>
      </div>
      <p class="muted subtitle">
        {sandbox.metadata?.profileLabel ?? sandbox.metadata?.profileId ?? "unprofiled"} ·
        started {formatDateTime(sandbox.startedAt)} · {formatRelativeExpiry(sandbox.endAt)}
      </p>
    </div>

    <dl class="header-meta">
      <div>
        <dt>Template</dt>
        <dd>{sandbox.templateID}</dd>
      </div>
      <div>
        <dt>Memory</dt>
        <dd>{sandbox.memoryMB} MiB</dd>
      </div>
      <div>
        <dt>CPU</dt>
        <dd>{sandbox.cpuCount}</dd>
      </div>
    </dl>
  </section>

  <section class="surface terminal-card">
    <div class="terminal-toolbar">
      <div>
        <strong>Terminal</strong>
        <p class="muted toolbar-copy">
          New PTY on each reconnect. Use <code>tmux</code> inside the sandbox if you want persistence.
        </p>
      </div>

      <div class="terminal-actions">
        <span class="pill">{terminalState}</span>
        <button data-variant="accent" onclick={openTerminal} disabled={sandbox.state !== "running"}>
          Reconnect
        </button>
      </div>
    </div>

    {#if terminalError}
      <p class="error-banner">{terminalError}</p>
    {/if}

    {#if sandbox.state === "paused"}
      <div class="paused">
        <p class="muted">Sandbox is paused. Resume it to open a new terminal session.</p>
      </div>
    {/if}

    <div class="terminal-frame" bind:this={terminalElement}></div>
  </section>
</div>

<style>
  .topbar {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
  }

  .topbar a {
    text-decoration: none;
    color: var(--muted);
  }

  .topbar-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .header-card,
  .terminal-card {
    border-radius: 24px;
    padding: 1.25rem;
  }

  .header-card {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .header-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .header-row h1 {
    margin: 0;
    font-size: clamp(1.4rem, 2vw, 2.1rem);
  }

  .subtitle {
    margin: 0.45rem 0 0;
  }

  .header-meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    margin: 0;
  }

  .header-meta dt {
    color: var(--muted);
    font-size: 0.82rem;
    margin-bottom: 0.2rem;
  }

  .header-meta dd {
    margin: 0;
  }

  .terminal-toolbar {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: start;
    margin-bottom: 1rem;
  }

  .toolbar-copy {
    margin: 0.25rem 0 0;
  }

  .terminal-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .terminal-frame {
    min-height: 62vh;
    border-radius: 18px;
    overflow: hidden;
    background: #0b0f14;
    border: 1px solid rgba(42, 52, 66, 0.8);
    padding: 0.35rem;
  }

  .paused {
    margin-bottom: 0.75rem;
  }

  .error-banner {
    margin: 0 0 1rem;
    padding: 0.9rem 1rem;
    border-radius: 18px;
    border: 1px solid rgba(248, 113, 113, 0.35);
    background: rgba(248, 113, 113, 0.12);
    color: #ffd4d4;
  }

  @media (max-width: 760px) {
    .topbar,
    .header-card,
    .terminal-toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .header-meta {
      grid-template-columns: 1fr;
    }

    .terminal-frame {
      min-height: 50vh;
    }
  }
</style>
