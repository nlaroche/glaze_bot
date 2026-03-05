<script lang="ts">
  import type { CharacterRarity, TopicAssignment, CustomTopic } from '@glazebot/shared-types';
  import { TOPIC_LABELS } from '@glazebot/shared-types';
  import TopicChip from './TopicChip.svelte';

  interface Props {
    topicAssignments?: TopicAssignment;
    customTopics?: CustomTopic[];
    rarity?: CharacterRarity;
    topicLabels?: Record<string, string>;
  }

  let {
    topicAssignments,
    customTopics,
    rarity = 'common',
    topicLabels,
  }: Props = $props();

  let labels = $derived(topicLabels ?? TOPIC_LABELS);

  let hasTopics = $derived(
    (topicAssignments && Object.keys(topicAssignments).length > 0) ||
    (customTopics && customTopics.length > 0)
  );

  // Sort topics by weight descending
  let sortedTopics = $derived.by(() => {
    if (!topicAssignments) return [];
    return Object.entries(topicAssignments)
      .sort(([, a], [, b]) => b - a)
      .map(([key, weight]) => ({
        key,
        label: labels[key] ?? key,
        weight,
      }));
  });

  let maxWeight = $derived.by(() => {
    const allWeights = [
      ...sortedTopics.map((t) => t.weight),
      ...(customTopics ?? []).map((ct) => ct.weight),
    ];
    return Math.max(...allWeights, 1);
  });
</script>

<div class="topic-breakdown" data-testid="topic-breakdown">
  {#if hasTopics}
    {#each sortedTopics as topic (topic.key)}
      <TopicChip
        label={topic.label}
        weight={topic.weight}
        {maxWeight}
        {rarity}
      />
    {/each}

    {#if customTopics && customTopics.length > 0}
      {#each customTopics as ct (ct.key)}
        <TopicChip
          label={ct.label}
          weight={ct.weight}
          {maxWeight}
          rarity="legendary"
          isCustom
        />
      {/each}
    {/if}
  {:else}
    <p class="empty-state">Classic commentary style</p>
  {/if}
</div>

<style>
  .topic-breakdown {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5, 0.125rem);
  }

  .empty-state {
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-muted, #64748b);
    font-style: italic;
    margin: 0;
  }
</style>
