<script lang="ts">
  import type {
    VisualPrimitive,
    VisualCommand,
    AnchorPosition,
    EmoteType,
    FloatingTextAnimation,
    StampIcon,
  } from '@glazebot/shared-types';
  import Button from '$lib/components/ui/Button.svelte';
  import { SliderInput } from '@glazebot/shared-ui';
  import Select from '$lib/components/ui/Select.svelte';
  import TextInput from '$lib/components/ui/TextInput.svelte';

  // ── Primitive categories ─────────────────────────────────────────
  const CATEGORIES: { label: string; primitives: VisualPrimitive[] }[] = [
    { label: 'Annotations', primitives: ['arrow', 'circle', 'highlight_rect'] },
    { label: 'Comparisons', primitives: ['stat_comparison', 'info_table'] },
    { label: 'Reactions', primitives: ['emote_burst', 'screen_flash', 'floating_text'] },
    { label: 'Drawings', primitives: ['freehand_path', 'stamp'] },
  ];

  const PRIMITIVE_LABELS: Record<VisualPrimitive, string> = {
    arrow: 'Arrow',
    circle: 'Circle',
    highlight_rect: 'Highlight Rect',
    stat_comparison: 'Stat Comparison',
    info_table: 'Info Table',
    emote_burst: 'Emote Burst',
    screen_flash: 'Screen Flash',
    floating_text: 'Floating Text',
    freehand_path: 'Freehand Path',
    stamp: 'Stamp',
  };

  const PRIMITIVE_DESCRIPTIONS: Record<VisualPrimitive, string> = {
    arrow: 'Draw an arrow from one point to another to direct attention.',
    circle: 'Highlight a circular region on screen.',
    highlight_rect: 'Highlight a rectangular region on screen.',
    stat_comparison: 'Side-by-side stat bar comparison panel.',
    info_table: 'Data table overlay for stats, inventory, etc.',
    emote_burst: 'Particle explosion of emote emojis for reactions.',
    screen_flash: 'Brief full-screen color flash for dramatic moments.',
    floating_text: 'Large animated text overlay for emphasis.',
    freehand_path: 'Freehand line from control points for doodles.',
    stamp: 'Place an icon stamp on screen.',
  };

  // ── State ────────────────────────────────────────────────────────
  let selectedPrimitive: VisualPrimitive = $state('arrow');
  let previewActive = $state(false);
  let previewCommand: VisualCommand | null = $state(null);
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let previewKey = $state(0);

  let duration = $state(4000);

  // Arrow
  let arrowFromX = $state(0.2);
  let arrowFromY = $state(0.5);
  let arrowToX = $state(0.6);
  let arrowToY = $state(0.3);
  let arrowColor = $state('#FFD700');
  let arrowThickness = $state(3);
  let arrowLabel = $state('');

  // Circle
  let circleX = $state(0.5);
  let circleY = $state(0.5);
  let circleRadius = $state(0.08);
  let circleColor = $state('#FF4444');
  let circleThickness = $state(3);
  let circleFillOpacity = $state(0);
  let circleLabel = $state('');

  // Highlight Rect
  let rectX = $state(0.3);
  let rectY = $state(0.3);
  let rectW = $state(0.3);
  let rectH = $state(0.2);
  let rectColor = $state('#FFD700');
  let rectFillOpacity = $state(0.15);

  // Emote Burst
  let emoteType: EmoteType = $state('fire');
  let emoteX = $state(0.5);
  let emoteY = $state(0.5);
  let emoteCount = $state(10);
  let emoteSpread = $state(0.15);

  // Screen Flash
  let flashColor = $state('#FF0000');
  let flashIntensity = $state(0.3);

  // Floating Text
  let ftText = $state('NICE!');
  let ftPosition: AnchorPosition = $state('center');
  let ftFontSize = $state(48);
  let ftColor = $state('#FFFFFF');
  let ftAnimation: FloatingTextAnimation = $state('rise');

  // Freehand Path
  let fhColor = $state('#FF4444');
  let fhThickness = $state(3);
  let fhClosePath = $state(false);

  // Stamp
  let stampIcon: StampIcon = $state('crown');
  let stampX = $state(0.5);
  let stampY = $state(0.5);
  let stampSize = $state(48);
  let stampRotation = $state(0);

  // Stat Comparison
  let scTitle = $state('Player vs Enemy');
  let scPosition: AnchorPosition = $state('top-right');

  // Info Table
  let itTitle = $state('Stats');
  let itPosition: AnchorPosition = $state('top-right');

  // ── Select option helpers ────────────────────────────────────────
  const anchorOptions: { value: string; label: string }[] = [
    { value: 'top-left', label: 'Top Left' }, { value: 'top-center', label: 'Top Center' }, { value: 'top-right', label: 'Top Right' },
    { value: 'center-left', label: 'Center Left' }, { value: 'center', label: 'Center' }, { value: 'center-right', label: 'Center Right' },
    { value: 'bottom-left', label: 'Bottom Left' }, { value: 'bottom-center', label: 'Bottom Center' }, { value: 'bottom-right', label: 'Bottom Right' },
  ];
  const emoteOptions: { value: string; label: string }[] = [
    { value: 'heart', label: 'Heart' }, { value: 'fire', label: 'Fire' }, { value: 'skull', label: 'Skull' }, { value: 'star', label: 'Star' },
    { value: 'laugh', label: 'Laugh' }, { value: 'cry', label: 'Cry' }, { value: 'rage', label: 'Rage' },
    { value: 'thumbsup', label: 'Thumbs Up' }, { value: 'thumbsdown', label: 'Thumbs Down' }, { value: 'sparkle', label: 'Sparkle' },
  ];
  const animationOptions: { value: string; label: string }[] = [
    { value: 'rise', label: 'Rise' }, { value: 'shake', label: 'Shake' }, { value: 'pulse', label: 'Pulse' }, { value: 'slam', label: 'Slam' },
  ];
  const stampOptions: { value: string; label: string }[] = [
    { value: 'checkmark', label: 'Checkmark' }, { value: 'crossmark', label: 'Crossmark' }, { value: 'question', label: 'Question' },
    { value: 'exclamation', label: 'Exclamation' }, { value: 'crown', label: 'Crown' }, { value: 'trophy', label: 'Trophy' },
    { value: 'target', label: 'Target' }, { value: 'sword', label: 'Sword' }, { value: 'shield', label: 'Shield' }, { value: 'potion', label: 'Potion' },
  ];

  // ── Build command ────────────────────────────────────────────────
  function buildCommand(): VisualCommand {
    const id = `preview-${Date.now()}`;
    const base = { id, duration_ms: duration };
    switch (selectedPrimitive) {
      case 'arrow': return { ...base, primitive: 'arrow', from: { x: arrowFromX, y: arrowFromY }, to: { x: arrowToX, y: arrowToY }, color: arrowColor, thickness: arrowThickness, label: arrowLabel || undefined };
      case 'circle': return { ...base, primitive: 'circle', center: { x: circleX, y: circleY }, radius: circleRadius, color: circleColor, thickness: circleThickness, fill_opacity: circleFillOpacity, label: circleLabel || undefined };
      case 'highlight_rect': return { ...base, primitive: 'highlight_rect', origin: { x: rectX, y: rectY }, width: rectW, height: rectH, color: rectColor, fill_opacity: rectFillOpacity };
      case 'emote_burst': return { ...base, primitive: 'emote_burst', emote: emoteType, origin: { x: emoteX, y: emoteY }, count: emoteCount, spread: emoteSpread };
      case 'screen_flash': return { ...base, primitive: 'screen_flash', color: flashColor, intensity: flashIntensity };
      case 'floating_text': return { ...base, primitive: 'floating_text', text: ftText, position: ftPosition, font_size: ftFontSize, color: ftColor, animation: ftAnimation };
      case 'freehand_path': return { ...base, primitive: 'freehand_path', points: [{ x: 0.2, y: 0.5 }, { x: 0.35, y: 0.3 }, { x: 0.5, y: 0.5 }, { x: 0.65, y: 0.3 }, { x: 0.8, y: 0.5 }], color: fhColor, thickness: fhThickness, close_path: fhClosePath };
      case 'stamp': return { ...base, primitive: 'stamp', icon: stampIcon, position: { x: stampX, y: stampY }, size: stampSize, rotation: stampRotation };
      case 'stat_comparison': return { ...base, primitive: 'stat_comparison', title: scTitle, left: { name: 'Player', stats: [{ label: 'HP', value: 85, max: 100 }, { label: 'ATK', value: 42 }, { label: 'DEF', value: 28 }] }, right: { name: 'Enemy', stats: [{ label: 'HP', value: 60, max: 100 }, { label: 'ATK', value: 55 }, { label: 'DEF', value: 15 }] }, position: scPosition };
      case 'info_table': return { ...base, primitive: 'info_table', title: itTitle, headers: ['Item', 'Qty', 'Value'], rows: [['Sword', '1', '500g'], ['Shield', '1', '300g'], ['Potion', '5', '50g']], position: itPosition };
    }
  }

  function firePreview() {
    previewCommand = buildCommand();
    previewActive = true;
    previewKey++;
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => { previewActive = false; previewCommand = null; }, duration);
  }
