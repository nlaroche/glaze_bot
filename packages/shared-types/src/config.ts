// ─── Animation Feel System ──────────────────────────────────────────
// One global "feel" that defines HOW things move — anticipation, overshoot,
// squash & stretch that make animations juicy. The motion itself (enter
// from left, scale in, land, etc.) is chosen at runtime by the component.
// Tweak 5 sliders, apply everywhere.

export interface AnimationsConfig {
  anticipation: number;   // 0–1: wind-up before launching
  overshoot: number;      // 0–1: flies past the target before settling
  bounciness: number;     // 0–1: how many settle oscillations
  squishiness: number;    // 0–1: squash on impact, stretch during travel
  speed: number;          // base duration in ms (100–2000)
}

// ── Juicy defaults — playful and game-like out of the box ──
export const DEFAULT_ANIMATIONS: AnimationsConfig = {
  anticipation: 0.35,
  overshoot: 0.5,
  bounciness: 0.45,
  squishiness: 0.4,
  speed: 500,
};

// ── Motion types that components can use ──
export const MOTION_TYPES = [
  { key: 'enter-left',   label: 'Enter Left',   desc: 'Slide in from the left' },
  { key: 'enter-right',  label: 'Enter Right',  desc: 'Slide in from the right' },
  { key: 'enter-top',    label: 'Enter Top',     desc: 'Slide in from above' },
  { key: 'enter-bottom', label: 'Enter Bottom',  desc: 'Slide in from below' },
  { key: 'scale-in',     label: 'Scale In',      desc: 'Grow from nothing' },
  { key: 'pop',          label: 'Pop',            desc: 'Punch in with scale' },
  { key: 'land',         label: 'Land',           desc: 'Drop from above, heavy impact' },
] as const;

export type MotionType = typeof MOTION_TYPES[number]['key'];

// ── Quick-set starting points for the sliders ──
export const FEEL_PRESETS: { id: string; name: string; desc: string; values: AnimationsConfig }[] = [
  { id: 'snappy',   name: 'Snappy',   desc: 'Quick, crisp micro-interactions',     values: { anticipation: 0.15, overshoot: 0.3,  bounciness: 0.2,  squishiness: 0.15, speed: 280 } },
  { id: 'bouncy',   name: 'Bouncy',   desc: 'Playful spring, cards & notifications', values: { anticipation: 0.3,  overshoot: 0.55, bounciness: 0.6,  squishiness: 0.4,  speed: 500 } },
  { id: 'elastic',  name: 'Elastic',  desc: 'Rubber-band snap, game elements',     values: { anticipation: 0.4,  overshoot: 0.8,  bounciness: 0.5,  squishiness: 0.7,  speed: 550 } },
  { id: 'heavy',    name: 'Heavy',    desc: 'Weighty slam, drops & impacts',       values: { anticipation: 0.6,  overshoot: 0.2,  bounciness: 0.3,  squishiness: 0.85, speed: 650 } },
  { id: 'smooth',   name: 'Smooth',   desc: 'Clean easing, no personality',        values: { anticipation: 0.0,  overshoot: 0.0,  bounciness: 0.0,  squishiness: 0.0,  speed: 400 } },
  { id: 'dramatic', name: 'Dramatic', desc: 'Big theatrical reveals',              values: { anticipation: 0.7,  overshoot: 0.7,  bounciness: 0.65, squishiness: 0.6,  speed: 750 } },
];

// ── Keyframe generation ─────────────────────────────────────────────
// Uses a continuous spring simulation sampled at 60 points, so the
// browser just linearly interpolates between closely-spaced values.
// No per-keyframe easing = no "seams" between segments. One fluid motion.

function f(n: number, d = 3): string { return n.toFixed(d); }

const MOTION_SAMPLES = 60;

type CurvePoint = { offset: number; value: number };

/**
 * Evaluate an underdamped spring at time t (0–1 normalized).
 * Returns position where 0 = start, 1 = target.
 * Overshoots past 1 and oscillates based on params.
 */
