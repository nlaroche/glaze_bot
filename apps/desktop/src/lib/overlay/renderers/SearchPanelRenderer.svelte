<script lang="ts">
  import type { SearchPanelCommand } from '@glazebot/shared-types';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-shell';
  import { dismissVisual, pinVisual, unpinVisual } from '../primitiveRegistry.svelte';

  let { command }: { command: SearchPanelCommand } = $props();

  let minimized = $state(false);
  let pinned = $state(command.pinned ?? true);
  let position = $state({ x: -1, y: -1 });
  let dragging = $state(false);
  let dragOffset = { x: 0, y: 0 };

  // Set interactive mode on mount, restore on cleanup
  $effect(() => {
    invoke('set_overlay_interactive', { interactive: true }).catch(() => {});
    return () => {
      invoke('set_overlay_interactive', { interactive: false }).catch(() => {});
    };
  });

  // Compute initial position from anchor
  let initialStyle = $derived.by(() => {
    if (position.x >= 0 && position.y >= 0) return '';
    const anchor = command.position || 'top-right';
    const map: Record<string, string> = {
      'top-left': 'top: 5%; left: 5%;',
      'top-center': 'top: 5%; left: 50%; transform: translateX(-50%);',
      'top-right': 'top: 5%; right: 5%;',
      'center-left': 'top: 50%; left: 5%; transform: translateY(-50%);',
      'center': 'top: 50%; left: 50%; transform: translate(-50%, -50%);',
      'center-right': 'top: 50%; right: 5%; transform: translateY(-50%);',
      'bottom-left': 'bottom: 5%; left: 5%;',
      'bottom-center': 'bottom: 5%; left: 50%; transform: translateX(-50%);',
      'bottom-right': 'bottom: 5%; right: 5%;',
    };
    return map[anchor] || map['top-right'];
  });

  let positionStyle = $derived(
    position.x >= 0 && position.y >= 0
      ? `left: ${position.x}px; top: ${position.y}px;`
      : initialStyle
  );

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    const el = (e.currentTarget as HTMLElement).closest('.search-panel') as HTMLElement;
    if (el) {
      const rect = el.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      // If still using anchor positioning, switch to absolute
      if (position.x < 0) {
        position = { x: rect.left, y: rect.top };
      }
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    position = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    };
  }

  function onPointerUp(e: PointerEvent) {
    dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function toggleMinimize() {
    minimized = !minimized;
    if (minimized) {
      invoke('set_overlay_interactive', { interactive: false }).catch(() => {});
    } else {
      invoke('set_overlay_interactive', { interactive: true }).catch(() => {});
    }
  }

  function togglePin() {
    pinned = !pinned;
    if (pinned) {
      pinVisual(command.id);
    } else {
      unpinVisual(command.id);
    }
  }

  function close() {
    dismissVisual(command.id);
    invoke('set_overlay_interactive', { interactive: false }).catch(() => {});
  }

  function openLink(uri: string) {
    open(uri).catch(() => {});
  }

  let truncatedQuery = $derived(
    command.query.length > 40 ? command.query.slice(0, 37) + '...' : command.query
  );
</script>

<div
  class="search-panel"
  class:minimized
  style={positionStyle}
>
  <!-- Title bar (draggable) -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="title-bar"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
  >
    <span class="search-icon">&#128269;</span>
    <span class="query-text">{truncatedQuery}</span>
    <div class="controls">
      <button class="ctrl-btn" onclick={toggleMinimize} title={minimized ? 'Expand' : 'Minimize'}>
        {minimized ? '+' : '\u2013'}
      </button>
      <button class="ctrl-btn" class:active={pinned} onclick={togglePin} title={pinned ? 'Unpin' : 'Pin'}>
        &#128204;
      </button>
      <button class="ctrl-btn close-btn" onclick={close} title="Close">
        &#10005;
      </button>
    </div>
  </div>

  <!-- Body (shown when not minimized) -->
  {#if !minimized}
    <div class="body">
      <p class="summary">{command.summary}</p>
      {#if command.sources.length > 0}
        <div class="sources">
          <div class="sources-label">Sources</div>
          <ol class="source-list">
            {#each command.sources as source, i}
              <li>
                <button class="source-link" onclick={() => openLink(source.uri)} title={source.uri}>
                  {source.title}
                </button>
              </li>
            {/each}
          </ol>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .search-panel {
    position: absolute;
    pointer-events: auto;
    background: rgba(10, 14, 24, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    width: 380px;
    max-height: 400px;
    display: flex;
    flex-direction: column;
    font-family: system-ui, sans-serif;
    animation: panel-slide-in 0.4s ease-out;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    z-index: 1000;
  }
  .search-panel.minimized {
    max-height: 40px;
  }

  .title-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: grab;
    user-select: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }
  .title-bar:active {
    cursor: grabbing;
  }

  .search-icon {
    font-size: 14px;
    flex-shrink: 0;
  }
  .query-text {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .controls {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .ctrl-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    line-height: 1;
  }
  .ctrl-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.95);
  }
  .ctrl-btn.active {
    background: rgba(79, 195, 247, 0.25);
    color: #4FC3F7;
  }
  .close-btn:hover {
    background: rgba(255, 68, 68, 0.3);
    color: #FF4444;
  }

  .body {
    padding: 12px 16px;
    overflow-y: auto;
    flex: 1;
  }

  .summary {
    font-size: 14px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.9);
    margin: 0 0 12px 0;
  }

  .sources {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 8px;
  }
  .sources-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }
  .source-list {
    margin: 0;
    padding-left: 20px;
    list-style: decimal;
  }
  .source-list li {
    margin-bottom: 4px;
  }
  .source-link {
    background: none;
    border: none;
    color: #4FC3F7;
    font-size: 13px;
    cursor: pointer;
    padding: 2px 0;
    text-align: left;
    text-decoration: none;
    display: inline;
    line-height: 1.3;
    word-break: break-word;
  }
  .source-link:hover {
    color: #81D4FA;
    text-decoration: underline;
  }

  @keyframes panel-slide-in {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