</script>

<div class="prim-layout" data-testid="primitives-panel">
  <!-- ── Column 1: Catalog Sidebar ── -->
  <div class="prim-sidebar">
    {#each CATEGORIES as cat}
      <div class="prim-category">
        <span class="prim-cat-label">{cat.label}</span>
        <div class="prim-cat-items">
          {#each cat.primitives as prim}
            <button
              class="prim-item"
              class:active={selectedPrimitive === prim}
              onclick={() => selectedPrimitive = prim}
              data-testid="prim-select-{prim}"
            >
              {PRIMITIVE_LABELS[prim]}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <!-- ── Column 2: Parameters ── -->
  <div class="prim-params">
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">{PRIMITIVE_LABELS[selectedPrimitive]}</h3>
        <p class="card-desc">{PRIMITIVE_DESCRIPTIONS[selectedPrimitive]}</p>
      </div>

      <div class="card-form">
        <SliderInput label="Duration" bind:value={duration} min={500} max={15000} step={100} suffix="ms" />

        {#if selectedPrimitive === 'arrow'}
          <SliderInput label="From X" bind:value={arrowFromX} min={0} max={1} step={0.01} />
          <SliderInput label="From Y" bind:value={arrowFromY} min={0} max={1} step={0.01} />
          <SliderInput label="To X" bind:value={arrowToX} min={0} max={1} step={0.01} />
          <SliderInput label="To Y" bind:value={arrowToY} min={0} max={1} step={0.01} />
          <div class="color-field">
            <span class="field-label">Color</span>
            <label class="color-swatch" style="--swatch: {arrowColor}"><input type="color" bind:value={arrowColor} /></label>
          </div>
          <SliderInput label="Thickness" bind:value={arrowThickness} min={1} max={8} step={1} suffix="px" />
          <TextInput label="Label" bind:value={arrowLabel} placeholder="Optional label text" />

        {:else if selectedPrimitive === 'circle'}
          <SliderInput label="Center X" bind:value={circleX} min={0} max={1} step={0.01} />
          <SliderInput label="Center Y" bind:value={circleY} min={0} max={1} step={0.01} />
          <SliderInput label="Radius" bind:value={circleRadius} min={0.01} max={0.5} step={0.01} />
          <div class="color-field">
            <span class="field-label">Color</span>
            <label class="color-swatch" style="--swatch: {circleColor}"><input type="color" bind:value={circleColor} /></label>
          </div>
          <SliderInput label="Thickness" bind:value={circleThickness} min={1} max={8} step={1} suffix="px" />
          <SliderInput label="Fill Opacity" bind:value={circleFillOpacity} min={0} max={1} step={0.05} />
          <TextInput label="Label" bind:value={circleLabel} placeholder="Optional label text" />

        {:else if selectedPrimitive === 'highlight_rect'}
          <SliderInput label="Origin X" bind:value={rectX} min={0} max={1} step={0.01} />
          <SliderInput label="Origin Y" bind:value={rectY} min={0} max={1} step={0.01} />
          <SliderInput label="Width" bind:value={rectW} min={0.01} max={1} step={0.01} />
          <SliderInput label="Height" bind:value={rectH} min={0} max={1} step={0.01} />
          <div class="color-field">
            <span class="field-label">Color</span>
            <label class="color-swatch" style="--swatch: {rectColor}"><input type="color" bind:value={rectColor} /></label>
          </div>
          <SliderInput label="Fill Opacity" bind:value={rectFillOpacity} min={0} max={0.5} step={0.05} />

        {:else if selectedPrimitive === 'emote_burst'}
          <Select label="Emote" bind:value={emoteType} options={emoteOptions} />
          <SliderInput label="Origin X" bind:value={emoteX} min={0} max={1} step={0.01} />
          <SliderInput label="Origin Y" bind:value={emoteY} min={0} max={1} step={0.01} />
          <SliderInput label="Count" bind:value={emoteCount} min={3} max={30} step={1} />
          <SliderInput label="Spread" bind:value={emoteSpread} min={0.05} max={0.5} step={0.01} />

        {:else if selectedPrimitive === 'screen_flash'}
          <div class="color-field">
            <span class="field-label">Color</span>
            <label class="color-swatch" style="--swatch: {flashColor}"><input type="color" bind:value={flashColor} /></label>
          </div>
          <SliderInput label="Intensity" bind:value={flashIntensity} min={0.1} max={0.8} step={0.05} />

        {:else if selectedPrimitive === 'floating_text'}
          <TextInput label="Text" bind:value={ftText} placeholder="Short display text" />
          <Select label="Position" bind:value={ftPosition} options={anchorOptions} />
          <SliderInput label="Font Size" bind:value={ftFontSize} min={24} max={120} step={2} suffix="px" />
          <div class="color-field">
            <span class="field-label">Color</span>
            <label class="color-swatch" style="--swatch: {ftColor}"><input type="color" bind:value={ftColor} /></label>
          </div>
          <Select label="Animation" bind:value={ftAnimation} options={animationOptions} />

        {:else if selectedPrimitive === 'freehand_path'}
          <div class="color-field">
            <span class="field-label">Color</span>
            <label class="color-swatch" style="--swatch: {fhColor}"><input type="color" bind:value={fhColor} /></label>
          </div>
          <SliderInput label="Thickness" bind:value={fhThickness} min={1} max={8} step={1} suffix="px" />
          <label class="toggle-field">
            <span class="field-label">Close Path</span>
            <button class="toggle-btn" class:active={fhClosePath} onclick={() => fhClosePath = !fhClosePath} role="switch" aria-checked={fhClosePath}>
              <span class="toggle-thumb"></span>
            </button>
          </label>
          <p class="field-hint">Preview uses a fixed wave pattern. The LLM generates arbitrary control points.</p>

        {:else if selectedPrimitive === 'stamp'}
          <Select label="Icon" bind:value={stampIcon} options={stampOptions} />
          <SliderInput label="Position X" bind:value={stampX} min={0} max={1} step={0.01} />
          <SliderInput label="Position Y" bind:value={stampY} min={0} max={1} step={0.01} />
          <SliderInput label="Size" bind:value={stampSize} min={24} max={128} step={4} suffix="px" />
          <SliderInput label="Rotation" bind:value={stampRotation} min={-180} max={180} step={5} suffix="°" />

        {:else if selectedPrimitive === 'stat_comparison'}
          <TextInput label="Title" bind:value={scTitle} />
          <Select label="Position" bind:value={scPosition} options={anchorOptions} />
          <p class="field-hint">Preview uses sample Player vs Enemy data.</p>

        {:else if selectedPrimitive === 'info_table'}
          <TextInput label="Title" bind:value={itTitle} />
          <Select label="Position" bind:value={itPosition} options={anchorOptions} />
          <p class="field-hint">Preview uses sample inventory data.</p>
        {/if}

        <div class="prim-actions">
          <Button variant="primary" onclick={firePreview} testid="fire-preview">Fire Preview</Button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Column 3: Live Preview ── -->
  <div class="prim-preview-col">
    <div class="card preview-card">
      <div class="card-header">
        <h3 class="card-title">Live Preview</h3>
      </div>
      <div class="card-form">
        <div class="preview-viewport">
          <div class="preview-bg">
            <span class="preview-watermark">Game Screen</span>
          </div>
          {#if previewActive && previewCommand}
            {#key previewKey}
              <div class="preview-overlay">
                {#if previewCommand.primitive === 'arrow'}
                  {@const ax1 = previewCommand.from.x * 100}
                  {@const ay1 = previewCommand.from.y * 100}
                  {@const ax2 = previewCommand.to.x * 100}
                  {@const ay2 = previewCommand.to.y * 100}
                  {@const aRad = Math.atan2(ay2 - ay1, ax2 - ax1)}
                  {@const wLen = (previewCommand.thickness || 3) * 1.2}
                  {@const splay = Math.PI / 6}
                  {@const wlx = ax2 - wLen * Math.cos(aRad - splay)}
                  {@const wly = ay2 - wLen * Math.sin(aRad - splay)}
                  {@const wrx = ax2 - wLen * Math.cos(aRad + splay)}
                  {@const wry = ay2 - wLen * Math.sin(aRad + splay)}
                  <svg class="preview-svg">
                    <line x1="{ax1}%" y1="{ay1}%" x2="{ax2}%" y2="{ay2}%" stroke={previewCommand.color} stroke-width={previewCommand.thickness} stroke-linecap="round" class="draw-line" />
                    <line x1="{ax2}%" y1="{ay2}%" x2="{wlx}%" y2="{wly}%" stroke={previewCommand.color} stroke-width={previewCommand.thickness} stroke-linecap="round" class="draw-whisker" />
                    <line x1="{ax2}%" y1="{ay2}%" x2="{wrx}%" y2="{wry}%" stroke={previewCommand.color} stroke-width={previewCommand.thickness} stroke-linecap="round" class="draw-whisker" />
                    {#if previewCommand.label}
                      <text x="{(ax1 + ax2) / 2}%" y="{(ay1 + ay2) / 2 - 2}%" fill={previewCommand.color} font-size="14" font-weight="bold" text-anchor="middle" class="draw-label" style="text-shadow: 0 1px 4px rgba(0,0,0,0.8);">{previewCommand.label}</text>
                    {/if}
                  </svg>

                {:else if previewCommand.primitive === 'circle'}
                  <svg class="preview-svg">
                    <circle cx="{previewCommand.center.x * 100}%" cy="{previewCommand.center.y * 100}%" r="{previewCommand.radius * 100}%" stroke={previewCommand.color} stroke-width={previewCommand.thickness} fill={previewCommand.fill_opacity ? previewCommand.color : 'none'} fill-opacity={previewCommand.fill_opacity ?? 0} stroke-linecap="round" class="draw-circle" />
                  </svg>

                {:else if previewCommand.primitive === 'highlight_rect'}
                  <svg class="preview-svg">
                    <rect x="{previewCommand.origin.x * 100}%" y="{previewCommand.origin.y * 100}%" width="{previewCommand.width * 100}%" height="{previewCommand.height * 100}%" stroke={previewCommand.color} stroke-width="2" fill={previewCommand.color} fill-opacity={previewCommand.fill_opacity ?? 0.15} rx="4" stroke-linecap="round" class="draw-rect" />
                  </svg>

                {:else if previewCommand.primitive === 'floating_text'}
                  <div class="preview-floating-text anim-{previewCommand.animation}" style="font-size: {Math.min(previewCommand.font_size, 36)}px; color: {previewCommand.color};">{previewCommand.text}</div>

                {:else if previewCommand.primitive === 'screen_flash'}
                  <div class="preview-flash" style="background: {previewCommand.color}; --intensity: {previewCommand.intensity};"></div>

                {:else if previewCommand.primitive === 'stamp'}
                  {@const icons = { checkmark: '\u2705', crossmark: '\u274C', question: '\u2753', exclamation: '\u2757', crown: '\uD83D\uDC51', trophy: '\uD83C\uDFC6', target: '\uD83C\uDFAF', sword: '\u2694\uFE0F', shield: '\uD83D\uDEE1\uFE0F', potion: '\uD83E\uDDEA' }}
                  <div class="preview-stamp" style="left: {previewCommand.position.x * 100}%; top: {previewCommand.position.y * 100}%; font-size: {Math.min(previewCommand.size, 64)}px; transform: translate(-50%, -50%) rotate({previewCommand.rotation ?? 0}deg);">{icons[previewCommand.icon] ?? '\u2753'}</div>

                {:else if previewCommand.primitive === 'emote_burst'}
                  {@const emojis = { heart: '\u2764\uFE0F', fire: '\uD83D\uDD25', skull: '\uD83D\uDC80', star: '\u2B50', laugh: '\uD83D\uDE02', cry: '\uD83D\uDE2D', rage: '\uD83D\uDE21', thumbsup: '\uD83D\uDC4D', thumbsdown: '\uD83D\uDC4E', sparkle: '\u2728' }}
                  <div class="preview-burst" style="left: {previewCommand.origin.x * 100}%; top: {previewCommand.origin.y * 100}%;">
                    {#each Array(Math.min(previewCommand.count, 8)) as _, i}
                      <span class="burst-particle" style="--angle: {(i / Math.min(previewCommand.count, 8)) * 360}deg; --dist: {previewCommand.spread * 200}px; --delay: {i * 60}ms;">{emojis[previewCommand.emote] ?? '\u2764\uFE0F'}</span>
                    {/each}
                  </div>

                {:else if previewCommand.primitive === 'stat_comparison' || previewCommand.primitive === 'info_table'}
                  <div class="preview-panel-indicator">
                    <span class="preview-panel-name">{PRIMITIVE_LABELS[previewCommand.primitive]}</span>
                    <span class="preview-panel-sub">Full panel renders in the desktop overlay</span>
                  </div>

                {:else if previewCommand.primitive === 'freehand_path'}
                  <svg class="preview-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M 20 50 L 35 30 L 50 50 L 65 30 L 80 50{previewCommand.close_path ? ' Z' : ''}" stroke={previewCommand.color} stroke-width={previewCommand.thickness / 2} fill={previewCommand.close_path ? previewCommand.color : 'none'} fill-opacity="0.15" stroke-linecap="round" stroke-linejoin="round" class="draw-path" />
                  </svg>
                {/if}
              </div>
            {/key}
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* ── 3-Column Layout ────────────────────────────────────────── */
  .prim-layout {
    display: grid;
    grid-template-columns: 180px 1fr 1fr;
    gap: var(--space-5);
    align-items: start;
  }

  /* ── Column 1: Sidebar ──────────────────────────────────────── */
  .prim-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .prim-category {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .prim-cat-label {
    font-size: var(--font-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    padding: 0 var(--space-2-5);
    margin-bottom: var(--space-0-5);
  }
  .prim-cat-items {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .prim-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: var(--space-2) var(--space-2-5);
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--font-base);
    font-weight: 500;
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all var(--transition-base) ease;
  }
  .prim-item:hover {
    background: var(--white-a4);
    border-color: var(--white-a6);
  }
  .prim-item.active {
    background: var(--teal-a12);
    border-color: var(--teal-a25);
    color: var(--color-light-teal);
    font-weight: 600;
  }

  /* ── Card (local, not relying on parent scoped styles) ─────── */
  .card {
    background: rgba(10, 22, 42, 0.5);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--white-a6);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow:
      inset 0 1px 0 var(--white-a3),
      0 1px 3px var(--black-a40),
      0 4px 12px var(--black-a20);
  }
  .card-header {
    padding: var(--space-5) var(--space-6) 0;
  }
  .card-title {
    font-size: var(--font-lg);
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 var(--space-1);
  }
  .card-desc {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.4;
  }
  .card-form {
    padding: var(--space-5) var(--space-6) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  /* ── Column 2: Parameters ───────────────────────────────────── */
  .prim-params { min-width: 0; }

  /* ── Column 3: Preview ──────────────────────────────────────── */
  .prim-preview-col { min-width: 0; }
  .preview-card {
    position: sticky;
    top: var(--space-4);
  }

  /* ── Color Picker ───────────────────────────────────────────── */
  .color-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1-5);
  }
  .field-label {
    font-size: var(--font-base);
    font-weight: 500;
    color: var(--color-text-secondary);
  }
  .color-swatch {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
    border: 2px solid var(--input-border);
    background: var(--swatch);
    cursor: pointer;
    transition: border-color var(--transition-base), box-shadow var(--transition-base);
    position: relative;
    overflow: hidden;
  }
  .color-swatch:hover {
    border-color: var(--input-focus-border);
    box-shadow: 0 0 0 3px var(--teal-a15);
  }
  .color-swatch input[type="color"] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    border: none;
    padding: 0;
  }

  /* ── Toggle Switch ──────────────────────────────────────────── */
  .toggle-field {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    cursor: pointer;
  }
  .toggle-btn {
    position: relative;
    width: 40px;
    height: 22px;
    border-radius: 11px;
    border: 1px solid var(--input-border);
    background: var(--input-bg);
    cursor: pointer;
    transition: all var(--transition-base) ease;
    padding: 0;
  }
  .toggle-btn:hover { border-color: var(--input-focus-border); }
  .toggle-btn.active { background: var(--teal-a25); border-color: var(--teal-a40); }
  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-text-secondary);
    transition: all var(--transition-base) ease;
  }
  .toggle-btn.active .toggle-thumb { left: 20px; background: var(--color-light-teal); }

  /* ── Hints + Actions ────────────────────────────────────────── */
  .field-hint {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.4;
  }
  .prim-actions {
    padding-top: var(--space-3);
    margin-top: var(--space-1);
    border-top: 1px solid var(--white-a6);
  }

  /* ── Preview Viewport ───────────────────────────────────────── */
  .preview-viewport {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid var(--white-a8);
    background: #0d1117;
  }
  .preview-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 30% 40%, rgba(59, 151, 151, 0.06) 0%, transparent 60%),
      radial-gradient(ellipse at 70% 60%, rgba(176, 106, 255, 0.04) 0%, transparent 60%),
      linear-gradient(135deg, #0d1422 0%, #111827 50%, #0d1422 100%);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .preview-watermark {
    font-size: var(--font-2xl);
    color: var(--white-a8);
    font-weight: 700;
    letter-spacing: 0.04em;
    user-select: none;
  }
  .preview-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .preview-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  /* ── Draw-in Animations ─────────────────────────────────────── */
  .draw-line {
    stroke-dasharray: 1000;
    stroke-dashoffset: 1000;
    animation: draw-stroke 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  .draw-circle {
    stroke-dasharray: 1000;
    stroke-dashoffset: 1000;
    animation: draw-stroke 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  .draw-rect {
    stroke-dasharray: 2000;
    stroke-dashoffset: 2000;
    animation: draw-stroke 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  .draw-path {
    stroke-dasharray: 500;
    stroke-dashoffset: 500;
    animation: draw-stroke 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  .draw-whisker {
    stroke-dasharray: 200;
    stroke-dashoffset: 200;
    animation: draw-stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1) 0.35s forwards;
  }
  .draw-label {
    animation: fade-in 0.3s ease-out 0.4s both;
  }
  @keyframes draw-stroke { to { stroke-dashoffset: 0; } }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  /* ── Other Preview Animations ───────────────────────────────── */
  .preview-floating-text {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    font-weight: 900;
    font-family: system-ui, sans-serif;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
    white-space: nowrap;
  }
  .preview-floating-text.anim-rise { animation: prev-rise 2s ease-out forwards; }
  .preview-floating-text.anim-shake { animation: prev-shake 2s ease-out forwards; }
  .preview-floating-text.anim-pulse { animation: prev-pulse 2s ease-out forwards; }
  .preview-floating-text.anim-slam { animation: prev-slam 2s ease-out forwards; }

  .preview-flash { position: absolute; inset: 0; animation: prev-flash 0.6s ease-out forwards; }
  .preview-stamp {
    position: absolute;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
    animation: prev-stamp-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    line-height: 1;
  }
  .preview-burst { position: absolute; transform: translate(-50%, -50%); }
  .burst-particle {
    position: absolute;
    font-size: 20px;
    opacity: 0;
    animation: prev-burst 1.2s ease-out forwards;
    animation-delay: var(--delay, 0ms);
  }
  .preview-panel-indicator {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    padding: var(--space-5) var(--space-8);
    background: rgba(10, 14, 24, 0.85);
    border: 1px solid var(--white-a10);
    border-radius: var(--radius-xl);
    animation: fade-in 0.35s ease-out;
  }
  .preview-panel-name { display: block; font-size: var(--font-lg); font-weight: 700; color: var(--color-text-primary); }
  .preview-panel-sub { display: block; font-size: var(--font-sm); color: var(--color-text-muted); margin-top: var(--space-1); }

  @keyframes prev-rise {
    0% { opacity: 0; transform: translate(-50%, -40%) scale(0.9); }
    15% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    80% { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%, -60%); }
  }
  @keyframes prev-shake {
    0% { opacity: 0; } 10% { opacity: 1; }
    15% { transform: translate(calc(-50% - 4px), -50%); }
    20% { transform: translate(calc(-50% + 4px), -50%); }
    25% { transform: translate(calc(-50% - 3px), -50%); }
    30% { transform: translate(calc(-50% + 3px), -50%); }
    35% { transform: translate(-50%, -50%); }
    80% { opacity: 1; } 100% { opacity: 0; }
  }
  @keyframes prev-pulse {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    15% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
    25% { transform: translate(-50%, -50%) scale(1); }
    80% { opacity: 1; } 100% { opacity: 0; }
  }
  @keyframes prev-slam {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(2.5); }
    15% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    20% { transform: translate(-50%, -50%) scale(1.08); }
    25% { transform: translate(-50%, -50%) scale(1); }
    80% { opacity: 1; } 100% { opacity: 0; }
  }
  @keyframes prev-flash {
    0% { opacity: var(--intensity, 0.3); }
    30% { opacity: var(--intensity, 0.3); }
    100% { opacity: 0; }
  }
  @keyframes prev-stamp-pop {
    0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
    60% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  }
  @keyframes prev-burst {
    0% { transform: translate(0, 0) scale(0); opacity: 0; }
    15% { opacity: 1; transform: scale(1); }
    100% {
      transform: translate(
        calc(cos(var(--angle)) * var(--dist)),
        calc(sin(var(--angle)) * var(--dist))
      ) scale(0.6);
      opacity: 0;
    }
  }
</style>
