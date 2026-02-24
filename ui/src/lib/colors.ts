/** Assign each character name a stable accent color from the Catppuccin palette. */

const PALETTE = [
  "#89b4fa", // blue
  "#cba6f7", // mauve
  "#f5c2e7", // pink
  "#94e2d5", // teal
  "#fab387", // peach
  "#f9e2af", // yellow
  "#a6e3a1", // green
  "#74c7ec", // sapphire
  "#f38ba8", // red
  "#b4befe", // lavender
  "#89dceb", // sky
  "#eba0ac", // maroon
  "#f2cdcd", // flamingo
  "#f5e0dc", // rosewater
  "#cba6f7", // mauve (repeat for overflow)
  "#94e2d5", // teal
];

const cache: Record<string, string> = {};
let idx = 0;

export function nameColor(name: string): string {
  if (name === "You") return "#a6e3a1";
  if (name === "sys") return "#585b70";
  if (!cache[name]) {
    cache[name] = PALETTE[idx % PALETTE.length];
    idx++;
  }
  return cache[name];
}

export function nameInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
