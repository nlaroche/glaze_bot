<script lang="ts">
  import type { FishVoice } from '@glazebot/supabase-client';
  import { generativeTts } from '@glazebot/supabase-client';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import DataTable from '$lib/components/ui/DataTable.svelte';
  import type { Column } from '$lib/components/ui/DataTable.svelte';
  import Pagination from '$lib/components/ui/Pagination.svelte';
  import TagFilter from '$lib/components/ui/TagFilter.svelte';
  import type { Tag } from '$lib/components/ui/TagFilter.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  // ─── Props ──────────────────────────────────────────────────────────
  interface Props {
    fishVoices: FishVoice[];
    voiceUsageMap: Map<string, { id: string; name: string }[]>;
    loadingVoices: boolean;
    onsync: (pageCount: number) => Promise<void>;
    onreload: () => Promise<void>;
  }

  let {
    fishVoices,
    voiceUsageMap,
    loadingVoices,
    onsync,
    onreload,
  }: Props = $props();

  // ─── State: Sync Controls ──────────────────────────────────────────
  let syncingVoices = $state(false);
  let syncPageCount = $state(10);

  // ─── State: Table ──────────────────────────────────────────────────
  let playingVoiceId: string | null = $state(null);
  let currentAudio: HTMLAudioElement | null = $state(null);
  let voiceSearch = $state('');
  let voicePage = $state(1);
  let voicePageSize = $state(25);
  let voiceSortKey = $state('task_count');
  let voiceSortDirection: 'asc' | 'desc' = $state('desc');
  let activeVoiceTags: string[] = $state([]);
  let hideCelebrities = $state(true);
  let voiceUsageFilter: 'all' | 'in_use' | 'unused' = $state('all');
  let pinnedVoiceIds: Set<string> = $state(new Set());

  // ─── State: Sub-tabs ───────────────────────────────────────────────
  let voicesSubTab: 'library' | 'generative' = $state('library');

  // ─── State: Generative TTS ─────────────────────────────────────────
  let genReferenceId: string | null = $state(null);
  let genText = $state('(excited) Oh nice, you just pulled off a triple kill! (laughing) Ha ha, they had no idea what hit them!');
  let genTemperature = $state(0.7);
  let genTopP = $state(0.7);
  let genSpeed = $state(1.0);
  let genRepPenalty = $state(1.2);
  let genLoading = $state(false);
  let genAudio: HTMLAudioElement | null = $state(null);
  let genPlaying = $state(false);
  let genError = $state('');

  // ─── Constants ─────────────────────────────────────────────────────
  const emotionTags = [
    { category: 'Emotions', tags: ['happy', 'sad', 'angry', 'excited', 'calm', 'nervous', 'confident', 'surprised', 'sarcastic', 'curious', 'scared', 'frustrated'] },
    { category: 'Tone', tags: ['whispering', 'shouting', 'screaming', 'soft', 'hurried'] },
    { category: 'Effects', tags: ['laughing', 'chuckling', 'sobbing', 'sighing', 'gasping', 'yawning'] },
  ];

  const presetTexts = [
    { label: 'Excited Commentary', text: '(excited) Oh nice, you just pulled off a triple kill! (laughing) Ha ha, they had no idea what hit them!' },
    { label: 'Sarcastic Roast', text: '(sarcastic) Oh wow, walking straight into that turret again. (sighing) Brilliant strategy, truly.' },
    { label: 'Nervous Callout', text: '(nervous) Uh oh, there\'s someone behind you... (hurried) Turn around turn around turn around!' },
    { label: 'Calm Analysis', text: '(calm) Alright, so the enemy team is grouping up at mid. I\'d suggest flanking from the left side.' },
    { label: 'Hype Moment', text: '(shouting) LETS GOOO! (excited) That was absolutely insane, I can\'t believe you clutched that!' },
    { label: 'Deadpan', text: '(calm)(soft) You died. Again. To the same guy. For the fourth time. Impressive consistency.' },
  ];

  // ─── Celebrity Voice Filter ────────────────────────────────────────
  const CELEBRITY_NAMES: string[] = [
    // Real people
    'elon musk', 'donald trump', 'trump', 'taylor swift', 'barack obama', 'obama',
    'morgan freeman', 'david attenborough', 'sydney sweeney', 'gigi hadid', 'mrbeast',
    'billy graham', 'napoleon hill', 'warren buffett', 'warren buffet', 'ronaldo',
    'jim rohn', 'voddie baucham', 'shi heng yi', 'neville goddard', 'matthew hussey',
    'angela white', 'denzel', 'andrew tate', 'joe rogan', 'jordan peterson',
    'ben shapiro', 'pewdiepie', 'snoop dogg', 'kanye', 'drake', 'ariana grande',
    'kim kardashian', 'oprah', 'jeff bezos', 'mark zuckerberg', 'joe biden', 'biden',
    // Fictional characters
    'spongebob', 'peter griffin', 'goku', 'rick sanchez', 'glados', 'hatsune miku',
    'sonic', 'bluey', 'mario', 'jarvis', 'dexter morgan', 'sorting hat',
    'raiden shogun', 'invincible', 'shadow milk cookie', 'homer simpson',
    'bart simpson', 'stewie griffin', 'cartman', 'darth vader', 'gollum',
    'optimus prime', 'pikachu', 'naruto', 'vegeta',
  ];

  const CELEBRITY_KEYWORDS: string[] = [
    'copyrighted', 'impression', 'impersonation', 'clone of', 'voice clone', 'potus',
  ];

  function isCelebrityVoice(v: FishVoice): boolean {
    const title = v.title.toLowerCase();
    const tagStr = v.tags.map(t => t.toLowerCase());

    for (const name of CELEBRITY_NAMES) {
      if (title.includes(name)) return true;
      if (tagStr.some(t => t.includes(name))) return true;
    }
    for (const kw of CELEBRITY_KEYWORDS) {
      if (title.includes(kw)) return true;
      if (tagStr.some(t => t.includes(kw))) return true;
    }
    return false;
  }

  // ─── Derived ───────────────────────────────────────────────────────
  const celebrityCount = $derived(fishVoices.filter(v => isCelebrityVoice(v)).length);

  const voiceColumns: Column[] = [
    { key: 'pin', label: '', width: '40px' },
    { key: 'play', label: '', width: '48px' },
    { key: 'title', label: 'Name', sortable: true },
    { key: 'tags', label: 'Tags', width: '200px' },
    { key: 'used_by', label: 'Used By', width: '150px' },
    { key: 'task_count', label: 'Popularity', sortable: true, width: '110px' },
    { key: 'like_count', label: 'Likes', sortable: true, width: '90px' },
    { key: 'author_name', label: 'Author', sortable: true, width: '120px' },
    { key: 'description', label: 'Description' },
  ];

  const voiceFilterTags: Tag[] = $derived.by(() => {
    const tagCounts = new Map<string, number>();
    for (const v of fishVoices) {
      for (const t of v.tags) {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
    }
    const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    return sorted.map(([tag]) => ({
      key: tag,
      label: tag,
      group: 'Tags',
    }));
  });

  // Reactive chain: fishVoices -> voiceFiltered -> voiceSorted -> voicePaginated
  const voiceFiltered = $derived.by(() => {
    let result = fishVoices;

    if (hideCelebrities) {
      result = result.filter(v => !isCelebrityVoice(v));
    }

    if (voiceSearch) {
      const q = voiceSearch.toLowerCase();
      result = result.filter(v =>
        v.title.toLowerCase().includes(q)
          || v.description.toLowerCase().includes(q)
          || v.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    if (activeVoiceTags.length > 0) {
      result = result.filter(v =>
        activeVoiceTags.every(tag => v.tags.includes(tag))
      );
    }

    if (voiceUsageFilter === 'in_use') {
      result = result.filter(v => voiceUsageMap.has(v.id));
    } else if (voiceUsageFilter === 'unused') {
      result = result.filter(v => !voiceUsageMap.has(v.id));
    }

    return result;
  });

  const voiceSorted = $derived.by(() => {
    const arr = [...voiceFiltered];
    arr.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[voiceSortKey];
      const bVal = (b as Record<string, unknown>)[voiceSortKey];
      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else {
        cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''));
      }
      return voiceSortDirection === 'asc' ? cmp : -cmp;
    });
    return arr;
  });

  const voicePaginated = $derived(
    voiceSorted.slice((voicePage - 1) * voicePageSize, voicePage * voicePageSize)
  );

  const pinnedVoices = $derived(fishVoices.filter(v => pinnedVoiceIds.has(v.id)));

  // ─── Effects ───────────────────────────────────────────────────────
  // Reset to page 1 when filters change
  $effect(() => {
    voiceSearch;
    activeVoiceTags;
    voicePage = 1;
  });

  // ─── Functions ─────────────────────────────────────────────────────
  function togglePinnedVoice(id: string) {
    const next = new Set(pinnedVoiceIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    pinnedVoiceIds = next;
  }

  function playVoiceSample(voice: FishVoice) {
    if (!voice.sample_url) return;

    // Stop current if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    // Toggle off if same voice
    if (playingVoiceId === voice.id) {
      playingVoiceId = null;
      return;
    }

    const audio = new Audio(voice.sample_url);
    audio.onended = () => { playingVoiceId = null; currentAudio = null; };
    audio.onerror = () => { playingVoiceId = null; currentAudio = null; };
    currentAudio = audio;
    playingVoiceId = voice.id;
    audio.play().catch(() => { playingVoiceId = null; currentAudio = null; });
  }

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  async function handleSyncVoices() {
    syncingVoices = true;
    try {
      await onsync(syncPageCount);
    } catch (e) {
      console.error('Failed to sync voices:', e);
    } finally {
      syncingVoices = false;
    }
  }

  async function handleGenerateTts() {
    if (!genText.trim()) return;
    genLoading = true;
    genError = '';
    genPlaying = false;
    if (genAudio) { genAudio.pause(); genAudio = null; }

    try {
      const audioData = await generativeTts({
        text: genText,
        reference_id: genReferenceId,
        temperature: genTemperature,
        top_p: genTopP,
        repetition_penalty: genRepPenalty,
        speed: genSpeed,
      });
      const blob = new Blob([audioData], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { genPlaying = false; };
      audio.onerror = () => { genPlaying = false; URL.revokeObjectURL(url); };
      audio.play();
      genAudio = audio;
      genPlaying = true;
    } catch (e) {
      genError = e instanceof Error ? e.message : 'TTS generation failed';
    } finally {
      genLoading = false;
    }
  }

  function stopGenAudio() {
    if (genAudio) { genAudio.pause(); genAudio = null; }
    genPlaying = false;
  }

  function insertEmotionTag(tag: string) {
    genText = genText + ` (${tag})`;
  }
</script>

<div class="voices-tab" data-testid="voices-panel">
  <!-- Sub-tabs -->
  <div class="sub-tabs">
    <button
      class="sub-tab"
      class:active={voicesSubTab === 'library'}
      onclick={() => voicesSubTab = 'library'}
      data-testid="subtab-library"
    >Voice Library</button>
    <button
      class="sub-tab"
      class:active={voicesSubTab === 'generative'}
      onclick={() => voicesSubTab = 'generative'}
      data-testid="subtab-generative"
    >Generative</button>
  </div>

  {#if voicesSubTab === 'library'}
    <!-- Library Sub-tab -->
    <div class="voices-toolbar">
      <div class="voices-toolbar-left">
        {#if fishVoices.length > 0}
          <Badge variant="default" text="{voiceFiltered.length} voice{voiceFiltered.length !== 1 ? 's' : ''}" testid="voice-count-badge" />
        {/if}
        <button
          class="celebrity-toggle"
          class:active={hideCelebrities}
          onclick={() => { hideCelebrities = !hideCelebrities; voicePage = 1; }}
          data-testid="celebrity-toggle-btn"
        >
          {hideCelebrities ? 'Show All' : 'Hide Celebrities'}
        </button>
        {#if hideCelebrities && celebrityCount > 0}
          <span class="celebrity-badge" data-testid="celebrity-count-badge">
            Hiding {celebrityCount} celebrity voice{celebrityCount !== 1 ? 's' : ''}
          </span>
        {/if}
        <div class="usage-filter" data-testid="usage-filter">
          {#each [['all', 'All'], ['in_use', 'In Use'], ['unused', 'Unused']] as [val, label]}
            <button
              class="usage-filter-btn"
              class:active={voiceUsageFilter === val}
              onclick={() => { voiceUsageFilter = val as 'all' | 'in_use' | 'unused'; voicePage = 1; }}
              data-testid="usage-filter-{val}"
            >
              {label}
            </button>
          {/each}
        </div>
      </div>
      <div class="voices-toolbar-right">
        <div class="voices-search">
          <input
            type="text"
            class="search-input"
            placeholder="Search voices..."
            bind:value={voiceSearch}
            data-testid="voice-search-input"
          />
        </div>
        <div class="sync-controls">
          <select
            class="sync-pages-select"
            bind:value={syncPageCount}
            data-testid="sync-pages-select"
          >
            {#each [5, 10, 20, 50] as n}
              <option value={n}>{n} pages</option>
            {/each}
          </select>
          <Button
            variant="secondary"
            loading={syncingVoices}
            onclick={handleSyncVoices}
            testid="sync-voices-btn"
          >
            {syncingVoices ? 'Syncing...' : 'Sync from Fish Audio'}
          </Button>
        </div>
      </div>
    </div>

    {#if voiceFilterTags.length > 0}
      <div class="voice-tag-filter">
        <TagFilter
          tags={voiceFilterTags}
          active={activeVoiceTags}
          onchange={(tags) => activeVoiceTags = tags}
        />
      </div>
    {/if}

    {#if loadingVoices}
      <p class="muted">Loading voices...</p>
    {:else if fishVoices.length === 0}
      <div class="voices-empty">
        <p>No voices synced. Click <strong>Sync from Fish Audio</strong> to fetch the top voices.</p>
      </div>
    {:else}
      <DataTable
        columns={voiceColumns}
        rows={voicePaginated}
        sortKey={voiceSortKey}
        sortDirection={voiceSortDirection}
        onsort={(key, dir) => { voiceSortKey = key; voiceSortDirection = dir; }}
      >
        {#snippet cell({ row, column })}
          {#if column.key === 'pin'}
            <input
              type="checkbox"
              class="voice-pin-checkbox"
              checked={pinnedVoiceIds.has(row.id)}
              onchange={() => togglePinnedVoice(row.id)}
              title={pinnedVoiceIds.has(row.id) ? 'Remove from generative testing' : 'Add to generative testing'}
              data-testid="pin-voice-{row.id}"
            />
          {:else if column.key === 'play'}
            {#if row.sample_url}
              <button
                class="play-btn"
                class:playing={playingVoiceId === row.id}
                onclick={() => playVoiceSample(row)}
                data-testid="play-voice-{row.id}"
                title={playingVoiceId === row.id ? 'Stop' : 'Play sample'}
              >
                {playingVoiceId === row.id ? '\u23F9' : '\u25B6'}
              </button>
            {:else}
              <span class="no-sample" title="No sample available">{'\u2014'}</span>
            {/if}
          {:else if column.key === 'title'}
            <span class="cell-name">{row.title}</span>
          {:else if column.key === 'tags'}
            <div class="tag-pills">
              {#each row.tags.slice(0, 3) as tag}
                <span class="tag-pill">{tag}</span>
              {/each}
              {#if row.tags.length > 3}
                <span class="tag-pill tag-more">+{row.tags.length - 3}</span>
              {/if}
            </div>
          {:else if column.key === 'used_by'}
            {@const chars = voiceUsageMap.get(row.id)}
            <span class="cell-muted" title={chars?.map(c => c.name).join(', ') ?? ''}>
              {chars ? chars.map(c => c.name).join(', ') : '\u2014'}
            </span>
          {:else if column.key === 'task_count'}
            <span class="cell-number">{formatNumber(row.task_count)}</span>
          {:else if column.key === 'like_count'}
            <span class="cell-number">{formatNumber(row.like_count)}</span>
          {:else if column.key === 'author_name'}
            <span class="cell-muted">{row.author_name ?? '\u2014'}</span>
          {:else if column.key === 'description'}
            <span class="cell-muted" title={row.description}>
              {row.description.length > 60 ? row.description.slice(0, 60) + '...' : row.description || '\u2014'}
            </span>
          {/if}
        {/snippet}
      </DataTable>

      <Pagination
        total={voiceFiltered.length}
        page={voicePage}
        pageSize={voicePageSize}
        onpagechange={(p) => voicePage = p}
        onpagesizechange={(s) => { voicePageSize = s; voicePage = 1; }}
      />
    {/if}

  {:else}
    <!-- Generative Sub-tab -->
    <div class="gen-section" data-testid="generative-panel">
      <div class="gen-layout">
        <!-- Left: text input + controls -->
        <div class="gen-left">
          <div class="cfg-card">
            <div class="cfg-header">
              <h3 class="cfg-title">Test Generative TTS</h3>
              <p class="cfg-desc">Fish Audio S1 with emotion markers -- pin voices in the Library tab to test them here</p>
            </div>
            <div class="cfg-body">
              <!-- Voice selector -->
              <div class="gen-voice-picker" data-testid="gen-voice-picker">
                <label class="gen-voice-label">Reference Voice</label>
                <select
                  class="gen-voice-select"
                  value={genReferenceId ?? ''}
                  onchange={(e) => { genReferenceId = (e.target as HTMLSelectElement).value || null; }}
                  data-testid="gen-voice-select"
                >
                  <option value="">None (default voice)</option>
                  {#each pinnedVoices as v}
                    <option value={v.id}>{v.title}</option>
                  {/each}
                </select>
                {#if pinnedVoices.length === 0}
                  <span class="gen-voice-hint">Check voices in the Library tab to add them here</span>
                {/if}
              </div>

              <!-- Preset buttons -->
              <div class="gen-presets">
                {#each presetTexts as preset}
                  <button
                    class="gen-preset-btn"
                    onclick={() => genText = preset.text}
                    data-testid="preset-{preset.label.toLowerCase().replace(/ /g, '-')}"
                  >{preset.label}</button>
                {/each}
              </div>

              <!-- Text input -->
              <textarea
                class="gen-textarea"
                bind:value={genText}
                rows="4"
                placeholder="Type text with emotion markers like (excited) or (sarcastic)..."
                data-testid="gen-text-input"
              ></textarea>

              <!-- Emotion tag buttons -->
              {#each emotionTags as group}
                <div class="gen-tag-group">
                  <span class="gen-tag-label">{group.category}</span>
                  <div class="gen-tag-btns">
                    {#each group.tags as tag}
                      <button
                        class="gen-tag-btn"
                        onclick={() => insertEmotionTag(tag)}
                        title="Insert ({tag}) at cursor"
                      >({tag})</button>
                    {/each}
                  </div>
                </div>
              {/each}

              <!-- Controls row -->
              <div class="gen-controls">
                <div class="gen-slider">
                  <label>Temperature <span class="gen-val">{genTemperature.toFixed(2)}</span></label>
                  <input type="range" bind:value={genTemperature} min={0} max={1} step={0.05} data-testid="gen-temperature" />
                </div>
                <div class="gen-slider">
                  <label>Top P <span class="gen-val">{genTopP.toFixed(2)}</span></label>
                  <input type="range" bind:value={genTopP} min={0} max={1} step={0.05} data-testid="gen-top-p" />
                </div>
                <div class="gen-slider">
                  <label>Speed <span class="gen-val">{genSpeed.toFixed(1)}x</span></label>
                  <input type="range" bind:value={genSpeed} min={0.5} max={2} step={0.1} data-testid="gen-speed" />
                </div>
                <div class="gen-slider">
                  <label>Rep. Penalty <span class="gen-val">{genRepPenalty.toFixed(1)}</span></label>
                  <input type="range" bind:value={genRepPenalty} min={1} max={2} step={0.1} data-testid="gen-rep-penalty" />
                </div>
              </div>

              <!-- Generate + Stop buttons -->
              <div class="gen-actions">
                <Button
                  variant="primary"
                  loading={genLoading}
                  onclick={handleGenerateTts}
                  testid="gen-speak-btn"
                >
                  {genLoading ? 'Generating...' : 'Generate & Play'}
                </Button>
                {#if genPlaying}
                  <Button
                    variant="secondary"
                    onclick={stopGenAudio}
                    testid="gen-stop-btn"
                  >Stop</Button>
                {/if}
              </div>

              {#if genError}
                <p class="error" data-testid="gen-error">{genError}</p>
              {/if}
            </div>
          </div>
        </div>

        <!-- Right: reference card -->
        <div class="gen-right">
          <div class="cfg-card">
            <div class="cfg-header">
              <h3 class="cfg-title">Emotion Markers Reference</h3>
              <p class="cfg-desc">Place tags at the start of a sentence to control delivery</p>
            </div>
            <div class="cfg-body gen-ref-body">
              <div class="gen-ref-section">
                <h4>Syntax</h4>
                <code class="gen-ref-code">(excited) Wow, nice play!</code>
                <code class="gen-ref-code">(sarcastic)(soft) Oh great, another death.</code>
              </div>
              <div class="gen-ref-section">
                <h4>Tips for GlazeBot</h4>
                <ul class="gen-ref-list">
                  <li>Tags go at the <strong>start</strong> of each sentence</li>
                  <li>Stack multiple: <code>(nervous)(hurried)</code></li>
                  <li>Pair effects with sounds: <code>(laughing) Ha ha ha!</code></li>
                  <li>Higher <strong>temperature</strong> = more expressive</li>
                  <li>No reference voice = Fish Audio's default voice</li>
                  <li>The LLM can embed these tags in responses at runtime</li>
                </ul>
              </div>
              <div class="gen-ref-section">
                <h4>All Supported Tags</h4>
                <div class="gen-ref-all-tags">
                  <span class="gen-ref-cat">Emotions:</span> happy, sad, angry, excited, calm, nervous, confident, surprised, sarcastic, curious, scared, frustrated, worried, upset, depressed, proud, grateful, embarrassed, disgusted, moved
                </div>
                <div class="gen-ref-all-tags">
                  <span class="gen-ref-cat">Tone:</span> whispering, shouting, screaming, soft, hurried
                </div>
                <div class="gen-ref-all-tags">
                  <span class="gen-ref-cat">Effects:</span> laughing, chuckling, sobbing, sighing, gasping, yawning, groaning, panting, crying loudly
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ─── Voices Tab Layout ─── */
  .voices-tab {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .voices-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-3-5);
    flex-shrink: 0;
  }

  .voices-toolbar-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .voices-toolbar-right {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .celebrity-toggle {
    padding: var(--space-1-5) var(--space-3-5);
    border-radius: var(--radius-lg);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg);
    color: var(--color-text-secondary);
    font-size: var(--font-base);
    cursor: pointer;
    transition: all var(--transition-base) ease;
    white-space: nowrap;
  }

  .celebrity-toggle:hover {
    border-color: var(--color-teal);
    color: var(--color-text-primary);
  }

  .celebrity-toggle.active {
    border-color: var(--color-teal);
    background: var(--teal-a12);
    color: var(--color-teal);
  }

  .celebrity-badge {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .voices-search {
    max-width: 300px;
    flex: 1;
  }

  .voices-empty {
    padding: var(--space-12) var(--space-6);
    text-align: center;
    color: var(--color-text-secondary);
  }

  .voice-tag-filter {
    margin-bottom: var(--space-3-5);
  }

  /* ─── Sync Controls ─── */
  .sync-controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .sync-pages-select {
    background: var(--color-surface);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-1-5) var(--space-3);
    font-size: var(--font-sm);
    cursor: pointer;
  }

  .sync-pages-select:focus {
    outline: none;
    border-color: var(--color-pink);
  }

  /* ─── Search Input ─── */
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

  .cell-number {
    font-variant-numeric: tabular-nums;
  }

  /* ─── Play Button ─── */
  .play-btn {
    width: 32px;
    height: 32px;
    border: 1px solid var(--white-a10);
    border-radius: var(--radius-md);
    background: var(--white-a4);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: var(--font-base);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-base);
  }

  .play-btn:hover {
    background: var(--teal-a15);
    border-color: var(--color-teal);
    color: var(--color-teal);
  }

  .play-btn.playing {
    background: var(--teal-a20);
    border-color: var(--color-teal);
    color: var(--color-teal);
  }

  .no-sample {
    color: var(--color-text-muted);
    font-size: var(--font-base);
  }

  /* ─── Tag Pills ─── */
  .tag-pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .tag-pill {
    padding: var(--space-1) 9px;
    border-radius: var(--radius-sm);
    background: var(--white-a6);
    color: var(--color-text-secondary);
    font-size: var(--font-sm);
    white-space: nowrap;
  }

  .tag-more {
    background: var(--teal-a10);
    color: var(--color-teal);
  }

  /* ─── Usage Filter ─── */
  .usage-filter {
    display: flex;
    gap: 2px;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .usage-filter-btn {
    padding: var(--space-1) var(--space-2-5);
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-family: inherit;
    font-size: var(--font-xs);
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .usage-filter-btn:hover {
    background: var(--white-a4);
  }

  .usage-filter-btn.active {
    background: var(--teal-a15);
    color: var(--color-teal);
  }

  .voice-pin-checkbox {
    width: 16px;
    height: 16px;
    accent-color: var(--color-teal);
    cursor: pointer;
  }

  /* ─── Sub-tabs ─── */
  .sub-tabs {
    display: flex;
    gap: var(--space-0-5);
    margin-bottom: var(--space-3-5);
    flex-shrink: 0;
    background: var(--color-deep-bg);
    border: 1px solid var(--white-a5);
    border-radius: var(--radius-md);
    padding: var(--space-0-5);
    max-width: 280px;
  }

  .sub-tab {
    flex: 1;
    padding: var(--space-2) var(--space-4);
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text-muted);
    font-family: inherit;
    font-size: var(--font-base);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-base);
    white-space: nowrap;
  }

  .sub-tab:hover { color: var(--color-text-secondary); }

  .sub-tab.active {
    background: var(--teal-a15);
    color: var(--color-teal);
  }

  /* ─── Generative Section ─── */
  .gen-section {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .gen-layout {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: var(--space-4);
  }

  .gen-left, .gen-right {
    min-width: 0;
  }

  .gen-voice-picker {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    padding: var(--space-3) var(--space-3-5);
    background: var(--color-deep-bg);
    border: 1px solid var(--white-a6);
    border-radius: var(--radius-xl);
    flex-wrap: wrap;
  }

  .gen-voice-label {
    font-size: var(--font-md);
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
  }

  .gen-voice-select {
    flex: 1;
    max-width: 360px;
    padding: var(--input-padding);
    border-radius: var(--input-radius);
    border: 1px solid var(--input-border);
    background: var(--input-bg);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--input-font-size);
    outline: none;
    transition: border-color var(--transition-base), background var(--transition-base);
    cursor: pointer;
  }

  .gen-voice-select:focus {
    border-color: var(--input-focus-border);
    background: var(--input-focus-bg);
  }

  .gen-voice-select option {
    background: var(--color-surface);
    color: var(--color-text-primary);
    padding: var(--space-2);
  }

  .gen-voice-hint {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .gen-presets {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1-5);
    margin-bottom: var(--space-3);
  }

  .gen-preset-btn {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--white-a8);
    border-radius: var(--radius-sm);
    background: var(--white-a4);
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: var(--font-base);
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .gen-preset-btn:hover {
    background: var(--teal-a10);
    border-color: var(--color-teal);
    color: var(--color-teal);
  }

  .gen-textarea {
    width: 100%;
    padding: var(--input-padding);
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: var(--input-radius);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--font-base);
    resize: vertical;
    outline: none;
    transition: border-color var(--transition-base);
    line-height: 1.5;
    margin-bottom: var(--space-3);
  }

  .gen-textarea:focus { border-color: var(--input-focus-border); }
  .gen-textarea::placeholder { color: var(--color-text-muted); }

  .gen-tag-group {
    margin-bottom: var(--space-2);
  }

  .gen-tag-label {
    display: block;
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-1);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .gen-tag-btns {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .gen-tag-btn {
    padding: var(--space-1) var(--space-2-5);
    border: 1px solid var(--white-a6);
    border-radius: var(--radius-xs);
    background: var(--white-a3);
    color: var(--color-text-secondary);
    font-family: 'Courier New', monospace;
    font-size: var(--font-base);
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .gen-tag-btn:hover {
    background: var(--teal-a10);
    color: var(--color-teal);
    border-color: var(--teal-a30);
  }

  .gen-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3) var(--space-5);
    margin: var(--space-3-5) 0;
  }

  .gen-slider label {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-md);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-1);
  }

  .gen-val {
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .gen-slider input[type="range"] {
    width: 100%;
    cursor: pointer;
  }

  .gen-actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  /* ─── Reference Card ─── */
  .gen-ref-body {
    font-size: var(--font-base);
    color: var(--color-text-primary);
  }

  .gen-ref-section {
    margin-bottom: var(--space-3-5);
  }

  .gen-ref-section:last-child { margin-bottom: 0; }

  .gen-ref-section h4 {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 var(--space-1-5);
  }

  .gen-ref-code {
    display: block;
    padding: var(--space-1-5) var(--space-2-5);
    background: var(--white-a4);
    border-radius: var(--radius-sm);
    font-family: 'Courier New', monospace;
    font-size: var(--font-base);
    color: var(--color-teal);
    margin-bottom: var(--space-1);
  }

  .gen-ref-list {
    margin: 0;
    padding-left: 18px;
    line-height: 1.7;
    font-size: var(--font-base);
  }

  .gen-ref-list code {
    background: var(--white-a4);
    padding: var(--space-0-5) var(--space-1);
    border-radius: var(--radius-xs);
    font-family: 'Courier New', monospace;
    font-size: var(--font-base);
    color: var(--color-teal);
  }

  .gen-ref-all-tags {
    font-size: var(--font-base);
    line-height: 1.6;
    color: var(--color-text-muted);
    margin-bottom: var(--space-1-5);
  }

  .gen-ref-cat {
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  /* ─── Cfg Card (shared pattern) ─── */
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

  .cfg-desc {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.4;
  }

  .cfg-body {
    padding: var(--space-4) var(--space-6) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-3-5);
  }

  /* ─── Utility ─── */
  .muted { color: var(--color-text-muted); }
  .error { color: var(--color-error); font-size: var(--font-sm); margin-top: var(--space-1); }

  @media (max-width: 900px) {
    .gen-layout { grid-template-columns: 1fr; }
  }
</style>
