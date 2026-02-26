<script lang="ts">
  import type { GachaCharacter } from '@glazebot/shared-types';
  import CharacterCard from './CharacterCard.svelte';
  import { onMount, onDestroy } from 'svelte';

  type Phase = 'idle' | 'shake' | 'tear' | 'burst' | 'reveal' | 'done';

  interface Props {
    characters?: GachaCharacter[];
    images?: Record<string, string>;
  }

  let { characters = [], images = {} }: Props = $props();

  let phase: Phase = $state('idle');
  let packCards: GachaCharacter[] = $state([]);
  let flippedCards: boolean[] = $state([false, false, false]);
  let cardVisible: boolean[] = $state([false, false, false]);
  let legendaryFlash: boolean = $state(false);
  let screenShake: boolean = $state(false);
  let allFlipped = $derived(flippedCards.every(Boolean));
  let tearProgress = $state(0);
  let shakeIntensity = $state(0);

  // JS-driven pack transform — no CSS animations, no teleporting
  let packX = $state(0);
  let packY = $state(0);
  let packRot = $state(0);
  let packScale = $state(1);
  let rafId: number | null = null;
  let startTime = 0;

  // Burst debris
  let burstDebris: { id: number; x: number; y: number; dx: number; dy: number; delay: number; size: number; shape: string; rot: number; color: string }[] = $state([]);

  // Burst rings — dynamic, varied shockwaves
  let burstRings: { id: number; delay: number; duration: number; size: number; thickness: number; color: string; scaleX: number; scaleY: number; rot: number }[] = $state([]);

  // Wind streaks
  let windStreaks: { id: number; x: number; y: number; angle: number; length: number; speed: number; delay: number; color: string }[] = $state([]);

  let debrisIdCounter = 0;
  const debrisShapes = ['gear', 'bolt', 'spark', 'hex'] as const;

  function randomDebrisShape(): string {
    return debrisShapes[Math.floor(Math.random() * debrisShapes.length)];
  }

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
        packScale = 1;
      } else if (phase === 'shake') {
        // Shake driven by shakeIntensity (set by openPack)
        const freq = 8 + shakeIntensity * 40;
        const ampX = shakeIntensity * 10;
        const ampR = shakeIntensity * 7;
        packX = Math.sin(elapsed * freq) * ampX;
        packY = Math.cos(elapsed * freq * 0.7) * ampX * 0.3;
        packRot = Math.sin(elapsed * freq * 1.1) * ampR;
        packScale = 1;
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
    if (phase !== 'idle' || characters.length === 0) return;

    packCards = pickThreeCards();
    flippedCards = [false, false, false];
    cardVisible = [false, false, false];

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

    // Burst phase
    phase = 'burst';
    spawnBurstDebris();
    await wait(700);

    // Reveal phase
    phase = 'reveal';
    for (let i = 0; i < packCards.length; i++) {
      await wait(280);
      cardVisible[i] = true;
    }

    phase = 'done';
  }

  function flipCard(index: number) {
    if (flippedCards[index]) return;
    flippedCards[index] = true;

    const char = packCards[index];
    if (!char) return;

    if (char.rarity === 'legendary') {
      legendaryFlash = true;
      screenShake = true;
      setTimeout(() => { legendaryFlash = false; }, 400);
      setTimeout(() => { screenShake = false; }, 300);
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

  function spawnBurstDebris() {
    const colors = ['#FDB5CE', '#3B9797', '#B06AFF', '#FFD700', '#fff', '#89CFF0'];
    const debris: typeof burstDebris = [];
    for (let i = 0; i < 35; i++) {
      const angle = (Math.PI * 2 * i) / 35 + (Math.random() - 0.5) * 0.4;
      const speed = 120 + Math.random() * 280;
      debris.push({
        id: debrisIdCounter++,
        x: 50,
        y: 45,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        delay: Math.random() * 0.2,
        size: 8 + Math.random() * 16,
        shape: randomDebrisShape(),
        rot: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    burstDebris = debris;
    setTimeout(() => { burstDebris = []; }, 1600);

    // Spawn shockwave rings — white/near-white only, clean energy pulse
    const rings: typeof burstRings = [
      {
        id: debrisIdCounter++,
        delay: 0,
        duration: 0.7,
        size: 30,
        thickness: 3,
        color: 'rgba(255,255,255,0.8)',
        scaleX: 1,
        scaleY: 0.95,
        rot: 0,
      },
      {
        id: debrisIdCounter++,
        delay: 0.08,
        duration: 0.85,
        size: 50,
        thickness: 1.5,
        color: 'rgba(255,255,255,0.4)',
        scaleX: 0.95,
        scaleY: 1,
        rot: -5,
      },
      {
        id: debrisIdCounter++,
        delay: 0.18,
        duration: 1,
        size: 40,
        thickness: 1,
        color: 'rgba(255,255,255,0.2)',
        scaleX: 1.05,
        scaleY: 0.92,
        rot: 3,
      },
    ];
    burstRings = rings;
    setTimeout(() => { burstRings = []; }, 1400);
  }

  function resetToIdle() {
    phase = 'idle';
    packCards = [];
    flippedCards = [false, false, false];
    cardVisible = [false, false, false];
    burstDebris = [];
    burstRings = [];
    windStreaks = [];
    tearProgress = 0;
    shakeIntensity = 0;
  }

  function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  let showPack = $derived(phase === 'idle' || phase === 'shake' || phase === 'tear');
</script>

<div class="pack-opener" class:screen-shake={screenShake} data-testid="pack-opener" data-phase={phase}>
  {#if legendaryFlash}
    <div class="legendary-flash" data-testid="legendary-flash"></div>
  {/if}

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

  <!-- Burst debris layer -->
  <div class="debris-layer">
    {#each burstDebris as d (d.id)}
      <div
        class="debris"
        style="
          left: {d.x}%;
          top: {d.y}%;
          --dx: {d.dx}px;
          --dy: {d.dy}px;
          --delay: {d.delay}s;
          --size: {d.size}px;
          --rot: {d.rot}deg;
          --color: {d.color};
        "
      >
        {#if d.shape === 'gear'}
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm0 2.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/><path d="M10.5 2h3l.5 3 2.2.9 2.3-1.8 2.1 2.1-1.8 2.3.9 2.2 3 .5v3l-3 .5-.9 2.2 1.8 2.3-2.1 2.1-2.3-1.8-2.2.9-.5 3h-3l-.5-3-2.2-.9-2.3 1.8-2.1-2.1 1.8-2.3-.9-2.2-3-.5v-3l3-.5.9-2.2L3.8 5.5 5.9 3.4l2.3 1.8L10.4 4.3z" opacity="0.85"/></svg>
        {:else if d.shape === 'bolt'}
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>
        {:else if d.shape === 'spark'}
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5z"/></svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
        {/if}
      </div>
    {/each}
  </div>

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
            style="transform: translate({packX}px, {packY}px) rotate({packRot}deg) scale({packScale});"
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
      <div class="burst-flash"></div>
      {#each burstRings as ring (ring.id)}
        <div
          class="burst-ring"
          style="
            --ring-delay: {ring.delay}s;
            --ring-dur: {ring.duration}s;
            --ring-size: {ring.size}px;
            --ring-thick: {ring.thickness}px;
            --ring-color: {ring.color};
            --ring-sx: {ring.scaleX};
            --ring-sy: {ring.scaleY};
            --ring-rot: {ring.rot}deg;
          "
        ></div>
      {/each}
    </div>
  {/if}

  {#if phase === 'reveal' || phase === 'done'}
    <div class="cards-container" data-testid="cards-container">
      {#each packCards as char, i}
        <div class="card-slot" class:visible={cardVisible[i]} style="--card-index: {i};" data-testid="card-slot">
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

  /* ── Screen shake for legendary ── */
  .screen-shake {
    animation: screenShake 0.3s ease-out;
  }

  @keyframes screenShake {
    0%, 100% { transform: translate(0, 0); }
    10% { transform: translate(3px, -3px); }
    20% { transform: translate(-3px, 3px); }
    30% { transform: translate(3px, 3px); }
    40% { transform: translate(-3px, -3px); }
    50% { transform: translate(3px, -3px); }
    60% { transform: translate(-3px, 3px); }
    70% { transform: translate(3px, 3px); }
    80% { transform: translate(-3px, -3px); }
    90% { transform: translate(3px, -3px); }
  }

  /* ── Legendary flash ── */
  .legendary-flash {
    position: fixed;
    inset: 0;
    background: radial-gradient(circle, rgba(255, 215, 0, 0.5), transparent 70%);
    z-index: 100;
    animation: flash 0.4s ease-out forwards;
    pointer-events: none;
  }

  @keyframes flash {
    0% { opacity: 1; }
    100% { opacity: 0; }
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
     BURST DEBRIS — SVG robot parts
     ══════════════════════════════════════════ */
  .debris-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 20;
    overflow: visible;
  }

  .debris {
    position: absolute;
    width: var(--size);
    height: var(--size);
    color: var(--color);
    filter: drop-shadow(0 0 6px var(--color));
    animation: debrisFly 1.4s var(--delay) cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
  }

  .debris svg {
    width: 100%;
    height: 100%;
  }

  @keyframes debrisFly {
    0% {
      transform: translate(0, 0) scale(0.5) rotate(var(--rot));
      opacity: 1;
    }
    20% {
      opacity: 1;
      transform: translate(calc(var(--dx) * 0.3), calc(var(--dy) * 0.3)) scale(1.2) rotate(calc(var(--rot) + 90deg));
    }
    100% {
      transform: translate(var(--dx), var(--dy)) scale(0) rotate(calc(var(--rot) + 540deg));
      opacity: 0;
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

  /* ── Ambient motes ── */
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
     BURST STATE
     ══════════════════════════════════════════ */
  .burst-state {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    overflow: visible;
    mix-blend-mode: screen;
  }

  .burst-flash {
    position: fixed;
    inset: 0;
    background: radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.95), rgba(253, 181, 206, 0.3) 35%, transparent 65%);
    animation: burstFlash 0.6s ease-out forwards;
    pointer-events: none;
  }

  @keyframes burstFlash {
    0% { opacity: 1; }
    30% { opacity: 0.7; }
    100% { opacity: 0; }
  }

  .burst-ring {
    position: absolute;
    width: var(--ring-size);
    height: var(--ring-size);
    border: var(--ring-thick) solid var(--ring-color);
    border-radius: 50%;
    animation: burstRingExpand var(--ring-dur) var(--ring-delay) cubic-bezier(0.22, 1, 0.36, 1) forwards;
    opacity: 0;
    mix-blend-mode: screen;
    filter: blur(0.5px);
    transform-origin: center;
  }

  @keyframes burstRingExpand {
    0% {
      transform: scale(0.1) scaleX(var(--ring-sx)) scaleY(var(--ring-sy)) rotate(var(--ring-rot));
      opacity: 1;
      border-width: var(--ring-thick);
    }
    30% {
      opacity: 0.9;
    }
    60% {
      opacity: 0.4;
    }
    100% {
      transform: scale(10) scaleX(var(--ring-sx)) scaleY(var(--ring-sy)) rotate(var(--ring-rot));
      opacity: 0;
      border-width: 0.5px;
    }
  }

  /* ══════════════════════════════════════════
     REVEAL / DONE — Cards
     ══════════════════════════════════════════ */
  .cards-container {
    display: flex;
    gap: var(--space-5);
    justify-content: center;
    align-items: center;
    padding: var(--space-5);
  }

  .card-slot {
    opacity: 0;
    transform: translateY(200px) scale(0.3) rotate(calc((var(--card-index) - 1) * 15deg));
  }

  .card-slot.visible {
    animation: cardLand 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    animation-delay: calc(var(--card-index) * 0.05s);
  }

  @keyframes cardLand {
    0% {
      opacity: 0;
      transform: translateY(200px) scale(0.3) rotate(calc((var(--card-index) - 1) * 15deg));
    }
    40% {
      opacity: 1;
      transform: translateY(-20px) scale(1.05) rotate(0deg);
    }
    65% {
      transform: translateY(8px) scale(0.98) rotate(0deg);
    }
    80% {
      transform: translateY(-4px) scale(1.01) rotate(0deg);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1) rotate(0deg);
    }
  }

  /* ── Bottom actions ── */
  .bottom-actions {
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.4s ease, transform 0.4s ease;
    pointer-events: none;
    margin-top: var(--space-2);
  }

  .bottom-actions.visible {
    opacity: 1;
    transform: translateY(0);
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
