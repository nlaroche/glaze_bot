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
        <div class="card-back-pattern">
          <div class="logo">?</div>
        </div>
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
          <p class="description">{character.description}</p>
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
    border-radius: 10px;
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
    padding: 14px;
    background: rgba(8, 12, 22, 0.8);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 4;
  }

  .name {
    font-size: 1.25rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
    line-height: 1.2;
  }

  .description {
    font-size: 0.88rem;
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

  /* ── Stats: single compact row of dot groups ── */
  .trait-row {
    display: flex;
    gap: 10px;
    margin-top: 2px;
  }

  .trait-group {
    display: flex;
    gap: 3px;
    cursor: default;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.12);
    transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
  }

  .dot:not(.revealed) {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.08);
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

  /* ── Back face ── */
  .card-back {
    border: 4px solid;
    border-color:
      rgba(255, 255, 255, 0.12)
      rgba(255, 255, 255, 0.06)
      rgba(0, 0, 0, 0.3)
      rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-back-inner {
    position: absolute;
    inset: 0;
    border-radius: 10px;
    overflow: hidden;
    background: linear-gradient(135deg, var(--color-navy, #0a0e18), #1a3a5c);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card.rarity-rare .card-back-inner {
    background: linear-gradient(135deg, var(--color-navy, #0a0e18), #0d2e2e);
  }
  .card.rarity-epic .card-back-inner {
    background: linear-gradient(135deg, var(--color-navy, #0a0e18), #1a0d30);
  }
  .card.rarity-legendary .card-back-inner {
    background: linear-gradient(135deg, var(--color-navy, #0a0e18), #2a1f00);
  }

  .card-back-pattern {
    width: 80%;
    height: 80%;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo {
    font-size: 3rem;
    color: var(--color-text-muted);
    font-weight: 700;
  }
</style>
