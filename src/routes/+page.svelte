<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  import TerminalPanel from "$lib/components/TerminalPanel.svelte";

  let { data }: { data: PageData } = $props();

  const selectedSandboxId = $derived(page.url.searchParams.get("sandbox"));
  const selectedSandbox = $derived(
    selectedSandboxId
      ? (data.sandboxes.find((s) => s.sandboxID === selectedSandboxId) ?? null)
      : null,
  );
</script>

<svelte:head>
  <title>Devbox</title>
</svelte:head>

{#if selectedSandbox}
  {#key selectedSandbox.sandboxID}
    <TerminalPanel sandbox={selectedSandbox} onKilled={() => goto("/")} />
  {/key}
{:else}
  <!-- Empty state -->
  <div class="flex h-full flex-col items-center justify-center gap-10">
    <!-- Pixel-style wordmark -->
    <div class="select-none text-center">
      <h1
        class="font-mono text-[clamp(2rem,6vw,4rem)] font-black tracking-[0.3em] text-foreground/[0.07]"
      >
        DEVBOX
      </h1>
    </div>

    {#if data.workspaces.length === 0}
      <!-- No workspaces yet -->
      <div class="text-center">
        <p class="text-sm text-foreground/40">No workspaces yet.</p>
        <p class="mt-1 text-xs text-foreground/25">
          Use the <span class="font-mono">+</span> in the sidebar to add one.
        </p>
      </div>
    {:else}
      <!-- Has workspaces, just nothing selected -->
      <div class="text-center">
        <p class="text-sm text-foreground/35">Select a sandbox from the sidebar</p>
        <p class="mt-1 text-xs text-foreground/25">or launch a new one from a workspace.</p>
      </div>
    {/if}
  </div>
{/if}
