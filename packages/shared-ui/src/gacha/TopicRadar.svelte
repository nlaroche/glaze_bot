<script lang="ts">
  import type { CharacterRarity, TopicAssignment, CustomTopic } from '@glazebot/shared-types';
  import { TOPIC_LABELS } from '@glazebot/shared-types';

  interface Props {
    topicAssignments?: TopicAssignment;
    customTopics?: CustomTopic[];
    rarity?: CharacterRarity;
    size?: number;
  }

  let {
    topicAssignments,
    customTopics,
    rarity = 'common',
    size = 200,
  }: Props = $props();

  // Merge standard + custom topics, sorted by weight descending
  let topics = $derived.by(() => {
    const entries: { key: string; label: string; weight: number; isCustom: boolean }[] = [];

    if (topicAssignments) {
      for (const [key, weight] of Object.entries(topicAssignments)) {
        if (key === 'silence') continue; // Skip silence — not interesting visually
        entries.push({
          key,
          label: TOPIC_LABELS[key] ?? key,
          weight,
          isCustom: false,
        });
      }
    }

    if (customTopics) {
      for (const ct of customTopics) {
        entries.push({
          key: ct.key,
          label: ct.label,
          weight: ct.weight,
          isCustom: true,
        });
      }
    }

    return entries.sort((a, b) => b.weight - a.weight);
  });

  let maxWeight = $derived(Math.max(...topics.map((t) => t.weight), 1));
  let count = $derived(topics.length);
  let hasTopics = $derived(count >= 3);

  // Geometry
  let cx = $derived(size / 2);
  let cy = $derived(size / 2);
  let radius = $derived(size / 2 - 30); // Leave room for labels

  function polarToXY(angle: number, r: number): { x: number; y: number } {
    // Start from top (-90deg) and go clockwise
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  // Grid ring points
  function ringPath(ringRadius: number): string {
    if (count < 3) return '';
    const pts = Array.from({ length: count }, (_, i) => {
      const angle = (360 / count) * i;
      return polarToXY(angle, ringRadius);
    });
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
  }

  // Data polygon points
  let dataPath = $derived.by(() => {
    if (count < 3) return '';
    const pts = topics.map((t, i) => {
      const angle = (360 / count) * i;
      const r = (t.weight / maxWeight) * radius;
      return polarToXY(angle, Math.max(r, radius * 0.05));
    });
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
  });

  // Axis lines
  let axes = $derived.by(() => {
    if (count < 3) return [];
    return topics.map((t, i) => {
      const angle = (360 / count) * i;
      const end = polarToXY(angle, radius);
      const labelPos = polarToXY(angle, radius + 16);
      return { ...end, labelX: labelPos.x, labelY: labelPos.y, label: t.label, isCustom: t.isCustom };
    });
  });

  const rarityFill: Record<string, string> = {
    common: 'rgba(160, 174, 192, 0.25)',
    rare: 'rgba(59, 151, 151, 0.25)',
    epic: 'rgba(176, 106, 255, 0.25)',
    legendary: 'rgba(255, 215, 0, 0.2)',
  };

  const rarityStroke: Record<string, string> = {
    common: 'rgba(160, 174, 192, 0.8)',
    rare: 'rgba(59, 151, 151, 0.8)',
    epic: 'rgba(176, 106, 255, 0.8)',
    legendary: 'rgba(255, 215, 0, 0.8)',
  };

  const rarityDot: Record<string, string> = {
    common: '#a0aec0',
    rare: '#3b9797',
    epic: '#b06aff',
    legendary: '#ffd700',
  };
</script>

<div class="topic-radar" data-testid="topic-radar">
  {#if hasTopics}
    <svg width={size} height={size} viewBox="0 0 {size} {size}">
      <!-- Grid rings -->
      {#each [0.25, 0.5, 0.75, 1] as ring}
        <path
          d={ringPath(radius * ring)}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          stroke-width="1"
        />
      {/each}

      <!-- Axis lines -->
      {#each axes as axis}
        <line
          x1={cx} y1={cy}
          x2={axis.x} y2={axis.y}
          stroke="rgba(255, 255, 255, 0.1)"
          stroke-width="1"
        />
      {/each}

      <!-- Data polygon -->
      <path
        d={dataPath}
        fill={rarityFill[rarity]}
        stroke={rarityStroke[rarity]}
        stroke-width="2"
      />

      <!-- Data points -->
      {#each topics as t, i}
        {@const angle = (360 / count) * i}
        {@const r = (t.weight / maxWeight) * radius}
        {@const pt = polarToXY(angle, Math.max(r, radius * 0.05))}
        <circle
          cx={pt.x} cy={pt.y} r="3"
          fill={rarityDot[rarity]}
        />
      {/each}

      <!-- Labels -->
      {#each axes as axis, i}
        <text
          x={axis.labelX}
          y={axis.labelY}
          text-anchor={
            axis.labelX < cx - 5 ? 'end' :
            axis.labelX > cx + 5 ? 'start' : 'middle'
          }
          dominant-baseline={
            axis.labelY < cy - 5 ? 'auto' :
            axis.labelY > cy + 5 ? 'hanging' : 'central'
          }
          class="radar-label"
          class:custom-label={axis.isCustom}
        >
          {axis.label}
        </text>
      {/each}
    </svg>
  {:else}
    <p class="empty-state">Default commentary style</p>
  {/if}
</div>

<style>
  .topic-radar {
    display: flex;
    justify-content: center;
  }

  svg {
    overflow: visible;
  }

  .radar-label {
    font-size: 0.7rem;
    fill: var(--color-text-primary, #e2e8f0);
    font-weight: 500;
  }

  .radar-label.custom-label {
    fill: var(--rarity-legendary, #ffd700);
    font-weight: 600;
  }

  .empty-state {
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-muted, #64748b);
    font-style: italic;
    margin: 0;
  }
</style>
