<script lang="ts">
  import { getDebugStore, setCommentaryGap, setGameHint, setCustomSystemInstructions, clearDebugLog } from '$lib/stores/debug.svelte';
  import type { DebugEntry } from '$lib/stores/debug.svelte';

  const debug = getDebugStore();

  let autoScroll = $state(true);
  let logContainer: HTMLDivElement | undefined = $state();

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

  function entryColor(type: string): string {
    switch (type) {
      case 'frame': return '#6B7788';
      case 'llm-request': return '#3B9797';
      case 'llm-response': return '#5bca7a';
      case 'tts-request': return '#B06AFF';
      case 'tts-response': return '#d4a0ff';
      case 'error': return '#ff6b6b';
      case 'info': return '#8a94a6';
      default: return '#8a94a6';
    }
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

<div class="debug-page">
  <h1>Settings & Debug</h1>

  <!-- Commentary Options -->
  <section class="section">
    <h2>Commentary Options</h2>
    <div class="control-row">
      <label>
        <span>Game Hint</span>
        <input
          class="text-input"
          type="text"
          placeholder="e.g. League of Legends, Elden Ring..."
          value={debug.gameHint}
          oninput={(e) => setGameHint((e.target as HTMLInputElement).value)}
        />
      </label>
    </div>
    <div class="control-row">
      <label>
        <span>Commentary Gap</span>
        <input
          type="range"
          value={debug.commentaryGap}
          min="30"
          max="120"
          step="5"
          oninput={(e) => setCommentaryGap(parseInt((e.target as HTMLInputElement).value, 10))}
        />
        <span class="range-val">{debug.commentaryGap}s</span>
      </label>
    </div>
    <div class="instructions-row">
      <label>
        <span>Custom Instructions</span>
      </label>
      <textarea
        class="instructions-editor"
        placeholder="Extra instructions sent alongside each character's system prompt. E.g. 'Focus on teamfights', 'Be family-friendly', 'Speak in short sentences'..."
        value={debug.customSystemInstructions}
        oninput={(e) => setCustomSystemInstructions((e.target as HTMLTextAreaElement).value)}
        rows="3"
      ></textarea>
    </div>
  </section>

  <!-- Debug Controls -->
  <section class="section">
    <h2>Debug</h2>
    <div class="control-row">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={autoScroll} />
        <span>Auto-scroll log</span>
      </label>
      <button class="btn-secondary" onclick={clearDebugLog}>Clear Log</button>
    </div>
  </section>

  <!-- Stats -->
  <section class="section">
    <h2>Stats</h2>
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

  <!-- Log -->
  <section class="section log-section">
    <h2>Event Log</h2>
    <div class="log-container" bind:this={logContainer}>
      {#if debug.entries.length === 0}
        <p class="empty-msg">No events yet. Start commentary to see debug output.</p>
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
  </section>
</div>

<style>
  .debug-page {
    padding: var(--space-6);
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  h1 {
    font-size: 1.8rem;
    color: var(--color-pink);
    margin-bottom: var(--space-5);
    flex-shrink: 0;
  }

  h2 {
    font-size: var(--font-xs);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--color-text-muted, #6B7788);
    margin: 0 0 var(--space-2-5);
    font-weight: 600;
  }

  .section {
    margin-bottom: var(--space-5);
    flex-shrink: 0;
  }

  .log-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .control-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
  }

  label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  label span:first-child {
    font-size: var(--font-base);
    color: var(--color-text-secondary);
    min-width: 120px;
  }

  input[type="range"] {
    flex: 1;
    max-width: 200px;
  }

  .range-val {
    font-size: var(--font-brand-md);
    color: var(--color-text-muted);
    min-width: 40px;
  }

  .checkbox-label {
    gap: var(--space-1-5);
    cursor: pointer;
  }

  .checkbox-label span {
    min-width: auto !important;
  }

  input[type="checkbox"] {
    accent-color: var(--color-teal, #3B9797);
  }

  .btn-secondary {
    padding: 5px var(--space-3-5);
    border: 1px solid var(--white-a8);
    border-radius: var(--radius-md);
    background: var(--white-a4);
    color: var(--color-text-secondary, #8a94a6);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-xs);
    transition: background var(--transition-base);
  }

  .btn-secondary:hover {
    background: var(--white-a8);
    color: var(--color-text-primary);
  }

  .text-input {
    flex: 1;
    padding: var(--space-1-5) var(--space-2-5);
    border-radius: var(--radius-md);
    border: 1px solid var(--white-a8);
    background: var(--white-a4);
    color: var(--color-text-primary, #e2e8f0);
    font-family: inherit;
    font-size: var(--font-brand-md);
    outline: none;
    transition: border-color var(--transition-base);
  }

  .text-input::placeholder {
    color: var(--color-text-muted, #6B7788);
  }

  .text-input:focus {
    border-color: var(--teal-a40);
  }

  .instructions-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1-5);
    margin-bottom: var(--space-2);
  }

  .instructions-editor {
    width: 100%;
    padding: var(--space-2) var(--space-2-5);
    border-radius: var(--radius-md);
    border: 1px solid var(--white-a8);
    background: var(--white-a4);
    color: var(--color-text-primary, #e2e8f0);
    font-family: inherit;
    font-size: var(--font-brand-md);
    resize: vertical;
    outline: none;
    transition: border-color var(--transition-base);
    box-sizing: border-box;
  }

  .instructions-editor::placeholder {
    color: var(--color-text-muted, #6B7788);
  }

  .instructions-editor:focus {
    border-color: var(--teal-a40);
  }

  /* Stats */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }

  .stat {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-lg);
    background: var(--white-a3);
    border: 1px solid var(--white-a6);
  }

  .stat-label {
    display: block;
    font-size: var(--font-brand-sm);
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--color-text-muted, #6B7788);
    margin-bottom: var(--space-0-5);
  }

  .stat-value {
    font-size: var(--font-xl);
    font-weight: 600;
    color: var(--color-text-primary, #e2e8f0);
  }

  /* Log */
  .log-container {
    flex: 1;
    overflow-y: auto;
    background: var(--black-a20);
    border-radius: var(--radius-lg);
    border: 1px solid var(--white-a6);
    padding: var(--space-1-5);
    font-family: 'Courier New', monospace;
    font-size: var(--font-xs);
  }

  .log-entry {
    display: flex;
    gap: var(--space-2);
    padding: 3px var(--space-1-5);
    border-radius: var(--radius-xs);
    align-items: baseline;
  }

  .log-entry:hover {
    background: var(--white-a3);
  }

  .error-entry {
    background: rgba(255, 107, 107, 0.06);
  }

  .log-time {
    color: var(--color-text-muted, #6B7788);
    flex-shrink: 0;
    font-size: 0.7rem;
  }

  .log-badge {
    flex-shrink: 0;
    font-weight: 700;
    font-size: var(--font-brand-sm);
    min-width: 56px;
  }

  .log-text {
    color: var(--color-text-secondary, #8a94a6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty-msg {
    color: var(--color-text-muted, #6B7788);
    text-align: center;
    padding: var(--space-6);
    font-family: inherit;
    font-size: var(--font-base);
  }
</style>
