<script lang="ts">
  import { onMount } from 'svelte';
  import type { ThemeId } from '$lib/stores/theme.svelte';

  let { sceneIndex = 0, theme = 'deep-space' as ThemeId }: { sceneIndex?: number; theme?: ThemeId } = $props();

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

  // Snowflakes for frost theme
  function makeSnowflakes(count: number, seed: number): { x: number; size: number; delay: number; duration: number; drift: number }[] {
    let s = seed;
    function rand() {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    }
    const flakes = [];
    for (let i = 0; i < count; i++) {
      flakes.push({
        x: rand() * 100,
        size: 1 + rand() * 3,
        delay: rand() * 15,
        duration: 8 + rand() * 12,
        drift: -10 + rand() * 20,
      });
    }
    return flakes;
  }

  const stars = makeStars(160, 42);
  const faintStars = makeStars(100, 99);
  const snowflakes = makeSnowflakes(50, 77);

  // Parallax offsets per layer (SVG user units per scene step)
  const FAINT_RATE = -1.2;
  const STAR_RATE = -2.2;
  const WAVE_RATE = -4.5;
  const SPARKLE_RATE = -3.5;

  let mounted = $state(false);
  onMount(() => { mounted = true; });
</script>

<div class="night-bg" class:mounted style="--scene-offset: {sceneIndex}">
  {#if theme === 'deep-space'}
    <!-- ═══ DEEP SPACE — original scene ═══ -->
    <svg class="sky-svg" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#040610" />
          <stop offset="35%" stop-color="#070c1a" />
          <stop offset="65%" stop-color="#0a1025" />
          <stop offset="100%" stop-color="#0c1530" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sky-grad)" />

      <g class="parallax-layer" style="transform: translateX({sceneIndex * FAINT_RATE}px)">
        {#each faintStars as star}
          <rect x={star.x} y={star.y} width={star.r * 0.6} height={star.r * 0.6}
            fill="rgba(180, 200, 230, {star.opacity * 0.35})" class="twinkle-faint"
            style="--delay: {star.delay}s; --duration: {star.duration}s" />
        {/each}
      </g>

      <g class="parallax-layer" style="transform: translateX({sceneIndex * STAR_RATE}px)">
        {#each stars as star}
          <rect x={star.x} y={star.y} width={star.r} height={star.r}
            fill="rgba(210, 225, 250, {star.opacity})" class="twinkle"
            style="--delay: {star.delay}s; --duration: {star.duration}s" />
        {/each}
      </g>

      <g class="parallax-layer" style="transform: translateX({sceneIndex * WAVE_RATE}px)">
        <path class="wave wave-4" d="M-20,72 Q-12,69 -4,72 T12,72 T28,72 T44,72 T60,72 T76,72 T92,72 T108,72 T120,72 L120,100 L-20,100 Z" fill="rgba(6, 12, 24, 0.6)" />
        <path class="wave wave-3" d="M-20,76 Q-10,73 0,76 T20,76 T40,76 T60,76 T80,76 T100,76 T120,76 L120,100 L-20,100 Z" fill="rgba(7, 14, 28, 0.7)" />
        <path class="wave wave-2" d="M-20,80 Q-8,77 4,80 T28,80 T52,80 T76,80 T100,80 T120,80 L120,100 L-20,100 Z" fill="rgba(8, 15, 30, 0.8)" />
        <path class="wave wave-1" d="M-20,85 Q-5,82 10,85 T40,85 T70,85 T100,85 T120,85 L120,100 L-20,100 Z" fill="rgba(7, 12, 24, 0.9)" />
        <path class="wave wave-0" d="M-20,90 Q-8,88 5,90 T30,90 T55,90 T80,90 T105,90 T120,90 L120,100 L-20,100 Z" fill="rgba(6, 10, 20, 0.95)" />
      </g>

      <g class="parallax-layer" style="transform: translateX({sceneIndex * SPARKLE_RATE}px)">
        <rect x="30" y="75" width="0.15" height="0.15" fill="rgba(200, 210, 230, 0.15)" class="sparkle" style="--sp-delay: 0s" />
        <rect x="55" y="78" width="0.1" height="0.1" fill="rgba(200, 210, 230, 0.12)" class="sparkle" style="--sp-delay: 2s" />
        <rect x="72" y="73" width="0.18" height="0.18" fill="rgba(200, 210, 230, 0.18)" class="sparkle" style="--sp-delay: 4s" />
        <rect x="15" y="80" width="0.1" height="0.1" fill="rgba(200, 210, 230, 0.1)" class="sparkle" style="--sp-delay: 1.5s" />
        <rect x="88" y="76" width="0.15" height="0.15" fill="rgba(200, 210, 230, 0.14)" class="sparkle" style="--sp-delay: 3.5s" />
        <rect x="45" y="82" width="0.1" height="0.1" fill="rgba(200, 210, 230, 0.08)" class="sparkle" style="--sp-delay: 5s" />
      </g>
    </svg>

    <!-- Satellite -->
    <div class="satellite-track parallax-html" style="transform: translateX(calc(var(--scene-offset) * -2.2vw))">
      <svg class="satellite" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="16" y="15" width="8" height="10" rx="1" fill="rgba(140, 160, 190, 0.12)" />
        <rect x="2" y="17" width="12" height="6" rx="0.5" fill="rgba(100, 130, 170, 0.10)" />
        <line x1="4" y1="17" x2="4" y2="23" stroke="rgba(140, 165, 200, 0.06)" stroke-width="0.5" />
        <line x1="7" y1="17" x2="7" y2="23" stroke="rgba(140, 165, 200, 0.06)" stroke-width="0.5" />
        <line x1="10" y1="17" x2="10" y2="23" stroke="rgba(140, 165, 200, 0.06)" stroke-width="0.5" />
        <rect x="26" y="17" width="12" height="6" rx="0.5" fill="rgba(100, 130, 170, 0.10)" />
        <line x1="29" y1="17" x2="29" y2="23" stroke="rgba(140, 165, 200, 0.06)" stroke-width="0.5" />
        <line x1="32" y1="17" x2="32" y2="23" stroke="rgba(140, 165, 200, 0.06)" stroke-width="0.5" />
        <line x1="35" y1="17" x2="35" y2="23" stroke="rgba(140, 165, 200, 0.06)" stroke-width="0.5" />
        <line x1="20" y1="15" x2="20" y2="11" stroke="rgba(140, 160, 190, 0.10)" stroke-width="0.5" />
        <circle cx="20" cy="10" r="1" fill="rgba(180, 200, 220, 0.10)" />
        <circle cx="20" cy="25" r="0.6" fill="rgba(59, 151, 151, 0.25)" class="sat-blink" />
      </svg>
    </div>

    <!-- Rover 1 -->
    <div class="rover-track rover-track-1 parallax-html" style="transform: translateX(calc(var(--scene-offset) * -4.5vw))">
      <svg class="rover" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="8" width="20" height="6" rx="2" fill="rgba(120, 140, 165, 0.10)" />
        <rect x="10" y="3" width="8" height="6" rx="1.5" fill="rgba(130, 150, 175, 0.09)" />
        <line x1="14" y1="3" x2="12" y2="0" stroke="rgba(140, 160, 185, 0.08)" stroke-width="0.5" />
        <circle cx="12" cy="0" r="0.6" fill="rgba(59, 151, 151, 0.18)" class="rover-blink" />
        <circle cx="15" cy="6" r="1.2" fill="rgba(59, 151, 151, 0.12)" />
        <circle cx="15" cy="6" r="0.5" fill="rgba(180, 220, 220, 0.15)" />
        <circle cx="9" cy="16" r="3" fill="rgba(80, 95, 115, 0.12)" />
        <circle cx="9" cy="16" r="1.5" fill="rgba(60, 75, 95, 0.10)" />
        <circle cx="23" cy="16" r="3" fill="rgba(80, 95, 115, 0.12)" />
        <circle cx="23" cy="16" r="1.5" fill="rgba(60, 75, 95, 0.10)" />
        <line x1="26" y1="10" x2="30" y2="7" stroke="rgba(120, 140, 165, 0.08)" stroke-width="0.8" />
        <circle cx="30" cy="7" r="0.8" fill="rgba(140, 160, 185, 0.08)" />
      </svg>
    </div>

    <!-- Rover 2 -->
    <div class="rover-track rover-track-2 parallax-html" style="transform: translateX(calc(var(--scene-offset) * -3.5vw))">
      <svg class="rover rover-sm" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="5" width="16" height="5" rx="1.5" fill="rgba(120, 140, 165, 0.07)" />
        <rect x="8" y="1" width="6" height="5" rx="1" fill="rgba(130, 150, 175, 0.06)" />
        <circle cx="11" cy="3.5" r="0.8" fill="rgba(59, 151, 151, 0.10)" />
        <circle cx="7" cy="12" r="2.5" fill="rgba(80, 95, 115, 0.08)" />
        <circle cx="7" cy="12" r="1.2" fill="rgba(60, 75, 95, 0.06)" />
        <circle cx="17" cy="12" r="2.5" fill="rgba(80, 95, 115, 0.08)" />
        <circle cx="17" cy="12" r="1.2" fill="rgba(60, 75, 95, 0.06)" />
      </svg>
    </div>

  {:else if theme === 'frost'}
    <!-- ═══ FROST — Dark icy sky, snowy mountains, aurora, snowflakes ═══ -->
    <svg class="sky-svg" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="frost-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#040810" />
          <stop offset="30%" stop-color="#081018" />
          <stop offset="60%" stop-color="#0C1822" />
          <stop offset="100%" stop-color="#10202C" />
        </linearGradient>
        <linearGradient id="aurora-1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(100, 220, 180, 0)" />
          <stop offset="30%" stop-color="rgba(100, 220, 180, 0.15)" />
          <stop offset="50%" stop-color="rgba(80, 200, 220, 0.20)" />
          <stop offset="70%" stop-color="rgba(120, 180, 240, 0.12)" />
          <stop offset="100%" stop-color="rgba(120, 180, 240, 0)" />
        </linearGradient>
        <linearGradient id="aurora-2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(160, 240, 200, 0)" />
          <stop offset="25%" stop-color="rgba(100, 230, 200, 0.10)" />
          <stop offset="50%" stop-color="rgba(80, 220, 180, 0.15)" />
          <stop offset="75%" stop-color="rgba(140, 200, 240, 0.08)" />
          <stop offset="100%" stop-color="rgba(140, 200, 240, 0)" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#frost-sky)" />

      <!-- Aurora ribbons -->
      <g class="parallax-layer" style="transform: translateX({sceneIndex * FAINT_RATE}px)">
        <path class="aurora aurora-1" d="M-10,10 Q10,6 30,12 T60,8 T90,14 T120,10" stroke="url(#aurora-1)" stroke-width="3" fill="none" />
        <path class="aurora aurora-2" d="M-10,16 Q15,12 35,18 T65,14 T95,20 T120,16" stroke="url(#aurora-2)" stroke-width="2" fill="none" />
      </g>

      <!-- Ice sparkles / stars -->
      <g class="parallax-layer" style="transform: translateX({sceneIndex * FAINT_RATE}px)">
        {#each faintStars.slice(0, 60) as star}
          <rect x={star.x} y={star.y * 0.6} width={star.r * 0.5} height={star.r * 0.5}
            fill="rgba(180, 220, 255, {star.opacity * 0.3})" class="twinkle-faint"
            style="--delay: {star.delay}s; --duration: {star.duration}s" />
        {/each}
      </g>

      <g class="parallax-layer" style="transform: translateX({sceneIndex * STAR_RATE}px)">
        {#each stars.slice(0, 80) as star}
          <rect x={star.x} y={star.y * 0.7} width={star.r} height={star.r}
            fill="rgba(200, 230, 255, {star.opacity * 0.6})" class="twinkle"
            style="--delay: {star.delay}s; --duration: {star.duration}s" />
        {/each}
      </g>

      <!-- Mountain silhouettes — dark with white snow caps -->
      <g class="parallax-layer" style="transform: translateX({sceneIndex * WAVE_RATE * 0.6}px)">
        <path d="M-20,65 L0,40 L12,52 L25,35 L38,50 L50,30 L62,48 L75,38 L88,55 L100,42 L115,58 L120,65 L120,100 L-20,100 Z" fill="rgba(15, 25, 40, 0.6)" />
        <path d="M25,35 L30,42 L20,42 Z" fill="rgba(180, 210, 240, 0.25)" />
        <path d="M50,30 L56,40 L44,40 Z" fill="rgba(180, 210, 240, 0.30)" />
        <path d="M75,38 L80,46 L70,46 Z" fill="rgba(180, 210, 240, 0.25)" />
      </g>

      <g class="parallax-layer" style="transform: translateX({sceneIndex * WAVE_RATE * 0.8}px)">
        <path d="M-20,72 L-5,50 L10,62 L20,45 L35,58 L45,42 L55,56 L68,48 L80,60 L95,50 L110,65 L120,58 L120,100 L-20,100 Z" fill="rgba(12, 20, 35, 0.7)" />
        <path d="M20,45 L25,52 L15,52 Z" fill="rgba(180, 210, 240, 0.3)" />
        <path d="M45,42 L50,50 L40,50 Z" fill="rgba(180, 210, 240, 0.35)" />
        <path d="M95,50 L100,58 L90,58 Z" fill="rgba(180, 210, 240, 0.25)" />
      </g>

      <!-- Snow ground — dark but icy-tinted -->
      <g class="parallax-layer" style="transform: translateX({sceneIndex * WAVE_RATE}px)">
        <path d="M-20,78 Q-8,75 5,78 T30,78 T55,78 T80,78 T105,78 T120,78 L120,100 L-20,100 Z" fill="rgba(14, 22, 34, 0.7)" />
        <path d="M-20,84 Q-5,82 10,84 T40,84 T70,84 T100,84 T120,84 L120,100 L-20,100 Z" fill="rgba(12, 20, 32, 0.85)" />
        <path d="M-20,90 Q-8,88 5,90 T30,90 T55,90 T80,90 T105,90 T120,90 L120,100 L-20,100 Z" fill="rgba(10, 16, 28, 0.95)" />
      </g>

      <!-- Ice sparkles on ground -->
      <g class="parallax-layer" style="transform: translateX({sceneIndex * SPARKLE_RATE}px)">
        <rect x="25" y="80" width="0.15" height="0.15" fill="rgba(180, 220, 255, 0.15)" class="sparkle" style="--sp-delay: 0s" />
        <rect x="50" y="83" width="0.1" height="0.1" fill="rgba(180, 220, 255, 0.12)" class="sparkle" style="--sp-delay: 2s" />
        <rect x="70" y="79" width="0.18" height="0.18" fill="rgba(180, 220, 255, 0.18)" class="sparkle" style="--sp-delay: 4s" />
        <rect x="15" y="85" width="0.1" height="0.1" fill="rgba(180, 220, 255, 0.10)" class="sparkle" style="--sp-delay: 1.5s" />
        <rect x="88" y="81" width="0.15" height="0.15" fill="rgba(180, 220, 255, 0.14)" class="sparkle" style="--sp-delay: 3.5s" />
      </g>
    </svg>

    <!-- Falling snowflakes -->
    <div class="snowflake-container">
      {#each snowflakes as flake}
        <div class="snowflake" style="
          left: {flake.x}%;
          width: {flake.size}px;
          height: {flake.size}px;
          animation-delay: {flake.delay}s;
          animation-duration: {flake.duration}s;
          --drift: {flake.drift}px;
        "></div>
      {/each}
    </div>

  {:else if theme === 'desert'}
    <!-- ═══ DESERT — Dunes, mesa, warm sky ═══ -->
    <svg class="sky-svg" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="desert-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0C0A14" />
          <stop offset="30%" stop-color="#1A1020" />
          <stop offset="60%" stop-color="#2E1A18" />
          <stop offset="85%" stop-color="#4A2810" />
          <stop offset="100%" stop-color="#6B3A10" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#desert-sky)" />

      <!-- Stars in desert sky (fewer, brighter) -->
      <g class="parallax-layer" style="transform: translateX({sceneIndex * FAINT_RATE}px)">
        {#each faintStars.slice(0, 50) as star}
          <rect x={star.x} y={star.y * 0.7} width={star.r * 0.5} height={star.r * 0.5}
            fill="rgba(255, 230, 180, {star.opacity * 0.3})" class="twinkle-faint"
            style="--delay: {star.delay}s; --duration: {star.duration}s" />
        {/each}
      </g>

      <g class="parallax-layer" style="transform: translateX({sceneIndex * STAR_RATE}px)">
        {#each stars.slice(0, 60) as star}
          <rect x={star.x} y={star.y * 0.7} width={star.r} height={star.r}
            fill="rgba(255, 220, 160, {star.opacity * 0.7})" class="twinkle"
            style="--delay: {star.delay}s; --duration: {star.duration}s" />
        {/each}
      </g>

      <!-- Distant mesas -->
      <g class="parallax-layer" style="transform: translateX({sceneIndex * WAVE_RATE * 0.5}px)">
        <path d="M-5,68 L0,52 L8,52 L12,68" fill="rgba(60, 30, 15, 0.5)" />
        <path d="M30,65 L34,48 L46,48 L50,65" fill="rgba(55, 28, 12, 0.4)" />
        <path d="M80,70 L84,55 L92,55 L96,70" fill="rgba(50, 25, 10, 0.35)" />
      </g>

      <!-- Sand dunes -->
      <g class="parallax-layer" style="transform: translateX({sceneIndex * WAVE_RATE * 0.7}px)">
        <path class="wave wave-4" d="M-20,72 Q-5,64 10,72 T40,72 T70,72 T100,72 T120,72 L120,100 L-20,100 Z" fill="rgba(80, 50, 20, 0.5)" />
        <path class="wave wave-3" d="M-20,76 Q0,68 15,76 T45,76 T75,76 T105,76 T120,76 L120,100 L-20,100 Z" fill="rgba(90, 55, 22, 0.6)" />
      </g>

      <g class="parallax-layer" style="transform: translateX({sceneIndex * WAVE_RATE}px)">
        <path class="wave wave-2" d="M-20,80 Q-2,74 16,80 T48,80 T80,80 T112,80 T120,80 L120,100 L-20,100 Z" fill="rgba(100, 60, 25, 0.7)" />
        <path class="wave wave-1" d="M-20,86 Q0,80 18,86 T50,86 T82,86 T114,86 T120,86 L120,100 L-20,100 Z" fill="rgba(80, 45, 18, 0.85)" />
        <path class="wave wave-0" d="M-20,92 Q-5,89 10,92 T40,92 T70,92 T100,92 T120,92 L120,100 L-20,100 Z" fill="rgba(50, 30, 12, 0.95)" />
      </g>

      <!-- Heat shimmer lines -->
      <g class="parallax-layer" style="transform: translateX({sceneIndex * SPARKLE_RATE}px)">
        <line x1="20" y1="70" x2="35" y2="70" stroke="rgba(255, 200, 100, 0.06)" stroke-width="0.15" class="shimmer" style="--sh-delay: 0s" />
        <line x1="55" y1="72" x2="70" y2="72" stroke="rgba(255, 200, 100, 0.05)" stroke-width="0.12" class="shimmer" style="--sh-delay: 2s" />
        <line x1="80" y1="69" x2="95" y2="69" stroke="rgba(255, 200, 100, 0.04)" stroke-width="0.1" class="shimmer" style="--sh-delay: 4s" />
      </g>
    </svg>

  {:else if theme === 'sunset'}
    <!-- ═══ SUNSET — Orange-purple sky, clouds, birds ═══ -->
    <svg class="sky-svg" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sunset-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1A0820" />
          <stop offset="20%" stop-color="#2E0E30" />
          <stop offset="40%" stop-color="#5C1830" />
          <stop offset="60%" stop-color="#A03020" />
          <stop offset="80%" stop-color="#D06018" />
          <stop offset="95%" stop-color="#E8A030" />
          <stop offset="100%" stop-color="#F0C050" />
        </linearGradient>
        <radialGradient id="sun-glow" cx="50%" cy="88%" r="20%">
          <stop offset="0%" stop-color="rgba(255, 200, 80, 0.4)" />
          <stop offset="50%" stop-color="rgba(255, 160, 60, 0.15)" />
          <stop offset="100%" stop-color="rgba(255, 140, 40, 0)" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sunset-sky)" />

      <!-- Sun glow at horizon -->
      <rect width="100" height="100" fill="url(#sun-glow)" />

      <!-- Sun disk -->
      <circle cx="50" cy="86" r="4" fill="rgba(255, 200, 80, 0.35)" />
      <circle cx="50" cy="86" r="2.5" fill="rgba(255, 220, 120, 0.5)" />

      <!-- Stars in upper sky -->
      <g class="parallax-layer" style="transform: translateX({sceneIndex * FAINT_RATE}px)">
        {#each faintStars.slice(0, 30) as star}
          <rect x={star.x} y={star.y * 0.4} width={star.r * 0.4} height={star.r * 0.4}
            fill="rgba(255, 220, 240, {star.opacity * 0.2})" class="twinkle-faint"
            style="--delay: {star.delay}s; --duration: {star.duration}s" />
        {/each}
      </g>

      <!-- Layered clouds -->
      <g class="parallax-layer" style="transform: translateX({sceneIndex * STAR_RATE}px)">
        <ellipse cx="25" cy="30" rx="18" ry="3" fill="rgba(180, 80, 60, 0.12)" class="cloud cloud-1" />
        <ellipse cx="70" cy="25" rx="22" ry="3.5" fill="rgba(200, 100, 70, 0.10)" class="cloud cloud-2" />
        <ellipse cx="50" cy="40" rx="15" ry="2.5" fill="rgba(160, 60, 50, 0.08)" class="cloud cloud-3" />
      </g>

      <g class="parallax-layer" style="transform: translateX({sceneIndex * SPARKLE_RATE}px)">
        <ellipse cx="15" cy="55" rx="20" ry="2" fill="rgba(220, 120, 60, 0.10)" class="cloud cloud-4" />
        <ellipse cx="80" cy="50" rx="16" ry="2.5" fill="rgba(200, 100, 50, 0.08)" class="cloud cloud-5" />
      </g>

      <!-- Water/horizon -->
      <g class="parallax-layer" style="transform: translateX({sceneIndex * WAVE_RATE}px)">
        <path class="wave wave-4" d="M-20,82 Q-10,80 0,82 T20,82 T40,82 T60,82 T80,82 T100,82 T120,82 L120,100 L-20,100 Z" fill="rgba(40, 15, 25, 0.5)" />
        <path class="wave wave-3" d="M-20,86 Q-5,84 10,86 T35,86 T60,86 T85,86 T110,86 T120,86 L120,100 L-20,100 Z" fill="rgba(35, 12, 20, 0.65)" />
        <path class="wave wave-2" d="M-20,89 Q-8,87 5,89 T30,89 T55,89 T80,89 T105,89 T120,89 L120,100 L-20,100 Z" fill="rgba(28, 10, 18, 0.8)" />
        <path class="wave wave-1" d="M-20,93 Q-5,91 10,93 T40,93 T70,93 T100,93 T120,93 L120,100 L-20,100 Z" fill="rgba(22, 8, 14, 0.9)" />
      </g>

      <!-- Sun reflection on water -->
      <g class="parallax-layer" style="transform: translateX({sceneIndex * SPARKLE_RATE}px)">
        <rect x="48" y="86" width="0.3" height="0.8" fill="rgba(255, 200, 100, 0.15)" class="sparkle" style="--sp-delay: 0s" />
        <rect x="50" y="88" width="0.2" height="0.6" fill="rgba(255, 180, 80, 0.12)" class="sparkle" style="--sp-delay: 1.5s" />
        <rect x="52" y="87" width="0.25" height="0.7" fill="rgba(255, 190, 90, 0.10)" class="sparkle" style="--sp-delay: 3s" />
        <rect x="46" y="89" width="0.15" height="0.5" fill="rgba(255, 200, 100, 0.08)" class="sparkle" style="--sp-delay: 4.5s" />
      </g>
    </svg>

    <!-- Flying birds -->
    <div class="birds-container parallax-html" style="transform: translateX(calc(var(--scene-offset) * -2.5vw))">
      <svg class="bird bird-1" viewBox="0 0 20 8" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,4 Q4,0 8,3 L10,4 L12,3 Q16,0 20,4" stroke="rgba(40, 15, 25, 0.3)" stroke-width="0.8" fill="none" />
      </svg>
      <svg class="bird bird-2" viewBox="0 0 16 6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,3 Q3,0 6,2.5 L8,3 L10,2.5 Q13,0 16,3" stroke="rgba(40, 15, 25, 0.25)" stroke-width="0.7" fill="none" />
      </svg>
      <svg class="bird bird-3" viewBox="0 0 14 5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,2.5 Q3,0 5,2 L7,2.5 L9,2 Q11,0 14,2.5" stroke="rgba(40, 15, 25, 0.2)" stroke-width="0.6" fill="none" />
      </svg>
    </div>
  {/if}
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

  /* Star twinkle */
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

  /* ---- Satellite (deep-space) ---- */
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

  /* ---- Rovers (deep-space) ---- */
  .rover-track {
    position: absolute;
    width: 100%;
    height: 0;
    overflow: visible;
  }

  .rover-track-1 { bottom: 22%; }
  .rover-track-2 { bottom: 16%; }

  .rover {
    position: absolute;
    width: 24px;
    height: 15px;
  }

  .rover-sm {
    width: 18px;
    height: 12px;
  }

  .rover-track-1 .rover {
    animation: rover-rtl 90s linear infinite;
  }

  @keyframes rover-rtl {
    0% { transform: translateX(calc(100vw + 30px)) scaleX(-1); }
    100% { transform: translateX(-40px) scaleX(-1); }
  }

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

  /* ---- Frost: Aurora ---- */
  .aurora {
    stroke-linecap: round;
  }

  .aurora-1 {
    animation: aurora-sway-1 12s ease-in-out infinite alternate;
  }

  .aurora-2 {
    animation: aurora-sway-2 15s ease-in-out infinite alternate;
  }

  @keyframes aurora-sway-1 {
    0% { transform: translateX(0) translateY(0); opacity: 0.6; }
    50% { opacity: 1; }
    100% { transform: translateX(3%) translateY(-1%); opacity: 0.7; }
  }

  @keyframes aurora-sway-2 {
    0% { transform: translateX(0) translateY(0); opacity: 0.5; }
    50% { opacity: 0.9; }
    100% { transform: translateX(-2%) translateY(0.5%); opacity: 0.6; }
  }

  /* ---- Frost: Snowflakes ---- */
  .snowflake-container {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .snowflake {
    position: absolute;
    top: -5px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.6);
    animation: snowfall var(--duration, 10s) var(--delay, 0s) linear infinite;
  }

  @keyframes snowfall {
    0% {
      transform: translateY(0) translateX(0);
      opacity: 0;
    }
    5% {
      opacity: 0.8;
    }
    90% {
      opacity: 0.4;
    }
    100% {
      transform: translateY(100vh) translateX(var(--drift, 0px));
      opacity: 0;
    }
  }

  /* ---- Desert: Heat shimmer ---- */
  .shimmer {
    animation: shimmer 5s var(--sh-delay, 0s) ease-in-out infinite;
  }

  @keyframes shimmer {
    0%, 100% { opacity: 0; transform: translateY(0); }
    30% { opacity: 1; transform: translateY(-0.3%); }
    70% { opacity: 0.6; transform: translateY(0.2%); }
  }

  /* ---- Sunset: Clouds ---- */
  .cloud {
    animation: cloud-drift 20s ease-in-out infinite alternate;
  }

  .cloud-1 { animation-duration: 18s; }
  .cloud-2 { animation-duration: 22s; animation-delay: 3s; }
  .cloud-3 { animation-duration: 16s; animation-delay: 1s; }
  .cloud-4 { animation-duration: 25s; animation-delay: 5s; }
  .cloud-5 { animation-duration: 20s; animation-delay: 2s; }

  @keyframes cloud-drift {
    0% { transform: translateX(0); }
    100% { transform: translateX(5%); }
  }

  /* ---- Sunset: Birds ---- */
  .birds-container {
    position: absolute;
    top: 15%;
    left: 0;
    width: 100%;
    height: 40%;
    overflow: visible;
  }

  .bird {
    position: absolute;
  }

  .bird-1 {
    width: 18px;
    top: 10%;
    animation: bird-fly-1 45s linear infinite;
  }

  .bird-2 {
    width: 14px;
    top: 25%;
    animation: bird-fly-2 55s 8s linear infinite;
  }

  .bird-3 {
    width: 11px;
    top: 40%;
    animation: bird-fly-3 65s 15s linear infinite;
  }

  @keyframes bird-fly-1 {
    0% { transform: translateX(-20px) translateY(0); }
    25% { transform: translateX(25vw) translateY(-8px); }
    50% { transform: translateX(50vw) translateY(4px); }
    75% { transform: translateX(75vw) translateY(-4px); }
    100% { transform: translateX(calc(100vw + 20px)) translateY(0); }
  }

  @keyframes bird-fly-2 {
    0% { transform: translateX(calc(100vw + 20px)) translateY(0); }
    25% { transform: translateX(75vw) translateY(6px); }
    50% { transform: translateX(50vw) translateY(-3px); }
    75% { transform: translateX(25vw) translateY(5px); }
    100% { transform: translateX(-20px) translateY(0); }
  }

  @keyframes bird-fly-3 {
    0% { transform: translateX(-15px) translateY(0); }
    33% { transform: translateX(33vw) translateY(-5px); }
    66% { transform: translateX(66vw) translateY(3px); }
    100% { transform: translateX(calc(100vw + 15px)) translateY(-2px); }
  }
</style>
