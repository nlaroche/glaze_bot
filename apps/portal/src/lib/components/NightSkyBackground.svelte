<script lang="ts">
  import { onMount } from 'svelte';

  // Deterministic star generation (same seed as desktop for visual parity)
  function makeStars(count: number, seed: number): { x: number; y: number; r: number; opacity: number }[] {
    let s = seed;
    function rand() {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    }
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rand() * 100,
        y: rand() * 60,
        r: 0.08 + rand() * 0.18,
        opacity: 0.25 + rand() * 0.55,
      });
    }
    return stars;
  }

  const stars = makeStars(160, 42);
  const faintStars = makeStars(100, 99);

  let mounted = $state(false);
  onMount(() => { mounted = true; });
</script>

<div class="night-bg" class:mounted>
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

    <!-- Faint stars (furthest) -->
    <g>
      {#each faintStars as star}
        <rect
          x={star.x} y={star.y}
          width={star.r * 0.6} height={star.r * 0.6}
          fill="rgba(180, 200, 230, {star.opacity * 0.35})"
        />
      {/each}
    </g>

    <!-- Bright stars -->
    <g>
      {#each stars as star}
        <rect
          x={star.x} y={star.y}
          width={star.r} height={star.r}
          fill="rgba(210, 225, 250, {star.opacity})"
        />
      {/each}
    </g>

    <!-- Wave layers -->
    <path d="M-20,72 Q-12,69 -4,72 T12,72 T28,72 T44,72 T60,72 T76,72 T92,72 T108,72 T120,72 L120,100 L-20,100 Z" fill="rgba(6, 12, 24, 0.6)" />
    <path d="M-20,76 Q-10,73 0,76 T20,76 T40,76 T60,76 T80,76 T100,76 T120,76 L120,100 L-20,100 Z" fill="rgba(7, 14, 28, 0.7)" />
    <path d="M-20,80 Q-8,77 4,80 T28,80 T52,80 T76,80 T100,80 T120,80 L120,100 L-20,100 Z" fill="rgba(8, 15, 30, 0.8)" />
    <path d="M-20,85 Q-5,82 10,85 T40,85 T70,85 T100,85 T120,85 L120,100 L-20,100 Z" fill="rgba(7, 12, 24, 0.9)" />
    <path d="M-20,90 Q-8,88 5,90 T30,90 T55,90 T80,90 T105,90 T120,90 L120,100 L-20,100 Z" fill="rgba(6, 10, 20, 0.95)" />

    <!-- Water sparkles -->
    <rect x="30" y="75" width="0.15" height="0.15" fill="rgba(200, 210, 230, 0.15)" />
    <rect x="55" y="78" width="0.1" height="0.1" fill="rgba(200, 210, 230, 0.12)" />
    <rect x="72" y="73" width="0.18" height="0.18" fill="rgba(200, 210, 230, 0.18)" />
    <rect x="15" y="80" width="0.1" height="0.1" fill="rgba(200, 210, 230, 0.1)" />
    <rect x="88" y="76" width="0.15" height="0.15" fill="rgba(200, 210, 230, 0.14)" />
    <rect x="45" y="82" width="0.1" height="0.1" fill="rgba(200, 210, 230, 0.08)" />
  </svg>
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
</style>
