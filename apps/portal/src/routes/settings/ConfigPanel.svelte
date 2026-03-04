<script lang="ts">
  import { SliderInput } from '@glazebot/shared-ui';
  import Button from '$lib/components/ui/Button.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import NumberInput from '$lib/components/ui/NumberInput.svelte';
  import TextArea from '$lib/components/ui/TextArea.svelte';
  import TextInput from '$lib/components/ui/TextInput.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  // ─── Props ──────────────────────────────────────────────────────────
  interface Props {
    config: Record<string, unknown>;
    loading: boolean;
    onsave: (config: Record<string, unknown>) => Promise<void>;
  }

  let { config = $bindable(), loading, onsave }: Props = $props();

  // ─── Types ──────────────────────────────────────────────────────────
  interface TokenPoolEntry { value: string; weight: number; }
  interface TokenPool {
    label: string;
    description: string;
    entries: TokenPoolEntry[];
    conditionalOn?: { pool: string; values: string[]; };
  }

  // ─── Constants: Provider / Model Options ────────────────────────────
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

  // ─── Constants: Defaults ────────────────────────────────────────────
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

  // ─── Constants: Prompt Preview ──────────────────────────────────────
  const PREVIEW_CHARACTER = {
    name: 'Pixel Pete',
    system_prompt: 'You are Pixel Pete, a retro gaming enthusiast who speaks like a 90s arcade announcer. You get genuinely excited about pixel-perfect plays and tilted by sloppy movement. Your vibe is nostalgic but sharp.',
    personality: { energy: 78, positivity: 55, formality: 20, talkativeness: 62, attitude: 65, humor: 72 } as Record<string, number>,
  };

  const PREVIEW_TRAIT_LABELS: Record<string, [string, string]> = {
    energy: ['very calm and low-energy', 'very high-energy and hyped up'],
    positivity: ['cynical and pessimistic', 'optimistic and upbeat'],
    formality: ['very casual and informal', 'very formal and proper'],
    talkativeness: ['terse and brief', 'chatty and verbose'],
    attitude: ['hostile and aggressive', 'friendly and warm'],
    humor: ['dead serious', 'silly and goofy'],
  };

  // ─── Local State ────────────────────────────────────────────────────
  let model = $state('qwen-plus');
  let baseTemperature = $state(0.9);
  let generationPrompt = $state('');
  let imageSystemInfo = $state('facing south, sitting at a table, 128x128 pixel art sprite, no background');
  let imageProvider = $state<'pixellab' | 'gemini'>('pixellab');
  let imageModel = $state('gemini-3.1-flash-image-preview');
  let imageSize = $state('1K');

  let cardGenProvider = $state('dashscope');
  let cardGenModel = $state('qwen-plus');

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

  let contextProvider = $state('dashscope');
  let contextModel = $state('qwen3-vl-flash');
  let contextPrompt = $state('Describe what is happening on screen in 1-2 sentences. Focus on the game state, player actions, and any notable events.');
  let contextMaxTokens = $state(100);
  let contextInterval = $state(3);
  let contextBufferSize = $state(10);

  let tokenPools: Record<string, TokenPool> = $state({});
  let expandedPools: Set<string> = $state(new Set());
  let testRollResult: Record<string, string> | null = $state(null);

  let rawJson: string = $state('');
  let jsonError: string = $state('');

  let saving: boolean = $state(false);

  // ─── Prompt Preview State ──────────────────────────────────────────
  let expandedPromptSections: Set<string> = $state(new Set());

  function togglePromptSection(key: string) {
    const next = new Set(expandedPromptSections);
    if (next.has(key)) next.delete(key); else next.add(key);
    expandedPromptSections = next;
  }

  // ─── Derived: Model Option Lists ───────────────────────────────────
  let activeCardGenModels = $derived(cardGenModelOptions[cardGenProvider] ?? []);
  let activeCommentaryModels = $derived(commentaryModelOptions[commentaryVisionProvider] ?? []);
  let activeContextModels = $derived(contextModelOptions[contextProvider] ?? []);

  // ─── Derived: Prompt Preview ───────────────────────────────────────
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

  // ─── Provider Change Handlers ──────────────────────────────────────
  function onCardGenProviderChange() {
    const models = cardGenModelOptions[cardGenProvider];
    if (models?.length) cardGenModel = models[0].value;
    syncToConfig();
  }

  function onCommentaryProviderChange() {
    const models = commentaryModelOptions[commentaryVisionProvider];
    if (models?.length) commentaryVisionModel = models[0].value;
    syncToConfig();
  }

  function onContextProviderChange() {
    const models = contextModelOptions[contextProvider];
    if (models?.length) contextModel = models[0].value;
    syncToConfig();
  }

  // ─── Token Pool Helpers ────────────────────────────────────────────
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

  // ─── Sync: Config <-> Local State ─────────────────────────────────
  function syncFromConfig() {
    baseTemperature = (config.baseTemperature as number) ?? 0.9;
    model = (config.model as string) ?? 'qwen-plus';
    cardGenProvider = (config.cardGenProvider as string) ?? 'dashscope';
    cardGenModel = (config.cardGenModel as string) ?? model;
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
    rawJson = JSON.stringify(config, null, 2);
  }

  function syncToConfig() {
    // Preserve algorithm fields (blockWeights, blockPrompts, memory) that
    // are managed by AlgorithmPanel -- they live inside commentary but have
    // no standalone state vars on this page.
    const existingCommentary = (config.commentary as Record<string, unknown>) ?? {};
    config = {
      ...config,
      baseTemperature,
      model: cardGenModel,
      cardGenProvider,
      cardGenModel,
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

  // ─── JSON Editor ──────────────────────────────────────────────────
  function onJsonEdit() {
    jsonError = '';
    try {
      config = JSON.parse(rawJson);
      syncFromConfig();
    } catch (e) {
      jsonError = e instanceof Error ? e.message : 'Invalid JSON';
    }
  }

  // ─── Save ─────────────────────────────────────────────────────────
  async function handleSave() {
    saving = true;
    try {
      syncToConfig();
      await onsave(config);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      saving = false;
    }
  }

  // ─── Initialize from config on mount ──────────────────────────────
  $effect(() => {
    if (!loading && config) {
      syncFromConfig();
    }
  });
</script>

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
                  { value: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image (Nano Banana 2)' },
                  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (Nano Banana Pro)' },
                  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
                ]}
                onchange={() => { syncToConfig(); rawJson = JSON.stringify(config, null, 2); }}
                testid="config-image-model"
              />
              <Select
                label="Resolution"
                bind:value={imageSize}
                options={[
                  { value: '512px', label: '512px' },
                  { value: '1K', label: '1K (1024px)' },
                  { value: '2K', label: '2K (2048px)' },
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
          <p class="cfg-desc">One per line -- a random nudge is picked each call for variety</p>
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
        <p class="cfg-desc">Click each section to see exactly what the LLM receives -- edits above update the preview in real time</p>
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
        <p class="cfg-desc">Direct JSON editing -- changes here override the fields above</p>
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
      <Button variant="primary" loading={saving} disabled={!!jsonError} onclick={handleSave} testid="save-config-btn">
        {saving ? 'Saving...' : 'Save Config'}
      </Button>
    </div>
  </div>
{/if}

<style>
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
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--panel-shadow);
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

  /* ─── JSON Editor ─── */
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

  /* ─── Test Roll ─── */
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

  /* ─── Token Pools ─── */
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
    background: var(--color-deep-bg);
    border: none;
    color: var(--color-text-primary);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-base);
    text-align: left;
    transition: background var(--transition-base);
  }

  .pool-header:hover {
    background: var(--color-deep-bg);
    filter: brightness(1.2);
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

  /* ─── Prompt Assembly Preview ─── */
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
    background: var(--white-a3);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--transition-base, 0.15s ease);
    text-align: left;
  }
  .prompt-section-header:hover {
    background: var(--white-a6);
  }
  .prompt-section-header--preview {
    background: var(--teal-a5);
  }
  .prompt-section-header--preview:hover {
    background: var(--teal-a10);
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
  .prompt-section-badge.system { background: rgba(99, 179, 237, 0.15); color: var(--color-prompt-db); }
  .prompt-section-badge.user { background: rgba(72, 187, 120, 0.15); color: var(--color-prompt-runtime); }
  .prompt-section-badge.params { background: rgba(237, 137, 54, 0.15); color: var(--color-prompt-params); }
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
  .prompt-text-block[data-border="db"] { border-left: 3px solid var(--color-prompt-db); padding-left: var(--space-3); }
  .prompt-text-block[data-border="config"] { border-left: 3px solid var(--color-teal); padding-left: var(--space-3); }
  .prompt-text-block[data-border="auto"] { border-left: 3px solid var(--color-prompt-auto); padding-left: var(--space-3); }
  .prompt-text-block[data-border="runtime"] { border-left: 3px solid var(--color-prompt-runtime); padding-left: var(--space-3); }
  .prompt-text-block[data-border="system-full"] { border-left: 3px solid var(--color-prompt-db); padding-left: var(--space-3); }
  .prompt-text-block[data-border="user-full"] { border-left: 3px solid var(--color-prompt-runtime); padding-left: var(--space-3); }
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
  .prompt-source-tag.db { background: rgba(99, 179, 237, 0.12); color: var(--color-prompt-db); }
  .prompt-source-tag.config { background: rgba(45, 212, 191, 0.12); color: var(--color-teal); }
  .prompt-source-tag.auto { background: rgba(183, 148, 244, 0.12); color: var(--color-prompt-auto); }
  .prompt-source-tag.runtime { background: rgba(72, 187, 120, 0.12); color: var(--color-prompt-runtime); }
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
    color: var(--color-prompt-auto);
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
    background: var(--white-a4);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    border: 1px solid var(--white-a6);
  }
  .prompt-preview-character {
    font-size: var(--font-base);
    color: var(--color-text-secondary);
    padding: var(--space-2) var(--space-3);
    background: var(--teal-a5);
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
    background: var(--white-a3);
    border-radius: var(--radius-sm);
  }
</style>