function evalSpring(t: number, overshoot: number, bounciness: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  // Damping ratio: controls oscillation.
  // overshoot controls how BIG the first peak is.
  // bounciness controls how LONG oscillations persist.
  const effectiveBounce = Math.max(overshoot * 0.7, bounciness);
  const zeta = Math.max(0.1, 1 - effectiveBounce * 0.9);

  // Natural frequency — low enough that motion fills the full duration.
  const omega = 2.5 + bounciness * 3; // 2.5 to 5.5

  // Time scaling — just enough for the spring to settle by t≈0.9
  const scaledT = t * (1.5 + bounciness * 0.5); // 1.5 to 2.0

  if (zeta >= 0.999) {
    // Critically damped: smooth approach, no oscillation
    return 1 - (1 + omega * scaledT) * Math.exp(-omega * scaledT);
  }

  // Underdamped: oscillates around target
  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  const envelope = Math.exp(-zeta * omega * scaledT);
  return 1 - envelope * (
    Math.cos(omegaD * scaledT) +
    (zeta * omega / omegaD) * Math.sin(omegaD * scaledT)
  );
}

/**
 * Evaluate the full motion at time t, including anticipation.
 * Anticipation is a smooth sine pullback before the spring launches.
 */
function evalMotion(t: number, anticipation: number, overshoot: number, bounciness: number): number {
  // Anticipation phase: first 12–20% of timeline
  const antLen = anticipation > 0.02 ? 0.12 + anticipation * 0.08 : 0;

  if (antLen > 0 && t < antLen) {
    const p = t / antLen;
    // Sine arc: 0 → -peak → back to ~0 (smooth, no hard edges)
    return -anticipation * 0.4 * Math.sin(p * Math.PI);
  }

  // Main motion: remap remaining time to 0–1 and run through spring
  const mt = antLen > 0 ? (t - antLen) / (1 - antLen) : t;
  return evalSpring(mt, overshoot, bounciness);
}

/**
 * Build a densely-sampled motion curve.
 * 60 points with linear interpolation = perfectly smooth animation.
 */
function buildMotionCurve(
  anticipation: number,
  overshoot: number,
  bounciness: number,
): CurvePoint[] {
  const points: CurvePoint[] = [];
  for (let i = 0; i <= MOTION_SAMPLES; i++) {
    const t = i / MOTION_SAMPLES;
    points.push({ offset: t, value: evalMotion(t, anticipation, overshoot, bounciness) });
  }
  return points;
}

/**
 * Compute squash/stretch scale factors from velocity at each curve point.
 * Fast travel = stretch in direction of motion.
 * Sudden deceleration (impact) = squash perpendicular.
 * Thresholds are low so the effect is visible at normal spring speeds.
 */
function buildSquashCurve(
  curve: CurvePoint[],
  squishiness: number,
): { scaleMain: number; scaleCross: number }[] {
  if (squishiness < 0.02) return curve.map(() => ({ scaleMain: 1, scaleCross: 1 }));

  return curve.map((point, i) => {
    if (i === 0 || i === curve.length - 1) return { scaleMain: 1, scaleCross: 1 };

    const prev = curve[i - 1];
    const velocity = (point.value - prev.value) / (point.offset - prev.offset);
    const absVel = Math.abs(velocity);

    const next = curve[i + 1];
    const nextVelocity = next ? (next.value - point.value) / (next.offset - point.offset) : 0;
    const decel = absVel - Math.abs(nextVelocity);
    const isImpact = absVel > 0.6 && decel > absVel * 0.25;

    if (isImpact) {
      // Squash: proportional to deceleration force
      const force = Math.min(decel / 4, 1);
      const sq = squishiness * 0.4 * force;
      return { scaleMain: 1 - sq, scaleCross: 1 + sq * 0.8 };
    } else if (absVel > 0.8) {
      // Stretch: proportional to velocity during travel
      const velFactor = Math.min((absVel - 0.8) / 3, 1);
      const st = squishiness * 0.3 * velFactor;
      return { scaleMain: 1 + st, scaleCross: 1 - st * 0.6 };
    }
    return { scaleMain: 1, scaleCross: 1 };
  });
}

/**
 * Compute rotation angles (degrees) from velocity — "follow-through".
 * Objects tilt in the direction of travel and rock back on arrival.
 * Subtle: max ±8 degrees. Only used for directional motions.
 */
function buildRotationCurve(
  curve: CurvePoint[],
  squishiness: number,
): number[] {
  // Rotation intensity scales with squishiness (it's a physical feel thing)
  const maxDeg = 6 + squishiness * 6; // 6 to 12 degrees max
  if (squishiness < 0.02) return curve.map(() => 0);

  return curve.map((point, i) => {
    if (i === 0 || i === curve.length - 1) return 0;

    const prev = curve[i - 1];
    const velocity = (point.value - prev.value) / (point.offset - prev.offset);

    // Tilt proportional to velocity, clamped
    const raw = velocity * 2.5; // scale velocity to degrees
    return Math.max(-maxDeg, Math.min(maxDeg, raw));
  });
}

