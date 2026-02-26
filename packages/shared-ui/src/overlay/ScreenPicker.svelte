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
    border: 1px solid var(--white-a10);
    border-radius: 14px;
    box-shadow:
      0 24px 80px rgba(0, 0, 0, 0.6),
      0 8px 24px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }

  .picker-header {
    padding: var(--space-4) var(--space-5) 0;
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
    gap: var(--space-0-5);
    background: var(--white-a4);
    border-radius: var(--radius-md);
    padding: var(--space-0-5);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px var(--space-3-5);
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #5a6474);
    font-size: var(--font-xs);
    cursor: pointer;
    transition: background var(--transition-base), color var(--transition-base);
  }

  .tab:hover {
    color: var(--color-text-secondary, #8a94a6);
  }

  .tab.active {
    background: var(--white-a8);
    color: var(--color-text-primary, #e2e8f0);
  }

  .source-grid {
    overflow-y: auto;
    padding: var(--space-4) var(--space-5);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-3);
    min-height: 240px;
    max-height: 400px;
  }

  .state-msg {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    min-height: 200px;
    color: var(--color-text-muted, #5a6474);
    font-size: var(--font-base);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--white-a10);
    border-top-color: var(--rarity-rare, #3B9797);
    border-radius: var(--radius-full);
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .source-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2);
    border-radius: var(--radius-xl);
    border: 2px solid var(--white-a6);
    background: var(--white-a3);
    cursor: pointer;
    transition: border-color var(--transition-base), background var(--transition-base), transform var(--transition-base), box-shadow var(--transition-base);
    text-align: center;
  }

  .source-card:hover {
    background: var(--white-a6);
    border-color: var(--white-a12);
    transform: translateY(-1px);
  }

  .source-card.selected {
    border-color: var(--rarity-rare, #3B9797);
    background: var(--teal-a8);
    box-shadow: 0 0 12px var(--teal-a15);
  }

  .source-thumbnail {
    aspect-ratio: 16 / 10;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--black-a40);
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
    font-size: var(--font-xs);
    color: var(--color-text-secondary, #b0b8c8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 var(--space-0-5);
  }

  .source-card.selected .source-name {
    color: var(--color-text-primary, #e2e8f0);
  }

  .picker-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--white-a6);
    background: var(--black-a15);
  }

  .footer-left {
    flex: 1;
    min-width: 0;
  }

  .selected-preview {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .selected-dot {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--rarity-rare, #3B9797);
    box-shadow: 0 0 6px var(--teal-a50);
    flex-shrink: 0;
  }

  .selected-name {
    font-size: var(--font-sm);
    color: var(--color-text-primary, #e2e8f0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .no-selection {
    font-size: var(--font-brand-md);
    color: var(--color-text-muted, #5a6474);
  }

  .footer-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .btn-cancel,
  .btn-share {
    padding: 7px 18px;
    border-radius: var(--radius-md);
    font-size: var(--font-sm);
    cursor: pointer;
    transition: background var(--transition-base), color var(--transition-base);
    border: 1px solid;
  }

  .btn-cancel {
    background: transparent;
    border-color: var(--white-a10);
    color: var(--color-text-secondary, #8a94a6);
  }

  .btn-cancel:hover {
    background: var(--white-a6);
    color: var(--color-text-primary, #e2e8f0);
  }

  .btn-share {
    background: var(--teal-a20);
    border-color: var(--teal-a40);
    color: var(--color-light-teal);
    font-weight: 600;
  }

  .btn-share:hover:not(:disabled) {
    background: var(--teal-a30);
  }

  .btn-share:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
</style>
