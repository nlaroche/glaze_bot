<script lang="ts">
  import { CharacterCardRow, ContextMenu, CardViewer, ScreenPicker } from '@glazebot/shared-ui';
  import MemoryInspector from '$lib/components/MemoryInspector.svelte';
  import ChatPanel from '$lib/components/ChatPanel.svelte';
  import type { GachaCharacter } from '@glazebot/shared-types';
  import { getAuthState } from '$lib/stores/auth.svelte';
  import { getSessionStore } from '$lib/stores/session.svelte';
  import { getDebugStore } from '$lib/stores/debug.svelte';
  import { getCollectionStore, loadCharacters } from '$lib/stores/collection.svelte';
  import { usePartyManagement } from '$lib/composables/usePartyManagement.svelte';
  import { useScreenCapture } from '$lib/composables/useScreenCapture.svelte';
  import { useCommentaryControls } from '$lib/composables/useCommentaryControls.svelte';

  const auth = getAuthState();
  const session = getSessionStore();
  const debug = getDebugStore();
  const chars = getCollectionStore();

  $effect(() => {
    if (auth.isAuthenticated && !auth.loading) loadCharacters();
  });

  const commentary = useCommentaryControls({ session, debug });
  const party = usePartyManagement({
    session, collection: chars,
    onPartyChanged: () => commentary.emitPartyToOverlay(),
  });
  const capture = useScreenCapture({ session, onStop: () => commentary.handleStop() });

  // Context menu + card viewer + memory inspector (trivial UI state — stays inline)
  let contextMenu = $state<{ x: number; y: number; character: GachaCharacter; inPartySlot?: number } | null>(null);
  let contextMenuKey = $state(0);
  function openContextMenu(e: MouseEvent, char: GachaCharacter, partySlot?: number) {
    e.stopPropagation();
    contextMenu = { x: e.clientX, y: e.clientY, character: char, inPartySlot: partySlot };
    contextMenuKey++;
  }
  let viewerCharacter = $state<GachaCharacter | null>(null);
  let memoryInspectCharacter = $state<GachaCharacter | null>(null);
</script>

