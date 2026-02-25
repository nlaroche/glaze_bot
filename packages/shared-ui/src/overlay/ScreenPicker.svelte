<script lang="ts">
  import Spotlight from './Spotlight.svelte';

  export interface CaptureSource {
    id: string;
    name: string;
    thumbnail?: string;
    type: 'screen' | 'window';
  }

  interface Props {
    open: boolean;
    initialTab?: 'screen' | 'app';
    sources: CaptureSource[];
    loading?: boolean;
    onselect: (source: CaptureSource) => void;
    onclose: () => void;
  }

  let { open, initialTab = 'screen', sources, loading = false, onselect, onclose }: Props = $props();

  let activeTab = $state<'screen' | 'app'>('screen');
  let selectedId = $state<string | null>(null);

  // Reset state when opening, apply initial tab
  $effect(() => {
    if (open) {
      activeTab = initialTab;
      selectedId = null;
    }
  });

  const filteredSources = $derived(
    activeTab === 'screen'
      ? sources.filter((s) => s.type === 'screen')
      : sources.filter((s) => s.type === 'window')
  );

  function handleSelect(source: CaptureSource) {
    selectedId = source.id;
  }

  function handleConfirm() {
    const source = sources.find((s) => s.id === selectedId);
    if (source) onselect(source);
  }

  const selectedSource = $derived(sources.find((s) => s.id === selectedId));
</script>

<Spotlight {open} {onclose}>
  <div class="picker">
    <div class="picker-header">
      <h2>Share</h2>
      <div class="tabs">
        <button
          class="tab"
          class:active={activeTab === 'screen'}
          onclick={() => { activeTab = 'screen'; selectedId = null; }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/></svg>
          Screens
        </button>
        <button
          class="tab"
          class:active={activeTab === 'app'}
          onclick={() => { activeTab = 'app'; selectedId = null; }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M6 5h4M6 8h4M6 11h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          Apps
        </button>
      </div>
    </div>

    <div class="source-grid">
      {#if loading}
        <div class="state-msg">
          <div class="spinner"></div>
          <span>Scanning...</span>
        </div>
      {:else if filteredSources.length === 0}
        <div class="state-msg">
          <span>No {activeTab === 'screen' ? 'displays' : 'application windows'} found</span>
        </div>
      {:else}
        {#each filteredSources as source (source.id)}
          <button
            class="source-card"
            class:selected={selectedId === source.id}
            onclick={() => handleSelect(source)}
            ondblclick={() => { handleSelect(source); handleConfirm(); }}
          >
            <div class="source-thumbnail">
              {#if source.thumbnail}
                <img src={source.thumbnail} alt={source.name} />
              {:else}
                <div class="source-placeholder">
                  {#if source.type === 'screen'}
                    <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
                      <rect x="4" y="6" width="32" height="22" rx="2" stroke="currentColor" stroke-width="2"/>
                      <path d="M16 32h8M20 28v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  {:else}
                    <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
                      <rect x="6" y="4" width="28" height="32" rx="2" stroke="currentColor" stroke-width="2"/>
                      <path d="M12 10h16M12 16h16M12 22h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  {/if}
                </div>
              {/if}
            </div>
            <span class="source-name">{source.name}</span>
          </button>
        {/each}
      {/if}
    </div>

    <div class="picker-footer">
      <div class="footer-left">
        {#if selectedSource}
          <div class="selected-preview">
            <div class="selected-dot"></div>
            <span class="selected-name">{selectedSource.name}</span>
          </div>
        {:else}
          <span class="no-selection">Select a source to share</span>
        {/if}
      </div>
      <div class="footer-actions">
        <button class="btn-cancel" onclick={onclose}>Cancel</button>
        <button class="btn-share" disabled={!selectedId} onclick={handleConfirm}>
          Share
        </button>
      </div>
    </div>
  </div>
</Spotlight>

<style>
  .picker {
    width: min(640px, 90vw);
    display: flex;
    flex-direction: column;
    background: rgba(12, 16, 28, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow:
      0 24px 80px rgba(0, 0, 0, 0.6),
      0 8px 24px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }

  .picker-header {
    padding: 16px 20px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: 1.05rem;
    color: var(--color-text-primary, #e2e8f0);
    font-weight: 600;
  }

  .tabs {
    display: flex;
    gap: 2px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    padding: 2px;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 14px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #5a6474);
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .tab:hover {
    color: var(--color-text-secondary, #8a94a6);
  }

  .tab.active {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-primary, #e2e8f0);
  }

  .source-grid {
    overflow-y: auto;
    padding: 16px 20px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
    min-height: 240px;
    max-height: 400px;
  }

  .state-msg {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 200px;
    color: var(--color-text-muted, #5a6474);
    font-size: 0.85rem;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--rarity-rare, #3B9797);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .source-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    border-radius: 10px;
    border: 2px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.03);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s;
    text-align: center;
  }

  .source-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
  }

  .source-card.selected {
    border-color: var(--rarity-rare, #3B9797);
    background: rgba(59, 151, 151, 0.08);
    box-shadow: 0 0 12px rgba(59, 151, 151, 0.15);
  }

  .source-thumbnail {
    aspect-ratio: 16 / 10;
    border-radius: 6px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .source-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .source-placeholder {
    color: var(--color-text-muted, #5a6474);
  }

  .source-name {
    font-size: 0.75rem;
    color: var(--color-text-secondary, #b0b8c8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 2px;
  }

  .source-card.selected .source-name {
    color: var(--color-text-primary, #e2e8f0);
  }

  .picker-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.15);
  }

  .footer-left {
    flex: 1;
    min-width: 0;
  }

  .selected-preview {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .selected-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--rarity-rare, #3B9797);
    box-shadow: 0 0 6px rgba(59, 151, 151, 0.5);
    flex-shrink: 0;
  }

  .selected-name {
    font-size: 0.82rem;
    color: var(--color-text-primary, #e2e8f0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .no-selection {
    font-size: 0.78rem;
    color: var(--color-text-muted, #5a6474);
  }

  .footer-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-cancel,
  .btn-share {
    padding: 7px 18px;
    border-radius: 6px;
    font-size: 0.82rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    border: 1px solid;
  }

  .btn-cancel {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--color-text-secondary, #8a94a6);
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-primary, #e2e8f0);
  }

  .btn-share {
    background: rgba(59, 151, 151, 0.2);
    border-color: rgba(59, 151, 151, 0.4);
    color: #5bcece;
    font-weight: 600;
  }

  .btn-share:hover:not(:disabled) {
    background: rgba(59, 151, 151, 0.3);
  }

  .btn-share:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
</style>
