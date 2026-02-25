<script lang="ts">
  import { getGachaConfig, updateGachaConfig, generateTestCharacter } from '@glazebot/supabase-client';
  import { CharacterCard } from '@glazebot/shared-ui';
  import type { GachaCharacter, CharacterRarity } from '@glazebot/shared-types';

  let config: Record<string, unknown> = $state({});
  let rawJson: string = $state('');
  let loading: boolean = $state(true);
  let saving: boolean = $state(false);
  let saveMsg: string = $state('');
  let jsonError: string = $state('');

  // Test generation
  let testRarity: CharacterRarity = $state('common');
  let testLoading: boolean = $state(false);
  let testResult: string = $state('');
  let testCharacter: GachaCharacter | null = $state(null);

  // Inline editor fields
  let dropRates = $state({ common: 0.6, rare: 0.25, epic: 0.12, legendary: 0.03 });
  let baseTemperature = $state(0.9);
  let model = $state('qwen-plus');
  let packsPerDay = $state(3);
  let cardsPerPack = $state(3);

  // Expandable sections
  let showPrompt = $state(false);
  let showGuidance = $state(false);

  $effect(() => {
    loadConfig();
  });

  async function loadConfig() {
    loading = true;
    try {
      const row = await getGachaConfig();
      config = (row?.config as Record<string, unknown>) ?? {};
      rawJson = JSON.stringify(config, null, 2);
      syncFromConfig();
    } catch {
      // Default
    } finally {
      loading = false;
    }
  }

  function syncFromConfig() {
    const dr = config.dropRates as Record<string, number> | undefined;
    if (dr) dropRates = { common: dr.common ?? 0.6, rare: dr.rare ?? 0.25, epic: dr.epic ?? 0.12, legendary: dr.legendary ?? 0.03 };
    baseTemperature = (config.baseTemperature as number) ?? 0.9;
    model = (config.model as string) ?? 'qwen-plus';
    packsPerDay = (config.packsPerDay as number) ?? 3;
    cardsPerPack = (config.cardsPerPack as number) ?? 3;
  }

  function syncToConfig() {
    config = {
      ...config,
      dropRates: { ...dropRates },
      baseTemperature,
      model,
      packsPerDay,
      cardsPerPack,
    };
    rawJson = JSON.stringify(config, null, 2);
  }

  function onJsonEdit() {
    jsonError = '';
    try {
      config = JSON.parse(rawJson);
      syncFromConfig();
    } catch (e) {
      jsonError = e instanceof Error ? e.message : 'Invalid JSON';
    }
  }

  async function saveConfig() {
    saving = true;
    saveMsg = '';
    try {
      syncToConfig();
      await updateGachaConfig(config);
      saveMsg = 'Saved!';
      setTimeout(() => saveMsg = '', 2000);
    } catch (e) {
      saveMsg = e instanceof Error ? e.message : 'Save failed';
    } finally {
      saving = false;
    }
  }

  async function resetDefaults() {
    const defaults = {
      packsPerDay: 3,
      cardsPerPack: 3,
      dropRates: { common: 0.60, rare: 0.25, epic: 0.12, legendary: 0.03 },
      traitRanges: {
        common: { min: 25, max: 75 },
        rare: { min: 15, max: 85 },
        epic: { min: 5, max: 95 },
        legendary: { min: 0, max: 100 },
      },
      promptQuality: {
        common: { maxTokens: 800, tempBoost: 0.0 },
        rare: { maxTokens: 1000, tempBoost: 0.1 },
        epic: { maxTokens: 1200, tempBoost: 0.15 },
        legendary: { maxTokens: 1600, tempBoost: 0.2 },
      },
      generationPrompt: config.generationPrompt ?? '',
      rarityGuidance: config.rarityGuidance ?? {},
      baseTemperature: 0.9,
      model: 'qwen-plus',
    };
    config = defaults;
    rawJson = JSON.stringify(config, null, 2);
    syncFromConfig();
  }

  async function testGenerate() {
    testLoading = true;
    testResult = '';
    testCharacter = null;
    try {
      const character = await generateTestCharacter(testRarity);
      testResult = JSON.stringify(character, null, 2);
      testCharacter = character;
    } catch (e) {
      testResult = e instanceof Error ? e.message : 'Failed';
    } finally {
      testLoading = false;
    }
  }

  const dropRateSum = $derived(
    Math.round((dropRates.common + dropRates.rare + dropRates.epic + dropRates.legendary) * 100) / 100
  );
