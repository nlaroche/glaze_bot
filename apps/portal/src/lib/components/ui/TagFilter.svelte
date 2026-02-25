<script lang="ts">
  export type Tag = {
    key: string;
    label: string;
    color?: string;
    group?: string;
  };

  let {
    tags,
    active = [],
    onchange,
  }: {
    tags: Tag[];
    active: string[];
    onchange: (active: string[]) => void;
  } = $props();

  function toggle(key: string) {
    if (active.includes(key)) {
      onchange(active.filter((k) => k !== key));
    } else {
      onchange([...active, key]);
    }
  }

  // Group tags for visual separation
  const groups = $derived.by(() => {
    const map = new Map<string, Tag[]>();
    for (const tag of tags) {
      const g = tag.group ?? '';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(tag);
    }
    return [...map.entries()];
  });
</script>

<div class="tag-filter" data-testid="tag-filter">
  {#each groups as [_groupName, groupTags], gi}
    {#if gi > 0}
      <span class="tag-separator">|</span>
    {/if}
    {#each groupTags as tag (tag.key)}
      <button
        class="tag-chip"
        class:active={active.includes(tag.key)}
        style={tag.color && active.includes(tag.key) ? `--tag-color: ${tag.color}` : ''}
        onclick={() => toggle(tag.key)}
        data-testid="tag-{tag.key}"
      >
        {tag.label}
      </button>
    {/each}
  {/each}
</div>

<style>
  .tag-filter {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-separator {
    color: var(--glass-border);
    font-size: 0.9rem;
    margin: 0 2px;
    user-select: none;
  }

  .tag-chip {
    padding: 5px 14px;
    border: 1px solid var(--glass-border);
    border-radius: 14px;
    background: none;
    color: var(--color-text-muted);
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
  }

  .tag-chip:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text-secondary);
  }

  .tag-chip.active {
    background: color-mix(in srgb, var(--tag-color, var(--color-teal)) 15%, transparent);
    color: var(--tag-color, var(--color-teal));
    border-color: color-mix(in srgb, var(--tag-color, var(--color-teal)) 40%, transparent);
  }
</style>
