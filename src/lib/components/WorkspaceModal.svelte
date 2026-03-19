<script lang="ts">
  import type { Workspace } from "$lib/devbox/types";
  import { createWorkspaceCommand, updateWorkspaceCommand } from "$lib/remote/devbox.remote";
  import { Button } from "$lib/components/ui/button/index.js";
  import { X } from "phosphor-svelte";

  let {
    workspace = null,
    onClose,
    onSaved,
  }: {
    workspace?: Workspace | null;
    onClose: () => void;
    onSaved: () => void;
  } = $props();

  const isEditing = $derived(workspace !== null);

  const fieldClass =
    "flex h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 text-sm outline-none transition placeholder:text-foreground/25 focus:border-white/20 focus:ring-1 focus:ring-white/10";
  const textareaClass =
    "flex min-h-20 w-full rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-sm outline-none transition placeholder:text-foreground/25 focus:border-white/20 focus:ring-1 focus:ring-white/10 resize-none";

  function toDisplayName(repoUrl: string) {
    const normalized = repoUrl.trim().replace(/\/+$/, "");
    if (!normalized) return "";
    const match =
      normalized.match(/([^/:]+?)(?:\.git)?$/) ??
      normalized.match(/^([^/]+)\/([^/]+?)(?:\.git)?$/);
    const repoName = match ? match[match.length - 1] : normalized;
    return repoName
      .replace(/\.git$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
  }

  function toWorkspaceForm(currentWorkspace: Workspace | null | undefined) {
    return {
      name: currentWorkspace?.name ?? "",
      repoUrl: currentWorkspace
        ? `${currentWorkspace.owner}/${currentWorkspace.repo}`
        : "",
      defaultBranch: currentWorkspace?.defaultBranch ?? "",
      notes: currentWorkspace?.notes ?? "",
    };
  }

  let form = $state(toWorkspaceForm(null));
  let syncedWorkspaceId = $state<string | null>(null);
  let nameTouched = $state(false);
  let pending = $state(false);
  let error = $state("");

  $effect(() => {
    const currentWorkspaceId = workspace?.id ?? null;

    if (currentWorkspaceId === syncedWorkspaceId) {
      return;
    }

    form = toWorkspaceForm(workspace);
    nameTouched = Boolean(workspace?.name);
    syncedWorkspaceId = currentWorkspaceId;
    error = "";
  });

  function handleNameInput(value: string) {
    nameTouched = value.trim().length > 0;
    form.name = value;
  }

  function handleRepoUrlInput(value: string) {
    form.repoUrl = value;
    if (!nameTouched || !form.name.trim()) {
      form.name = toDisplayName(value);
      nameTouched = false;
    }
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    pending = true;
    error = "";

    try {
      if (isEditing && workspace) {
        await updateWorkspaceCommand({
          workspaceId: workspace.id,
          name: form.name,
          repoUrl: form.repoUrl,
          defaultBranch: form.defaultBranch || null,
          notes: form.notes || null,
        });
      } else {
        await createWorkspaceCommand({
          name: form.name,
          repoUrl: form.repoUrl,
          defaultBranch: form.defaultBranch || null,
          notes: form.notes || null,
        });
      }
      onSaved();
    } catch (err) {
      error = err instanceof Error ? err.message : "Something went wrong";
    } finally {
      pending = false;
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") onClose();
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
  aria-label={isEditing ? "Edit workspace" : "New workspace"}
>
  <div class="w-full max-w-md rounded-xl border border-white/[0.1] bg-[oklch(0.17_0_0)] p-6 shadow-2xl">
    <!-- Header -->
    <div class="mb-5 flex items-center justify-between">
      <h2 class="text-base font-semibold text-foreground">
        {isEditing ? "Edit workspace" : "New workspace"}
      </h2>
      <button
        onclick={onClose}
        class="flex size-7 items-center justify-center rounded-md text-foreground/40 transition-colors hover:bg-white/[0.07] hover:text-foreground"
      >
        <X class="size-4" />
      </button>
    </div>

    <!-- Error -->
    {#if error}
      <div
        class="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
      >
        {error}
      </div>
    {/if}

    <!-- Form -->
    <form class="grid gap-4" onsubmit={handleSubmit}>
      <label class="grid gap-1.5 text-sm">
        <span class="text-[12px] font-medium text-foreground/50">GitHub repo</span>
        <input
          class={fieldClass}
          value={form.repoUrl}
          oninput={(e) => handleRepoUrlInput(e.currentTarget.value)}
          placeholder="https://github.com/owner/repo or owner/repo"
        />
      </label>

      <div class="grid grid-cols-2 gap-3">
        <label class="grid gap-1.5 text-sm">
          <span class="text-[12px] font-medium text-foreground/50">Display name</span>
          <input
            class={fieldClass}
            value={form.name}
            oninput={(e) => handleNameInput(e.currentTarget.value)}
            placeholder="My project"
          />
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="text-[12px] font-medium text-foreground/50">Branch</span>
          <input class={fieldClass} bind:value={form.defaultBranch} placeholder="main" />
        </label>
      </div>

      <label class="grid gap-1.5 text-sm">
        <span class="text-[12px] font-medium text-foreground/50">Notes</span>
        <textarea
          class={textareaClass}
          bind:value={form.notes}
          placeholder="Optional notes..."
        ></textarea>
      </label>

      <div class="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onclick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {#if pending}
            {isEditing ? "Saving..." : "Creating..."}
          {:else}
            {isEditing ? "Save" : "Create workspace"}
          {/if}
        </Button>
      </div>
    </form>
  </div>
</div>
