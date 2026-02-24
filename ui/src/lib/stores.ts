import { writable } from "svelte/store";
import type { Character, LogEntry, CostInfo, PersonalityTraits } from "./types";
import * as B from "./bridge";

export const characters = writable<Character[]>([]);
export const activeCharacters = writable<string[]>([]);
export const paused = writable(false);
export const micMode = writable("always_on");
export const captureInterval = writable(1.5);
export const interactionMode = writable(true);
export const interactionChance = writable(0.25);
export const minGap = writable(12);
export const logs = writable<LogEntry[]>([]);
export const cost = writable<CostInfo>({ cost: 0, calls: 0 });
export const ready = writable(false);
export const speaking = writable("");
export const savedParties = writable<Record<string, string[]>>({});

// New settings stores
export const aiProvider = writable("dashscope");
export const visionModel = writable("qwen3-vl-flash");
export const captureScale = writable(0.5);
export const captureQuality = writable(70);
export const gameHint = writable("");

// Capture source stores
export const captureSourceType = writable<string | null>(null);
export const captureSourceName = writable("");
export const sourcePickerOpen = writable(false);

// UI state
export type View = "home" | "characters" | "log" | "settings";
export const activeView = writable<View>("home");
export const partyPanelOpen = writable(false);

// Character editor state
export const editingCharacter = writable<string | null>(null);
export const characterPersonality = writable<PersonalityTraits>({
  energy: 50, positivity: 50, formality: 50, talkativeness: 50, attitude: 50, humor: 50,
});

let pt: any = null, ct: any = null;

export async function initialize() {
  const s = await B.getInitialState();
  characters.set(s.characters);
  activeCharacters.set(s.active_characters);
  paused.set(s.paused);
  micMode.set(s.mic_mode);
  captureInterval.set(s.interval);
  interactionMode.set(s.interaction_mode);
  interactionChance.set(s.interaction_chance);
  minGap.set(s.min_gap);
  savedParties.set(s.parties || {});
  aiProvider.set(s.ai_provider || "dashscope");
  visionModel.set(s.vision_model || "qwen3-vl-flash");
  captureScale.set(s.capture_scale ?? 0.5);
  captureQuality.set(s.capture_quality ?? 70);
  gameHint.set(s.game_hint || "");
  captureSourceType.set(s.capture_source_type ?? null);
  captureSourceName.set(s.capture_source_name ?? "");
  ready.set(true);

  pt = setInterval(async () => {
    try {
      const r = await B.pollState();
      if (r.logs.length) logs.update(e => [...e, ...r.logs].slice(-200));
      paused.set(r.paused);
      activeCharacters.set(r.active_characters);
      speaking.set(r.speaking);
      minGap.set(r.min_gap);
      captureInterval.set(r.interval);
      micMode.set(r.mic_mode);
      interactionMode.set(r.interaction_mode);
      interactionChance.set(r.interaction_chance);
      aiProvider.set(r.ai_provider || "dashscope");
      visionModel.set(r.vision_model || "qwen3-vl-flash");
      captureScale.set(r.capture_scale ?? 0.5);
      captureQuality.set(r.capture_quality ?? 70);
      gameHint.set(r.game_hint || "");
      captureSourceType.set(r.capture_source_type ?? null);
      captureSourceName.set(r.capture_source_name ?? "");
    } catch {}
  }, 500);

  ct = setInterval(async () => {
    try { cost.set(await B.getCost()); } catch {}
  }, 3000);
}

export async function toggleChar(n: string) {
  const r = await B.toggleCharacter(n);
  if (r.ok && r.active) activeCharacters.set(r.active);
}
export async function doSaveParty(n: string) {
  const r = await B.saveParty(n);
  if (r.ok && r.parties) savedParties.set(r.parties);
}
export async function doLoadParty(n: string) {
  const r = await B.loadParty(n);
  if (r.ok && r.active) {
    activeCharacters.set(r.active);
    // Apply restored personalities to characters store
    if (r.personalities && Object.keys(r.personalities).length > 0) {
      characters.update(chars =>
        chars.map(c => c.name in r.personalities ? { ...c, personality: r.personalities[c.name] } : c)
      );
    }
  }
}
export async function doDeleteParty(n: string) {
  const r = await B.deleteParty(n);
  if (r.ok && r.parties) savedParties.set(r.parties);
}
export async function doUpdateSettings(s: Record<string, any>) {
  await B.updateSettings(s);
}
export async function doSetCaptureSource(type: string, id: number, name: string) {
  await B.setCaptureSource(type, id, name);
  captureSourceType.set(type);
  captureSourceName.set(name);
  sourcePickerOpen.set(false);
}
export async function doPause() { paused.set(await B.togglePause()); }
export async function doForce() { await B.forceComment(); }
export async function doQuit() {
  if (pt) clearInterval(pt);
  if (ct) clearInterval(ct);
  await B.quitApp();
}
const DEFAULT_PERSONALITY: PersonalityTraits = {
  energy: 50, positivity: 50, formality: 50, talkativeness: 50, attitude: 50, humor: 50,
};

export async function openCharacterEditor(name: string) {
  editingCharacter.set(name);
  const r = await B.getCharacterDetails(name);
  characterPersonality.set(r.personality ?? { ...DEFAULT_PERSONALITY });
}
export async function saveCharacterPersonality() {
  let name: string | null = null;
  editingCharacter.subscribe(v => (name = v))();
  let p: PersonalityTraits = { ...DEFAULT_PERSONALITY };
  characterPersonality.subscribe(v => (p = v))();
  if (!name) return;
  const r = await B.updateCharacterPersonality(name, p);
  if (r.ok) {
    // Update personality in characters store
    characters.update(chars =>
      chars.map(c => c.name === name ? { ...c, personality: r.personality } : c)
    );
  }
}
export function closeCharacterEditor() {
  editingCharacter.set(null);
}
export function resetCharacterPersonality() {
  characterPersonality.set({ ...DEFAULT_PERSONALITY });
}
export function cleanup() {
  if (pt) clearInterval(pt);
  if (ct) clearInterval(ct);
}