/**
 * Build Web Animations API keyframes for a motion + feel config.
 * Uses 60 densely-sampled points — no per-keyframe easing needed.
 */
export function buildMotionKeyframes(motion: MotionType, feel: AnimationsConfig): Keyframe[] {
  const curve = buildMotionCurve(feel.anticipation, feel.overshoot, feel.bounciness);
  const squash = buildSquashCurve(curve, feel.squishiness);
  const rotation = buildRotationCurve(curve, feel.squishiness);

  switch (motion) {
    case 'enter-left':
    case 'enter-right': {
      const sign = motion === 'enter-left' ? -1 : 1;
      const dist = 150;
      return curve.map((pt, i) => {
        const x = (1 - pt.value) * sign * dist;
        const sx = squash[i].scaleMain;
        const sy = squash[i].scaleCross;
        // Tilt in direction of travel (negative sign so it leans forward)
        const rot = rotation[i] * -sign;
        const opacity = Math.min(1, Math.max(0, pt.value * 1.8));
        return {
          transform: `translateX(${f(x)}%) rotate(${f(rot)}deg) scaleX(${f(sx)}) scaleY(${f(sy)})`,
          opacity,
          offset: pt.offset,
        };
      });
    }

    case 'enter-top':
    case 'enter-bottom': {
      const sign = motion === 'enter-top' ? -1 : 1;
      const dist = 120;
      return curve.map((pt, i) => {
        const y = (1 - pt.value) * sign * dist;
        const sy = squash[i].scaleMain;
        const sx = squash[i].scaleCross;
        // Subtle tilt during vertical travel
        const rot = rotation[i] * 0.5;
        const opacity = Math.min(1, Math.max(0, pt.value * 1.8));
        return {
          transform: `translateY(${f(y)}%) rotate(${f(rot)}deg) scaleX(${f(sx)}) scaleY(${f(sy)})`,
          opacity,
          offset: pt.offset,
        };
      });
    }

    case 'scale-in': {
      return curve.map((pt, i) => {
        const base = Math.max(0, pt.value);
        const sx = base * squash[i].scaleCross;
        const sy = base * squash[i].scaleMain;
        // Tiny rotation wobble on scale-in
        const rot = rotation[i] * 0.3;
        return {
          transform: `scaleX(${f(Math.max(0.001, sx))}) scaleY(${f(Math.max(0.001, sy))}) rotate(${f(rot)}deg)`,
          opacity: Math.min(1, Math.max(0, pt.value * 1.5)),
          offset: pt.offset,
        };
      });
    }

    case 'pop': {
      return curve.map((pt, i) => {
        const s = Math.max(0, 0.2 + pt.value * 0.8);
        const sx = s * squash[i].scaleCross;
        const sy = s * squash[i].scaleMain;
        // Small rotation adds life to the pop
        const rot = rotation[i] * 0.4;
        return {
          transform: `scaleX(${f(Math.max(0.001, sx))}) scaleY(${f(Math.max(0.001, sy))}) rotate(${f(rot)}deg)`,
          offset: pt.offset,
        };
      });
    }

    case 'land': {
      const dist = 100;
      return curve.map((pt, i) => {
        const y = (1 - pt.value) * -dist;
        const sy = squash[i].scaleMain;
        const sx = squash[i].scaleCross;
        // Tilt forward on landing, rock back on impact
        const rot = rotation[i] * 0.6;
        const opacity = Math.min(1, Math.max(0, pt.value * 1.8));
        return {
          transform: `translateY(${f(y)}%) rotate(${f(rot)}deg) scaleX(${f(sx)}) scaleY(${f(sy)})`,
          opacity,
          offset: pt.offset,
        };
      });
    }

    default:
      return [
        { opacity: 0, offset: 0 },
        { opacity: 1, offset: 1 },
      ];
  }
}

/**
 * Apply a motion + feel to an element using the Web Animations API.
 * Returns the Animation instance for control (cancel, finish, etc.).
 */
export function applyMotion(
  el: HTMLElement,
  motion: MotionType,
  feel: AnimationsConfig,
): Animation {
  const keyframes = buildMotionKeyframes(motion, feel);
  return el.animate(keyframes, {
    duration: feel.speed,
    easing: 'linear', // timing is baked into keyframe offsets
    fill: 'both', // 'both' = first keyframe applies instantly (no flash), last persists
  });
}

