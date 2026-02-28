<script lang="ts">
  import { getDebugStore, setCommentaryGap, setGameHint, setCustomSystemInstructions, setContextEnabled, setContextInterval, setContextBufferSize, setSpeechMode, setPttKey, setVadThreshold, setVadSilenceMs, setTtsStreaming, clearTtsTimings, clearDebugLog, clearFrames } from '$lib/stores/debug.svelte';
  import type { DebugEntry, FrameCapture, TtsTiming } from '$lib/stores/debug.svelte';
  import { SliderInput, ToggleSwitch } from '@glazebot/shared-ui';
  const debug = getDebugStore();

  // Local slider state (bound to SliderInput, synced to store via onchange)
  let commentaryGap = $state(debug.commentaryGap);
  let contextInterval = $state(debug.contextInterval);
  let contextBufferSize = $state(debug.contextBufferSize);
  let vadThreshold = $state(debug.vadThreshold);
  let vadSilenceMs = $state(debug.vadSilenceMs);
  let contextEnabled = $state(debug.contextEnabled);
  let ttsStreaming = $state(debug.ttsStreaming);

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

  // PTT key capture
  let capturingPttKey = $state(false);

  function startPttCapture() {
    capturingPttKey = true;

    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      setPttKey(e.code);
      capturingPttKey = false;
      window.removeEventListener('keydown', onKey);
    }

    window.addEventListener('keydown', onKey);
  }

  function formatKeyCode(code: string): string {
    // Human-friendly key names
    const map: Record<string, string> = {
      ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift',
      ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl',
      AltLeft: 'Left Alt', AltRight: 'Right Alt',
      Space: 'Space', CapsLock: 'Caps Lock',
      Backquote: '`', Tab: 'Tab',
    };
    return map[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '');
  }

  function entryLabel(type: string): string {
    switch (type) {
      case 'frame': return 'FRAME';
      case 'llm-request': return 'LLM REQ';
      case 'llm-response': return 'LLM RES';
      case 'tts-request': return 'TTS REQ';
      case 'tts-response': return 'TTS RES';
      case 'context-request': return 'CTX REQ';
      case 'context-response': return 'CTX RES';
      case 'stt-request': return 'STT REQ';
      case 'stt-response': return 'STT RES';
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
    'context-request': '#5bc0be',
    'context-response': '#3aafa9',
    'stt-request': '#e6a23c',
    'stt-response': '#f0c674',
    'error': 'var(--color-error)',
    'info': 'var(--color-text-secondary)',
  };

  function entryColor(type: string): string {
    return entryColors[type] ?? 'var(--color-text-secondary)';
  }

  function timingSummary(timings: TtsTiming[]): { avgTTFB: number; avgFirstAudio: number; avgTotal: number; avgSize: number } | null {
    if (timings.length === 0) return null;
    const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    return {
      avgTTFB: avg(timings.map(t => t.ttsRequestDuration)),
      avgFirstAudio: avg(timings.map(t => t.ttsFirstAudio)),
      avgTotal: avg(timings.map(t => t.totalDuration)),
      avgSize: avg(timings.map(t => t.audioSize)),
    };
  }

  function fmtMs(ms: number): string {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  }

  function fmtBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${bytes}B`;
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
        return `${d.character} → ${(d.voiceId as string)?.slice(0, 8)}... (${d.textLength} chars) [${d.mode}]`;
      case 'tts-response':
        return `${d.character}: ${d.totalMs}ms total, ${d.firstAudioMs}ms first audio, ${fmtBytes(d.audioSize as number)} [${d.mode}]`;
      case 'context-request':
        return `History: ${d.sceneHistoryLength}${d.detectedGame ? `, game: ${d.detectedGame}` : ''}`;
      case 'context-response': {
        const desc = d.description as string | undefined;
        return desc
          ? `${desc.slice(0, 80)}${desc.length > 80 ? '...' : ''}${d.game_name ? ` [${d.game_name}]` : ''}`
          : '(empty)';
      }
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

    <!-- Theme picker hidden for now — revisit later -->

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

      <SliderInput label="Commentary Gap" bind:value={commentaryGap} min={30} max={120} step={5} suffix="s" onchange={() => setCommentaryGap(commentaryGap)} />

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

    <!-- Voice Output -->
    <section class="card">
      <h2>Voice Output</h2>
      <ToggleSwitch label="Stream TTS" bind:checked={ttsStreaming} onchange={() => setTtsStreaming(ttsStreaming)} />
      <span class="field-hint">When enabled, audio streams in real-time for lower latency. Disable to buffer the full response before playback.</span>
    </section>

    <!-- Context Analysis -->
    <section class="card">
      <h2>Context Analysis</h2>

      <ToggleSwitch label="Enable context analysis" bind:checked={contextEnabled} onchange={() => setContextEnabled(contextEnabled)} />

      <SliderInput label="Context Interval" bind:value={contextInterval} min={1} max={15} step={1} suffix="s" onchange={() => setContextInterval(contextInterval)} />

      <SliderInput label="Buffer Size" bind:value={contextBufferSize} min={1} max={50} step={1} onchange={() => setContextBufferSize(contextBufferSize)} />
    </section>

    <!-- Voice Input -->
    <section class="card">
      <h2>Voice Input</h2>

      <div class="field">
        <label class="field-label">Speech Mode</label>
        <div class="radio-group">
          <label class="radio-row">
            <input type="radio" name="speech-mode" value="off" checked={debug.speechMode === 'off'} onchange={() => setSpeechMode('off')} />
            <span>Off</span>
          </label>
          <label class="radio-row">
            <input type="radio" name="speech-mode" value="push-to-talk" checked={debug.speechMode === 'push-to-talk'} onchange={() => setSpeechMode('push-to-talk')} />
            <span>Push to Talk</span>
          </label>
          <label class="radio-row">
            <input type="radio" name="speech-mode" value="always-on" checked={debug.speechMode === 'always-on'} onchange={() => setSpeechMode('always-on')} />
            <span>Always On</span>
          </label>
        </div>
      </div>

      {#if debug.speechMode === 'push-to-talk'}
        <div class="field">
          <label class="field-label">Push-to-Talk Key</label>
          <button class="ptt-key-btn" onclick={startPttCapture}>
            {#if capturingPttKey}
              <span class="ptt-capture-hint">Press any key...</span>
            {:else}
              {formatKeyCode(debug.pttKey)}
            {/if}
          </button>
        </div>
      {/if}

      {#if debug.speechMode === 'always-on'}
        <SliderInput label="VAD Sensitivity" bind:value={vadThreshold} min={0.005} max={0.1} step={0.005} onchange={() => setVadThreshold(vadThreshold)} />

        <SliderInput label="Silence Duration" bind:value={vadSilenceMs} min={500} max={5000} step={100} suffix="ms" onchange={() => setVadSilenceMs(vadSilenceMs)} />
      {/if}
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
          <span class="stat-label">Context Calls</span>
          <span class="stat-value">{debug.totalContextCalls}</span>
        </div>
        <div class="stat">
          <span class="stat-label">STT Calls</span>
          <span class="stat-value">{debug.totalSttCalls}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Detected Game</span>
          <span class="stat-value" style="font-size: var(--font-sm);">{debug.detectedGame || '--'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Log Entries</span>
          <span class="stat-value">{debug.entries.length}</span>
        </div>
      </div>
    </section>

    <!-- TTS Timing -->
    <section class="card">
      <div class="timing-header">
        <h2>TTS Timing</h2>
        {#if debug.ttsTimings.length > 0}
          <button class="clear-btn" onclick={clearTtsTimings}>Clear</button>
        {/if}
      </div>

      {#if debug.ttsTimings.length === 0}
        <p class="timing-empty">No TTS timing data yet. Start commentary to collect metrics.</p>
      {:else}
        {@const summary = timingSummary(debug.ttsTimings)}
        {#if summary}
          <div class="timing-summary">
            <div class="timing-summary-stat">
              <span class="timing-summary-label">Avg TTFB</span>
              <span class="timing-summary-value">{fmtMs(summary.avgTTFB)}</span>
            </div>
            <div class="timing-summary-stat">
              <span class="timing-summary-label">Avg First Audio</span>
              <span class="timing-summary-value">{fmtMs(summary.avgFirstAudio)}</span>
            </div>
            <div class="timing-summary-stat">
              <span class="timing-summary-label">Avg Total</span>
              <span class="timing-summary-value">{fmtMs(summary.avgTotal)}</span>
            </div>
            <div class="timing-summary-stat">
              <span class="timing-summary-label">Avg Size</span>
              <span class="timing-summary-value">{fmtBytes(summary.avgSize)}</span>
            </div>
          </div>
        {/if}

        <div class="timing-table-wrap">
          <table class="timing-table">
            <thead>
              <tr>
                <th>Character</th>
                <th>Mode</th>
                <th>TTFB</th>
                <th>1st Audio</th>
                <th>Transfer</th>
                <th>Playback</th>
                <th>Total</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {#each [...debug.ttsTimings].reverse().slice(0, 20) as timing (timing.id)}
                <tr class={timing.mode === 'streaming' ? 'timing-row-streaming' : ''}>
                  <td class="timing-char">{timing.characterName}</td>
                  <td><span class="timing-mode timing-mode-{timing.mode}">{timing.mode}</span></td>
                  <td class="timing-num">{fmtMs(timing.ttsRequestDuration)}</td>
                  <td class="timing-num">{fmtMs(timing.ttsFirstAudio)}</td>
                  <td class="timing-num">{fmtMs(timing.ttsTransferDuration)}</td>
                  <td class="timing-num">{fmtMs(timing.playbackDuration)}</td>
                  <td class="timing-num timing-total">{fmtMs(timing.totalDuration)}</td>
                  <td class="timing-num">{fmtBytes(timing.audioSize)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
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
          <ToggleSwitch label="Auto-scroll" bind:checked={autoScroll} />
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
        {#if lightboxFrame.detectedGame}
          <div class="lightbox-game">
            <span class="lightbox-game-label">Game:</span>
            <span class="lightbox-game-value">{lightboxFrame.detectedGame}</span>
          </div>
        {/if}
        {#if lightboxFrame.aiResponse}
          <p class="lightbox-response" style="user-select: text;">{lightboxFrame.aiResponse}</p>
        {/if}
        {#if lightboxFrame.sceneContext && lightboxFrame.sceneContext.length > 0}
          <div class="lightbox-scene-history">
            <span class="lightbox-scene-label">Scene History ({lightboxFrame.sceneContext.length})</span>
            <ul class="lightbox-scene-list">
              {#each lightboxFrame.sceneContext as scene}
                <li>
                  <span class="lightbox-scene-time">{formatTime(scene.timestamp)}</span>
                  <span class="lightbox-scene-desc">{scene.description}</span>
                </li>
              {/each}
            </ul>
          </div>
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
    padding: var(--space-6) var(--space-5) var(--space-6) var(--space-7);
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

  /* ── Radio & PTT key ── */
  .radio-group {
    display: flex;
    gap: var(--space-4);
  }

  .radio-row {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    cursor: pointer;
    font-size: var(--font-base);
    color: var(--color-text-primary);
  }

  .radio-row input[type="radio"] {
    accent-color: var(--color-teal);
  }

  .ptt-key-btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--white-a15);
    background: var(--white-a6);
    color: var(--color-text-primary);
    font-size: var(--font-base);
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    min-width: 140px;
    text-align: center;
    transition: background var(--transition-base), border-color var(--transition-base);
  }

  .ptt-key-btn:hover {
    background: var(--white-a10);
    border-color: var(--white-a20);
  }

  .ptt-capture-hint {
    color: var(--color-teal);
    animation: pulse 1s ease-in-out infinite;
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
    user-select: text;
    -webkit-user-select: text;
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

  /* ── Lightbox scene context ── */
  .lightbox-game {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .lightbox-game-label {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .lightbox-game-value {
    font-size: var(--font-base);
    color: var(--color-accent-light);
    font-weight: 600;
  }

  .lightbox-scene-history {
    margin-top: var(--space-2);
    border-top: 1px solid var(--white-a8);
    padding-top: var(--space-2);
  }

  .lightbox-scene-label {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .lightbox-scene-list {
    list-style: none;
    margin: var(--space-1-5) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    max-height: 120px;
    overflow-y: auto;
  }

  .lightbox-scene-list li {
    display: flex;
    gap: var(--space-2);
    align-items: baseline;
    font-size: var(--font-sm);
  }

  .lightbox-scene-time {
    flex-shrink: 0;
    color: var(--color-text-muted);
    font-size: var(--font-2xs);
    font-variant-numeric: tabular-nums;
  }

  .lightbox-scene-desc {
    color: var(--color-text-primary);
    line-height: 1.4;
  }

  /* ── Theme picker ── */
  .theme-section {
    gap: var(--space-3) !important;
  }

  .theme-preview {
    position: relative;
    height: 120px;
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: var(--space-4);
    transition: background 0.4s ease;
  }

  .theme-preview-overlay {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .theme-preview-name {
    font-family: var(--font-brand);
    font-size: var(--font-2xl);
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .theme-preview-desc {
    font-size: var(--font-base);
  }

  .theme-preview-accent {
    width: 28px;
    height: 4px;
    border-radius: var(--radius-pill);
    margin-top: var(--space-1);
  }

  .theme-apply-btn {
    align-self: flex-end;
    padding: var(--space-1-5) var(--space-5);
    border: none;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: var(--font-base);
    font-weight: 600;
    cursor: pointer;
    transition: opacity var(--transition-base), transform var(--transition-base);
  }

  .theme-apply-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .theme-active-badge {
    align-self: flex-end;
    padding: var(--space-1) var(--space-3);
    border: 1.5px solid;
    border-radius: var(--radius-md);
    font-size: var(--font-sm);
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .theme-gallery {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }

  .theme-thumb {
    position: relative;
    border-radius: var(--radius-md);
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    transition: border-color var(--transition-base), transform var(--transition-base);
  }

  .theme-thumb:hover {
    transform: translateY(-1px);
    border-color: var(--white-a15);
  }

  .theme-thumb-selected {
    border-color: var(--thumb-accent) !important;
  }

  .theme-thumb-bg {
    height: 36px;
  }

  .theme-thumb-label {
    display: block;
    text-align: center;
    font-size: var(--font-xs);
    font-weight: 500;
    padding: var(--space-1) 0;
    background: rgba(0, 0, 0, 0.3);
  }

  .theme-thumb-check {
    position: absolute;
    top: 2px;
    right: 4px;
    font-size: var(--font-2xs);
    font-weight: 700;
  }

  /* ── Field hint ── */
  .field-hint {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  /* ── TTS Timing ── */
  .timing-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .timing-empty {
    font-size: var(--font-base);
    color: var(--color-text-muted);
    margin: 0;
  }

  .timing-summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }

  .timing-summary-stat {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--white-a3);
    border: 1px solid var(--white-a6);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .timing-summary-label {
    font-size: var(--font-2xs);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .timing-summary-value {
    font-size: var(--font-lg);
    font-weight: 600;
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
  }

  .timing-table-wrap {
    overflow-x: auto;
    border-radius: var(--radius-md);
    border: 1px solid var(--white-a6);
  }

  .timing-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-sm);
    font-variant-numeric: tabular-nums;
  }

  .timing-table th {
    padding: var(--space-1-5) var(--space-2);
    text-align: left;
    font-size: var(--font-2xs);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
    font-weight: 600;
    border-bottom: 1px solid var(--white-a8);
    white-space: nowrap;
  }

  .timing-table td {
    padding: var(--space-1-5) var(--space-2);
    color: var(--color-text-primary);
    border-bottom: 1px solid var(--white-a4);
  }

  .timing-table tbody tr:hover {
    background: var(--white-a4);
  }

  .timing-row-streaming {
    background: rgba(94, 234, 212, 0.04);
  }

  .timing-char {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .timing-num {
    text-align: right;
    white-space: nowrap;
    font-family: 'Courier New', 'Consolas', monospace;
  }

  .timing-total {
    font-weight: 600;
  }

  .timing-mode {
    display: inline-block;
    padding: 1px var(--space-1-5);
    border-radius: var(--radius-sm);
    font-size: var(--font-2xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .timing-mode-streaming {
    background: rgba(94, 234, 212, 0.15);
    color: var(--color-teal);
  }

  .timing-mode-buffered {
    background: var(--white-a6);
    color: var(--color-text-secondary);
  }
</style>
