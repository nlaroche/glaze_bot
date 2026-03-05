<script lang="ts">
  import type { GachaCharacter } from '@glazebot/shared-types';
  import ProceduralAvatar from './ProceduralAvatar.svelte';

  interface Props {
    character: GachaCharacter;
    flipped?: boolean;
    onflip?: () => void;
    onclick?: () => void;
    image?: string;
  }

  let { character, flipped = false, onflip, onclick, image }: Props = $props();

  import type { Personality } from '@glazebot/shared-types';

  const displayTraits = ['energy', 'humor', 'attitude'] as const;
  const traitTitles: Record<typeof displayTraits[number], string> = {
    energy: 'Energy',
    humor: 'Humor',
    attitude: 'Attitude',
  };

  function traitDots(p: Personality | undefined, t: keyof Personality): number {
    const val = p?.[t] ?? 50;
    return Math.max(1, Math.min(5, Math.round(val / 20)));
  }

  let mx = $state(0);
  let my = $state(0);
  let hovering = $state(false);
  let flipping = $state(false);
  let mounted = $state(false);
  let revealed = $derived.by(() => flipped);
  let revealedDelayed = $state(false);

  // Prevent flip animation on initial mount
  import { onMount } from 'svelte';
  onMount(() => {
    // Small delay so the initial flipped state applies without transition
    requestAnimationFrame(() => { mounted = true; });
  });

  $effect(() => {
    if (revealed) {
      const t = setTimeout(() => { revealedDelayed = true; }, mounted ? 700 : 0);
      return () => clearTimeout(t);
    } else {
      revealedDelayed = false;
    }
  });

  function handleMouseMove(e: MouseEvent) {
    if (flipping) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    my = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  }

  function handleMouseEnter() {
    hovering = true;
  }

  function handleMouseLeave() {
    hovering = false;
    mx = 0;
    my = 0;
  }

  function doFlip() {
    if (onflip) {
      flipping = true;
      onflip();
      setTimeout(() => { flipping = false; }, 700);
    }
    if (onclick) onclick();
  }

  function handleClick(e: MouseEvent) {
    // Only flip on real clicks (detail > 0), not synthetic/focus events
    if (e.detail === 0) return;
    doFlip();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      doFlip();
    }
  }

  const isHolo = $derived(character.rarity === 'epic' || character.rarity === 'legendary');
  const isLegendary = $derived(character.rarity === 'legendary');

  const topicCount = $derived(
    character.topic_assignments ? Object.keys(character.topic_assignments).length : 0
  );
  const hasCustomTopics = $derived(
    character.custom_topics && character.custom_topics.length > 0
  );
</script>

<div
  class="card rarity-{character.rarity}"
  class:flipped
  class:hovering
  class:flipping
  class:mounted
  style="--mx: {mx}; --my: {my};"
  onclick={handleClick}
  onkeydown={handleKeydown}
  onmouseenter={handleMouseEnter}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  role="button"
  tabindex="0"
  data-testid="character-card"
  data-character-id={character.id}
  data-rarity={character.rarity}