// ─── GlazeBot Config Schema ─────────────────────────────────────────
// Typed shape for the gacha_config.config JSONB column.
// DEFAULT_CONFIG provides sensible defaults and doubles as the schema
// for validateConfig() — any key in DEFAULT_CONFIG is required.

export interface TokenPoolConfig {
  label: string;
  description: string;
  entries: { value: string; weight: number }[];
  conditionalOn?: { pool: string; values: string[] };
}

export interface ContextConfig {
  provider: string;
  model: string;
  prompt: string;
  maxTokens: number;
  interval: number;
  bufferSize: number;
}

export interface MemoryConfig {
  enabled: boolean;
  extractionIntervalMinutes: number;
  maxMemoriesPerCharacter: number;
  memoriesPerPrompt: number;
  extractionPrompt: string;
}

export interface VisualConfig {
  animationSpeed: number;   // multiplier: 0.5 = fast, 2.0 = slow, default 1.0
  strokeWidth: number;      // 1-8, default 3
  dropShadow: boolean;      // default true
}

export interface TopicCountRange { min: number; max: number; }

export interface CommentaryConfig {
  visionProvider: string;
  visionModel: string;
  directive: string;
  maxTokens: number;
  temperature: number;
  presencePenalty: number;
  frequencyPenalty: number;
  styleNudges: string[];
  responseInstruction: string;
  interactionInstruction: string;
  context: ContextConfig;
  topicWeights: Record<string, number>;
  topicPrompts: Record<string, string>;
  memory: MemoryConfig;
  visuals: VisualConfig;
}

export interface GlazeBotConfig {
  // Character generation
  dropRates: { common: number; rare: number; epic: number; legendary: number };
  baseTemperature: number;
  model: string;
  cardGenProvider: string;
  cardGenModel: string;
  packsPerDay: number;
  cardsPerPack: number;
  generationPrompt: string;
  imageSystemInfo: string;
  imageProvider: "pixellab" | "gemini";
  imageModel: string;
  imageConfig: { imageSize: string; aspectRatio: string };

  // Token pools
  tokenPools: Record<string, TokenPoolConfig>;

  // Rarity tuning (pass-through, no UI yet)
  traitRanges?: Record<string, { min: number; max: number }>;
  promptQuality?: Record<string, { maxTokens: number; tempBoost: number }>;
  rarityGuidance?: Record<string, string>;

  // Commentary
  commentary: CommentaryConfig;

  // Per-character topic assignment
  topicCountByRarity: Record<string, TopicCountRange>;
  legendaryCustomTopicCount: number;

  // Animation feel (optional — admin-tuned global feel)
  animations?: AnimationsConfig;
}

// ─── Default Config ────────────────────────────────────────────────
// Used as both a fallback and as the schema source for validateConfig().

export const DEFAULT_CONFIG: GlazeBotConfig = {
  dropRates: { common: 0.6, rare: 0.25, epic: 0.12, legendary: 0.03 },
  baseTemperature: 0.9,
  model: "qwen-plus",
  cardGenProvider: "dashscope",
  cardGenModel: "qwen-plus",
  packsPerDay: 3,
  cardsPerPack: 3,
  generationPrompt: "",
  imageSystemInfo:
    "facing south, sitting at a table, 128x128 pixel art sprite, no background",
  imageProvider: "pixellab",
  imageModel: "gemini-2.0-flash-preview-image-generation",
  imageConfig: { imageSize: "1024x1024", aspectRatio: "1:1" },
  tokenPools: {},
  topicCountByRarity: {
    common: { min: 3, max: 4 },
    rare: { min: 5, max: 6 },
    epic: { min: 7, max: 8 },
    legendary: { min: 9, max: 10 },
  },
  legendaryCustomTopicCount: 2,
  commentary: {
    visionProvider: "dashscope",
    visionModel: "qwen3-vl-flash",
    directive: "",
    maxTokens: 80,
    temperature: 0.9,
    presencePenalty: 1.5,
    frequencyPenalty: 0.8,
    styleNudges: [],
    responseInstruction:
      "1-2 sentences max, under 30 words. React to the screen. No roleplay, no emojis, no catchphrases. If nothing is happening: [SILENCE]",
    interactionInstruction:
      "When the player speaks to you, respond directly and conversationally. Acknowledge what they said, stay in character. Keep it brief.",
    context: {
      provider: "dashscope",
      model: "qwen3-vl-flash",
      prompt:
        "Describe what is happening on screen in 1-2 sentences. Focus on the game state, player actions, and any notable events.",
      maxTokens: 100,
      interval: 3,
      bufferSize: 10,
    },
    topicWeights: {
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
    },
    topicPrompts: {
      solo_observation:
        "React to what you see on screen. Be specific about ONE thing.",
      emotional_reaction:
        "Express a pure emotional reaction. Don't describe the screen. Just FEEL it.",
      question:
        "Ask the player a question or wonder something aloud about what's happening.",
      backstory_reference:
        "Subtly reference your own backstory or lore in the context of what you see.",
      quip_banter:
        "Two characters talk TO EACH OTHER about what just happened. One reacts, the other responds — disagree, tease, or riff.",
      callback:
        "Reference something from earlier in this session that connects to what's happening now.",
      hype_chain:
        "Two characters react to the same moment — the second one responds to the first, not just the screen.",
      encouragement:
        "Be emotionally supportive. Encourage the player, hype them up, or empathize if things are going badly. Be genuine, not sarcastic.",
      hot_take:
        "Drop a bold, opinionated take — about the game, a mechanic, a character design, a strategy, pop culture, anything. Be confident and slightly controversial.",
      tangent:
        "Something on screen reminds you of something completely unrelated. Go off on a brief tangent that reveals your personality. Don't force a game connection.",
    },
    memory: {
      enabled: true,
      extractionIntervalMinutes: 10,
      maxMemoriesPerCharacter: 100,
      memoriesPerPrompt: 10,
      extractionPrompt:
        "Review the conversation and extract 1-3 key memories worth remembering.",
    },
    visuals: {
      animationSpeed: 1.0,
      strokeWidth: 3,
      dropShadow: true,
    },
  },
};

