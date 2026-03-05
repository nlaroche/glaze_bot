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
        <!-- Full-card SVG pattern layer -->
        <svg class="back-svg-pattern" viewBox="0 0 280 400" preserveAspectRatio="none">
          <defs>
            <!-- Diamond grid pattern -->
            <pattern id="diamond-{character.id}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="20" height="20" fill="none" />
              <rect x="9" y="9" width="2" height="2" rx="0.5" class="pat-dot" />
            </pattern>
            <!-- Fine horizontal lines -->
            <pattern id="hlines-{character.id}" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
              <line x1="0" y1="2" x2="4" y2="2" class="pat-line" />
            </pattern>
            <!-- Concentric circles radiating from center -->
            <radialGradient id="center-glow-{character.id}" cx="50%" cy="50%" r="50%">
              <stop offset="0%" class="glow-inner" />
              <stop offset="50%" class="glow-mid" />
              <stop offset="100%" stop-color="transparent" />
            </radialGradient>
          </defs>
          <!-- Base diamond fill -->
          <rect width="280" height="400" fill="url(#diamond-{character.id})" />
          <!-- Horizontal line overlay -->
          <rect width="280" height="400" fill="url(#hlines-{character.id})" opacity="0.5" />
          <!-- Concentric rings -->
          {#each [120, 100, 80, 60, 40, 25] as r}
            <circle cx="140" cy="200" {r} fill="none" class="ring-line" />
          {/each}
          <!-- Diagonal accent lines from corners -->
          <line x1="0" y1="0" x2="140" y2="200" class="accent-line" />
          <line x1="280" y1="0" x2="140" y2="200" class="accent-line" />
          <line x1="0" y1="400" x2="140" y2="200" class="accent-line" />
          <line x1="280" y1="400" x2="140" y2="200" class="accent-line" />
          <!-- Ornamental border scrollwork -->
          <rect x="16" y="16" width="248" height="368" rx="6" fill="none" class="inner-border" />
          <rect x="22" y="22" width="236" height="356" rx="4" fill="none" class="inner-border-2" />
          <!-- Top/bottom ornamental bars -->
          <rect x="50" y="14" width="180" height="3" rx="1.5" class="bar-accent" />
          <rect x="50" y="383" width="180" height="3" rx="1.5" class="bar-accent" />
          <rect x="70" y="20" width="140" height="1.5" rx="0.75" class="bar-accent-thin" />
          <rect x="70" y="378.5" width="140" height="1.5" rx="0.75" class="bar-accent-thin" />
          <!-- Side ornamental bars -->
          <rect x="14" y="70" width="3" height="260" rx="1.5" class="bar-accent" />
          <rect x="263" y="70" width="3" height="260" rx="1.5" class="bar-accent" />
          <!-- Corner diamonds -->
          {#each [{x:30,y:30},{x:250,y:30},{x:30,y:370},{x:250,y:370}] as c}
            <rect x={c.x - 5} y={c.y - 5} width="10" height="10" rx="1" transform="rotate(45 {c.x} {c.y})" class="corner-diamond" />
            <rect x={c.x - 3} y={c.y - 3} width="6" height="6" rx="0.5" transform="rotate(45 {c.x} {c.y})" class="corner-diamond-inner" />
          {/each}
          <!-- Center glow -->
          <circle cx="140" cy="200" r="100" fill="url(#center-glow-{character.id})" />
          {#if character.rarity === 'epic' || character.rarity === 'legendary'}
            <!-- Extra starburst rays for epic/legendary -->
            {#each Array(24) as _, i}
              {@const angle = (i * 15) * Math.PI / 180}
              {@const inner = character.rarity === 'legendary' ? 35 : 40}
              {@const outer = character.rarity === 'legendary' ? 130 : 110}
              <line
                x1={140 + inner * Math.cos(angle)} y1={200 + inner * Math.sin(angle)}
                x2={140 + outer * Math.cos(angle)} y2={200 + outer * Math.sin(angle)}
                class="starburst-ray"
              />
            {/each}
          {/if}
          {#if character.rarity === 'legendary'}
            <!-- Extra ornamental ring of small diamonds -->
            {#each Array(16) as _, i}
              {@const angle = (i * 22.5) * Math.PI / 180}
              {@const dx = 140 + 95 * Math.cos(angle)}
              {@const dy = 200 + 95 * Math.sin(angle)}
              <rect x={dx - 3} y={dy - 3} width="6" height="6" rx="1"
                transform="rotate(45 {dx} {dy})" class="orbit-diamond" />
            {/each}
          {/if}
        </svg>

        <!-- GB Shield Emblem -->
        <div class="back-emblem">
          <svg class="shield-svg" viewBox="0 0 120 140" width="90" height="105">
            <defs>
              <linearGradient id="shield-fill-{character.id}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" class="shield-top" />
                <stop offset="100%" class="shield-bottom" />
              </linearGradient>
              <linearGradient id="shield-stroke-{character.id}" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" class="shield-stroke-a" />
                <stop offset="100%" class="shield-stroke-b" />
              </linearGradient>
            </defs>
            <!-- Shield shape -->
            <path d="M60 8 L108 30 L108 75 Q108 115 60 134 Q12 115 12 75 L12 30 Z"
              fill="url(#shield-fill-{character.id})"
              stroke="url(#shield-stroke-{character.id})"
              stroke-width="2.5" />
            <!-- Inner shield border -->
            <path d="M60 16 L100 34 L100 74 Q100 108 60 126 Q20 108 20 74 L20 34 Z"
              fill="none" class="shield-inner-stroke" stroke-width="1" />
            <!-- Horizontal divider -->
            <line x1="28" y1="72" x2="92" y2="72" class="shield-divider" stroke-width="0.8" />
            <!-- GB text -->
            <text x="60" y="62" text-anchor="middle" class="shield-text-g">G</text>
            <text x="60" y="108" text-anchor="middle" class="shield-text-b">B</text>
            <!-- Top accent dots -->
            <circle cx="36" cy="38" r="2" class="shield-accent-dot" />
            <circle cx="84" cy="38" r="2" class="shield-accent-dot" />
          </svg>
        </div>

        <!-- Shimmer sweep (randomized per card) -->
        {#if character.rarity !== 'common'}
          {@const sweepDur = 4 + Math.random() * 4}
          {@const sweepDelay = -(Math.random() * sweepDur)}
          {@const sweepAngle = 95 + Math.random() * 20}
          <div
            class="back-shimmer-sweep"
            style="--sweep-dur: {sweepDur.toFixed(2)}s; --sweep-delay: {sweepDelay.toFixed(2)}s; --sweep-angle: {sweepAngle.toFixed(1)}deg;"
          ></div>
        {/if}

        <!-- Floating particles (legendary) -->
        {#if character.rarity === 'legendary'}
          <div class="back-particles">
            {#each Array(12) as _, i}
              <div class="particle" style="--pi: {i}; --px: {10 + Math.random() * 80}; --py: {8 + Math.random() * 84}; --pd: {2.5 + Math.random() * 3.5}s; --ps: {1.5 + Math.random() * 2.5}px;"></div>
            {/each}
          </div>
        {/if}

        <!-- Specular -->
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
     CARD BACK — dense TCG-style design, rarity-escalating
     ══════════════════════════════════════════════════════════════ */

  .card-back {
    border: 4px solid;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Rarity border + outer glow ── */
  .card.rarity-common .card-back {
    border-color: rgba(160, 175, 200, 0.3) rgba(130, 145, 165, 0.2)
                  rgba(70, 80, 95, 0.45) rgba(130, 145, 165, 0.2);
    box-shadow: 0 0 4px rgba(160, 174, 192, 0.1);
  }
  .card.rarity-rare .card-back {
    border-color: rgba(80, 195, 195, 0.4) rgba(55, 155, 155, 0.25)
                  rgba(20, 70, 70, 0.5) rgba(55, 155, 155, 0.25);
    box-shadow: 0 0 10px rgba(59, 151, 151, 0.2), 0 0 3px rgba(59, 151, 151, 0.15);
  }
  .card.rarity-epic .card-back {
    border-color: rgba(195, 145, 255, 0.45) rgba(155, 95, 235, 0.3)
                  rgba(65, 25, 115, 0.55) rgba(155, 95, 235, 0.3);
    box-shadow: 0 0 14px rgba(176, 106, 255, 0.25), 0 0 5px rgba(176, 106, 255, 0.15);
  }
  .card.rarity-legendary .card-back {
    border-color: rgba(255, 235, 110, 0.5) rgba(225, 195, 50, 0.35)
                  rgba(120, 90, 10, 0.55) rgba(225, 195, 50, 0.35);
    box-shadow: 0 0 18px rgba(255, 215, 0, 0.3), 0 0 6px rgba(255, 215, 0, 0.2);
  }

  /* ── Base background — brighter, richer ── */
  .card-back-inner {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-xl);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(ellipse 80% 70% at 50% 50%, rgba(40, 60, 100, 0.5) 0%, transparent 70%),
      linear-gradient(160deg, #121e38 0%, #1c2e52 30%, #162848 60%, #0e1a30 100%);
  }
  .card.rarity-rare .card-back-inner {
    background:
      radial-gradient(ellipse 80% 70% at 50% 50%, rgba(30, 90, 90, 0.4) 0%, transparent 70%),
      linear-gradient(160deg, #0e2828 0%, #14403e 30%, #103535 60%, #0a2020 100%);
  }
  .card.rarity-epic .card-back-inner {
    background:
      radial-gradient(ellipse 75% 65% at 50% 50%, rgba(80, 40, 140, 0.4) 0%, transparent 65%),
      linear-gradient(160deg, #160e30 0%, #261550 30%, #1e1040 60%, #120a25 100%);
  }
  .card.rarity-legendary .card-back-inner {
    background:
      radial-gradient(ellipse 70% 60% at 50% 50%, rgba(120, 90, 20, 0.4) 0%, transparent 60%),
      linear-gradient(160deg, #201a08 0%, #38300e 25%, #2e2508 55%, #181204 100%);
  }

  /* ── SVG pattern layer (covers full card) ── */
  .back-svg-pattern {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }

  /* -- Pattern element styles by rarity -- */
  /* Common: silver/steel tones */
  .card.rarity-common .pat-dot { fill: rgba(160, 180, 210, 0.2); }
  .card.rarity-common .pat-line { stroke: rgba(160, 180, 210, 0.06); stroke-width: 0.5; }
  .card.rarity-common .ring-line { stroke: rgba(160, 180, 210, 0.06); stroke-width: 0.5; }
  .card.rarity-common .accent-line { stroke: rgba(160, 180, 210, 0.04); stroke-width: 0.5; }
  .card.rarity-common .inner-border { stroke: rgba(160, 180, 210, 0.12); stroke-width: 1; }
  .card.rarity-common .inner-border-2 { stroke: rgba(160, 180, 210, 0.06); stroke-width: 0.5; }
  .card.rarity-common .bar-accent { fill: rgba(160, 180, 210, 0.15); }
  .card.rarity-common .bar-accent-thin { fill: rgba(160, 180, 210, 0.08); }
  .card.rarity-common .corner-diamond { fill: rgba(160, 180, 210, 0.12); stroke: rgba(160, 180, 210, 0.2); stroke-width: 0.5; }
  .card.rarity-common .corner-diamond-inner { fill: rgba(160, 180, 210, 0.06); stroke: none; }
  .card.rarity-common .glow-inner { stop-color: rgba(160, 180, 210, 0.08); }
  .card.rarity-common .glow-mid { stop-color: rgba(160, 180, 210, 0.02); }

  /* Rare: teal tones */
  .card.rarity-rare .pat-dot { fill: rgba(59, 185, 185, 0.25); }
  .card.rarity-rare .pat-line { stroke: rgba(59, 185, 185, 0.08); stroke-width: 0.5; }
  .card.rarity-rare .ring-line { stroke: rgba(59, 185, 185, 0.08); stroke-width: 0.6; }
  .card.rarity-rare .accent-line { stroke: rgba(59, 185, 185, 0.05); stroke-width: 0.5; }
  .card.rarity-rare .inner-border { stroke: rgba(59, 185, 185, 0.18); stroke-width: 1.2; }
  .card.rarity-rare .inner-border-2 { stroke: rgba(59, 185, 185, 0.08); stroke-width: 0.5; }
  .card.rarity-rare .bar-accent { fill: rgba(59, 185, 185, 0.2); }
  .card.rarity-rare .bar-accent-thin { fill: rgba(59, 185, 185, 0.1); }
  .card.rarity-rare .corner-diamond { fill: rgba(59, 185, 185, 0.15); stroke: rgba(59, 185, 185, 0.3); stroke-width: 0.5; }
  .card.rarity-rare .corner-diamond-inner { fill: rgba(59, 185, 185, 0.08); stroke: none; }
  .card.rarity-rare .glow-inner { stop-color: rgba(59, 185, 185, 0.12); }
  .card.rarity-rare .glow-mid { stop-color: rgba(59, 185, 185, 0.03); }

  /* Epic: purple tones, brighter */
  .card.rarity-epic .pat-dot { fill: rgba(190, 130, 255, 0.3); }
  .card.rarity-epic .pat-line { stroke: rgba(190, 130, 255, 0.1); stroke-width: 0.5; }
  .card.rarity-epic .ring-line { stroke: rgba(190, 130, 255, 0.1); stroke-width: 0.7; }
  .card.rarity-epic .accent-line { stroke: rgba(190, 130, 255, 0.06); stroke-width: 0.5; }
  .card.rarity-epic .inner-border { stroke: rgba(190, 130, 255, 0.22); stroke-width: 1.4; }
  .card.rarity-epic .inner-border-2 { stroke: rgba(190, 130, 255, 0.1); stroke-width: 0.7; }
  .card.rarity-epic .bar-accent { fill: rgba(190, 130, 255, 0.25); }
  .card.rarity-epic .bar-accent-thin { fill: rgba(190, 130, 255, 0.12); }
  .card.rarity-epic .corner-diamond { fill: rgba(190, 130, 255, 0.2); stroke: rgba(190, 130, 255, 0.4); stroke-width: 0.7; }
  .card.rarity-epic .corner-diamond-inner { fill: rgba(190, 130, 255, 0.1); stroke: none; }
  .card.rarity-epic .starburst-ray { stroke: rgba(190, 130, 255, 0.06); stroke-width: 0.5; }
  .card.rarity-epic .glow-inner { stop-color: rgba(190, 130, 255, 0.15); }
  .card.rarity-epic .glow-mid { stop-color: rgba(190, 130, 255, 0.04); }

  /* Legendary: gold tones, brightest */
  .card.rarity-legendary .pat-dot { fill: rgba(255, 225, 80, 0.35); }
  .card.rarity-legendary .pat-line { stroke: rgba(255, 225, 80, 0.12); stroke-width: 0.5; }
  .card.rarity-legendary .ring-line { stroke: rgba(255, 225, 80, 0.12); stroke-width: 0.8; }
  .card.rarity-legendary .accent-line { stroke: rgba(255, 225, 80, 0.08); stroke-width: 0.7; }
  .card.rarity-legendary .inner-border { stroke: rgba(255, 225, 80, 0.28); stroke-width: 1.6; }
  .card.rarity-legendary .inner-border-2 { stroke: rgba(255, 225, 80, 0.12); stroke-width: 0.8; }
  .card.rarity-legendary .bar-accent { fill: rgba(255, 225, 80, 0.3); }
  .card.rarity-legendary .bar-accent-thin { fill: rgba(255, 225, 80, 0.15); }
  .card.rarity-legendary .corner-diamond { fill: rgba(255, 225, 80, 0.25); stroke: rgba(255, 225, 80, 0.5); stroke-width: 0.8; }
  .card.rarity-legendary .corner-diamond-inner { fill: rgba(255, 225, 80, 0.12); stroke: none; }
  .card.rarity-legendary .starburst-ray { stroke: rgba(255, 225, 80, 0.07); stroke-width: 0.6; }
  .card.rarity-legendary .orbit-diamond { fill: rgba(255, 225, 80, 0.2); stroke: rgba(255, 225, 80, 0.35); stroke-width: 0.5; }
  .card.rarity-legendary .glow-inner { stop-color: rgba(255, 225, 80, 0.2); }
  .card.rarity-legendary .glow-mid { stop-color: rgba(255, 225, 80, 0.05); }

  /* ── GB Shield Emblem ── */
  .back-emblem {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .shield-svg {
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
  }

  /* Shield gradient fills by rarity */
  .card.rarity-common .shield-top { stop-color: rgba(140, 160, 190, 0.15); }
  .card.rarity-common .shield-bottom { stop-color: rgba(100, 120, 150, 0.08); }
  .card.rarity-common .shield-stroke-a { stop-color: rgba(160, 180, 210, 0.4); }
  .card.rarity-common .shield-stroke-b { stop-color: rgba(120, 140, 170, 0.25); }
  .card.rarity-common .shield-inner-stroke { stroke: rgba(160, 180, 210, 0.15); }
  .card.rarity-common .shield-divider { stroke: rgba(160, 180, 210, 0.15); }
  .card.rarity-common .shield-accent-dot { fill: rgba(160, 180, 210, 0.2); }

  .card.rarity-rare .shield-top { stop-color: rgba(59, 185, 185, 0.2); }
  .card.rarity-rare .shield-bottom { stop-color: rgba(40, 130, 130, 0.1); }
  .card.rarity-rare .shield-stroke-a { stop-color: rgba(80, 210, 210, 0.5); }
  .card.rarity-rare .shield-stroke-b { stop-color: rgba(50, 160, 160, 0.3); }
  .card.rarity-rare .shield-inner-stroke { stroke: rgba(80, 210, 210, 0.18); }
  .card.rarity-rare .shield-divider { stroke: rgba(80, 210, 210, 0.18); }
  .card.rarity-rare .shield-accent-dot { fill: rgba(80, 210, 210, 0.25); }
  .card.rarity-rare .shield-svg { filter: drop-shadow(0 2px 10px rgba(59, 151, 151, 0.15)); }

  .card.rarity-epic .shield-top { stop-color: rgba(190, 130, 255, 0.25); }
  .card.rarity-epic .shield-bottom { stop-color: rgba(140, 80, 210, 0.12); }
  .card.rarity-epic .shield-stroke-a { stop-color: rgba(210, 160, 255, 0.6); }
  .card.rarity-epic .shield-stroke-b { stop-color: rgba(160, 100, 230, 0.35); }
  .card.rarity-epic .shield-inner-stroke { stroke: rgba(210, 160, 255, 0.2); }
  .card.rarity-epic .shield-divider { stroke: rgba(210, 160, 255, 0.2); }
  .card.rarity-epic .shield-accent-dot { fill: rgba(210, 160, 255, 0.3); }
  .card.rarity-epic .shield-svg {
    filter: drop-shadow(0 0 12px rgba(176, 106, 255, 0.25)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
  }

  .card.rarity-legendary .shield-top { stop-color: rgba(255, 230, 80, 0.3); }
  .card.rarity-legendary .shield-bottom { stop-color: rgba(200, 170, 40, 0.15); }
  .card.rarity-legendary .shield-stroke-a { stop-color: rgba(255, 240, 120, 0.7); }
  .card.rarity-legendary .shield-stroke-b { stop-color: rgba(220, 190, 50, 0.4); }
  .card.rarity-legendary .shield-inner-stroke { stroke: rgba(255, 240, 120, 0.22); }
  .card.rarity-legendary .shield-divider { stroke: rgba(255, 240, 120, 0.22); }
  .card.rarity-legendary .shield-accent-dot { fill: rgba(255, 240, 120, 0.35); }
  .card.rarity-legendary .shield-svg {
    filter: drop-shadow(0 0 16px rgba(255, 215, 0, 0.3)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
    animation: shield-pulse 3s ease-in-out infinite;
  }

  @keyframes shield-pulse {
    0%, 100% { filter: drop-shadow(0 0 16px rgba(255, 215, 0, 0.3)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4)); }
    50% { filter: drop-shadow(0 0 24px rgba(255, 215, 0, 0.5)) drop-shadow(0 0 40px rgba(255, 215, 0, 0.15)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4)); }
  }

  /* Shield text */
  .shield-text-g, .shield-text-b {
    font-family: var(--font-brand, 'Plus Jakarta Sans', sans-serif);
    font-weight: 900;
    font-size: 32px;
    letter-spacing: 2px;
  }
  .card.rarity-common .shield-text-g,
  .card.rarity-common .shield-text-b { fill: rgba(160, 180, 210, 0.3); }
  .card.rarity-rare .shield-text-g,
  .card.rarity-rare .shield-text-b { fill: rgba(80, 210, 210, 0.4); }
  .card.rarity-epic .shield-text-g,
  .card.rarity-epic .shield-text-b { fill: rgba(210, 160, 255, 0.45); }
  .card.rarity-legendary .shield-text-g,
  .card.rarity-legendary .shield-text-b { fill: rgba(255, 240, 120, 0.55); }

  /* ── Shimmer sweep (rare + epic + legendary) ──
     Per-card CSS vars: --sweep-dur, --sweep-delay, --sweep-angle
     for randomized timing & angle. Uses translate instead of
     background-position for seamless looping. */
  .back-shimmer-sweep {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3;
    overflow: hidden;
  }
  .back-shimmer-sweep::after {
    content: '';
    position: absolute;
    inset: -50% -100%;
    animation: sweep-slide var(--sweep-dur, 5s) linear infinite;
    animation-delay: var(--sweep-delay, 0s);
  }
  .card.rarity-rare .back-shimmer-sweep::after {
    background: linear-gradient(
      var(--sweep-angle, 105deg),
      transparent 40%,
      rgba(80, 210, 210, 0.04) 46%,
      rgba(120, 230, 230, 0.09) 50%,
      rgba(80, 210, 210, 0.04) 54%,
      transparent 60%
    );
  }
  .card.rarity-epic .back-shimmer-sweep::after {
    background: linear-gradient(
      var(--sweep-angle, 105deg),
      transparent 38%,
      rgba(190, 130, 255, 0.05) 44%,
      rgba(220, 180, 255, 0.12) 50%,
      rgba(190, 130, 255, 0.05) 56%,
      transparent 62%
    );
  }
  .card.rarity-legendary .back-shimmer-sweep::after {
    background: linear-gradient(
      var(--sweep-angle, 105deg),
      transparent 35%,
      rgba(255, 230, 80, 0.06) 42%,
      rgba(255, 245, 160, 0.16) 50%,
      rgba(255, 230, 80, 0.06) 58%,
      transparent 65%
    );
  }

  @keyframes sweep-slide {
    0% { transform: translateX(-33%); }
    100% { transform: translateX(33%); }
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
    width: var(--ps, 2px);
    height: var(--ps, 2px);
    border-radius: var(--radius-full, 50%);
    background: rgba(255, 225, 80, 0.7);
    left: calc(var(--px) * 1%);
    top: calc(var(--py) * 1%);
    box-shadow: 0 0 8px rgba(255, 215, 0, 0.5), 0 0 3px rgba(255, 215, 0, 0.8);
    animation: particle-float var(--pd) ease-in-out infinite;
    animation-delay: calc(var(--pi) * -0.5s);
  }

  @keyframes particle-float {
    0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
    50% { transform: translateY(-12px) scale(1.4); opacity: 1; }
  }

  /* ── Mouse-follow specular on back ── */
  .back-specular {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
    background: radial-gradient(
      circle at calc((var(--mx) + 1) / 2 * 100%) calc((var(--my) + 1) / 2 * 100%),
      rgba(255, 255, 255, 0.08),
      transparent 50%
    );
  }
  .card.rarity-rare .back-specular {
    background: radial-gradient(
      circle at calc((var(--mx) + 1) / 2 * 100%) calc((var(--my) + 1) / 2 * 100%),
      rgba(80, 210, 210, 0.1),
      transparent 50%
    );
  }
  .card.rarity-epic .back-specular {
    background: radial-gradient(
      circle at calc((var(--mx) + 1) / 2 * 100%) calc((var(--my) + 1) / 2 * 100%),
      rgba(190, 130, 255, 0.12),
      transparent 50%
    );
  }
  .card.rarity-legendary .back-specular {
    background: radial-gradient(
      circle at calc((var(--mx) + 1) / 2 * 100%) calc((var(--my) + 1) / 2 * 100%),
      rgba(255, 230, 80, 0.14),
      transparent 50%
    );
  }
</style>
