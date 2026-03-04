<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import NumberInput from '$lib/components/ui/NumberInput.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  interface Props {
    config: Record<string, unknown>;
    loading: boolean;
    onsave: (config: Record<string, unknown>) => Promise<void>;
  }

  let { config, loading, onsave }: Props = $props();

  // ─── Local state from config ─────────────────────────────────────
  let packsPerDay = $state(3);
  let cardsPerPack = $state(3);
  let dropRates = $state({ common: 0.6, rare: 0.25, epic: 0.12, legendary: 0.03 });
  let saving = $state(false);

  const rarities = ['common', 'rare', 'epic', 'legendary'] as const;

  const dropRateSum = $derived(
    Math.round((dropRates.common + dropRates.rare + dropRates.epic + dropRates.legendary) * 100) / 100
  );

  // ─── Sync from parent config ─────────────────────────────────────
  function syncFromConfig() {
    const dr = config.dropRates as Record<string, number> | undefined;
    if (dr) dropRates = { common: dr.common ?? 0.6, rare: dr.rare ?? 0.25, epic: dr.epic ?? 0.12, legendary: dr.legendary ?? 0.03 };
    packsPerDay = (config.packsPerDay as number) ?? 3;
    cardsPerPack = (config.cardsPerPack as number) ?? 3;
  }

  function syncToConfig() {
    config = {
      ...config,
      dropRates: { ...dropRates },
      packsPerDay,
      cardsPerPack,
    };
  }

  // Sync when config changes
  let lastConfigRef: Record<string, unknown> | null = null;
  $effect(() => {
    if (config !== lastConfigRef) {
      lastConfigRef = config;
      syncFromConfig();
    }
  });

  async function saveConfig() {
    saving = true;
    try {
      syncToConfig();
      await onsave(config);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      saving = false;
    }
  }
</script>

{#if loading}
  <p class="muted">Loading config...</p>
{:else}
  <div class="cfg" data-testid="economy-panel">
    <div class="cfg-row-2col">
      <div class="cfg-card">
        <div class="cfg-header">
          <h3 class="cfg-title">Pack Limits</h3>
          <p class="cfg-desc">How many packs users can open and how many cards they contain</p>
        </div>
        <div class="cfg-body">
          <NumberInput label="Packs / Day" bind:value={packsPerDay} min={1} max={99} onchange={syncToConfig} testid="config-packs-per-day" />
          <NumberInput label="Cards / Pack" bind:value={cardsPerPack} min={1} max={10} onchange={syncToConfig} testid="config-cards-per-pack" />
        </div>
      </div>
      <div class="cfg-card">
        <div class="cfg-header">
          <div class="cfg-header-row">
            <div>
              <h3 class="cfg-title">Drop Rates</h3>
              <p class="cfg-desc">Probability of each rarity tier when opening packs</p>
            </div>
            <Badge variant={dropRateSum === 1 ? 'success' : 'warning'} text="Sum: {dropRateSum}" testid="drop-rate-sum" />
          </div>
        </div>
        <div class="cfg-body">
          {#each rarities as tier}
            <div class="drop-rate-row">
              <span class="rarity-label rarity-{tier}">{tier}</span>
              <input
                type="range"
                class="drop-slider"
                bind:value={dropRates[tier]}
                min={0}
                max={1}
                step={0.01}
                oninput={syncToConfig}
                data-testid="config-drop-rate-{tier}"
              />
              <span class="drop-value">{(dropRates[tier]).toFixed(2)}%</span>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <div class="cfg-save">
      <Button variant="primary" loading={saving} onclick={saveConfig} testid="save-config-btn">
        {saving ? 'Saving...' : 'Save Config'}
      </Button>
    </div>
  </div>
{/if}

<style>
  .muted { color: var(--color-text-muted); }

  .cfg {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .cfg-row-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-5);
  }

  .cfg-card {
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--panel-shadow);
  }

  .cfg-header {
    padding: var(--space-5) var(--space-6) 0;
  }

  .cfg-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .cfg-title {
    font-size: var(--font-xl);
    font-weight: 700;
    font-family: var(--font-brand);
    color: var(--color-heading);
    letter-spacing: -0.01em;
    margin: 0 0 var(--space-1);
  }

  .cfg-desc {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.4;
  }

  .cfg-body {
    padding: var(--space-4) var(--space-6) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-3-5);
  }

  .drop-rate-row {
    display: flex;
    align-items: center;
    gap: var(--space-3-5);
    height: 36px;
  }

  .rarity-label {
    font-weight: 600;
    font-size: var(--font-base);
    text-transform: capitalize;
    min-width: 90px;
  }

  .rarity-label.rarity-common { color: var(--rarity-common); }
  .rarity-label.rarity-rare { color: var(--rarity-rare); }
  .rarity-label.rarity-epic { color: var(--rarity-epic); }
  .rarity-label.rarity-legendary { color: var(--rarity-legendary); }

  .drop-slider {
    flex: 1;
    max-width: 280px;
    cursor: pointer;
  }

  .drop-value {
    font-size: var(--font-base);
    color: var(--color-text-muted);
    min-width: 52px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .cfg-save {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  @media (max-width: 800px) {
    .cfg-row-2col { grid-template-columns: 1fr; }
  }
</style>
