<script lang="ts">
  import {
    listConfigSnapshots,
    updateConfigSnapshot,
    deleteConfigSnapshot,
    saveConfigSnapshot,
  } from '@glazebot/supabase-client';
  import type { ConfigSnapshot } from '@glazebot/supabase-client';
  import { validateConfig, DEFAULT_CONFIG } from '@glazebot/shared-types';
  import yaml from 'js-yaml';
  import { Spotlight } from '@glazebot/shared-ui';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import DataTable from '$lib/components/ui/DataTable.svelte';
  import type { Column } from '$lib/components/ui/DataTable.svelte';
  import Pagination from '$lib/components/ui/Pagination.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  interface ConfirmOpts {
    title: string;
    message: string;
    label: string;
    variant: 'destructive' | 'primary';
    action: () => void;
  }

  interface Props {
    config: Record<string, unknown>;
    onapply: (config: Record<string, unknown>) => Promise<void>;
    onconfirm: (opts: ConfirmOpts) => void;
  }

  let { config, onapply, onconfirm }: Props = $props();

  // ─── State ─────────────────────────────────────────────────────
  let snapshots: ConfigSnapshot[] = $state([]);
  let snapshotsLoading = $state(false);
  let snapshotsLoaded = $state(false);
  let snapshotSearch = $state('');
  let snapshotPage = $state(1);
  let snapshotPageSize = $state(25);
  let snapshotSortKey: string = $state('created_at');
  let snapshotSortDirection: 'asc' | 'desc' = $state('desc');
  let snapshotFavoritesOnly = $state(false);
  let previewSnapshot: ConfigSnapshot | null = $state(null);
  let previewOpen = $state(false);
  let previewSchemaError = $state('');
  let importFileInput: HTMLInputElement | null = $state(null);

  // ─── Import Preview ────────────────────────────────────────────
  interface ImportSection {
    key: string;
    label: string;
    desc: string;
    configKeys: string[];
    present: boolean;
    selected: boolean;
  }

  const SECTION_DEFS: Omit<ImportSection, 'present' | 'selected'>[] = [
    { key: 'generation', label: 'Generation', desc: 'Drop rates, temperature, model, packs per day, cards per pack, generation prompt', configKeys: ['dropRates', 'baseTemperature', 'model', 'cardGenProvider', 'cardGenModel', 'packsPerDay', 'cardsPerPack', 'generationPrompt'] },
    { key: 'images', label: 'Images', desc: 'Image provider, model, size, and system info', configKeys: ['imageSystemInfo', 'imageProvider', 'imageModel', 'imageConfig'] },
    { key: 'tokenPools', label: 'Token Pools', desc: 'All token pool definitions and their entries', configKeys: ['tokenPools'] },
    { key: 'commentary', label: 'Commentary', desc: 'Vision model, directive, style nudges, response/interaction instructions, context, memory, visuals', configKeys: ['commentary'] },
    { key: 'topics', label: 'Topics', desc: 'Topic count ranges per rarity and legendary custom topic count', configKeys: ['topicCountByRarity', 'legendaryCustomTopicCount'] },
    { key: 'animations', label: 'Animations', desc: 'Animation feel: anticipation, overshoot, bounce, squish, speed', configKeys: ['animations'] },
    { key: 'rarityTuning', label: 'Rarity Tuning', desc: 'Trait ranges, prompt quality, and rarity guidance', configKeys: ['traitRanges', 'promptQuality', 'rarityGuidance'] },
  ];

  let importPreviewOpen = $state(false);
  let importSections: ImportSection[] = $state([]);
  let importParsedConfig: Record<string, unknown> | null = $state(null);

  // ─── Derived ──────────────────────────────────────────────────
  const snapshotsFiltered = $derived(
    snapshots.filter(s => {
      if (snapshotFavoritesOnly && !s.is_favorite) return false;
      if (snapshotSearch) {
        const q = snapshotSearch.toLowerCase();
        const nameMatch = (s.name || '(auto-save)').toLowerCase().includes(q);
        const commentsMatch = s.comments.toLowerCase().includes(q);
        if (!nameMatch && !commentsMatch) return false;
      }
      return true;
    })
  );

  const snapshotsSorted = $derived(
    [...snapshotsFiltered].sort((a, b) => {
      const dir = snapshotSortDirection === 'asc' ? 1 : -1;
      if (snapshotSortKey === 'name') {
        return dir * (a.name || '(auto-save)').localeCompare(b.name || '(auto-save)');
      }
      return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    })
  );

  const snapshotsPaginated = $derived(
    snapshotsSorted.slice((snapshotPage - 1) * snapshotPageSize, snapshotPage * snapshotPageSize)
  );

  const snapshotColumns: Column[] = [
    { key: 'favorite', label: '\u2605', width: '44px' },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'comments', label: 'Comments' },
    { key: 'created_at', label: 'Saved', sortable: true, width: '120px' },
    { key: 'actions', label: 'Actions', width: '120px' },
  ];

  // Reset page when filters change
  $effect(() => {
    snapshotSearch;
    snapshotFavoritesOnly;
    snapshotPage = 1;
  });

  // ─── Lifecycle ─────────────────────────────────────────────────
  let mounted = false;
  $effect(() => {
    if (!mounted) {
      mounted = true;
      loadSnapshots();
    }
  });

  // ─── Functions ─────────────────────────────────────────────────
  function validateConfigSchema(cfg: Record<string, unknown>): string | null {
    return validateConfig(cfg);
  }

  async function loadSnapshots() {
    if (snapshotsLoaded || snapshotsLoading) return;
    snapshotsLoading = true;
    try {
      snapshots = await listConfigSnapshots();
      snapshotsLoaded = true;
    } catch {
      // silent
    } finally {
      snapshotsLoading = false;
    }
  }

  async function applySnapshot(snapshot: ConfigSnapshot) {
    const err = validateConfigSchema(snapshot.config);
    if (err) {
      toast.error(`Snapshot has invalid schema: ${err}`);
      return;
    }
    previewOpen = false;
    await onapply(snapshot.config);
  }

  function handleDeleteSnapshot(snapshot: ConfigSnapshot) {
    onconfirm({
      title: 'Delete Snapshot',
      message: `Delete snapshot "${snapshot.name || '(auto-save)'}" from ${new Date(snapshot.created_at).toLocaleDateString()}? This cannot be undone.`,
      label: 'Delete',
      variant: 'destructive',
      action: async () => {
        try {
          await deleteConfigSnapshot(snapshot.id);
          snapshots = snapshots.filter(s => s.id !== snapshot.id);
          if (previewSnapshot?.id === snapshot.id) {
            previewOpen = false;
            previewSnapshot = null;
          }
        } catch {
          // silent
        }
      },
    });
  }

  function openSnapshotPreview(snapshot: ConfigSnapshot) {
    previewSnapshot = snapshot;
    previewSchemaError = validateConfigSchema(snapshot.config) ?? '';
    previewOpen = true;
  }

  async function handleSnapshotFavorite(snapshot: ConfigSnapshot, e: Event) {
    e.stopPropagation();
    const newVal = !snapshot.is_favorite;
    try {
      await updateConfigSnapshot(snapshot.id, { is_favorite: newVal });
      snapshots = snapshots.map(s => s.id === snapshot.id ? { ...s, is_favorite: newVal } : s);
    } catch {
      // silent
    }
  }

  async function handleSnapshotMetaUpdate(id: string, fields: { name?: string; comments?: string }) {
    try {
      const updated = await updateConfigSnapshot(id, fields);
      snapshots = snapshots.map(s => s.id === id ? updated : s);
      if (previewSnapshot?.id === id) previewSnapshot = updated;
    } catch {
      // silent
    }
  }

  function exportConfigAsYaml(cfg: Record<string, unknown>, filename?: string) {
    const doc = {
      _purpose: 'GlazeBot creates AI gaming commentary characters through a gacha system. Characters watch gameplay via screen share and commentate in real time. Goal: characters that interact well with the game, offer funny and insightful comments, stay in character without being annoying, and offer emotional support.',
      _character_generation_flow: [
        'Step 1: Load config fields — baseTemperature, generationPrompt, traitRanges, promptQuality, rarityGuidance, tokenPools',
        'Step 2: Roll token pools — weighted random selection per pool; conditional pools check if parent pool rolled a qualifying value',
        'Step 3: Build directive string from roll results (e.g. "Gender: female, Species: elf, Archetype: healer")',
        'Step 4: Assemble system prompt = generationPrompt + rarityGuidance[rarity] + trait range constraint text',
        'Step 5: Build user message = directive block + avoid clause (no existing character names)',
        'Step 6: LLM call with temperature = baseTemperature + tempBoost (from promptQuality[rarity]), maxTokens from promptQuality[rarity]',
        'Step 7: Parse JSON response, clamp personality traits to traitRanges min/max',
        'Step 8: Output fields: name, description, backstory, system_prompt, tagline, personality (6 traits 0-100: energy, positivity, formality, talkativeness, attitude, humor)',
        'Step 9: Voice assigned randomly from Fish Audio library',
        'Step 10: Sprite generated via imageProvider (pixellab/gemini) using imageSystemInfo + character description',
      ],
      _commentary_flow: [
        'Step 1: System prompt = character.system_prompt + commentary.directive + buildPersonalityModifier(personality)',
        'Step 2: Personality modifier — traits outside the 30-55 neutral range add behavioral instructions (e.g. energy > 70 → "Be very high-energy and hyped up")',
        'Step 3: Block scheduler — weighted random pick from commentary.blockWeights (solo_observation, emotional_reaction, question, backstory_reference, quip_banter, callback, hype_chain, silence)',
        'Step 4: Block-specific prompt injected from commentary.blockPrompts[selectedBlock]',
        'Step 5: Style nudge picked from commentary.styleNudges array',
        'Step 6: Character memory — if commentary.memory.enabled, recent memories injected into system prompt (commentary.memory.memoriesPerPrompt memories, extracted every commentary.memory.extractionIntervalMinutes minutes)',
        'Step 7: User message = game_hint + player_transcript + co-caster_reaction + [block prompt] + [style nudge] + responseInstruction',
        'Step 8: Screenshot attached as vision input to the LLM',
        'Step 9: LLM call with commentary provider/model/temperature/maxTokens/presencePenalty/frequencyPenalty',
        'Step 10: If response is "[SILENCE]" → skip TTS; otherwise → Fish Audio TTS → audio playback',
      ],
      _image_generation_flow: [
        'Step 1: Provider selected from imageProvider (pixellab or gemini)',
        'Step 2: Model from imageModel (e.g. gemini-3.1-flash-image-preview)',
        'Step 3: Image size from imageConfig.imageSize (e.g. 1K), aspect ratio from imageConfig.aspectRatio',
        'Step 4: Prompt built from imageSystemInfo + character description',
      ],
      config: cfg,
    };
    const yamlStr = yaml.dump(doc, { lineWidth: 120, noRefs: true, sortKeys: false });
    const blob = new Blob([yamlStr], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? `glazebot-config-${new Date().toISOString().slice(0, 10)}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportConfig() {
    exportConfigAsYaml(config);
  }

  function exportSnapshotAsYaml(snapshot: ConfigSnapshot) {
    const datePart = new Date(snapshot.created_at).toISOString().slice(0, 10);
    const namePart = snapshot.name ? `-${snapshot.name.replace(/\s+/g, '-').toLowerCase()}` : '';
    exportConfigAsYaml(snapshot.config, `glazebot-config-${datePart}${namePart}.yaml`);
  }

  function handleImportFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = yaml.load(reader.result as string) as Record<string, unknown>;
        const cfgData = (parsed?.config ?? parsed) as Record<string, unknown>;

        // Build section list: mark which sections exist in the imported file
        importSections = SECTION_DEFS.map(def => {
          const present = def.configKeys.some(k => k in cfgData);
          return { ...def, present, selected: present };
        });
        importParsedConfig = cfgData;
        importPreviewOpen = true;
      } catch (ex) {
        toast.error(ex instanceof Error ? ex.message : 'Failed to parse YAML');
      }
    };
    reader.readAsText(file);
    if (importFileInput) importFileInput.value = '';
  }

  function applyImportSelection() {
    if (!importParsedConfig) return;

    // Start with current config, merge only selected sections
    const merged = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;

    for (const section of importSections) {
      if (!section.selected) continue;
      for (const key of section.configKeys) {
        if (key in importParsedConfig) {
          merged[key] = JSON.parse(JSON.stringify(importParsedConfig[key]));
        }
      }
    }

    // Backfill any keys required by the schema that are missing from both
    // the current config and the imported file (e.g. newly added features).
    // This only adds keys that don't exist yet — never overwrites.
    const defaults = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Record<string, unknown>;
    for (const key of Object.keys(defaults)) {
      if (!(key in merged)) {
        merged[key] = defaults[key];
      } else if (
        typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key]) &&
        typeof merged[key] === 'object' && merged[key] !== null && !Array.isArray(merged[key])
      ) {
        const sub = merged[key] as Record<string, unknown>;
        const defSub = defaults[key] as Record<string, unknown>;
        for (const sk of Object.keys(defSub)) {
          if (!(sk in sub)) sub[sk] = defSub[sk];
        }
      }
    }

    // Validate the merged result
    const err = validateConfigSchema(merged);
    if (err) {
      toast.error(`Merged config failed validation: ${err}`);
      return;
    }

    // Save snapshot and apply
    saveConfigSnapshot(JSON.parse(JSON.stringify(merged)), 'import', 'Imported from YAML (partial)').then(snap => {
      if (snapshotsLoaded) snapshots = [snap, ...snapshots];
    }).catch(() => {});

    const selectedLabels = importSections.filter(s => s.selected).map(s => s.label).join(', ');
    toast.success(`Imported: ${selectedLabels}`);
    onapply(merged);

    importPreviewOpen = false;
    importParsedConfig = null;
  }

  function toggleImportSection(key: string) {
    importSections = importSections.map(s =>
      s.key === key ? { ...s, selected: !s.selected } : s
    );
  }

  // Expose a way for parent to add snapshots (e.g., after saving config)
  export function addSnapshot(snap: ConfigSnapshot) {
    if (snapshotsLoaded) snapshots = [snap, ...snapshots.map(s => ({ ...s, is_active: false }))];
  }
</script>

<div class="history-tab" data-testid="history-panel">
  <!-- Toolbar -->
  <div class="history-toolbar">
    <div class="toolbar-left">
      {#if snapshots.length > 0}
        <Badge variant="default" text="{snapshotsFiltered.length} snapshot{snapshotsFiltered.length !== 1 ? 's' : ''}" testid="snapshot-count-badge" />
      {/if}
      <button
        class="filter-toggle"
        class:active={snapshotFavoritesOnly}
        onclick={() => { snapshotFavoritesOnly = !snapshotFavoritesOnly; snapshotPage = 1; }}
        data-testid="favorites-toggle-btn"
      >
        {snapshotFavoritesOnly ? 'Show All' : 'Favorites Only'}
      </button>
    </div>
    <div class="toolbar-right">
      <input
        type="text"
        class="search-input"
        placeholder="Search snapshots..."
        bind:value={snapshotSearch}
        data-testid="snapshot-search-input"
      />
      <Button variant="ghost" onclick={() => importFileInput?.click()} testid="import-yaml-btn">Import YAML</Button>
      <Button variant="secondary" onclick={exportConfig} testid="export-yaml-btn">Export YAML</Button>
      <input
        type="file"
        accept=".yaml,.yml"
        style="display:none"
        bind:this={importFileInput}
        onchange={handleImportFile}
        data-testid="import-file-input"
      />
    </div>
  </div>

  {#if snapshotsLoading}
    <p class="muted">Loading snapshots...</p>
  {:else if snapshots.length === 0}
    <p class="muted">No snapshots yet. Snapshots are created automatically each time you save the config.</p>
  {:else}
    <DataTable
      columns={snapshotColumns}
      rows={snapshotsPaginated}
      sortKey={snapshotSortKey}
      sortDirection={snapshotSortDirection}
      onsort={(key, dir) => { snapshotSortKey = key; snapshotSortDirection = dir; }}
      onrowclick={(row) => openSnapshotPreview(row as unknown as ConfigSnapshot)}
    >
      {#snippet cell({ row, column })}
        {#if column.key === 'favorite'}
          <button
            class="star-btn"
            class:active={row.is_favorite}
            onclick={(e) => handleSnapshotFavorite(row as unknown as ConfigSnapshot, e)}
            title={row.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            data-testid="star-{row.id}"
          >
            {row.is_favorite ? '\u2605' : '\u2606'}
          </button>
        {:else if column.key === 'name'}
          <span class="cell-name">
            {row.name || '(auto-save)'}
            {#if row.is_active}
              <Badge variant="success" text="ACTIVE" testid="active-badge-{row.id}" />
            {/if}
          </span>
        {:else if column.key === 'comments'}
          <span class="cell-muted" title={row.comments}>
            {row.comments.length > 60 ? row.comments.slice(0, 60) + '...' : row.comments || '\u2014'}
          </span>
        {:else if column.key === 'created_at'}
          <span class="cell-muted">{new Date(row.created_at).toLocaleDateString()}</span>
        {:else if column.key === 'actions'}
          <div class="snapshot-actions">
            <Button variant="ghost" size="sm" onclick={(e) => { e.stopPropagation(); openSnapshotPreview(row as unknown as ConfigSnapshot); }} testid="preview-{row.id}">Preview</Button>
            <Button variant="ghost" size="sm" onclick={(e) => { e.stopPropagation(); handleDeleteSnapshot(row as unknown as ConfigSnapshot); }} testid="delete-{row.id}">Delete</Button>
          </div>
        {/if}
      {/snippet}
    </DataTable>

    <Pagination
      total={snapshotsFiltered.length}
      page={snapshotPage}
      pageSize={snapshotPageSize}
      onpagechange={(p) => snapshotPage = p}
      onpagesizechange={(s) => { snapshotPageSize = s; snapshotPage = 1; }}
    />
  {/if}
</div>

<!-- ═══ SNAPSHOT PREVIEW ═══ -->
<Spotlight open={previewOpen} onclose={() => { previewOpen = false; previewSnapshot = null; }}>
  {#if previewSnapshot}
    <div class="snapshot-preview" data-testid="snapshot-preview">
      <div class="modal-header">
        <div class="modal-header-title">
          <h2>
            {previewSnapshot.name || '(auto-save)'}
            {#if previewSnapshot.is_active}
              <Badge variant="success" text="ACTIVE" testid="preview-active-badge" />
            {/if}
          </h2>
          <span class="cell-muted">{new Date(previewSnapshot.created_at).toLocaleString()}</span>
        </div>
        <button class="close-btn" onclick={() => { previewOpen = false; previewSnapshot = null; }} data-testid="close-snapshot-preview">&times;</button>
      </div>

      <div class="snapshot-preview-body">
        <div class="cfg-card">
          <div class="cfg-header">
            <h3 class="cfg-title">Snapshot Details</h3>
          </div>
          <div class="cfg-body">
            <div class="snapshot-field">
              <label>Name</label>
              <input
                type="text"
                class="search-input"
                value={previewSnapshot.name}
                onchange={(e) => handleSnapshotMetaUpdate(previewSnapshot!.id, { name: (e.target as HTMLInputElement).value })}
                placeholder="(auto-save)"
                data-testid="snapshot-edit-name"
              />
            </div>
            <div class="snapshot-field">
              <label>Comments</label>
              <textarea
                class="search-input snapshot-comments-input"
                value={previewSnapshot.comments}
                onchange={(e) => handleSnapshotMetaUpdate(previewSnapshot!.id, { comments: (e.target as HTMLTextAreaElement).value })}
                placeholder="Add notes..."
                rows="2"
                data-testid="snapshot-edit-comments"
              ></textarea>
            </div>
          </div>
        </div>

        {#if previewSchemaError}
          <div class="error" data-testid="snapshot-schema-error">
            Schema incompatibility: {previewSchemaError}
          </div>
        {/if}

        <div class="cfg-card">
          <div class="cfg-header">
            <h3 class="cfg-title">Config JSON</h3>
          </div>
          <div class="cfg-body">
            <pre class="prompt-text-box">{JSON.stringify(previewSnapshot.config, null, 2)}</pre>
          </div>
        </div>
      </div>

      <div class="snapshot-preview-actions">
        <Button variant="ghost" onclick={() => { previewOpen = false; previewSnapshot = null; }} testid="snapshot-cancel">Cancel</Button>
        <Button variant="ghost" onclick={() => exportSnapshotAsYaml(previewSnapshot!)} testid="snapshot-export-yaml">Export YAML</Button>
        {#if previewSnapshot.is_active}
          <Button
            variant="ghost"
            onclick={async () => {
              try {
                const updated = await updateConfigSnapshot(previewSnapshot!.id, { is_active: false });
                snapshots = snapshots.map(s => s.id === updated.id ? updated : s);
                previewSnapshot = updated;
              } catch { /* silent */ }
            }}
            testid="snapshot-deactivate"
          >Deactivate</Button>
        {/if}
        <Button
          variant="primary"
          disabled={!!previewSchemaError}
          onclick={() => applySnapshot(previewSnapshot!)}
          testid="snapshot-apply"
        >Apply This Config</Button>
      </div>
    </div>
  {/if}
</Spotlight>

<!-- ═══ IMPORT PREVIEW ═══ -->
<Spotlight open={importPreviewOpen} onclose={() => { importPreviewOpen = false; importParsedConfig = null; }}>
  <div class="snapshot-preview" data-testid="import-preview">
    <div class="modal-header">
      <div class="modal-header-title">
        <h2>Import Config</h2>
      </div>
      <button class="close-btn" onclick={() => { importPreviewOpen = false; importParsedConfig = null; }} data-testid="close-import-preview">&times;</button>
    </div>

    <p class="import-desc">Choose which sections to import. Unselected sections keep their current values.</p>

    <div class="snapshot-preview-body">
      {#each importSections as section (section.key)}
        <button
          class="import-section-row"
          class:selected={section.selected}
          class:absent={!section.present}
          disabled={!section.present}
          onclick={() => toggleImportSection(section.key)}
          data-testid="import-section-{section.key}"
        >
          <span class="import-check">{section.selected ? '\u2611' : '\u2610'}</span>
          <span class="import-section-info">
            <span class="import-section-label">
              {section.label}
              {#if !section.present}
                <Badge variant="default" text="not in file" />
              {/if}
            </span>
            <span class="import-section-desc">{section.desc}</span>
          </span>
        </button>
      {/each}
    </div>

    <div class="snapshot-preview-actions">
      <Button variant="ghost" onclick={() => { importPreviewOpen = false; importParsedConfig = null; }} testid="import-cancel">Cancel</Button>
      <Button
        variant="primary"
        disabled={!importSections.some(s => s.selected)}
        onclick={applyImportSelection}
        testid="import-apply"
      >Import Selected</Button>
    </div>
  </div>
</Spotlight>

<style>
  .muted { color: var(--color-text-muted); }

  .history-tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    flex: 1;
    min-height: 0;
  }

  .history-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-3-5);
    flex-shrink: 0;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .filter-toggle {
    padding: var(--space-1-5) var(--space-3-5);
    border-radius: var(--radius-lg);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg);
    color: var(--color-text-secondary);
    font-size: var(--font-base);
    cursor: pointer;
    transition: all var(--transition-base) ease;
    white-space: nowrap;
    font-family: inherit;
  }

  .filter-toggle:hover {
    border-color: var(--color-teal);
    color: var(--color-text-primary);
  }

  .filter-toggle.active {
    border-color: var(--color-teal);
    background: var(--teal-a12);
    color: var(--color-teal);
  }

  .search-input {
    width: 100%;
    max-width: 300px;
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

  .search-input::placeholder { color: var(--color-text-muted); }
  .search-input:focus { border-color: var(--input-focus-border); background: var(--input-focus-bg); }

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

  .star-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--font-lg);
    color: var(--color-text-muted);
    padding: 0;
    line-height: 1;
  }

  .star-btn.active {
    color: var(--color-gold, #f6c744);
  }

  .snapshot-actions {
    display: flex;
    gap: var(--space-1);
  }

  /* ─── Snapshot Preview Modal ─── */
  .snapshot-preview {
    background: var(--color-surface-raised);
    border: 1px solid var(--white-a12);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: var(--radius-xl);
    width: min(960px, 94vw);
    max-height: min(88vh, 920px);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-5);
    box-shadow: 0 0 60px var(--teal-a5), 0 8px 32px var(--black-a40);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .modal-header-title {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .modal-header h2 {
    font-size: var(--font-xl);
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-size: var(--font-xl);
    cursor: pointer;
    line-height: 1;
    transition: all var(--transition-base);
    flex-shrink: 0;
  }

  .close-btn:hover {
    color: var(--color-text-primary);
    background: var(--white-a4);
    border-color: var(--white-a8);
  }

  .snapshot-preview-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .snapshot-preview-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding-top: var(--space-3);
    border-top: 1px solid var(--white-a6);
  }

  .cfg-card {
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--panel-shadow);
  }

  .cfg-header {
    padding: var(--space-5) var(--space-6) 0;
  }

  .cfg-title {
    font-size: var(--font-xl);
    font-weight: 700;
    font-family: var(--font-brand);
    color: var(--color-heading);
    letter-spacing: -0.01em;
    margin: 0 0 var(--space-1);
  }

  .cfg-body {
    padding: var(--space-4) var(--space-6) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-3-5);
  }

  .snapshot-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .snapshot-field label {
    font-size: var(--font-base);
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .snapshot-comments-input {
    resize: vertical;
    font-family: inherit;
  }

  .prompt-text-box {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-base);
    line-height: 1.6;
    color: var(--color-text-primary);
    background: var(--input-bg);
    border-top: 1px solid var(--input-border);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 400px;
    overflow-y: auto;
  }

  .error {
    color: var(--color-error);
    font-size: var(--font-base);
    margin-top: var(--space-1);
  }

  /* ─── Import Preview ─── */
  .import-desc {
    font-size: var(--font-base);
    color: var(--color-text-primary);
    margin: 0;
    line-height: 1.5;
  }

  .import-section-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: border-color var(--transition-fast), background var(--transition-fast);
    width: 100%;
  }

  .import-section-row:hover:not(:disabled) {
    border-color: var(--color-accent);
    background: var(--navy-a20);
  }

  .import-section-row.selected {
    border-color: var(--color-teal);
    background: var(--teal-a5);
  }

  .import-section-row.absent {
    opacity: 0.4;
    cursor: default;
  }

  .import-check {
    font-size: var(--font-lg);
    color: var(--color-text-primary);
    line-height: 1.2;
    flex-shrink: 0;
  }

  .import-section-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .import-section-label {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text-primary);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .import-section-desc {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    line-height: 1.4;
  }
</style>
