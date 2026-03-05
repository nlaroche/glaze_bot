<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { SliderInput, CharacterCard } from '@glazebot/shared-ui';
  import {
    DEFAULT_ANIMATIONS,
    FEEL_PRESETS,
    MOTION_TYPES,
    applyMotion,
    type AnimationsConfig,
  } from '@glazebot/shared-types';
  import type { GachaCharacter } from '@glazebot/shared-types';

  interface Props {
    config: Record<string, unknown>;
    onsave: (config: Record<string, unknown>) => Promise<void>;
  }

  let { config, onsave }: Props = $props();

  // ── Mock characters for preview (different rarities for visual variety) ──
  const PREVIEW_CHARS: GachaCharacter[] = [
    {
      id: 'prev-1', user_id: 'p', name: 'Enter Left', description: '', system_prompt: '',
      backstory: '', rarity: 'epic', avatar_seed: 'anim-1', is_active: true, is_default: false,
      created_at: new Date().toISOString(),
      personality: { energy: 90, positivity: 80, formality: 20, talkativeness: 70, attitude: 60, humor: 95 },
    },
    {
      id: 'prev-2', user_id: 'p', name: 'Scale In', description: '', system_prompt: '',
      backstory: '', rarity: 'legendary', avatar_seed: 'anim-2', is_active: true, is_default: false,
      created_at: new Date().toISOString(),
      personality: { energy: 60, positivity: 50, formality: 70, talkativeness: 40, attitude: 30, humor: 50 },
    },
    {
      id: 'prev-3', user_id: 'p', name: 'Land', description: '', system_prompt: '',
      backstory: '', rarity: 'rare', avatar_seed: 'anim-3', is_active: true, is_default: false,
      created_at: new Date().toISOString(),
      personality: { energy: 75, positivity: 65, formality: 45, talkativeness: 80, attitude: 55, humor: 70 },
    },
    {
      id: 'prev-4', user_id: 'p', name: 'Pop', description: '', system_prompt: '',
      backstory: '', rarity: 'common', avatar_seed: 'anim-4', is_active: true, is_default: false,
      created_at: new Date().toISOString(),
      personality: { energy: 40, positivity: 90, formality: 10, talkativeness: 55, attitude: 85, humor: 60 },
    },
  ];

  // Motion type each preview card demonstrates
  const SHOWCASE_MOTIONS: { motion: typeof MOTION_TYPES[number]['key']; charIdx: number }[] = [
    { motion: 'enter-left',  charIdx: 0 },
    { motion: 'enter-right', charIdx: 0 },
    { motion: 'scale-in',    charIdx: 1 },
    { motion: 'pop',         charIdx: 3 },
    { motion: 'land',        charIdx: 2 },
    { motion: 'enter-bottom', charIdx: 1 },
  ];

  // ── Extract from config ──
  function getFeel(): AnimationsConfig {
    const saved = config.animations as AnimationsConfig | undefined;
    if (saved && typeof saved.anticipation === 'number') return { ...saved };
    return { ...DEFAULT_ANIMATIONS };
  }

  // ── State ──
  let feel: AnimationsConfig = $state(getFeel());
  let saving = $state(false);
  let showcaseEls: (HTMLDivElement | undefined)[] = $state(Array(SHOWCASE_MOTIONS.length).fill(undefined));
  let animations: (Animation | null)[] = $state(Array(SHOWCASE_MOTIONS.length).fill(null));
  let activeFeelPreset: string | null = $state(null);

  // Re-sync when config prop changes
  $effect(() => {
    const _ = config;
    feel = getFeel();
  });

  // ── Auto-replay on slider change ──
  let replayTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleReplay() {
    if (replayTimer) clearTimeout(replayTimer);
    replayTimer = setTimeout(() => playAll(), 120);
  }

  // ── Actions ──
  function applyFeelPreset(preset: typeof FEEL_PRESETS[number]) {
    feel = { ...preset.values };
    activeFeelPreset = preset.id;
    scheduleReplay();
  }

  function updateFeel(key: keyof AnimationsConfig, value: number) {
    feel = { ...feel, [key]: value };
    activeFeelPreset = null;
    scheduleReplay();
  }

  function playAll() {
    for (let i = 0; i < SHOWCASE_MOTIONS.length; i++) {
      const el = showcaseEls[i];
      if (!el) continue;
      animations[i]?.cancel();
      // Stagger each card by a small delay for a cascade effect
      const delay = i * 80;
      setTimeout(() => {
        animations[i] = applyMotion(el, SHOWCASE_MOTIONS[i].motion, feel);
      }, delay);
    }
  }

  // ── Save ──
  async function save() {
    saving = true;
    try {
      const updated = { ...config, animations: { ...feel } };
      await onsave(updated);
    } finally {
      saving = false;
    }
  }
</script>

