<script lang="ts">
  import {
    getGachaConfig,
    updateGachaConfig,
    getAllCharacters,
    syncFishVoices,
    getFishVoices,
    getVoiceUsageMap,
    saveConfigSnapshot,
  } from '@glazebot/supabase-client';
  import type { FishVoice, TokenPools as TokenPoolsType } from '@glazebot/supabase-client';
  import type { GachaCharacter } from '@glazebot/shared-types';
  import { toast } from '$lib/stores/toast.svelte';

  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
  import PrimitivesPanel from './PrimitivesPanel.svelte';
  import EconomyPanel from './EconomyPanel.svelte';
  import HistoryPanel from './HistoryPanel.svelte';
  import VoicesPanel from './VoicesPanel.svelte';
  import ConfigPanel from './ConfigPanel.svelte';
  import WorkshopPanel from './WorkshopPanel.svelte';
  import AnimationsPanel from './AnimationsPanel.svelte';
  import TopicsPanel from './TopicsPanel.svelte';

  // ─── Types ──────────────────────────────────────────────────────────
  interface TokenPoolEntry { value: string; weight: number; }
  interface TokenPool {
    label: string;
    description: string;
    entries: TokenPoolEntry[];
    conditionalOn?: { pool: string; values: string[]; };
  }

  // ─── State: Data ──────────────────────────────────────────────────
  let characters: GachaCharacter[] = $state([]);
  let loadingData = $state(true);

  // ─── State: Panels ────────────────────────────────────────────────
  type AdminTab = 'config' | 'economy' | 'workshop' | 'voices' | 'history' | 'primitives' | 'topics' | 'animations';
  const validTabs: AdminTab[] = ['config', 'economy', 'workshop', 'voices', 'history', 'primitives', 'topics', 'animations'];
  const storedTab = (typeof localStorage !== 'undefined' ? localStorage.getItem('admin-active-tab') : null) as AdminTab | null;
  let activeTab: AdminTab = $state(storedTab && validTabs.includes(storedTab) ? storedTab : 'config');

  // ─── State: Config ────────────────────────────────────────────────
  let config: Record<string, unknown> = $state({});
  let rawJson: string = $state('');
  let loading: boolean = $state(true);
  let saving: boolean = $state(false);

  let model = $state('qwen-plus');
  let baseTemperature = $state(0.9);
  let packsPerDay = $state(3);
  let cardsPerPack = $state(3);
  let generationPrompt = $state('');
  let imageSystemInfo = $state('facing south, sitting at a table, 128x128 pixel art sprite, no background');
  let imageProvider = $state<'pixellab' | 'gemini'>('pixellab');
  let imageModel = $state('gemini-3.1-flash-image-preview');
  let imageSize = $state('1K');
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

  // ─── State: Token Pools ───────────────────────────────────────────
  let tokenPools: Record<string, TokenPool> = $state({});

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

  // Model options lookup (used in syncFromConfig for default model values)
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

  // ─── State: Fish Voices ────────────────────────────────────────────
  let fishVoices: FishVoice[] = $state([]);
  let loadingVoices = $state(false);
  let syncingVoices = $state(false);
  let voicesLoaded = $state(false);

  // Voice usage map (voice_id -> characters)
  let voiceUsageMap: Map<string, { id: string; name: string }[]> = $state(new Map());

  // ─── State: Confirm Dialog ────────────────────────────────────────
  interface ConfirmOpts {
    title: string;
    message: string;
    label: string;
    variant: 'destructive' | 'primary';
    action: () => Promise<void>;
  }
  let confirmOpts: ConfirmOpts | null = $state(null);
  let confirmOpen = $derived(confirmOpts !== null);

  // ─── Lifecycle ────────────────────────────────────────────────────
  let mounted = false;
  $effect(() => {
    if (!mounted) {
      mounted = true;
      loadConfig();
      loadCharacters();
    }
  });

  $effect(() => {
    if (activeTab === 'voices') { loadFishVoices(); loadVoiceUsageMap(); }
  });

  // Persist active tab to localStorage
  $effect(() => {
    localStorage.setItem('admin-active-tab', activeTab);
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
    cardGenProvider = (config.cardGenProvider as string) ?? 'dashscope';
    cardGenModel = (config.cardGenModel as string) ?? model;
    packsPerDay = (config.packsPerDay as number) ?? 3;
    cardsPerPack = (config.cardsPerPack as number) ?? 3;
    generationPrompt = (config.generationPrompt as string) ?? '';
    imageSystemInfo = (config.imageSystemInfo as string) ?? 'facing south, sitting at a table, 128x128 pixel art sprite, no background';
    imageProvider = ((config.imageProvider as string) ?? 'pixellab') as 'pixellab' | 'gemini';
    imageModel = (config.imageModel as string) ?? 'gemini-3.1-flash-image-preview';
    const imgCfg = config.imageConfig as Record<string, string> | undefined;
    imageSize = imgCfg?.imageSize ?? '1K';
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
    // Preserve algorithm fields (topicWeights, topicPrompts, topicAffinities, memory) that
    // are managed by AlgorithmPanel — they live inside commentary but have
    // no standalone state vars on this page.
    // Remove old blockWeights/blockPrompts keys if present (migrated to topicWeights/topicPrompts)
    const existingCommentary = (config.commentary as Record<string, unknown>) ?? {};
    // Migrate old blockWeights/blockPrompts → topicWeights/topicPrompts
    if ('blockWeights' in existingCommentary && !('topicWeights' in existingCommentary)) {
      existingCommentary.topicWeights = existingCommentary.blockWeights;
    }
    if ('blockPrompts' in existingCommentary && !('topicPrompts' in existingCommentary)) {
      existingCommentary.topicPrompts = existingCommentary.blockPrompts;
    }
    delete existingCommentary.blockWeights;
    delete existingCommentary.blockPrompts;
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

  async function saveConfig() {
    saving = true;
    try {
      // Sync page-level state FROM config first — child panels (ConfigPanel,
      // EconomyPanel, etc.) may have already updated `config` via bind:config
      // or onsave. Without this, syncToConfig() would overwrite their changes
      // with stale page-level state.
      syncFromConfig();
      syncToConfig();
      await updateGachaConfig(config);
      toast.success('Config saved');
      // Fire-and-forget snapshot
      saveConfigSnapshot(JSON.parse(JSON.stringify(config)), undefined, undefined, true).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      saving = false;
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

  async function loadVoiceUsageMap() {
    try {
      voiceUsageMap = await getVoiceUsageMap();
    } catch (e) {
      console.error('Failed to load voice usage map:', e);
    }
  }
</script>

<div class="admin-page" class:scrollable={activeTab !== 'workshop' && activeTab !== 'voices'} data-testid="settings-page">
  <!-- HEADER -->
  <div class="page-header">
    <h1>Admin</h1>
    <div class="header-actions"></div>
  </div>

  <!-- TABS -->
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
      onclick={() => activeTab = 'history'}
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
      class:active={activeTab === 'topics'}
      onclick={() => activeTab = 'topics'}
      data-testid="tab-topics"
    >Topics</button>
    <button
      class="top-tab"
      class:active={activeTab === 'animations'}
      onclick={() => activeTab = 'animations'}
      data-testid="tab-animations"
    >Animations</button>
  </div>

  <!-- TAB: WORKSHOP -->
  {#if activeTab === 'workshop'}
    <WorkshopPanel
      bind:characters
      {loadingData}
      {tokenPools}
      bind:fishVoices
      bind:voiceUsageMap
      {imageProvider}
      {imageModel}
      {imageSize}
      {imageSystemInfo}
      oncharacterschanged={loadCharacters}
      onconfirm={(opts) => {
        confirmOpts = { title: opts.title, message: opts.message, label: opts.label, variant: opts.variant, action: opts.action };
      }}
    />

  <!-- TAB: CARD GENERATION -->
  {:else if activeTab === 'config'}
    <ConfigPanel bind:config {loading} onsave={saveConfig} />

  <!-- TAB: GACHA ECONOMY -->
  {:else if activeTab === 'economy'}
    <EconomyPanel {config} {loading} onsave={saveConfig} />

  <!-- TAB: VOICES -->
  {:else if activeTab === 'voices'}
    <VoicesPanel
      {fishVoices}
      {voiceUsageMap}
      {loadingVoices}
      onsync={async (pageCount) => {
        syncingVoices = true;
        try {
          await syncFishVoices({ page_count: pageCount });
          fishVoices = await getFishVoices();
          voicesLoaded = true;
        } catch (e) {
          console.error('Failed to sync voices:', e);
        } finally {
          syncingVoices = false;
        }
      }}
      onreload={async () => {
        fishVoices = await getFishVoices();
        voicesLoaded = true;
      }}
    />

  <!-- TAB: HISTORY -->
  {:else if activeTab === 'history'}
    <HistoryPanel
      {config}
      onapply={async (cfg) => {
        config = structuredClone(cfg);
        rawJson = JSON.stringify(config, null, 2);
        syncFromConfig();
        activeTab = 'config';
        await saveConfig();
      }}
      onconfirm={(opts) => {
        confirmOpts = { title: opts.title, message: opts.message, label: opts.label, variant: opts.variant, action: opts.action };
      }}
    />

  <!-- TAB: PRIMITIVES -->
  {:else if activeTab === 'primitives'}
    <PrimitivesPanel
      animationSpeed={(config as any)?.commentary?.visuals?.animationSpeed ?? 1.0}
      strokeWidth={(config as any)?.commentary?.visuals?.strokeWidth ?? 3}
      dropShadow={(config as any)?.commentary?.visuals?.dropShadow ?? true}
    />

  <!-- TAB: TOPICS -->
  {:else if activeTab === 'topics'}
    <TopicsPanel {config} {characters} {loadingData} onsave={async (updated) => { config = updated; await saveConfig(); }} />

  {:else if activeTab === 'animations'}
    <AnimationsPanel {config} onsave={async (updated) => { config = updated; await saveConfig(); }} />
  {/if}
</div>


<!-- CONFIRM DIALOG -->
<ConfirmDialog
  open={confirmOpen}
  title={confirmOpts?.title ?? ''}
  message={confirmOpts?.message ?? ''}
  confirmLabel={confirmOpts?.label ?? 'Confirm'}
  variant={confirmOpts?.variant ?? 'destructive'}
  onconfirm={async () => {
    const action = confirmOpts?.action;
    confirmOpts = null;
    if (action) {
      try { await action(); } catch (e) { console.error('Confirm action error:', e); }
    }
  }}
  oncancel={() => confirmOpts = null}
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
    font-size: var(--font-4xl);
    font-weight: 700;
    color: var(--color-heading);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  /* Top Tabs */
  .top-tabs {
    display: flex;
    gap: var(--space-0-5);
    margin-bottom: var(--space-4);
    flex-shrink: 0;
    background: rgba(10, 22, 42, 0.4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-1);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .top-tab {
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
</style>
