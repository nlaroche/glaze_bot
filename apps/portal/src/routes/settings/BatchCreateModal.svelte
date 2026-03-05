<script lang="ts">
  import type { GachaCharacter } from '@glazebot/shared-types';
  import { generateBatchCharacter, getVoiceUsageMap } from '@glazebot/supabase-client';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
    oncomplete: () => void;
  }

  let { open, onclose, oncomplete }: Props = $props();

  // ── Batch config ──
  let counts = $state({ common: 2, rare: 1, epic: 0, legendary: 0 });
  let totalCount = $derived(counts.common + counts.rare + counts.epic + counts.legendary);

  // ── Batch naming ──
  const ADJECTIVES = [
    'crimson', 'neon', 'phantom', 'crystal', 'solar', 'arctic', 'ember', 'jade',
    'cobalt', 'golden', 'shadow', 'thunder', 'velvet', 'iron', 'coral', 'mystic',
    'frozen', 'blazing', 'silent', 'chrome', 'scarlet', 'azure', 'onyx', 'lunar',
    'nova', 'primal', 'sterling', 'vivid', 'molten', 'toxic', 'feral', 'cosmic',
  ];
  const NOUNS = [
    'falcon', 'otter', 'phoenix', 'cobra', 'lynx', 'mantis', 'raven', 'tiger',
    'viper', 'wolf', 'jaguar', 'osprey', 'kraken', 'panda', 'hawk', 'badger',
    'fox', 'stag', 'owl', 'bear', 'drake', 'hound', 'shark', 'bison',
    'condor', 'gecko', 'hornet', 'jackal', 'moose', 'pike', 'raptor', 'wren',
  ];

  function generateBatchName(): string {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = String(Math.floor(1000 + Math.random() * 9000));
    return `${adj}_${noun}_${num}`;
  }

  let batchName = $state(generateBatchName());

  // ── Progress state ──
  let running = $state(false);
  let aborted = $state(false);
  let currentIndex = $state(0);
  let results: { rarity: string; character?: GachaCharacter; error?: string }[] = $state([]);

  let progressPct = $derived(totalCount > 0 ? Math.round((currentIndex / totalCount) * 100) : 0);
  let successCount = $derived(results.filter(r => r.character).length);
  let failCount = $derived(results.filter(r => r.error).length);

  // ── Build the generation queue ──
  function buildQueue(): string[] {
    const queue: string[] = [];
    for (let i = 0; i < counts.common; i++) queue.push('common');
    for (let i = 0; i < counts.rare; i++) queue.push('rare');
    for (let i = 0; i < counts.epic; i++) queue.push('epic');
    for (let i = 0; i < counts.legendary; i++) queue.push('legendary');
    // Shuffle so it's not all commons first
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  }

  async function startBatch() {
    if (totalCount === 0) return;

    running = true;
    aborted = false;
    currentIndex = 0;
    results = [];

    // Build list of already-used voice IDs
    let usedVoiceIds: Set<string>;
    try {
      const usageMap = await getVoiceUsageMap();
      usedVoiceIds = new Set(usageMap.keys());
    } catch {
      usedVoiceIds = new Set();
    }

    const queue = buildQueue();

    for (let i = 0; i < queue.length; i++) {
      if (aborted) break;
      currentIndex = i;
      const rarity = queue[i];

      try {
        const character = await generateBatchCharacter({
          rarity,
          batch_id: batchName,
          exclude_voice_ids: Array.from(usedVoiceIds),
        });

        // Track the newly assigned voice
        if (character.voice_id) {
          usedVoiceIds.add(character.voice_id);
        }

        results = [...results, { rarity, character }];
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results = [...results, { rarity, error: msg }];
      }
    }

    currentIndex = queue.length;
    running = false;

    const created = results.filter(r => r.character).map(r => r.character!);
    if (created.length > 0) {
      toast.success(`Batch "${batchName}" complete: ${created.length}/${queue.length} characters`);
      oncomplete();
    } else {
      toast.error('Batch failed — no characters were created');
    }
  }

  function handleAbort() {
    aborted = true;
  }

  function handleClose() {
    if (running) return;
    // Reset for next use
    counts = { common: 2, rare: 1, epic: 0, legendary: 0 };
    batchName = generateBatchName();
    currentIndex = 0;
    results = [];
    onclose();
  }

  function rerollName() {
    batchName = generateBatchName();
  }

  // Reset batch name when opened
  $effect(() => {
    if (open && !running) {
      batchName = generateBatchName();
      currentIndex = 0;
      results = [];
    }
  });
