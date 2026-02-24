<script lang="ts">
  import { sourcePickerOpen, captureSourceType, doSetCaptureSource } from "../lib/stores";
  import { getCaptureSourcess } from "../lib/bridge";
  import type { CaptureSource } from "../lib/types";

  let tab: "monitors" | "windows" = $state("monitors");
  let monitors: CaptureSource[] = $state([]);
  let windows: CaptureSource[] = $state([]);
  let loading = $state(true);
  let selected: CaptureSource | null = $state(null);

  // Pre-select current source on open
  let currentType: string | null = null;
  captureSourceType.subscribe(v => (currentType = v));

  async function fetchSources() {
    loading = true;
    try {
      const result = await getCaptureSourcess();
      monitors = result.monitors || [];
      windows = result.windows || [];
    } catch {
      monitors = [];
      windows = [];
    }
    loading = false;
  }

  // Fetch on mount
  fetchSources();

  function handleSelect() {
    if (!selected) return;
    doSetCaptureSource(selected.type, selected.id, selected.name);
  }

  function handleClose() {
    sourcePickerOpen.set(false);
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) handleClose();
  }

  let items = $derived(tab === "monitors" ? monitors : windows);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="backdrop" onclick={handleBackdropClick}>
  <div class="modal">
    <div class="header">
      <span class="title">Select Source</span>
      <button class="close" onclick={handleClose}>x</button>
    </div>

    <div class="tabs">
      <button class="tab" class:active={tab === "monitors"} onclick={() => (tab = "monitors")}>
        Screens
      </button>
      <button class="tab" class:active={tab === "windows"} onclick={() => (tab = "windows")}>
        Apps
      </button>
      <div class="tab-spacer"></div>
      <button class="refresh" onclick={fetchSources} disabled={loading}>Refresh</button>
    </div>

    <div class="grid-area">
      {#if loading}
        <div class="loading">
          <div class="spinner"></div>
          <span>Scanning sources...</span>
        </div>
      {:else if items.length === 0}
        <div class="empty">No {tab === "monitors" ? "screens" : "windows"} found</div>
      {:else}
        <div class="grid">
          {#each items as item (item.id)}
            <button
              class="card"
              class:selected={selected?.id === item.id && selected?.type === item.type}
              onclick={() => (selected = item)}
            >
              <div class="thumb">
                {#if item.thumbnail}
                  <img src="data:image/jpeg;base64,{item.thumbnail}" alt={item.name} />
                {:else}
                  <div class="thumb-placeholder">
                    {item.type === "monitor" ? "🖥" : "🪟"}
                  </div>
                {/if}
              </div>
              <span class="card-name">{item.name}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="footer">
      <button class="btn-cancel" onclick={handleClose}>Cancel</button>
      <button class="btn-select" disabled={!selected} onclick={handleSelect}>
        Select
      </button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    width: 600px;
    max-height: 480px;
    background: var(--ctp-mantle);
    border: 1px solid var(--ctp-surface0);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px 10px;
    flex-shrink: 0;
  }

  .title {
    font-size: 15px;
    font-weight: 700;
    color: var(--ctp-text);
    letter-spacing: 0.3px;
  }

  .close {
    background: none;
    border: none;
    color: var(--ctp-overlay0);
    font-size: 16px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: inherit;
    font-weight: 700;
  }
  .close:hover { color: var(--ctp-red); background: rgba(243, 139, 168, 0.1); }

  .tabs {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 18px 12px;
    flex-shrink: 0;
  }

  .tab {
    font-size: 13px;
    padding: 7px 16px;
    border-radius: 6px;
    border: 1px solid var(--ctp-surface0);
    background: var(--ctp-base);
    color: var(--ctp-surface2);
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
    transition: all 0.1s;
  }
  .tab.active {
    background: rgba(137, 180, 250, 0.1);
    color: var(--ctp-blue);
    border-color: var(--ctp-blue);
  }

  .tab-spacer { flex: 1; }

  .refresh {
    font-size: 12px;
    padding: 5px 12px;
    border-radius: 5px;
    border: 1px solid var(--ctp-surface0);
    background: var(--ctp-base);
    color: var(--ctp-overlay0);
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
  }
  .refresh:hover { border-color: var(--ctp-surface2); color: var(--ctp-text); }
  .refresh:disabled { opacity: 0.5; cursor: default; }

  .grid-area {
    flex: 1;
    overflow-y: auto;
    padding: 0 18px;
    min-height: 0;
    scrollbar-width: thin;
    scrollbar-color: var(--ctp-surface0) var(--ctp-mantle);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    padding-bottom: 12px;
  }

  .card {
    background: var(--ctp-base);
    border: 2px solid var(--ctp-surface0);
    border-radius: 8px;
    cursor: pointer;
    padding: 0;
    overflow: hidden;
    transition: all 0.1s;
    display: flex;
    flex-direction: column;
    font-family: inherit;
    text-align: left;
  }
  .card:hover { border-color: var(--ctp-surface2); }
  .card.selected {
    border-color: var(--ctp-blue);
    box-shadow: 0 0 0 1px var(--ctp-blue);
  }

  .thumb {
    width: 100%;
    aspect-ratio: 16 / 9;
    background: var(--ctp-crust);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .thumb-placeholder {
    font-size: 28px;
    opacity: 0.4;
  }

  .card-name {
    padding: 6px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--ctp-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 0;
    color: var(--ctp-overlay0);
    font-size: 13px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--ctp-surface0);
    border-top-color: var(--ctp-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty {
    text-align: center;
    padding: 48px 0;
    color: var(--ctp-surface1);
    font-style: italic;
    font-size: 14px;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid var(--ctp-surface0);
    flex-shrink: 0;
  }

  .btn-cancel {
    font-size: 13px;
    padding: 7px 16px;
    border-radius: 6px;
    border: 1px solid var(--ctp-surface0);
    background: var(--ctp-base);
    color: var(--ctp-overlay0);
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
  }
  .btn-cancel:hover { border-color: var(--ctp-surface2); color: var(--ctp-text); }

  .btn-select {
    font-size: 13px;
    padding: 7px 20px;
    border-radius: 6px;
    border: 1px solid var(--ctp-blue);
    background: var(--ctp-blue);
    color: var(--ctp-base);
    cursor: pointer;
    font-family: inherit;
    font-weight: 700;
  }
  .btn-select:hover { opacity: 0.9; }
  .btn-select:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
