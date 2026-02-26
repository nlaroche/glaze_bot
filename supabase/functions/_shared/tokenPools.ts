/**
 * Token Pool utilities for weighted-random character generation diversity.
 *
 * Each pool is a list of { value, weight } entries. At generation time we roll
 * one value from each pool (respecting conditional dependencies) and inject the
 * result as a concrete directive into the LLM user message.
 */

export interface TokenPoolEntry {
  value: string;
  weight: number;
}

export interface TokenPool {
  label: string;
  description: string;
  entries: TokenPoolEntry[];
  conditionalOn?: { pool: string; values: string[] };
}

export type TokenPools = Record<string, TokenPool>;
export type TokenRoll = Record<string, string>;

/**
 * Weighted random selection from entries.
 * Cumulative weight approach — O(n) but pools are small.
 */
export function weightedPick(entries: TokenPoolEntry[]): string {
  if (entries.length === 0) return "";
  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return entries[0].value;
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e.value;
  }
  return entries[entries.length - 1].value;
}

/**
 * Rolls all pools, resolving conditional dependencies.
 * Non-conditional pools are rolled first so conditionals can reference them.
 */
export function rollTokenPools(pools: TokenPools): TokenRoll {
  const result: TokenRoll = {};

  // Separate into unconditional and conditional
  const unconditional: [string, TokenPool][] = [];
  const conditional: [string, TokenPool][] = [];

  for (const [key, pool] of Object.entries(pools)) {
    if (pool.conditionalOn) {
      conditional.push([key, pool]);
    } else {
      unconditional.push([key, pool]);
    }
  }

  // Roll unconditional first
  for (const [key, pool] of unconditional) {
    if (pool.entries.length > 0) {
      result[key] = weightedPick(pool.entries);
    }
  }

  // Roll conditional pools only if their condition is met
  for (const [key, pool] of conditional) {
    const cond = pool.conditionalOn!;
    const rolledValue = result[cond.pool];
    if (rolledValue && cond.values.includes(rolledValue)) {
      if (pool.entries.length > 0) {
        result[key] = weightedPick(pool.entries);
      }
    }
  }

  return result;
}

/**
 * Formats rolled tokens into a CHARACTER DIRECTIVE block for the user message.
 */
export function buildDirective(tokens: TokenRoll): string {
  const lines: string[] = [];
  const labelMap: Record<string, string> = {
    gender: "Gender",
    species: "Species",
    ethnicity: "Ethnicity",
    ageRange: "Age Range",
    archetype: "Role/Archetype",
    personalityVibe: "Personality Vibe",
    definingTrait: "Defining Trait",
    settingTheme: "Setting/Theme",
  };

  for (const [key, value] of Object.entries(tokens)) {
    const label = labelMap[key] ?? key;
    lines.push(`${label}: ${value}`);
  }

  if (lines.length === 0) return "";

  return (
    "\n\nCHARACTER DIRECTIVE (follow these exactly):\n" + lines.join("\n")
  );
}
