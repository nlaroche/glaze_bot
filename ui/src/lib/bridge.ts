import type { AppState, CostInfo, PollResult, PersonalityTraits, CaptureSource } from "./types";

function api(): any { return (window as any).pywebview?.api; }
function live(): boolean { return !!(window as any).pywebview?.api; }

const M = [
  { name: "Hype", description: "Hype man / entertainer", voice: "a" },
  { name: "Sage", description: "Calm tactical advisor", voice: "b" },
  { name: "Vex", description: "In-world rogue companion", voice: "c" },
  { name: "The Narrator", description: "Darkest Dungeon narrator", voice: "d" },
  { name: "Grandma Dot", description: "Wholesome confused grandma", voice: "e" },
  { name: "Coach Brick", description: "Screaming sports coach", voice: "f" },
  { name: "Professor Quill", description: "Pretentious academic", voice: "g" },
  { name: "Karen", description: "Wants to speak to the manager", voice: "h" },
  { name: "Bingo", description: "Overexcited golden retriever", voice: "i" },
  { name: "Mort", description: "Depressed existentialist", voice: "j" },
  { name: "DJ Blaze", description: "Underground DJ", voice: "k" },
  { name: "Captain Obvious", description: "States the obvious", voice: "l" },
  { name: "Conspiracy Carl", description: "Paranoid theorist", voice: "m" },
  { name: "Abuela Rosa", description: "Fierce Latina grandma", voice: "n" },
  { name: "Sir Reginald", description: "Posh Victorian butler", voice: "o" },
  { name: "Jinx", description: "Chaotic gremlin", voice: "p" },
];
let mA = ["Hype", "Vex", "Jinx"]; let mP = false; let mN = 0;

export async function getInitialState(): Promise<AppState> {
  if (live()) return await api().get_initial_state();
  return { characters: M, active_characters: mA, paused: false, mic_mode: "always_on",
    interval: 1.5, interaction_mode: true, interaction_chance: 0.25, min_gap: 30,
    parties: { "Chaos": ["Hype", "Jinx", "Coach Brick"] },
    capture_source_type: null, capture_source_name: "" };
}

export async function toggleCharacter(n: string) {
  if (live()) return await api().toggle_character(n);
  mA = mA.includes(n) ? (mA.length > 1 ? mA.filter(x => x !== n) : mA) : [...mA, n];
  return { ok: true, active: [...mA] };
}

export async function saveParty(n: string) {
  if (live()) return await api().save_party(n);
  return { ok: true, parties: { [n]: mA } };
}
export async function loadParty(n: string) {
  if (live()) return await api().load_party(n);
  return { ok: true, active: mA, personalities: {} };
}
export async function deleteParty(n: string) {
  if (live()) return await api().delete_party(n);
  return { ok: true, parties: {} };
}
export async function getCharacterDetails(name: string) {
  if (live()) return await api().get_character_details(name);
  const ch = M.find(c => c.name === name);
  return { ok: !!ch, name, description: ch?.description ?? "", personality: null };
}
export async function updateCharacterPersonality(name: string, personality: PersonalityTraits) {
  if (live()) return await api().update_character_personality(name, personality);
  return { ok: true, personality };
}
export async function updateSettings(s: Record<string, any>) {
  if (live()) return await api().update_settings(s);
  return { ok: true };
}
export async function togglePause() {
  if (live()) { const r = await api().toggle_pause(); return r.paused; }
  mP = !mP; return mP;
}
export async function forceComment() { if (live()) await api().force_comment(); }
export async function quitApp() { if (live()) await api().quit_app(); }
export async function getCost(): Promise<CostInfo> {
  if (live()) return await api().get_cost();
  return { cost: 0.004, calls: mN };
}
export async function pollState(): Promise<PollResult> {
  if (live()) return await api().poll_state();
  mN++;
  const sp = mN % 8 === 0 ? "Hype" : "";
  const logs = mN % 6 === 0 ? [{ source: "Hype", text: "ABSOLUTELY DISGUSTING" }] : [];
  return { logs, paused: mP, active_characters: mA, speaking: sp,
    min_gap: 30, interval: 1.5, mic_mode: "always_on",
    interaction_mode: true, interaction_chance: 0.25,
    capture_source_type: null, capture_source_name: "" };
}
export async function getCaptureSourcess(): Promise<{ monitors: CaptureSource[]; windows: CaptureSource[] }> {
  if (live()) return await api().get_capture_sources();
  return {
    monitors: [{ type: "monitor", id: 1, name: "Monitor 1 (1920x1080)", thumbnail: "" }],
    windows: [{ type: "window", id: 12345, name: "Mock Window", thumbnail: "" }],
  };
}
export async function setCaptureSource(type: string, id: number, name: string) {
  if (live()) return await api().set_capture_source(type, id, name);
  return { ok: true };
}
