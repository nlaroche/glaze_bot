<script lang="ts" generics="T extends { id: string }">
  import type { Snippet } from 'svelte';

  export type Column = {
    key: string;
    label: string;
    sortable?: boolean;
    width?: string;
  };

  let {
    columns,
    rows,
    selectedId = '',
    onrowclick,
    sortKey = '',
    sortDirection = 'asc' as 'asc' | 'desc',
    onsort,
    cell,
  }: {
    columns: Column[];
    rows: T[];
    selectedId?: string;
    onrowclick?: (row: T) => void;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
    onsort?: (key: string, direction: 'asc' | 'desc') => void;
    cell: Snippet<[{ row: T; column: Column }]>;
  } = $props();

  function handleHeaderClick(col: Column) {
    if (!col.sortable || !onsort) return;
    const newDir = sortKey === col.key && sortDirection === 'asc' ? 'desc' : 'asc';
    onsort(col.key, newDir);
  }
</script>

<div class="data-table-wrap" data-testid="data-table">
  <table class="data-table">
    <thead>
      <tr>
        {#each columns as col (col.key)}
          <th
            style={col.width ? `width: ${col.width}` : ''}
            class:sortable={col.sortable}
            onclick={() => handleHeaderClick(col)}
          >
            <span class="th-content">
              {col.label}
              {#if col.sortable && sortKey === col.key}
                <span class="sort-arrow">{sortDirection === 'asc' ? '\u25B2' : '\u25BC'}</span>
              {/if}
            </span>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.id)}
        <tr
          class:selected={row.id === selectedId}
          onclick={() => onrowclick?.(row)}
          data-testid="table-row-{row.id}"
        >
          {#each columns as col (col.key)}
            <td>
              {@render cell({ row, column: col })}
            </td>
          {/each}
        </tr>
      {/each}
      {#if rows.length === 0}
        <tr class="empty-row">
          <td colspan={columns.length}>
            <span class="empty-text">No results found</span>
          </td>
        </tr>
      {/if}
    </tbody>
  </table>
</div>

<style>
  .data-table-wrap {
    overflow-x: auto;
    border-radius: var(--radius-xl);
    border: 1px solid var(--white-a6);
    background: rgba(10, 22, 42, 0.5);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    box-shadow:
      inset 0 1px 0 var(--white-a3),
      0 1px 3px var(--black-a40),
      0 4px 12px var(--black-a20);
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-base);
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  th {
    padding: var(--space-2-5) var(--space-3-5);
    text-align: left;
    font-size: var(--font-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    background: var(--navy-a80);
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
    user-select: none;
  }

  th.sortable {
    cursor: pointer;
  }

  th.sortable:hover {
    color: var(--color-text-secondary);
  }

  .th-content {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .sort-arrow {
    font-size: var(--font-2xs);
    color: var(--color-teal);
  }

  td {
    padding: var(--space-2-5) var(--space-3-5);
    border-bottom: 1px solid var(--white-a3);
    color: var(--color-text-secondary);
    vertical-align: middle;
  }

  tbody tr {
    cursor: pointer;
    transition: background 0.1s;
  }

  tbody tr:hover {
    background: var(--white-a4);
  }

  tbody tr.selected {
    background: var(--teal-a8);
    border-left: 3px solid var(--color-teal);
  }

  tbody tr.selected td:first-child {
    padding-left: 11px;
  }

  .empty-row td {
    text-align: center;
    padding: var(--space-10) var(--space-3-5);
  }

  .empty-text {
    color: var(--color-text-muted);
    font-size: var(--font-base);
  }
</style>