</script>

{#if open}
  <div class="backdrop" onclick={running ? undefined : handleClose} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <h2>Batch Create</h2>
        {#if !running}
          <button class="close-btn" onclick={handleClose}>&times;</button>
        {/if}
      </div>

      {#if !running && currentIndex === 0}
        <!-- CONFIG PHASE -->
        <div class="config-section">
          <!-- Batch name -->
          <div class="field">
            <label class="field-label">Batch Name</label>
            <div class="name-row">
              <input type="text" class="batch-name-input" bind:value={batchName} />
              <button class="reroll-btn" onclick={rerollName} title="Reroll name">&#x21bb;</button>
            </div>
          </div>

          <!-- Rarity counts -->
          <div class="field">
            <label class="field-label">Characters per Rarity</label>
            <div class="rarity-grid">
              {#each (['common', 'rare', 'epic', 'legendary'] as const) as rarity}
                <div class="rarity-row">
                  <Badge variant={rarity} text={rarity} />
                  <div class="count-controls">
                    <button class="count-btn" onclick={() => counts[rarity] = Math.max(0, counts[rarity] - 1)}>-</button>
                    <span class="count-value">{counts[rarity]}</span>
                    <button class="count-btn" onclick={() => counts[rarity] = Math.min(50, counts[rarity] + 1)}>+</button>
                  </div>
                </div>
              {/each}
            </div>
            <p class="total-line">Total: <strong>{totalCount}</strong> characters</p>
          </div>

          <Button
            variant="primary"
            disabled={totalCount === 0}
            onclick={startBatch}
            testid="start-batch-btn"
          >
            Start Batch
          </Button>
        </div>

      {:else}
        <!-- PROGRESS PHASE -->
        <div class="progress-section">
          <div class="progress-header">
            <span class="batch-label">{batchName}</span>
            <span class="progress-count">{currentIndex} / {totalCount}</span>
          </div>

          <!-- Progress bar -->
          <div class="progress-bar">
            <div class="progress-fill" style="width: {progressPct}%"></div>
          </div>

          <!-- Status counts -->
          <div class="status-row">
            <span class="stat success">{successCount} created</span>
            {#if failCount > 0}
              <span class="stat fail">{failCount} failed</span>
            {/if}
            {#if aborted}
              <span class="stat aborted">Aborted</span>
            {/if}
          </div>

          <!-- Result log -->
          <div class="result-log">
            {#each results as result, i}
              <div class="log-entry" class:error={!!result.error}>
                <span class="log-index">#{i + 1}</span>
                <Badge variant={result.rarity as 'common' | 'rare' | 'epic' | 'legendary'} text={result.rarity} />
                {#if result.character}
                  <span class="log-name">{result.character.name}</span>
                  {#if result.character.voice_name}
                    <span class="log-voice">{result.character.voice_name}</span>
                  {/if}
                {:else}
                  <span class="log-error">{result.error}</span>
                {/if}
              </div>
            {/each}
            {#if running}
              <div class="log-entry generating">
                <span class="log-index">#{currentIndex + 1}</span>
                <span class="spinner"></span>
                <span class="log-generating">Generating...</span>
              </div>
            {/if}
          </div>

          <!-- Actions -->
          <div class="progress-actions">
            {#if running}
              <Button variant="destructive" onclick={handleAbort}>
                Abort
              </Button>
            {:else}
              <Button variant="primary" onclick={handleClose}>
                Done
              </Button>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal {
    background: var(--panel-bg, #0d1526);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-2xl, 12px);
    padding: var(--space-6, 24px);
    width: 520px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-5, 20px);
  }

  .modal-header h2 {
    font-family: var(--font-brand);
    font-size: var(--font-2xl);
    font-weight: 700;
    color: var(--color-heading);
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  .close-btn:hover { color: var(--color-text-primary); }

  /* ── Config ── */
  .config-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-5, 20px);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 8px);
  }

  .field-label {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .name-row {
    display: flex;
    gap: var(--space-2, 8px);
  }

  .batch-name-input {
    flex: 1;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--input-border);
    border-radius: var(--input-radius);
    background: var(--input-bg);
    color: var(--color-text-primary);
    font-family: var(--font-mono, monospace);
    font-size: var(--font-base);
    outline: none;
  }
  .batch-name-input:focus {
    border-color: var(--input-focus-border);
  }

  .reroll-btn {
    background: var(--white-a6);
    border: 1px solid var(--color-border);
    border-radius: var(--input-radius);
    color: var(--color-text-primary);
    font-size: 1.2rem;
    cursor: pointer;
    padding: var(--space-1) var(--space-2-5);
    transition: background var(--transition-fast);
  }
  .reroll-btn:hover { background: var(--white-a10); }

  .rarity-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 8px);
  }

  .rarity-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    background: var(--white-a4);
    border-radius: var(--radius-md);
  }

  .count-controls {
    display: flex;
    align-items: center;
    gap: var(--space-2-5, 10px);
  }

  .count-btn {
    width: 32px;
    height: 32px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--white-a6);
    color: var(--color-text-primary);
    font-size: var(--font-lg);
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--transition-fast);
  }
  .count-btn:hover { background: var(--white-a10); }

  .count-value {
    font-size: var(--font-xl);
    font-weight: 700;
    color: var(--color-text-primary);
    min-width: 28px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .total-line {
    font-size: var(--font-base);
    color: var(--color-text-secondary);
    margin: 0;
    text-align: right;
  }
  .total-line strong {
    color: var(--color-text-primary);
  }

  /* ── Progress ── */
  .progress-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 16px);
  }

  .progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .batch-label {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-base);
    color: var(--color-teal);
    font-weight: 600;
  }

  .progress-count {
    font-size: var(--font-base);
    color: var(--color-text-primary);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .progress-bar {
    height: 8px;
    background: var(--white-a8);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-teal);
    border-radius: 4px;
    transition: width 0.4s ease;
  }

  .status-row {
    display: flex;
    gap: var(--space-4);
  }

  .stat {
    font-size: var(--font-base);
    font-weight: 600;
  }
  .stat.success { color: var(--color-teal); }
  .stat.fail { color: var(--color-error); }
  .stat.aborted { color: var(--rarity-legendary); }

  /* ── Result log ── */
  .result-log {
    flex: 1;
    overflow-y: auto;
    max-height: 320px;
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 4px);
  }

  .log-entry {
    display: flex;
    align-items: center;
    gap: var(--space-2-5);
    padding: var(--space-1-5) var(--space-3);
    background: var(--white-a4);
    border-radius: var(--radius-md);
    font-size: var(--font-base);
  }

  .log-entry.error {
    background: rgba(239, 68, 68, 0.08);
  }

  .log-entry.generating {
    background: var(--teal-a8, rgba(59, 151, 151, 0.08));
  }

  .log-index {
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    min-width: 28px;
  }

  .log-name {
    color: var(--color-text-primary);
    font-weight: 600;
    flex: 1;
  }

  .log-voice {
    color: var(--color-text-muted);
    font-size: var(--font-base);
  }

  .log-error {
    color: var(--color-error);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .log-generating {
    color: var(--color-teal);
    font-weight: 500;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--white-a12);
    border-top-color: var(--color-teal);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .progress-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }
</style>
