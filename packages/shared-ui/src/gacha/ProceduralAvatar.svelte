<script lang="ts">
  import type { CharacterRarity } from '@glazebot/shared-types';

  interface Props {
    seed: string;
    rarity: CharacterRarity;
    size?: number;
  }

  let { seed, rarity, size = 120 }: Props = $props();

  function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  const rarityColors: Record<CharacterRarity, string> = {
    common: 'var(--rarity-common)',
    rare: 'var(--rarity-rare)',
    epic: 'var(--rarity-epic)',
    legendary: 'var(--rarity-legendary)',
  };

  const hash = $derived(hashCode(seed));

  // Generate deterministic palette (3 colors)
  const palette = $derived.by(() => {
    const r = seededRandom(hash);
    const hue1 = Math.floor(r() * 360);
    const hue2 = (hue1 + 60 + Math.floor(r() * 120)) % 360;
    const hue3 = (hue2 + 60 + Math.floor(r() * 120)) % 360;
    return [
      `hsl(${hue1}, 60%, 50%)`,
      `hsl(${hue2}, 50%, 60%)`,
      `hsl(${hue3}, 70%, 40%)`,
    ];
  });

  // Generate shapes
  const shapes = $derived.by(() => {
    const r = seededRandom(hash + 1);
    const count = 3 + Math.floor(r() * 4);
    const result: { type: string; cx: number; cy: number; size: number; color: string; rotation: number }[] = [];
    for (let i = 0; i < count; i++) {
      result.push({
        type: ['circle', 'rect', 'polygon'][Math.floor(r() * 3)],
        cx: 20 + r() * 60,
        cy: 20 + r() * 60,
        size: 10 + r() * 25,
        color: palette[Math.floor(r() * palette.length)],
        rotation: r() * 360,
      });
    }
    return result;
  });
</script>

<div class="avatar rarity-{rarity}" style="width: {size}px; height: {size}px; border-color: {rarityColors[rarity]}" data-testid="procedural-avatar">
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <rect width="100" height="100" fill={palette[2]} rx="8" />
    {#each shapes as shape}
      {#if shape.type === 'circle'}
        <circle cx={shape.cx} cy={shape.cy} r={shape.size / 2} fill={shape.color} opacity="0.8" />
      {:else if shape.type === 'rect'}
        <rect
          x={shape.cx - shape.size / 2}
          y={shape.cy - shape.size / 2}
          width={shape.size}
          height={shape.size}
          fill={shape.color}
          opacity="0.8"
          rx="3"
          transform="rotate({shape.rotation} {shape.cx} {shape.cy})"
        />
      {:else}
        <polygon
          points="{shape.cx},{shape.cy - shape.size / 2} {shape.cx + shape.size / 2},{shape.cy + shape.size / 2} {shape.cx - shape.size / 2},{shape.cy + shape.size / 2}"
          fill={shape.color}
          opacity="0.8"
          transform="rotate({shape.rotation} {shape.cx} {shape.cy})"
        />
      {/if}
    {/each}
  </svg>
</div>

<style>
  .avatar {
    border-radius: 12px;
    overflow: hidden;
    border: 2px solid;
    flex-shrink: 0;
  }

  .avatar.rarity-epic {
    box-shadow: var(--glow-epic);
  }

  .avatar.rarity-legendary {
    box-shadow: var(--glow-legendary);
  }

  svg {
    display: block;
  }
</style>
