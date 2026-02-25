<script lang="ts">
  import { onMount } from 'svelte';

  let { sceneIndex = 0 }: { sceneIndex?: number } = $props();

  // Generate deterministic stars — wider range for parallax headroom
  function makeStars(count: number, seed: number): { x: number; y: number; r: number; opacity: number; delay: number; duration: number }[] {
    let s = seed;
    function rand() {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    }
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: -15 + rand() * 130,  // extended range for parallax
        y: rand() * 60,
        r: 0.08 + rand() * 0.18,
        opacity: 0.25 + rand() * 0.55,
        delay: rand() * 12,
        duration: 6 + rand() * 10,
      });
    }
    return stars;
  }

  const stars = makeStars(160, 42);
  const faintStars = makeStars(100, 99);

  // Parallax offsets per layer (SVG user units per scene step)
  const FAINT_RATE = -1.2;
  const STAR_RATE = -2.2;
  const WAVE_RATE = -4.5;
  const SPARKLE_RATE = -3.5;

  let mounted = $state(false);
  onMount(() => { mounted = true; });
</script>

<div class="night-bg" class:mounted style="--scene-offset: {sceneIndex}">
  <!-- Stretched sky/waves background -->
  <svg
    class="sky-svg"
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#040610" />
        <stop offset="35%" stop-color="#070c1a" />
        <stop offset="65%" stop-color="#0a1025" />
        <stop offset="100%" stop-color="#0c1530" />
      </linearGradient>
    </defs>

    <rect width="100" height="100" fill="url(#sky-grad)" />

    <!-- Faint stars layer (furthest — moves least) -->
    <g class="parallax-layer" style="transform: translateX({sceneIndex * FAINT_RATE}px)">
      {#each faintStars as star}
        <rect
          x={star.x} y={star.y}
          width={star.r * 0.6} height={star.r * 0.6}
          fill="rgba(180, 200, 230, {star.opacity * 0.35})"
          class="twinkle-faint"
          style="--delay: {star.delay}s; --duration: {star.duration}s"
        />
      {/each}
    </g>

    <!-- Bright stars layer (mid-distance) -->
    <g class="parallax-layer" style="transform: translateX({sceneIndex * STAR_RATE}px)">
      {#each stars as star}
        <rect
          x={star.x} y={star.y}
          width={star.r} height={star.r}
          fill="rgba(210, 225, 250, {star.opacity})"
          class="twinkle"
          style="--delay: {star.delay}s; --duration: {star.duration}s"
        />
      {/each}
    </g>

    <!-- Wave layers (closest — moves most) -->
    <g class="parallax-layer" style="transform: translateX({sceneIndex * WAVE_RATE}px)">
      <path class="wave wave-4" d="M-20,72 Q-12,69 -4,72 T12,72 T28,72 T44,72 T60,72 T76,72 T92,72 T108,72 T120,72 L120,100 L-20,100 Z" fill="rgba(6, 12, 24, 0.6)" />
      <path class="wave wave-3" d="M-20,76 Q-10,73 0,76 T20,76 T40,76 T60,76 T80,76 T100,76 T120,76 L120,100 L-20,100 Z" fill="rgba(7, 14, 28, 0.7)" />
      <path class="wave wave-2" d="M-20,80 Q-8,77 4,80 T28,80 T52,80 T76,80 T100,80 T120,80 L120,100 L-20,100 Z" fill="rgba(8, 15, 30, 0.8)" />
      <path class="wave wave-1" d="M-20,85 Q-5,82 10,85 T40,85 T70,85 T100,85 T120,85 L120,100 L-20,100 Z" fill="rgba(7, 12, 24, 0.9)" />
      <path class="wave wave-0" d="M-20,90 Q-8,88 5,90 T30,90 T55,90 T80,90 T105,90 T120,90 L120,100 L-20,100 Z" fill="rgba(6, 10, 20, 0.95)" />
    </g>

    <!-- Water sparkles -->
    <g class="parallax-layer" style="transform: translateX({sceneIndex * SPARKLE_RATE}px)">
      <rect x="30" y="75" width="0.15" height="0.15" fill="rgba(200, 210, 230, 0.15)" class="sparkle" style="--sp-delay: 0s" />
      <rect x="55" y="78" width="0.1" height="0.1" fill="rgba(200, 210, 230, 0.12)" class="sparkle" style="--sp-delay: 2s" />
      <rect x="72" y="73" width="0.18" height="0.18" fill="rgba(200, 210, 230, 0.18)" class="sparkle" style="--sp-delay: 4s" />
      <rect x="15" y="80" width="0.1" height="0.1" fill="rgba(200, 210, 230, 0.1)" class="sparkle" style="--sp-delay: 1.5s" />
      <rect x="88" y="76" width="0.15" height="0.15" fill="rgba(200, 210, 230, 0.14)" class="sparkle" style="--sp-delay: 3.5s" />
      <rect x="45" y="82" width="0.1" height="0.1" fill="rgba(200, 210, 230, 0.08)" class="sparkle" style="--sp-delay: 5s" />
    </g>
  </svg>

  <!-- Satellite — orbits slowly across upper sky (CSS-positioned, not stretched) -->
  <div class="satellite-track parallax-html" style="transform: translateX(calc(var(--scene-offset) * -2.2vw))">
    <svg class="satellite" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Body -->
      <rect x="16" y="15" width="8" height="10" rx="1" fill="rgba(140, 160, 190, 0.12)" />
      <!-- Solar panel left -->
      <rect x="2" y="17" width="12" height="6" rx="0.5" fill="rgba(100, 130, 170, 0.10)" />
      <line x1="4" y1="17" x2="4" y2="23" stroke="rgba(140, 165, 200, 0.06)" stroke-width="0.5" />
      <line x1="7" y1="17" x2="7" y2="23" stroke="rgba(140, 165, 200, 0.06)" stroke-width="0.5" />
      <line x1="10" y1="17" x2="10" y2="23" stroke="rgba(140, 165, 200, 0.06)" stroke-width="0.5" />
      <!-- Solar panel right -->
      <rect x="26" y="17" width="12" height="6" rx="0.5" fill="rgba(100, 130, 170, 0.10)" />
      <line x1="29" y1="17" x2="29" y2="23" stroke="rgba(140, 165, 200, 0.06)" stroke-width="0.5" />
      <line x1="32" y1="17" x2="32" y2="23" stroke="rgba(140, 165, 200, 0.06)" stroke-width="0.5" />
      <line x1="35" y1="17" x2="35" y2="23" stroke="rgba(140, 165, 200, 0.06)" stroke-width="0.5" />
      <!-- Antenna -->
      <line x1="20" y1="15" x2="20" y2="11" stroke="rgba(140, 160, 190, 0.10)" stroke-width="0.5" />
      <circle cx="20" cy="10" r="1" fill="rgba(180, 200, 220, 0.10)" />
      <!-- Blinking light -->
      <circle cx="20" cy="25" r="0.6" fill="rgba(59, 151, 151, 0.25)" class="sat-blink" />
    </svg>
  </div>

  <!-- Rover 1 — small, trundles right to left along the wave horizon -->
  <div class="rover-track rover-track-1 parallax-html" style="transform: translateX(calc(var(--scene-offset) * -4.5vw))">
    <svg class="rover" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Chassis -->
      <rect x="6" y="8" width="20" height="6" rx="2" fill="rgba(120, 140, 165, 0.10)" />
      <!-- Head / sensor box -->
      <rect x="10" y="3" width="8" height="6" rx="1.5" fill="rgba(130, 150, 175, 0.09)" />
      <!-- Antenna -->
      <line x1="14" y1="3" x2="12" y2="0" stroke="rgba(140, 160, 185, 0.08)" stroke-width="0.5" />
      <circle cx="12" cy="0" r="0.6" fill="rgba(59, 151, 151, 0.18)" class="rover-blink" />
      <!-- Eye / lens -->
      <circle cx="15" cy="6" r="1.2" fill="rgba(59, 151, 151, 0.12)" />
      <circle cx="15" cy="6" r="0.5" fill="rgba(180, 220, 220, 0.15)" />
      <!-- Wheels -->
      <circle cx="9" cy="16" r="3" fill="rgba(80, 95, 115, 0.12)" />
      <circle cx="9" cy="16" r="1.5" fill="rgba(60, 75, 95, 0.10)" />
      <circle cx="23" cy="16" r="3" fill="rgba(80, 95, 115, 0.12)" />
      <circle cx="23" cy="16" r="1.5" fill="rgba(60, 75, 95, 0.10)" />
      <!-- Arm -->
      <line x1="26" y1="10" x2="30" y2="7" stroke="rgba(120, 140, 165, 0.08)" stroke-width="0.8" />
      <circle cx="30" cy="7" r="0.8" fill="rgba(140, 160, 185, 0.08)" />
    </svg>
  </div>

  <!-- Rover 2 — even smaller, goes left to right, slightly lower, offset timing -->
  <div class="rover-track rover-track-2 parallax-html" style="transform: translateX(calc(var(--scene-offset) * -3.5vw))">
    <svg class="rover rover-sm" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Simple mini rover -->
      <rect x="4" y="5" width="16" height="5" rx="1.5" fill="rgba(120, 140, 165, 0.07)" />
      <rect x="8" y="1" width="6" height="5" rx="1" fill="rgba(130, 150, 175, 0.06)" />
      <!-- Eye -->
      <circle cx="11" cy="3.5" r="0.8" fill="rgba(59, 151, 151, 0.10)" />
      <!-- Wheels -->
      <circle cx="7" cy="12" r="2.5" fill="rgba(80, 95, 115, 0.08)" />
      <circle cx="7" cy="12" r="1.2" fill="rgba(60, 75, 95, 0.06)" />
      <circle cx="17" cy="12" r="2.5" fill="rgba(80, 95, 115, 0.08)" />
      <circle cx="17" cy="12" r="1.2" fill="rgba(60, 75, 95, 0.06)" />
    </svg>
  </div>
</div>

<style>
  .night-bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity 1.5s ease;
  }

  .night-bg.mounted {
    opacity: 1;
  }

  .sky-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  /* Parallax transition for SVG layers */
  .parallax-layer {
    transition: transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  /* Parallax transition for HTML-positioned elements */
  .parallax-html {
    transition: transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  /* Star twinkle — very subtle */
  .twinkle {
    animation: twinkle var(--duration) var(--delay) ease-in-out infinite;
  }

  .twinkle-faint {
    animation: twinkle-faint var(--duration) var(--delay) ease-in-out infinite;
  }

  @keyframes twinkle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes twinkle-faint {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.2; }
  }

  /* Wave drift */
  .wave-0 { animation: wave-drift-0 8s ease-in-out infinite alternate; }
  .wave-1 { animation: wave-drift-1 10s ease-in-out infinite alternate; }
  .wave-2 { animation: wave-drift-2 12s ease-in-out infinite alternate; }
  .wave-3 { animation: wave-drift-3 14s ease-in-out infinite alternate; }
  .wave-4 { animation: wave-drift-4 16s ease-in-out infinite alternate; }

  @keyframes wave-drift-0 {
    0% { transform: translateX(0) translateY(0); }
    100% { transform: translateX(-1.5%) translateY(-0.3%); }
  }
  @keyframes wave-drift-1 {
    0% { transform: translateX(0) translateY(0); }
    100% { transform: translateX(2%) translateY(-0.5%); }
  }
  @keyframes wave-drift-2 {
    0% { transform: translateX(0) translateY(0); }
    100% { transform: translateX(-2.5%) translateY(-0.4%); }
  }
  @keyframes wave-drift-3 {
    0% { transform: translateX(0) translateY(0); }
    100% { transform: translateX(1.5%) translateY(-0.3%); }
  }
  @keyframes wave-drift-4 {
    0% { transform: translateX(0) translateY(0); }
    100% { transform: translateX(-1%) translateY(-0.5%); }
  }

  /* Water sparkles */
  .sparkle {
    animation: sparkle 6s var(--sp-delay) ease-in-out infinite;
  }
  @keyframes sparkle {
    0%, 100% { opacity: 0; }
    15% { opacity: 1; }
    30% { opacity: 0; }
  }

  /* ---- Satellite ---- */
  .satellite-track {
    position: absolute;
    top: 8%;
    left: 0;
    width: 100%;
    height: 0;
    overflow: visible;
  }

  .satellite {
    position: absolute;
    width: 28px;
    height: 28px;
    animation: sat-orbit 60s linear infinite;
  }

  @keyframes sat-orbit {
    0% { transform: translateX(-30px) translateY(0) rotate(0deg); }
    50% { transform: translateX(calc(100vw + 30px)) translateY(-20px) rotate(5deg); }
    50.01% { transform: translateX(-30px) translateY(15px) rotate(-3deg); }
    100% { transform: translateX(calc(100vw + 30px)) translateY(-5px) rotate(2deg); }
  }

  .sat-blink {
    animation: sat-blink-anim 3s ease-in-out infinite;
  }
  @keyframes sat-blink-anim {
    0%, 100% { opacity: 0.15; }
    50% { opacity: 0.6; }
  }

  /* ---- Rovers ---- */
  .rover-track {
    position: absolute;
    width: 100%;
    height: 0;
    overflow: visible;
  }

  .rover-track-1 {
    bottom: 22%;
  }

  .rover-track-2 {
    bottom: 16%;
  }

  .rover {
    position: absolute;
    width: 24px;
    height: 15px;
  }

  .rover-sm {
    width: 18px;
    height: 12px;
  }

  /* Rover 1: right to left, slow */
  .rover-track-1 .rover {
    animation: rover-rtl 90s linear infinite;
  }

  @keyframes rover-rtl {
    0% { transform: translateX(calc(100vw + 30px)) scaleX(-1); }
    100% { transform: translateX(-40px) scaleX(-1); }
  }

  /* Rover 2: left to right, even slower, offset */
  .rover-track-2 .rover {
    animation: rover-ltr 110s 25s linear infinite;
  }

  @keyframes rover-ltr {
    0% { transform: translateX(-30px); }
    100% { transform: translateX(calc(100vw + 30px)); }
  }

  .rover-blink {
    animation: rover-blink-anim 2s ease-in-out infinite;
  }
  @keyframes rover-blink-anim {
    0%, 100% { opacity: 0.1; }
    50% { opacity: 0.45; }
  }
</style>
