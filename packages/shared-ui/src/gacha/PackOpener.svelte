<script lang="ts">
  import type { GachaCharacter } from '@glazebot/shared-types';
  import CharacterCard from './CharacterCard.svelte';
  import { onMount, onDestroy } from 'svelte';

  type Phase = 'idle' | 'shake' | 'tear' | 'burst' | 'reveal' | 'done';

  interface Props {
    characters?: GachaCharacter[];
    images?: Record<string, string>;
    onrequestopen?: () => Promise<{ characters: GachaCharacter[]; images: Record<string, string> }>;
  }

  let { characters = [], images: initialImages = {}, onrequestopen }: Props = $props();

  // Local mutable copy so onrequestopen can update it mid-animation
  let images = $state<Record<string, string>>({...initialImages});

  let phase: Phase = $state('idle');
  let packCards: GachaCharacter[] = $state([]);
  let flippedCards: boolean[] = $state([false, false, false]);
  let cardVisible: boolean[] = $state([false, false, false]);
  let legendaryFlash: boolean = $state(false);
  let legendaryCardIndex: number = $state(-1);
  let screenShake: boolean = $state(false);
  let allFlipped = $derived(flippedCards.every(Boolean));
  let tearProgress = $state(0);
  let shakeIntensity = $state(0);

  // JS-driven pack transform — no CSS animations, no teleporting
  let packX = $state(0);
  let packY = $state(0);
  let packRot = $state(0);
  let packScaleX = $state(1);
  let packScaleY = $state(1);
  let rafId: number | null = null;
  let startTime = 0;
  let prevPackX = 0;

  // Burst bloom — fires after anticipation beat
  let burstFired = $state(false);

  // Ground-pound impact effects per card slot
  let impactFlash: boolean[] = $state([false, false, false]);
  let impactPuffs: boolean[] = $state([false, false, false]);

  // Wind streaks
  let windStreaks: { id: number; x: number; y: number; angle: number; length: number; speed: number; delay: number; color: string }[] = $state([]);

  let debrisIdCounter = 0;

  function pickThreeCards(): GachaCharacter[] {
    const shuffled = [...characters].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }

  // Master animation loop — drives pack transform for all phases
  onMount(() => {
    startTime = performance.now();
    function loop(now: number) {
      const elapsed = (now - startTime) / 1000;

      if (phase === 'idle') {
        // Gentle sine wave bob
        packX = 0;
        packY = Math.sin(elapsed * 1.2) * 10;
        packRot = Math.sin(elapsed * 0.8) * 1.5;
        packScaleX = 1;
        packScaleY = 1;
      } else if (phase === 'shake') {
        // Shake — gentler: lower freq ceiling, smaller amplitude
        const freq = 6 + shakeIntensity * 22;
        const ampX = shakeIntensity * 5;
        const ampR = shakeIntensity * 3.5;
        packX = Math.sin(elapsed * freq) * ampX;
        packY = Math.cos(elapsed * freq * 0.7) * ampX * 0.3;
        packRot = Math.sin(elapsed * freq * 1.1) * ampR;

        // Squash/stretch from velocity — subtler
        const velocity = packX - prevPackX;
        const squashAmount = Math.min(Math.abs(velocity) * 0.003 * shakeIntensity, 0.025);
        packScaleX = 1 + squashAmount;
        packScaleY = 1 - squashAmount;
        prevPackX = packX;
      }
      // tear/burst/reveal: pack is hidden, values don't matter

      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    if (rafId !== null) cancelAnimationFrame(rafId);
  });

  async function openPack() {
    if (phase !== 'idle') return;

    // When onrequestopen is provided, fetch cards from it; otherwise use local pool
    if (onrequestopen) {
      // Start animation immediately, fetch in parallel
      flippedCards = [false, false, false];
      cardVisible = [false, false, false];
      impactFlash = [false, false, false];
      impactPuffs = [false, false, false];

      const fetchPromise = onrequestopen();

      // Shake phase runs while we fetch
      phase = 'shake';
      shakeIntensity = 0;
      spawnWindStreaks();
      const shakeStart = performance.now();
      const shakeDuration = 2000;
      const [result] = await Promise.all([
        fetchPromise,
        new Promise<void>((resolve) => {
          function tick(now: number) {
            const elapsed = now - shakeStart;
            const t = Math.min(1, elapsed / shakeDuration);
            shakeIntensity = t * t * t;
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
          }
          requestAnimationFrame(tick);
        }),
      ]);

      if (result.characters.length === 0) {
        resetToIdle();
        return;
      }

      packCards = result.characters;
      images = result.images;

      // Continue to tear phase (skip the shake section below)
      await doTearBurstReveal();
      return;
    }

    if (characters.length === 0) return;

    packCards = pickThreeCards();
    flippedCards = [false, false, false];
    cardVisible = [false, false, false];
    impactFlash = [false, false, false];
    impactPuffs = [false, false, false];

    // Shake phase — buildup from gentle to intense over 2s
    phase = 'shake';
    shakeIntensity = 0;
    spawnWindStreaks();
    const shakeStart = performance.now();
    const shakeDuration = 2000;
    await new Promise<void>((resolve) => {
      function tick(now: number) {
        const elapsed = now - shakeStart;
        const t = Math.min(1, elapsed / shakeDuration);
        // Ease-in: slow at first, aggressive at end
        shakeIntensity = t * t * t;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });

    await doTearBurstReveal();
  }

  async function doTearBurstReveal() {
    // Tear phase
    phase = 'tear';
    windStreaks = [];
    tearProgress = 0;
    const tearStart = performance.now();
    const tearDuration = 500;
    await new Promise<void>((resolve) => {
      function tick(now: number) {
        const elapsed = now - tearStart;
        const t = Math.min(1, elapsed / tearDuration);
        tearProgress = 1 - Math.pow(1 - t, 3);
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });

    // Burst phase — dramatic pause then layered explosion
    phase = 'burst';
    burstFired = false;
    await wait(200); // longer anticipation hold — screen dims, tension builds
    burstFired = true;

    // Let the explosion breathe — full bloom plays out ~1.6s total
    await wait(1000);

    // Reveal phase — cards ground-pound in one at a time
    phase = 'reveal';
    for (let i = 0; i < packCards.length; i++) {
      await wait(400);
      cardVisible[i] = true;
      // Wait for the slam to hit (card falls for ~300ms)
      await wait(300);
      // Ground-pound impact: camera shake + flash + wind puffs
      screenShake = true;
      impactFlash[i] = true;
      impactPuffs[i] = true;
      setTimeout(() => { screenShake = false; }, 400);
      setTimeout(() => { impactFlash[i] = false; }, 350);
      setTimeout(() => { impactPuffs[i] = false; }, 800);
    }

    phase = 'done';
  }

  function flipCard(index: number) {
    if (flippedCards[index]) return;
    flippedCards[index] = true;

    const char = packCards[index];
    if (!char) return;

    if (char.rarity === 'legendary') {
      legendaryCardIndex = index;
      legendaryFlash = true;
      screenShake = true;
      setTimeout(() => { legendaryFlash = false; legendaryCardIndex = -1; }, 1000);
      setTimeout(() => { screenShake = false; }, 600);
    }
  }

  function spawnWindStreaks() {
    const colors = ['rgba(253,181,206,0.3)', 'rgba(59,151,151,0.25)', 'rgba(176,106,255,0.2)', 'rgba(255,255,255,0.15)'];
    const streaks: typeof windStreaks = [];
    for (let i = 0; i < 20; i++) {
      const side = Math.floor(Math.random() * 4);
      let x: number, y: number, angle: number;
      switch (side) {
        case 0: x = 20 + Math.random() * 60; y = -5; angle = 80 + Math.random() * 20; break;
        case 1: x = 105; y = 20 + Math.random() * 60; angle = 170 + Math.random() * 20; break;
        case 2: x = 20 + Math.random() * 60; y = 105; angle = 260 + Math.random() * 20; break;
        default: x = -5; y = 20 + Math.random() * 60; angle = 350 + Math.random() * 20; break;
      }
      streaks.push({
        id: debrisIdCounter++,
        x, y, angle,
        length: 40 + Math.random() * 80,
        speed: 0.6 + Math.random() * 1.2,
        delay: Math.random() * 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    windStreaks = streaks;
  }

  function resetToIdle() {
    phase = 'idle';
    packCards = [];
    flippedCards = [false, false, false];
    cardVisible = [false, false, false];
    burstFired = false;
    windStreaks = [];
    tearProgress = 0;
    shakeIntensity = 0;
    legendaryFlash = false;
    legendaryCardIndex = -1;
    impactFlash = [false, false, false];
    impactPuffs = [false, false, false];
  }

  function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  let showPack = $derived(phase === 'idle' || phase === 'shake' || phase === 'tear');
</script>

<div class="pack-opener" class:screen-shake={screenShake} data-testid="pack-opener" data-phase={phase}>
  <!-- Wind streaks during shake -->
  {#if phase === 'shake'}
    <div class="wind-layer">
      {#each windStreaks as s (s.id)}
        <div
          class="wind-streak"
          style="
            left: {s.x}%;
            top: {s.y}%;
            --angle: {s.angle}deg;
            --length: {s.length}px;
            --speed: {s.speed}s;
            --delay: {s.delay}s;
            --color: {s.color};
            --intensity: {shakeIntensity};
          "
        ></div>
      {/each}
    </div>
  {/if}

  <!-- Pack — JS-driven transform, never teleports -->
  {#if showPack}
    <div class="pack-scene">
      <button
        class="pack-wrapper"
        class:is-idle={phase === 'idle'}
        onclick={openPack}
        disabled={phase !== 'idle'}
        data-testid="open-pack-btn"
      >
        {#if phase !== 'tear'}
          <div
            class="pack-float"
            style="transform: translate({packX}px, {packY}px) rotate({packRot}deg) scaleX({packScaleX}) scaleY({packScaleY});"
          >
            <div class="pack-glow" style={phase === 'shake' ? `opacity: ${0.3 + shakeIntensity * 0.7}; transform: scale(${1 + shakeIntensity * 0.25});` : ''}></div>
            <div class="pack-body">
              <div class="foil-shimmer" style={phase === 'shake' ? `animation-duration: ${Math.max(0.25, 4 - shakeIntensity * 3.75)}s;` : ''}></div>
              <div class="foil-holo"></div>
              <div class="pack-content">
                <div class="pack-top-accent"></div>
                <div class="pack-brand-line1"><span class="brand-glaze">GLAZE</span></div>
                <div class="pack-brand-line2"><span class="brand-boost">BOOST</span></div>
                <div class="pack-divider"></div>
                <div class="pack-subtitle">BOOSTER PACK</div>
                <div class="pack-card-count">3 CARDS</div>
                <div class="pack-bottom-accent"></div>
              </div>
              <div
                class="tear-line"
                style={phase === 'shake' ? `box-shadow: 0 0 ${shakeIntensity * 14}px rgba(255,255,255,${shakeIntensity * 0.6}); opacity: ${0.3 + shakeIntensity * 0.7};` : ''}
              ></div>
            </div>
            {#if phase === 'idle'}
              <div class="mote mote-1"><svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5z"/></svg></div>
              <div class="mote mote-2"><svg viewBox="0 0 24 24" fill="currentColor" width="8" height="8"><path d="M12 8a4 4 0 100 8 4 4 0 000-8z"/><path d="M10.5 2h3l.5 3 2.2.9 2.3-1.8 2.1 2.1-1.8 2.3.9 2.2 3 .5v3l-3 .5-.9 2.2 1.8 2.3-2.1 2.1-2.3-1.8-2.2.9-.5 3h-3l-.5-3-2.2-.9-2.3 1.8-2.1-2.1 1.8-2.3-.9-2.2-3-.5v-3l3-.5.9-2.2L3.8 5.5 5.9 3.4l2.3 1.8L10.4 4.3z" opacity="0.85"/></svg></div>
              <div class="mote mote-3"><svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg></div>
              <div class="mote mote-4"><svg viewBox="0 0 24 24" fill="currentColor" width="7" height="7"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg></div>
              <div class="mote mote-5"><svg viewBox="0 0 24 24" fill="currentColor" width="9" height="9"><path d="M12 8a4 4 0 100 8 4 4 0 000-8z"/><path d="M10.5 2h3l.5 3 2.2.9 2.3-1.8 2.1 2.1-1.8 2.3.9 2.2 3 .5v3l-3 .5-.9 2.2 1.8 2.3-2.1 2.1-2.3-1.8-2.2.9-.5 3h-3l-.5-3-2.2-.9-2.3 1.8-2.1-2.1 1.8-2.3-.9-2.2-3-.5v-3l3-.5.9-2.2L3.8 5.5 5.9 3.4l2.3 1.8L10.4 4.3z" opacity="0.85"/></svg></div>
            {/if}
          </div>
        {:else}
          <div class="pack-tearing" style="--tear: {tearProgress};">
            <div class="pack-glow pack-glow-tear"></div>
            <div class="pack-half pack-half-left">
              <div class="pack-body">
                <div class="foil-shimmer"></div>
                <div class="foil-holo"></div>
                <div class="pack-content">
                  <div class="pack-top-accent"></div>
                  <div class="pack-brand-line1"><span class="brand-glaze">GLAZE</span></div>
                  <div class="pack-brand-line2"><span class="brand-boost">BOOST</span></div>
                  <div class="pack-divider"></div>
                  <div class="pack-subtitle">BOOSTER PACK</div>
                  <div class="pack-card-count">3 CARDS</div>
                  <div class="pack-bottom-accent"></div>
                </div>
              </div>
            </div>
            <div class="pack-half pack-half-right">
              <div class="pack-body">
                <div class="foil-shimmer"></div>
                <div class="foil-holo"></div>
                <div class="pack-content">
                  <div class="pack-top-accent"></div>
                  <div class="pack-brand-line1"><span class="brand-glaze">GLAZE</span></div>
                  <div class="pack-brand-line2"><span class="brand-boost">BOOST</span></div>
                  <div class="pack-divider"></div>
                  <div class="pack-subtitle">BOOSTER PACK</div>
                  <div class="pack-card-count">3 CARDS</div>
                  <div class="pack-bottom-accent"></div>
                </div>
              </div>
            </div>
            <div class="tear-light"></div>
          </div>
        {/if}
      </button>
      {#if phase === 'idle'}
        <div class="open-hint">Click to open</div>
      {/if}
    </div>
  {/if}

  {#if phase === 'burst'}
    <div class="burst-state">
      <div class="burst-dim"></div>
      {#if burstFired}
        <div class="bloom-core"></div>
        <div class="bloom-mid"></div>
        <div class="bloom-outer"></div>
        <div class="bloom-haze"></div>
        <div class="bloom-ring bloom-ring-1"></div>
        <div class="bloom-ring bloom-ring-2"></div>
        <div class="bloom-ring bloom-ring-3"></div>
        <div class="bloom-streaks"></div>
        <div class="bloom-sparkle bloom-sparkle-1"></div>
        <div class="bloom-sparkle bloom-sparkle-2"></div>
        <div class="bloom-sparkle bloom-sparkle-3"></div>
      {/if}
    </div>
  {/if}

  {#if phase === 'reveal' || phase === 'done'}
    <div class="cards-container" data-testid="cards-container">
      {#each packCards as char, i}
        <div class="card-slot" class:visible={cardVisible[i]} style="--card-index: {i};" data-testid="card-slot">
          <!-- Ground-pound impact flash -->
          {#if impactFlash[i]}
            <div class="impact-flash"></div>
          {/if}
          <!-- Ground-pound wind puffs -->
          {#if impactPuffs[i]}
            <div class="impact-puffs">
              <div class="puff puff-l"></div>
              <div class="puff puff-r"></div>
              <div class="puff puff-cl"></div>
              <div class="puff puff-cr"></div>
            </div>
          {/if}
          <!-- Legendary flash — positioned relative to this card -->
          {#if legendaryFlash && legendaryCardIndex === i}
            <div class="legendary-flash" data-testid="legendary-flash">
              <div class="legendary-flash-dim"></div>
              <div class="legendary-flash-inner"></div>
              <div class="legendary-flash-outer"></div>
              <div class="legendary-flash-ring"></div>
            </div>
          {/if}
          <CharacterCard
            character={char}
            flipped={flippedCards[i]}
            onflip={() => flipCard(i)}
            image={images[char.id]}
          />
        </div>
      {/each}
    </div>

    {#if phase === 'done'}
      <div class="bottom-actions" class:visible={allFlipped}>
        <button class="action-btn" onclick={resetToIdle} data-testid="continue-btn">
          Open Another
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .pack-opener {
    /* Physics-based spring curves via linear() */
    --ease-spring: linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%, 0.938,
      1.077 20.4%, 1.121, 1.149 24.3%, 1.163 27%, 1.154, 1.129 32.8%,
      1.017 43.1%, 0.991, 0.977 51%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1);

    --ease-arrive: linear(0, 0.009 1.2%, 0.2 4.5%, 0.567 9.7%, 0.847 15.1%,
      0.997 20.9%, 1.08 26%, 1.1 28.4%, 1.093 33.5%, 1.03 47.3%,
      1.005 60%, 0.998 72%, 1);

    --ease-bounce: linear(0, 0.004, 0.016, 0.035, 0.063 9.1%, 0.141, 0.25,
      0.391, 0.563, 0.765, 1, 0.891, 0.813 45.5%, 0.785, 0.766, 0.754, 0.75,
      0.754, 0.766, 0.785, 0.813 63.6%, 0.891, 1 72.7%, 0.973, 0.953, 0.941,
      0.938, 0.941, 0.953, 0.973, 1, 0.988, 0.984, 0.988, 1);

    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    gap: var(--space-4);
    overflow: hidden;
  }

  /* ── Screen shake for legendary — spring decay ── */
  .screen-shake {
    animation: screenShake 0.6s var(--ease-spring);
  }

  @keyframes screenShake {
    0% { transform: translate(0, 0) scale(1); }
    15% { transform: translate(6px, -4px) scale(1.02); }
    35% { transform: translate(-4px, 3px) scale(1.01); }
    55% { transform: translate(2px, -2px); }
    100% { transform: translate(0, 0) scale(1); }
  }

  /* ── Legendary flash — centered on the card that triggered it ── */
  .legendary-flash {
    position: absolute;
    inset: -200px;
    z-index: 50;
    pointer-events: none;
  }

  .legendary-flash-dim {
    position: absolute;
    inset: -400px;
    background: rgba(0, 0, 0, 0.15);
    animation: legendaryDim 1s ease-out forwards;
  }

  @keyframes legendaryDim {
    0% { opacity: 1; }
    25% { opacity: 1; }
    100% { opacity: 0; }
  }

  .legendary-flash-inner {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 50%, rgba(255, 215, 0, 0.95), rgba(255, 180, 0, 0.5) 25%, transparent 50%);
    animation: legendaryFlashIn 0.7s var(--ease-arrive) forwards;
  }

  @keyframes legendaryFlashIn {
    0% { opacity: 0; transform: scale(0.3); }
    12% { opacity: 1; }
    35% { opacity: 0.85; }
    100% { opacity: 0; transform: scale(1.5); }
  }

  .legendary-flash-outer {
    position: absolute;
    inset: -100px;
    background: radial-gradient(circle at 50% 50%, rgba(255, 170, 0, 0.4), rgba(255, 140, 0, 0.15) 35%, transparent 65%);
    animation: legendaryFlashOut 1s var(--ease-arrive) forwards;
  }

  @keyframes legendaryFlashOut {
    0% { opacity: 0; transform: scale(0.4); }
    15% { opacity: 0.8; }
    40% { opacity: 0.6; }
    100% { opacity: 0; transform: scale(2); }
  }

  .legendary-flash-ring {
    position: absolute;
    inset: 50px;
    border-radius: 50%;
    background: radial-gradient(circle, transparent 40%, rgba(255, 215, 0, 0.3) 50%, transparent 60%);
    animation: legendaryRing 0.8s 0.05s var(--ease-arrive) forwards;
    opacity: 0;
  }

  @keyframes legendaryRing {
    0% { opacity: 0; transform: scale(0.2); }
    15% { opacity: 0.7; }
    100% { opacity: 0; transform: scale(3); }
  }

  /* ══════════════════════════════════════════
     WIND STREAKS — Anime-style rush lines
     ══════════════════════════════════════════ */
  .wind-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    overflow: hidden;
  }

  .wind-streak {
    position: absolute;
    width: var(--length);
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--color), transparent);
    transform: rotate(var(--angle));
    transform-origin: center;
    opacity: 0;
    animation: windRush var(--speed) var(--delay) linear infinite;
    filter: blur(0.5px);
  }

  @keyframes windRush {
    0% {
      opacity: 0;
      transform: rotate(var(--angle)) translateX(60px) scaleX(0.3);
    }
    15% {
      opacity: calc(var(--intensity) * 0.8);
    }
    50% {
      opacity: calc(var(--intensity) * 0.6);
      transform: rotate(var(--angle)) translateX(-20px) scaleX(1);
    }
    85% {
      opacity: calc(var(--intensity) * 0.3);
    }
    100% {
      opacity: 0;
      transform: rotate(var(--angle)) translateX(-80px) scaleX(0.2);
    }
  }

  /* ══════════════════════════════════════════
     PACK SCENE
     ══════════════════════════════════════════ */
  .pack-scene {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .pack-wrapper {
    background: none;
    border: none;
    cursor: pointer;
    padding: 30px;
    position: relative;
    outline: none;
    font-family: inherit;
  }

  .pack-wrapper:disabled {
    cursor: default;
  }

  .pack-float {
    position: relative;
    will-change: transform;
  }

  /* Hover only in idle */
  .is-idle:hover .pack-float {
    filter: brightness(1.05);
  }

  .is-idle:hover .pack-glow {
    opacity: 0.8 !important;
    transform: scale(1.15) !important;
  }

  /* ── Pack glow ── */
  .pack-glow {
    position: absolute;
    inset: -40px;
    border-radius: 30px;
    background: radial-gradient(ellipse, rgba(253, 181, 206, 0.25), transparent 70%);
    opacity: 0.5;
    transition: opacity var(--transition-base), transform var(--transition-base);
    z-index: -1;
    filter: blur(12px);
  }

  .pack-glow-tear {
    position: absolute;
    inset: -40px;
    border-radius: 30px;
    opacity: 1;
    background: radial-gradient(ellipse, rgba(255, 255, 255, 0.6), rgba(253, 181, 206, 0.3) 40%, transparent 80%);
    transform: scale(1.3);
    filter: blur(12px);
    z-index: -1;
  }

  /* ── Pack body ── */
  .pack-body {
    position: relative;
    width: 220px;
    height: 320px;
    border-radius: 16px;
    background: linear-gradient(135deg, #1a1040 0%, #0d0820 30%, #1a0a35 60%, #0a0618 100%);
    border: 2px solid rgba(253, 181, 206, 0.3);
    overflow: hidden;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.5),
      0 2px 8px rgba(253, 181, 206, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  /* ── Foil shimmer ── */
  .foil-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(253, 181, 206, 0.08) 38%,
      rgba(255, 255, 255, 0.14) 42%,
      rgba(176, 106, 255, 0.08) 46%,
      transparent 54%
    );
    background-size: 300% 100%;
    animation: foilSweep 4s ease-in-out infinite;
    z-index: 2;
    pointer-events: none;
  }

  @keyframes foilSweep {
    0% { background-position: 200% 0; }
    100% { background-position: -100% 0; }
  }

  /* ── Holographic foil ── */
  .foil-holo {
    position: absolute;
    inset: 0;
    background:
      conic-gradient(
        from 0deg at 30% 30%,
        transparent 0deg,
        rgba(253, 181, 206, 0.06) 30deg,
        transparent 60deg,
        rgba(59, 151, 151, 0.04) 120deg,
        transparent 150deg,
        rgba(176, 106, 255, 0.06) 210deg,
        transparent 240deg,
        rgba(255, 215, 0, 0.04) 300deg,
        transparent 330deg
      );
    animation: holoSpin 12s linear infinite;
    z-index: 1;
    pointer-events: none;
  }

  @keyframes holoSpin {
    from { filter: hue-rotate(0deg); }
    to { filter: hue-rotate(360deg); }
  }

  /* ── Pack content ── */
  .pack-content {
    position: relative;
    z-index: 3;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-0-5);
    padding: var(--space-5);
  }

  .pack-top-accent {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, transparent, var(--color-pink, #FDB5CE), transparent);
    opacity: 0.6;
  }

  .pack-brand-line1, .pack-brand-line2 {
    line-height: 1;
    text-align: center;
  }

  .pack-brand-line2 {
    margin-top: -2px;
  }

  .brand-glaze {
    font-size: 2.4rem;
    font-weight: 900;
    letter-spacing: 6px;
    color: var(--color-pink, #FDB5CE);
    text-shadow: 0 2px 20px rgba(253, 181, 206, 0.5), 0 0 40px rgba(253, 181, 206, 0.15);
  }

  .brand-boost {
    font-size: 2.4rem;
    font-weight: 900;
    letter-spacing: 6px;
    color: var(--color-teal, #3B9797);
    text-shadow: 0 2px 20px rgba(59, 151, 151, 0.5), 0 0 40px rgba(59, 151, 151, 0.15);
  }

  .pack-divider {
    width: 60%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(253, 181, 206, 0.35), transparent);
    margin: var(--space-2) 0;
  }

  .pack-subtitle {
    font-size: 0.7rem;
    letter-spacing: 5px;
    color: rgba(255, 255, 255, 0.55);
    font-weight: 600;
    text-transform: uppercase;
  }

  .pack-card-count {
    font-size: var(--font-brand-md);
    letter-spacing: 4px;
    color: rgba(255, 255, 255, 0.45);
    font-weight: 600;
    margin-top: var(--space-0-5);
  }

  .pack-bottom-accent {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, transparent, var(--color-teal, #3B9797), transparent);
    opacity: 0.4;
  }

  /* ── Tear line ── */
  .tear-line {
    position: absolute;
    top: 50%;
    left: 8%;
    right: 8%;
    height: 1px;
    background: repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.2) 0px,
      rgba(255, 255, 255, 0.2) 6px,
      transparent 6px,
      transparent 12px
    );
    z-index: 4;
    transform: translateY(-0.5px);
  }

  /* ── Ambient motes — smooth ease-in-out for loops ── */
  .mote {
    position: absolute;
    animation: moteFloat 3s ease-in-out infinite;
    opacity: 0;
  }

  .mote svg { display: block; }

  .mote-1 { top: 5%; left: -24px; animation-delay: 0s; animation-duration: 3.2s; color: rgba(253, 181, 206, 0.5); filter: drop-shadow(0 0 3px rgba(253, 181, 206, 0.3)); }
  .mote-2 { top: 25%; right: -20px; animation-delay: 0.6s; animation-duration: 3.8s; color: rgba(59, 151, 151, 0.5); filter: drop-shadow(0 0 3px rgba(59, 151, 151, 0.3)); }
  .mote-3 { bottom: 30%; left: -28px; animation-delay: 1.2s; animation-duration: 3.5s; color: rgba(176, 106, 255, 0.5); filter: drop-shadow(0 0 3px rgba(176, 106, 255, 0.3)); }
  .mote-4 { bottom: 15%; right: -18px; animation-delay: 1.8s; animation-duration: 4s; color: rgba(253, 181, 206, 0.4); filter: drop-shadow(0 0 3px rgba(253, 181, 206, 0.2)); }
  .mote-5 { top: 50%; left: -22px; animation-delay: 0.3s; animation-duration: 3.6s; color: rgba(255, 215, 0, 0.4); filter: drop-shadow(0 0 3px rgba(255, 215, 0, 0.2)); }

  @keyframes moteFloat {
    0%, 100% { opacity: 0; transform: translateY(8px) rotate(0deg) scale(0.7); }
    20% { opacity: 0.7; }
    50% { opacity: 0.9; transform: translateY(-8px) rotate(30deg) scale(1); }
    80% { opacity: 0.6; }
  }

  .open-hint {
    margin-top: var(--space-5);
    font-size: var(--font-md);
    color: rgba(255, 255, 255, 0.55);
    letter-spacing: 2px;
    animation: hintPulse 2.5s ease-in-out infinite;
    text-align: center;
    font-weight: 500;
    text-transform: uppercase;
  }

  @keyframes hintPulse {
    0%, 100% { opacity: 0.45; }
    50% { opacity: 0.85; }
  }

  /* ══════════════════════════════════════════
     TEAR STATE
     ══════════════════════════════════════════ */
  .pack-tearing {
    position: relative;
    width: 220px;
    height: 320px;
  }

  .pack-half {
    position: absolute;
    width: 220px;
    height: 320px;
    overflow: hidden;
  }

  .pack-half .pack-body { border-radius: 16px; }

  .pack-half-left {
    clip-path: inset(0 50% 0 0);
    transform: translateX(calc(var(--tear, 0) * -60px)) rotate(calc(var(--tear, 0) * -12deg));
    transform-origin: left center;
    opacity: calc(1 - var(--tear, 0) * 0.7);
  }

  .pack-half-right {
    clip-path: inset(0 0 0 50%);
    transform: translateX(calc(var(--tear, 0) * 60px)) rotate(calc(var(--tear, 0) * 12deg));
    transform-origin: right center;
    opacity: calc(1 - var(--tear, 0) * 0.7);
  }

  .tear-light {
    position: absolute;
    top: 20%;
    left: 50%;
    width: 4px;
    height: 60%;
    background: white;
    transform: translateX(-50%) scaleX(calc(1 + var(--tear, 0) * 30));
    opacity: calc(var(--tear, 0) * 0.9);
    filter: blur(calc(var(--tear, 0) * 12px));
    border-radius: 50%;
    z-index: 5;
  }

  /* ══════════════════════════════════════════
     BURST STATE — Layered bloom + rings + sparkles
     ══════════════════════════════════════════ */
  .burst-state {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    overflow: visible;
    pointer-events: none;
  }

  /* Anticipation dim — darkening before the bloom fires */
  .burst-dim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    animation: burstDim 0.6s ease-out forwards;
  }

  @keyframes burstDim {
    0% { opacity: 0; }
    10% { opacity: 0.2; }
    30% { opacity: 0.2; }
    100% { opacity: 0; }
  }

  /* Core bloom — tight bright white flash */
  .bloom-core {
    position: absolute;
    width: 150px;
    height: 150px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0.7) 35%, transparent 65%);
    animation: bloomCore 0.8s var(--ease-arrive) forwards;
    opacity: 0;
    mix-blend-mode: screen;
  }

  @keyframes bloomCore {
    0% { opacity: 0; transform: scale(0.3); }
    10% { opacity: 1; }
    25% { opacity: 0.95; transform: scale(1); }
    50% { opacity: 0.6; }
    100% { opacity: 0; transform: scale(1.4); }
  }

  /* Mid bloom — soft pink-white, slower */
  .bloom-mid {
    position: absolute;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 230, 240, 0.8), rgba(253, 181, 206, 0.35) 40%, transparent 70%);
    animation: bloomMid 1.1s 0.05s var(--ease-arrive) forwards;
    opacity: 0;
    mix-blend-mode: screen;
    filter: blur(10px);
  }

  @keyframes bloomMid {
    0% { opacity: 0; transform: scale(0.2); }
    12% { opacity: 0.85; }
    30% { opacity: 0.7; transform: scale(1); }
    55% { opacity: 0.35; }
    100% { opacity: 0; transform: scale(1.6); }
  }

  /* Outer bloom — wide atmospheric haze */
  .bloom-outer {
    position: absolute;
    width: 800px;
    height: 800px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(200, 160, 220, 0.45), rgba(176, 106, 255, 0.18) 30%, rgba(253, 181, 206, 0.1) 50%, transparent 70%);
    animation: bloomOuter 1.4s 0.08s var(--ease-arrive) forwards;
    opacity: 0;
    mix-blend-mode: screen;
    filter: blur(25px);
  }

  @keyframes bloomOuter {
    0% { opacity: 0; transform: scale(0.15); }
    10% { opacity: 0.5; }
    25% { opacity: 0.45; transform: scale(0.8); }
    50% { opacity: 0.25; }
    100% { opacity: 0; transform: scale(2.2); }
  }

  /* Lingering haze — stays visible longest, atmospheric */
  .bloom-haze {
    position: absolute;
    width: 1000px;
    height: 1000px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(253, 181, 206, 0.12), rgba(176, 106, 255, 0.06) 40%, transparent 65%);
    animation: bloomHaze 2s 0.1s ease-out forwards;
    opacity: 0;
    mix-blend-mode: screen;
    filter: blur(40px);
  }

  @keyframes bloomHaze {
    0% { opacity: 0; transform: scale(0.3); }
    15% { opacity: 0.4; }
    35% { opacity: 0.3; transform: scale(1.2); }
    65% { opacity: 0.15; }
    100% { opacity: 0; transform: scale(2.5); }
  }

  /* Soft expanding rings — radial-gradient based, not bordered circles */
  .bloom-ring {
    position: absolute;
    border-radius: 50%;
    mix-blend-mode: screen;
    opacity: 0;
  }

  .bloom-ring-1 {
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, transparent 45%, rgba(255, 255, 255, 0.25) 50%, transparent 55%);
    animation: bloomRing 1s 0.02s var(--ease-arrive) forwards;
  }

  .bloom-ring-2 {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, transparent 45%, rgba(253, 181, 206, 0.2) 49%, rgba(255, 255, 255, 0.15) 51%, transparent 55%);
    animation: bloomRing 1.2s 0.1s var(--ease-arrive) forwards;
    filter: blur(3px);
  }

  .bloom-ring-3 {
    width: 700px;
    height: 700px;
    background: radial-gradient(circle, transparent 44%, rgba(176, 106, 255, 0.12) 48%, rgba(253, 181, 206, 0.08) 52%, transparent 56%);
    animation: bloomRing 1.5s 0.18s var(--ease-arrive) forwards;
    filter: blur(6px);
  }

  @keyframes bloomRing {
    0% { opacity: 0; transform: scale(0.1); }
    12% { opacity: 1; }
    30% { opacity: 0.7; }
    100% { opacity: 0; transform: scale(3); }
  }

  /* Light streaks — conic-gradient thin wedges */
  .bloom-streaks {
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      transparent 0deg,
      rgba(255, 255, 255, 0.18) 3deg,
      transparent 6deg,
      transparent 30deg,
      rgba(255, 255, 255, 0.12) 33deg,
      transparent 36deg,
      transparent 60deg,
      rgba(255, 255, 255, 0.15) 63deg,
      transparent 66deg,
      transparent 90deg,
      rgba(255, 255, 255, 0.1) 93deg,
      transparent 96deg,
      transparent 120deg,
      rgba(255, 255, 255, 0.16) 123deg,
      transparent 126deg,
      transparent 150deg,
      rgba(255, 255, 255, 0.11) 153deg,
      transparent 156deg,
      transparent 180deg,
      rgba(255, 255, 255, 0.14) 183deg,
      transparent 186deg,
      transparent 210deg,
      rgba(255, 255, 255, 0.1) 213deg,
      transparent 216deg,
      transparent 240deg,
      rgba(255, 255, 255, 0.17) 243deg,
      transparent 246deg,
      transparent 270deg,
      rgba(255, 255, 255, 0.09) 273deg,
      transparent 276deg,
      transparent 300deg,
      rgba(255, 255, 255, 0.13) 303deg,
      transparent 306deg,
      transparent 330deg,
      rgba(255, 255, 255, 0.11) 333deg,
      transparent 336deg,
      transparent 360deg
    );
    animation: bloomStreaks 1s 0.03s var(--ease-arrive) forwards;
    opacity: 0;
    mix-blend-mode: screen;
  }

  @keyframes bloomStreaks {
    0% { opacity: 0; transform: scale(0.3) rotate(0deg); }
    12% { opacity: 0.85; }
    35% { opacity: 0.5; }
    100% { opacity: 0; transform: scale(4) rotate(25deg); }
  }

  /* Sparkle motes — small bright points that drift outward */
  .bloom-sparkle {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.8), 0 0 20px rgba(253, 181, 206, 0.4);
    mix-blend-mode: screen;
    opacity: 0;
  }

  .bloom-sparkle-1 {
    animation: sparkle1 1.2s 0.08s ease-out forwards;
  }

  .bloom-sparkle-2 {
    animation: sparkle2 1s 0.15s ease-out forwards;
  }

  .bloom-sparkle-3 {
    animation: sparkle3 1.1s 0.05s ease-out forwards;
  }

  @keyframes sparkle1 {
    0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
    10% { opacity: 1; }
    100% { opacity: 0; transform: translate(-120px, -80px) scale(0.2); }
  }

  @keyframes sparkle2 {
    0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
    12% { opacity: 1; }
    100% { opacity: 0; transform: translate(100px, -60px) scale(0.2); }
  }

  @keyframes sparkle3 {
    0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
    10% { opacity: 1; }
    100% { opacity: 0; transform: translate(80px, 90px) scale(0.2); }
  }

  /* ══════════════════════════════════════════
     REVEAL / DONE — Cards with bounce easing
     ══════════════════════════════════════════ */
  .cards-container {
    display: flex;
    gap: var(--space-5);
    justify-content: center;
    align-items: flex-end;
    padding: var(--space-5);
  }

  .card-slot {
    position: relative;
    transform-origin: center bottom;
    opacity: 0;
  }

  .card-slot.visible {
    opacity: 1;
    animation: cardSlam 0.35s cubic-bezier(0.45, 0, 0.85, 0.25);
  }

  @keyframes cardSlam {
    0% {
      opacity: 0;
      transform: translateY(-550px) scaleX(0.92) scaleY(1.18);
    }
    60% {
      opacity: 1;
      transform: translateY(-80px) scaleX(0.92) scaleY(1.14);
    }
    78% {
      opacity: 1;
      transform: translateY(0) scaleX(1.14) scaleY(0.82);
    }
    90% {
      transform: translateY(0) scaleX(0.97) scaleY(1.04);
    }
    100% {
      transform: translateY(0) scaleX(1) scaleY(1);
    }
  }

  /* ── Ground-pound impact flash ── */
  .impact-flash {
    position: absolute;
    left: -40px;
    right: -40px;
    bottom: -30px;
    height: 80px;
    z-index: 40;
    pointer-events: none;
    background: radial-gradient(ellipse at center 70%,
      rgba(255, 255, 255, 0.95) 0%,
      rgba(255, 230, 190, 0.6) 25%,
      rgba(255, 200, 140, 0.2) 55%,
      transparent 80%
    );
    animation: impactFlashAnim 0.3s cubic-bezier(0.16, 0.6, 0.4, 1) forwards;
    mix-blend-mode: screen;
    transform-origin: center bottom;
  }

  @keyframes impactFlashAnim {
    0% { opacity: 1; transform: scaleX(0.4) scaleY(0.3); }
    25% { opacity: 1; transform: scaleX(1.3) scaleY(0.8); }
    100% { opacity: 0; transform: scaleX(1.8) scaleY(1.2); }
  }

  /* ── Ground-pound wind puffs ── */
  .impact-puffs {
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 0;
    height: 0;
    z-index: 30;
    pointer-events: none;
  }

  .puff {
    position: absolute;
    bottom: 0;
    width: 36px;
    height: 20px;
    border-radius: 50%;
    background: radial-gradient(ellipse at center,
      rgba(255, 255, 255, 0.4) 0%,
      rgba(210, 220, 240, 0.2) 50%,
      transparent 100%
    );
  }

  .puff-l {
    animation: puffLeft 0.6s cubic-bezier(0.16, 0.6, 0.4, 1) forwards;
  }
  .puff-r {
    animation: puffRight 0.6s cubic-bezier(0.16, 0.6, 0.4, 1) forwards;
  }
  .puff-cl {
    animation: puffCenterLeft 0.55s cubic-bezier(0.16, 0.6, 0.4, 1) 0.04s forwards;
    opacity: 0;
  }
  .puff-cr {
    animation: puffCenterRight 0.55s cubic-bezier(0.16, 0.6, 0.4, 1) 0.04s forwards;
    opacity: 0;
  }

  @keyframes puffLeft {
    0% { opacity: 0.8; transform: translate(0, 0) scale(0.3); }
    35% { opacity: 0.7; }
    100% { opacity: 0; transform: translate(-110px, -15px) scale(2) rotate(-12deg); }
  }

  @keyframes puffRight {
    0% { opacity: 0.8; transform: translate(0, 0) scale(0.3); }
    35% { opacity: 0.7; }
    100% { opacity: 0; transform: translate(110px, -15px) scale(2) rotate(12deg); }
  }

  @keyframes puffCenterLeft {
    0% { opacity: 0.6; transform: translate(0, 0) scale(0.2); }
    25% { opacity: 0.5; }
    100% { opacity: 0; transform: translate(-65px, -30px) scale(1.5) rotate(-6deg); }
  }

  @keyframes puffCenterRight {
    0% { opacity: 0.6; transform: translate(0, 0) scale(0.2); }
    25% { opacity: 0.5; }
    100% { opacity: 0; transform: translate(65px, -30px) scale(1.5) rotate(6deg); }
  }

  /* ── Bottom actions — absolutely positioned so it doesn't shift card layout ── */
  .bottom-actions {
    position: absolute;
    bottom: var(--space-6);
    left: 50%;
    transform: translateX(-50%) translateY(10px);
    opacity: 0;
    transition: opacity 0.4s var(--ease-arrive), transform 0.4s var(--ease-arrive);
    pointer-events: none;
  }

  .bottom-actions.visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
    pointer-events: auto;
  }

  .action-btn {
    padding: var(--space-3) var(--space-9);
    border: 2px solid rgba(253, 181, 206, 0.3);
    border-radius: var(--radius-2xl);
    background: linear-gradient(135deg, rgba(253, 181, 206, 0.1), rgba(176, 106, 255, 0.08));
    color: var(--color-pink, #FDB5CE);
    font-size: var(--font-lg);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    font-family: inherit;
    letter-spacing: 0.5px;
  }

  .action-btn:hover {
    background: linear-gradient(135deg, rgba(253, 181, 206, 0.2), rgba(176, 106, 255, 0.15));
    border-color: rgba(253, 181, 206, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(253, 181, 206, 0.2);
  }

  .action-btn:active {
    transform: translateY(0);
  }
</style>