// ─── Validation ────────────────────────────────────────────────────
// Walks DEFAULT_CONFIG recursively. Returns a human-readable error
// string listing missing key paths, or null if valid.

function collectMissingKeys(
  schema: Record<string, unknown>,
  target: Record<string, unknown>,
  prefix: string,
): string[] {
  const missing: string[] = [];
  for (const key of Object.keys(schema)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!(key in target)) {
      missing.push(path);
      continue;
    }
    const schemaVal = schema[key];
    const targetVal = target[key];
    // Recurse into plain objects (not arrays, not null)
    if (
      schemaVal !== null &&
      typeof schemaVal === "object" &&
      !Array.isArray(schemaVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      // Skip Record<string, ...> fields where we don't know the keys ahead of time
      const recordKeys = new Set([
        "tokenPools",
        "topicWeights",
        "topicPrompts",
        "topicCountByRarity",
        "traitRanges",
        "promptQuality",
        "rarityGuidance",
      ]);
      if (!recordKeys.has(key)) {
        missing.push(
          ...collectMissingKeys(
            schemaVal as Record<string, unknown>,
            targetVal as Record<string, unknown>,
            path,
          ),
        );
      }
    }
  }
  return missing;
}

/**
 * Validate a config object against the GlazeBotConfig shape.
 * Returns a human-readable error string listing missing keys, or null if valid.
 * Uses DEFAULT_CONFIG as the schema — any new field added there is automatically checked.
 *
 * Optional keys (traitRanges, promptQuality, rarityGuidance, animations) are skipped.
 */
export function validateConfig(cfg: unknown): string | null {
  if (cfg === null || typeof cfg !== "object" || Array.isArray(cfg)) {
    return "Config must be a plain object";
  }
  const target = cfg as Record<string, unknown>;
  const schema = DEFAULT_CONFIG as unknown as Record<string, unknown>;

  // Optional top-level keys that don't need to exist
  const optionalKeys = new Set([
    "traitRanges",
    "promptQuality",
    "rarityGuidance",
    "animations",
  ]);

  const missing: string[] = [];
  for (const key of Object.keys(schema)) {
    if (optionalKeys.has(key)) continue;
    const path = key;
    if (!(key in target)) {
      missing.push(path);
      continue;
    }
    const schemaVal = schema[key];
    const targetVal = target[key];
    if (
      schemaVal !== null &&
      typeof schemaVal === "object" &&
      !Array.isArray(schemaVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      const recordKeys = new Set([
        "tokenPools",
        "topicWeights",
        "topicPrompts",
        "topicCountByRarity",
        "traitRanges",
        "promptQuality",
        "rarityGuidance",
      ]);
      if (!recordKeys.has(key)) {
        missing.push(
          ...collectMissingKeys(
            schemaVal as Record<string, unknown>,
            targetVal as Record<string, unknown>,
            path,
          ),
        );
      }
    }
  }

  if (missing.length === 0) return null;
  return `Missing keys: ${missing.join(", ")}`;
}
