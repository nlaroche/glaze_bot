<script lang="ts">
  import type { GachaCharacter } from '@glazebot/shared-types';
  import { CardViewer } from '@glazebot/shared-ui';
  import {
    getAllCharacters,
    deleteCharacter,
    deleteAllCharacters,
    toggleCharacterActive,
    setDefaultCharacter,
    getDeletedCharacters,
    purgeCharacterMedia,
    purgeAllDeletedCharacters,
    getFishVoices,
    getVoiceUsageMap,
  } from '@glazebot/supabase-client';
  import type { FishVoice, TokenPools as TokenPoolsType } from '@glazebot/supabase-client';
  import { toast } from '$lib/stores/toast.svelte';

  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import DataTable from '$lib/components/ui/DataTable.svelte';
  import type { Column } from '$lib/components/ui/DataTable.svelte';
  import Pagination from '$lib/components/ui/Pagination.svelte';
  import TagFilter from '$lib/components/ui/TagFilter.svelte';
  import type { Tag } from '$lib/components/ui/TagFilter.svelte';
  import WorkshopWizardModal from './WorkshopWizardModal.svelte';

  // ─── Types ──────────────────────────────────────────────────────────
  interface TokenPoolEntry { value: string; weight: number; }
  interface TokenPool {
    label: string;
    description: string;
    entries: TokenPoolEntry[];
    conditionalOn?: { pool: string; values: string[]; };
  }

  interface ConfirmOpts {
    title: string;
    message: string;
    label: string;
    variant: 'destructive' | 'primary';
    action: () => void;
  }

  interface Props {
    characters: GachaCharacter[];
    loadingData: boolean;
    tokenPools: Record<string, TokenPool>;
    fishVoices: FishVoice[];
    voiceUsageMap: Map<string, { id: string; name: string }[]>;
    imageProvider: 'pixellab' | 'gemini';
    imageModel: string;
    imageSize: string;
    imageSystemInfo: string;
    oncharacterschanged: () => Promise<void>;
    onconfirm: (opts: ConfirmOpts) => void;
  }

  let {
    characters = $bindable(),
    loadingData,
    tokenPools,
    fishVoices = $bindable(),
    voiceUsageMap = $bindable(),
    imageProvider,
    imageModel,
    imageSize,
    imageSystemInfo,
    oncharacterschanged,
    onconfirm,
  }: Props = $props();

  // ─── State: Table ──────────────────────────────────────────────────
  let page = $state(1);
  let pageSize = $state(10);
  let sortKey = $state('created_at');
  let sortDirection: 'asc' | 'desc' = $state('desc');
  let searchQuery = $state('');
  let activeTags: string[] = $state([]);
  let showDeleted = $state(false);
  let deletedCharacters: GachaCharacter[] = $state([]);
  let loadingDeleted = $state(false);
  let purgingAll = $state(false);

  // ─── State: Modal ──────────────────────────────────────────────────
  let detailPanelOpen = $state(false);
  let workingCharacter: GachaCharacter | null = $state(null);
  let viewerCharacter: GachaCharacter | null = $state(null);

  // ─── Constants ─────────────────────────────────────────────────────
  const tableColumns: Column[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'rarity', label: 'Rarity', sortable: true, width: '90px' },
    { key: 'is_active', label: 'Status', sortable: true, width: '90px' },
    { key: 'voice_name', label: 'Voice', sortable: true, width: '120px' },
    { key: 'avatar_url', label: 'Sprite', width: '70px' },
    { key: 'is_default', label: '\u2605', sortable: true, width: '50px' },
    { key: 'created_at', label: 'Created', sortable: true, width: '100px' },
    { key: 'view', label: '', width: '50px' },
    { key: 'actions', label: '', width: '50px' },
  ];

  const filterTags: Tag[] = [
    { key: 'rarity:common', label: 'Common', color: 'var(--rarity-common)', group: 'Rarity' },
    { key: 'rarity:rare', label: 'Rare', color: 'var(--rarity-rare)', group: 'Rarity' },
    { key: 'rarity:epic', label: 'Epic', color: 'var(--rarity-epic)', group: 'Rarity' },
    { key: 'rarity:legendary', label: 'Legendary', color: 'var(--rarity-legendary)', group: 'Rarity' },
    { key: 'status:active', label: 'Active', color: 'var(--color-teal)', group: 'Status' },
    { key: 'status:inactive', label: 'Inactive', color: 'var(--color-text-muted)', group: 'Status' },
    { key: 'has:voice', label: 'Has Voice', group: 'Features' },
    { key: 'has:sprite', label: 'Has Sprite', group: 'Features' },
    { key: 'is:default', label: 'Default', group: 'Features' },
  ];

  // ─── Derived ───────────────────────────────────────────────────────
  const filtered = $derived.by(() => {
    let result = characters;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
      );
    }
    if (activeTags.length > 0) {
      const groups = new Map<string, string[]>();
      for (const tag of activeTags) {
        const [group, value] = tag.split(':');
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group)!.push(value);
      }
      for (const [group, values] of groups) {
        result = result.filter((c) => {
          if (group === 'rarity') return values.includes(c.rarity);
          if (group === 'status') return values.some(v => v === 'active' ? c.is_active : !c.is_active);
          if (group === 'has') return values.some(v => { if (v === 'voice') return !!c.voice_id; if (v === 'sprite') return !!c.avatar_url; return false; });
          if (group === 'is') return values.some(v => { if (v === 'default') return c.is_default; return false; });
          return true;
        });
      }
    }
    return result;
  });

  const sorted = $derived.by(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];
      let cmp = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal);
      else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') cmp = (aVal === bVal) ? 0 : aVal ? -1 : 1;
      else cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''));
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return arr;
  });

  const paginated = $derived(sorted.slice((page - 1) * pageSize, page * pageSize));

  // Reset page on filter change
  $effect(() => {
    searchQuery;
    activeTags;
    page = 1;
  });

  // ─── Helpers ───────────────────────────────────────────────────────
  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ─── Table Actions ─────────────────────────────────────────────────
  function onRowClick(character: GachaCharacter) {
    workingCharacter = character;
    detailPanelOpen = true;
  }

  async function handleToggleActive(character: GachaCharacter, e: Event) {
    e.stopPropagation();
    try {
      const updated = await toggleCharacterActive(character.id, !character.is_active);
      characters = characters.map(c => c.id === updated.id ? { ...c, ...updated } : c);
      toast.success(`${character.name} ${updated.is_active ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error((err as any)?.message ?? 'Failed to toggle character status');
    }
  }

  async function handleSetDefault(character: GachaCharacter, e: Event) {
    e.stopPropagation();
    try {
      const updated = await setDefaultCharacter(character.id);
      characters = characters.map(c => {
        if (c.id === updated.id) return { ...c, is_default: true };
        if (c.is_default) return { ...c, is_default: false };
        return c;
      });
      toast.success(`${character.name} set as default`);
    } catch (err) {
      toast.error((err as any)?.message ?? 'Failed to set default character');
    }
  }

  function handleDeleteClick(character: GachaCharacter, e: Event) {
    e.stopPropagation();
    onconfirm({
      title: 'Soft-Delete Character',
      message: `Soft-delete "${character.name}"? It will be hidden from users but can be purged later from the deleted list.`,
      label: 'Delete',
      variant: 'destructive',
      action: async () => {
        try {
          await deleteCharacter(character.id);
          characters = characters.filter(c => c.id !== character.id);
          if (workingCharacter?.id === character.id) {
            workingCharacter = null;
            detailPanelOpen = false;
          }
          toast.success(`Deleted "${character.name}"`);
        } catch (err) {
          toast.error((err as any)?.message ?? 'Failed to delete character');
        }
      },
    });
  }

  function handleDeleteAll() {
    const activeCount = characters.filter(c => c.is_active).length;
    if (activeCount === 0) {
      toast.info('No active characters to delete');
      return;
    }
    onconfirm({
      title: 'Delete All Characters',
      message: `Soft-delete ALL ${activeCount} active characters? They can be purged later from the deleted list.`,
      label: 'Delete All',
      variant: 'destructive',
      action: async () => {
        try {
          const count = await deleteAllCharacters();
          await oncharacterschanged();
          workingCharacter = null;
          detailPanelOpen = false;
          toast.success(`Deleted ${count} character${count !== 1 ? 's' : ''}`);
        } catch (e) {
          console.error('deleteAllCharacters failed:', e);
          toast.error((e as any)?.message ?? 'Failed to delete characters');
        }
      },
    });
  }

  // ─── Deleted Characters ────────────────────────────────────────────
  async function loadDeletedCharacters() {
    loadingDeleted = true;
    try {
      deletedCharacters = await getDeletedCharacters();
    } catch {
      deletedCharacters = [];
    } finally {
      loadingDeleted = false;
    }
  }

  function handlePurge(character: GachaCharacter, e: Event) {
    e.stopPropagation();
    onconfirm({
      title: 'Purge Character',
      message: `Permanently purge "${character.name}" and all media? This cannot be undone.`,
      label: 'Purge',
      variant: 'destructive',
      action: async () => {
        try {
          await purgeCharacterMedia(character.id);
          deletedCharacters = deletedCharacters.filter(c => c.id !== character.id);
          toast.success(`Purged "${character.name}"`);
        } catch (err) {
          toast.error((err as any)?.message ?? 'Failed to purge character');
        }
      },
    });
  }

  function handlePurgeAll() {
    const count = deletedCharacters.length;
    onconfirm({
      title: 'Purge All Deleted',
      message: `Permanently purge all ${count} deleted characters and their media? This cannot be undone.`,
      label: 'Purge All',
      variant: 'destructive',
      action: async () => {
        purgingAll = true;
        try {
          await purgeAllDeletedCharacters();
          deletedCharacters = [];
          toast.success(`Purged ${count} deleted character${count !== 1 ? 's' : ''}`);
        } catch (err) {
          toast.error((err as any)?.message ?? 'Failed to purge characters');
        } finally {
          purgingAll = false;
        }
      },
    });
  }

  // ─── Modal Callbacks ───────────────────────────────────────────────
  function closeDetailPanel() {
    detailPanelOpen = false;
  }

  async function handleCharacterUpdated(char: GachaCharacter) {
    workingCharacter = char;
    characters = characters.map(c => c.id === char.id ? char : c);
    if (!characters.find(c => c.id === char.id)) {
      await oncharacterschanged();
    }
    // Reload voice usage map
    try {
      voiceUsageMap = await getVoiceUsageMap();
    } catch {
      // silent
    }
  }
</script>

{#if loadingData}
  <p class="muted">Loading characters...</p>
{:else}
  <!-- Search + Filters -->
  <div class="toolbar">
    <div class="toolbar-top">
      <div class="search-bar">
        <input
          type="text"
          class="search-input"
          placeholder="Search characters..."
          bind:value={searchQuery}
          data-testid="search-input"
        />
      </div>
      <div class="toolbar-actions">
        <Button
          variant="ghost"
          onclick={handleDeleteAll}
          testid="delete-all-btn"
        >
          Delete All
        </Button>
        <Button
          variant="primary"
          onclick={() => {
            workingCharacter = null;
            detailPanelOpen = true;
          }}
          testid="generate-new-btn"
        >
          + Generate New
        </Button>
      </div>
    </div>
    <TagFilter
      tags={filterTags}
      active={activeTags}
      onchange={(tags) => activeTags = tags}
    />
    <label class="toggle-deleted" data-testid="toggle-deleted">
      <input type="checkbox" bind:checked={showDeleted} onchange={() => { if (showDeleted) loadDeletedCharacters(); }} />
      Show Deleted
    </label>
  </div>

  <!-- Main Content -->
  <div class="content-area">
    <div class="table-section">
      <DataTable
        columns={tableColumns}
        rows={paginated}
        selectedId={workingCharacter?.id ?? ''}
        onrowclick={onRowClick}
        {sortKey}
        {sortDirection}
        onsort={(key, dir) => { sortKey = key; sortDirection = dir; }}
      >
        {#snippet cell({ row, column })}
          {#if column.key === 'name'}
            <span class="cell-name">{row.name}</span>
          {:else if column.key === 'rarity'}
            <Badge variant={row.rarity} text={row.rarity} />
          {:else if column.key === 'is_active'}
            <button
              class="status-badge"
              class:active={row.is_active}
              onclick={(e) => handleToggleActive(row, e)}
              data-testid="toggle-active-{row.id}"
            >
              {row.is_active ? 'Active' : 'Inactive'}
            </button>
          {:else if column.key === 'voice_name'}
            <span class="cell-muted">{row.voice_name ?? '\u2014'}</span>
          {:else if column.key === 'avatar_url'}
            {#if row.avatar_url}
              <img class="cell-sprite" src={row.avatar_url} alt="" width="28" height="28" />
            {:else}
              <span class="cell-muted">\u2014</span>
            {/if}
          {:else if column.key === 'is_default'}
            <button
              class="star-btn"
              class:active={row.is_default}
              onclick={(e) => handleSetDefault(row, e)}
              data-testid="set-default-{row.id}"
            >
              {row.is_default ? '\u2605' : '\u2606'}
            </button>
          {:else if column.key === 'created_at'}
            <span class="cell-muted">{formatDate(row.created_at)}</span>
          {:else if column.key === 'view'}
            <button
              class="view-card-btn"
              onclick={(e) => { e.stopPropagation(); viewerCharacter = row; }}
              data-testid="view-card-{row.id}"
              title="View card"
            >&#128065;</button>
          {:else if column.key === 'actions'}
            <button
              class="delete-btn"
              onclick={(e) => handleDeleteClick(row, e)}
              data-testid="delete-{row.id}"
              title="Delete character"
            >&#128465;</button>
          {/if}
        {/snippet}
      </DataTable>

      <Pagination
        total={filtered.length}
        {page}
        {pageSize}
        onpagechange={(p) => page = p}
        onpagesizechange={(s) => { pageSize = s; page = 1; }}
      />

      {#if showDeleted}
        <div class="deleted-section" data-testid="deleted-section">
          <div class="deleted-header">
            <h3>Deleted Characters ({deletedCharacters.length})</h3>
            {#if deletedCharacters.length > 0}
              <Button
                variant="destructive"
                loading={purgingAll}
                onclick={handlePurgeAll}
                testid="purge-all-btn"
              >
                Purge All
              </Button>
            {/if}
          </div>
          {#if loadingDeleted}
            <p class="muted">Loading deleted characters...</p>
          {:else if deletedCharacters.length === 0}
            <p class="muted">No deleted characters.</p>
          {:else}
            <div class="deleted-list">
              {#each deletedCharacters as dc (dc.id)}
                <div class="deleted-row">
                  <span class="deleted-name">{dc.name}</span>
                  <Badge variant={dc.rarity} text={dc.rarity} />
                  <span class="cell-muted">{dc.deleted_at ? formatDate(dc.deleted_at) : ''}</span>
                  <Button
                    variant="destructive"
                    onclick={(e) => handlePurge(dc, e)}
                    testid="purge-{dc.id}"
                  >
                    Purge
                  </Button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Workshop Wizard Modal -->
<WorkshopWizardModal
  open={detailPanelOpen}
  character={workingCharacter}
  {tokenPools}
  {fishVoices}
  {voiceUsageMap}
  {imageProvider}
  {imageModel}
  {imageSize}
  {imageSystemInfo}
  onclose={closeDetailPanel}
  oncharacterupdated={handleCharacterUpdated}
/>

<!-- Card Viewer -->
<CardViewer
  character={viewerCharacter}
  image={viewerCharacter?.avatar_url}
  onclose={() => viewerCharacter = null}
/>

<style>
  .muted { color: var(--color-text-muted); }

  /* ─── Toolbar ─── */
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: var(--space-2-5);
    margin-bottom: var(--space-3-5);
    flex-shrink: 0;
  }

  .toolbar-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .search-bar {
    max-width: 360px;
  }

  .search-input {
    width: 100%;
    padding: var(--input-padding);
    border: 1px solid var(--input-border);
    border-radius: var(--input-radius);
    background: var(--input-bg);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--input-font-size);
    outline: none;
    transition: border-color var(--transition-base), background var(--transition-base);
  }

  .search-input::placeholder {
    color: var(--color-text-muted);
  }

  .search-input:focus {
    border-color: var(--input-focus-border);
    background: var(--input-focus-bg);
  }

  /* ─── Content Area ─── */
  .content-area {
    display: flex;
    gap: var(--space-4);
    flex: 1;
    min-height: 0;
  }

  .table-section {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ─── Table Cells ─── */
  .cell-name {
    font-weight: 600;
    color: var(--color-text-primary);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .cell-muted {
    color: var(--color-text-muted);
    font-size: var(--font-base);
  }

  .cell-sprite {
    border-radius: var(--radius-sm);
    image-rendering: pixelated;
    vertical-align: middle;
  }

  .status-badge {
    padding: var(--space-1) var(--space-2-5);
    border-radius: var(--radius-xl);
    border: 1px solid transparent;
    font-family: inherit;
    font-size: var(--font-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .status-badge.active {
    background: var(--teal-a15);
    color: var(--color-teal);
    border-color: var(--teal-a30);
  }

  .status-badge:not(.active) {
    background: var(--white-a4);
    color: var(--color-text-muted);
    border-color: var(--glass-border);
  }

  .status-badge:hover {
    opacity: 0.8;
  }

  .star-btn {
    background: none;
    border: none;
    font-size: var(--font-base);
    cursor: pointer;
    color: var(--color-text-muted);
    transition: color var(--transition-fast);
    padding: 0;
  }

  .star-btn.active {
    color: var(--rarity-legendary);
  }

  .star-btn:hover {
    color: var(--rarity-legendary);
  }

  .delete-btn {
    background: none;
    border: none;
    font-size: var(--font-sm);
    cursor: pointer;
    color: var(--color-text-muted);
    padding: var(--space-0-5);
    transition: color var(--transition-fast);
  }

  .delete-btn:hover {
    color: var(--color-error);
  }

  .view-card-btn {
    background: none;
    border: none;
    font-size: var(--font-base);
    cursor: pointer;
    color: var(--color-text-muted);
    padding: var(--space-0-5);
    transition: color var(--transition-fast);
  }

  .view-card-btn:hover {
    color: var(--color-teal);
  }

  /* ─── Show Deleted Toggle ─── */
  .toggle-deleted {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
  }

  .toggle-deleted input {
    accent-color: var(--color-teal);
  }

  /* ─── Deleted Characters Section ─── */
  .deleted-section {
    margin-top: var(--space-4);
    padding: var(--space-4);
    background: var(--panel-bg);
    border: 1px solid var(--error-a15);
    border-radius: var(--radius-xl);
  }

  .deleted-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }

  .deleted-header h3 {
    font-size: var(--font-xl);
    font-weight: 700;
    font-family: var(--font-brand);
    color: var(--color-heading);
    letter-spacing: -0.01em;
    margin: 0;
  }

  .deleted-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1-5);
  }

  .deleted-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--white-a2);
    border-radius: var(--radius-md);
  }

  .deleted-name {
    flex: 1;
    font-size: var(--font-base);
    color: var(--color-text-secondary);
  }
</style>
