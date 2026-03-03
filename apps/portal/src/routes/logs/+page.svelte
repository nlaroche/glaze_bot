<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getRecentLogs,
    getLogsByCharacter,
    getCollection,
    type ActivityLogEntry,
  } from '@glazebot/supabase-client';
  import type { GachaCharacter } from '@glazebot/shared-types';

  let logs: ActivityLogEntry[] = $state([]);
  let characters: GachaCharacter[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  // Filters
  let scopeFilter = $state('all');
  let levelFilter = $state('all');
  let characterSearch = $state('');
  let selectedCharacterId = $state('');
  let expandedIds = $state(new Set<string>());

  // Character name suggestions
  let suggestions = $derived(
    characterSearch.length >= 2
      ? characters.filter((c) =>
          c.name.toLowerCase().includes(characterSearch.toLowerCase()),
        ).slice(0, 5)
      : [],
  );

  async function fetchLogs() {
    loading = true;
    error = '';
    try {
      if (selectedCharacterId) {
        logs = await getLogsByCharacter(selectedCharacterId);
      } else {
        logs = await getRecentLogs(100, {
          scope: scopeFilter,
          level: levelFilter,
        });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to fetch logs';
    } finally {
      loading = false;
    }
  }

  function selectCharacter(char: GachaCharacter) {
    selectedCharacterId = char.id;
    characterSearch = char.name;
    fetchLogs();
  }

  function clearCharacterFilter() {
    selectedCharacterId = '';
    characterSearch = '';
    fetchLogs();
  }

  function toggleExpand(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedIds = next;
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function truncateId(id: string | null): string {
    if (!id) return '-';
    return id.slice(0, 8);
  }

  onMount(async () => {
    const [, chars] = await Promise.all([
      fetchLogs(),
      getCollection().catch(() => [] as GachaCharacter[]),
    ]);
    characters = chars;
  });
</script>

<div class="page" data-testid="logs-page">
  <h1>Activity Logs</h1>

  <div class="filters">
    <div class="filter-group character-search">
      <label for="char-search">Character</label>
      <div class="search-wrapper">
        <input
          id="char-search"
          type="text"
          placeholder="Search by name..."
          bind:value={characterSearch}
          oninput={() => { if (!characterSearch) clearCharacterFilter(); }}
          data-testid="log-character-search"
        />
        {#if selectedCharacterId}
          <button class="clear-btn" onclick={clearCharacterFilter} title="Clear">&times;</button>
        {/if}
        {#if suggestions.length > 0 && !selectedCharacterId}
          <ul class="suggestions">
            {#each suggestions as char}
              <li>
                <button onclick={() => selectCharacter(char)}>
                  <span class="suggestion-name">{char.name}</span>
                  <span class="suggestion-rarity badge badge-{char.rarity}">{char.rarity}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>

    <div class="filter-group">
      <label for="scope-filter">Scope</label>
      <select id="scope-filter" bind:value={scopeFilter} onchange={fetchLogs} data-testid="log-scope-filter">
        <option value="all">All</option>
        <option value="character">Character</option>
        <option value="session">Session</option>
        <option value="system">System</option>
      </select>
    </div>

    <div class="filter-group">
      <label for="level-filter">Level</label>
      <select id="level-filter" bind:value={levelFilter} onchange={fetchLogs} data-testid="log-level-filter">
        <option value="all">All</option>
        <option value="info">Info</option>
        <option value="warn">Warn</option>
        <option value="error">Error</option>
      </select>
    </div>

    <button class="refresh-btn" onclick={fetchLogs} data-testid="log-refresh">Refresh</button>
  </div>

  {#if error}
    <div class="error-banner">{error}</div>
  {/if}

  {#if loading}
    <div class="loading">Loading logs...</div>
  {:else if logs.length === 0}
    <div class="empty">No log entries found.</div>
  {:else}
    <div class="log-table-wrapper">
      <table class="log-table" data-testid="log-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Scope</th>
            <th>Event</th>
            <th>Level</th>
            <th>Character</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {#each logs as entry}
            <tr class="level-{entry.level}">
              <td class="col-time">{formatTime(entry.created_at)}</td>
              <td><span class="badge badge-scope">{entry.scope}</span></td>
              <td class="col-event">{entry.event}</td>
              <td>
                <span class="badge badge-level badge-level-{entry.level}">{entry.level}</span>
              </td>
              <td class="col-id" title={entry.character_id ?? ''}>{truncateId(entry.character_id)}</td>
              <td class="col-data">
                {#if entry.data}
                  <button class="data-toggle" onclick={() => toggleExpand(entry.id)}>
                    {expandedIds.has(entry.id) ? 'Hide' : 'Show'}
                  </button>
                {:else}
                  <span class="no-data">-</span>
                {/if}
              </td>
            </tr>
            {#if expandedIds.has(entry.id) && entry.data}
              <tr class="data-row">
                <td colspan="6">
                  <pre class="json-data">{JSON.stringify(entry.data, null, 2)}</pre>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: var(--space-5) var(--space-7) var(--space-5);
    gap: var(--space-4);
    overflow: hidden;
  }

  h1 {
    font-family: var(--font-brand);
    font-size: var(--font-xl);
    font-weight: 400;
    color: var(--color-heading);
    letter-spacing: 1px;
    margin: 0;
    flex-shrink: 0;
  }

  /* ─── Filters ─── */
  .filters {
    display: flex;
    align-items: flex-end;
    gap: var(--space-4);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .filter-group label {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .character-search {
    flex: 1;
    min-width: 200px;
    max-width: 320px;
    position: relative;
  }

  .search-wrapper {
    position: relative;
  }

  input, select {
    background: rgba(10, 22, 42, 0.6);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-size: var(--font-base);
    padding: var(--space-1-5) var(--space-2-5);
    font-family: inherit;
  }

  input:focus, select:focus {
    outline: none;
    border-color: var(--color-teal);
  }

  input {
    width: 100%;
  }

  .clear-btn {
    position: absolute;
    right: var(--space-1-5);
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: var(--font-lg);
    line-height: 1;
    padding: 0 var(--space-1);
  }

  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: rgba(10, 22, 42, 0.95);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    list-style: none;
    margin: var(--space-1) 0 0;
    padding: var(--space-1) 0;
    z-index: 10;
  }

  .suggestions button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-1-5) var(--space-2-5);
    background: none;
    border: none;
    color: var(--color-text-primary);
    font-size: var(--font-base);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }

  .suggestions button:hover {
    background: var(--teal-a12);
  }

  .suggestion-name {
    flex: 1;
  }

  .refresh-btn {
    background: var(--teal-a12);
    border: 1px solid var(--color-teal);
    border-radius: var(--radius-md);
    color: var(--color-teal);
    font-size: var(--font-base);
    padding: var(--space-1-5) var(--space-3);
    cursor: pointer;
    font-family: inherit;
    font-weight: 500;
    transition: all var(--transition-base);
  }

  .refresh-btn:hover {
    background: var(--teal-a20);
  }

  /* ─── Badges ─── */
  .badge {
    display: inline-block;
    padding: 1px var(--space-1-5);
    border-radius: var(--radius-sm);
    font-size: var(--font-sm);
    font-weight: 500;
    text-transform: capitalize;
  }

  .badge-scope {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-primary);
  }

  .badge-level-info {
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
  }

  .badge-level-warn {
    background: rgba(251, 191, 36, 0.15);
    color: #fbbf24;
  }

  .badge-level-error {
    background: rgba(248, 113, 113, 0.15);
    color: #f87171;
  }

  .badge-common { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
  .badge-rare { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
  .badge-epic { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
  .badge-legendary { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }

  /* ─── Table ─── */
  .log-table-wrapper {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .log-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-base);
  }

  .log-table thead {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .log-table th {
    background: rgba(10, 22, 42, 0.8);
    padding: var(--space-2) var(--space-2-5);
    text-align: left;
    font-weight: 600;
    color: var(--color-text-secondary);
    font-size: var(--font-sm);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--color-border);
  }

  .log-table td {
    padding: var(--space-1-5) var(--space-2-5);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    color: var(--color-text-primary);
    vertical-align: top;
  }

  .log-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .col-time {
    white-space: nowrap;
    color: var(--color-text-secondary);
    font-size: var(--font-sm);
    font-variant-numeric: tabular-nums;
  }

  .col-event {
    font-family: 'Fira Code', 'Cascadia Code', monospace;
    font-size: var(--font-sm);
  }

  .col-id {
    font-family: 'Fira Code', 'Cascadia Code', monospace;
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
  }

  .col-data {
    text-align: center;
  }

  .data-toggle {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: var(--font-sm);
    padding: 1px var(--space-1-5);
    cursor: pointer;
    font-family: inherit;
  }

  .data-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }

  .no-data {
    color: var(--color-text-muted);
  }

  .data-row td {
    padding: 0 var(--space-2-5) var(--space-2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .json-data {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-2-5);
    margin: var(--space-1) 0 0;
    font-family: 'Fira Code', 'Cascadia Code', monospace;
    font-size: var(--font-base);
    color: var(--color-text-primary);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* ─── States ─── */
  .loading, .empty {
    text-align: center;
    padding: var(--space-8);
    color: var(--color-text-secondary);
    font-size: var(--font-base);
  }

  .error-banner {
    background: rgba(248, 113, 113, 0.1);
    border: 1px solid rgba(248, 113, 113, 0.3);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    color: #f87171;
    font-size: var(--font-base);
  }

  /* ─── Error row highlight ─── */
  tr.level-error {
    background: rgba(248, 113, 113, 0.04);
  }

  tr.level-warn {
    background: rgba(251, 191, 36, 0.03);
  }
</style>
