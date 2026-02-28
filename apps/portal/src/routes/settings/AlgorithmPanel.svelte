<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { SliderInput } from '@glazebot/shared-ui';
  import NumberInput from '$lib/components/ui/NumberInput.svelte';
  import TextArea from '$lib/components/ui/TextArea.svelte';

  interface Props {
    config: Record<string, unknown>;
    onsave: (config: Record<string, unknown>) => Promise<void>;
  }

  let { config, onsave }: Props = $props();

  // ── Block types with labels ──
  const BLOCK_TYPES = [
    { key: 'solo_observation', label: 'Solo Observation', desc: 'React to what\'s on screen' },
    { key: 'emotional_reaction', label: 'Emotional Reaction', desc: 'Pure emotional response' },
    { key: 'question', label: 'Question', desc: 'Ask the player or wonder aloud' },
    { key: 'backstory_reference', label: 'Backstory Reference', desc: 'Reference own backstory' },
    { key: 'quip_banter', label: 'Quip / Banter', desc: 'Two characters exchange lines' },
    { key: 'callback', label: 'Callback', desc: 'Reference earlier in the session' },
    { key: 'hype_chain', label: 'Hype Chain', desc: 'Multiple characters react rapidly' },
    { key: 'silence', label: 'Silence', desc: 'Intentional quiet moment' },
  ] as const;

  const DEFAULT_WEIGHTS: Record<string, number> = {
    solo_observation: 30, emotional_reaction: 15, question: 10,
    backstory_reference: 8, quip_banter: 12, callback: 5, hype_chain: 5, silence: 15,
  };

  const DEFAULT_PROMPTS: Record<string, string> = {
    solo_observation: 'React to what you see on screen. Be specific about ONE thing.',
    emotional_reaction: 'Express a pure emotional reaction. Don\'t describe the screen. Just FEEL it.',
    question: 'Ask the player a question or wonder something aloud about what\'s happening.',
    backstory_reference: 'Subtly reference your own backstory or lore in the context of what you see.',
    quip_banter: 'Have a quick back-and-forth exchange with your co-caster about what just happened.',
    callback: 'Reference something from earlier in this session that connects to what\'s happening now.',
    hype_chain: 'React with rapid-fire energy to this moment. One punchy line.',
  };

  // ── Extract from config ──
  function getCommentary(): Record<string, unknown> {
    return ((config as Record<string, unknown>)?.commentary as Record<string, unknown>) ?? {};
  }

  function getWeights(): Record<string, number> {
    return { ...DEFAULT_WEIGHTS, ...((getCommentary().blockWeights as Record<string, number>) ?? {}) };
  }

  function getPrompts(): Record<string, string> {
    return { ...DEFAULT_PROMPTS, ...((getCommentary().blockPrompts as Record<string, string>) ?? {}) };
  }

  function getMemoryConfig(): Record<string, unknown> {
    return {
      enabled: true,
      extractionIntervalMinutes: 10,
      maxMemoriesPerCharacter: 100,
      memoriesPerPrompt: 10,
      extractionPrompt: 'Review the conversation and extract 1-3 key memories worth remembering.',
      ...((getCommentary().memory as Record<string, unknown>) ?? {}),
    };
  }

  let weights = $state(getWeights());
  let prompts = $state(getPrompts());
  let memoryConfig = $state(getMemoryConfig());
  let expandedPrompt = $state<string | null>(null);
  let saving = $state(false);
  let simResults = $state<Record<string, number> | null>(null);

  // ── Derived: distribution ──
  let distribution = $derived.by(() => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (total === 0) return Object.fromEntries(BLOCK_TYPES.map((b) => [b.key, 0]));
    return Object.fromEntries(BLOCK_TYPES.map((b) => [b.key, weights[b.key] / total]));
  });

  let barMax = $derived(Math.max(...Object.values(distribution), 0.01));

  // ── Save ──
  async function save() {
    saving = true;
    try {
      const commentary = { ...getCommentary(), blockWeights: { ...weights }, blockPrompts: { ...prompts }, memory: { ...memoryConfig } };
      const updated = { ...config, commentary };
      await onsave(updated);
    } finally {
      saving = false;
    }
  }

  // ── Simulate ──
  function simulate() {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (total === 0) {
      simResults = Object.fromEntries(BLOCK_TYPES.map((b) => [b.key, 0]));
      return;
    }
    const counts: Record<string, number> = {};
    for (const b of BLOCK_TYPES) counts[b.key] = 0;

    for (let i = 0; i < 100; i++) {
      let roll = Math.random() * total;
      for (const b of BLOCK_TYPES) {
        roll -= weights[b.key];
        if (roll <= 0) { counts[b.key]++; break; }
      }
    }
    simResults = counts;
  }
