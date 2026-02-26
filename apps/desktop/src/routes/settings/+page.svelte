<script lang="ts">
  import { getDebugStore, setCommentaryGap, setGameHint, setCustomSystemInstructions, clearDebugLog, clearFrames } from '$lib/stores/debug.svelte';
  import type { DebugEntry, FrameCapture } from '$lib/stores/debug.svelte';

  const debug = getDebugStore();

  let autoScroll = $state(true);
  let logContainer: HTMLDivElement | undefined = $state();
  let expandedEntryId = $state<number | null>(null);
  let lightboxFrame = $state<FrameCapture | null>(null);

  // Vertical split between event log (top) and frames (bottom) in the right column
  let logSplitPercent = $state(60);
  let vDragging = $state(false);
  let rightColEl: HTMLDivElement | undefined = $state();

  function startVResize(e: PointerEvent) {
    if (!rightColEl) return;
    vDragging = true;
    const startY = e.clientY;
    const startPercent = logSplitPercent;
    const colRect = rightColEl.getBoundingClientRect();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    function onMove(ev: PointerEvent) {
      const delta = ev.clientY - startY;
      const pctDelta = (delta / colRect.height) * 100;
      logSplitPercent = Math.max(20, Math.min(80, startPercent + pctDelta));
    }

    function onUp() {
      vDragging = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  // Resizable divider
  let rightWidth = $state(480);
  let dragging = $state(false);

  function startResize(e: PointerEvent) {
    dragging = true;
    const startX = e.clientX;
    const startWidth = rightWidth;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    function onMove(ev: PointerEvent) {
      const delta = startX - ev.clientX;
      rightWidth = Math.max(280, Math.min(900, startWidth + delta));
    }

    function onUp() {
      dragging = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // Auto-scroll when new entries arrive
  $effect(() => {
    void debug.entries.length;
    if (autoScroll && logContainer) {
      requestAnimationFrame(() => {
        logContainer!.scrollTop = logContainer!.scrollHeight;
      });
    }
  });

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function uptimeStr(): string {
    if (!debug.startedAt) return '--';
    const ms = Date.now() - debug.startedAt.getTime();
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  }

  function entryLabel(type: string): string {
    switch (type) {
      case 'frame': return 'FRAME';
      case 'llm-request': return 'LLM REQ';
      case 'llm-response': return 'LLM RES';
      case 'tts-request': return 'TTS REQ';
      case 'tts-response': return 'TTS RES';
      case 'error': return 'ERROR';
      case 'info': return 'INFO';
      default: return type.toUpperCase();
    }
  }

  const entryColors: Record<string, string> = {
    'frame': 'var(--color-text-muted)',
    'llm-request': 'var(--color-teal)',
    'llm-response': 'var(--color-start)',
    'tts-request': 'var(--rarity-epic)',
    'tts-response': '#d4a0ff',
    'error': 'var(--color-error)',
    'info': 'var(--color-text-secondary)',
  };

  function entryColor(type: string): string {
    return entryColors[type] ?? 'var(--color-text-secondary)';
  }

  function summarize(entry: DebugEntry): string {
    const d = entry.data as Record<string, unknown> | undefined;
    if (!d) return '';
    switch (entry.type) {
      case 'frame':
        return `Captured ${((d.size as number) / 1024).toFixed(0)}KB`;
      case 'llm-request':
        return d.reactionTo
          ? `${d.character} reacting to ${d.reactionTo}`
          : `${d.character} (history: ${d.historyLength})`;
      case 'llm-response':
        return d.text
          ? `${d.character}: "${(d.text as string).slice(0, 80)}${(d.text as string).length > 80 ? '...' : ''}"`
          : `${d.character}: [SILENCE]`;
      case 'tts-request':
        return `${d.character} → ${(d.voiceId as string)?.slice(0, 8)}... (${d.textLength} chars)`;
      case 'tts-response':
        return `${d.character}: ${((d.audioSize as number) / 1024).toFixed(0)}KB audio`;
      case 'error':
        return `${d.step ? `[${d.step}] ` : ''}${d.message}`;
      case 'info':
        return typeof d === 'string' ? d : JSON.stringify(d);
      default:
        return JSON.stringify(d);
    }
  }
</script>

<div class="settings-layout">
  <!-- Left column: Settings & Stats -->
  <div class="settings-col">
    <h1>Settings</h1>

    <!-- Commentary Options -->
    <section class="card">
      <h2>Commentary Options</h2>

      <div class="field">
        <label class="field-label" for="game-hint">Game Hint</label>
        <input
          id="game-hint"
          class="text-input"
          type="text"
          placeholder="e.g. League of Legends, Elden Ring..."
          value={debug.gameHint}
          oninput={(e) => setGameHint((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="field">
        <label class="field-label" for="commentary-gap">Commentary Gap</label>
        <div class="range-row">
          <input
            id="commentary-gap"
            type="range"
            value={debug.commentaryGap}
            min="30"
            max="120"
            step="5"
            oninput={(e) => setCommentaryGap(parseInt((e.target as HTMLInputElement).value, 10))}
          />
          <span class="range-value">{debug.commentaryGap}s</span>
        </div>
      </div>

      <div class="field">
        <label class="field-label" for="custom-instructions">Custom Instructions</label>
        <textarea
          id="custom-instructions"
          class="textarea"
          placeholder="Extra instructions sent alongside each character's system prompt..."
          value={debug.customSystemInstructions}
          oninput={(e) => setCustomSystemInstructions((e.target as HTMLTextAreaElement).value)}
          rows="3"
        ></textarea>
      </div>
    </section>

    <!-- Stats -->
    <section class="card">
      <h2>Session Stats</h2>
      <div class="stats-grid">
        <div class="stat">
          <span class="stat-label">Uptime</span>
          <span class="stat-value">{uptimeStr()}</span>
        </div>
        <div class="stat">
          <span class="stat-label">LLM Calls</span>
          <span class="stat-value">{debug.totalLlmCalls}</span>
        </div>
        <div class="stat">
          <span class="stat-label">TTS Calls</span>
          <span class="stat-value">{debug.totalTtsCalls}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Tokens In</span>
          <span class="stat-value">{debug.totalInputTokens.toLocaleString()}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Tokens Out</span>
          <span class="stat-value">{debug.totalOutputTokens.toLocaleString()}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Log Entries</span>
          <span class="stat-value">{debug.entries.length}</span>
        </div>
      </div>
    </section>
  </div>

  <!-- Resize handle -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="resize-handle"
    class:resize-active={dragging}
    onpointerdown={startResize}
  >
    <div class="resize-grip"></div>
  </div>

  <!-- Right column: Event Log (top) + Frames (bottom) -->
  <div class="log-col" style="width: {rightWidth}px; min-width: {rightWidth}px;" bind:this={rightColEl}>
    <!-- Event Log panel -->
    <div class="log-panel" style="height: {logSplitPercent}%;">
      <div class="log-header">
        <h2>Event Log</h2>
        <div class="log-controls">
          <label class="checkbox-row">
            <input type="checkbox" bind:checked={autoScroll} />
            <span>Auto-scroll</span>
          </label>
          <button class="clear-btn" onclick={clearDebugLog}>Clear</button>
        </div>
      </div>

      <div class="log-container" bind:this={logContainer}>
        {#if debug.entries.length === 0}
          <div class="log-empty">
            <p>No events yet.</p>
            <p class="log-empty-hint">Start commentary to see debug output.</p>
          </div>
        {:else}
          {#each debug.entries as entry (entry.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="log-entry"
              class:error-entry={entry.type === 'error'}
              class:expandable={entry.type === 'error'}
              class:expanded={expandedEntryId === entry.id}
              onclick={() => {
                if (entry.type === 'error') {
                  expandedEntryId = expandedEntryId === entry.id ? null : entry.id;
                }
              }}
            >
              <span class="log-time">{formatTime(entry.timestamp)}</span>
              <span class="log-badge" style="color: {entryColor(entry.type)}">{entryLabel(entry.type)}</span>
              <span class="log-text">{summarize(entry)}</span>
            </div>
            {#if expandedEntryId === entry.id && entry.type === 'error'}
              <div class="log-entry-expanded">
                <pre class="expanded-text" style="user-select: text;">{JSON.stringify(entry.data, null, 2)}</pre>
                <button class="copy-btn" onclick={() => copyText(JSON.stringify(entry.data, null, 2))}>Copy</button>
              </div>
            {/if}
          {/each}
        {/if}
      </div>
    </div>

    <!-- Vertical resize handle -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="v-resize-handle"
      class:v-resize-active={vDragging}
      onpointerdown={startVResize}
    >
      <div class="v-resize-grip"></div>
    </div>

    <!-- Frames panel -->
    <div class="frames-panel" style="height: calc({100 - logSplitPercent}% - 8px);">
      <div class="log-header">
        <h2>Frames ({debug.recentFrames.length})</h2>
        <div class="log-controls">
          <button class="clear-btn" onclick={clearFrames}>Clear</button>
        </div>
      </div>

      <div class="frames-container">
        {#if debug.recentFrames.length === 0}
          <div class="log-empty">
            <p>No frames captured yet.</p>
            <p class="log-empty-hint">Start commentary to see captured screenshots.</p>
          </div>
        {:else}
          <div class="frames-list">
            {#each debug.recentFrames.slice(-20) as frame (frame.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="frame-card" onclick={() => { lightboxFrame = frame; }}>
                <img
                  class="frame-thumb"
                  src={frame.b64}
                  alt="Frame {frame.id}"
                />
                <div class="frame-info">
                  <span class="frame-time">{formatTime(frame.timestamp)}</span>
                  {#if frame.aiResponse}
                    <span class="frame-response">{frame.aiResponse.slice(0, 120)}{frame.aiResponse.length > 120 ? '...' : ''}</span>
                  {:else}
                    <span class="frame-no-response">No response</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Lightbox -->
{#if lightboxFrame}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="lightbox-backdrop" onclick={() => { lightboxFrame = null; }}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="lightbox-content" onclick={(e) => e.stopPropagation()}>
      <img src={lightboxFrame.b64} alt="Frame {lightboxFrame.id}" class="lightbox-img" />
      <div class="lightbox-meta">
        <span class="lightbox-time">{formatTime(lightboxFrame.timestamp)}</span>
        {#if lightboxFrame.aiResponse}
          <p class="lightbox-response" style="user-select: text;">{lightboxFrame.aiResponse}</p>
        {/if}
      </div>
      <button class="lightbox-close" onclick={() => { lightboxFrame = null; }}>&times;</button>
    </div>
  </div>
{/if}

<style>
  .settings-layout {
    display: flex;
    height: 100%;
    overflow: hidden;
    margin: calc(-1 * var(--space-6));
  }

  /* ── Left column: Settings ── */
  .settings-col {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: var(--space-6) var(--space-7);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  h1 {
    font-family: var(--font-brand);
    font-size: var(--font-3xl);
    font-weight: 400;
    color: var(--color-pink);
    letter-spacing: 1px;
    margin: 0;
  }

  /* ── Card sections ── */
  .card {
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: var(--panel-radius);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .card h2 {
    font-size: var(--font-xs);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--color-text-muted);
    margin: 0;
    font-weight: 600;
  }

  /* ── Form fields ── */
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1-5);
  }

  .field-label {
    font-size: var(--font-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .text-input {
    width: 100%;
    padding: var(--input-padding);
    border-radius: var(--input-radius);
    border: 1px solid var(--input-border);
    background: var(--input-bg);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--font-base);
    outline: none;
    transition: border-color var(--transition-base), background var(--transition-base);
    box-sizing: border-box;
  }

  .text-input::placeholder { color: var(--color-text-muted); }
  .text-input:focus {
    border-color: var(--input-focus-border);
    background: var(--input-focus-bg);
  }

  .textarea {
    width: 100%;
    padding: var(--input-padding);
    border-radius: var(--input-radius);
    border: 1px solid var(--input-border);
    background: var(--input-bg);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--font-base);
    resize: vertical;
    outline: none;
    transition: border-color var(--transition-base), background var(--transition-base);
    box-sizing: border-box;
    line-height: 1.5;
  }

  .textarea::placeholder { color: var(--color-text-muted); }
  .textarea:focus {
    border-color: var(--input-focus-border);
    background: var(--input-focus-bg);
  }

  .range-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  input[type="range"] {
    flex: 1;
    max-width: 280px;
    accent-color: var(--color-teal);
  }

  .range-value {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-teal);
    min-width: 40px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* ── Stats ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2-5);
  }

  .stat {
    padding: var(--space-3) var(--space-3-5);
    border-radius: var(--radius-lg);
    background: var(--white-a3);
    border: 1px solid var(--white-a6);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .stat-label {
    font-size: var(--font-2xs);
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .stat-value {
    font-size: var(--font-2xl);
    font-weight: 600;
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
  }

  /* ── Resize handle ── */
  .resize-handle {
    width: 8px;
    flex-shrink: 0;
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
    transition: background var(--transition-base);
  }

  .resize-handle:hover,
  .resize-active {
    background: var(--teal-a10);
  }

  .resize-grip {
    width: 3px;
    height: 32px;
    border-radius: var(--radius-pill);
    background: var(--white-a10);
    transition: background var(--transition-base), height var(--transition-base);
  }

  .resize-handle:hover .resize-grip,
  .resize-active .resize-grip {
    background: var(--teal-a40);
    height: 48px;
  }

  /* ── Right column ── */
  .log-col {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--black-a15);
    border-left: 1px solid var(--white-a6);
  }

  .log-panel,
  .frames-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .log-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4) var(--space-2);
    flex-shrink: 0;
    border-bottom: 1px solid var(--white-a6);
  }

  .log-header h2 {
    font-size: var(--font-xs);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--color-text-muted);
    margin: 0;
    font-weight: 600;
  }

  .log-controls {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    cursor: pointer;
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
  }

  .checkbox-row input[type="checkbox"] {
    accent-color: var(--color-teal);
  }

  .clear-btn {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--white-a8);
    border-radius: var(--radius-md);
    background: var(--white-a4);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-xs);
    font-weight: 500;
    transition: background var(--transition-base), color var(--transition-base);
  }

  .clear-btn:hover {
    background: var(--error-a15);
    color: var(--color-error);
    border-color: var(--error-a20);
  }

  /* ── Vertical resize handle ── */
  .v-resize-handle {
    height: 8px;
    flex-shrink: 0;
    cursor: row-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
    transition: background var(--transition-base);
  }

  .v-resize-handle:hover,
  .v-resize-active {
    background: var(--teal-a10);
  }

  .v-resize-grip {
    width: 32px;
    height: 3px;
    border-radius: var(--radius-pill);
    background: var(--white-a10);
    transition: background var(--transition-base), width var(--transition-base);
  }

  .v-resize-handle:hover .v-resize-grip,
  .v-resize-active .v-resize-grip {
    background: var(--teal-a40);
    width: 48px;
  }

  /* ── Log entries ── */
  .log-container {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2);
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: var(--font-sm);
    line-height: 1.6;
  }

  .log-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--space-1);
    color: var(--color-text-muted);
    font-family: 'Satoshi', system-ui, sans-serif;
  }

  .log-empty p {
    font-size: var(--font-base);
  }

  .log-empty-hint {
    font-size: var(--font-sm);
    opacity: 0.6;
  }

  .log-entry {
    display: flex;
    gap: var(--space-2-5);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    align-items: baseline;
    transition: background var(--transition-fast);
  }

  .log-entry:hover {
    background: var(--white-a4);
  }

  .error-entry {
    background: var(--error-a12);
  }

  .error-entry:hover {
    background: var(--error-a15);
  }

  .log-time {
    color: var(--color-text-muted);
    flex-shrink: 0;
    font-size: var(--font-xs);
    font-variant-numeric: tabular-nums;
  }

  .log-badge {
    flex-shrink: 0;
    font-weight: 700;
    font-size: var(--font-xs);
    min-width: 64px;
    text-align: right;
  }

  .log-text {
    color: var(--color-text-secondary);
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .expanded .log-text {
    white-space: normal;
    word-break: break-all;
    overflow: visible;
    text-overflow: unset;
  }

  .expandable {
    cursor: pointer;
  }

  .log-entry-expanded {
    padding: var(--space-2) var(--space-3);
    background: var(--error-a12);
    border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    margin-top: -2px;
    margin-bottom: var(--space-1);
    position: relative;
  }

  .expanded-text {
    margin: 0;
    font-size: var(--font-xs);
    color: var(--color-text-primary);
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.5;
    user-select: text;
    -webkit-user-select: text;
  }

  .copy-btn {
    position: absolute;
    top: var(--space-1-5);
    right: var(--space-2);
    padding: 2px var(--space-2);
    border: 1px solid var(--white-a10);
    border-radius: var(--radius-sm);
    background: var(--white-a6);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-2xs);
    font-weight: 500;
    transition: background var(--transition-base), color var(--transition-base);
  }

  .copy-btn:hover {
    background: var(--white-a15);
    color: var(--color-text-primary);
  }

  /* ── Frames ── */
  .frames-container {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2);
  }

  .frames-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .frame-card {
    display: flex;
    gap: var(--space-2-5);
    border-radius: var(--radius-lg);
    border: 1px solid var(--white-a8);
    background: var(--white-a3);
    overflow: hidden;
    cursor: pointer;
    padding: var(--space-2);
    transition: border-color var(--transition-base), background var(--transition-base);
    align-items: flex-start;
  }

  .frame-card:hover {
    border-color: var(--white-a15);
    background: var(--white-a6);
  }

  .frame-thumb {
    width: 120px;
    flex-shrink: 0;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
    border-radius: var(--radius-md);
  }

  .frame-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .frame-time {
    font-size: var(--font-2xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .frame-response {
    font-size: var(--font-xs);
    color: var(--color-text-secondary);
    line-height: 1.4;
    word-break: break-word;
  }

  .frame-no-response {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    font-style: italic;
  }

  /* ── Lightbox ── */
  .lightbox-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
  }

  .lightbox-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl);
    overflow: hidden;
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
  }

  .lightbox-img {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
  }

  .lightbox-meta {
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1-5);
    max-height: 200px;
    overflow-y: auto;
  }

  .lightbox-time {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .lightbox-response {
    font-size: var(--font-base);
    color: var(--color-text-primary);
    line-height: 1.5;
    margin: 0;
    user-select: text;
    -webkit-user-select: text;
  }

  .lightbox-close {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    border: none;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    font-size: var(--font-xl);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--transition-base);
  }

  .lightbox-close:hover {
    background: rgba(0, 0, 0, 0.8);
  }
</style>
