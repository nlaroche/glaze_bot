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
    deleteAllCharacters,
    purgeCharacterMedia,
    purgeAllDeletedCharacters,
    getDeletedCharacters,
    toggleCharacterActive,
    setDefaultCharacter,
    syncFishVoices,
    getFishVoices,
    getVoiceUsageMap,
    generativeTts,
    rollTokenPools as rollTokenPoolsFn,
    buildDirective as buildDirectiveFn,
    weightedPick,
    saveConfigSnapshot,
    listConfigSnapshots,
    updateConfigSnapshot,
    deleteConfigSnapshot,
  } from '@glazebot/supabase-client';
  import type { FishVoice, TokenPools as TokenPoolsType, TokenRoll as TokenRollType, ConfigSnapshot } from '@glazebot/supabase-client';
  import yaml from 'js-yaml';
  import { Spotlight, CardViewer } from '@glazebot/shared-ui';
  import type { GachaCharacter, CharacterRarity, GenerationMetadata } from '@glazebot/shared-types';
  import { validateConfig } from '@glazebot/shared-types';
  import { toast } from '$lib/stores/toast.svelte';

  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import NumberInput from '$lib/components/ui/NumberInput.svelte';
  import { SliderInput } from '@glazebot/shared-ui';
  import TextArea from '$lib/components/ui/TextArea.svelte';
  import TextInput from '$lib/components/ui/TextInput.svelte';

  import DataTable from '$lib/components/ui/DataTable.svelte';
  import type { Column } from '$lib/components/ui/DataTable.svelte';
  import Pagination from '$lib/components/ui/Pagination.svelte';
  import TagFilter from '$lib/components/ui/TagFilter.svelte';
  import type { Tag } from '$lib/components/ui/TagFilter.svelte';
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
  import PrimitivesPanel from './PrimitivesPanel.svelte';
  import AlgorithmPanel from './AlgorithmPanel.svelte';



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
  let showDeleted = $state(false);
  let deletedCharacters: GachaCharacter[] = $state([]);
  let loadingDeleted = $state(false);
  let purgingAll = $state(false);
  let activeTags: string[] = $state([]);

  // ─── State: Panels ────────────────────────────────────────────────
  type AdminTab = 'config' | 'economy' | 'workshop' | 'voices' | 'history' | 'primitives' | 'algorithm';
  const validTabs: AdminTab[] = ['config', 'economy', 'workshop', 'voices', 'history', 'primitives', 'algorithm'];
  const storedTab = (typeof localStorage !== 'undefined' ? localStorage.getItem('admin-active-tab') : null) as AdminTab | null;
  let activeTab: AdminTab = $state(storedTab && validTabs.includes(storedTab) ? storedTab : 'config');
  let detailPanelOpen = $state(false);
  let configDrawerOpen = $state(false);
  let viewerCharacter: GachaCharacter | null = $state(null);

  // ─── State: Config ────────────────────────────────────────────────
  let config: Record<string, unknown> = $state({});
  let rawJson: string = $state('');
  let loading: boolean = $state(true);
  let saving: boolean = $state(false);
  let jsonError: string = $state('');

  let model = $state('qwen-plus');
  let baseTemperature = $state(0.9);
  let packsPerDay = $state(3);
  let cardsPerPack = $state(3);
  let generationPrompt = $state('');
  let imageSystemInfo = $state('facing south, sitting at a table, 128x128 pixel art sprite, no background');
  let imageProvider = $state<'pixellab' | 'gemini'>('pixellab');
  let imageModel = $state('gemini-2.0-flash-preview-image-generation');
  let imageSize = $state('1024x1024');
  let dropRates = $state({ common: 0.6, rare: 0.25, epic: 0.12, legendary: 0.03 });

  // ─── State: Commentary LLM ───────────────────────────────────────
  const DEFAULT_COMMENTARY_DIRECTIVE = `You are a live gaming commentator watching the player's screen. Your CHARACTER VOICE is flavor — it should color HOW you say things, not WHAT you talk about. DO NOT roleplay or narrate in-character. DO NOT address the player with in-character nicknames or catchphrases. DO NOT use emojis.

Your job: react to what is ACTUALLY HAPPENING on screen right now. Be specific. Name the things you see. If someone dies, say they died. If the player makes a mistake, call it out. If something cool happens, hype it.

Think of yourself as a Twitch co-caster, not a D&D character.`;

  const DEFAULT_COMMENTARY_NUDGES = [
    'React to ONE specific thing you see on screen.',
    'Reference a movie, show, or meme this reminds you of.',
    'Make a bold prediction about what happens next.',
    'Roast the player\'s decision. Be specific.',
    'Ask a rhetorical question about what just happened.',
    'Give a backhanded compliment about the play.',
    'Pick one thing on screen and fixate on it.',
    'React to health, gold, or resources — not just the action.',
    'Notice something small in the background nobody else would.',
    'Express a strong opinion about something on screen that doesn\'t matter.',
    'Compare the player to a fictional character based on what they did.',
    'React to the PACE — is it frantic, slow, tense?',
  ];

  let commentaryVisionProvider = $state('dashscope');
  let commentaryVisionModel = $state('qwen3-vl-flash');
  let commentaryDirective = $state(DEFAULT_COMMENTARY_DIRECTIVE);
  let commentaryMaxTokens = $state(80);
  let commentaryTemperature = $state(0.9);
  let commentaryPresencePenalty = $state(1.5);
  let commentaryFrequencyPenalty = $state(0.8);
  let commentaryStyleNudgesText = $state(DEFAULT_COMMENTARY_NUDGES.join('\n'));
  let commentaryResponseInstruction = $state('1-2 sentences max, under 30 words. React to the screen. No roleplay, no emojis, no catchphrases. If nothing is happening: [SILENCE]');
  let commentaryInteractionInstruction = $state('When the player speaks to you, respond directly and conversationally. Acknowledge what they said, stay in character. Keep it brief.');

  // ─── State: Context Analysis ────────────────────────────────────
  let contextProvider = $state('dashscope');
  let contextModel = $state('qwen3-vl-flash');
  let contextPrompt = $state('Describe what is happening on screen in 1-2 sentences. Focus on the game state, player actions, and any notable events.');
  let contextMaxTokens = $state(100);
  let contextInterval = $state(3);
  let contextBufferSize = $state(10);

  // ─── State: Card Generation Provider/Model ─────────────────────────
  let cardGenProvider = $state('dashscope');
  let cardGenModel = $state('qwen-plus');

  // ─── State: Prompt Assembly Preview ────────────────────────────────
  const PREVIEW_CHARACTER = {
    name: 'Pixel Pete',
    system_prompt: 'You are Pixel Pete, a retro gaming enthusiast who speaks like a 90s arcade announcer. You get genuinely excited about pixel-perfect plays and tilted by sloppy movement. Your vibe is nostalgic but sharp.',
    personality: { energy: 78, positivity: 55, formality: 20, talkativeness: 62, attitude: 65, humor: 72 } as Record<string, number>,
  };

  let expandedPromptSections: Set<string> = $state(new Set());
  function togglePromptSection(key: string) {
    const next = new Set(expandedPromptSections);
    if (next.has(key)) next.delete(key); else next.add(key);
    expandedPromptSections = next;
  }

  const PREVIEW_TRAIT_LABELS: Record<string, [string, string]> = {
    energy: ['very calm and low-energy', 'very high-energy and hyped up'],
    positivity: ['cynical and pessimistic', 'optimistic and upbeat'],
    formality: ['very casual and informal', 'very formal and proper'],
    talkativeness: ['terse and brief', 'chatty and verbose'],
    attitude: ['hostile and aggressive', 'friendly and warm'],
    humor: ['dead serious', 'silly and goofy'],
  };

  function previewBuildPersonalityModifier(personality: Record<string, number>): string {
    const parts: string[] = [];
    for (const [trait, [lowDesc, highDesc]] of Object.entries(PREVIEW_TRAIT_LABELS)) {
      const val = personality[trait] ?? 50;
      if (val < 30) parts.push(`Be ${lowDesc}`);
      else if (val < 45) parts.push(`Be somewhat ${lowDesc}`);
      else if (val > 70) parts.push(`Be ${highDesc}`);
      else if (val > 55) parts.push(`Be somewhat ${highDesc}`);
    }
    if (parts.length === 0) return '';
    return `\n[Personality adjustment: ${parts.join('. ')}.]`;
  }

  let previewPersonalityMod = $derived(previewBuildPersonalityModifier(PREVIEW_CHARACTER.personality));

  let previewNudges = $derived(commentaryStyleNudgesText.split('\n').filter((l: string) => l.trim()));
  let previewRandomNudge = $derived(previewNudges.length > 0 ? previewNudges[0] : '(no nudges configured)');

  let previewSystemMessage = $derived(
    PREVIEW_CHARACTER.system_prompt + '\n\n' + commentaryDirective + previewPersonalityMod
  );

  let previewUserMessage = $derived(
    `[Screenshot: current game frame]\n\nGame: Valorant\nThe player said: "nice shot!"\n\nStyle hint: ${previewRandomNudge}\n\n/no_think ${commentaryResponseInstruction}`
  );

  // ─── State: Token Pools ───────────────────────────────────────────
  interface TokenPoolEntry { value: string; weight: number; }
  interface TokenPool {
    label: string;
    description: string;
    entries: TokenPoolEntry[];
    conditionalOn?: { pool: string; values: string[]; };
  }

  let tokenPools: Record<string, TokenPool> = $state({});
  let expandedPools: Set<string> = $state(new Set());
  let testRollResult: Record<string, string> | null = $state(null);

  const DEFAULT_TOKEN_POOLS: Record<string, TokenPool> = {
    gender: {
      label: 'Gender',
      description: 'Character gender identity',
      entries: [
        { value: 'male', weight: 40 },
        { value: 'female', weight: 40 },
        { value: 'non-binary', weight: 15 },
        { value: 'ambiguous', weight: 5 },
      ],
    },
    species: {
      label: 'Species',
      description: 'Character species or race',
      entries: [
        { value: 'human', weight: 30 },
        { value: 'robot', weight: 10 },
        { value: 'alien', weight: 8 },
        { value: 'elf', weight: 7 },
        { value: 'catfolk', weight: 6 },
        { value: 'dragon-kin', weight: 5 },
        { value: 'dwarf', weight: 5 },
        { value: 'orc', weight: 4 },
        { value: 'undead', weight: 4 },
        { value: 'slime', weight: 3 },
        { value: 'ghost', weight: 3 },
        { value: 'fairy', weight: 3 },
        { value: 'demon', weight: 3 },
        { value: 'angel', weight: 3 },
        { value: 'goblin', weight: 2 },
        { value: 'werewolf', weight: 2 },
        { value: 'vampire', weight: 2 },
        { value: 'merfolk', weight: 2 },
        { value: 'centaur', weight: 1 },
        { value: 'treant', weight: 1 },
        { value: 'phoenix', weight: 1 },
        { value: 'minotaur', weight: 1 },
        { value: 'lizardfolk', weight: 1 },
        { value: 'mushroom person', weight: 1 },
      ],
    },
    ethnicity: {
      label: 'Ethnicity',
      description: 'Cultural/ethnic background (only when species is human)',
      entries: [
        { value: 'East Asian', weight: 10 },
        { value: 'South Asian', weight: 8 },
        { value: 'Southeast Asian', weight: 6 },
        { value: 'West African', weight: 8 },
        { value: 'East African', weight: 5 },
        { value: 'North African', weight: 4 },
        { value: 'Western European', weight: 10 },
        { value: 'Eastern European', weight: 6 },
        { value: 'Northern European', weight: 5 },
        { value: 'Southern European', weight: 5 },
        { value: 'Latin American', weight: 8 },
        { value: 'Caribbean', weight: 4 },
        { value: 'Middle Eastern', weight: 6 },
        { value: 'Central Asian', weight: 3 },
        { value: 'Pacific Islander', weight: 3 },
        { value: 'Indigenous American', weight: 4 },
        { value: 'Mixed heritage', weight: 8 },
        { value: 'Ambiguous', weight: 5 },
      ],
      conditionalOn: { pool: 'species', values: ['human'] },
    },
    ageRange: {
      label: 'Age Range',
      description: 'Character apparent age bracket',
      entries: [
        { value: 'child', weight: 5 },
        { value: 'teenager', weight: 10 },
        { value: 'young adult', weight: 30 },
        { value: 'adult', weight: 25 },
        { value: 'middle-aged', weight: 12 },
        { value: 'elderly', weight: 8 },
        { value: 'ageless', weight: 10 },
      ],
    },
    archetype: {
      label: 'Archetype',
      description: 'Character role or profession archetype',
      entries: [
        { value: 'samurai', weight: 5 },
        { value: 'hacker', weight: 5 },
        { value: 'pirate captain', weight: 5 },
        { value: 'mad scientist', weight: 5 },
        { value: 'pro gamer', weight: 6 },
        { value: 'plague doctor', weight: 4 },
        { value: 'space trucker', weight: 4 },
        { value: 'street chef', weight: 4 },
        { value: 'bounty hunter', weight: 5 },
        { value: 'librarian', weight: 3 },
        { value: 'DJ', weight: 4 },
        { value: 'exorcist', weight: 3 },
        { value: 'mech pilot', weight: 5 },
        { value: 'detective', weight: 4 },
        { value: 'witch', weight: 4 },
        { value: 'bard', weight: 4 },
        { value: 'gladiator', weight: 3 },
        { value: 'ninja', weight: 4 },
        { value: 'alchemist', weight: 3 },
        { value: 'time traveler', weight: 4 },
        { value: 'necromancer', weight: 3 },
        { value: 'monk', weight: 3 },
        { value: 'smuggler', weight: 3 },
        { value: 'idol singer', weight: 4 },
        { value: 'wrestler', weight: 3 },
        { value: 'street racer', weight: 3 },
        { value: 'archaeologist', weight: 3 },
        { value: 'royal guard', weight: 3 },
        { value: 'fortune teller', weight: 3 },
        { value: 'war medic', weight: 3 },
        { value: 'thief', weight: 3 },
        { value: 'gunslinger', weight: 4 },
        { value: 'blacksmith', weight: 3 },
        { value: 'merchant', weight: 3 },
        { value: 'ranger', weight: 3 },
        { value: 'spy', weight: 4 },
        { value: 'summoner', weight: 3 },
        { value: 'paladin', weight: 3 },
        { value: 'berserker', weight: 3 },
        { value: 'engineer', weight: 3 },
        { value: 'shaman', weight: 3 },
        { value: 'assassin', weight: 4 },
        { value: 'clown', weight: 2 },
        { value: 'drill sergeant', weight: 3 },
        { value: 'bartender', weight: 3 },
        { value: 'astronaut', weight: 3 },
        { value: 'janitor', weight: 2 },
        { value: 'streamer', weight: 5 },
        { value: 'cryptid researcher', weight: 2 },
        { value: 'courier', weight: 2 },
        { value: 'vampire hunter', weight: 3 },
        { value: 'beast tamer', weight: 3 },
        { value: 'puppeteer', weight: 2 },
        { value: 'farmer', weight: 2 },
        { value: 'fisherman', weight: 2 },
        { value: 'dream walker', weight: 3 },
      ],
    },
    personalityVibe: {
      label: 'Personality Vibe',
      description: 'Core personality energy or mood',
      entries: [
        { value: 'cheerful', weight: 8 },
        { value: 'brooding', weight: 6 },
        { value: 'chaotic', weight: 7 },
        { value: 'sarcastic', weight: 8 },
        { value: 'deadpan', weight: 6 },
        { value: 'manic', weight: 5 },
        { value: 'nerdy', weight: 7 },
        { value: 'zen', weight: 5 },
        { value: 'dramatic', weight: 6 },
        { value: 'wholesome', weight: 6 },
        { value: 'cynical', weight: 5 },
        { value: 'flirty', weight: 4 },
        { value: 'mysterious', weight: 5 },
        { value: 'cocky', weight: 5 },
        { value: 'shy', weight: 4 },
        { value: 'goofy', weight: 6 },
        { value: 'grumpy', weight: 5 },
        { value: 'anxious', weight: 4 },
        { value: 'stoic', weight: 5 },
        { value: 'motherly', weight: 3 },
        { value: 'feral', weight: 3 },
        { value: 'chill', weight: 6 },
        { value: 'unhinged', weight: 4 },
        { value: 'noble', weight: 4 },
      ],
    },
    definingTrait: {
      label: 'Defining Trait',
      description: 'A distinctive physical or behavioral quirk',
      entries: [
        { value: 'eye patch', weight: 4 },
        { value: 'cybernetic arm', weight: 5 },
        { value: 'enormous mustache', weight: 3 },
        { value: 'always eating snacks', weight: 5 },
        { value: 'glowing eyes', weight: 5 },
        { value: 'wears a mask', weight: 4 },
        { value: 'speaks in third person', weight: 3 },
        { value: 'covered in tattoos', weight: 4 },
        { value: 'unnaturally tall', weight: 3 },
        { value: 'tiny and fierce', weight: 4 },
        { value: 'missing a tooth', weight: 3 },
        { value: 'always humming', weight: 3 },
        { value: 'carries a stuffed animal', weight: 3 },
        { value: 'scarred face', weight: 4 },
        { value: 'heterochromia', weight: 4 },
        { value: 'floating hair', weight: 3 },
        { value: 'mechanical voice', weight: 3 },
        { value: 'surrounded by butterflies', weight: 2 },
        { value: 'chain smoker', weight: 3 },
        { value: 'always cold', weight: 3 },
        { value: 'bioluminescent skin', weight: 3 },
        { value: 'extra arms', weight: 2 },
        { value: 'transparent body', weight: 2 },
        { value: 'wears only black', weight: 4 },
        { value: 'has a pet on their shoulder', weight: 4 },
        { value: 'narcoleptic', weight: 2 },
        { value: 'obsessed with collecting things', weight: 4 },
        { value: 'never stops smiling', weight: 3 },
        { value: 'perpetually exhausted', weight: 4 },
        { value: 'speaks with an accent', weight: 3 },
        { value: 'halo or horns', weight: 3 },
        { value: 'covered in bandages', weight: 3 },
        { value: 'wears oversized headphones', weight: 4 },
        { value: 'has a catchphrase for everything', weight: 3 },
        { value: 'leaves a trail of sparkles', weight: 2 },
      ],
    },
    settingTheme: {
      label: 'Setting/Theme',
      description: 'The world or aesthetic the character comes from',
      entries: [
        { value: 'cyberpunk megacity', weight: 8 },
        { value: 'medieval fantasy kingdom', weight: 8 },
        { value: 'deep space station', weight: 6 },
        { value: '1980s arcade', weight: 5 },
        { value: 'underwater civilization', weight: 4 },
        { value: 'post-apocalyptic wasteland', weight: 6 },
        { value: 'steampunk Victorian', weight: 5 },
        { value: 'ancient mythology', weight: 5 },
        { value: 'haunted mansion', weight: 4 },
        { value: 'floating sky islands', weight: 5 },
        { value: 'neon-lit Tokyo streets', weight: 6 },
        { value: 'wild west frontier', weight: 4 },
        { value: 'enchanted forest', weight: 4 },
        { value: 'dystopian megacorp', weight: 5 },
        { value: 'pirate seas', weight: 4 },
        { value: 'arctic expedition', weight: 3 },
        { value: 'dream realm', weight: 4 },
        { value: 'underground fight club', weight: 3 },
        { value: 'magical academy', weight: 5 },
        { value: 'alien jungle planet', weight: 4 },
        { value: 'retro-futuristic 1950s', weight: 3 },
        { value: 'interdimensional bazaar', weight: 3 },
        { value: 'abandoned theme park', weight: 3 },
        { value: 'virtual reality MMO', weight: 5 },
      ],
    },
  };

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

  function doTestRoll() {
    const result: Record<string, string> = {};
    const unconditional: [string, TokenPool][] = [];
    const conditional: [string, TokenPool][] = [];
    for (const [key, pool] of Object.entries(tokenPools)) {
      if (pool.conditionalOn) conditional.push([key, pool]);
      else unconditional.push([key, pool]);
    }
    for (const [key, pool] of unconditional) {
      if (pool.entries.length > 0) result[key] = clientWeightedPick(pool.entries);
    }
    for (const [key, pool] of conditional) {
      const cond = pool.conditionalOn!;
      const rolledValue = result[cond.pool];
      if (rolledValue && cond.values.includes(rolledValue)) {
        if (pool.entries.length > 0) result[key] = clientWeightedPick(pool.entries);
      }
    }
    testRollResult = result;
  }

  function togglePool(key: string) {
    const next = new Set(expandedPools);
    if (next.has(key)) next.delete(key); else next.add(key);
    expandedPools = next;
  }

  function addPoolEntry(poolKey: string) {
    const pool = tokenPools[poolKey];
    if (!pool) return;
    tokenPools = {
      ...tokenPools,
      [poolKey]: {
        ...pool,
        entries: [...pool.entries, { value: '', weight: 5 }],
      },
    };
  }

  function removePoolEntry(poolKey: string, index: number) {
    const pool = tokenPools[poolKey];
    if (!pool) return;
    tokenPools = {
      ...tokenPools,
      [poolKey]: {
        ...pool,
        entries: pool.entries.filter((_, i) => i !== index),
      },
    };
  }

  function updatePoolEntryValue(poolKey: string, index: number, value: string) {
    const pool = tokenPools[poolKey];
    if (!pool) return;
    const entries = [...pool.entries];
    entries[index] = { ...entries[index], value };
    tokenPools = { ...tokenPools, [poolKey]: { ...pool, entries } };
  }

  function updatePoolEntryWeight(poolKey: string, index: number, weight: number) {
    const pool = tokenPools[poolKey];
    if (!pool) return;
    const entries = [...pool.entries];
    entries[index] = { ...entries[index], weight };
    tokenPools = { ...tokenPools, [poolKey]: { ...pool, entries } };
  }

  function getEffectivePercent(pool: TokenPool, index: number): string {
    const total = pool.entries.reduce((s, e) => s + e.weight, 0);
    if (total <= 0) return '0';
    return ((pool.entries[index].weight / total) * 100).toFixed(1);
  }

  // ─── State: Pipeline ──────────────────────────────────────────────
  let workingCharacter: GachaCharacter | null = $state(null);
  let activeStep: 1 | 2 | 3 = $state(1);
  let pipeline = $state({ step1: 'idle' as StepStatus, step2: 'idle' as StepStatus, step3: 'idle' as StepStatus });
  let stepErrors = $state({ step1: '', step2: '', step3: '' });

  let editName = $state('');
  let editDescription = $state('');
  let editBackstory = $state('');
  let editSystemPrompt = $state('');
  let editPersonality = $state({ energy: 50, positivity: 50, formality: 50, talkativeness: 50, attitude: 50, humor: 50 });

  let editTagline = $state('');
  let imagePrompt = $state('');
  let voiceTestText = $state('Hey there! Ready to watch some games?');
  let voicePlaying = $state(false);
  let previewAudio: HTMLAudioElement | null = $state(null);
  // Step 3 voice picker state (DataTable)
  let step3Search = $state('');
  let step3Page = $state(1);
  let step3PageSize = $state(25);
  let step3SortKey = $state('task_count');
  let step3SortDirection: 'asc' | 'desc' = $state('desc');
  let step3ActiveTags: string[] = $state([]);

  // Voice usage map (voice_id → characters)
  let voiceUsageMap: Map<string, { id: string; name: string }[]> = $state(new Map());

  // ─── State: Confirm Dialog ────────────────────────────────────────
  let confirmOpen = $state(false);
  let confirmTitle = $state('');
  let confirmMessage = $state('');
  let confirmLabel = $state('Delete');
  let confirmVariant: 'destructive' | 'primary' = $state('destructive');
  let confirmAction: () => void = $state(() => {});

  // ─── State: Config History ──────────────────────────────────────────
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

  // ─── State: Generate ──────────────────────────────────────────────
  let generateRarity: CharacterRarity = $state('common');
  let rolledTokens: Record<string, string> = $state({});
  let tokensRolled = $state(false);

  // ─── State: Fish Voices ────────────────────────────────────────────
  let fishVoices: FishVoice[] = $state([]);
  let loadingVoices = $state(false);
  let syncingVoices = $state(false);
  let syncPageCount = $state(10);
  let voicesLoaded = $state(false);
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

  // ─── Celebrity Voice Filter ──────────────────────────────────────
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

  // Build tag filter options dynamically from voice data
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

  // Reactive chain: fishVoices → voiceFiltered → voiceSorted → voicePaginated
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

  // ─── Step 3 voice DataTable derived chain ──────────────────────────
  const step3Columns: Column[] = [
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

  // ─── Derived: Pinned voices for generative tab ─────────────────────
  const pinnedVoices = $derived(fishVoices.filter(v => pinnedVoiceIds.has(v.id)));

  function togglePinnedVoice(id: string) {
    const next = new Set(pinnedVoiceIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    pinnedVoiceIds = next;
  }

  // ─── State: Generative TTS ─────────────────────────────────────────
  let genReferenceId: string | null = $state(null);
  let voicesSubTab: 'library' | 'generative' = $state('library');
  let genText = $state('(excited) Oh nice, you just pulled off a triple kill! (laughing) Ha ha, they had no idea what hit them!');
  let genTemperature = $state(0.7);
  let genTopP = $state(0.7);
  let genSpeed = $state(1.0);
  let genRepPenalty = $state(1.2);
  let genLoading = $state(false);
  let genAudio: HTMLAudioElement | null = $state(null);
  let genPlaying = $state(false);
  let genError = $state('');

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

  // ─── Constants ────────────────────────────────────────────────────
  const commentaryProviderOptions = [
    { value: 'dashscope', label: 'Dashscope (Qwen VL)' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'gemini', label: 'Google (Gemini)' },
  ];
  const commentaryModelOptions: Record<string, { value: string; label: string }[]> = {
    dashscope: [
      { value: 'qwen3-vl-flash', label: 'qwen3-vl-flash' },
      { value: 'qwen-vl-plus', label: 'qwen-vl-plus' },
      { value: 'qwen-vl-max', label: 'qwen-vl-max' },
    ],
    anthropic: [
      { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
      { value: 'claude-sonnet-4-5-20250514', label: 'Sonnet 4.5' },
    ],
    gemini: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
      { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
    ],
  };
  let activeCommentaryModels = $derived(commentaryModelOptions[commentaryVisionProvider] ?? []);

  function onCommentaryProviderChange() {
    const models = commentaryModelOptions[commentaryVisionProvider];
    if (models?.length) commentaryVisionModel = models[0].value;
    syncToConfig();
  }

  // Context analysis uses the same provider/model options as commentary
  const contextProviderOptions = [
    { value: 'dashscope', label: 'Dashscope (Qwen VL)' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'gemini', label: 'Google (Gemini)' },
  ];
  const contextModelOptions: Record<string, { value: string; label: string }[]> = {
    dashscope: [
      { value: 'qwen3-vl-flash', label: 'qwen3-vl-flash' },
      { value: 'qwen-vl-plus', label: 'qwen-vl-plus' },
    ],
    anthropic: [
      { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
    ],
    gemini: [
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ],
  };
  let activeContextModels = $derived(contextModelOptions[contextProvider] ?? []);

  function onContextProviderChange() {
    const models = contextModelOptions[contextProvider];
    if (models?.length) contextModel = models[0].value;
    syncToConfig();
  }

  const cardGenProviderOptions = [
    { value: 'dashscope', label: 'Dashscope (Qwen)' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'gemini', label: 'Google (Gemini)' },
  ];
  const cardGenModelOptions: Record<string, { value: string; label: string }[]> = {
    dashscope: [
      { value: 'qwen-plus', label: 'qwen-plus' },
      { value: 'qwen-turbo', label: 'qwen-turbo' },
      { value: 'qwen-max', label: 'qwen-max' },
    ],
    anthropic: [
      { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
      { value: 'claude-sonnet-4-5-20250514', label: 'Sonnet 4.5' },
    ],
    gemini: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
    ],
  };
  let activeCardGenModels = $derived(cardGenModelOptions[cardGenProvider] ?? []);

  function onCardGenProviderChange() {
    const models = cardGenModelOptions[cardGenProvider];
    if (models?.length) cardGenModel = models[0].value;
    syncToConfig();
  }

  const rarities = ['common', 'rare', 'epic', 'legendary'] as const;
  const traitLabels = ['energy', 'positivity', 'formality', 'talkativeness', 'attitude', 'humor'] as const;
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

  // ─── Derived ──────────────────────────────────────────────────────
  const dropRateSum = $derived(
    Math.round((dropRates.common + dropRates.rare + dropRates.epic + dropRates.legendary) * 100) / 100
  );

  const metadata = $derived(
    (workingCharacter?.generation_metadata ?? null) as GenerationMetadata | null
  );

  const step1Done = $derived(pipeline.step1 === 'done' || (workingCharacter !== null && !!workingCharacter.name));
  const step2Done = $derived(pipeline.step2 === 'done' || (workingCharacter !== null && !!workingCharacter.avatar_url));
  const step3Done = $derived(pipeline.step3 === 'done' || (workingCharacter !== null && !!workingCharacter.voice_id));

  // ─── Token Roll Helpers ──────────────────────────────────────────
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

  // ─── Config Schema Validation ────────────────────────────────────
  // Uses validateConfig() from @glazebot/shared-types — walks DEFAULT_CONFIG
  // recursively so new fields are automatically caught.
  function validateConfigSchema(cfg: Record<string, unknown>): string | null {
    return validateConfig(cfg);
  }

  // ─── Snapshot Derived Chain ────────────────────────────────────────
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

  // ─── Snapshot Helper Functions ─────────────────────────────────────
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
    config = structuredClone(snapshot.config);
    rawJson = JSON.stringify(config, null, 2);
    syncFromConfig();
    previewOpen = false;
    activeTab = 'config';
    await saveConfig();
  }

  function handleDeleteSnapshot(snapshot: ConfigSnapshot) {
    confirmTitle = 'Delete Snapshot';
    confirmMessage = `Delete snapshot "${snapshot.name || '(auto-save)'}" from ${new Date(snapshot.created_at).toLocaleDateString()}? This cannot be undone.`;
    confirmLabel = 'Delete';
    confirmVariant = 'destructive';
    confirmAction = async () => {
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
      confirmOpen = false;
    };
    confirmOpen = true;
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
        'Step 2: Model from imageModel (e.g. gemini-2.0-flash-preview-image-generation)',
        'Step 3: Image size from imageConfig.imageSize (e.g. 1024x1024), aspect ratio from imageConfig.aspectRatio',
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
    syncToConfig();
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
        const err = validateConfigSchema(cfgData);
        if (err) {
          toast.error(`Schema validation failed: ${err}`);
          return;
        }
        config = structuredClone(cfgData);
        rawJson = JSON.stringify(config, null, 2);
        syncFromConfig();
        toast.success('Config imported — review and Save when ready.');
        activeTab = 'config';
        // Fire-and-forget: save an import snapshot
        const importName = file.name.replace(/\.(yaml|yml)$/i, '');
        saveConfigSnapshot(JSON.parse(JSON.stringify(cfgData)), importName, 'Imported from YAML').then(snap => {
          if (snapshotsLoaded) snapshots = [snap, ...snapshots];
        }).catch(() => {});
      } catch (ex) {
        toast.error(ex instanceof Error ? ex.message : 'Failed to parse YAML');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    if (importFileInput) importFileInput.value = '';
  }

  // ─── Lifecycle ────────────────────────────────────────────────────
  $effect(() => {
    loadConfig();
    loadCharacters();
    if (activeTab === 'voices') { loadFishVoices(); loadVoiceUsageMap(); }
  });

  // Persist active tab to localStorage
  $effect(() => {
    localStorage.setItem('admin-active-tab', activeTab);
  });

  // Reset to page 1 when filters change
  $effect(() => {
    // Touch the reactive dependencies
    searchQuery;
    activeTags;
    page = 1;
  });

  $effect(() => {
    voiceSearch;
    activeVoiceTags;
    voicePage = 1;
  });

  $effect(() => {
    snapshotSearch;
    snapshotFavoritesOnly;
    snapshotPage = 1;
  });

  // Stop audio + load voices on step change
  let prevStep: number | null = null;
  $effect(() => {
    const step = activeStep;
    if (prevStep !== null && prevStep !== step) {
      stopAllAudio();
    }
    prevStep = step;
    if (step === 3 && workingCharacter) {
      loadVoicesForStep3();
    }
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

  async function handlePurge(character: GachaCharacter, e: Event) {
    e.stopPropagation();
    confirmTitle = 'Purge Character';
    confirmMessage = `Permanently purge "${character.name}" and all media? This cannot be undone.`;
    confirmLabel = 'Purge';
    confirmVariant = 'destructive';
    confirmAction = async () => {
      try {
        await purgeCharacterMedia(character.id);
        deletedCharacters = deletedCharacters.filter(c => c.id !== character.id);
      } catch {
        // silently fail
      }
      confirmOpen = false;
    };
    confirmOpen = true;
  }

  async function handlePurgeAll() {
    confirmTitle = 'Purge All Deleted';
    confirmMessage = `Permanently purge all ${deletedCharacters.length} deleted characters and their media? This cannot be undone.`;
    confirmLabel = 'Purge All';
    confirmVariant = 'destructive';
    confirmAction = async () => {
      purgingAll = true;
      try {
        await purgeAllDeletedCharacters();
        deletedCharacters = [];
      } catch {
        // silently fail
      } finally {
        purgingAll = false;
      }
      confirmOpen = false;
    };
    confirmOpen = true;
  }

  // ─── Config Sync ──────────────────────────────────────────────────
  function syncFromConfig() {
    const dr = config.dropRates as Record<string, number> | undefined;
    if (dr) dropRates = { common: dr.common ?? 0.6, rare: dr.rare ?? 0.25, epic: dr.epic ?? 0.12, legendary: dr.legendary ?? 0.03 };
    baseTemperature = (config.baseTemperature as number) ?? 0.9;
    model = (config.model as string) ?? 'qwen-plus';
    cardGenProvider = (config.cardGenProvider as string) ?? 'dashscope';
    cardGenModel = (config.cardGenModel as string) ?? model;
    packsPerDay = (config.packsPerDay as number) ?? 3;
    cardsPerPack = (config.cardsPerPack as number) ?? 3;
    generationPrompt = (config.generationPrompt as string) ?? '';
    imageSystemInfo = (config.imageSystemInfo as string) ?? 'facing south, sitting at a table, 128x128 pixel art sprite, no background';
    imageProvider = ((config.imageProvider as string) ?? 'pixellab') as 'pixellab' | 'gemini';
    imageModel = (config.imageModel as string) ?? 'gemini-2.0-flash-preview-image-generation';
    const imgCfg = config.imageConfig as Record<string, string> | undefined;
    imageSize = imgCfg?.imageSize ?? '1024x1024';
    tokenPools = (config.tokenPools as Record<string, TokenPool>) ?? structuredClone(DEFAULT_TOKEN_POOLS);
    const c = config.commentary as Record<string, unknown> | undefined;
    commentaryVisionProvider = (c?.visionProvider as string) ?? 'dashscope';
    commentaryVisionModel = (c?.visionModel as string) ?? (commentaryModelOptions[commentaryVisionProvider]?.[0]?.value ?? 'qwen3-vl-flash');
    commentaryDirective = (c?.directive as string) ?? DEFAULT_COMMENTARY_DIRECTIVE;
    commentaryMaxTokens = (c?.maxTokens as number) ?? 80;
    commentaryTemperature = (c?.temperature as number) ?? 0.9;
    commentaryPresencePenalty = (c?.presencePenalty as number) ?? 1.5;
    commentaryFrequencyPenalty = (c?.frequencyPenalty as number) ?? 0.8;
    const nudgesArr = (c?.styleNudges as string[]) ?? DEFAULT_COMMENTARY_NUDGES;
    commentaryStyleNudgesText = nudgesArr.join('\n');
    commentaryResponseInstruction = (c?.responseInstruction as string) ?? '1-2 sentences max, under 30 words. React to the screen. No roleplay, no emojis, no catchphrases. If nothing is happening: [SILENCE]';
    commentaryInteractionInstruction = (c?.interactionInstruction as string) ?? 'When the player speaks to you, respond directly and conversationally. Acknowledge what they said, stay in character. Keep it brief.';
    const ctx = c?.context as Record<string, unknown> | undefined;
    contextProvider = (ctx?.provider as string) ?? 'dashscope';
    contextModel = (ctx?.model as string) ?? (contextModelOptions[contextProvider]?.[0]?.value ?? 'qwen3-vl-flash');
    contextPrompt = (ctx?.prompt as string) ?? 'Describe what is happening on screen in 1-2 sentences. Focus on the game state, player actions, and any notable events.';
    contextMaxTokens = (ctx?.maxTokens as number) ?? 100;
    contextInterval = (ctx?.interval as number) ?? 3;
    contextBufferSize = (ctx?.bufferSize as number) ?? 10;
  }

  function syncToConfig() {
    // Preserve algorithm fields (blockWeights, blockPrompts, memory) that
    // are managed by AlgorithmPanel — they live inside commentary but have
    // no standalone state vars on this page.
    const existingCommentary = (config.commentary as Record<string, unknown>) ?? {};
    config = {
      ...config,
      dropRates: { ...dropRates },
      baseTemperature,
      model: cardGenModel,
      cardGenProvider,
      cardGenModel,
      packsPerDay,
      cardsPerPack,
      generationPrompt,
      imageSystemInfo,
      imageProvider,
      imageModel,
      imageConfig: { imageSize, aspectRatio: '1:1' },
      tokenPools,
      commentary: {
        ...existingCommentary,
        visionProvider: commentaryVisionProvider,
        visionModel: commentaryVisionModel,
        directive: commentaryDirective,
        maxTokens: commentaryMaxTokens,
        temperature: commentaryTemperature,
        presencePenalty: commentaryPresencePenalty,
        frequencyPenalty: commentaryFrequencyPenalty,
        styleNudges: commentaryStyleNudgesText.split('\n').map(s => s.trim()).filter(Boolean),
        responseInstruction: commentaryResponseInstruction,
        interactionInstruction: commentaryInteractionInstruction,
        context: {
          provider: contextProvider,
          model: contextModel,
          prompt: contextPrompt,
          maxTokens: contextMaxTokens,
          interval: contextInterval,
          bufferSize: contextBufferSize,
        },
      },
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
    try {
      syncToConfig();
      await updateGachaConfig(config);
      toast.success('Config saved');
      // Fire-and-forget snapshot — mark as active
      saveConfigSnapshot(JSON.parse(JSON.stringify(config)), undefined, undefined, true).then(snap => {
        if (snapshotsLoaded) snapshots = [snap, ...snapshots.map(s => ({ ...s, is_active: false }))];
      }).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      saving = false;
    }
  }

  // ─── Table Actions ────────────────────────────────────────────────
  function onRowClick(character: GachaCharacter) {
    loadCharacterIntoEditor(character);
    activeStep = 1;
    detailPanelOpen = true;
  }

  function stopAllAudio() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    playingVoiceId = null;
    if (previewAudio) { previewAudio.pause(); previewAudio = null; }
    voicePlaying = false;
    if (genAudio) { genAudio.pause(); genAudio = null; }
    genPlaying = false;
  }

  function closeDetailPanel() {
    stopAllAudio();
    detailPanelOpen = false;
    activeStep = 1;
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
    confirmTitle = 'Soft-Delete Character';
    confirmMessage = `Soft-delete "${character.name}"? It will be hidden from users but can be purged later from the deleted list.`;
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
      } catch {
        // silently fail
      }
      confirmOpen = false;
    };
    confirmOpen = true;
  }

  function handleDeleteAll() {
    const activeCount = characters.filter(c => c.is_active).length;
    if (activeCount === 0) return;
    confirmTitle = 'Delete All Characters';
    confirmMessage = `Soft-delete ALL ${activeCount} active characters? They can be purged later from the deleted list.`;
    confirmLabel = 'Delete All';
    confirmVariant = 'destructive';
    confirmAction = async () => {
      try {
        await deleteAllCharacters();
        await loadCharacters();
        workingCharacter = null;
        detailPanelOpen = false;
      } catch {
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
    editTagline = character.tagline ?? '';
    editSystemPrompt = character.system_prompt ?? '';
    voiceTestText = character.tagline || character.description?.slice(0, 120) || 'Hey there! Ready to watch some games?';
    editPersonality = {
      energy: (character.personality as Record<string, number>)?.energy ?? 50,
      positivity: (character.personality as Record<string, number>)?.positivity ?? 50,
      formality: (character.personality as Record<string, number>)?.formality ?? 50,
      talkativeness: (character.personality as Record<string, number>)?.talkativeness ?? 50,
      attitude: (character.personality as Record<string, number>)?.attitude ?? 50,
      humor: (character.personality as Record<string, number>)?.humor ?? 50,
    };

    // Build a rich image prompt from character data
    const promptParts: string[] = [imageSystemInfo];
    if (character.name) promptParts.push(`\nName: ${character.name}`);
    if (character.rarity) promptParts.push(`Rarity: ${character.rarity}`);
    if (character.description) promptParts.push(`Description: ${character.description}`);

    // Summarize top personality traits
    const p = character.personality as Record<string, number> | null;
    if (p) {
      const traitLabels: Record<string, string> = { energy: 'Energy', positivity: 'Positivity', formality: 'Formality', talkativeness: 'Talkativeness', attitude: 'Attitude', humor: 'Humor' };
      const sorted = Object.entries(p)
        .filter(([k]) => k in traitLabels)
        .sort((a, b) => Math.abs(b[1] - 50) - Math.abs(a[1] - 50))
        .slice(0, 3);
      if (sorted.length > 0) {
        const traitSummary = sorted.map(([k, v]) => `${traitLabels[k]}: ${v}/100`).join(', ');
        promptParts.push(`Key traits: ${traitSummary}`);
      }
    }

    // Extract token roll from generation metadata (species, archetype, etc.)
    const metaForPrompt = character.generation_metadata as GenerationMetadata | null;
    const tokenRoll = metaForPrompt?.step1_text?.request?.tokenRoll as Record<string, string> | undefined;
    if (tokenRoll && Object.keys(tokenRoll).length > 0) {
      const rollLines = Object.entries(tokenRoll).map(([k, v]) => `${k}: ${v}`).join(', ');
      promptParts.push(`Token roll: ${rollLines}`);
    }

    imagePrompt = promptParts.join('\n');

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
      const tokens = tokensRolled && Object.keys(rolledTokens).length > 0 ? rolledTokens : undefined;
      const character = await generateCharacterText(rarity, tokens);
      loadCharacterIntoEditor(character);
      pipeline.step1 = 'done';
      activeStep = 2;
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
        tagline: editTagline,
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
      const result = await generateCharacterImage(workingCharacter.id, imagePrompt, {
        provider: imageProvider,
        model: imageProvider === 'gemini' ? imageModel : undefined,
        imageConfig: imageProvider === 'gemini' ? { imageSize, aspectRatio: '1:1' } : undefined,
      });
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
  let loadingStep3Voices = $state(false);

  async function loadVoicesForStep3() {
    if (voicesLoaded) return;
    loadingStep3Voices = true;
    try {
      await Promise.all([
        loadFishVoices(),
        loadVoiceUsageMap(),
      ]);
    } catch (e) {
      console.error('Failed to load voices for step 3:', e);
    } finally {
      loadingStep3Voices = false;
    }
  }

  async function loadVoiceUsageMap() {
    try {
      voiceUsageMap = await getVoiceUsageMap();
    } catch (e) {
      console.error('Failed to load voice usage map:', e);
    }
  }

  async function runStep3(voiceId?: string) {
    if (!workingCharacter) return;
    pipeline.step3 = 'running';
    stepErrors.step3 = '';
    try {
      if (voiceId) {
        // Direct DB update — instant, no edge function overhead
        const voice = fishVoices.find(v => v.id === voiceId);
        const voiceName = voice?.title ?? 'Unknown';
        await updateCharacter(workingCharacter.id, {
          voice_id: voiceId,
          voice_name: voiceName,
        } as Partial<GachaCharacter>);
        workingCharacter = { ...workingCharacter, voice_id: voiceId, voice_name: voiceName };
      } else {
        // Auto-assign: use edge function (LLM picks best voice)
        const result = await assignCharacterVoice(workingCharacter.id);
        workingCharacter = { ...workingCharacter, voice_id: result.voice_id, voice_name: result.voice_name };
        const { getCharacter } = await import('@glazebot/supabase-client');
        workingCharacter = await getCharacter(workingCharacter.id);
      }
      pipeline.step3 = 'done';
      characters = characters.map(c => c.id === workingCharacter!.id ? workingCharacter! : c);
      loadVoiceUsageMap();
    } catch (e) {
      pipeline.step3 = 'error';
      stepErrors.step3 = e instanceof Error ? e.message : 'Voice assignment failed';
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

  // ─── Fish Voices ────────────────────────────────────────────────
  async function loadFishVoices() {
    if (voicesLoaded) return;
    loadingVoices = true;
    try {
      fishVoices = await getFishVoices();
      voicesLoaded = true;
    } catch (e) {
      console.error('Failed to load voices:', e);
    } finally {
      loadingVoices = false;
    }
  }

  async function handleSyncVoices() {
    syncingVoices = true;
    try {
      await syncFishVoices({ page_count: syncPageCount });
      fishVoices = await getFishVoices();
      voicesLoaded = true;
    } catch (e) {
      console.error('Failed to sync voices:', e);
    } finally {
      syncingVoices = false;
    }
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

  // ─── Helpers ──────────────────────────────────────────────────────
  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
</script>

<div class="admin-page" class:scrollable={activeTab !== 'workshop' && activeTab !== 'voices'} data-testid="settings-page">
  <!-- ═══ HEADER ═══ -->
  <div class="page-header">
    <h1>Admin</h1>
    <div class="header-actions">
      {#if activeTab === 'workshop'}
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
            detailPanelOpen = true;
          }}
          testid="generate-new-btn"
        >
          + Generate New
        </Button>
      {:else if activeTab === 'voices'}
        <div class="sync-controls">
          <select
            class="sync-pages-select"
            bind:value={syncPageCount}
            data-testid="sync-pages-select"
          >
            <option value={5}>500 voices</option>
            <option value={10}>1,000 voices</option>
            <option value={20}>2,000 voices</option>
            <option value={50}>5,000 voices</option>
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
      {:else if activeTab === 'history'}
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
      {/if}
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
    <button
      class="top-tab"
      class:active={activeTab === 'voices'}
      onclick={() => { activeTab = 'voices'; loadFishVoices(); loadVoiceUsageMap(); }}
      data-testid="tab-voices"
    >Voices</button>
    <button
      class="top-tab"
      class:active={activeTab === 'history'}
      onclick={() => { activeTab = 'history'; loadSnapshots(); }}
      data-testid="tab-history"
    >History</button>
    <button
      class="top-tab"
      class:active={activeTab === 'primitives'}
      onclick={() => activeTab = 'primitives'}
      data-testid="tab-primitives"
    >Primitives</button>
    <button
      class="top-tab"
      class:active={activeTab === 'algorithm'}
      onclick={() => activeTab = 'algorithm'}
      data-testid="tab-algorithm"
    >Algorithm</button>
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
        <label class="toggle-deleted" data-testid="toggle-deleted">
          <input type="checkbox" bind:checked={showDeleted} onchange={() => { if (showDeleted) loadDeletedCharacters(); }} />
          Show Deleted
        </label>
      </div>

      <!-- ═══ MAIN CONTENT ═══ -->
      <div class="content-area">
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

  <!-- ═══ TAB: CARD GENERATION ═══ -->
  {:else if activeTab === 'config'}
    {#if loading}
      <p class="muted">Loading config...</p>
    {:else}
      <div class="cfg" data-testid="config-panel">
        <!-- Global Config -->
        <div class="cfg-card" data-testid="global-config-card">
          <div class="cfg-header">
            <h3 class="cfg-title">Global Config</h3>
            <p class="cfg-desc">Provider, model, and temperature for each pipeline</p>
          </div>
          <div class="cfg-body global-config-body">
            <div class="global-config-row">
              <span class="global-config-label">Card Generation</span>
              <div class="global-config-controls">
                <Select label="Provider" bind:value={cardGenProvider} options={cardGenProviderOptions} onchange={onCardGenProviderChange} testid="config-cardgen-provider" />
                <Select label="Model" bind:value={cardGenModel} options={activeCardGenModels} onchange={syncToConfig} testid="config-cardgen-model" />
                <SliderInput label="Temperature" bind:value={baseTemperature} min={0} max={2} step={0.05} onchange={syncToConfig} testid="config-temperature" />
              </div>
            </div>
            <div class="global-config-row">
              <span class="global-config-label">Commentary</span>
              <div class="global-config-controls">
                <Select label="Provider" bind:value={commentaryVisionProvider} options={commentaryProviderOptions} onchange={onCommentaryProviderChange} testid="config-commentary-provider" />
                <Select label="Model" bind:value={commentaryVisionModel} options={activeCommentaryModels} onchange={syncToConfig} testid="config-commentary-model" />
                <SliderInput label="Temperature" bind:value={commentaryTemperature} min={0.1} max={2} step={0.1} onchange={syncToConfig} testid="config-commentary-temperature" />
              </div>
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

        <!-- Image Provider -->
        <div class="cfg-card" data-testid="image-provider-card">
          <div class="cfg-header">
            <h3 class="cfg-title">Image Generation Provider</h3>
            <p class="cfg-desc">Select which AI provider generates character portraits</p>
          </div>
          <div class="cfg-body global-config-body">
            <div class="global-config-row">
              <span class="global-config-label">Sprite Provider</span>
              <div class="global-config-controls">
                <Select
                  label="Provider"
                  bind:value={imageProvider}
                  options={[
                    { value: 'pixellab', label: 'PixelLab (128x128, transparent)' },
                    { value: 'gemini', label: 'Gemini (higher res, with background)' },
                  ]}
                  onchange={() => { syncToConfig(); rawJson = JSON.stringify(config, null, 2); }}
                  testid="config-image-provider"
                />
                {#if imageProvider === 'gemini'}
                  <Select
                    label="Model"
                    bind:value={imageModel}
                    options={[
                      { value: 'gemini-2.0-flash-preview-image-generation', label: 'Gemini 2.0 Flash (Preview)' },
                    ]}
                    onchange={() => { syncToConfig(); rawJson = JSON.stringify(config, null, 2); }}
                    testid="config-image-model"
                  />
                  <Select
                    label="Resolution"
                    bind:value={imageSize}
                    options={[
                      { value: '512x512', label: '512px' },
                      { value: '1024x1024', label: '1K (1024px)' },
                      { value: '2048x2048', label: '2K (2048px)' },
                    ]}
                    onchange={() => { syncToConfig(); rawJson = JSON.stringify(config, null, 2); }}
                    testid="config-image-size"
                  />
                {/if}
              </div>
            </div>
          </div>
        </div>

        <!-- Token Pools -->
        <div class="cfg-card" data-testid="token-pools-card">
          <div class="cfg-header">
            <div class="cfg-header-row">
              <div>
                <h3 class="cfg-title">Character Token Pools</h3>
                <p class="cfg-desc">Weighted random pools that control character diversity. Each generation rolls one value from each pool and tells the LLM exactly what to build.</p>
              </div>
              <Button variant="ghost" onclick={doTestRoll} testid="test-roll-btn">Test Roll</Button>
            </div>
          </div>
          <div class="cfg-body">
            {#if testRollResult}
              <div class="test-roll-result" data-testid="test-roll-result">
                {#each Object.entries(testRollResult) as [key, value]}
                  <span class="roll-badge" data-testid="roll-badge-{key}">
                    <span class="roll-badge-label">{key}</span>
                    <span class="roll-badge-value">{value}</span>
                  </span>
                {/each}
              </div>
            {/if}

            {#each Object.entries(tokenPools) as [poolKey, pool]}
              <div class="pool-section" data-testid="pool-{poolKey}">
                <button
                  class="pool-header"
                  onclick={() => togglePool(poolKey)}
                  data-testid="pool-toggle-{poolKey}"
                >
                  <span class="pool-chevron" class:expanded={expandedPools.has(poolKey)}>&#9654;</span>
                  <span class="pool-label">{pool.label}</span>
                  <span class="pool-count">{pool.entries.length} entries</span>
                  {#if pool.conditionalOn}
                    <span class="pool-conditional-badge">if {pool.conditionalOn.pool} = {pool.conditionalOn.values.join(', ')}</span>
                  {/if}
                </button>

                {#if expandedPools.has(poolKey)}
                  <div class="pool-entries">
                    <p class="pool-description">{pool.description}</p>
                    {#each pool.entries as entry, i}
                      <div class="pool-entry-row" data-testid="pool-entry-{poolKey}-{i}">
                        <input
                          class="pool-entry-value"
                          type="text"
                          value={entry.value}
                          oninput={(e) => updatePoolEntryValue(poolKey, i, (e.target as HTMLInputElement).value)}
                          placeholder="Value..."
                        />
                        <input
                          class="pool-entry-slider"
                          type="range"
                          min="0"
                          max="50"
                          value={entry.weight}
                          oninput={(e) => updatePoolEntryWeight(poolKey, i, Number((e.target as HTMLInputElement).value))}
                        />
                        <span class="pool-entry-weight">{entry.weight}</span>
                        <span class="pool-entry-percent">{getEffectivePercent(pool, i)}%</span>
                        <button
                          class="pool-entry-remove"
                          onclick={() => removePoolEntry(poolKey, i)}
                          title="Remove entry"
                        >&times;</button>
                      </div>
                    {/each}
                    <button class="pool-add-entry" onclick={() => addPoolEntry(poolKey)} data-testid="pool-add-{poolKey}">
                      + Add Entry
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- Commentary LLM: Parameters -->
        <div class="cfg-card" data-testid="commentary-llm-card">
          <div class="cfg-header">
            <h3 class="cfg-title">Commentary LLM</h3>
            <p class="cfg-desc">Model parameters for the live commentary edge function</p>
          </div>
          <div class="cfg-body">
            <TextInput label="Response Instruction" bind:value={commentaryResponseInstruction} placeholder="1-2 sentences max, under 30 words..." onchange={syncToConfig} testid="config-commentary-response-instruction" />
            <TextInput label="Interaction Instruction" bind:value={commentaryInteractionInstruction} placeholder="When the player speaks to you, respond directly..." onchange={syncToConfig} testid="config-commentary-interaction-instruction" />
            <NumberInput label="Max Tokens" bind:value={commentaryMaxTokens} min={10} max={500} onchange={syncToConfig} testid="config-commentary-max-tokens" />
            <SliderInput label="Presence Penalty" bind:value={commentaryPresencePenalty} min={0} max={2} step={0.1} onchange={syncToConfig} testid="config-commentary-presence-penalty" />
            <SliderInput label="Frequency Penalty" bind:value={commentaryFrequencyPenalty} min={0} max={2} step={0.1} onchange={syncToConfig} testid="config-commentary-frequency-penalty" />
          </div>
        </div>

        <!-- Commentary LLM: Prompts side by side -->
        <div class="cfg-row-2col">
          <div class="cfg-card">
            <div class="cfg-header">
              <h3 class="cfg-title">Commentary Directive</h3>
              <p class="cfg-desc">System prompt that tells the LLM how to commentate</p>
            </div>
            <div class="cfg-body">
              <TextArea bind:value={commentaryDirective} rows={12} monospace placeholder="System directive for commentary..." onchange={syncToConfig} testid="config-commentary-directive" />
            </div>
          </div>
          <div class="cfg-card">
            <div class="cfg-header">
              <h3 class="cfg-title">Style Nudges</h3>
              <p class="cfg-desc">One per line — a random nudge is picked each call for variety</p>
            </div>
            <div class="cfg-body">
              <TextArea bind:value={commentaryStyleNudgesText} rows={12} monospace placeholder="One nudge per line..." onchange={syncToConfig} testid="config-commentary-nudges" />
            </div>
          </div>
        </div>

        <!-- Context Analysis -->
        <div class="cfg-card" data-testid="context-analysis-card">
          <div class="cfg-header">
            <h3 class="cfg-title">Context Analysis</h3>
            <p class="cfg-desc">Background scene analysis loop that feeds rich context to commentary characters</p>
          </div>
          <div class="cfg-body">
            <div class="global-config-row">
              <span class="global-config-label">Provider / Model</span>
              <div class="global-config-controls">
                <Select label="Provider" bind:value={contextProvider} options={contextProviderOptions} onchange={onContextProviderChange} testid="config-context-provider" />
                <Select label="Model" bind:value={contextModel} options={activeContextModels} onchange={syncToConfig} testid="config-context-model" />
              </div>
            </div>
            <NumberInput label="Max Tokens" bind:value={contextMaxTokens} min={20} max={300} onchange={syncToConfig} testid="config-context-max-tokens" />
            <SliderInput label="Interval (seconds)" bind:value={contextInterval} min={1} max={30} step={1} onchange={syncToConfig} testid="config-context-interval" />
            <NumberInput label="Buffer Size" bind:value={contextBufferSize} min={1} max={50} onchange={syncToConfig} testid="config-context-buffer-size" />
            <TextArea bind:value={contextPrompt} rows={4} monospace placeholder="Scene analysis prompt..." onchange={syncToConfig} testid="config-context-prompt" />
          </div>
        </div>

        <!-- Commentary Prompt Assembly Preview -->
        <div class="cfg-card" data-testid="prompt-assembly-card">
          <div class="cfg-header">
            <h3 class="cfg-title">How Commentary Prompts Are Assembled</h3>
            <p class="cfg-desc">Click each section to see exactly what the LLM receives — edits above update the preview in real time</p>
          </div>
          <div class="cfg-body">
            <div class="prompt-flow">

              <!-- SYSTEM section -->
              <button class="prompt-section-header" onclick={() => togglePromptSection('system')} data-testid="prompt-section-system">
                <span class="prompt-chevron" class:expanded={expandedPromptSections.has('system')}>&#9654;</span>
                <span class="prompt-section-badge system">SYSTEM</span>
                <span class="prompt-section-title">System Message</span>
                <span class="prompt-section-hint">3 parts concatenated</span>
              </button>
              {#if expandedPromptSections.has('system')}
                <div class="prompt-section-body">
                  <div class="prompt-text-block" data-border="db">
                    <div class="prompt-text-label"><span class="prompt-source-tag db">from DB</span> Character system_prompt</div>
                    <pre class="prompt-text-box">{PREVIEW_CHARACTER.system_prompt}</pre>
                  </div>
                  <div class="prompt-text-block" data-border="config">
                    <div class="prompt-text-label"><span class="prompt-source-tag config">from config</span> Commentary Directive</div>
                    <pre class="prompt-text-box">{commentaryDirective}</pre>
                  </div>
                  <div class="prompt-text-block" data-border="auto">
                    <div class="prompt-text-label"><span class="prompt-source-tag auto">auto-generated</span> Personality Modifier</div>
                    <pre class="prompt-text-box">{previewPersonalityMod || '(all traits neutral — no modifier)'}</pre>
                    <div class="prompt-trait-pills">
                      {#each Object.entries(PREVIEW_CHARACTER.personality) as [trait, val]}
                        <span class="prompt-trait-pill">{trait}: {val}</span>
                      {/each}
                    </div>
                  </div>
                </div>
              {/if}

              <div class="prompt-flow-divider"></div>

              <!-- USER section -->
              <button class="prompt-section-header" onclick={() => togglePromptSection('user')} data-testid="prompt-section-user">
                <span class="prompt-chevron" class:expanded={expandedPromptSections.has('user')}>&#9654;</span>
                <span class="prompt-section-badge user">USER</span>
                <span class="prompt-section-title">User Message (per frame)</span>
                <span class="prompt-section-hint">4 parts joined</span>
              </button>
              {#if expandedPromptSections.has('user')}
                <div class="prompt-section-body">
                  <div class="prompt-text-block" data-border="runtime">
                    <div class="prompt-text-label"><span class="prompt-source-tag runtime">runtime</span> Screenshot</div>
                    <pre class="prompt-text-box prompt-text-italic">[Screenshot: current game frame sent as base64 image]</pre>
                  </div>
                  <div class="prompt-text-block" data-border="runtime">
                    <div class="prompt-text-label"><span class="prompt-source-tag runtime">runtime</span> Context</div>
                    <pre class="prompt-text-box">Game: Valorant
The player said: "nice shot!"</pre>
                  </div>
                  <div class="prompt-text-block" data-border="config">
                    <div class="prompt-text-label"><span class="prompt-source-tag config">from config</span> Random Style Nudge</div>
                    <pre class="prompt-text-box">Style hint: {previewRandomNudge}</pre>
                  </div>
                  <div class="prompt-text-block" data-border="config">
                    <div class="prompt-text-label"><span class="prompt-source-tag config">from config</span> Response Instruction</div>
                    <pre class="prompt-text-box">/no_think {commentaryResponseInstruction}</pre>
                  </div>
                </div>
              {/if}

              <div class="prompt-flow-divider"></div>

              <!-- PARAMS section -->
              <button class="prompt-section-header" onclick={() => togglePromptSection('params')} data-testid="prompt-section-params">
                <span class="prompt-chevron" class:expanded={expandedPromptSections.has('params')}>&#9654;</span>
                <span class="prompt-section-badge params">PARAMS</span>
                <span class="prompt-section-title">API Parameters</span>
                <span class="prompt-section-hint">sent with every call</span>
              </button>
              {#if expandedPromptSections.has('params')}
                <div class="prompt-section-body">
                  <div class="prompt-params">
                    <span class="prompt-param">provider: {commentaryVisionProvider}</span>
                    <span class="prompt-param">model: {commentaryVisionModel}</span>
                    <span class="prompt-param">max_tokens: {commentaryMaxTokens}</span>
                    <span class="prompt-param">temperature: {commentaryTemperature}</span>
                    <span class="prompt-param">presence_penalty: {commentaryPresencePenalty}</span>
                    <span class="prompt-param">frequency_penalty: {commentaryFrequencyPenalty}</span>
                  </div>
                </div>
              {/if}

              <div class="prompt-flow-divider"></div>

              <!-- LIVE PREVIEW section -->
              <button class="prompt-section-header prompt-section-header--preview" onclick={() => togglePromptSection('preview')} data-testid="prompt-section-preview">
                <span class="prompt-chevron" class:expanded={expandedPromptSections.has('preview')}>&#9654;</span>
                <span class="prompt-section-badge preview">LIVE</span>
                <span class="prompt-section-title">Assembled Preview</span>
                <span class="prompt-section-hint">what {PREVIEW_CHARACTER.name} actually sees</span>
              </button>
              {#if expandedPromptSections.has('preview')}
                <div class="prompt-section-body">
                  <div class="prompt-preview-character">
                    Previewing as <strong>{PREVIEW_CHARACTER.name}</strong> — {Object.entries(PREVIEW_CHARACTER.personality).map(([t, v]) => `${t}:${v}`).join(' · ')}
                  </div>
                  <div class="prompt-text-block" data-border="system-full">
                    <div class="prompt-text-label">Full SYSTEM message</div>
                    <pre class="prompt-text-box prompt-text-box--tall">{previewSystemMessage}</pre>
                  </div>
                  <div class="prompt-text-block" data-border="user-full">
                    <div class="prompt-text-label">Full USER message</div>
                    <pre class="prompt-text-box prompt-text-box--tall">{previewUserMessage}</pre>
                  </div>
                  <div class="prompt-preview-params">
                    provider: {commentaryVisionProvider} · model: {commentaryVisionModel} · max_tokens: {commentaryMaxTokens} · temperature: {commentaryTemperature} · presence_penalty: {commentaryPresencePenalty} · frequency_penalty: {commentaryFrequencyPenalty}
                  </div>
                </div>
              {/if}

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
          <Button variant="primary" loading={saving} disabled={!!jsonError} onclick={saveConfig} testid="save-config-btn">
            {saving ? 'Saving...' : 'Save Config'}
          </Button>
        </div>
      </div>
    {/if}

  <!-- ═══ TAB: VOICES ═══ -->
  {:else if activeTab === 'voices'}
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
        <!-- ─── Library Sub-tab ─── -->
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
          <div class="voices-search">
            <input
              type="text"
              class="search-input"
              placeholder="Search voices..."
              bind:value={voiceSearch}
              data-testid="voice-search-input"
            />
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
        <!-- ─── Generative Sub-tab ─── -->
        <div class="gen-section" data-testid="generative-panel">
          <div class="gen-layout">
            <!-- Left: text input + controls -->
            <div class="gen-left">
              <div class="cfg-card">
                <div class="cfg-header">
                  <h3 class="cfg-title">Test Generative TTS</h3>
                  <p class="cfg-desc">Fish Audio S1 with emotion markers — pin voices in the Library tab to test them here</p>
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

  <!-- ═══ TAB: HISTORY ═══ -->
  {:else if activeTab === 'history'}
    <div class="history-tab" data-testid="history-panel">
      {#if snapshotsLoading}
        <p class="muted">Loading snapshots...</p>
      {:else}
        <!-- Toolbar -->
        <div class="voices-toolbar">
          <div class="voices-toolbar-left">
            {#if snapshots.length > 0}
              <Badge variant="default" text="{snapshotsFiltered.length} snapshot{snapshotsFiltered.length !== 1 ? 's' : ''}" testid="snapshot-count-badge" />
            {/if}
            <button
              class="celebrity-toggle"
              class:active={snapshotFavoritesOnly}
              onclick={() => { snapshotFavoritesOnly = !snapshotFavoritesOnly; snapshotPage = 1; }}
              data-testid="favorites-toggle-btn"
            >
              {snapshotFavoritesOnly ? 'Show All' : 'Favorites Only'}
            </button>
          </div>
          <div class="voices-search">
            <input
              type="text"
              class="search-input"
              placeholder="Search snapshots..."
              bind:value={snapshotSearch}
              data-testid="snapshot-search-input"
            />
          </div>
        </div>

        {#if snapshots.length === 0}
          <p class="muted">No snapshots yet. Snapshots are created automatically each time you save the config.</p>
        {:else}
          <DataTable
            columns={[
              { key: 'favorite', label: '\u2605', width: '44px' },
              { key: 'name', label: 'Name', sortable: true },
              { key: 'comments', label: 'Comments' },
              { key: 'created_at', label: 'Saved', sortable: true, width: '120px' },
              { key: 'actions', label: 'Actions', width: '120px' },
            ] as Column[]}
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
      {/if}
    </div>

  <!-- ═══ TAB: PRIMITIVES ═══ -->
  {:else if activeTab === 'primitives'}
    <PrimitivesPanel />

  <!-- ═══ TAB: ALGORITHM ═══ -->
  {:else if activeTab === 'algorithm'}
    <AlgorithmPanel {config} onsave={async (updated) => { config = updated; await saveConfig(); }} />
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

<!-- ═══ WORKSHOP MODAL ═══ -->
<Spotlight open={detailPanelOpen} onclose={closeDetailPanel}>
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
      <button class="close-btn" onclick={closeDetailPanel} data-testid="close-detail">&times;</button>
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
        <!-- ═══ STEP 1: Text Generation ═══ -->
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
                  onclick={() => {
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
                  }}
                  testid="new-generation-btn"
                >New Generation</Button>
              </div>
            </div>
          {/if}
        </div>

      {:else if activeStep === 2}
        <!-- ═══ STEP 2: Review & Edit ═══ -->
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
        <!-- ═══ STEP 3: Voice Assignment ═══ -->
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
                  {#if loadingStep3Voices}
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
                      {#if column.key === 'play'}
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
          <!-- Step 1 new character: Generate is the primary action -->
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
            onclick={closeDetailPanel}
            testid="wizard-complete-btn"
          >Complete</Button>
        {/if}
      </div>
    </div>
  </div>
</Spotlight>

<!-- ═══ CARD VIEWER ═══ -->
<CardViewer
  character={viewerCharacter}
  image={viewerCharacter?.avatar_url}
  onclose={() => viewerCharacter = null}
/>

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
    padding: var(--space-5) var(--space-7) var(--space-12);
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
    margin-bottom: var(--space-4);
    flex-shrink: 0;
  }

  .page-header h1 {
    font-family: var(--font-brand);
    font-size: var(--font-3xl);
    font-weight: 400;
    color: var(--color-pink);
    letter-spacing: 1px;
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

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

  .muted { color: var(--color-text-muted); }

  /* ─── Top Tabs ─── */
  .top-tabs {
    display: flex;
    gap: var(--space-0-5);
    margin-bottom: var(--space-4);
    flex-shrink: 0;
    background: rgba(10, 22, 42, 0.4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-1);
    max-width: 540px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .top-tab {
    flex: 1;
    padding: var(--space-2) var(--space-4);
    border: none;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-muted);
    font-family: inherit;
    font-size: var(--font-base);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-base);
    white-space: nowrap;
  }

  .top-tab:hover { color: var(--color-text-secondary); }

  .top-tab.active {
    background: var(--teal-a20);
    color: var(--color-teal);
  }

  /* ─── Toolbar ─── */
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: var(--space-2-5);
    margin-bottom: var(--space-3-5);
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

  /* ─── Workshop Modal ─── */
  .workshop-modal {
    background: var(--color-surface-raised);
    border: 1px solid var(--white-a12);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 14px;
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
    font-size: 1.25rem;
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

  .generate-prompt {
    text-align: center;
    padding: var(--space-8) var(--space-4);
  }

  .generate-prompt h3 {
    font-size: var(--font-xl);
    margin-bottom: var(--space-3);
  }

  .generate-prompt .muted {
    margin-bottom: var(--space-7);
    color: var(--color-text-secondary);
    font-size: var(--font-md);
  }

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
    font-size: var(--font-base);
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: var(--font-xs);
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
    transition: all 0.15s ease;
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
    transition: all 0.15s ease;
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

  .generate-prompt .rarity-buttons {
    justify-content: center;
    margin-bottom: var(--space-7);
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
    border-radius: 4px;
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
    font-size: 1rem;
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
    font-size: 0.9rem;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 2px;
    transition: color 0.12s;
  }

  .delete-btn:hover {
    color: var(--color-error);
  }

  /* ─── Config Tab ─── */
  .cfg {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .cfg-row-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-5);
  }

  .cfg-card {
    background: rgba(10, 22, 42, 0.5);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--white-a6);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow:
      inset 0 1px 0 var(--white-a3),
      0 1px 3px var(--black-a40),
      0 4px 12px var(--black-a20);
  }

  .cfg-header {
    padding: var(--space-5) var(--space-6) 0;
  }

  .cfg-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .cfg-title {
    font-size: var(--font-lg);
    font-weight: 700;
    color: var(--color-text-primary);
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

  .cfg-pair {
    display: flex;
    align-items: flex-end;
    gap: var(--space-6);
  }

  /* ─── Global Config ─── */
  .global-config-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  .global-config-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-6);
  }
  .global-config-label {
    min-width: 130px;
    font-weight: 600;
    font-size: var(--font-base);
    color: var(--color-text-primary);
    padding-bottom: var(--space-2);
  }
  .global-config-controls {
    display: flex;
    align-items: flex-end;
    gap: var(--space-4);
    flex: 1;
  }

  /* ─── Drop Rate Rows ─── */
  .drop-rate-row {
    display: flex;
    align-items: center;
    gap: var(--space-3-5);
    height: 36px;
  }

  .rarity-label {
    font-weight: 600;
    font-size: var(--font-base);
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
    font-size: var(--font-base);
    color: var(--color-text-muted);
    min-width: 52px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .json-editor {
    width: 100%;
    padding: var(--input-padding);
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: var(--input-radius);
    color: var(--color-text-primary);
    font-family: 'Courier New', monospace;
    font-size: var(--font-sm);
    resize: vertical;
    outline: none;
    transition: border-color var(--transition-base), background var(--transition-base);
    line-height: 1.5;
  }

  .json-editor:focus { border-color: var(--input-focus-border); background: var(--input-focus-bg); }

  .cfg-save {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  .error { color: var(--color-error); font-size: var(--font-sm); margin-top: var(--space-1); }


  @media (max-width: 800px) {
    .cfg-row-2col { grid-template-columns: 1fr; }
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

  /* ─── Step 2: Image ─── */
  .prompt-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .info-label {
    font-size: var(--font-xs);
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-muted);
    letter-spacing: 0.05em;
  }

  .info-value {
    font-size: var(--font-base);
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
    margin: var(--space-2) auto;
    border: 1px dashed var(--glass-border);
    border-radius: var(--radius-lg);
    color: var(--color-text-muted);
    font-size: var(--font-sm);
  }

  /* ─── Step 3: Voice ─── */
  .voice-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .voice-label {
    font-size: var(--font-md);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

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

  .voice-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }

  .step3-toolbar {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .step3-toolbar .search-input {
    flex: 1;
  }

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
    background: rgba(10, 22, 42, 0.5);
    border: 1px solid rgba(255, 80, 80, 0.15);
    border-radius: var(--radius-xl);
  }

  .deleted-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }

  .deleted-header h3 {
    font-size: var(--font-md);
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .deleted-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
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

  /* ─── View Card Button ─── */
  .view-card-btn {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 2px;
    transition: color 0.12s;
  }

  .view-card-btn:hover {
    color: var(--color-teal);
  }

  /* ─── Voices Tab ─── */
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
    gap: 16px;
    margin-bottom: 14px;
    flex-shrink: 0;
  }

  .voices-toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .celebrity-toggle {
    padding: var(--space-1-5) var(--space-3-5);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-glass-border);
    background: var(--color-glass-bg);
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
    background: rgba(var(--color-teal-rgb, 0, 209, 178), 0.12);
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
    padding: 48px 24px;
    text-align: center;
    color: var(--color-text-secondary);
  }

  .voice-tag-filter {
    margin-bottom: 14px;
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
    font-size: 0.875rem;
  }

  .tag-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
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

  /* ─── Sub-tabs ─── */
  .sub-tabs {
    display: flex;
    gap: var(--space-0-5);
    margin-bottom: var(--space-3-5);
    flex-shrink: 0;
    background: rgba(10, 22, 42, 0.3);
    border: 1px solid var(--white-a5);
    border-radius: var(--radius-md);
    padding: var(--space-0-5);
    max-width: 280px;
  }

  .sub-tab {
    flex: 1;
    padding: 7px var(--space-4);
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
    gap: 16px;
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
    background: rgba(10, 22, 42, 0.5);
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
    background: #0a162a;
    color: var(--color-text-primary);
    padding: 8px;
  }

  .gen-voice-hint {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .voice-pin-checkbox {
    width: 16px;
    height: 16px;
    accent-color: var(--color-teal);
    cursor: pointer;
  }

  .gen-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .gen-preset-btn {
    padding: 5px var(--space-3);
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
    margin-bottom: 8px;
  }

  .gen-tag-label {
    display: block;
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-bottom: 5px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .gen-tag-btns {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
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
    gap: 12px 20px;
    margin: 14px 0;
  }

  .gen-slider label {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-md);
    color: var(--color-text-secondary);
    margin-bottom: 4px;
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
    gap: 8px;
    align-items: center;
  }

  /* ─── Reference Card ─── */
  .gen-ref-body {
    font-size: 0.875rem;
    color: var(--color-text-primary);
  }

  .gen-ref-section {
    margin-bottom: 14px;
  }

  .gen-ref-section:last-child { margin-bottom: 0; }

  .gen-ref-section h4 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 6px;
  }

  .gen-ref-code {
    display: block;
    padding: var(--space-1-5) var(--space-2-5);
    background: var(--white-a4);
    border-radius: var(--radius-sm);
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    color: var(--color-teal);
    margin-bottom: 4px;
  }

  .gen-ref-list {
    margin: 0;
    padding-left: 18px;
    line-height: 1.7;
    font-size: 0.875rem;
  }

  .gen-ref-list code {
    background: var(--white-a4);
    padding: var(--space-0-5) 5px;
    border-radius: var(--radius-xs);
    font-family: 'Courier New', monospace;
    font-size: 0.8125rem;
    color: var(--color-teal);
  }

  .gen-ref-all-tags {
    font-size: 0.8125rem;
    line-height: 1.6;
    color: var(--color-text-muted);
    margin-bottom: 6px;
  }

  .gen-ref-cat {
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  @media (max-width: 900px) {
    .gen-layout { grid-template-columns: 1fr; }
  }

  /* ─── Token Pools ─── */
  .test-roll-result {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-2) 0;
  }

  .roll-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    background: var(--teal-a20);
    border: 1px solid var(--color-teal);
    border-radius: var(--radius-full);
    padding: var(--space-1) var(--space-3);
    font-size: var(--font-sm);
  }

  .roll-badge-label {
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .roll-badge-value {
    color: var(--color-teal);
    font-weight: 700;
  }

  .pool-section {
    border: 1px solid var(--white-a6);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .pool-header {
    display: flex;
    align-items: center;
    gap: var(--space-2-5);
    width: 100%;
    padding: var(--space-3) var(--space-4);
    background: rgba(10, 22, 42, 0.3);
    border: none;
    color: var(--color-text-primary);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-base);
    text-align: left;
    transition: background var(--transition-base);
  }

  .pool-header:hover {
    background: rgba(10, 22, 42, 0.5);
  }

  .pool-chevron {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }

  .pool-chevron.expanded {
    transform: rotate(90deg);
  }

  .pool-label {
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .pool-count {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    margin-left: auto;
  }

  .pool-conditional-badge {
    font-size: var(--font-xs);
    background: var(--teal-a12);
    color: var(--color-teal);
    border: 1px solid var(--teal-a30);
    border-radius: var(--radius-pill);
    padding: 2px var(--space-2);
    white-space: nowrap;
    font-weight: 500;
  }

  .pool-entries {
    padding: var(--space-3) var(--space-4) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border-top: 1px solid var(--white-a6);
  }

  .pool-description {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    margin: 0 0 var(--space-1);
  }

  .pool-entry-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .pool-entry-value {
    flex: 1;
    min-width: 120px;
    max-width: 220px;
    padding: var(--space-1-5) var(--space-2-5);
    border: 1px solid var(--input-border);
    border-radius: var(--input-radius);
    background: var(--input-bg);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--font-sm);
  }

  .pool-entry-value:focus {
    outline: none;
    border-color: var(--color-teal);
  }

  .pool-entry-slider {
    flex: 1;
    max-width: 200px;
    cursor: pointer;
    accent-color: var(--color-teal);
  }

  .pool-entry-weight {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    min-width: 24px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .pool-entry-percent {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    min-width: 44px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .pool-entry-remove {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: var(--font-lg);
    cursor: pointer;
    padding: 0 var(--space-1);
    line-height: 1;
    transition: color var(--transition-base);
  }

  .pool-entry-remove:hover {
    color: var(--color-destructive, #ef4444);
  }

  .pool-add-entry {
    align-self: flex-start;
    background: none;
    border: 1px dashed var(--white-a6);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    padding: var(--space-1-5) var(--space-3);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-sm);
    transition: all var(--transition-base);
  }

  .pool-add-entry:hover {
    border-color: var(--color-teal);
    color: var(--color-teal);
  }

  /* Prompt Assembly Preview */
  .prompt-flow {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .prompt-section-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-3);
    background: rgba(255, 255, 255, 0.03);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--transition-base, 0.15s ease);
    text-align: left;
  }
  .prompt-section-header:hover {
    background: rgba(255, 255, 255, 0.06);
  }
  .prompt-section-header--preview {
    background: rgba(45, 212, 191, 0.06);
  }
  .prompt-section-header--preview:hover {
    background: rgba(45, 212, 191, 0.1);
  }
  .prompt-chevron {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }
  .prompt-chevron.expanded {
    transform: rotate(90deg);
  }
  .prompt-section-badge {
    font-size: var(--font-sm);
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .prompt-section-badge.system { background: rgba(99, 179, 237, 0.15); color: #63b3ed; }
  .prompt-section-badge.user { background: rgba(72, 187, 120, 0.15); color: #48bb78; }
  .prompt-section-badge.params { background: rgba(237, 137, 54, 0.15); color: #ed8936; }
  .prompt-section-badge.preview { background: rgba(45, 212, 191, 0.15); color: var(--color-teal); }
  .prompt-section-title {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }
  .prompt-section-hint {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    margin-left: auto;
  }
  .prompt-section-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3);
    padding-top: 0;
  }
  .prompt-text-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .prompt-text-block[data-border="db"] { border-left: 3px solid #63b3ed; padding-left: var(--space-3); }
  .prompt-text-block[data-border="config"] { border-left: 3px solid var(--color-teal); padding-left: var(--space-3); }
  .prompt-text-block[data-border="auto"] { border-left: 3px solid #b794f4; padding-left: var(--space-3); }
  .prompt-text-block[data-border="runtime"] { border-left: 3px solid #48bb78; padding-left: var(--space-3); }
  .prompt-text-block[data-border="system-full"] { border-left: 3px solid #63b3ed; padding-left: var(--space-3); }
  .prompt-text-block[data-border="user-full"] { border-left: 3px solid #48bb78; padding-left: var(--space-3); }
  .prompt-text-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }
  .prompt-source-tag {
    font-size: var(--font-xs);
    font-weight: 600;
    letter-spacing: 0.03em;
    padding: 2px var(--space-2);
    border-radius: 3px;
    text-transform: uppercase;
  }
  .prompt-source-tag.db { background: rgba(99, 179, 237, 0.12); color: #63b3ed; }
  .prompt-source-tag.config { background: rgba(45, 212, 191, 0.12); color: var(--color-teal); }
  .prompt-source-tag.auto { background: rgba(183, 148, 244, 0.12); color: #b794f4; }
  .prompt-source-tag.runtime { background: rgba(72, 187, 120, 0.12); color: #48bb78; }
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
    max-height: 200px;
    overflow-y: auto;
  }
  .prompt-text-box--tall {
    max-height: 300px;
  }
  .prompt-text-italic {
    font-style: italic;
    color: var(--color-text-secondary);
  }
  .prompt-trait-pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin-top: var(--space-1);
  }
  .prompt-trait-pill {
    font-size: var(--font-sm);
    font-family: var(--font-mono, monospace);
    color: #b794f4;
    background: rgba(183, 148, 244, 0.1);
    padding: var(--space-1) var(--space-2);
    border-radius: 999px;
  }
  .prompt-flow-divider {
    height: 1px;
    background: var(--white-a6);
    margin: var(--space-1) 0;
  }
  .prompt-params {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .prompt-param {
    font-size: var(--font-base);
    font-family: var(--font-mono, monospace);
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.04);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    border: 1px solid var(--white-a6);
  }
  .prompt-preview-character {
    font-size: var(--font-base);
    color: var(--color-text-secondary);
    padding: var(--space-2) var(--space-3);
    background: rgba(45, 212, 191, 0.06);
    border-radius: var(--radius-sm);
  }
  .prompt-preview-character strong {
    color: var(--color-teal);
  }
  .prompt-preview-params {
    font-size: var(--font-base);
    font-family: var(--font-mono, monospace);
    color: var(--color-text-primary);
    padding: var(--space-2) var(--space-3);
    background: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-sm);
  }

  /* ─── Config History ──────────────────────────────────────────── */
  .history-tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    flex: 1;
    min-height: 0;
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
  .snapshot-preview {
    background: var(--color-surface-raised);
    border: 1px solid var(--white-a12);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 14px;
    width: min(960px, 94vw);
    max-height: min(88vh, 920px);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-5);
    box-shadow: 0 0 60px var(--teal-a5), 0 8px 32px var(--black-a40);
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
</style>
