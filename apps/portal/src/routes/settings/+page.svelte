<script lang="ts">
  import {
    getGachaConfig,
    updateGachaConfig,
    generateCharacterText,
    generateCharacterImage,
    assignCharacterVoice,
    previewVoice,
    updateCharacter,
    getAllCharacters,
    deleteCharacter,
    toggleCharacterActive,
    setDefaultCharacter,
  } from '@glazebot/supabase-client';
  import { CharacterCard } from '@glazebot/shared-ui';
  import type { GachaCharacter, CharacterRarity, GenerationMetadata } from '@glazebot/shared-types';

  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import NumberInput from '$lib/components/ui/NumberInput.svelte';
  import SliderInput from '$lib/components/ui/SliderInput.svelte';
  import TextArea from '$lib/components/ui/TextArea.svelte';
  import TextInput from '$lib/components/ui/TextInput.svelte';

  import DataTable from '$lib/components/ui/DataTable.svelte';
  import type { Column } from '$lib/components/ui/DataTable.svelte';
  import Pagination from '$lib/components/ui/Pagination.svelte';
  import TagFilter from '$lib/components/ui/TagFilter.svelte';
  import type { Tag } from '$lib/components/ui/TagFilter.svelte';
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';

  import PipelineStep from '$lib/components/admin/PipelineStep.svelte';

  // ─── Types ──────────────────────────────────────────────────────────
  type StepStatus = 'idle' | 'running' | 'done' | 'error';

  // ─── State: Data ──────────────────────────────────────────────────
  let characters: GachaCharacter[] = $state([]);
  let loadingData = $state(true);

  // ─── State: Table ─────────────────────────────────────────────────
  let page = $state(1);
  let pageSize = $state(10);
  let sortKey = $state('created_at');
  let sortDirection: 'asc' | 'desc' = $state('desc');
  let searchQuery = $state('');
  let activeTags: string[] = $state([]);

  // ─── State: Panels ────────────────────────────────────────────────
  let activeTab: 'config' | 'economy' | 'workshop' = $state('config');
  let detailPanelOpen = $state(false);
  let configDrawerOpen = $state(false);

  // ─── State: Config ────────────────────────────────────────────────
  let config: Record<string, unknown> = $state({});
  let rawJson: string = $state('');
  let loading: boolean = $state(true);
  let saving: boolean = $state(false);
  let saveMsg: string = $state('');
  let jsonError: string = $state('');

  let model = $state('qwen-plus');
  let baseTemperature = $state(0.9);
  let packsPerDay = $state(3);
  let cardsPerPack = $state(3);
  let generationPrompt = $state('');
  let imageSystemInfo = $state('facing south, sitting at a table, 128x128 pixel art sprite, no background');
  let dropRates = $state({ common: 0.6, rare: 0.25, epic: 0.12, legendary: 0.03 });

  // ─── State: Pipeline ──────────────────────────────────────────────
  let workingCharacter: GachaCharacter | null = $state(null);
  let pipeline = $state({ step1: 'idle' as StepStatus, step2: 'idle' as StepStatus, step3: 'idle' as StepStatus });
  let stepErrors = $state({ step1: '', step2: '', step3: '' });

  let editName = $state('');
  let editDescription = $state('');
  let editBackstory = $state('');
  let editSystemPrompt = $state('');
  let editPersonality = $state({ energy: 50, positivity: 50, formality: 50, talkativeness: 50, attitude: 50, humor: 50 });

  let imagePrompt = $state('');
  let voiceTestText = $state('Hey there! Ready to watch some games?');
  let voicePlaying = $state(false);
  let availableVoices: { id: string; name: string }[] = $state([]);

  // ─── State: Confirm Dialog ────────────────────────────────────────
  let confirmOpen = $state(false);
  let confirmTitle = $state('');
  let confirmMessage = $state('');
  let confirmLabel = $state('Delete');
  let confirmVariant: 'destructive' | 'primary' = $state('destructive');
  let confirmAction: () => void = $state(() => {});

  // ─── State: Generate ──────────────────────────────────────────────
  let generateRarity: CharacterRarity = $state('common');

  // ─── Constants ────────────────────────────────────────────────────
  const modelOptions = [
    { value: 'qwen-plus', label: 'qwen-plus' },
    { value: 'qwen-turbo', label: 'qwen-turbo' },
    { value: 'qwen-max', label: 'qwen-max' },
    { value: 'qwen3-vl-flash', label: 'qwen3-vl-flash' },
  ];

  const rarities = ['common', 'rare', 'epic', 'legendary'] as const;
  const traitLabels = ['energy', 'positivity', 'formality', 'talkativeness', 'attitude', 'humor'] as const;
  const rarityOptions = rarities.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }));

  const tableColumns: Column[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'rarity', label: 'Rarity', sortable: true, width: '90px' },
    { key: 'is_active', label: 'Status', sortable: true, width: '90px' },
    { key: 'voice_name', label: 'Voice', sortable: true, width: '120px' },
    { key: 'avatar_url', label: 'Sprite', width: '70px' },
    { key: 'is_default', label: '\u2605', sortable: true, width: '50px' },
    { key: 'created_at', label: 'Created', sortable: true, width: '100px' },
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

  // ─── Derived ──────────────────────────────────────────────────────
  const dropRateSum = $derived(
    Math.round((dropRates.common + dropRates.rare + dropRates.epic + dropRates.legendary) * 100) / 100
  );

  const metadata = $derived(
    (workingCharacter?.generation_metadata ?? null) as GenerationMetadata | null
  );

  const filtered = $derived.by(() => {
    let result = characters;

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
      );
    }

    // Tag filters: OR within group, AND across groups
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
          if (group === 'status') {
            return values.some(v =>
              v === 'active' ? c.is_active : !c.is_active
            );
          }
          if (group === 'has') {
            return values.some(v => {
              if (v === 'voice') return !!c.voice_id;
              if (v === 'sprite') return !!c.avatar_url;
              return false;
            });
          }
          if (group === 'is') {
            return values.some(v => {
              if (v === 'default') return c.is_default;
              return false;
            });
          }
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
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        cmp = (aVal === bVal) ? 0 : aVal ? -1 : 1;
      } else {
        cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''));
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return arr;
  });

  const paginated = $derived(sorted.slice((page - 1) * pageSize, page * pageSize));

  // ─── Lifecycle ────────────────────────────────────────────────────
  $effect(() => {
    loadConfig();
    loadCharacters();
  });

  // Reset to page 1 when filters change
  $effect(() => {
    // Touch the reactive dependencies
    searchQuery;
    activeTags;
    page = 1;
  });

  // ─── Data Loading ─────────────────────────────────────────────────
  async function loadCharacters() {
    loadingData = true;
    try {
      characters = await getAllCharacters();
    } catch {
      characters = [];
    } finally {
      loadingData = false;
    }
  }

  // ─── Config Sync ──────────────────────────────────────────────────
  function syncFromConfig() {
    const dr = config.dropRates as Record<string, number> | undefined;
    if (dr) dropRates = { common: dr.common ?? 0.6, rare: dr.rare ?? 0.25, epic: dr.epic ?? 0.12, legendary: dr.legendary ?? 0.03 };
    baseTemperature = (config.baseTemperature as number) ?? 0.9;
    model = (config.model as string) ?? 'qwen-plus';
    packsPerDay = (config.packsPerDay as number) ?? 3;
    cardsPerPack = (config.cardsPerPack as number) ?? 3;
    generationPrompt = (config.generationPrompt as string) ?? '';
    imageSystemInfo = (config.imageSystemInfo as string) ?? 'facing south, sitting at a table, 128x128 pixel art sprite, no background';
  }

  function syncToConfig() {
    config = {
      ...config,
      dropRates: { ...dropRates },
      baseTemperature,
      model,
      packsPerDay,
      cardsPerPack,
      generationPrompt,
      imageSystemInfo,
    };
    rawJson = JSON.stringify(config, null, 2);
  }

  // ─── Config Actions ───────────────────────────────────────────────
  async function loadConfig() {
    loading = true;
    try {
      const row = await getGachaConfig();
      config = (row?.config as Record<string, unknown>) ?? {};
      rawJson = JSON.stringify(config, null, 2);
      syncFromConfig();
    } catch {
      // Default config
    } finally {
      loading = false;
    }
  }

  function onJsonEdit() {
    jsonError = '';
    try {
      config = JSON.parse(rawJson);
      syncFromConfig();
    } catch (e) {
      jsonError = e instanceof Error ? e.message : 'Invalid JSON';
    }
  }

  async function saveConfig() {
    saving = true;
    saveMsg = '';
    try {
      syncToConfig();
      await updateGachaConfig(config);
      saveMsg = 'Saved!';
      setTimeout(() => saveMsg = '', 2000);
    } catch (e) {
      saveMsg = e instanceof Error ? e.message : 'Save failed';
    } finally {
      saving = false;
    }
  }

  // ─── Table Actions ────────────────────────────────────────────────
  function onRowClick(character: GachaCharacter) {
    loadCharacterIntoEditor(character);
    detailPanelOpen = true;
  }

  function closeDetailPanel() {
    detailPanelOpen = false;
  }

  async function handleToggleActive(character: GachaCharacter, e: Event) {
    e.stopPropagation();
    try {
      const updated = await toggleCharacterActive(character.id, !character.is_active);
      characters = characters.map(c => c.id === updated.id ? { ...c, ...updated } : c);
    } catch (err) {
      // silently fail — could add toast later
    }
  }

  async function handleSetDefault(character: GachaCharacter, e: Event) {
    e.stopPropagation();
    try {
      const updated = await setDefaultCharacter(character.id);
      // Clear old default, set new
      characters = characters.map(c => {
        if (c.id === updated.id) return { ...c, is_default: true };
        if (c.is_default) return { ...c, is_default: false };
        return c;
      });
    } catch (err) {
      // silently fail
    }
  }

  function handleDeleteClick(character: GachaCharacter, e: Event) {
    e.stopPropagation();
    confirmTitle = 'Delete Character';
    confirmMessage = `Permanently delete "${character.name}"? This cannot be undone.`;
    confirmLabel = 'Delete';
    confirmVariant = 'destructive';
    confirmAction = async () => {
      try {
        await deleteCharacter(character.id);
        characters = characters.filter(c => c.id !== character.id);
        if (workingCharacter?.id === character.id) {
          workingCharacter = null;
          detailPanelOpen = false;
        }
      } catch (err) {
        // silently fail
      }
      confirmOpen = false;
    };
    confirmOpen = true;
  }

  // ─── Character Loading ────────────────────────────────────────────
  function loadCharacterIntoEditor(character: GachaCharacter) {
    workingCharacter = character;
    editName = character.name;
    editDescription = character.description ?? '';
    editBackstory = character.backstory ?? '';
    editSystemPrompt = character.system_prompt ?? '';
    editPersonality = {
      energy: (character.personality as Record<string, number>)?.energy ?? 50,
      positivity: (character.personality as Record<string, number>)?.positivity ?? 50,
      formality: (character.personality as Record<string, number>)?.formality ?? 50,
      talkativeness: (character.personality as Record<string, number>)?.talkativeness ?? 50,
      attitude: (character.personality as Record<string, number>)?.attitude ?? 50,
      humor: (character.personality as Record<string, number>)?.humor ?? 50,
    };

    imagePrompt = `${imageSystemInfo}\n\n${character.description ?? ''}`;

    const meta = character.generation_metadata as GenerationMetadata | null;
    pipeline = {
      step1: meta?.step1_text ? 'done' : 'idle',
      step2: meta?.step2_image ? 'done' : 'idle',
      step3: meta?.step3_voice ? 'done' : 'idle',
    };
    stepErrors = { step1: '', step2: '', step3: '' };
  }

  // ─── Pipeline: Step 1 — Text Generation ───────────────────────────
  async function runStep1(rarity: CharacterRarity) {
    pipeline.step1 = 'running';
    stepErrors.step1 = '';
    try {
      const character = await generateCharacterText(rarity);
      loadCharacterIntoEditor(character);
      pipeline.step1 = 'done';
      detailPanelOpen = true;
      await loadCharacters();
    } catch (e) {
      pipeline.step1 = 'error';
      stepErrors.step1 = e instanceof Error ? e.message : 'Generation failed';
    }
  }

  async function rerunStep1() {
    if (!workingCharacter) return;
    pipeline.step1 = 'running';
    stepErrors.step1 = '';
    try {
      const character = await generateCharacterText(workingCharacter.rarity);
      loadCharacterIntoEditor(character);
      pipeline.step1 = 'done';
      await loadCharacters();
    } catch (e) {
      pipeline.step1 = 'error';
      stepErrors.step1 = e instanceof Error ? e.message : 'Generation failed';
    }
  }

  async function saveEdits() {
    if (!workingCharacter) return;
    try {
      const updated = await updateCharacter(workingCharacter.id, {
        name: editName,
        description: editDescription,
        backstory: editBackstory,
        system_prompt: editSystemPrompt,
        personality: { ...editPersonality },
      } as Partial<GachaCharacter>);
      workingCharacter = updated;
      characters = characters.map(c => c.id === updated.id ? { ...c, ...updated } : c);
    } catch (e) {
      stepErrors.step1 = e instanceof Error ? e.message : 'Save failed';
    }
  }

  // ─── Pipeline: Step 2 — Image Generation ──────────────────────────
  async function runStep2() {
    if (!workingCharacter) return;
    pipeline.step2 = 'running';
    stepErrors.step2 = '';
    try {
      const result = await generateCharacterImage(workingCharacter.id, imagePrompt);
      workingCharacter = { ...workingCharacter, avatar_url: result.avatar_url };
      const { getCharacter } = await import('@glazebot/supabase-client');
      workingCharacter = await getCharacter(workingCharacter.id);
      pipeline.step2 = 'done';
      characters = characters.map(c => c.id === workingCharacter!.id ? workingCharacter! : c);
    } catch (e) {
      pipeline.step2 = 'error';
      stepErrors.step2 = e instanceof Error ? e.message : 'Image generation failed';
    }
  }

  // ─── Pipeline: Step 3 — Voice Assignment ──────────────────────────
  async function runStep3(voiceId?: string) {
    if (!workingCharacter) return;
    pipeline.step3 = 'running';
    stepErrors.step3 = '';
    try {
      const result = await assignCharacterVoice(workingCharacter.id, voiceId);
      workingCharacter = {
        ...workingCharacter,
        voice_id: result.voice_id,
        voice_name: result.voice_name,
      };
      availableVoices = result.voices;
      const { getCharacter } = await import('@glazebot/supabase-client');
      workingCharacter = await getCharacter(workingCharacter.id);
      pipeline.step3 = 'done';
      characters = characters.map(c => c.id === workingCharacter!.id ? workingCharacter! : c);
    } catch (e) {
      pipeline.step3 = 'error';
      stepErrors.step3 = e instanceof Error ? e.message : 'Voice assignment failed';
    }
  }

  async function playVoicePreview() {
    if (!workingCharacter?.voice_id) return;
    voicePlaying = true;
    try {
      const audioData = await previewVoice(workingCharacter.voice_id, voiceTestText);
      const blob = new Blob([audioData], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { voicePlaying = false; URL.revokeObjectURL(url); };
      audio.onerror = () => { voicePlaying = false; URL.revokeObjectURL(url); };
      audio.play();
    } catch {
      voicePlaying = false;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────
  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
</script>

<div class="admin-page" class:scrollable={activeTab !== 'workshop'} data-testid="settings-page">
  <!-- ═══ HEADER ═══ -->
  <div class="page-header">
    <h1>Admin</h1>
    <div class="header-actions" class:hidden-actions={activeTab !== 'workshop'}>
      <div class="generate-inline">
        <Select
          bind:value={generateRarity}
          options={rarityOptions}
          testid="generate-rarity-select"
        />
        <Button
          variant="primary"
          loading={pipeline.step1 === 'running'}
          onclick={() => runStep1(generateRarity)}
          testid="generate-new-btn"
        >
          + Generate New
        </Button>
      </div>
    </div>
  </div>

  <!-- ═══ TABS ═══ -->
  <div class="top-tabs">
    <button
      class="top-tab"
      class:active={activeTab === 'config'}
      onclick={() => activeTab = 'config'}
      data-testid="tab-config"
    >Card Generation</button>
    <button
      class="top-tab"
      class:active={activeTab === 'economy'}
      onclick={() => activeTab = 'economy'}
      data-testid="tab-economy"
    >Gacha Economy</button>
    <button
      class="top-tab"
      class:active={activeTab === 'workshop'}
      onclick={() => activeTab = 'workshop'}
      data-testid="tab-workshop"
    >Workshop</button>
  </div>

  <!-- ═══ TAB: WORKSHOP ═══ -->
  {#if activeTab === 'workshop'}
    {#if loadingData}
      <p class="muted">Loading characters...</p>
    {:else}
      <!-- ═══ SEARCH + FILTERS ═══ -->
      <div class="toolbar">
        <div class="search-bar">
          <input
            type="text"
            class="search-input"
            placeholder="Search characters..."
            bind:value={searchQuery}
            data-testid="search-input"
          />
        </div>
        <TagFilter
          tags={filterTags}
          active={activeTags}
          onchange={(tags) => activeTags = tags}
        />
      </div>

      <!-- ═══ MAIN CONTENT ═══ -->
      <div class="content-area" class:panel-open={detailPanelOpen}>
        <!-- ═══ TABLE ═══ -->
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
        </div>

        <!-- ═══ DETAIL PANEL ═══ -->
        {#if detailPanelOpen && workingCharacter}
          <div class="detail-panel" data-testid="detail-panel">
            <div class="detail-header">
              <h2>{workingCharacter.name}</h2>
              <button class="close-btn" onclick={closeDetailPanel} data-testid="close-detail">&times;</button>
            </div>

            <div class="detail-content">
              <div class="pipeline" data-testid="pipeline">
                <!-- ═══ STEP 1: Text Generation ═══ -->
                <PipelineStep
                  step={1}
                  title="Text Generation"
                  status={pipeline.step1}
                  onrun={rerunStep1}
                  metadata={metadata?.step1_text}
                  error={stepErrors.step1}
                >
                  <div class="step-fields">
                    <TextInput label="Name" bind:value={editName} testid="edit-name" />
                    <TextArea label="Description" bind:value={editDescription} rows={3} testid="edit-description" />
                    <TextArea label="Backstory" bind:value={editBackstory} rows={3} testid="edit-backstory" />
                    <TextArea label="System Prompt" bind:value={editSystemPrompt} rows={5} monospace testid="edit-system-prompt" />

                    <div class="traits-section">
                      <span class="traits-label">Personality Traits</span>
                      {#each traitLabels as trait}
                        <SliderInput
                          label={trait}
                          bind:value={editPersonality[trait]}
                          min={0}
                          max={100}
                          step={1}
                          testid="trait-{trait}"
                        />
                      {/each}
                    </div>

                    <div class="step-actions">
                      <Button variant="secondary" onclick={saveEdits} testid="save-edits-btn">Save Edits</Button>
                    </div>
                  </div>
                </PipelineStep>

                <!-- ═══ STEP 2: Sprite Generation ═══ -->
                <PipelineStep
                  step={2}
                  title="Sprite Generation"
                  status={pipeline.step2}
                  onrun={runStep2}
                  metadata={metadata?.step2_image}
                  error={stepErrors.step2}
                >
                  <div class="step-fields">
                    <div class="prompt-info">
                      <span class="info-label">Image System Info</span>
                      <span class="info-value">{imageSystemInfo}</span>
                    </div>
                    <div class="prompt-info">
                      <span class="info-label">Character Description</span>
                      <span class="info-value">{editDescription || '(none)'}</span>
                    </div>
                    <TextArea
                      label="Combined Prompt (editable)"
                      bind:value={imagePrompt}
                      rows={4}
                      testid="image-prompt"
                    />

                    {#if workingCharacter.avatar_url}
                      <div class="sprite-preview">
                        <img src={workingCharacter.avatar_url} alt="{workingCharacter.name} sprite" width="128" height="128" />
                      </div>
                    {:else}
                      <div class="sprite-placeholder">
                        <span>No sprite yet</span>
                      </div>
                    {/if}
                  </div>
                </PipelineStep>

                <!-- ═══ STEP 3: Voice Assignment ═══ -->
                <PipelineStep
                  step={3}
                  title="Voice Assignment"
                  status={pipeline.step3}
                  onrun={() => runStep3()}
                  metadata={metadata?.step3_voice}
                  error={stepErrors.step3}
                >
                  <div class="step-fields">
                    <div class="voice-info">
                      <span class="voice-label">Voice: {workingCharacter.voice_name ?? 'None assigned'}</span>
                      <Button variant="ghost" onclick={() => runStep3()} testid="rerandomize-voice">Re-randomize</Button>
                    </div>

                    <div class="voice-test">
                      <TextInput
                        label="Test text"
                        bind:value={voiceTestText}
                        testid="voice-test-text"
                      />
                      <Button
                        variant="secondary"
                        loading={voicePlaying}
                        disabled={!workingCharacter.voice_id}
                        onclick={playVoicePreview}
                        testid="play-voice-btn"
                      >
                        Play Preview
                      </Button>
                    </div>

                    {#if availableVoices.length > 0}
                      <div class="voice-list">
                        <span class="info-label">Available Voices ({availableVoices.length})</span>
                        <div class="voice-options">
                          {#each availableVoices as voice (voice.id)}
                            <button
                              class="voice-option"
                              class:active={workingCharacter.voice_id === voice.id}
                              onclick={() => runStep3(voice.id)}
                            >
                              {voice.name}
                            </button>
                          {/each}
                        </div>
                      </div>
                    {/if}
                  </div>
                </PipelineStep>

                <!-- ═══ STEP 4: Final Preview ═══ -->
                <div class="preview-step" data-testid="pipeline-step-4">
                  <div class="preview-header">
                    <span class="step-number">4</span>
                    <span class="step-title">Final Preview</span>
                  </div>
                  <div class="preview-content">
                    <CharacterCard
                      character={{
                        ...workingCharacter,
                        name: editName,
                        description: editDescription,
                        backstory: editBackstory,
                        system_prompt: editSystemPrompt,
                        personality: { ...editPersonality },
                      }}
                      flipped={true}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}

  <!-- ═══ TAB: CARD GENERATION ═══ -->
  {:else if activeTab === 'config'}
    {#if loading}
      <p class="muted">Loading config...</p>
    {:else}
      <div class="cfg" data-testid="config-panel">
        <!-- Row 1: Generation Engine -->
        <div class="cfg-card">
          <div class="cfg-header">
            <h3 class="cfg-title">Generation Engine</h3>
            <p class="cfg-desc">Model and creativity settings for character generation</p>
          </div>
          <div class="cfg-body">
            <div class="cfg-pair">
              <Select label="Model" bind:value={model} options={modelOptions} onchange={syncToConfig} testid="config-model" />
              <SliderInput label="Temperature" bind:value={baseTemperature} min={0} max={2} step={0.05} onchange={syncToConfig} testid="config-temperature" />
            </div>
          </div>
        </div>

        <!-- Row 2: Prompts side by side -->
        <div class="cfg-row-2col">
          <div class="cfg-card">
            <div class="cfg-header">
              <h3 class="cfg-title">Character Prompt</h3>
              <p class="cfg-desc">System prompt template for text generation</p>
            </div>
            <div class="cfg-body">
              <TextArea bind:value={generationPrompt} rows={12} monospace placeholder="System prompt template..." onchange={() => { config = { ...config, generationPrompt }; rawJson = JSON.stringify(config, null, 2); }} testid="config-generation-prompt" />
            </div>
          </div>
          <div class="cfg-card">
            <div class="cfg-header">
              <h3 class="cfg-title">Image Prompt Prefix</h3>
              <p class="cfg-desc">Prepended to character description for sprite generation</p>
            </div>
            <div class="cfg-body">
              <TextArea bind:value={imageSystemInfo} rows={12} placeholder="facing south, sitting at a table..." onchange={() => { config = { ...config, imageSystemInfo }; rawJson = JSON.stringify(config, null, 2); }} testid="config-image-system-info" />
            </div>
          </div>
        </div>

        <!-- Row 3: Raw JSON full width -->
        <div class="cfg-card">
          <div class="cfg-header">
            <h3 class="cfg-title">Raw Config JSON</h3>
            <p class="cfg-desc">Direct JSON editing — changes here override the fields above</p>
          </div>
          <div class="cfg-body">
            <textarea class="json-editor" bind:value={rawJson} oninput={onJsonEdit} rows="12" spellcheck="false" data-testid="config-raw-json"></textarea>
            {#if jsonError}
              <p class="error" data-testid="config-json-error">{jsonError}</p>
            {/if}
          </div>
        </div>

        <!-- Save -->
        <div class="cfg-save">
          {#if saveMsg}
            <span class="save-msg" class:error={saveMsg !== 'Saved!'} data-testid="save-msg">{saveMsg}</span>
          {/if}
          <Button variant="primary" loading={saving} disabled={!!jsonError} onclick={saveConfig} testid="save-config-btn">
            {saving ? 'Saving...' : 'Save Config'}
          </Button>
        </div>
      </div>
    {/if}

  <!-- ═══ TAB: GACHA ECONOMY ═══ -->
  {:else if activeTab === 'economy'}
    {#if loading}
      <p class="muted">Loading config...</p>
    {:else}
      <div class="cfg" data-testid="economy-panel">
        <div class="cfg-row-2col">
          <div class="cfg-card">
            <div class="cfg-header">
              <h3 class="cfg-title">Pack Limits</h3>
              <p class="cfg-desc">How many packs users can open and how many cards they contain</p>
            </div>
            <div class="cfg-body">
              <NumberInput label="Packs / Day" bind:value={packsPerDay} min={1} max={99} onchange={syncToConfig} testid="config-packs-per-day" />
              <NumberInput label="Cards / Pack" bind:value={cardsPerPack} min={1} max={10} onchange={syncToConfig} testid="config-cards-per-pack" />
            </div>
          </div>
          <div class="cfg-card">
            <div class="cfg-header">
              <div class="cfg-header-row">
                <div>
                  <h3 class="cfg-title">Drop Rates</h3>
                  <p class="cfg-desc">Probability of each rarity tier when opening packs</p>
                </div>
                <Badge variant={dropRateSum === 1 ? 'success' : 'warning'} text="Sum: {dropRateSum}" testid="drop-rate-sum" />
              </div>
            </div>
            <div class="cfg-body">
              {#each rarities as tier}
                <div class="drop-rate-row">
                  <span class="rarity-label rarity-{tier}">{tier}</span>
                  <input
                    type="range"
                    class="drop-slider"
                    bind:value={dropRates[tier]}
                    min={0}
                    max={1}
                    step={0.01}
                    oninput={syncToConfig}
                    data-testid="config-drop-rate-{tier}"
                  />
                  <span class="drop-value">{(dropRates[tier]).toFixed(2)}%</span>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Save -->
        <div class="cfg-save">
          {#if saveMsg}
            <span class="save-msg" class:error={saveMsg !== 'Saved!'} data-testid="save-msg">{saveMsg}</span>
          {/if}
          <Button variant="primary" loading={saving} disabled={!!jsonError} onclick={saveConfig} testid="save-config-btn">
            {saving ? 'Saving...' : 'Save Config'}
          </Button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- ═══ CONFIRM DIALOG ═══ -->
<ConfirmDialog
  open={confirmOpen}
  title={confirmTitle}
  message={confirmMessage}
  confirmLabel={confirmLabel}
  variant={confirmVariant}
  onconfirm={confirmAction}
  oncancel={() => confirmOpen = false}
/>

<style>
  .admin-page {
    padding: 20px 28px 48px;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .admin-page.scrollable {
    overflow-y: auto;
    height: auto;
    min-height: 100vh;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    flex-shrink: 0;
  }

  .page-header h1 {
    font-family: 'Michroma', sans-serif;
    font-size: 1.1rem;
    font-weight: 400;
    color: #c0c8d4;
    letter-spacing: 1px;
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-actions.hidden-actions {
    visibility: hidden;
    pointer-events: none;
  }

  .generate-inline {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .muted { color: var(--color-text-muted); }

  /* ─── Top Tabs ─── */
  .top-tabs {
    display: flex;
    gap: 2px;
    margin-bottom: 16px;
    flex-shrink: 0;
    background: rgba(10, 22, 42, 0.4);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 3px;
    max-width: 420px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .top-tab {
    flex: 1;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--color-text-muted);
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .top-tab:hover { color: var(--color-text-secondary); }

  .top-tab.active {
    background: rgba(59, 151, 151, 0.2);
    color: var(--color-teal);
  }

  /* ─── Toolbar ─── */
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 14px;
    flex-shrink: 0;
  }

  .search-bar {
    max-width: 360px;
  }

  .search-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.9375rem;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
  }

  .search-input::placeholder {
    color: var(--color-text-muted);
  }

  .search-input:focus {
    border-color: var(--color-teal);
    background: rgba(59, 151, 151, 0.05);
  }

  /* ─── Content Area ─── */
  .content-area {
    display: flex;
    gap: 16px;
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

  /* ─── Detail Panel ─── */
  .detail-panel {
    width: 50%;
    min-width: 400px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: rgba(10, 22, 42, 0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    animation: slideIn 0.2s ease;
    overflow: hidden;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.03),
      0 1px 3px rgba(0, 0, 0, 0.4),
      0 4px 12px rgba(0, 0, 0, 0.2);
  }

  @keyframes slideIn {
    from { transform: translateX(20px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .detail-header h2 {
    font-size: 1.0625rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 1.4rem;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    transition: color 0.15s;
  }

  .close-btn:hover {
    color: var(--color-text-primary);
  }

  .detail-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  /* ─── Table Cells ─── */
  .cell-name {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .cell-muted {
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .cell-sprite {
    border-radius: 4px;
    image-rendering: pixelated;
    vertical-align: middle;
  }

  .status-badge {
    padding: 3px 10px;
    border-radius: 10px;
    border: 1px solid transparent;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: all 0.12s;
  }

  .status-badge.active {
    background: rgba(59, 151, 151, 0.15);
    color: var(--color-teal);
    border-color: rgba(59, 151, 151, 0.3);
  }

  .status-badge:not(.active) {
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text-muted);
    border-color: var(--glass-border);
  }

  .status-badge:hover {
    opacity: 0.8;
  }

  .star-btn {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    color: var(--color-text-muted);
    transition: color 0.12s;
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
    font-size: 0.9rem;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 2px;
    transition: color 0.12s;
  }

  .delete-btn:hover {
    color: #f87171;
  }

  /* ─── Config Tab ─── */
  .cfg {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .cfg-row-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .cfg-card {
    background: rgba(10, 22, 42, 0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    overflow: hidden;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.03),
      0 1px 3px rgba(0, 0, 0, 0.4),
      0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .cfg-header {
    padding: 20px 24px 0;
  }

  .cfg-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .cfg-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 4px;
  }

  .cfg-desc {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.4;
  }

  .cfg-body {
    padding: 16px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .cfg-pair {
    display: flex;
    align-items: flex-end;
    gap: 24px;
  }

  /* ─── Drop Rate Rows ─── */
  .drop-rate-row {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 36px;
  }

  .rarity-label {
    font-weight: 600;
    font-size: 0.875rem;
    text-transform: capitalize;
    min-width: 90px;
  }

  .rarity-label.rarity-common { color: var(--rarity-common); }
  .rarity-label.rarity-rare { color: var(--rarity-rare); }
  .rarity-label.rarity-epic { color: var(--rarity-epic); }
  .rarity-label.rarity-legendary { color: var(--rarity-legendary); }

  .drop-slider {
    flex: 1;
    max-width: 280px;
    cursor: pointer;
  }

  .drop-value {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    min-width: 52px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .json-editor {
    width: 100%;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    color: var(--color-text-primary);
    font-family: 'Courier New', monospace;
    font-size: 0.8125rem;
    resize: vertical;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
    line-height: 1.5;
  }

  .json-editor:focus { border-color: var(--color-teal); background: rgba(59, 151, 151, 0.05); }

  .cfg-save {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  }

  .error { color: #f87171; font-size: 0.8125rem; margin-top: 4px; }

  .save-msg { font-size: 0.875rem; color: var(--color-teal); }
  .save-msg.error { color: #f87171; }

  @media (max-width: 800px) {
    .cfg-row-2col { grid-template-columns: 1fr; }
  }

  /* ─── Pipeline ─── */
  .pipeline {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .step-fields {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .step-actions {
    display: flex;
    gap: 8px;
  }

  .traits-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .traits-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  /* ─── Step 2: Image ─── */
  .prompt-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .info-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-muted);
    letter-spacing: 0.05em;
  }

  .info-value {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .sprite-preview {
    display: flex;
    justify-content: center;
    padding: 8px 0;
  }

  .sprite-preview img {
    image-rendering: pixelated;
    border-radius: 8px;
    border: 1px solid var(--glass-border);
  }

  .sprite-placeholder {
    width: 128px;
    height: 128px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 8px auto;
    border: 1px dashed var(--glass-border);
    border-radius: 8px;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
  }

  /* ─── Step 3: Voice ─── */
  .voice-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .voice-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .voice-test {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .voice-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }

  .voice-options {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .voice-option {
    padding: 4px 12px;
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    background: none;
    color: var(--color-text-muted);
    font-family: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .voice-option:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text-secondary);
  }

  .voice-option.active {
    background: rgba(59, 151, 151, 0.15);
    color: var(--color-teal);
    border-color: var(--color-teal);
  }

  /* ─── Step 4: Preview ─── */
  .preview-step {
    background: rgba(10, 22, 42, 0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    overflow: hidden;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.03),
      0 1px 3px rgba(0, 0, 0, 0.4),
      0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .preview-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
  }

  .step-number {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .step-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .preview-content {
    padding: 20px;
    display: flex;
    justify-content: center;
  }

  /* ─── Responsive ─── */
  @media (max-width: 1100px) {
    .detail-panel {
      width: 45%;
      min-width: 340px;
    }
  }

  @media (max-width: 900px) {
    .content-area {
      flex-direction: column;
    }

    .detail-panel {
      width: 100%;
      min-width: unset;
      max-height: 50vh;
    }
  }
</style>
