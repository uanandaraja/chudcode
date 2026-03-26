<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Terminal as XtermTerminal } from "@xterm/xterm";
  import type { FitAddon } from "@xterm/addon-fit";
  import type { SandboxAddon } from "@cloudflare/sandbox/xterm";
  import type { ListedSandbox } from "$lib/chudcode/types";
  import { WarningCircle, X } from "phosphor-svelte";
  import "@xterm/xterm/css/xterm.css";

  let {
    sandbox,
    active = false,
    visible = true,
    label,
    closeable = false,
    onActivate,
    onClose,
  }: {
    sandbox: ListedSandbox;
    active?: boolean;
    visible?: boolean;
    label: string;
    closeable?: boolean;
    onActivate?: () => void;
    onClose?: () => void;
  } = $props();

  let terminalElement = $state<HTMLDivElement | null>(null);
  let terminalState = $state<"idle" | "connecting" | "open" | "closed" | "error">("idle");
  let terminalError = $state("");

  let terminal: XtermTerminal | null = null;
  let fitAddon: FitAddon | null = null;
  let sandboxAddon: SandboxAddon | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let terminalReady = false;
  let focusRun = 0;
  let terminalSessionId = "";

  function cssVar(name: string, fallback: string) {
    if (typeof document === "undefined") return fallback;
    return (
      getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
    );
  }

  function cleanupResizeObserver() {
    resizeObserver?.disconnect();
    resizeObserver = null;
  }

  function cleanupTerminalConnection() {
    cleanupResizeObserver();
    sandboxAddon?.disconnect();
  }

  function fitTerminal() {
    if (!visible || !fitAddon) return;

    try {
      fitAddon.fit();
    } catch {
      // Ignore transient fit failures while the pane is mounting or hidden.
    }
  }

  function observeTerminal() {
    cleanupResizeObserver();

    if (!visible || !terminalElement) return;

    resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitTerminal();
      });
    });

    resizeObserver.observe(terminalElement);
  }

  async function syncActiveTerminal() {
    if (!active || !visible || !terminal) return;

    const currentRun = ++focusRun;
    await tick();

    if (currentRun !== focusRun || !active || !visible || !terminal) return;

    requestAnimationFrame(() => {
      if (currentRun !== focusRun || !active || !visible || !terminal) return;

      fitTerminal();
      terminalElement?.focus();
      terminal.focus();
    });
  }

  function activatePane() {
    onActivate?.();
  }

  function openTerminal() {
    if (!sandboxAddon || !terminalReady || sandbox.state !== "running") return;

    terminalState = "connecting";
    terminalError = "";
    sandboxAddon.connect({
      sandboxId: sandbox.sandboxID,
      sessionId: terminalSessionId,
    });
    requestAnimationFrame(() => {
      fitTerminal();
    });
  }

  onMount(() => {
    if (!terminalElement) return;

    let disposed = false;

    void (async () => {
      const [{ Terminal }, { FitAddon }, { SandboxAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@cloudflare/sandbox/xterm"),
      ]);

      if (disposed || !terminalElement) return;

      terminalSessionId = crypto.randomUUID();

      const nextTerminal = new Terminal({
        cursorBlink: true,
        cursorStyle: "block",
        fontSize: 14,
        fontFamily:
          '"TX-02-XlabMono", "TX02Mono", "TX-02 Mono", "SFMono-Regular", "IBM Plex Mono", ui-monospace, monospace',
        scrollback: 10_000,
        allowTransparency: false,
        theme: {
          background: cssVar("--terminal-background", "#0b0f14"),
          foreground: cssVar("--terminal-foreground", "#edf4ff"),
          cursor: cssVar("--terminal-cursor", "#9ca3af"),
          cursorAccent: cssVar("--terminal-background", "#0b0f14"),
          selectionBackground: cssVar(
            "--terminal-selection",
            "rgba(103, 200, 255, 0.22)",
          ),
        },
      });

      const nextFitAddon = new FitAddon();
      const nextSandboxAddon = new SandboxAddon({
        reconnect: true,
        getWebSocketUrl: ({ sandboxId, sessionId, origin }) => {
          const url = new URL(`/api/terminal/${sandboxId}`, origin);
          if (sessionId) {
            url.searchParams.set("session", sessionId);
          }
          return url.toString();
        },
        onStateChange: (state, error) => {
          if (state === "connecting") {
            terminalState = "connecting";
            terminalError = "";
            return;
          }

          if (state === "connected") {
            terminalState = "open";
            terminalError = "";
            requestAnimationFrame(() => {
              fitTerminal();
            });
            return;
          }

          if (error) {
            terminalState = "error";
            terminalError = error.message;
            return;
          }

          if (terminalState !== "error") {
            terminalState = "closed";
          }
        },
      });

      nextTerminal.loadAddon(nextFitAddon);
      nextTerminal.loadAddon(nextSandboxAddon);
      nextTerminal.open(terminalElement);

      terminal = nextTerminal;
      fitAddon = nextFitAddon;
      sandboxAddon = nextSandboxAddon;
      terminalReady = true;

      observeTerminal();
      fitTerminal();

      if (sandbox.state === "running") {
        openTerminal();
      }
    })().catch((error) => {
      terminalState = "error";
      terminalError = error instanceof Error ? error.message : "Failed to initialize terminal";
    });

    return () => {
      disposed = true;
      cleanupTerminalConnection();
      sandboxAddon?.dispose();
      sandboxAddon = null;
      fitAddon?.dispose?.();
      fitAddon = null;
      terminal?.dispose();
      terminal = null;
      terminalReady = false;
    };
  });

  $effect(() => {
    if (!visible) {
      cleanupResizeObserver();
      terminal?.blur?.();
      return;
    }

    if (terminalReady) {
      observeTerminal();
      fitTerminal();
    }
  });

  $effect(() => {
    if (terminalReady && sandbox.state === "running" && terminalState === "idle") {
      openTerminal();
    }
  });

  $effect(() => {
    if (terminalReady && active && visible) {
      void syncActiveTerminal();
    }
  });
</script>

<div
  class="relative flex min-h-0 min-w-0 h-full flex-1 flex-col overflow-hidden border transition-colors {active
    ? 'border-border bg-field/20 shadow-[0_0_0_1px_color-mix(in_oklch,var(--border)_85%,transparent)]'
    : 'border-border/50 bg-field/10'}"
  onfocusin={activatePane}
>
  {#if closeable && onClose}
    <button
      type="button"
      class="absolute right-2 top-2 z-10 inline-flex size-7 items-center justify-center rounded-md border border-border/70 bg-background/90 text-foreground/55 backdrop-blur transition hover:border-border hover:text-foreground"
      aria-label={`Close ${label}`}
      onclick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <X class="size-3.5" />
    </button>
  {/if}

  {#if terminalError}
    <div class="flex items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <WarningCircle class="size-3.5 flex-shrink-0" />
      {terminalError}
    </div>
  {/if}

  <div class="terminal-shell min-h-0 flex-1 overflow-hidden">
    <div
      class="terminal-host h-full outline-none"
      bind:this={terminalElement}
      tabindex="-1"
    ></div>
  </div>
</div>