<div class="home">
  <div class="main-area">
    <ChatPanel />

    <div class="controls-bar">
        <!-- Capture group / Active share -->
        <div class="ctrl-group">
          <span class="ctrl-label">Capture</span>
          {#if session.activeShare}
            <div class="share-inline">
              <div class="share-pulse"></div>
              <span class="share-name" title={session.activeShare.name}>{session.activeShare.name}</span>
              <button class="share-x" onclick={capture.stopSharing} title="Stop sharing">&times;</button>
            </div>
          {:else}
            <div class="ctrl-group-buttons">
              <button class="ctrl-btn capture" onclick={() => capture.openPicker('screen')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/></svg>
                Screen
              </button>
              <button class="ctrl-btn capture" onclick={() => capture.openPicker('app')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M6 5h4M6 8h4M6 11h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                App
              </button>
            </div>
          {/if}
        </div>

        <div class="ctrl-divider"></div>

        <!-- Playback group -->
        <div class="ctrl-group">
          <span class="ctrl-label">Commentary</span>
          <div class="ctrl-group-buttons">
            <button class="ctrl-btn start" disabled={!commentary.canStart} onclick={commentary.handleStart}>>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><polygon points="3,1 12,7 3,13"/></svg>
              Start
            </button>
            <button class="ctrl-btn" disabled={!session.isRunning} onclick={commentary.handlePauseResume}>
              {#if session.isPaused}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><polygon points="3,1 12,7 3,13"/></svg>
                Resume
              {:else}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="1"/><rect x="8.5" y="1" width="3.5" height="12" rx="1"/></svg>
                Pause
              {/if}
            </button>
            <button class="ctrl-btn stop" disabled={!session.isRunning} onclick={commentary.handleStop}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="10" height="10" rx="1.5"/></svg>
              Stop
            </button>
          </div>
        </div>

        <div class="ctrl-divider"></div>

        <!-- Overlay toggle — toggles preference anytime, shows/hides window only during screen share -->
        <div class="ctrl-group">
          <span class="ctrl-label">Overlay</span>
          <button
            class="toggle"
            class:toggle-on={session.overlayOn}
            onclick={commentary.toggleOverlay}
            aria-pressed={session.overlayOn}
            title={session.activeShare ? '' : 'Overlay will appear when screen sharing starts'}
          >
            <span class="toggle-knob"></span>
          </button>
        </div>
      </div>
    </div>

  <!-- Right Panel -->
  <aside class="right-panel">
    <div class="panel-section party-section">
      <div class="panel-header">
        <h2>Active Party</h2>
        <div class="party-actions">
          <button class="small-btn">Save</button>
          <button class="small-btn">Load</button>
        </div>
      </div>
      <div class="party-slots">
        {#each session.partySlots as slot, i}
          <div
            class="drop-zone"
            class:drop-active={party.dragOverPartySlot === i}
            ondragover={(e) => { e.preventDefault(); party.dragOverPartySlot = i; }}
            ondragleave={() => { if (party.dragOverPartySlot === i) party.dragOverPartySlot = null; }}
            ondrop={(e) => party.handlePartySlotDrop(e, i)}
          >
            {#if slot}
              <CharacterCardRow
                character={slot}
                image={slot.avatar_url}
                draggable={true}
                onremove={() => party.removeFromParty(i)}
                oncontextmenu={(e) => openContextMenu(e, slot, i)}
              />
            {:else}
              <div class="empty-slot">
                <span class="plus">+</span>
                <span class="empty-label">Drag character here</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section collection-section">
      <div class="panel-header">
        <h2>Collection</h2>
      </div>
      <input
        class="search-input"
        type="text"
        placeholder="Search characters..."
        bind:value={party.searchQuery}
      />
      <div
        class="collection-list"
        class:drop-active={party.dragOverCollection}
        ondragover={(e) => { e.preventDefault(); party.dragOverCollection = true; }}
        ondragleave={() => { party.dragOverCollection = false; }}
        ondrop={party.handleCollectionDrop}
      >
        {#if chars.loading}
          <p class="empty-msg">Loading characters...</p>
        {:else}
          {#each party.filteredCollection as char (char.id)}
            <CharacterCardRow
              character={char}
              image={char.avatar_url}
              draggable={true}
              onclick={() => party.addToParty(char)}
              oncontextmenu={(e) => openContextMenu(e, char)}
            />
          {:else}
            <p class="empty-msg">
              {#if chars.allCharacters.length === 0}
                No characters yet.
              {:else if party.searchQuery}
                No matches found.
              {:else}
                All characters are in your party!
              {/if}
            </p>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Game detection status -->
    <div class="game-status">
      <svg class="game-status-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
        {#if session.isRunning && debug.detectedGame}
          <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <circle cx="7" cy="7" r="2" fill="currentColor"/>
        {:else if session.isRunning}
          <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="4 3"/>
        {:else}
          <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <line x1="4" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        {/if}
      </svg>
      <span class="game-status-text">
        {#if !session.isRunning}
          Not active
        {:else if debug.detectedGame}
          {debug.detectedGame}
        {:else}
          Detecting game...
        {/if}
      </span>
    </div>
  </aside>
</div>

{#if contextMenu}
  {#key contextMenuKey}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    onclose={() => { contextMenu = null; }}
    items={[
      {
        label: 'View Card',
        icon: '🃏',
        onclick: () => { viewerCharacter = contextMenu!.character; },
      },
      {
        label: 'Inspect Memory',
        icon: '🧠',
        onclick: () => { memoryInspectCharacter = contextMenu!.character; },
      },
      ...(contextMenu.inPartySlot !== undefined
        ? [
            { label: '', icon: '', onclick: () => {}, separator: true },
            {
              label: 'Remove from Party',
              icon: '✕',
              onclick: () => { party.removeFromParty(contextMenu!.inPartySlot!); },
            },
          ]
        : []),
    ]}
  />
  {/key}
{/if}

<CardViewer
  character={viewerCharacter}
  image={viewerCharacter?.avatar_url}
  onclose={() => { viewerCharacter = null; }}
/>

<MemoryInspector
  character={memoryInspectCharacter}
  onclose={() => { memoryInspectCharacter = null; }}
/>

<ScreenPicker
  open={capture.pickerOpen}
  initialTab={capture.pickerInitialTab}
  sources={capture.captureSources}
  loading={capture.loadingSources}
  onselect={capture.handleSourceSelect}
  onclose={() => capture.closePicker()}
/>

<style>
  .home {
    display: flex;
    height: 100%;
    gap: 0;
    overflow: hidden;
  }

  /* ── Main area (left/center) ── */
  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  /* ── Inline share indicator ── */
  .share-inline {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    padding: 5px var(--space-2-5);
    border-radius: var(--radius-md);
    background: var(--teal-a8);
    border: 1px solid var(--teal-a20);
    max-width: 180px;
  }

  .share-pulse {
    width: 7px;
    height: 7px;
    border-radius: var(--radius-full);
    background: var(--color-teal);
    box-shadow: 0 0 5px var(--teal-a50);
    animation: pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .share-name {
    flex: 1;
    font-size: var(--font-xs);
    color: var(--color-light-teal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .share-x {
    width: 18px;
    height: 18px;
    border-radius: var(--radius-sm);
    border: none;
    background: var(--stop-a15);
    color: var(--color-stop);
    font-size: var(--font-base);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
    transition: background var(--transition-base);
  }

  .share-x:hover {
    background: var(--stop-a30);
  }

  /* ── Controls bar ── */
  .controls-bar {
    flex-shrink: 0;
    padding: var(--space-2-5) var(--space-5) var(--space-3-5);
    border-top: 1px solid var(--white-a6);
    display: flex;
    align-items: flex-end;
    gap: var(--space-4);
    background: var(--black-a15);
  }

  .ctrl-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .ctrl-label {
    font-size: var(--font-micro);
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--color-text-muted, #6B7788);
    font-weight: 600;
  }

  .ctrl-group-buttons {
    display: flex;
    gap: var(--space-1);
  }

  .ctrl-divider {
    width: 1px;
    height: 36px;
    background: var(--white-a8);
    flex-shrink: 0;
    align-self: flex-end;
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    padding: var(--space-1-5) var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--white-a8);
    background: var(--white-a4);
    color: var(--color-text-secondary, #8a94a6);
    font-size: var(--font-xs);
    cursor: pointer;
    transition: background var(--transition-base), color var(--transition-base), border-color var(--transition-base);
    white-space: nowrap;
  }

  .ctrl-btn:hover:not(:disabled) {
    background: var(--white-a8);
    color: var(--color-text-primary, #e2e8f0);
  }

  .ctrl-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .ctrl-btn.capture {
    color: var(--rarity-rare, #3B9797);
    border-color: var(--teal-a20);
  }

  .ctrl-btn.capture:hover:not(:disabled) {
    background: var(--teal-a10);
    border-color: var(--teal-a30);
  }

  .ctrl-btn.start {
    color: var(--color-start);
    border-color: var(--start-a20);
  }

  .ctrl-btn.start:hover:not(:disabled) {
    background: var(--start-a10);
    border-color: var(--start-a35);
  }

  .ctrl-btn.stop {
    color: var(--color-stop);
    border-color: var(--stop-a20);
  }

  .ctrl-btn.stop:hover:not(:disabled) {
    background: var(--stop-a10);
    border-color: var(--stop-a35);
  }

  /* ── Toggle switch ── */
  .toggle {
    position: relative;
    width: 40px;
    height: 22px;
    border-radius: 11px;
    border: 1px solid var(--white-a10);
    background: var(--white-a6);
    cursor: pointer;
    padding: 0;
    transition: background var(--transition-slow), border-color var(--transition-slow);
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-full);
    background: var(--color-text-muted, #6B7788);
    transition: transform var(--transition-slow), background var(--transition-slow);
  }

  .toggle.toggle-on {
    background: var(--epic-a20);
    border-color: var(--epic-a30);
  }

  .toggle.toggle-on .toggle-knob {
    transform: translateX(18px);
    background: var(--rarity-epic, #B06AFF);
  }

  /* ── Right panel ── */
  .right-panel {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--white-a6);
    background: var(--black-a10);
    overflow: hidden;
  }

  .panel-section {
    padding: var(--space-3-5) var(--space-3);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2-5);
  }

  .panel-header h2 {
    font-size: var(--font-xs);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--color-text-muted, #6B7788);
    margin: 0;
    font-weight: 600;
  }

  .party-actions {
    display: flex;
    gap: var(--space-1);
  }

  .small-btn {
    padding: 3px var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--white-a8);
    background: var(--white-a4);
    color: var(--color-text-muted, #6B7788);
    font-size: var(--font-brand-sm);
    cursor: pointer;
    transition: background var(--transition-base);
  }

  .small-btn:hover {
    background: var(--white-a8);
    color: var(--color-text-secondary, #8a94a6);
  }

  .party-slots {
    display: flex;
    flex-direction: column;
    gap: var(--space-1-5);
  }

  .drop-zone {
    border-radius: var(--radius-xl);
    border: 1.5px solid transparent;
    transition: border-color var(--transition-base), background var(--transition-base);
  }

  .drop-zone.drop-active {
    border-color: var(--teal-a50);
    background: var(--teal-a5);
  }

  .empty-slot {
    display: flex;
    align-items: center;
    gap: var(--space-2-5);
    padding: var(--space-2-5);
    border-radius: var(--radius-lg);
    border: 1px dashed var(--white-a10);
    background: transparent;
    transition: background var(--transition-base), border-color var(--transition-base);
    min-height: 56px;
    color: var(--color-text-muted, #6B7788);
  }

  .drop-zone.drop-active .empty-slot {
    border-color: var(--teal-a40);
    background: var(--teal-a5);
  }

  .plus {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-full);
    border: 1px dashed var(--white-a15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-lg);
    flex-shrink: 0;
  }

  .empty-label {
    font-size: var(--font-brand-md);
  }

  .panel-divider {
    height: 1px;
    background: var(--white-a6);
    margin: 0 var(--space-3);
  }

  .collection-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .search-input {
    width: 100%;
    padding: var(--space-1-5) var(--space-2-5);
    border-radius: var(--radius-md);
    border: 1px solid var(--white-a8);
    background: var(--white-a4);
    color: var(--color-text-primary, #e2e8f0);
    font-size: var(--font-brand-md);
    outline: none;
    margin-bottom: var(--space-2);
    box-sizing: border-box;
    transition: border-color var(--transition-base);
  }

  .search-input::placeholder {
    color: var(--color-text-muted, #6B7788);
  }

  .search-input:focus {
    border-color: var(--white-a20);
  }

  .collection-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    border-radius: var(--radius-lg);
    border: 1.5px solid transparent;
    transition: border-color var(--transition-base), background var(--transition-base);
    padding: var(--space-0-5);
  }

  .collection-list.drop-active {
    border-color: var(--teal-a40);
    background: var(--teal-a5);
  }

  .collection-list :global(.card-row) {
    opacity: 0.5;
    filter: brightness(0.8);
    transition: opacity var(--transition-slow), filter var(--transition-slow), transform var(--transition-slow), box-shadow var(--transition-slow);
  }

  .collection-list :global(.card-row:hover) {
    opacity: 1;
    filter: brightness(1);
  }

  .empty-msg {
    font-size: var(--font-brand-md);
    color: var(--color-text-muted, #6B7788);
    text-align: center;
    padding: var(--space-4) 0;
    margin: 0;
  }

  /* ── Game detection status ── */
  .game-status {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-top: 1px solid var(--white-a6);
    color: var(--color-text-muted);
    font-size: var(--font-sm);
    min-height: 32px;
  }

  .game-status-icon {
    flex-shrink: 0;
    opacity: 0.6;
  }

  .game-status-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
