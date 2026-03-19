<script lang="ts">
  import "../app.css";
  import { goto, invalidateAll } from "$app/navigation";
  import type { LayoutData } from "./$types";
  import type { Workspace } from "$lib/devbox/types";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import WorkspaceModal from "$lib/components/WorkspaceModal.svelte";
  import LaunchDialog from "$lib/components/LaunchDialog.svelte";

  let { children, data }: { children: import("svelte").Snippet; data: LayoutData } = $props();

  let workspaceModalOpen = $state(false);
  let workspaceModalWorkspace = $state<Workspace | null>(null);
  let launchDialogOpen = $state(false);
  let launchDialogWorkspace = $state<Workspace | null>(null);

  function openCreateModal() {
    workspaceModalWorkspace = null;
    workspaceModalOpen = true;
  }

  function openEditModal(workspace: Workspace) {
    workspaceModalWorkspace = workspace;
    workspaceModalOpen = true;
  }

  function openLaunchDialog(workspace: Workspace) {
    launchDialogWorkspace = workspace;
    launchDialogOpen = true;
  }

  async function onWorkspaceSaved() {
    workspaceModalOpen = false;
    await invalidateAll();
  }

  async function onSandboxLaunched(sandboxId: string) {
    launchDialogOpen = false;
    await invalidateAll();
    await goto(`/?sandbox=${sandboxId}`);
  }
</script>

<div class="flex h-screen overflow-hidden">
  <Sidebar
    workspaces={data.workspaces}
    sandboxes={data.sandboxes}
    onAddWorkspace={openCreateModal}
    onEditWorkspace={openEditModal}
    onLaunchWorkspace={openLaunchDialog}
  />

  <main class="flex flex-1 flex-col overflow-hidden">
    {@render children()}
  </main>
</div>

{#if workspaceModalOpen}
  <WorkspaceModal
    workspace={workspaceModalWorkspace}
    onClose={() => (workspaceModalOpen = false)}
    onSaved={onWorkspaceSaved}
  />
{/if}

{#if launchDialogOpen && launchDialogWorkspace}
  <LaunchDialog
    workspace={launchDialogWorkspace}
    onClose={() => (launchDialogOpen = false)}
    onLaunched={onSandboxLaunched}
  />
{/if}
