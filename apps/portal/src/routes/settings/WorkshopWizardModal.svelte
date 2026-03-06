<script lang="ts">
  import { Spotlight } from '@glazebot/shared-ui';
  import type { GachaCharacter, CharacterRarity, GenerationMetadata } from '@glazebot/shared-types';
  import type { FishVoice, TokenPools as TokenPoolsType } from '@glazebot/supabase-client';
  import {
    generateCharacterText,
    generateCharacterImage,
    assignCharacterVoice,
    previewVoice,
    updateCharacter,
    rollTokenPools as rollTokenPoolsFn,
    buildDirective as buildDirectiveFn,
    weightedPick,
  } from '@glazebot/supabase-client';
  import { toast } from '$lib/stores/toast.svelte';
  import { SliderInput } from '@glazebot/shared-ui';

  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import TextArea from '$lib/components/ui/TextArea.svelte';
  import TextInput from '$lib/components/ui/TextInput.svelte';
  import DataTable from '$lib/components/ui/DataTable.svelte';
  import type { Column } from '$lib/components/ui/DataTable.svelte';
  import Pagination from '$lib/components/ui/Pagination.svelte';
  import TagFilter from '$lib/components/ui/TagFilter.svelte';
  import type { Tag } from '$lib/components/ui/TagFilter.svelte';

  // ─── Types ──────────────────────────────────────────────────────────
  type StepStatus = 'idle' | 'running' | 'done' | 'error';

  interface TokenPoolEntry { value: string; weight: number; }
  interface TokenPool {
    label: string;
    description: string;
    entries: TokenPoolEntry[];
    conditionalOn?: { pool: string; values: string[]; };
  }

  interface Props {
    open: boolean;
    character: GachaCharacter | null;
    tokenPools: Record<string, TokenPool>;
    fishVoices: FishVoice[];
    voiceUsageMap: Map<string, { id: string; name: string }[]>;
    imageProvider: 'pixellab' | 'gemini';
    imageModel: string;
    imageSize: string;
    imageSystemInfo: string;
    onclose: () => void;
    oncharacterupdated: (character: GachaCharacter) => void;
  }

  let {
    open,
    character,
    tokenPools,
    fishVoices,
    voiceUsageMap,
    imageProvider,
    imageModel,
    imageSize,
    imageSystemInfo,
    onclose,
    oncharacterupdated,
  }: Props = $props();

  // ─── Constants ──────────────────────────────────────────────────────
  const rarities = ['common', 'rare', 'epic', 'legendary'] as const;
  const traitLabels = ['energy', 'positivity', 'formality', 'talkativeness', 'attitude', 'humor'] as const;

  const CELEBRITY_NAMES: string[] = [
    'elon musk', 'donald trump', 'trump', 'taylor swift', 'barack obama', 'obama',
    'morgan freeman', 'david attenborough', 'sydney sweeney', 'gigi hadid', 'mrbeast',
    'billy graham', 'napoleon hill', 'warren buffett', 'warren buffet', 'ronaldo',
    'jim rohn', 'voddie baucham', 'shi heng yi', 'neville goddard', 'matthew hussey',
    'angela white', 'denzel', 'andrew tate', 'joe rogan', 'jordan peterson',
    'ben shapiro', 'pewdiepie', 'snoop dogg', 'kanye', 'drake', 'ariana grande',
    'kim kardashian', 'oprah', 'jeff bezos', 'mark zuckerberg', 'joe biden', 'biden',
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

  // ─── State: Pipeline ───────────────────────────────────────────────
  let workingCharacter: GachaCharacter | null = $state(null);
  let activeStep: 1 | 2 | 3 = $state(1);
  let pipeline = $state({ step1: 'idle' as StepStatus, step2: 'idle' as StepStatus, step3: 'idle' as StepStatus });
  let stepErrors = $state({ step1: '', step2: '', step3: '' });

  // ─── Pipeline Log ─────────────────────────────────────────────────
  interface LogEntry { time: string; level: 'info' | 'success' | 'error'; message: string; }
  let pipelineLog = $state<LogEntry[]>([]);
  let logExpanded = $state(true);

  function addLog(level: LogEntry['level'], message: string) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    pipelineLog = [...pipelineLog, { time, level, message }];
  }

  function clearLog() { pipelineLog = []; }

  // ─── State: Edit Fields ────────────────────────────────────────────
  let editName = $state('');
  let editDescription = $state('');
  let editBackstory = $state('');
  let editSystemPrompt = $state('');
  let editTagline = $state('');
  let editPersonality = $state({ energy: 50, positivity: 50, formality: 50, talkativeness: 50, attitude: 50, humor: 50 });
  let imagePrompt = $state('');
  let voiceTestText = $state('Hey there! Ready to watch some games?');
  let voicePlaying = $state(false);
  let previewAudio: HTMLAudioElement | null = $state(null);

  // ─── State: Generation ─────────────────────────────────────────────
  let generateRarity: CharacterRarity = $state('common');
  let rolledTokens: Record<string, string> = $state({});
  let tokensRolled = $state(false);

  // ─── State: Step 3 Voice Picker ────────────────────────────────────
  let step3Search = $state('');
  let step3Page = $state(1);
  let step3PageSize = $state(25);
  let step3SortKey = $state('task_count');
  let step3SortDirection: 'asc' | 'desc' = $state('desc');
  let step3ActiveTags: string[] = $state([]);
  let playingVoiceId: string | null = $state(null);
  let currentAudio: HTMLAudioElement | null = $state(null);

  // ─── Derived ───────────────────────────────────────────────────────
  const step1Done = $derived(pipeline.step1 === 'done' || (workingCharacter !== null && !!workingCharacter.name));
  const step2Done = $derived(pipeline.step2 === 'done' || (workingCharacter !== null && !!workingCharacter.avatar_url));
  const step3Done = $derived(pipeline.step3 === 'done' || (workingCharacter !== null && !!workingCharacter.voice_id));

  // ─── Token Roll ────────────────────────────────────────────────────
  function clientWeightedPick(entries: TokenPoolEntry[]): string {
    if (entries.length === 0) return '';
    const total = entries.reduce((s, e) => s + e.weight, 0);
    if (total <= 0) return entries[0].value;
    let r = Math.random() * total;
    for (const e of entries) {
      r -= e.weight;
      if (r <= 0) return e.value;
    }
    return entries[entries.length - 1].value;
  }

  function doRollAllTokens() {
    const pools = tokenPools as TokenPoolsType;
    if (!pools || Object.keys(pools).length === 0) {
      rolledTokens = {};
      tokensRolled = false;
      return;
    }
    rolledTokens = rollTokenPoolsFn(pools);
    tokensRolled = true;
  }

  function rerollSingleToken(key: string) {
    const pool = tokenPools[key];
    if (!pool || pool.entries.length === 0) return;
    rolledTokens = { ...rolledTokens, [key]: weightedPick(pool.entries) };
  }

  const promptPreview = $derived.by(() => {
    if (!tokensRolled || Object.keys(rolledTokens).length === 0) return '';
    const directive = buildDirectiveFn(rolledTokens);
    return `Generate a ${generateRarity} rarity character.${directive} Return ONLY valid JSON.`;
  });

  // ─── Step 3 Voice DataTable Derived ────────────────────────────────
  const step3Columns: Column[] = [
    { key: 'favorite', label: '\u2605', width: '36px' },
    { key: 'play', label: '', width: '48px' },
    { key: 'title', label: 'Name', sortable: true },
    { key: 'tags', label: 'Tags', width: '180px' },
    { key: 'used_by', label: 'Used By', width: '150px' },
    { key: 'task_count', label: 'Popularity', sortable: true, width: '100px' },
    { key: 'author_name', label: 'Author', width: '110px' },
  ];

  const step3FilterTags: Tag[] = $derived.by(() => {
    const tagCounts = new Map<string, number>();
    for (const v of fishVoices) {
      if (isCelebrityVoice(v)) continue;
      for (const t of v.tags) {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
    }
    const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    return sorted.map(([tag]) => ({ key: tag, label: tag, group: 'Tags' }));
  });

  const step3Filtered = $derived.by(() => {
    let result = fishVoices.filter(v => !isCelebrityVoice(v));
    if (step3Search) {
      const q = step3Search.toLowerCase();
      result = result.filter(v =>
        v.title.toLowerCase().includes(q)
          || v.tags.some(t => t.toLowerCase().includes(q))
          || (v.author_name ?? '').toLowerCase().includes(q)
      );
    }
    if (step3ActiveTags.length > 0) {
      result = result.filter(v =>
        step3ActiveTags.every(tag => v.tags.includes(tag))
      );
    }
    return result;
  });

  const step3Sorted = $derived.by(() => {
    const arr = [...step3Filtered];
    arr.sort((a, b) => {
      // Favorites always first
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      const aVal = (a as Record<string, unknown>)[step3SortKey];
      const bVal = (b as Record<string, unknown>)[step3SortKey];
      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') cmp = aVal - bVal;
      else if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal);
      else cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''));
      return step3SortDirection === 'asc' ? cmp : -cmp;
    });
    return arr;
  });

  const step3Paginated = $derived(
    step3Sorted.slice((step3Page - 1) * step3PageSize, step3Page * step3PageSize)
  );

  // Reset step3 page when filters change
  $effect(() => {
    step3Search;
    step3ActiveTags;
    step3Page = 1;
  });

  // ─── Sync from character prop ──────────────────────────────────────
  let lastCharacterRef: GachaCharacter | null = null;
  let lastOpen = false;

  $effect(() => {
    // When modal opens or character changes, load into editor
    if (open && (character !== lastCharacterRef || open !== lastOpen)) {
      lastCharacterRef = character;
      lastOpen = open;

      if (character) {
        loadCharacterIntoEditor(character);
      } else {
        // New character: reset state
        workingCharacter = null;
        pipeline = { step1: 'idle', step2: 'idle', step3: 'idle' };
        stepErrors = { step1: '', step2: '', step3: '' };
        editName = '';
        editDescription = '';
        editBackstory = '';
        editTagline = '';
        editSystemPrompt = '';
        editPersonality = { energy: 50, positivity: 50, formality: 50, talkativeness: 50, attitude: 50, humor: 50 };
        imagePrompt = '';
        step3Search = '';
        step3Page = 1;
        step3ActiveTags = [];
        activeStep = 1;
        doRollAllTokens();
      }
    }

    if (!open && lastOpen) {
      lastOpen = false;
      stopAllAudio();
    }
  });

  // Stop audio on step change
  let prevStep: number | null = null;
  $effect(() => {
    const step = activeStep;
    if (prevStep !== null && prevStep !== step) {
      stopAllAudio();
    }
    prevStep = step;
  });

  // ─── Character Loading ─────────────────────────────────────────────
  function loadCharacterIntoEditor(char: GachaCharacter) {
    workingCharacter = char;
    editName = char.name;
    editDescription = char.description ?? '';
    editBackstory = char.backstory ?? '';
    editTagline = char.tagline ?? '';
    editSystemPrompt = char.system_prompt ?? '';
    voiceTestText = char.tagline || char.description?.slice(0, 120) || 'Hey there! Ready to watch some games?';
    editPersonality = {
      energy: (char.personality as Record<string, number>)?.energy ?? 50,
      positivity: (char.personality as Record<string, number>)?.positivity ?? 50,
      formality: (char.personality as Record<string, number>)?.formality ?? 50,
      talkativeness: (char.personality as Record<string, number>)?.talkativeness ?? 50,
      attitude: (char.personality as Record<string, number>)?.attitude ?? 50,
      humor: (char.personality as Record<string, number>)?.humor ?? 50,
    };

    // Build rich image prompt
    const promptParts: string[] = [imageSystemInfo];
    if (char.name) promptParts.push(`\nName: ${char.name}`);
    if (char.rarity) promptParts.push(`Rarity: ${char.rarity}`);
    if (char.description) promptParts.push(`Description: ${char.description}`);

    const p = char.personality as Record<string, number> | null;
    if (p) {
      const tLabels: Record<string, string> = { energy: 'Energy', positivity: 'Positivity', formality: 'Formality', talkativeness: 'Talkativeness', attitude: 'Attitude', humor: 'Humor' };
      const sorted = Object.entries(p)
        .filter(([k]) => k in tLabels)
        .sort((a, b) => Math.abs(b[1] - 50) - Math.abs(a[1] - 50))
        .slice(0, 3);
      if (sorted.length > 0) {
        const traitSummary = sorted.map(([k, v]) => `${tLabels[k]}: ${v}/100`).join(', ');
        promptParts.push(`Key traits: ${traitSummary}`);
      }
    }

    const metaForPrompt = char.generation_metadata as GenerationMetadata | null;
    const tokenRoll = metaForPrompt?.step1_text?.request?.tokenRoll as Record<string, string> | undefined;
    if (tokenRoll && Object.keys(tokenRoll).length > 0) {
      const rollLines = Object.entries(tokenRoll).map(([k, v]) => `${k}: ${v}`).join(', ');
      promptParts.push(`Token roll: ${rollLines}`);
    }

    imagePrompt = promptParts.join('\n');

    const meta = char.generation_metadata as GenerationMetadata | null;
    pipeline = {
      step1: meta?.step1_text ? 'done' : 'idle',
      step2: meta?.step2_image ? 'done' : 'idle',
      step3: meta?.step3_voice ? 'done' : 'idle',
    };
    stepErrors = { step1: '', step2: '', step3: '' };
    clearLog();
  }

  // ─── Audio ─────────────────────────────────────────────────────────
  function stopAllAudio() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    playingVoiceId = null;
    if (previewAudio) { previewAudio.pause(); previewAudio = null; }
    voicePlaying = false;
  }

  function handleClose() {
    stopAllAudio();
    activeStep = 1;
    onclose();
  }

  function playVoiceSample(voice: FishVoice) {
    if (!voice.sample_url) return;
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if (playingVoiceId === voice.id) { playingVoiceId = null; return; }
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

  // ─── Pipeline: Step 1 — Text Generation ────────────────────────────
  async function runStep1(rarity: CharacterRarity) {
    pipeline.step1 = 'running';
    stepErrors.step1 = '';
    addLog('info', `Step 1: Generating ${rarity} character text...`);
    try {
      const tokens = tokensRolled && Object.keys(rolledTokens).length > 0 ? rolledTokens : undefined;
      const char = await generateCharacterText(rarity, tokens);
      loadCharacterIntoEditor(char);
      pipeline.step1 = 'done';
      addLog('success', `Step 1: Created "${char.name}" (${rarity})`);
      toast.success(`Character "${char.name}" generated`);
      activeStep = 2;
      oncharacterupdated(char);
    } catch (e) {
      pipeline.step1 = 'error';
      const msg = e instanceof Error ? e.message : 'Generation failed';
      stepErrors.step1 = msg;
      addLog('error', `Step 1 failed: ${msg}`);
      toast.error(`Text generation failed: ${msg}`);
    }
  }

  async function rerunStep1() {
    if (!workingCharacter) return;
    pipeline.step1 = 'running';
    stepErrors.step1 = '';
    addLog('info', `Step 1: Re-generating ${workingCharacter.rarity} character text...`);
    try {
      const char = await generateCharacterText(workingCharacter.rarity);
      loadCharacterIntoEditor(char);
      pipeline.step1 = 'done';
      addLog('success', `Step 1: Created "${char.name}" (${char.rarity})`);
      toast.success(`Character "${char.name}" generated`);
      oncharacterupdated(char);
    } catch (e) {
      pipeline.step1 = 'error';
      const msg = e instanceof Error ? e.message : 'Generation failed';
      stepErrors.step1 = msg;
      addLog('error', `Step 1 failed: ${msg}`);
      toast.error(`Text generation failed: ${msg}`);
    }
  }

  async function saveEdits() {
    if (!workingCharacter) return;
    try {
      const updated = await updateCharacter(workingCharacter.id, {
        name: editName,
        description: editDescription,
        backstory: editBackstory,
        tagline: editTagline,
        system_prompt: editSystemPrompt,
        personality: { ...editPersonality },
      } as Partial<GachaCharacter>);
      workingCharacter = updated;
      toast.success('Character saved');
      oncharacterupdated(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      stepErrors.step1 = msg;
      toast.error(msg);
    }
  }

  // ─── Pipeline: Step 2 — Image Generation ───────────────────────────
  async function runStep2() {
    if (!workingCharacter) return;
    pipeline.step2 = 'running';
    stepErrors.step2 = '';
    const providerLabel = imageProvider === 'gemini' ? `Gemini (${imageModel}, ${imageSize})` : 'PixelLab (128x128)';
    addLog('info', `Step 2: Generating sprite via ${providerLabel}...`);
    try {
      const result = await generateCharacterImage(workingCharacter.id, imagePrompt, {
        provider: imageProvider,
        model: imageProvider === 'gemini' ? imageModel : undefined,
        imageConfig: imageProvider === 'gemini' ? { imageSize, aspectRatio: '1:1' } : undefined,
      });
      workingCharacter = { ...workingCharacter, avatar_url: result.avatar_url };
      const { getCharacter } = await import('@glazebot/supabase-client');
      workingCharacter = await getCharacter(workingCharacter.id);
      pipeline.step2 = 'done';
      addLog('success', `Step 2: Sprite generated — ${result.avatar_url.split('/').pop()}`);
      toast.success('Sprite generated');
      oncharacterupdated(workingCharacter);
    } catch (e) {
      pipeline.step2 = 'error';
      const msg = e instanceof Error ? e.message : 'Image generation failed';
      stepErrors.step2 = msg;
      addLog('error', `Step 2 failed: ${msg}`);
      toast.error(`Sprite generation failed: ${msg}`);
    }
  }

  // ─── Pipeline: Step 3 — Voice Assignment ───────────────────────────
  async function runStep3(voiceId?: string) {
    if (!workingCharacter) return;
    pipeline.step3 = 'running';
    stepErrors.step3 = '';
    addLog('info', `Step 3: ${voiceId ? 'Assigning selected voice' : 'Auto-assigning voice'}...`);
    try {
      if (voiceId) {
        const voice = fishVoices.find(v => v.id === voiceId);
        const voiceName = voice?.title ?? 'Unknown';
        await updateCharacter(workingCharacter.id, {
          voice_id: voiceId,
          voice_name: voiceName,
        } as Partial<GachaCharacter>);
        workingCharacter = { ...workingCharacter, voice_id: voiceId, voice_name: voiceName };
        addLog('success', `Step 3: Assigned voice "${voiceName}"`);
      } else {
        const result = await assignCharacterVoice(workingCharacter.id);
        workingCharacter = { ...workingCharacter, voice_id: result.voice_id, voice_name: result.voice_name };
        const { getCharacter } = await import('@glazebot/supabase-client');
        workingCharacter = await getCharacter(workingCharacter.id);
        addLog('success', `Step 3: Auto-assigned voice "${result.voice_name}"`);
      }
      pipeline.step3 = 'done';
      toast.success(`Voice assigned: ${workingCharacter.voice_name}`);
      oncharacterupdated(workingCharacter);
    } catch (e) {
      pipeline.step3 = 'error';
      const msg = e instanceof Error ? e.message : 'Voice assignment failed';
      stepErrors.step3 = msg;
      addLog('error', `Step 3 failed: ${msg}`);
      toast.error(`Voice assignment failed: ${msg}`);
    }
  }

  async function playVoicePreview() {
    if (!workingCharacter?.voice_id) return;
    if (previewAudio) { previewAudio.pause(); previewAudio = null; }
    voicePlaying = true;
    try {
      const audioData = await previewVoice(workingCharacter.voice_id, voiceTestText);
      const blob = new Blob([audioData], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { voicePlaying = false; previewAudio = null; URL.revokeObjectURL(url); };
      audio.onerror = () => { voicePlaying = false; previewAudio = null; URL.revokeObjectURL(url); };
      audio.play();
      previewAudio = audio;
    } catch {
      voicePlaying = false;
    }
  }

  // ─── New Generation Reset ──────────────────────────────────────────
  function startNewGeneration() {
    workingCharacter = null;
    pipeline = { step1: 'idle', step2: 'idle', step3: 'idle' };
    stepErrors = { step1: '', step2: '', step3: '' };
    editName = '';
    editDescription = '';
    editBackstory = '';
    editTagline = '';
    editSystemPrompt = '';
    editPersonality = { energy: 50, positivity: 50, formality: 50, talkativeness: 50, attitude: 50, humor: 50 };
    imagePrompt = '';
    step3Search = '';
    step3Page = 1;
    step3ActiveTags = [];
    doRollAllTokens();
  }
</script>

<Spotlight {open} onclose={handleClose}>
  <div class="workshop-modal" data-testid="detail-panel">
    <!-- Header Bar -->
    <div class="modal-header">
      <div class="modal-header-title">
        {#if workingCharacter}
          <h2>{workingCharacter.name}</h2>
          <Badge variant={workingCharacter.rarity} text={workingCharacter.rarity} />
        {:else}
          <h2>Character Workshop</h2>
        {/if}
      </div>
      <button class="close-btn" onclick={handleClose} data-testid="close-detail">&times;</button>
    </div>

    <!-- Step Progress Bar -->
    <div class="wizard-progress" data-testid="wizard-progress">
      {#each [
        { num: 1, label: 'Configure', done: step1Done },
        { num: 2, label: 'Review', done: step2Done },
        { num: 3, label: 'Voice', done: step3Done },
      ] as step, i (step.num)}
        <div class="wizard-step-item">
          <button
            class="wizard-step-circle"
            class:active={activeStep === step.num}
            class:completed={step.done}
            class:future={activeStep < step.num && !step.done}
            disabled={step.num > activeStep && !step.done}
            onclick={() => { if (step.num <= activeStep || step.done) activeStep = step.num as 1 | 2 | 3; }}
            data-testid="wizard-step-{step.num}"
          >
            {#if step.done}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {:else}
              {step.num}
            {/if}
          </button>
          <span
            class="wizard-step-label"
            class:active={activeStep === step.num}
            class:completed={step.done}
          >{step.label}</span>
        </div>
        {#if i < 2}
          <div class="wizard-line" class:completed={[step1Done, step2Done][i]}></div>
        {/if}
      {/each}
    </div>

    <!-- Step Content -->
    <div class="wizard-content">
      {#if activeStep === 1}
        <!-- STEP 1: Text Generation -->
        <div class="step-panel" data-testid="wizard-panel-1">
          {#if workingCharacter === null}
            <!-- New character: configure tokens + preview + generate -->
            <div class="configure-panel">
              <!-- Rarity Selector -->
              <div class="config-section">
                <h3>Rarity</h3>
                <div class="rarity-buttons" data-testid="rarity-buttons">
                  {#each rarities as r}
                    <button
                      class="rarity-btn rarity-{r}"
                      class:selected={generateRarity === r}
                      onclick={() => generateRarity = r}
                      data-testid="rarity-btn-{r}"
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Token Roll Section -->
              {#if Object.keys(tokenPools).length > 0}
                <div class="config-section">
                  <div class="section-header">
                    <h3>Token Roll</h3>
                    <button class="reroll-all-btn" onclick={doRollAllTokens} data-testid="reroll-all-btn" title="Re-roll all tokens">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 0 1 10.89-3.48M14 8a6 6 0 0 1-10.89 3.48" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M14 2v3h-3M2 14v-3h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      Re-roll All
                    </button>
                  </div>
                  {#if tokensRolled}
                    <div class="token-roll-grid" data-testid="token-roll-grid">
                      {#each Object.entries(rolledTokens) as [key, value] (key)}
                        <div class="token-row">
                          <span class="token-label">{tokenPools[key]?.label ?? key}</span>
                          <span class="token-value">{value}</span>
                          <button
                            class="token-reroll-btn"
                            onclick={() => rerollSingleToken(key)}
                            title="Re-roll {tokenPools[key]?.label ?? key}"
                            data-testid="reroll-{key}"
                          >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 0 1 10.89-3.48M14 8a6 6 0 0 1-10.89 3.48" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M14 2v3h-3M2 14v-3h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                          </button>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p class="muted">No token pools configured. Tokens will be rolled server-side.</p>
                  {/if}
                </div>
              {/if}

              <!-- Prompt Preview -->
              {#if promptPreview}
                <div class="config-section">
                  <h3>Prompt Preview</h3>
                  <div class="prompt-preview" data-testid="prompt-preview">{promptPreview}</div>
                </div>
              {/if}

              {#if stepErrors.step1}
                <p class="error" data-testid="step-error-1">{stepErrors.step1}</p>
              {/if}
            </div>
          {:else}
            <!-- Existing character: summary + actions -->
            <div class="character-summary">
              <div class="summary-row">
                <span class="summary-label">Name</span>
                <span class="summary-value">{editName}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Tagline</span>
                <span class="summary-value">{editTagline || '(none)'}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Rarity</span>
                <Badge variant={workingCharacter.rarity} text={workingCharacter.rarity} />
              </div>
              <div class="summary-row stacked">
                <span class="summary-label">Description</span>
                <span class="summary-value">{editDescription || '(none)'}</span>
              </div>
              <div class="summary-row stacked">
                <span class="summary-label">Backstory</span>
                <span class="summary-value">{editBackstory || '(none)'}</span>
              </div>
              <div class="summary-actions">
                <Button
                  variant="secondary"
                  onclick={startNewGeneration}
                  testid="new-generation-btn"
                >New Generation</Button>
              </div>
            </div>
          {/if}
        </div>

      {:else if activeStep === 2}
        <!-- STEP 2: Review & Edit -->
        <div class="step-panel" data-testid="wizard-panel-2">
          {#if workingCharacter}
            <div class="review-layout">
              <!-- Left: Character details (editable) -->
              <div class="review-fields">
                <TextInput label="Name" bind:value={editName} testid="edit-name" />
                <TextInput label="Tagline" bind:value={editTagline} testid="edit-tagline" />
                <TextArea label="Description" bind:value={editDescription} rows={3} testid="edit-description" />
                <TextArea label="Backstory" bind:value={editBackstory} rows={3} testid="edit-backstory" />
                <TextArea label="System Prompt" bind:value={editSystemPrompt} rows={4} monospace testid="edit-system-prompt" />

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
                  <Button
                    variant="secondary"
                    loading={pipeline.step1 === 'running'}
                    onclick={rerunStep1}
                    testid="step1-regenerate-btn"
                  >Re-generate Text</Button>
                  <Button variant="primary" onclick={saveEdits} testid="save-edits-btn">Save Edits</Button>
                </div>

                {#if stepErrors.step1}
                  <p class="error" data-testid="step-error-1">{stepErrors.step1}</p>
                {/if}
              </div>

              <!-- Right: Sprite -->
              <div class="review-sprite">
                <div class="sprite-card">
                  {#if workingCharacter.avatar_url}
                    <img src={workingCharacter.avatar_url} alt="{workingCharacter.name} sprite" width="128" height="128" class="sprite-img" />
                  {:else}
                    <div class="sprite-placeholder">
                      <span>No sprite</span>
                    </div>
                  {/if}
                </div>
                <TextArea
                  label="Image Prompt"
                  bind:value={imagePrompt}
                  rows={3}
                  testid="image-prompt"
                />
                <p class="provider-badge" data-testid="image-provider-badge">
                  {imageProvider === 'gemini' ? `Gemini (${imageSize})` : 'PixelLab (128x128)'}
                </p>
                <Button
                  variant="primary"
                  loading={pipeline.step2 === 'running'}
                  onclick={runStep2}
                  testid="step2-generate-btn"
                >
                  {pipeline.step2 === 'running' ? 'Generating...' : workingCharacter.avatar_url ? 'Re-generate Sprite' : 'Generate Sprite'}
                </Button>
                {#if stepErrors.step2}
                  <p class="error" data-testid="step-error-2">{stepErrors.step2}</p>
                {/if}
              </div>
            </div>
          {/if}
        </div>

      {:else if activeStep === 3}
        <!-- STEP 3: Voice Assignment -->
        <div class="step-panel" data-testid="wizard-panel-3">
          {#if workingCharacter}
            <div class="step-fields">
              <!-- Current voice status -->
              <div class="voice-current">
                <span class="voice-current-label">Current Voice</span>
                <span class="voice-current-value">{workingCharacter.voice_name ?? 'None assigned'}</span>
              </div>

              <!-- Auto-assign button -->
              <div class="step-actions">
                <Button
                  variant="primary"
                  loading={pipeline.step3 === 'running'}
                  onclick={() => runStep3()}
                  testid="step3-assign-btn"
                >
                  {pipeline.step3 === 'running' ? 'Assigning...' : workingCharacter.voice_id ? 'Auto Re-assign' : 'Auto-assign Voice'}
                </Button>
              </div>

              <!-- Voice preview -->
              {#if workingCharacter.voice_id}
                <div class="voice-test">
                  <TextArea
                    label="Test text"
                    bind:value={voiceTestText}
                    rows={2}
                    testid="voice-test-text"
                  />
                  <Button
                    variant="secondary"
                    loading={voicePlaying}
                    onclick={playVoicePreview}
                    testid="play-voice-btn"
                  >
                    Play Preview
                  </Button>
                </div>
              {/if}

              <!-- Voice selection table -->
              <div class="voice-list">
                <span class="info-label">
                  {#if fishVoices.length === 0}
                    Loading voices...
                  {:else}
                    Available Voices ({step3Filtered.length}) — click a row to assign
                  {/if}
                </span>
                {#if fishVoices.length > 0}
                  <div class="step3-toolbar">
                    <input
                      type="text"
                      class="search-input"
                      placeholder="Search voices..."
                      bind:value={step3Search}
                      data-testid="voice-search-step3"
                    />
                  </div>

                  {#if step3FilterTags.length > 0}
                    <div class="voice-tag-filter">
                      <TagFilter
                        tags={step3FilterTags}
                        active={step3ActiveTags}
                        onchange={(tags) => step3ActiveTags = tags}
                      />
                    </div>
                  {/if}

                  <DataTable
                    columns={step3Columns}
                    rows={step3Paginated}
                    sortKey={step3SortKey}
                    sortDirection={step3SortDirection}
                    onsort={(key, dir) => { step3SortKey = key; step3SortDirection = dir; }}
                    selectedId={workingCharacter.voice_id}
                    onrowclick={(row) => runStep3(row.id)}
                  >
                    {#snippet cell({ row, column })}
                      {#if column.key === 'favorite'}
                        <span class="fav-indicator" class:active={row.is_favorite}>
                          {row.is_favorite ? '\u2605' : ''}
                        </span>
                      {:else if column.key === 'play'}
                        {#if row.sample_url}
                          <button
                            class="play-btn"
                            class:playing={playingVoiceId === row.id}
                            onclick={(e) => { e.stopPropagation(); playVoiceSample(row); }}
                            data-testid="play-voice-step3-{row.id}"
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
                      {:else if column.key === 'author_name'}
                        <span class="cell-muted">{row.author_name ?? '\u2014'}</span>
                      {/if}
                    {/snippet}
                  </DataTable>

                  <Pagination
                    total={step3Filtered.length}
                    page={step3Page}
                    pageSize={step3PageSize}
                    onpagechange={(p) => step3Page = p}
                    onpagesizechange={(s) => { step3PageSize = s; step3Page = 1; }}
                  />
                {/if}
              </div>

              {#if stepErrors.step3}
                <p class="error" data-testid="step-error-3">{stepErrors.step3}</p>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Pipeline Log -->
    {#if pipelineLog.length > 0}
      <div class="pipeline-log" data-testid="pipeline-log">
        <div class="log-header">
          <button class="log-toggle" onclick={() => logExpanded = !logExpanded}>
            <span class="log-chevron">{logExpanded ? '\u25BC' : '\u25B6'}</span>
            <span class="log-title">Pipeline Log ({pipelineLog.length})</span>
          </button>
          <button class="log-clear" onclick={() => clearLog()}>Clear</button>
        </div>
        {#if logExpanded}
          <div class="log-entries">
            {#each pipelineLog as entry}
              <div class="log-entry log-{entry.level}">
                <span class="log-time">{entry.time}</span>
                <span class="log-indicator"></span>
                <span class="log-message">{entry.message}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Footer Navigation -->
    <div class="wizard-footer" data-testid="wizard-footer">
      <div class="wizard-footer-left">
        {#if activeStep > 1}
          <Button
            variant="secondary"
            onclick={() => activeStep = (activeStep - 1) as 1 | 2 | 3}
            testid="wizard-back-btn"
          >Back</Button>
        {/if}
      </div>
      <div class="wizard-footer-right">
        {#if activeStep === 1 && workingCharacter === null}
          <Button
            variant="primary"
            loading={pipeline.step1 === 'running'}
            onclick={() => runStep1(generateRarity)}
            testid="step1-generate-btn"
          >
            {pipeline.step1 === 'running' ? 'Generating...' : 'Generate'}
          </Button>
        {:else if activeStep < 3}
          <Button
            variant="primary"
            disabled={activeStep === 1 ? !step1Done : !step2Done}
            onclick={() => activeStep = (activeStep + 1) as 1 | 2 | 3}
            testid="wizard-next-btn"
          >Next</Button>
        {:else}
          <Button
            variant="primary"
            onclick={handleClose}
            testid="wizard-complete-btn"
          >Complete</Button>
        {/if}
      </div>
    </div>
  </div>
</Spotlight>

<style>
  .workshop-modal {
    background: var(--color-surface-raised);
    border: 1px solid var(--white-a12);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: var(--radius-xl);
    width: min(1080px, 94vw);
    height: min(88vh, 920px);
    display: flex;
    flex-direction: column;
    box-shadow: 0 0 60px var(--teal-a5), 0 8px 32px var(--black-a40);
    position: relative;
  }

  /* ─── Modal Header ─── */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-5) var(--space-7);
    border-bottom: 1px solid var(--white-a8);
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

  /* ─── Wizard Progress Bar ─── */
  .wizard-progress {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: var(--space-5) var(--space-7);
    border-bottom: 1px solid var(--white-a8);
    flex-shrink: 0;
  }

  .wizard-step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1-5);
    flex-shrink: 0;
    min-width: 56px;
  }

  .wizard-step-circle {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-sm);
    font-weight: 700;
    border: 2px solid var(--white-a10);
    background: none;
    color: var(--color-text-muted);
    cursor: default;
    transition: all 0.3s ease;
    flex-shrink: 0;
    font-family: inherit;
    padding: 0;
  }

  .wizard-step-circle.active {
    border-color: var(--color-teal);
    color: var(--color-teal);
    background: var(--teal-a10);
    cursor: pointer;
  }

  .wizard-step-circle.completed {
    border-color: var(--color-teal);
    background: var(--color-teal);
    color: var(--color-bg);
    cursor: pointer;
  }

  .wizard-step-circle.future {
    border-color: var(--white-a10);
    color: var(--color-text-muted);
  }

  .wizard-step-circle:disabled {
    cursor: default;
  }

  .wizard-step-label {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text-muted);
    transition: color 0.3s ease;
  }

  .wizard-step-label.active {
    color: var(--color-teal);
  }

  .wizard-step-label.completed {
    color: var(--color-text-secondary);
  }

  .wizard-line {
    width: 72px;
    height: 2px;
    background: var(--white-a10);
    border-radius: 1px;
    transition: background 0.4s ease;
    margin: 0 var(--space-4);
    margin-bottom: var(--space-5);
  }

  .wizard-line.completed {
    background: var(--color-teal);
  }

  /* ─── Wizard Content ─── */
  .wizard-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-6) var(--space-7);
    min-height: 0;
  }

  .step-panel {
    animation: stepFadeIn 0.25s ease;
  }

  @keyframes stepFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .step-panel h3 {
    font-size: var(--font-lg);
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 var(--space-2);
  }

  .muted { color: var(--color-text-muted); }

  /* ─── Configure Panel (Step 1 New Character) ─── */
  .configure-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .config-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .config-section h3 {
    font-size: var(--font-xs);
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .reroll-all-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    padding: var(--space-1) var(--space-2-5);
    border-radius: var(--radius-md);
    border: 1px solid var(--white-a10);
    background: none;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: var(--font-xs);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .reroll-all-btn:hover {
    background: var(--white-a4);
    color: var(--color-teal);
    border-color: var(--teal-a30);
  }

  .token-roll-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-1-5);
  }

  .token-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--white-a3);
    border: 1px solid var(--white-a6);
    border-radius: var(--radius-md);
  }

  .token-label {
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--color-text-muted);
    min-width: 110px;
    flex-shrink: 0;
  }

  .token-value {
    flex: 1;
    font-size: var(--font-sm);
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .token-reroll-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: var(--radius-md);
    border: 1px solid var(--white-a8);
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-base);
    flex-shrink: 0;
  }

  .token-reroll-btn:hover {
    background: var(--white-a6);
    color: var(--color-teal);
    border-color: var(--teal-a30);
  }

  .prompt-preview {
    background: var(--white-a3);
    border: 1px solid var(--white-a6);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-mono, 'SF Mono', 'Cascadia Code', monospace);
    font-size: var(--font-xs);
    color: var(--color-text-secondary);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 180px;
    overflow-y: auto;
  }

  .configure-panel .muted {
    color: var(--color-text-muted);
    font-size: var(--font-sm);
    margin: 0;
  }

  /* ─── Character Summary (Step 1 existing) ─── */
  .character-summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .summary-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-4);
  }

  .summary-row.stacked {
    flex-direction: column;
    gap: var(--space-1-5);
  }

  .summary-label {
    font-size: var(--font-xs);
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    min-width: 80px;
    flex-shrink: 0;
  }

  .summary-value {
    font-size: var(--font-base);
    color: var(--color-text-primary);
    line-height: 1.6;
  }

  .summary-actions {
    display: flex;
    gap: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--white-a6);
    margin-top: var(--space-2);
  }

  /* ─── Review Layout (Step 2) ─── */
  .review-layout {
    display: grid;
    grid-template-columns: 1fr 240px;
    gap: var(--space-6);
    align-items: start;
  }

  .review-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-3-5);
  }

  .review-sprite {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    position: sticky;
    top: 0;
  }

  .sprite-card {
    background: var(--white-a3);
    border: 1px solid var(--white-a8);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    overflow: hidden;
  }

  .sprite-img {
    image-rendering: pixelated;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .provider-badge {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    text-align: center;
    margin: 0;
  }

  .sprite-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--white-a3);
    border: 1px dashed var(--white-a10);
    border-radius: var(--radius-lg);
    aspect-ratio: 1;
    color: var(--color-text-muted);
    font-size: var(--font-sm);
  }

  /* ─── Rarity Buttons ─── */
  .rarity-buttons {
    display: flex;
    gap: var(--space-3);
  }

  .rarity-btn {
    padding: var(--space-2-5) var(--space-5);
    border-radius: var(--radius-lg);
    border: 1.5px solid var(--white-a10);
    background: none;
    font-family: inherit;
    font-size: var(--font-base);
    font-weight: 600;
    text-transform: capitalize;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .rarity-btn.rarity-common { color: var(--rarity-common); border-color: color-mix(in srgb, var(--rarity-common) 30%, transparent); }
  .rarity-btn.rarity-rare { color: var(--rarity-rare); border-color: color-mix(in srgb, var(--rarity-rare) 30%, transparent); }
  .rarity-btn.rarity-epic { color: var(--rarity-epic); border-color: color-mix(in srgb, var(--rarity-epic) 30%, transparent); }
  .rarity-btn.rarity-legendary { color: var(--rarity-legendary); border-color: color-mix(in srgb, var(--rarity-legendary) 30%, transparent); }

  .rarity-btn.rarity-common.selected { background: color-mix(in srgb, var(--rarity-common) 20%, transparent); border-color: var(--rarity-common); }
  .rarity-btn.rarity-rare.selected { background: color-mix(in srgb, var(--rarity-rare) 20%, transparent); border-color: var(--rarity-rare); }
  .rarity-btn.rarity-epic.selected { background: color-mix(in srgb, var(--rarity-epic) 20%, transparent); border-color: var(--rarity-epic); }
  .rarity-btn.rarity-legendary.selected { background: color-mix(in srgb, var(--rarity-legendary) 20%, transparent); border-color: var(--rarity-legendary); }

  .rarity-btn:hover:not(.selected) {
    background: var(--white-a4);
  }

  /* ─── Step Fields ─── */
  .step-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .step-actions {
    display: flex;
    gap: var(--space-3);
    margin-top: var(--space-2);
  }

  .traits-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-2);
    padding-top: var(--space-4);
    border-top: 1px solid var(--white-a6);
  }

  .traits-label {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .error { color: var(--color-error); font-size: var(--font-base); margin-top: var(--space-1); }

  /* ─── Step 3: Voice ─── */
  .voice-test {
    display: flex;
    gap: var(--space-3);
    align-items: flex-end;
    width: 100%;
  }

  .voice-test :global(.field) {
    flex: 1;
    min-width: 0;
  }

  .voice-current {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--white-a3);
    border: 1px solid var(--white-a8);
    border-radius: var(--radius-md);
  }

  .voice-current-label {
    font-size: var(--font-xs);
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .voice-current-value {
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .voice-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1-5);
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border);
  }

  .info-label {
    font-size: var(--font-xs);
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-muted);
    letter-spacing: 0.05em;
  }

  .step3-toolbar {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .step3-toolbar .search-input {
    flex: 1;
  }

  .fav-indicator {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .fav-indicator.active {
    color: var(--rarity-legendary);
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

  .voice-tag-filter {
    margin-bottom: var(--space-3-5);
  }

  /* ─── Table Cells ─── */
  .cell-name {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .cell-muted {
    color: var(--color-text-muted);
    font-size: var(--font-base);
  }

  .cell-number {
    font-variant-numeric: tabular-nums;
  }

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

  .tag-pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .tag-pill {
    padding: var(--space-1) var(--space-2);
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

  /* ─── Pipeline Log ─── */
  .pipeline-log {
    border-top: 1px solid var(--white-a8);
    flex-shrink: 0;
  }

  .log-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-7);
    color: var(--color-text-secondary);
  }

  .log-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-secondary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
  }

  .log-toggle:hover {
    background: var(--white-a4);
  }

  .log-title {
    font-size: var(--font-sm);
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .log-clear {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--space-0-5) var(--space-2);
    border-radius: var(--radius-sm);
  }

  .log-clear:hover {
    color: var(--color-text-primary);
    background: var(--white-a6);
  }

  .log-chevron {
    font-size: var(--font-micro);
  }

  .log-entries {
    max-height: 180px;
    overflow-y: auto;
    padding: 0 var(--space-7) var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .log-entry {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: var(--font-sm);
    line-height: 1.6;
  }

  .log-time {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .log-indicator {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
    margin-top: var(--space-1-5);
  }

  .log-info .log-indicator { background: var(--color-teal); }
  .log-success .log-indicator { background: var(--color-log-success); }
  .log-error .log-indicator { background: var(--color-error); }

  .log-info .log-message { color: var(--color-text-secondary); }
  .log-success .log-message { color: var(--color-log-success); }
  .log-error .log-message { color: var(--color-error); }

  .log-message {
    word-break: break-word;
  }

  /* ─── Wizard Footer ─── */
  .wizard-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-7);
    border-top: 1px solid var(--white-a8);
    flex-shrink: 0;
  }

  .wizard-footer-left,
  .wizard-footer-right {
    display: flex;
    gap: var(--space-2);
  }
</style>
