<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { formatDateTime, formatRelativeExpiry } from "$lib/devbox/format";
  import { killSandboxCommand, launchProfile, pauseSandboxCommand, resumeSandboxCommand } from "$lib/remote/devbox.remote";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let pendingLaunch = $state<string | null>(null);
  let pendingSandboxAction = $state<string | null>(null);
  let errorMessage = $state("");

  function sandboxesForProfile(profileId: string) {
    return data.dashboard.sandboxes.filter(
      (sandbox) => sandbox.metadata?.profileId === profileId,
    );
  }

  async function refreshDashboard() {
    errorMessage = "";

    try {
      await invalidateAll();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to refresh";
    }
  }

  async function handleLaunch(profileId: string) {
    pendingLaunch = profileId;
    errorMessage = "";

    try {
      const sandbox = await launchProfile({ profileId });
      await invalidateAll();
      await goto(`/sandboxes/${sandbox.sandboxID}`);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to launch sandbox";
    } finally {
      pendingLaunch = null;
    }
  }

  async function handleResume(sandboxId: string) {
    pendingSandboxAction = sandboxId;
    errorMessage = "";

    try {
      await resumeSandboxCommand({ sandboxId });
      await invalidateAll();
      await goto(`/sandboxes/${sandboxId}`);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to resume sandbox";
    } finally {
      pendingSandboxAction = null;
    }
  }

  async function handlePause(sandboxId: string) {
    pendingSandboxAction = sandboxId;
    errorMessage = "";

    try {
      await pauseSandboxCommand({ sandboxId });
      await invalidateAll();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to pause sandbox";
    } finally {
      pendingSandboxAction = null;
    }
  }

  async function handleKill(sandboxId: string) {
    pendingSandboxAction = sandboxId;
    errorMessage = "";

    try {
      await killSandboxCommand({ sandboxId });
      await invalidateAll();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to kill sandbox";
    } finally {
      pendingSandboxAction = null;
    }
  }
</script>

<svelte:head>
  <title>Devbox</title>
  <meta name="description" content="Personal E2B devbox dashboard" />
</svelte:head>

<div class="shell">
  <section class="hero surface">
    <div>
      <p class="eyebrow">POC</p>
      <h1>Devbox control plane</h1>
      <p class="muted intro">
        Personal SvelteKit front-end for E2B sandboxes. Profiles are static, auth is off,
        and the terminal is browser-first.
      </p>
    </div>

    <div class="hero-actions">
      <button data-variant="accent" onclick={refreshDashboard}>
        Refresh
      </button>
      <span class="pill">
        {data.dashboard.sandboxes.length} sandbox{data.dashboard.sandboxes.length === 1 ? "" : "es"}
      </span>
    </div>
  </section>

  {#if errorMessage}
    <p class="error-banner">{errorMessage}</p>
  {/if}

  <div class="grid">
    {#each data.dashboard.profiles as profile (profile.id)}
      <article class="surface card">
        <div class="card-top">
          <div>
            <h2>{profile.label}</h2>
            <p class="muted">{profile.description}</p>
          </div>
          <span class="pill">{Math.round(profile.timeoutMs / 60000)}m TTL</span>
        </div>

        <dl class="meta">
          <div>
            <dt>Template</dt>
            <dd>{profile.template}</dd>
          </div>
          <div>
            <dt>Workdir</dt>
            <dd>{profile.cwd}</dd>
          </div>
          <div>
            <dt>Shell</dt>
            <dd>{profile.terminalCommand}</dd>
          </div>
        </dl>

        <button
          data-variant="accent"
          onclick={() => handleLaunch(profile.id)}
          disabled={pendingLaunch === profile.id}
        >
          {pendingLaunch === profile.id ? "Launching..." : "Launch sandbox"}
        </button>

        <div class="sandbox-list">
          {#if sandboxesForProfile(profile.id).length === 0}
            <p class="muted empty">No sandbox yet.</p>
          {:else}
            {#each sandboxesForProfile(profile.id) as sandbox (sandbox.sandboxID)}
              <div class="sandbox-row">
                <div class="sandbox-copy">
                  <div class="sandbox-row-top">
                    <a href={`/sandboxes/${sandbox.sandboxID}`}>{sandbox.sandboxID}</a>
                    <span class="pill" data-state={sandbox.state}>{sandbox.state}</span>
                  </div>
                  <p class="muted">
                    started {formatDateTime(sandbox.startedAt)} · {formatRelativeExpiry(sandbox.endAt)}
                  </p>
                </div>
                <div class="sandbox-actions">
                  {#if sandbox.state === "paused"}
                    <button
                      onclick={() => handleResume(sandbox.sandboxID)}
                      disabled={pendingSandboxAction === sandbox.sandboxID}
                    >
                      Resume
                    </button>
                  {:else}
                    <a class="link-button" href={`/sandboxes/${sandbox.sandboxID}`}>Open</a>
                    <button
                      onclick={() => handlePause(sandbox.sandboxID)}
                      disabled={pendingSandboxAction === sandbox.sandboxID}
                    >
                      Pause
                    </button>
                  {/if}

                  <button
                    data-variant="danger"
                    onclick={() => handleKill(sandbox.sandboxID)}
                    disabled={pendingSandboxAction === sandbox.sandboxID}
                  >
                    Kill
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </article>
    {/each}
  </div>
</div>

<style>
  .hero {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
    border-radius: 28px;
    padding: 1.5rem;
    margin-bottom: 1.25rem;
  }

  .eyebrow {
    margin: 0 0 0.5rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent-2);
    font-size: 0.82rem;
  }

  h1 {
    margin: 0;
    font-size: clamp(2rem, 4vw, 3.4rem);
    line-height: 0.95;
  }

  .intro {
    max-width: 52rem;
    margin: 0.8rem 0 0;
    font-size: 1rem;
  }

  .hero-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .error-banner {
    margin: 0 0 1rem;
    padding: 0.9rem 1rem;
    border-radius: 18px;
    border: 1px solid rgba(248, 113, 113, 0.35);
    background: rgba(248, 113, 113, 0.12);
    color: #ffd4d4;
  }

  .grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  }

  .card {
    border-radius: 24px;
    padding: 1.25rem;
    display: grid;
    gap: 1rem;
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: start;
  }

  .card h2 {
    margin: 0 0 0.35rem;
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    margin: 0;
  }

  .meta dt {
    color: var(--muted);
    font-size: 0.85rem;
    margin-bottom: 0.25rem;
  }

  .meta dd {
    margin: 0;
    font-size: 0.95rem;
    overflow-wrap: anywhere;
  }

  .sandbox-list {
    display: grid;
    gap: 0.75rem;
  }

  .sandbox-row {
    display: grid;
    gap: 0.85rem;
    padding: 0.9rem;
    border-radius: 18px;
    background: rgba(12, 15, 20, 0.55);
    border: 1px solid rgba(42, 52, 66, 0.65);
  }

  .sandbox-row-top {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .sandbox-copy p {
    margin: 0.35rem 0 0;
    font-size: 0.92rem;
  }

  .sandbox-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .link-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    background: var(--panel-2);
    border-radius: 14px;
    padding: 0.7rem 1rem;
    text-decoration: none;
  }

  .empty {
    margin: 0;
  }

  @media (max-width: 760px) {
    .hero {
      flex-direction: column;
    }

    .meta {
      grid-template-columns: 1fr;
    }
  }
</style>
