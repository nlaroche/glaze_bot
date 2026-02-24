import type { Character } from "@glazebot/shared-types";

/**
 * Parse a character JSON object, applying defaults for optional fields.
 */
export function parseCharacter(raw: unknown): Character {
  const obj = raw as Record<string, unknown>;
  return {
    name: obj.name as string,
    voice: obj.voice as string,
    description: obj.description as string,
    system_prompt: obj.system_prompt as string,
    personality: obj.personality as Character["personality"],
  };
}

/**
 * Load characters from a record of filename → JSON content.
 * This is platform-agnostic — the caller provides the raw data
 * (e.g. from fs.readdir, Tauri asset API, or bundled import).
 */
export function loadCharacters(
  files: Record<string, unknown>,
): Map<string, Character> {
  const characters = new Map<string, Character>();
  for (const [, data] of Object.entries(files)) {
    const char = parseCharacter(data);
    characters.set(char.name, char);
  }
  return characters;
}
