<script lang="ts">
  import { getDebugStore, setCommentaryGap, setGameHint, setCustomSystemInstructions, clearDebugLog } from '$lib/stores/debug.svelte';
  import type { DebugEntry } from '$lib/stores/debug.svelte';

  const debug = getDebugStore();

  let autoScroll = $state(true);
  let logContainer: HTMLDivElement | undefined = $state();

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

  <!-- Right column: Event Log -->
  <div class="log-col" style="width: {rightWidth}px; min-width: {rightWidth}px;">
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
          <div class="log-entry" class:error-entry={entry.type === 'error'}>
            <span class="log-time">{formatTime(entry.timestamp)}</span>
            <span class="log-badge" style="color: {entryColor(entry.type)}">{entryLabel(entry.type)}</span>
            <span class="log-text">{summarize(entry)}</span>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

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

  /* ── Right column: Event Log ── */
  .log-col {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--black-a15);
    border-left: 1px solid var(--white-a6);
  }

  .log-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-4) var(--space-3);
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }
</style>
