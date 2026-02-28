import type { VisualCommand } from '@glazebot/shared-types';

/** Active visual commands with expiry tracking */
interface ActiveVisual {
  command: VisualCommand;
  expiresAt: number;
  pinned: boolean;
}

const MAX_SEARCH_PANELS = 3;

let activeVisuals = $state<ActiveVisual[]>([]);
let expiryTimer: ReturnType<typeof setInterval> | null = null;

function ensureExpiryLoop() {
  if (expiryTimer) return;
  expiryTimer = setInterval(() => {
    const now = Date.now();
    const before = activeVisuals.length;
    activeVisuals = activeVisuals.filter((v) => v.pinned || v.expiresAt > now);
    if (activeVisuals.length === 0 && expiryTimer) {
      clearInterval(expiryTimer);
      expiryTimer = null;
    }
  }, 200);
}

/** Add visual commands from an LLM response */
export function pushVisuals(commands: VisualCommand[]) {
  if (!commands || commands.length === 0) return;

  const now = Date.now();
  for (const cmd of commands) {
    // Assign ID if missing
    if (!cmd.id) {
      cmd.id = `v-${now}-${Math.random().toString(36).slice(2, 8)}`;
    }

    const pinned = 'pinned' in cmd ? !!(cmd as any).pinned : false;

    // Cap search panels at MAX_SEARCH_PANELS — auto-dismiss oldest if exceeded
    if (cmd.primitive === 'search_panel') {
      const searchPanels = activeVisuals.filter((v) => v.command.primitive === 'search_panel');
      if (searchPanels.length >= MAX_SEARCH_PANELS) {
        const oldest = searchPanels[0];
        activeVisuals = activeVisuals.filter((v) => v !== oldest);
      }
    }

    activeVisuals = [...activeVisuals, {
      command: cmd,
      expiresAt: now + (cmd.duration_ms || 4000),
      pinned,
    }];
  }
  ensureExpiryLoop();
}

/** Get current active visuals (reactive) */
export function getActiveVisuals(): VisualCommand[] {
  return activeVisuals.map((v) => v.command);
}

/** Dismiss a specific visual by ID immediately */
export function dismissVisual(id: string) {
  activeVisuals = activeVisuals.filter((v) => v.command.id !== id);
  if (activeVisuals.length === 0 && expiryTimer) {
    clearInterval(expiryTimer);
    expiryTimer = null;
  }
}

/** Pin a visual so it doesn't expire */
export function pinVisual(id: string) {
  activeVisuals = activeVisuals.map((v) =>
    v.command.id === id ? { ...v, pinned: true } : v
  );
}

/** Unpin a visual so it will expire normally */
export function unpinVisual(id: string) {
  activeVisuals = activeVisuals.map((v) =>
    v.command.id === id ? { ...v, pinned: false } : v
  );
}

/** Whether any interactive visuals (search_panel) are currently active */
export function hasInteractiveVisuals(): boolean {
  return activeVisuals.some((v) => v.command.primitive === 'search_panel');
}

/** Clear all active visuals */
export function clearVisuals() {
  activeVisuals = [];
  if (expiryTimer) {
    clearInterval(expiryTimer);
    expiryTimer = null;
  }
}