</script>

<div class="algo-panel" data-testid="algorithm-panel">
  <!-- ═══ A. Block Weights ═══ -->
  <Card>
    <div class="section-header">
      <h3>Block Weights</h3>
      <p class="section-desc">Control how often each commentary type is selected. Higher weight = more frequent.</p>
    </div>

    <div class="weights-layout">
      <div class="weights-sliders">
        {#each BLOCK_TYPES as bt}
          <div class="weight-row" data-testid="weight-{bt.key}">
            <div class="weight-label">
              <span class="weight-name">{bt.label}</span>
              <span class="weight-pct">{(distribution[bt.key] * 100).toFixed(1)}%</span>
            </div>
            <SliderInput
              min={0}
              max={100}
              step={1}
              value={weights[bt.key]}
              onchange={(v) => { weights[bt.key] = v; }}
            />
          </div>
        {/each}
      </div>

      <div class="weights-chart">
        <h4>Distribution</h4>
        {#each BLOCK_TYPES as bt}
          <div class="bar-row">
            <span class="bar-label">{bt.label}</span>
            <div class="bar-track">
              <div
                class="bar-fill bar-{bt.key}"
                style="width: {(distribution[bt.key] / barMax) * 100}%"
              ></div>
            </div>
            <span class="bar-value">{(distribution[bt.key] * 100).toFixed(0)}%</span>
          </div>
        {/each}
      </div>
    </div>
  </Card>

  <!-- ═══ B. Block Prompts ═══ -->
  <Card>
    <div class="section-header">
      <h3>Block Prompts</h3>
      <p class="section-desc">Customize the instruction given to the LLM for each block type.</p>
    </div>

    {#each BLOCK_TYPES.filter((b) => b.key !== 'silence') as bt}
      <div class="prompt-accordion" data-testid="prompt-{bt.key}">
        <button
          class="prompt-header"
          onclick={() => { expandedPrompt = expandedPrompt === bt.key ? null : bt.key; }}
        >
          <span>{bt.label}</span>
          <span class="prompt-chevron">{expandedPrompt === bt.key ? '▼' : '▶'}</span>
        </button>
        {#if expandedPrompt === bt.key}
          <div class="prompt-body">
            <TextArea
              value={prompts[bt.key]}
              rows={3}
              onchange={(v) => { prompts[bt.key] = v; }}
              data-testid="prompt-textarea-{bt.key}"
            />
            <button
              class="reset-btn"
              onclick={() => { prompts[bt.key] = DEFAULT_PROMPTS[bt.key]; }}
            >Reset to Default</button>
          </div>
        {/if}
      </div>
    {/each}
  </Card>

  <!-- ═══ C. Memory Settings ═══ -->
  <Card>
    <div class="section-header">
      <h3>Character Memory</h3>
      <p class="section-desc">Characters remember past sessions and reference them during commentary.</p>
    </div>

    <div class="memory-grid">
      <label class="toggle-row" data-testid="memory-enabled">
        <input type="checkbox" bind:checked={memoryConfig.enabled} />
        <span>Enable Character Memory</span>
      </label>

      <div class="memory-field">
        <label>Extraction Interval (minutes)</label>
        <NumberInput
          value={memoryConfig.extractionIntervalMinutes}
          min={1}
          max={30}
          onchange={(v) => { memoryConfig.extractionIntervalMinutes = v; }}
          data-testid="memory-interval"
        />
      </div>

      <div class="memory-field">
        <label>Max Memories Per Character</label>
        <NumberInput
          value={memoryConfig.maxMemoriesPerCharacter}
          min={10}
          max={200}
          onchange={(v) => { memoryConfig.maxMemoriesPerCharacter = v; }}
          data-testid="memory-max"
        />
      </div>

      <div class="memory-field">
        <label>Memories Injected Per Prompt</label>
        <NumberInput
          value={memoryConfig.memoriesPerPrompt}
          min={1}
          max={20}
          onchange={(v) => { memoryConfig.memoriesPerPrompt = v; }}
          data-testid="memory-per-prompt"
        />
      </div>

      <div class="memory-field full-width">
        <label>Extraction Prompt</label>
        <TextArea
          value={memoryConfig.extractionPrompt}
          rows={3}
          onchange={(v) => { memoryConfig.extractionPrompt = v; }}
          data-testid="memory-extraction-prompt"
        />
      </div>
    </div>
  </Card>

  <!-- ═══ D. Simulator ═══ -->
  <Card>
    <div class="section-header">
      <h3>Simulator</h3>
      <p class="section-desc">Preview block selection distribution over 100 ticks.</p>
    </div>

    <Button onclick={simulate} data-testid="simulate-btn">Simulate 100 Ticks</Button>

    {#if simResults}
      <div class="sim-results">
        {#each BLOCK_TYPES as bt}
          <div class="sim-row">
            <span class="sim-label">{bt.label}</span>
            <div class="sim-track">
              <div class="sim-fill" style="width: {simResults[bt.key]}%"></div>
            </div>
            <span class="sim-count">{simResults[bt.key]}</span>
          </div>
        {/each}
      </div>
    {/if}
  </Card>

  <!-- ═══ Save ═══ -->
  <div class="save-bar">
    <Button onclick={save} disabled={saving} variant="primary" data-testid="save-algorithm">
      {saving ? 'Saving...' : 'Save Algorithm Config'}
    </Button>
  </div>
</div>

<style>
  .algo-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg, 1.5rem);
  }

  .section-header {
    margin-bottom: var(--space-md, 1rem);
  }
  .section-header h3 {
    margin: 0 0 0.25rem;
    font-size: var(--font-lg, 1.125rem);
    color: var(--color-text-primary);
  }
  .section-desc {
    margin: 0;
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-secondary);
  }

  /* ── Weights ── */
  .weights-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-xl, 2rem);
  }

  .weight-row {
    margin-bottom: var(--space-sm, 0.5rem);
  }
  .weight-label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }
  .weight-name {
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-primary);
  }
  .weight-pct {
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
  }

  .weights-chart h4 {
    margin: 0 0 var(--space-sm, 0.5rem);
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-primary);
  }
  .bar-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }
  .bar-label {
    width: 120px;
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-primary);
    flex-shrink: 0;
  }
  .bar-track {
    flex: 1;
    height: 16px;
    background: var(--color-surface-raised, #2a2a2a);
    border-radius: 4px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.2s ease;
    background: var(--color-accent, #6366f1);
  }
  .bar-solo_observation { background: #6366f1; }
  .bar-emotional_reaction { background: #f43f5e; }
  .bar-question { background: #22d3ee; }
  .bar-backstory_reference { background: #a78bfa; }
  .bar-quip_banter { background: #f59e0b; }
  .bar-callback { background: #10b981; }
  .bar-hype_chain { background: #ef4444; }
  .bar-silence { background: #6b7280; }
  .bar-value {
    width: 36px;
    text-align: right;
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
  }

  /* ── Prompts ── */
  .prompt-accordion {
    border-bottom: 1px solid var(--color-border, #333);
  }
  .prompt-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-sm, 0.5rem) 0;
    background: none;
    border: none;
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: var(--font-base, 0.875rem);
  }
  .prompt-chevron {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }
  .prompt-body {
    padding: 0 0 var(--space-md, 1rem);
  }
  .reset-btn {
    margin-top: 0.5rem;
    padding: 0.25rem 0.75rem;
    font-size: var(--font-base, 0.875rem);
    background: var(--color-surface-raised, #2a2a2a);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border, #333);
    border-radius: 4px;
    cursor: pointer;
  }
  .reset-btn:hover {
    background: var(--color-surface-hover, #333);
  }

  /* ── Memory ── */
  .memory-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-md, 1rem);
  }
  .memory-field label {
    display: block;
    margin-bottom: 0.25rem;
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-primary);
  }
  .full-width {
    grid-column: 1 / -1;
  }
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    grid-column: 1 / -1;
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-primary);
    cursor: pointer;
  }
  .toggle-row input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--color-accent, #6366f1);
  }

  /* ── Simulator ── */
  .sim-results {
    margin-top: var(--space-md, 1rem);
  }
  .sim-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }
  .sim-label {
    width: 120px;
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-primary);
    flex-shrink: 0;
  }
  .sim-track {
    flex: 1;
    height: 16px;
    background: var(--color-surface-raised, #2a2a2a);
    border-radius: 4px;
    overflow: hidden;
  }
  .sim-fill {
    height: 100%;
    background: var(--color-accent, #6366f1);
    border-radius: 4px;
    transition: width 0.2s ease;
  }
  .sim-count {
    width: 28px;
    text-align: right;
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
  }

  /* ── Save Bar ── */
  .save-bar {
    display: flex;
    justify-content: flex-end;
  }
</style>
