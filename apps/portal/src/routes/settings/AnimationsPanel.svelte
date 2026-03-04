<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import TagFilter from '$lib/components/ui/TagFilter.svelte';
  import TextInput from '$lib/components/ui/TextInput.svelte';
  import NumberInput from '$lib/components/ui/NumberInput.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { SliderInput, ToggleSwitch, CharacterCard } from '@glazebot/shared-ui';
  import {
    ANIMATION_VERB_LIBRARY,
    SEED_ANIMATION_PRESETS,
    EASING_CURVES,
    applyAnimationPreset,
    type AnimationPreset,
    type AnimationsConfig,
  } from '@glazebot/shared-types';
  import type { GachaCharacter } from '@glazebot/shared-types';

  interface Props {
    config: Record<string, unknown>;
    onsave: (config: Record<string, unknown>) => Promise<void>;
  }

  let { config, onsave }: Props = $props();

  // ── Mock character for preview ──
  const MOCK_CHARACTER: GachaCharacter = {
    id: 'preview-mock',
    user_id: 'preview',
    name: 'Animation Preview',
    description: 'A character for previewing animations',
    system_prompt: '',
    backstory: 'Born to be animated.',
    rarity: 'epic',
    avatar_seed: 'animation-preview',
    is_active: true,
    is_default: false,
    created_at: new Date().toISOString(),
    personality: { energy: 80, positivity: 70, formality: 30, talkativeness: 60, attitude: 50, humor: 90 },
  };

  // ── Extract from config ──
  function getPresets(): Record<string, AnimationPreset> {
    const animCfg = config.animations as AnimationsConfig | undefined;
    return structuredClone(animCfg?.presets ?? {});
  }

  // ── State ──
  let presets: Record<string, AnimationPreset> = $state(getPresets());
  let activeVerbFilters: string[] = $state([]);
  let selectedPresetId: string | null = $state(null);
  let saving = $state(false);
  let previewEl: HTMLDivElement | undefined = $state(undefined);
  let currentAnimation: Animation | null = $state(null);
  let seedPresetToAdd = $state('');
  let pendingDeleteId: string | null = $state(null);

  // ── Derived ──
  let filteredPresetIds = $derived.by(() => {
    const ids = Object.keys(presets);
    if (activeVerbFilters.length === 0) return ids;
    return ids.filter((id) => activeVerbFilters.includes(presets[id].verb));
  });

  let selectedPreset = $derived(selectedPresetId ? presets[selectedPresetId] ?? null : null);

  let verbTags = $derived(
    ANIMATION_VERB_LIBRARY.map((v) => ({ key: v.key, label: `${v.icon} ${v.label}` }))
  );

  let seedOptions = $derived(
    SEED_ANIMATION_PRESETS.map((s) => ({ value: s.id, label: `${s.name} (${s.verb})` }))
  );

  let easingOptions = $derived([
    ...Object.keys(EASING_CURVES).map((k) => ({ value: k, label: k })),
    { value: 'custom', label: 'Custom' },
  ]);

  const directionOptions = [
    { value: 'normal', label: 'Normal' },
    { value: 'reverse', label: 'Reverse' },
    { value: 'alternate', label: 'Alternate' },
    { value: 'alternate-reverse', label: 'Alternate Reverse' },
  ];

  const fillModeOptions = [
    { value: 'none', label: 'None' },
    { value: 'forwards', label: 'Forwards' },
    { value: 'backwards', label: 'Backwards' },
    { value: 'both', label: 'Both' },
  ];

  const PROPERTY_SUGGESTIONS = [
    { value: 'transform', label: 'transform' },
    { value: 'opacity', label: 'opacity' },
    { value: 'filter', label: 'filter' },
    { value: 'scale', label: 'scale' },
    { value: 'rotate', label: 'rotate' },
    { value: 'translate', label: 'translate' },
    { value: 'color', label: 'color' },
    { value: 'background-color', label: 'background-color' },
    { value: 'box-shadow', label: 'box-shadow' },
  ];

  // ── Actions ──
  function addFromTemplate() {
    const seed = SEED_ANIMATION_PRESETS.find((s) => s.id === seedPresetToAdd);
    if (!seed) return;
    let id = seed.id;
    let counter = 1;
    while (presets[id]) {
      id = `${seed.id}-${counter++}`;
    }
    const clone: AnimationPreset = structuredClone({ ...seed, id });
    if (id !== seed.id) clone.name = `${seed.name} ${counter - 1}`;
    presets[id] = clone;
    presets = { ...presets };
    selectedPresetId = id;
    seedPresetToAdd = '';
  }

  function removePreset(id: string) {
    delete presets[id];
    presets = { ...presets };
    if (selectedPresetId === id) selectedPresetId = null;
    pendingDeleteId = null;
  }

  function addKeyframe() {
    if (!selectedPreset) return;
    const existing = selectedPreset.keyframes;
    const lastOffset = existing.length > 0 ? existing[existing.length - 1].offset : 0;
    const newOffset = Math.min(lastOffset + 0.25, 1);
    selectedPreset.keyframes = [
      ...existing,
      { offset: newOffset, properties: { transform: 'none' } },
    ];
    presets = { ...presets };
  }

  function removeKeyframe(kfIndex: number) {
    if (!selectedPreset) return;
    selectedPreset.keyframes = selectedPreset.keyframes.filter((_, i) => i !== kfIndex);
    presets = { ...presets };
  }

  function addPropertyToKeyframe(kfIndex: number) {
    if (!selectedPreset) return;
    selectedPreset.keyframes[kfIndex].properties['opacity'] = '1';
    presets = { ...presets };
  }

  function removeProperty(kfIndex: number, propKey: string) {
    if (!selectedPreset) return;
    const props = selectedPreset.keyframes[kfIndex].properties;
    delete props[propKey];
    selectedPreset.keyframes[kfIndex].properties = { ...props };
    presets = { ...presets };
  }

  function playPreview() {
    if (!previewEl || !selectedPreset) return;
    currentAnimation?.cancel();
    currentAnimation = applyAnimationPreset(previewEl, selectedPreset);
  }

  function resetPreview() {
    currentAnimation?.cancel();
    currentAnimation = null;
  }

  // ── Save ──
  async function save() {
    saving = true;
    try {
      const updated = { ...config, animations: { presets: structuredClone(presets) } };
      await onsave(updated);
    } finally {
      saving = false;
    }
  }