<div class="animations-panel" data-testid="animations-panel">

  <!-- Quick-set feel buttons -->
  <Card>
    <div class="section-header">
      <h3>Animation Feel</h3>
      <p class="section-desc">Controls how everything in the app moves. Pick a starting feel, then fine-tune with the sliders below.</p>
    </div>

    <div class="feel-buttons">
      {#each FEEL_PRESETS as preset (preset.id)}
        <button
          class="feel-btn"
          class:active={activeFeelPreset === preset.id}
          onclick={() => applyFeelPreset(preset)}
          data-testid="feel-{preset.id}"
        >
          <span class="feel-btn-name">{preset.name}</span>
          <span class="feel-btn-desc">{preset.desc}</span>
        </button>
      {/each}
    </div>
  </Card>

  <!-- Sliders -->
  <Card>
    <div class="section-header">
      <h3>Tweak the Feel</h3>
      <p class="section-desc">Drag any slider — the showcase below replays automatically.</p>
    </div>

    <div class="feel-sliders">
      <div class="slider-row">
        <SliderInput
          label="Wind-up"
          value={feel.anticipation}
          min={0}
          max={1}
          step={0.01}
          onchange={(e: Event & { currentTarget: EventTarget & HTMLInputElement }) => updateFeel('anticipation', Number(e.currentTarget.value))}
          testid="slider-anticipation"
        />
        <span class="slider-hint-text">Pulls back before launching — the bigger the wind-up, the more powerful the release feels</span>
      </div>

      <div class="slider-row">
        <SliderInput
          label="Overshoot"
          value={feel.overshoot}
          min={0}
          max={1}
          step={0.01}
          onchange={(e: Event & { currentTarget: EventTarget & HTMLInputElement }) => updateFeel('overshoot', Number(e.currentTarget.value))}
          testid="slider-overshoot"
        />
        <span class="slider-hint-text">Flies past the target before settling — makes motion feel energetic and alive</span>
      </div>

      <div class="slider-row">
        <SliderInput
          label="Bounce"
          value={feel.bounciness}
          min={0}
          max={1}
          step={0.01}
          onchange={(e: Event & { currentTarget: EventTarget & HTMLInputElement }) => updateFeel('bounciness', Number(e.currentTarget.value))}
          testid="slider-bounciness"
        />
        <span class="slider-hint-text">How many times it oscillates before settling — more = springier, playful</span>
      </div>

      <div class="slider-row">
        <SliderInput
          label="Squish"
          value={feel.squishiness}
          min={0}
          max={1}
          step={0.01}
          onchange={(e: Event & { currentTarget: EventTarget & HTMLInputElement }) => updateFeel('squishiness', Number(e.currentTarget.value))}
          testid="slider-squishiness"
        />
        <span class="slider-hint-text">Squash on impact, stretch during travel — makes things feel physical and weighty</span>
      </div>

      <div class="slider-row">
        <SliderInput
          label="Speed"
          value={feel.speed}
          min={100}
          max={2000}
          step={10}
          suffix="ms"
          onchange={(e: Event & { currentTarget: EventTarget & HTMLInputElement }) => updateFeel('speed', Number(e.currentTarget.value))}
          testid="slider-speed"
        />
        <span class="slider-hint-text">Total animation duration — slower lets you see every detail, faster feels snappy</span>
      </div>
    </div>
  </Card>

  <!-- Showcase grid: all motions at once -->
  <Card>
    <div class="section-header">
      <h3>Motion Showcase</h3>
      <p class="section-desc">Every motion type with your current feel. Hit Replay to see them all.</p>
    </div>

    <div class="showcase-controls">
      <Button variant="primary" onclick={playAll} testid="play-all-btn">Replay All</Button>
    </div>

    <div class="showcase-grid">
      {#each SHOWCASE_MOTIONS as item, i (i)}
        {@const motionInfo = MOTION_TYPES.find(m => m.key === item.motion)}
        <div class="showcase-cell">
          <span class="showcase-label">{motionInfo?.label ?? item.motion}</span>
          <div class="showcase-stage">
            <div bind:this={showcaseEls[i]} class="showcase-target">
              <CharacterCard character={PREVIEW_CHARS[item.charIdx]} />
            </div>
          </div>
        </div>
      {/each}
    </div>
  </Card>

  <!-- Save -->
  <div class="save-bar">
    <Button onclick={save} disabled={saving} variant="primary" testid="save-animations">
      {saving ? 'Saving...' : 'Save Animation Feel'}
    </Button>
  </div>
</div>

<style>
  .animations-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
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

  /* ── Feel Buttons ── */
  .feel-buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
  }

  .feel-btn {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
    background: var(--navy-a20);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
  }
  .feel-btn:hover {
    background: var(--navy-a40);
    border-color: var(--color-accent);
    transform: translateY(-1px);
  }
  .feel-btn.active {
    background: var(--navy-a40);
    border-color: var(--color-accent);
  }

  .feel-btn-name {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }
  .feel-btn-desc {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  /* ── Feel Sliders ── */
  .feel-sliders {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .slider-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .slider-hint-text {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  /* ── Showcase ── */
  .showcase-controls {
    margin-bottom: var(--space-4);
  }

  .showcase-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
  }

  .showcase-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .showcase-label {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text-primary);
    text-align: center;
  }

  .showcase-stage {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 220px;
    width: 100%;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--navy-a20);
    padding: var(--space-3);
  }

  .showcase-target {
    display: inline-block;
    transform-origin: center center;
  }

  /* ── Save Bar ── */
  .save-bar {
    display: flex;
    justify-content: flex-end;
  }
</style>
