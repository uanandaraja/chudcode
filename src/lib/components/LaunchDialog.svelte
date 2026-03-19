<script lang="ts">
  import type { Workspace } from "$lib/devbox/types";
  import { launchWorkspace } from "$lib/remote/devbox.remote";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Rocket, X, GitBranch, GithubLogo } from "phosphor-svelte";

  let {
    workspace,
    onClose,
    onLaunched,
  }: {
    workspace: Workspace;
    onClose: () => void;
    onLaunched: (sandboxId: string) => void;
  } = $props();

  let pending = $state(false);
  let error = $state("");

  async function handleLaunch() {
    pending = true;
    error = "";
    try {
      const sandbox = await launchWorkspace({ workspaceId: workspace.id });
      onLaunched(sandbox.sandboxID);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to launch sandbox";
      pending = false;
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget && !pending) onClose();
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget || pending) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && !pending) onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
  onclick={handleBackdropClick}
  onkeydown={handleBackdropKeydown}
  tabindex="0"
  role="dialog"
  aria-modal="true"
  aria-label="Launch sandbox"
>
  <div class="w-full max-w-sm rounded-xl border border-white/[0.1] bg-[oklch(0.17_0_0)] p-6 shadow-2xl">
    <!-- Header -->
    <div class="mb-5 flex items-center justify-between">
      <h2 class="text-base font-semibold text-foreground">Launch sandbox</h2>
      <button
        onclick={onClose}
        disabled={pending}
        class="flex size-7 items-center justify-center rounded-md text-foreground/40 transition-colors hover:bg-white/[0.07] hover:text-foreground disabled:pointer-events-none"
      >
        <X class="size-4" />
      </button>
    </div>

    <!-- Workspace info -->
    <div class="mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4">
      <p class="mb-2 text-sm font-semibold text-foreground">{workspace.name}</p>
      <div class="space-y-1.5">
        <div class="flex items-center gap-2 text-sm text-foreground/50">
          <GithubLogo class="size-3.5" />
          <span class="font-mono">{workspace.owner}/{workspace.repo}</span>
        </div>
        {#if workspace.defaultBranch}
          <div class="flex items-center gap-2 text-sm text-foreground/50">
            <GitBranch class="size-3.5" />
            <span class="font-mono">{workspace.defaultBranch}</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Error -->
    {#if error}
      <div
        class="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
      >
        {error}
      </div>
    {/if}

    <!-- Description -->
    {#if !error}
      <p class="mb-5 text-[13px] text-foreground/45 leading-5">
        Clones the repo into a new E2B sandbox and opens a terminal. TTL is 60 minutes.
      </p>
    {/if}

    <!-- Actions -->
    <div class="flex justify-end gap-2">
      <Button variant="ghost" size="sm" onclick={onClose} disabled={pending}>Cancel</Button>
      <Button size="sm" onclick={handleLaunch} disabled={pending}>
        <Rocket class="size-3.5" />
        {pending ? "Launching..." : "Launch"}
      </Button>
    </div>
  </div>
</div>