</script>

<div class="animations-panel" data-testid="animations-panel">
  <div class="panel-layout">
    <!-- ═══ Left: Controls ═══ -->
    <div class="controls-col">

      <!-- Preset Library -->
      <Card>
        <div class="section-header">
          <h3>Animation Presets</h3>
          <p class="section-desc">Add presets from templates, then click one to edit its keyframes and timing.</p>
        </div>

        <!-- Verb filter -->
        <div class="verb-filter">
          <TagFilter
            tags={verbTags}
            active={activeVerbFilters}
            onchange={(v) => activeVerbFilters = v}
          />
        </div>

        <!-- Add from template -->
        <div class="add-preset-row">
          <Select
            label="Template"
            bind:value={seedPresetToAdd}
            options={seedOptions}
            testid="seed-preset-select"
          />
          <Button onclick={addFromTemplate} disabled={!seedPresetToAdd} variant="primary" testid="add-preset-btn">Add</Button>
        </div>

        <!-- Preset list -->
        <div class="preset-list">
          {#each filteredPresetIds as id (id)}
            {@const preset = presets[id]}
            <button
              class="preset-item"
              class:selected={selectedPresetId === id}
              onclick={() => selectedPresetId = id}
              data-testid="preset-row-{id}"
            >
              <div class="preset-info">
                <span class="preset-name">{preset.name}</span>
                <span class="preset-meta"><span class="verb-tag">{preset.verb}</span> {preset.duration}ms</span>
              </div>
              <div class="preset-item-actions">
                {#if pendingDeleteId === id}
                  <button class="action-btn destructive" onclick={(e: Event) => { e.stopPropagation(); removePreset(id); }}>Confirm</button>
                  <button class="action-btn" onclick={(e: Event) => { e.stopPropagation(); pendingDeleteId = null; }}>Cancel</button>
                {:else}
                  <button class="action-btn destructive" onclick={(e: Event) => { e.stopPropagation(); pendingDeleteId = id; }} title="Remove preset">x</button>
                {/if}
              </div>
            </button>
          {/each}

          {#if filteredPresetIds.length === 0}
            <p class="empty-msg">No presets yet. Pick a template above and click Add.</p>
          {/if}
        </div>
      </Card>

      <!-- Keyframe Editor (shown when a preset is selected) -->
      {#if selectedPreset}
        <Card>
          <div class="section-header">
            <h3>Keyframes — {selectedPreset.name}</h3>
            <p class="section-desc">Each keyframe has an offset (0–100%) and one or more CSS properties.</p>
          </div>

          <div class="name-field">
            <TextInput
              label="Preset Name"
              bind:value={selectedPreset.name}
              testid="preset-name-input"
            />
          </div>

          {#each selectedPreset.keyframes as kf, kfIdx (kfIdx)}
            <div class="keyframe-block">
              <div class="keyframe-header">
                <NumberInput
                  label="Offset %"
                  value={Math.round(kf.offset * 100)}
                  min={0}
                  max={100}
                  step={1}
                  onchange={(e: Event) => {
                    kf.offset = Math.max(0, Math.min(1, Number((e.currentTarget as HTMLInputElement).value) / 100));
                    presets = { ...presets };
                  }}
                  testid="kf-offset-{kfIdx}"
                />
                <button class="action-btn destructive" onclick={() => removeKeyframe(kfIdx)}>Remove</button>
              </div>

              {#each Object.entries(kf.properties) as [propKey, propVal], pIdx (propKey)}
                <div class="property-row">
                  <Select
                    label="Property"
                    value={propKey}
                    options={PROPERTY_SUGGESTIONS}
                    onchange={(e: Event) => {
                      const newKey = (e.currentTarget as HTMLSelectElement).value;
                      if (newKey !== propKey) {
                        const value = kf.properties[propKey];
                        delete kf.properties[propKey];
                        kf.properties[newKey] = value;
                        presets = { ...presets };
                      }
                    }}
                    testid="prop-key-{kfIdx}-{pIdx}"
                  />
                  <TextInput
                    label="Value"
                    value={propVal}
                    testid="prop-val-{kfIdx}-{pIdx}"
                  />
                  <button class="action-btn destructive" onclick={() => removeProperty(kfIdx, propKey)}>x</button>
                </div>
              {/each}

              <button class="action-btn" onclick={() => addPropertyToKeyframe(kfIdx)} data-testid="add-prop-{kfIdx}">+ Property</button>
            </div>
          {/each}

          <button class="action-btn" onclick={addKeyframe} data-testid="add-keyframe-btn">+ Keyframe</button>
        </Card>

        <!-- Timing & Easing -->
        <Card>
          <div class="section-header">
            <h3>Timing & Easing</h3>
            <p class="section-desc">Duration, delay, easing curve, and playback direction.</p>
          </div>

          <div class="timing-grid">
            <NumberInput
              label="Duration (ms)"
              bind:value={selectedPreset.duration}
              min={0}
              max={10000}
              step={50}
              testid="duration-input"
            />
            <NumberInput
              label="Delay (ms)"
              bind:value={selectedPreset.delay}
              min={0}
              max={5000}
              step={50}
              testid="delay-input"
            />
          </div>

          <SliderInput
            label="Duration"
            bind:value={selectedPreset.duration}
            min={0}
            max={3000}
            step={10}
            suffix="ms"
            testid="duration-slider"
          />

          <div class="easing-grid">
            <Select
              label="Easing"
              bind:value={selectedPreset.easing}
              options={easingOptions}
              testid="easing-select"
            />
            <Select
              label="Direction"
              bind:value={selectedPreset.direction}
              options={directionOptions}
              testid="direction-select"
            />
            <Select
              label="Fill Mode"
              bind:value={selectedPreset.fillMode}
              options={fillModeOptions}
              testid="fill-select"
            />
          </div>

          {#if selectedPreset.easing === 'custom'}
            <TextInput
              label="Custom Easing"
              bind:value={selectedPreset.customEasing}
              placeholder="cubic-bezier(0.4, 0, 0.2, 1)"
              testid="custom-easing-input"
            />
          {/if}

          <div class="iterations-row">
            {#if selectedPreset.iterations !== 'infinite'}
              <NumberInput
                label="Iterations"
                value={selectedPreset.iterations as number}
                min={1}
                max={100}
                step={1}
                onchange={(e: Event) => {
                  if (selectedPreset) {
                    selectedPreset.iterations = Number((e.currentTarget as HTMLInputElement).value);
                    presets = { ...presets };
                  }
                }}
                testid="iterations-input"
              />
            {/if}
            <ToggleSwitch
              label="Infinite"
              checked={selectedPreset.iterations === 'infinite'}
              onchange={() => {
                if (selectedPreset) {
                  selectedPreset.iterations = selectedPreset.iterations === 'infinite' ? 1 : 'infinite';
                  presets = { ...presets };
                }
              }}
            />
          </div>
        </Card>
      {/if}

      <!-- Save -->
      <div class="save-bar">
        <Button onclick={save} disabled={saving} variant="primary" testid="save-animations">
          {saving ? 'Saving...' : 'Save Animation Presets'}
        </Button>
      </div>
    </div>

    <!-- ═══ Right: Preview (always visible) ═══ -->
    <div class="preview-col">
      <Card>
        <div class="section-header">
          <h3>Preview</h3>
          <p class="section-desc">
            {#if selectedPreset}
              Playing: <strong>{selectedPreset.name}</strong> ({selectedPreset.duration}ms, {selectedPreset.easing})
            {:else}
              Select a preset on the left to preview it here.
            {/if}
          </p>
        </div>

        <div class="preview-area">
          <div bind:this={previewEl} class="preview-target">
            <CharacterCard character={MOCK_CHARACTER} />
          </div>
        </div>
        <div class="preview-controls">
          <Button
            variant="primary"
            onclick={playPreview}
            disabled={!selectedPreset}
            testid="play-preview-btn"
          >Play</Button>
          <Button
            variant="secondary"
            onclick={resetPreview}
            testid="reset-preview-btn"
          >Reset</Button>
        </div>
      </Card>
    </div>
  </div>
</div>

<style>
  .animations-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  /* ── Two-column layout: controls left, preview right ── */
  .panel-layout {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: var(--space-5);
    align-items: start;
  }

  .controls-col {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }

  .preview-col {
    position: sticky;
    top: var(--space-4);
  }

  /* ── Section Headers ── */
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

  /* ── Verb Filter ── */
  .verb-filter {
    margin-bottom: var(--space-3);
  }

  /* ── Add Preset ── */
  .add-preset-row {
    display: flex;
    gap: var(--space-3);
    align-items: flex-end;
    margin-bottom: var(--space-4);
  }

  /* ── Preset List ── */
  .preset-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .preset-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2-5) var(--space-3);
    border: none;
    border-bottom: 1px solid var(--color-border);
    background: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
    font-family: inherit;
    transition: background var(--transition-base) ease;
  }
  .preset-item:hover {
    background: var(--navy-a20);
  }
  .preset-item.selected {
    background: var(--navy-a40);
  }

  .preset-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .preset-name {
    font-size: var(--font-base);
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .preset-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .verb-tag {
    font-size: var(--font-xs);
    font-weight: 600;
    padding: var(--space-0-5) var(--space-1-5);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    text-transform: capitalize;
  }

  .preset-item-actions {
    display: flex;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .empty-msg {
    color: var(--color-text-secondary);
    font-size: var(--font-base);
    text-align: center;
    padding: var(--space-4);
  }

  /* ── Action Buttons ── */
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

  /* ── Keyframe Editor ── */
  .name-field {
    margin-bottom: var(--space-4);
  }

  .keyframe-block {
    padding: var(--space-3);
    margin-bottom: var(--space-3);
    background: var(--navy-a30);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .keyframe-header {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
  }

  .property-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  /* ── Timing & Easing ── */
  .timing-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .easing-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }

  .iterations-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }

  /* ── Preview ── */
  .preview-area {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--space-5);
    min-height: 300px;
  }

  .preview-target {
    display: inline-block;
  }

  .preview-controls {
    display: flex;
    gap: var(--space-3);
    justify-content: center;
    padding-top: var(--space-3);
  }

  /* ── Save Bar ── */
  .save-bar {
    display: flex;
    justify-content: flex-end;
  }
</style>
