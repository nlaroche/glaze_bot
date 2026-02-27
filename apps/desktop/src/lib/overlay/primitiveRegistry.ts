import type { VisualCommand } from '@glazebot/shared-types';

/** Active visual commands with expiry tracking */
interface ActiveVisual {
  command: VisualCommand;
  expiresAt: number;
}

let activeVisuals = $state<ActiveVisual[]>([]);
let expiryTimer: ReturnType<typeof setInterval> | null = null;

function ensureExpiryLoop() {
  if (expiryTimer) return;
  expiryTimer = setInterval(() => {
    const now = Date.now();
    const before = activeVisuals.length;
    activeVisuals = activeVisuals.filter((v) => v.expiresAt > now);
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
    activeVisuals = [...activeVisuals, {
      command: cmd,
      expiresAt: now + (cmd.duration_ms || 4000),
    }];
  }
  ensureExpiryLoop();
}

/** Get current active visuals (reactive) */
export function getActiveVisuals(): VisualCommand[] {
  return activeVisuals.map((v) => v.command);
}

/** Clear all active visuals */
export function clearVisuals() {
  activeVisuals = [];
  if (expiryTimer) {
    clearInterval(expiryTimer);
    expiryTimer = null;
  }
}
