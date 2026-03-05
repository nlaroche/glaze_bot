/** Default topic weights used when a character has no custom assignments */
export const DEFAULT_TOPIC_WEIGHTS: Record<string, number> = {
  solo_observation: 25,
  emotional_reaction: 20,
  question: 12,
  backstory_reference: 8,
  quip_banter: 4,
  callback: 5,
  hype_chain: 2,
  encouragement: 6,
  hot_take: 5,
  tangent: 4,
  silence: 10,
};

/** Human-readable labels for built-in topic types */
export const TOPIC_LABELS: Record<string, string> = {
  solo_observation: "Observation",
  emotional_reaction: "Emotional Reaction",
  question: "Question",
  backstory_reference: "Backstory",
  quip_banter: "Banter",
  callback: "Callback",
  hype_chain: "Hype Chain",
  encouragement: "Encouragement",
  hot_take: "Hot Take",
  tangent: "Tangent",
  silence: "Silence",
  conspiracy_theory: "Conspiracy Theory",
  roast_the_game: "Roast the Game",
  lore_drop: "Lore Drop",
  existential_crisis: "Existential Crisis",
  power_ranking: "Power Ranking",
};

/** Short descriptions for each topic type */
export const TOPIC_DESCRIPTIONS: Record<string, string> = {
  solo_observation: "Reacts to something specific on screen",
  emotional_reaction: "Pure emotional response to what's happening",
  question: "Asks the player or wonders aloud",
  backstory_reference: "Connects the moment to their backstory",
  quip_banter: "Two characters exchange lines back and forth",
  callback: "References something from earlier in the session",
  hype_chain: "Multiple characters react to the same moment",
  encouragement: "Emotional support and hype for the player",
  hot_take: "Bold, opinionated statement",
  tangent: "Personality-driven off-topic riff",
  silence: "Intentional quiet moment",
  conspiracy_theory: "Connects unrelated things on screen",
  roast_the_game: "Critiques a design choice or UI element",
  lore_drop: "Invents fake lore about something on screen",
  existential_crisis: "Brief existential reflection from mundane trigger",
  power_ranking: "Ranks or tier-lists something on screen",
};

/** Optional icons for each topic type (only used if user opts in to emoji display) */
export const TOPIC_ICONS: Record<string, string> = {
  solo_observation: "\u{1F441}",
  emotional_reaction: "\u{1F4A5}",
  question: "\u{2753}",
  backstory_reference: "\u{1F4D6}",
  quip_banter: "\u{1F4AC}",
  callback: "\u{1F519}",
  hype_chain: "\u{1F525}",
  encouragement: "\u{1F44F}",
  hot_take: "\u{1F321}",
  tangent: "\u{1F300}",
  silence: "\u{1F910}",
  conspiracy_theory: "\u{1F50D}",
  roast_the_game: "\u{1F525}",
  lore_drop: "\u{1F4DC}",
  existential_crisis: "\u{1F914}",
  power_ranking: "\u{1F3C6}",
};
