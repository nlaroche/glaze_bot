<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import NumberInput from '$lib/components/ui/NumberInput.svelte';
  import TextInput from '$lib/components/ui/TextInput.svelte';
  import TextArea from '$lib/components/ui/TextArea.svelte';
  import { SliderInput } from '@glazebot/shared-ui';
  import { TOPIC_LABELS } from '@glazebot/shared-types';
  import type { GachaCharacter } from '@glazebot/shared-types';

  interface Props {
    config: Record<string, unknown>;
    characters: GachaCharacter[];
    loadingData: boolean;
    onsave: (config: Record<string, unknown>) => Promise<void>;
  }

  let { config, characters, loadingData, onsave }: Props = $props();

  // ── Multi-char topics (need 2+ party members) ──
  const MULTI_CHAR_TOPICS = new Set(['quip_banter', 'hype_chain']);

  // ── Extract from config ──
  function getCommentary(): Record<string, unknown> {
    return ((config as Record<string, unknown>)?.commentary as Record<string, unknown>) ?? {};
  }

  function getTopicWeights(): Record<string, number> {
    const c = getCommentary();
    return { ...((c.topicWeights ?? c.blockWeights) as Record<string, number> ?? {}) };
  }

  function getTopicPrompts(): Record<string, string> {
    const c = getCommentary();
    const prompts = { ...((c.topicPrompts ?? c.blockPrompts) as Record<string, string> ?? {}) };
    // Ensure every weight key has a prompt entry (prevents bind:value={undefined})
    const weights = getTopicWeights();
    for (const key of Object.keys(weights)) {
      if (!(key in prompts)) prompts[key] = '';
    }
    return prompts;
  }

  function getTopicCountByRarity(): Record<string, { min: number; max: number }> {
    return structuredClone(
      (config.topicCountByRarity as Record<string, { min: number; max: number }>) ?? {
        common: { min: 3, max: 4 },
        rare: { min: 5, max: 6 },
        epic: { min: 7, max: 8 },
        legendary: { min: 9, max: 10 },
      }
    );
  }

  function getLegendaryCustomTopicCount(): number {
    return (config.legendaryCustomTopicCount as number) ?? 2;
  }

  // ── State ──
  let topicWeights: Record<string, number> = $state(getTopicWeights());
  let topicPrompts: Record<string, string> = $state(getTopicPrompts());
  let topicCountByRarity: Record<string, { min: number; max: number }> = $state(getTopicCountByRarity());
  let legendaryCustomTopicCount: number = $state(getLegendaryCustomTopicCount());
  let saving = $state(false);

  // ── Memory config ──
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

  function getVisualConfig(): { animationSpeed: number; strokeWidth: number; dropShadow: boolean } {
    const raw = (getCommentary().visuals as Record<string, unknown>) ?? {};
    return {
      animationSpeed: typeof raw.animationSpeed === 'number' ? raw.animationSpeed : 1.0,
      strokeWidth: typeof raw.strokeWidth === 'number' ? raw.strokeWidth : 3,
      dropShadow: typeof raw.dropShadow === 'boolean' ? raw.dropShadow : true,
    };
  }

  let memoryConfig: Record<string, unknown> = $state(getMemoryConfig());
  let visualsConfig = $state(getVisualConfig());

  // Re-sync when config prop changes (it loads asynchronously)
  $effect(() => {
    const _ = config;
    topicWeights = getTopicWeights();
    topicPrompts = getTopicPrompts();
    topicCountByRarity = getTopicCountByRarity();
    legendaryCustomTopicCount = getLegendaryCustomTopicCount();
    memoryConfig = getMemoryConfig();
    visualsConfig = getVisualConfig();
  });

  // ── Derived: topic keys sorted by weight ──
  let topicKeys = $derived.by(() => {
    return Object.keys(topicWeights).sort((a, b) => (topicWeights[b] ?? 0) - (topicWeights[a] ?? 0));
  });

  // ── Add topic ──
  let showAddForm = $state(false);
  let newTopicKey = $state('');
  let newTopicLabel = $state('');
  let newTopicPrompt = $state('');

  function addTopic() {
    const key = newTopicKey.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!key || key in topicWeights) return;

    topicWeights[key] = 5;
    topicPrompts[key] = newTopicPrompt.trim();
    showAddForm = false;
    newTopicKey = '';
    newTopicLabel = '';
    newTopicPrompt = '';
  }

  function removeTopic(key: string) {
    delete topicWeights[key];
    delete topicPrompts[key];
    topicWeights = { ...topicWeights };
    topicPrompts = { ...topicPrompts };
  }

  function getTopicLabel(key: string): string {
    return TOPIC_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── Save ──
  async function save() {
    saving = true;
    try {
      const commentary = {
        ...getCommentary(),
        topicWeights: { ...topicWeights },
        topicPrompts: { ...topicPrompts },
        memory: { ...memoryConfig },
        visuals: { ...visualsConfig },
      };
      // Remove old keys
      delete (commentary as Record<string, unknown>).blockWeights;
      delete (commentary as Record<string, unknown>).blockPrompts;
      // Remove legacy topicAffinities if present
      delete (commentary as Record<string, unknown>).topicAffinities;

      const updated = {
        ...config,
        commentary,
        topicCountByRarity: structuredClone(topicCountByRarity),
        legendaryCustomTopicCount,
      };
      await onsave(updated);
    } finally {
      saving = false;
    }
  }

  // ── Simulator ──
  let selectedCharacterId: string = $state('');
  let partyMemberIds: string[] = $state([]);
  let simTurnCount: number = $state(20);
  let simTurns: { turn: number; topicKey: string; label: string; prompt: string; participants?: string[] }[] = $state([]);
  let simDistribution: { key: string; label: string; count: number }[] = $state([]);

  let selectedCharacter = $derived(characters.find(c => c.id === selectedCharacterId));
  let partyMembers = $derived(characters.filter(c => partyMemberIds.includes(c.id)));

  // Characters available to add as party members (not self, not already in party)
  let availablePartyMembers = $derived(
    characters.filter(c => c.id !== selectedCharacterId && !partyMemberIds.includes(c.id))
  );

  function addPartyMember(id: string) {
    if (partyMemberIds.length < 2 && id) {
      partyMemberIds = [...partyMemberIds, id];
    }
  }

  function removePartyMember(id: string) {
    partyMemberIds = partyMemberIds.filter(m => m !== id);
  }

  function simulate() {
    if (!selectedCharacter) return;

    const assignments = selectedCharacter.topic_assignments ?? {};
    const customTopics = selectedCharacter.custom_topics ?? [];
    const partySize = 1 + partyMemberIds.length;

    // Build eligible weights
    const eligible: { key: string; weight: number; prompt: string }[] = [];
    for (const [key, weight] of Object.entries(assignments)) {
      // Multi-char topics need 2+ party members
      if (MULTI_CHAR_TOPICS.has(key) && partySize < 2) continue;
      eligible.push({ key, weight, prompt: topicPrompts[key] ?? '' });
    }
    // Add custom topics
    for (const ct of customTopics) {
      eligible.push({ key: ct.key, weight: ct.weight, prompt: ct.prompt });
    }

    if (eligible.length === 0) {
      simTurns = [];
      simDistribution = [];
      return;
    }

    const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
    const turns: typeof simTurns = [];
    const counts: Record<string, number> = {};

    // All party member names for multi-char topics
    const allPartyNames = [
      selectedCharacter.name,
      ...partyMembers.map(c => c.name),
    ];

    for (let i = 0; i < simTurnCount; i++) {
      let roll = Math.random() * totalWeight;
      let picked = eligible[0];
      for (const entry of eligible) {
        roll -= entry.weight;
        if (roll <= 0) { picked = entry; break; }
      }

      const label = getTopicLabel(picked.key);
      counts[picked.key] = (counts[picked.key] ?? 0) + 1;

      const turn: typeof simTurns[0] = {
        turn: i + 1,
        topicKey: picked.key,
        label,
        prompt: picked.prompt,
      };

      // For multi-char topics, pick a random partner
      if (MULTI_CHAR_TOPICS.has(picked.key) && allPartyNames.length >= 2) {
        const partner = allPartyNames.filter(n => n !== selectedCharacter.name);
        turn.participants = [selectedCharacter.name, partner[Math.floor(Math.random() * partner.length)]];
      }

      turns.push(turn);
    }

    simTurns = turns;
    simDistribution = Object.entries(counts)
      .map(([key, count]) => ({ key, label: getTopicLabel(key), count }))
      .sort((a, b) => b.count - a.count);
  }

  function rarityClass(rarity: string): string {
    return `rarity-${rarity}`;
  }
</script>

<div class="topics-panel" data-testid="topics-panel">
  <!-- A. Global Topic Pool -->
  <Card>
    <div class="section-header">
      <h3>Global Topic Pool</h3>
      <p class="section-desc">Define available commentary topics and their prompts. Weights are used as selection probability when assigning topics to new characters.</p>
    </div>

    <div class="topic-table">
      <div class="topic-table-header">
        <span class="col-name">Topic</span>
        <span class="col-prompt">Prompt</span>
        <span class="col-actions">Actions</span>
      </div>

      {#each topicKeys as key (key)}
        <div class="topic-row" data-testid="topic-row-{key}">
          <div class="col-name">
            <span class="topic-name">{getTopicLabel(key)}</span>
            <span class="topic-key">{key}</span>
          </div>
          <div class="col-prompt">
            <TextArea
              bind:value={topicPrompts[key]}
              rows={2}
            />
          </div>
          <div class="col-actions">
            <button
              class="action-btn destructive"
              onclick={() => removeTopic(key)}
              title="Remove topic"
            >Remove</button>
          </div>
        </div>
      {/each}
    </div>

    <!-- Add Topic -->
    {#if showAddForm}
      <div class="add-topic-form">
        <div class="add-form-row">
          <TextInput label="Key" bind:value={newTopicKey} placeholder="e.g. conspiracy_theory" />
          <TextInput label="Label" bind:value={newTopicLabel} placeholder="e.g. Conspiracy Theory" />
        </div>
        <TextArea label="Prompt" bind:value={newTopicPrompt} rows={2} placeholder="Instruction for the LLM when this topic is selected" />
        <div class="add-form-actions">
          <Button onclick={addTopic} variant="primary">Add Topic</Button>
          <Button onclick={() => { showAddForm = false; }} variant="secondary">Cancel</Button>
        </div>
      </div>
    {:else}
      <div class="add-topic-bar">
        <Button onclick={() => { showAddForm = true; }} variant="secondary">+ Add Topic</Button>
      </div>
    {/if}
  </Card>

  <!-- B. Rarity Topic Counts -->
  <Card>
    <div class="section-header">
      <h3>Rarity Topic Counts</h3>
      <p class="section-desc">How many topics each character gets based on their rarity tier. Higher rarity = more diverse commentary.</p>
    </div>

    <div class="rarity-grid">
      {#each ['common', 'rare', 'epic', 'legendary'] as rarity}
        <div class="rarity-row" data-testid="rarity-count-{rarity}">
          <span class="rarity-label rarity-{rarity}">{rarity}</span>
          <div class="rarity-inputs">
            <NumberInput
              label="Min"
              value={topicCountByRarity[rarity]?.min ?? 3}
              min={1}
              max={20}
              onchange={(e) => {
                if (!topicCountByRarity[rarity]) topicCountByRarity[rarity] = { min: 3, max: 4 };
                topicCountByRarity[rarity].min = Number(e.currentTarget.value);
                topicCountByRarity = { ...topicCountByRarity };
              }}
            />
            <NumberInput
              label="Max"
              value={topicCountByRarity[rarity]?.max ?? 4}
              min={1}
              max={20}
              onchange={(e) => {
                if (!topicCountByRarity[rarity]) topicCountByRarity[rarity] = { min: 3, max: 4 };
                topicCountByRarity[rarity].max = Number(e.currentTarget.value);
                topicCountByRarity = { ...topicCountByRarity };
              }}
            />
          </div>
        </div>
      {/each}

      <div class="rarity-row" data-testid="legendary-custom-count">
        <span class="rarity-label rarity-legendary">Legendary Custom Topics</span>
        <div class="rarity-inputs">
          <NumberInput
            label="Count"
            bind:value={legendaryCustomTopicCount}
            min={0}
            max={5}
          />
        </div>
      </div>
    </div>
  </Card>

  <!-- C. Character Memory -->
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
          onchange={(e) => { memoryConfig.extractionIntervalMinutes = Number(e.currentTarget.value); }}
          testid="memory-interval"
        />
      </div>

      <div class="memory-field">
        <label>Max Memories Per Character</label>
        <NumberInput
          value={memoryConfig.maxMemoriesPerCharacter}
          min={10}
          max={200}
          onchange={(e) => { memoryConfig.maxMemoriesPerCharacter = Number(e.currentTarget.value); }}
          testid="memory-max"
        />
      </div>

      <div class="memory-field">
        <label>Memories Injected Per Prompt</label>
        <NumberInput
          value={memoryConfig.memoriesPerPrompt}
          min={1}
          max={20}
          onchange={(e) => { memoryConfig.memoriesPerPrompt = Number(e.currentTarget.value); }}
          testid="memory-per-prompt"
        />
      </div>

      <div class="memory-field full-width">
        <label>Extraction Prompt</label>
        <TextArea
          bind:value={memoryConfig.extractionPrompt}
          rows={3}
          testid="memory-extraction-prompt"
        />
      </div>
    </div>
  </Card>

  <!-- D. Visual Annotations -->
  <Card>
    <div class="section-header">
      <h3>Visual Annotations</h3>
      <p class="section-desc">Control how visual overlays appear on the player's screen.</p>
    </div>

    <div class="visuals-grid">
      <div class="visual-field">
        <label>Animation Speed</label>
        <div class="slider-with-labels">
          <span class="slider-hint">Fast</span>
          <SliderInput
            min={0.5}
            max={2.0}
            step={0.1}
            value={visualsConfig.animationSpeed}
            onchange={(e) => { visualsConfig.animationSpeed = Number(e.currentTarget.value); }}
          />
          <span class="slider-hint">Slow</span>
        </div>
        <span class="visual-value">{visualsConfig.animationSpeed.toFixed(1)}x</span>
      </div>

      <div class="visual-field">
        <label>Stroke Width</label>
        <div class="slider-with-labels">
          <span class="slider-hint">Thin</span>
          <SliderInput
            min={1}
            max={8}
            step={1}
            value={visualsConfig.strokeWidth}
            onchange={(e) => { visualsConfig.strokeWidth = Number(e.currentTarget.value); }}
          />
          <span class="slider-hint">Thick</span>
        </div>
        <span class="visual-value">{visualsConfig.strokeWidth}px</span>
      </div>

      <label class="toggle-row" data-testid="visual-shadow">
        <input type="checkbox" bind:checked={visualsConfig.dropShadow} />
        <span>Drop Shadow on Annotations</span>
      </label>
    </div>
  </Card>

  <!-- E. Character Simulator -->
  <Card>
    <div class="section-header">
      <h3>Topic Simulator</h3>
      <p class="section-desc">Load a character and simulate turn-by-turn topic selection using their assigned topics.</p>
    </div>

    <!-- Character Selector -->
    <div class="sim-controls">
      <div class="sim-field">
        <label>Character</label>
        {#if loadingData}
          <span class="sim-loading">Loading characters...</span>
        {:else}
          <select
            class="sim-select"
            bind:value={selectedCharacterId}
            data-testid="sim-character-select"
          >
            <option value="">Select a character</option>
            {#each characters as char}
              <option value={char.id}>
                {char.name} [{char.rarity}]
              </option>
            {/each}
          </select>
        {/if}
      </div>

      <!-- Party Builder -->
      {#if selectedCharacter}
        <div class="sim-field">
          <label>Party Members (optional, for banter/hype topics)</label>
          <div class="party-builder">
            {#each partyMembers as member}
              <div class="party-member">
                <span class="party-member-name {rarityClass(member.rarity)}">{member.name}</span>
                <button class="party-remove" onclick={() => removePartyMember(member.id)}>x</button>
              </div>
            {/each}
            {#if partyMemberIds.length < 2}
              <select
                class="sim-select party-add-select"
                onchange={(e) => { addPartyMember(e.currentTarget.value); e.currentTarget.value = ''; }}
                data-testid="sim-party-select"
              >
                <option value="">+ Add member</option>
                {#each availablePartyMembers as char}
                  <option value={char.id}>{char.name} [{char.rarity}]</option>
                {/each}
              </select>
            {/if}
          </div>
        </div>

        <!-- Character's assigned topics summary -->
        <div class="sim-topic-summary">
          <label>Assigned Topics</label>
          <div class="topic-chips">
            {#each Object.entries(selectedCharacter.topic_assignments ?? {}).sort((a, b) => b[1] - a[1]) as [key, weight]}
              <span class="topic-chip">{getTopicLabel(key)} <span class="chip-weight">{weight}</span></span>
            {/each}
            {#each selectedCharacter.custom_topics ?? [] as ct}
              <span class="topic-chip custom">{ct.label} <span class="chip-weight">{ct.weight}</span></span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Simulate -->
      <div class="sim-actions">
        <div class="sim-turn-count">
          <NumberInput
            label="Turns"
            bind:value={simTurnCount}
            min={1}
            max={100}
          />
        </div>
        <Button
          onclick={simulate}
          disabled={!selectedCharacter}
          variant="primary"
          testid="simulate-btn"
        >Simulate</Button>
      </div>
    </div>

    <!-- Turn-by-turn log -->
    {#if simTurns.length > 0}
      <div class="sim-turn-log" data-testid="sim-turn-log">
        {#each simTurns as turn}
          <div class="sim-turn-row">
            <span class="turn-num">Turn {turn.turn}</span>
            <span class="turn-label">[{turn.label}]</span>
            {#if turn.topicKey === 'silence'}
              <span class="turn-prompt silence-text">(silence)</span>
            {:else if turn.participants}
              <span class="turn-prompt">(with {turn.participants[1]}) "{turn.prompt}"</span>
            {:else if turn.prompt}
              <span class="turn-prompt">"{turn.prompt}"</span>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Distribution summary -->
      <div class="sim-distribution">
        <h4>Distribution</h4>
        {#each simDistribution as item}
          <div class="sim-dist-row">
            <span class="sim-dist-label">{item.label}</span>
            <div class="sim-dist-track">
              <div class="sim-dist-fill" style="width: {(item.count / simTurnCount) * 100}%"></div>
            </div>
            <span class="sim-dist-count">{item.count}</span>
          </div>
        {/each}
      </div>
    {/if}
  </Card>

  <!-- Save -->
  <div class="save-bar">
    <Button onclick={save} disabled={saving} variant="primary" testid="save-topics">
      {saving ? 'Saving...' : 'Save Topic Config'}
    </Button>
  </div>
</div>

<style>
  .topics-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .section-header {
    margin-bottom: var(--space-4);
  }
  .section-header h3 {
    margin: 0 0 var(--space-1);
    font-size: var(--font-xl);
    font-weight: 700;
    font-family: var(--font-brand);
    color: var(--color-heading);
    letter-spacing: -0.01em;
  }
  .section-desc {
    margin: 0;
    font-size: var(--font-base);
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  /* ── Topic Table ── */
  .topic-table {
    display: flex;
    flex-direction: column;
  }

  .topic-table-header {
    display: grid;
    grid-template-columns: 180px 1fr 80px;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border);
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .topic-row {
    display: grid;
    grid-template-columns: 180px 1fr 80px;
    gap: var(--space-3);
    align-items: start;
    padding: var(--space-2-5) var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  .topic-name {
    font-size: var(--font-base);
    color: var(--color-text-primary);
    font-weight: 500;
  }
  .topic-key {
    display: block;
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    font-family: monospace;
    margin-top: var(--space-0-5);
  }

  .col-prompt :global(.field) {
    gap: 0;
  }

  .col-actions {
    display: flex;
    align-items: start;
    padding-top: var(--space-1);
  }

  .action-btn {
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-xs);
    font-weight: 600;
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--transition-fast);
  }
  .action-btn:hover {
    background: var(--white-a8);
  }
  .action-btn.destructive {
    color: var(--color-error-soft);
    border-color: var(--error-a20);
  }
  .action-btn.destructive:hover {
    background: var(--error-a12);
  }

  /* ── Add Topic Form ── */
  .add-topic-bar {
    margin-top: var(--space-3);
  }

  .add-topic-form {
    margin-top: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--navy-a30);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .add-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .add-form-actions {
    display: flex;
    gap: var(--space-2);
  }

  /* ── Rarity Grid ── */
  .rarity-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .rarity-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .rarity-label {
    min-width: 180px;
    font-size: var(--font-base);
    font-weight: 600;
    text-transform: capitalize;
  }
  .rarity-label.rarity-common { color: var(--rarity-common); }
  .rarity-label.rarity-rare { color: var(--rarity-rare); }
  .rarity-label.rarity-epic { color: var(--rarity-epic); }
  .rarity-label.rarity-legendary { color: var(--rarity-legendary); }

  .rarity-inputs {
    display: flex;
    gap: var(--space-3);
    align-items: flex-end;
  }

  .rarity-inputs :global(.field-input) {
    width: 70px;
  }

  /* ── Memory ── */
  .memory-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }
  .memory-field label {
    display: block;
    margin-bottom: var(--space-1);
    font-size: var(--font-base);
    color: var(--color-text-primary);
  }
  .full-width {
    grid-column: 1 / -1;
  }
  .toggle-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    grid-column: 1 / -1;
    font-size: var(--font-base);
    color: var(--color-text-primary);
    cursor: pointer;
  }
  .toggle-row input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--color-accent);
  }

  /* ── Visuals ── */
  .visuals-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .visual-field label {
    display: block;
    margin-bottom: var(--space-1);
    font-size: var(--font-base);
    color: var(--color-text-primary);
  }
  .slider-with-labels {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .slider-hint {
    font-size: var(--font-base);
    color: var(--color-text-secondary);
    flex-shrink: 0;
    width: 32px;
  }
  .visual-value {
    font-size: var(--font-base);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
    text-align: center;
    display: block;
    margin-top: var(--space-1);
  }

  /* ── Simulator ── */
  .sim-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .sim-field label {
    display: block;
    margin-bottom: var(--space-1);
    font-size: var(--font-base);
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .sim-loading {
    font-size: var(--font-base);
    color: var(--color-text-secondary);
  }

  .sim-select {
    width: 100%;
    max-width: 400px;
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-base);
    font-family: inherit;
  }
  .sim-select:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .party-builder {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  .party-member {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }

  .party-member-name {
    font-size: var(--font-base);
    font-weight: 500;
  }
  .party-member-name.rarity-common { color: var(--rarity-common); }
  .party-member-name.rarity-rare { color: var(--rarity-rare); }
  .party-member-name.rarity-epic { color: var(--rarity-epic); }
  .party-member-name.rarity-legendary { color: var(--rarity-legendary); }

  .party-remove {
    background: none;
    border: none;
    color: var(--color-error-soft);
    cursor: pointer;
    font-size: var(--font-base);
    padding: 0 var(--space-0-5);
    font-weight: 700;
  }

  .party-add-select {
    max-width: 200px;
  }

  .sim-topic-summary {
    padding: var(--space-3);
    background: var(--navy-a30);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .sim-topic-summary label {
    display: block;
    margin-bottom: var(--space-2);
    font-size: var(--font-base);
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .topic-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1-5);
  }

  .topic-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-0-5) var(--space-2);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-base);
    color: var(--color-text-primary);
  }
  .topic-chip.custom {
    border-color: var(--rarity-legendary);
    color: var(--rarity-legendary);
  }

  .chip-weight {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .sim-actions {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
  }

  .sim-turn-count :global(.field-input) {
    width: 70px;
  }

  /* ── Turn Log ── */
  .sim-turn-log {
    margin-top: var(--space-4);
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--navy-a30);
    font-family: monospace;
    font-size: var(--font-base);
  }

  .sim-turn-row {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-1-5) var(--space-3);
    border-bottom: 1px solid var(--color-border);
    align-items: baseline;
  }
  .sim-turn-row:last-child {
    border-bottom: none;
  }

  .turn-num {
    color: var(--color-text-muted);
    flex-shrink: 0;
    min-width: 60px;
  }

  .turn-label {
    color: var(--color-teal);
    font-weight: 600;
    flex-shrink: 0;
    min-width: 140px;
  }

  .turn-prompt {
    color: var(--color-text-primary);
    font-family: inherit;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .silence-text {
    color: var(--color-text-muted);
    font-style: italic;
  }

  /* ── Distribution ── */
  .sim-distribution {
    margin-top: var(--space-4);
  }
  .sim-distribution h4 {
    margin: 0 0 var(--space-2);
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-heading);
  }

  .sim-dist-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-1-5);
  }
  .sim-dist-label {
    width: 140px;
    font-size: var(--font-base);
    color: var(--color-text-primary);
    flex-shrink: 0;
  }
  .sim-dist-track {
    flex: 1;
    height: 16px;
    background: var(--color-surface-raised);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .sim-dist-fill {
    height: 100%;
    background: var(--color-accent);
    border-radius: var(--radius-sm);
    transition: width var(--transition-slow) ease;
  }
  .sim-dist-count {
    width: 28px;
    text-align: right;
    font-size: var(--font-base);
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
  }

  /* ── Save Bar ── */
  .save-bar {
    display: flex;
    justify-content: flex-end;
  }
</style>