</script>

<div class="settings-page" data-testid="settings-page">
  <h1>Gacha Admin</h1>

  {#if loading}
    <p class="muted">Loading config...</p>
  {:else}
    <section class="section">
      <h2>Quick Settings</h2>
      <div class="form-grid">
        <label>
          <span>Packs/Day</span>
          <input type="number" bind:value={packsPerDay} min="1" max="99" oninput={syncToConfig} data-testid="config-packs-per-day" />
        </label>
        <label>
          <span>Cards/Pack</span>
          <input type="number" bind:value={cardsPerPack} min="1" max="10" oninput={syncToConfig} data-testid="config-cards-per-pack" />
        </label>
        <label>
          <span>Temperature</span>
          <input type="range" bind:value={baseTemperature} min="0" max="2" step="0.05" oninput={syncToConfig} data-testid="config-temperature" />
          <span class="range-val">{baseTemperature.toFixed(2)}</span>
        </label>
        <label>
          <span>Model</span>
          <select bind:value={model} onchange={syncToConfig} data-testid="config-model">
            <option value="qwen-plus">qwen-plus</option>
            <option value="qwen-turbo">qwen-turbo</option>
            <option value="qwen-max">qwen-max</option>
            <option value="qwen3-vl-flash">qwen3-vl-flash</option>
          </select>
        </label>
      </div>
    </section>

    <section class="section">
      <h2>Drop Rates <span class="badge" class:warn={dropRateSum !== 1}>Sum: {dropRateSum}</span></h2>
      <div class="form-grid">
        {#each ['common', 'rare', 'epic', 'legendary'] as tier}
          <label>
            <span class="rarity-label rarity-{tier}">{tier}</span>
            <input
              type="range"
              value={dropRates[tier as keyof typeof dropRates]}
              min="0" max="1" step="0.01"
              oninput={(e) => { dropRates[tier as keyof typeof dropRates] = parseFloat((e.target as HTMLInputElement).value); syncToConfig(); }}
              data-testid="config-drop-rate-{tier}"
            />
            <span class="range-val">{(dropRates[tier as keyof typeof dropRates] * 100).toFixed(0)}%</span>
          </label>
        {/each}
      </div>
    </section>

    <section class="section">
      <button class="section-toggle" onclick={() => showPrompt = !showPrompt}>
        <h2>Generation Prompt {showPrompt ? '▾' : '▸'}</h2>
      </button>
      {#if showPrompt}
        <textarea
          class="prompt-editor"
          value={(config.generationPrompt as string) ?? ''}
          oninput={(e) => { config = { ...config, generationPrompt: (e.target as HTMLTextAreaElement).value }; rawJson = JSON.stringify(config, null, 2); }}
          rows="8"
          data-testid="config-generation-prompt"
        ></textarea>
      {/if}
    </section>

    <section class="section">
      <button class="section-toggle" onclick={() => showGuidance = !showGuidance}>
        <h2>Rarity Guidance {showGuidance ? '▾' : '▸'}</h2>
      </button>
      {#if showGuidance}
        {#each ['common', 'rare', 'epic', 'legendary'] as tier}
          <div class="guidance-item">
            <span class="rarity-label rarity-{tier}">{tier}</span>
            <textarea
              value={((config.rarityGuidance as Record<string, string>)?.[tier]) ?? ''}
              oninput={(e) => {
                const rg = { ...(config.rarityGuidance as Record<string, string> ?? {}) };
                rg[tier] = (e.target as HTMLTextAreaElement).value;
                config = { ...config, rarityGuidance: rg };
                rawJson = JSON.stringify(config, null, 2);
              }}
              rows="3"
              data-testid="config-rarity-guidance-{tier}"
            ></textarea>
          </div>
        {/each}
      {/if}
    </section>

    <section class="section">
      <h2>Raw Config JSON</h2>
      <textarea
        class="json-editor"
        bind:value={rawJson}
        oninput={onJsonEdit}
        rows="16"
        spellcheck="false"
        data-testid="config-raw-json"
      ></textarea>
      {#if jsonError}
        <p class="error" data-testid="config-json-error">{jsonError}</p>
      {/if}
    </section>

    <div class="actions">
      <button class="btn-primary" onclick={saveConfig} disabled={saving || !!jsonError} data-testid="save-config-btn">
        {saving ? 'Saving...' : 'Save Config'}
      </button>
      <button class="btn-secondary" onclick={resetDefaults} data-testid="reset-config-btn">Reset to Defaults</button>
      {#if saveMsg}
        <span class="save-msg" class:error={saveMsg !== 'Saved!'} data-testid="save-msg">{saveMsg}</span>
      {/if}
    </div>

    <hr />

    <section class="section">
      <h2>Test Generation</h2>
      <div class="test-controls">
        <select bind:value={testRarity} data-testid="test-rarity-select">
          <option value="common">Common</option>
          <option value="rare">Rare</option>
          <option value="epic">Epic</option>
          <option value="legendary">Legendary</option>
        </select>
        <button class="btn-primary" onclick={testGenerate} disabled={testLoading} data-testid="test-generate-btn">
          {testLoading ? 'Generating...' : 'Generate Test Character'}
        </button>
      </div>

      {#if testResult}
        <pre class="test-output" data-testid="test-output">{testResult}</pre>
      {/if}

      {#if testCharacter}
        <div class="test-preview" data-testid="test-preview">
          <CharacterCard character={testCharacter} flipped={true} />
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .settings-page {
    padding: 24px 24px 48px;
    max-width: 720px;
    margin: 0 auto;
  }

  h1 {
    font-size: 1.8rem;
    color: var(--color-pink);
    margin-bottom: 24px;
  }

  h2 {
    font-size: 1rem;
    color: var(--color-text-primary);
    margin: 0 0 12px;
  }

  .section {
    margin-bottom: 24px;
  }

  .muted { color: var(--color-text-muted); }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  label {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  label span:first-child {
    min-width: 100px;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  input[type="number"], select {
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.85rem;
    width: 120px;
  }

  select option { background: var(--color-navy); }

  input[type="range"] {
    flex: 1;
    max-width: 200px;
  }

  .range-val {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    min-width: 40px;
  }

  .badge {
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(59, 151, 151, 0.2);
    color: var(--color-teal);
  }

  .badge.warn {
    background: rgba(248, 113, 113, 0.2);
    color: #f87171;
  }

  .rarity-label {
    font-weight: 600;
    font-size: 0.8rem;
    text-transform: capitalize;
  }

  .rarity-label.rarity-common { color: var(--rarity-common); }
  .rarity-label.rarity-rare { color: var(--rarity-rare); }
  .rarity-label.rarity-epic { color: var(--rarity-epic); }
  .rarity-label.rarity-legendary { color: var(--rarity-legendary); }

  .section-toggle {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    padding: 0;
    font: inherit;
  }

  textarea, .json-editor, .prompt-editor {
    width: 100%;
    padding: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    color: var(--color-text-primary);
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    resize: vertical;
    outline: none;
  }

  textarea:focus { border-color: var(--color-teal); }

  .guidance-item {
    margin-bottom: 8px;
  }

  .guidance-item textarea { margin-top: 4px; }

  .error { color: #f87171; font-size: 0.8rem; margin-top: 4px; }

  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 24px;
  }

  .btn-primary {
    padding: 8px 20px;
    border: none;
    border-radius: 8px;
    background: var(--color-teal);
    color: white;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
  }

  .btn-primary:hover:not(:disabled) { background: #4ab0b0; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    padding: 8px 20px;
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    background: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
  }

  .btn-secondary:hover { color: var(--color-text-primary); }

  .save-msg {
    font-size: 0.85rem;
    color: var(--color-teal);
  }

  .save-msg.error { color: #f87171; }

  hr {
    border: none;
    border-top: 1px solid var(--glass-border);
    margin: 24px 0;
  }

  .test-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }

  .test-output {
    background: rgba(0, 0, 0, 0.3);
    padding: 12px;
    border-radius: 8px;
    font-size: 0.75rem;
    overflow-x: auto;
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 12px;
    color: var(--color-text-secondary);
  }

  .test-preview {
    display: flex;
    justify-content: center;
    padding: 16px;
  }
</style>