>
  <div class="card-inner">
    <!-- Back face -->
    <div class="card-back">
      <div class="card-back-inner">
        <div class="back-texture"></div>
        <div class="back-vignette"></div>
        <div class="back-frame">
          <div class="frame-corner tl"></div>
          <div class="frame-corner tr"></div>
          <div class="frame-corner bl"></div>
          <div class="frame-corner br"></div>
        </div>
        <div class="back-emblem">
          <svg class="emblem-ring" viewBox="0 0 100 100" width="80" height="80">
            <circle cx="50" cy="50" r="42" fill="none" stroke-width="1.5" opacity="0.4" />
            <circle cx="50" cy="50" r="36" fill="none" stroke-width="0.5" opacity="0.2" />
            {#if character.rarity === 'epic' || character.rarity === 'legendary'}
              <circle cx="50" cy="50" r="46" fill="none" stroke-width="0.5" stroke-dasharray="3 5" opacity="0.3" />
            {/if}
            {#if character.rarity === 'legendary'}
              <!-- Radial rays -->
              {#each Array(12) as _, i}
                {@const angle = (i * 30 - 90) * Math.PI / 180}
                <line
                  x1={50 + 30 * Math.cos(angle)} y1={50 + 30 * Math.sin(angle)}
                  x2={50 + 46 * Math.cos(angle)} y2={50 + 46 * Math.sin(angle)}
                  stroke-width="0.5" opacity="0.25"
                />
              {/each}
            {/if}
          </svg>
          <span class="emblem-glyph">?</span>
        </div>
        {#if character.rarity === 'epic' || character.rarity === 'legendary'}
          <div class="back-shimmer-sweep"></div>
        {/if}
        {#if character.rarity === 'legendary'}
          <div class="back-particles">
            {#each Array(8) as _, i}
              <div class="particle" style="--pi: {i}; --px: {20 + Math.random() * 60}; --py: {15 + Math.random() * 70}; --pd: {3 + Math.random() * 4}s;"></div>
            {/each}
          </div>
        {/if}
        <div class="back-specular"></div>
      </div>
    </div>
    <!-- Front face -->
    <div class="card-front">
      <div class="border-shimmer"></div>

      <div class="card-front-inner">
        <div class="art-fill">
          {#if image}
            <img src={image} alt="" class="art-bg-blur" aria-hidden="true" />
            <img src={image} alt={character.name} class="art-foreground" />
          {:else}
            <ProceduralAvatar seed={character.avatar_seed} rarity={character.rarity} size={400} />
          {/if}
        </div>

        <div class="specular"></div>

        {#if isHolo}
          <div class="holo-overlay" class:legendary={isLegendary}></div>
        {/if}

        <!-- Bottom info overlay -->
        <div class="info-overlay">
          <h3 class="name" data-testid="character-name">{character.name}</h3>
          <p class="description">{character.tagline || character.description}</p>
          {#if topicCount > 0}
            <div class="topic-badge" data-testid="topic-badge">
              {#if hasCustomTopics}<span class="sparkle">&#10024;</span>{/if}
              {topicCount} topics
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .card {
    width: 280px;
    height: 400px;
    perspective: 800px;
    cursor: pointer;
    position: relative;
    user-select: none;
    -webkit-user-select: none;
    outline: none;
  }

  /* ── Card inner (3D tilt) ── */
  .card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    will-change: transform;
    z-index: 1;
    transform:
      rotateY(calc(var(--mx) * 12deg))
      rotateX(calc(var(--my) * -12deg));
    /* No transition until mounted — prevents initial flip animation */
    transition: none;
  }

  .card.mounted .card-inner {
    transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .card.hovering .card-inner {
    transition: none;
  }

  /* Drop shadow on outer .card, NOT on .card-inner —
     filter on a preserve-3d element breaks backface-visibility */
  .card.hovering {
    filter: drop-shadow(
      calc(var(--mx) * -6px)
      calc(var(--my) * -6px)
      12px
      rgba(0, 0, 0, 0.45)
    );
  }

  .card.flipped .card-inner {
    transform:
      rotateY(calc(180deg + var(--mx) * 12deg))
      rotateX(calc(var(--my) * -12deg));
  }

  .card.flipping .card-inner {
    transition: transform 0.7s cubic-bezier(0.25, 1, 0.5, 1);
    animation: flip-pop 0.7s cubic-bezier(0.25, 1, 0.5, 1);
  }

  @keyframes flip-pop {
    0% { scale: 1; }
    40% { scale: 1.05; }
    100% { scale: 1; }
  }

  /* ── Faces ── */
  .card-front, .card-back {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    border-radius: 14px;
    overflow: hidden;
  }

  /* ── Front face ── */
  .card-front {
    transform: rotateY(180deg);
    background: var(--color-navy, #0a0e18);
    border: 4px solid;
    border-color:
      rgba(255, 255, 255, 0.18)
      rgba(255, 255, 255, 0.08)
      rgba(0, 0, 0, 0.25)
      rgba(255, 255, 255, 0.08);
  }

  .card.rarity-common .card-front {
    border-color:
      rgba(180, 195, 210, 0.3)
      rgba(140, 155, 170, 0.2)
      rgba(60, 70, 80, 0.4)
      rgba(140, 155, 170, 0.2);
    box-shadow:
      0 0 4px rgba(160, 174, 192, 0.1),
      inset 0 0 1px rgba(160, 174, 192, 0.1);
  }

  .card.rarity-rare .card-front {
    border-color:
      rgba(80, 200, 200, 0.4)
      rgba(50, 160, 160, 0.25)
      rgba(15, 60, 60, 0.5)
      rgba(50, 160, 160, 0.25);
    box-shadow:
      0 0 6px rgba(59, 151, 151, 0.15),
      0 0 2px rgba(59, 151, 151, 0.1),
      inset 0 0 1px rgba(59, 151, 151, 0.15);
  }

  .card.rarity-epic .card-front {
    border-color:
      rgba(210, 160, 255, 0.45)
      rgba(160, 100, 230, 0.3)
      rgba(60, 20, 110, 0.55)
      rgba(160, 100, 230, 0.3);
    box-shadow:
      0 0 8px rgba(176, 106, 255, 0.2),
      0 0 3px rgba(176, 106, 255, 0.15),
      inset 0 0 2px rgba(176, 106, 255, 0.1);
  }

  .card.rarity-legendary .card-front {
    border-color:
      rgba(255, 235, 100, 0.5)
      rgba(220, 190, 40, 0.35)
      rgba(120, 90, 0, 0.55)
      rgba(220, 190, 40, 0.35);
    box-shadow:
      0 0 10px rgba(255, 215, 0, 0.2),
      0 0 4px rgba(255, 215, 0, 0.15),
      inset 0 0 2px rgba(255, 215, 0, 0.1);
  }

  /* ── Border shimmer (noise-textured, slow rotation) ──
     Uses overlapping conic gradients at different scales for a noisy,
     voronoi-like sparkle texture instead of a smooth sweep. */
  .border-shimmer {
    position: absolute;
    inset: 0;
    border-radius: 14px;
    pointer-events: none;
    z-index: 20;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .card.rarity-epic .border-shimmer,
  .card.rarity-legendary .border-shimmer {
    opacity: 1;
  }

  .card.rarity-epic .border-shimmer {
    background:
      conic-gradient(
        from var(--shimmer-angle, 0deg) at 30% 20%,
        transparent 0deg,
        rgba(210, 160, 255, 0.18) 8deg,
        transparent 16deg,
        transparent 80deg,
        rgba(140, 200, 255, 0.12) 88deg,
        transparent 96deg,
        transparent 180deg,
        rgba(255, 160, 255, 0.14) 188deg,
        transparent 196deg,
        transparent 280deg,
        rgba(180, 130, 255, 0.1) 288deg,
        transparent 296deg
      ),
      conic-gradient(
        from calc(var(--shimmer-angle, 0deg) + 137deg) at 70% 75%,
        transparent 0deg,
        rgba(200, 170, 255, 0.15) 6deg,
        transparent 12deg,
        transparent 120deg,
        rgba(160, 220, 255, 0.1) 126deg,
        transparent 132deg,
        transparent 240deg,
        rgba(220, 180, 255, 0.12) 246deg,
        transparent 252deg
      );
    mask:
      linear-gradient(#fff, #fff) content-box,
      linear-gradient(#fff, #fff);
    mask-composite: exclude;
    padding: 4px;
    animation: shimmer-rotate 12s linear infinite;
  }

  .card.rarity-legendary .border-shimmer {
    background:
      conic-gradient(
        from var(--shimmer-angle, 0deg) at 25% 15%,
        transparent 0deg,
        rgba(255, 245, 140, 0.22) 6deg,
        transparent 12deg,
        transparent 60deg,
        rgba(255, 220, 100, 0.16) 66deg,
        transparent 72deg,
        transparent 140deg,
        rgba(255, 255, 200, 0.2) 146deg,
        transparent 152deg,
        transparent 220deg,
        rgba(255, 235, 120, 0.14) 226deg,
        transparent 232deg,
        transparent 300deg,
        rgba(255, 250, 180, 0.18) 306deg,
        transparent 312deg
      ),
      conic-gradient(
        from calc(var(--shimmer-angle, 0deg) + 97deg) at 75% 80%,
        transparent 0deg,
        rgba(255, 240, 130, 0.2) 5deg,
        transparent 10deg,
        transparent 90deg,
        rgba(255, 210, 80, 0.14) 95deg,
        transparent 100deg,
        transparent 190deg,
        rgba(255, 255, 170, 0.18) 195deg,
        transparent 200deg,
        transparent 270deg,
        rgba(255, 230, 100, 0.12) 275deg,
        transparent 280deg
      ),
      conic-gradient(
        from calc(var(--shimmer-angle, 0deg) + 223deg) at 50% 45%,
        transparent 0deg,
        rgba(255, 250, 200, 0.16) 4deg,
        transparent 8deg,
        transparent 120deg,
        rgba(255, 225, 90, 0.12) 124deg,
        transparent 128deg,
        transparent 240deg,
        rgba(255, 245, 160, 0.14) 244deg,
        transparent 248deg
      );
    mask:
      linear-gradient(#fff, #fff) content-box,
      linear-gradient(#fff, #fff);
    mask-composite: exclude;
    padding: 4px;
    animation: shimmer-rotate 16s linear infinite;
  }

  @keyframes shimmer-rotate {
    from { --shimmer-angle: 0deg; }
    to { --shimmer-angle: 360deg; }
  }

  @property --shimmer-angle {
    syntax: "<angle>";
    initial-value: 0deg;
    inherits: false;
  }

  .card-front-inner {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: var(--radius-xl);
  }

  /* ── Full-bleed art ── */
  .art-fill {
    position: absolute;
    inset: -4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-navy, #0a0e18);
  }

  .art-fill :global(.avatar) {
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    flex-shrink: 0;
  }

  /* ── Image art mode ── */
  .art-bg-blur {
    position: absolute;
    inset: -20px;
    width: calc(100% + 40px);
    height: calc(100% + 40px);
    object-fit: cover;
    filter: blur(16px) brightness(0.6);
    z-index: 0;
  }

  .art-foreground {
    position: relative;
    max-width: 30%;
    max-height: 30%;
    object-fit: contain;
    z-index: 1;
    image-rendering: pixelated;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6));
    transform: scale(2.75);
    /* Center in the visible area above the info overlay */
    margin-bottom: 100px;
  }

  /* ── Specular highlight ── */
  .specular {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at calc((var(--mx) + 1) / 2 * 100%) calc((var(--my) + 1) / 2 * 100%),
      rgba(255, 255, 255, 0.12),
      transparent 50%
    );
    pointer-events: none;
    z-index: 10;
  }

  /* ── Holo overlay ── */
  .holo-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
    background: linear-gradient(
      115deg,
      transparent 20%,
      rgba(255, 0, 0, 0.06) 25%,
      rgba(255, 154, 0, 0.06) 30%,
      rgba(255, 255, 0, 0.06) 35%,
      rgba(0, 255, 0, 0.06) 40%,
      rgba(0, 200, 255, 0.06) 45%,
      rgba(100, 0, 255, 0.06) 50%,
      rgba(255, 0, 200, 0.06) 55%,
      transparent 60%
    );
    background-size: 250% 250%;
    background-position:
      calc((var(--mx) + 1) / 2 * 100%)
      calc((var(--my) + 1) / 2 * 100%);
    mix-blend-mode: screen;
  }

  .holo-overlay.legendary {
    background: linear-gradient(
      115deg,
      transparent 15%,
      rgba(255, 0, 0, 0.12) 22%,
      rgba(255, 154, 0, 0.12) 28%,
      rgba(255, 255, 0, 0.12) 34%,
      rgba(0, 255, 0, 0.12) 40%,
      rgba(0, 200, 255, 0.12) 46%,
      rgba(100, 0, 255, 0.12) 52%,
      rgba(255, 0, 200, 0.12) 58%,
      transparent 65%
    );
    background-size: 250% 250%;
    background-position:
      calc((var(--mx) + 1) / 2 * 100%)
      calc((var(--my) + 1) / 2 * 100%);
    animation: legendary-shimmer 4s ease-in-out infinite;
  }

  @keyframes legendary-shimmer {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 1; }
  }

  /* ── Bottom info overlay — spacious, readable ── */
  .info-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 110px;
    padding: var(--space-3-5);
    background: rgba(8, 12, 22, 0.8);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-top: 1px solid var(--white-a8);
    display: flex;
    flex-direction: column;
    gap: var(--space-1-5);
    z-index: 4;
  }

  .name {
    font-size: var(--font-2xl);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
    line-height: 1.2;
  }

  .description {
    font-size: var(--font-base);
    color: var(--color-text-secondary);
    line-height: 1.4;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    margin: 0;
    font-style: italic;
  }

  /* ── Topic badge ── */
  .topic-badge {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--color-text-muted, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: var(--space-0-5, 0.125rem);
  }

  .sparkle {
    font-size: 0.7rem;
    margin-right: 2px;
  }

  /* ── Stats: single compact row of dot groups ── */
  .trait-row {
    display: flex;
    gap: var(--space-2-5);
    margin-top: var(--space-0-5);
  }

  .trait-group {
    display: flex;
    gap: 3px;
    cursor: default;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: var(--radius-full);
    background: var(--white-a10);
    border: 1px solid var(--white-a12);
    transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
  }

  .dot:not(.revealed) {
    background: var(--white-a6);
    border-color: var(--white-a8);
  }

  .card.rarity-common .dot.filled.revealed {
    background: var(--rarity-common);
    border-color: var(--rarity-common);
    box-shadow: 0 0 3px rgba(160, 174, 192, 0.4);
  }

  .card.rarity-rare .dot.filled.revealed {
    background: var(--rarity-rare);
    border-color: var(--rarity-rare);
    box-shadow: 0 0 3px rgba(59, 151, 151, 0.5);
  }

  .card.rarity-epic .dot.filled.revealed {
    background: var(--rarity-epic);
    border-color: var(--rarity-epic);
    box-shadow: 0 0 4px rgba(176, 106, 255, 0.5);
  }

  .card.rarity-legendary .dot.filled.revealed {
    background: var(--rarity-legendary);
    border-color: var(--rarity-legendary);
    box-shadow: 0 0 4px rgba(255, 215, 0, 0.5);
  }

  /* ══════════════════════════════════════════════════════════════
     CARD BACK — richly textured, rarity-escalating design
     ══════════════════════════════════════════════════════════════ */

  .card-back {
    border: 4px solid;
    border-color:
      var(--white-a12)
      var(--white-a6)
      var(--black-a30)
      var(--white-a6);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Rarity-specific border colors ── */
  .card.rarity-common .card-back {
    border-color: rgba(140, 155, 175, 0.25) rgba(120, 135, 150, 0.15)
                  rgba(40, 50, 60, 0.4)  rgba(120, 135, 150, 0.15);
  }
  .card.rarity-rare .card-back {
    border-color: rgba(60, 170, 170, 0.35) rgba(40, 130, 130, 0.2)
                  rgba(10, 50, 50, 0.5)   rgba(40, 130, 130, 0.2);
    box-shadow: 0 0 8px rgba(59, 151, 151, 0.15);
  }
  .card.rarity-epic .card-back {
    border-color: rgba(180, 130, 255, 0.4) rgba(140, 80, 220, 0.25)
                  rgba(50, 15, 100, 0.5)   rgba(140, 80, 220, 0.25);
    box-shadow: 0 0 12px rgba(176, 106, 255, 0.2), 0 0 4px rgba(176, 106, 255, 0.1);
  }
  .card.rarity-legendary .card-back {
    border-color: rgba(255, 230, 100, 0.45) rgba(210, 180, 40, 0.3)
                  rgba(100, 75, 0, 0.5)     rgba(210, 180, 40, 0.3);
    box-shadow: 0 0 16px rgba(255, 215, 0, 0.25), 0 0 6px rgba(255, 215, 0, 0.15);
  }

  /* ── Base background ── */
  .card-back-inner {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-xl);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(160deg, #0c1225 0%, #162040 40%, #0e1830 70%, #0a0e1c 100%);
  }
  .card.rarity-rare .card-back-inner {
    background: linear-gradient(160deg, #081a1a 0%, #0d2e2e 35%, #0a2424 65%, #061616 100%);
  }
  .card.rarity-epic .card-back-inner {
    background: linear-gradient(160deg, #0e0820 0%, #1a0d38 35%, #14082e 65%, #0a0618 100%);
  }
  .card.rarity-legendary .card-back-inner {
    background: linear-gradient(160deg, #141008 0%, #2a1f08 30%, #1e1605 60%, #100c04 100%);
  }

  /* ── Texture layer: repeating diamond crosshatch ── */
  .back-texture {
    position: absolute;
    inset: 0;
    opacity: 0.06;
    background:
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 8px,
        rgba(255, 255, 255, 0.5) 8px,
        rgba(255, 255, 255, 0.5) 9px
      ),
      repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 8px,
        rgba(255, 255, 255, 0.5) 8px,
        rgba(255, 255, 255, 0.5) 9px
      );
    pointer-events: none;
  }
  .card.rarity-rare .back-texture { opacity: 0.08; }
  .card.rarity-epic .back-texture {
    opacity: 0.07;
    background:
      repeating-linear-gradient(
        60deg,
        transparent,
        transparent 12px,
        rgba(176, 106, 255, 0.4) 12px,
        rgba(176, 106, 255, 0.4) 13px
      ),
      repeating-linear-gradient(
        -60deg,
        transparent,
        transparent 12px,
        rgba(176, 106, 255, 0.4) 12px,
        rgba(176, 106, 255, 0.4) 13px
      ),
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 24px,
        rgba(176, 106, 255, 0.15) 24px,
        rgba(176, 106, 255, 0.15) 25px
      );
  }
  .card.rarity-legendary .back-texture {
    opacity: 0.1;
    background:
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 6px,
        rgba(255, 215, 0, 0.35) 6px,
        rgba(255, 215, 0, 0.35) 7px
      ),
      repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 6px,
        rgba(255, 215, 0, 0.35) 6px,
        rgba(255, 215, 0, 0.35) 7px
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 12px,
        rgba(255, 215, 0, 0.15) 12px,
        rgba(255, 215, 0, 0.15) 13px
      );
  }

  /* ── Vignette ── */
  .back-vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, rgba(0, 0, 0, 0.5) 100%);
  }
  .card.rarity-rare .back-vignette {
    background: radial-gradient(ellipse 70% 60% at 50% 50%, rgba(59, 151, 151, 0.06) 0%, transparent 40%, rgba(0, 0, 0, 0.5) 100%);
  }
  .card.rarity-epic .back-vignette {
    background: radial-gradient(ellipse 60% 50% at 50% 50%, rgba(176, 106, 255, 0.08) 0%, transparent 40%, rgba(0, 0, 0, 0.45) 100%);
  }
  .card.rarity-legendary .back-vignette {
    background: radial-gradient(ellipse 55% 45% at 50% 50%, rgba(255, 215, 0, 0.1) 0%, transparent 35%, rgba(0, 0, 0, 0.4) 100%);
  }

  /* ── Inner frame ── */
  .back-frame {
    position: absolute;
    inset: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-md, 6px);
    pointer-events: none;
  }
  .card.rarity-rare .back-frame {
    border-color: rgba(59, 151, 151, 0.15);
    box-shadow: inset 0 0 20px rgba(59, 151, 151, 0.04);
  }
  .card.rarity-epic .back-frame {
    border-color: rgba(176, 106, 255, 0.18);
    box-shadow: inset 0 0 30px rgba(176, 106, 255, 0.05);
  }
  .card.rarity-epic .back-frame::after {
    content: '';
    position: absolute;
    inset: 4px;
    border: 1px solid rgba(176, 106, 255, 0.08);
    border-radius: var(--radius-sm, 4px);
  }
  .card.rarity-legendary .back-frame {
    border-color: rgba(255, 215, 0, 0.22);
    box-shadow: inset 0 0 40px rgba(255, 215, 0, 0.06);
  }
  .card.rarity-legendary .back-frame::after {
    content: '';
    position: absolute;
    inset: 4px;
    border: 1px solid rgba(255, 215, 0, 0.1);
    border-radius: var(--radius-sm, 4px);
  }

  /* ── Corner ornaments ── */
  .frame-corner {
    position: absolute;
    width: 16px;
    height: 16px;
    pointer-events: none;
    display: none;
  }
  .frame-corner.tl { top: -1px; left: -1px; border-top: 2px solid; border-left: 2px solid; border-radius: 3px 0 0 0; }
  .frame-corner.tr { top: -1px; right: -1px; border-top: 2px solid; border-right: 2px solid; border-radius: 0 3px 0 0; }
  .frame-corner.bl { bottom: -1px; left: -1px; border-bottom: 2px solid; border-left: 2px solid; border-radius: 0 0 0 3px; }
  .frame-corner.br { bottom: -1px; right: -1px; border-bottom: 2px solid; border-right: 2px solid; border-radius: 0 0 3px 0; }

  .card.rarity-rare .frame-corner {
    display: block;
    border-color: rgba(59, 151, 151, 0.3);
  }
  .card.rarity-epic .frame-corner {
    display: block;
    width: 22px;
    height: 22px;
    border-color: rgba(176, 106, 255, 0.4);
    filter: drop-shadow(0 0 3px rgba(176, 106, 255, 0.3));
  }
  .card.rarity-legendary .frame-corner {
    display: block;
    width: 28px;
    height: 28px;
    border-color: rgba(255, 215, 0, 0.5);
    filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.3));
  }

  /* ── Center emblem ── */
  .back-emblem {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .emblem-ring {
    position: absolute;
  }
  .emblem-ring circle, .emblem-ring line {
    stroke: rgba(255, 255, 255, 0.2);
  }
  .card.rarity-rare .emblem-ring circle,
  .card.rarity-rare .emblem-ring line {
    stroke: rgba(59, 151, 151, 0.4);
  }
  .card.rarity-epic .emblem-ring circle,
  .card.rarity-epic .emblem-ring line {
    stroke: rgba(176, 106, 255, 0.45);
  }
  .card.rarity-epic .emblem-ring {
    animation: emblem-spin 30s linear infinite;
  }
  .card.rarity-legendary .emblem-ring circle,
  .card.rarity-legendary .emblem-ring line {
    stroke: rgba(255, 215, 0, 0.5);
  }
  .card.rarity-legendary .emblem-ring {
    animation: emblem-spin 20s linear infinite;
    filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.2));
  }

  @keyframes emblem-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .emblem-glyph {
    font-size: 2.4rem;
    font-weight: 800;
    font-family: var(--font-brand, 'Plus Jakarta Sans', sans-serif);
    color: rgba(255, 255, 255, 0.15);
    z-index: 1;
    text-shadow: none;
    user-select: none;
  }
  .card.rarity-rare .emblem-glyph {
    color: rgba(59, 151, 151, 0.35);
    text-shadow: 0 0 12px rgba(59, 151, 151, 0.15);
  }
  .card.rarity-epic .emblem-glyph {
    color: rgba(176, 106, 255, 0.4);
    text-shadow: 0 0 16px rgba(176, 106, 255, 0.2), 0 0 32px rgba(176, 106, 255, 0.08);
  }
  .card.rarity-legendary .emblem-glyph {
    color: rgba(255, 215, 0, 0.5);
    text-shadow: 0 0 20px rgba(255, 215, 0, 0.3), 0 0 40px rgba(255, 215, 0, 0.1);
    animation: glyph-pulse 3s ease-in-out infinite;
  }

  @keyframes glyph-pulse {
    0%, 100% { opacity: 0.8; text-shadow: 0 0 20px rgba(255, 215, 0, 0.3), 0 0 40px rgba(255, 215, 0, 0.1); }
    50% { opacity: 1; text-shadow: 0 0 28px rgba(255, 215, 0, 0.45), 0 0 56px rgba(255, 215, 0, 0.15); }
  }

  /* ── Shimmer sweep (epic + legendary) ── */
  .back-shimmer-sweep {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3;
    background: linear-gradient(
      105deg,
      transparent 35%,
      rgba(255, 255, 255, 0.04) 42%,
      rgba(255, 255, 255, 0.08) 50%,
      rgba(255, 255, 255, 0.04) 58%,
      transparent 65%
    );
    background-size: 250% 100%;
    animation: back-sweep 5s ease-in-out infinite;
  }
  .card.rarity-epic .back-shimmer-sweep {
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(176, 106, 255, 0.03) 38%,
      rgba(200, 160, 255, 0.08) 50%,
      rgba(176, 106, 255, 0.03) 62%,
      transparent 70%
    );
    background-size: 250% 100%;
  }
  .card.rarity-legendary .back-shimmer-sweep {
    background: linear-gradient(
      105deg,
      transparent 25%,
      rgba(255, 215, 0, 0.04) 35%,
      rgba(255, 240, 140, 0.12) 50%,
      rgba(255, 215, 0, 0.04) 65%,
      transparent 75%
    );
    background-size: 250% 100%;
    animation: back-sweep 4s ease-in-out infinite;
  }

  @keyframes back-sweep {
    0% { background-position: 200% 0; }
    100% { background-position: -50% 0; }
  }

  /* ── Floating particles (legendary only) ── */
  .back-particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 4;
  }
  .particle {
    position: absolute;
    width: 3px;
    height: 3px;
    border-radius: var(--radius-full, 50%);
    background: rgba(255, 215, 0, 0.6);
    left: calc(var(--px) * 1%);
    top: calc(var(--py) * 1%);
    box-shadow: 0 0 6px rgba(255, 215, 0, 0.4);
    animation: particle-float var(--pd) ease-in-out infinite;
    animation-delay: calc(var(--pi) * -0.6s);
  }

  @keyframes particle-float {
    0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
    50% { transform: translateY(-10px) scale(1.3); opacity: 0.9; }
  }

  /* ── Mouse-follow specular on back ── */
  .back-specular {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
    background: radial-gradient(
      circle at calc((var(--mx) + 1) / 2 * 100%) calc((var(--my) + 1) / 2 * 100%),
      rgba(255, 255, 255, 0.06),
      transparent 45%
    );
  }
  .card.rarity-epic .back-specular {
    background: radial-gradient(
      circle at calc((var(--mx) + 1) / 2 * 100%) calc((var(--my) + 1) / 2 * 100%),
      rgba(176, 106, 255, 0.08),
      transparent 45%
    );
  }
  .card.rarity-legendary .back-specular {
    background: radial-gradient(
      circle at calc((var(--mx) + 1) / 2 * 100%) calc((var(--my) + 1) / 2 * 100%),
      rgba(255, 215, 0, 0.1),
      transparent 45%
    );
  }
</style>
