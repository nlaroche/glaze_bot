<script lang="ts">
  let {
    total,
    page = 1,
    pageSize = 10,
    pageSizeOptions = [10, 25, 50],
    onpagechange,
    onpagesizechange,
  }: {
    total: number;
    page: number;
    pageSize: number;
    pageSizeOptions?: number[];
    onpagechange: (page: number) => void;
    onpagesizechange: (size: number) => void;
  } = $props();

  const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
  const startItem = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
  const endItem = $derived(Math.min(page * pageSize, total));

  const visiblePages = $derived.by(() => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  });
</script>

<div class="pagination" data-testid="pagination">
  <span class="pagination-info">
    Showing {startItem}–{endItem} of {total}
  </span>

  <div class="pagination-controls">
    <button
      class="page-btn"
      disabled={page <= 1}
      onclick={() => onpagechange(page - 1)}
      data-testid="page-prev"
    >&lsaquo;</button>

    {#each visiblePages as p}
      {#if p === '...'}
        <span class="page-ellipsis">&hellip;</span>
      {:else}
        <button
          class="page-btn"
          class:active={p === page}
          onclick={() => onpagechange(p)}
        >{p}</button>
      {/if}
    {/each}

    <button
      class="page-btn"
      disabled={page >= totalPages}
      onclick={() => onpagechange(page + 1)}
      data-testid="page-next"
    >&rsaquo;</button>
  </div>

  <select
    class="page-size-select"
    value={pageSize}
    onchange={(e) => onpagesizechange(Number((e.target as HTMLSelectElement).value))}
    data-testid="page-size-select"
  >
    {#each pageSizeOptions as size}
      <option value={size}>{size} per page</option>
    {/each}
  </select>
</div>

<style>
  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2-5) var(--space-3-5);
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    flex-wrap: wrap;
  }

  .pagination-info {
    white-space: nowrap;
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: var(--space-0-5);
  }

  .page-btn {
    min-width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-muted);
    font-family: inherit;
    font-size: var(--font-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .page-btn:hover:not(:disabled) {
    background: var(--white-a6);
    color: var(--color-text-secondary);
  }

  .page-btn.active {
    background: var(--teal-a15);
    color: var(--color-teal);
    border-color: var(--teal-a30);
  }

  .page-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .page-ellipsis {
    padding: 0 var(--space-1);
    color: var(--color-text-muted);
  }

  .page-size-select {
    padding: var(--space-1-5) var(--space-2-5);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    background: var(--black-a30);
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: var(--font-sm);
    cursor: pointer;
    outline: none;
  }

  .page-size-select:focus {
    border-color: var(--color-teal);
  }
</style>
