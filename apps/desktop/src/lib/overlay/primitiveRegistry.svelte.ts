import type { VisualCommand } from '@glazebot/shared-types';

/** Active visual commands with expiry tracking */
interface ActiveVisual {
  command: VisualCommand;
  expiresAt: number;
  pinned: boolean;
}

/** Capture bounds for coordinate transformation (window captures) */
export interface CaptureBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  screen_width: number;
  screen_height: number;
}

const MAX_SEARCH_PANELS = 3;

let activeVisuals = $state<ActiveVisual[]>([]);
let currentBounds = $state<CaptureBounds | null>(null);

/** Update the current capture bounds (call when a new frame arrives) */
export function setCaptureBounds(bounds: CaptureBounds | null) {
  currentBounds = bounds;
}

/**
 * Transform a normalized 0-1 coordinate from capture space to screen space.
 * For monitor captures (no bounds), coordinates pass through unchanged.
 * For window captures, maps from window-relative to screen-relative.
 */
function transformCoord(x: number, y: number): { x: number; y: number } {
  if (!currentBounds) return { x, y };
  const b = currentBounds;
  // capture-space (0-1) → pixel position in window → screen-space (0-1)
  return {
    x: (b.x + x * b.width) / b.screen_width,
    y: (b.y + y * b.height) / b.screen_height,
  };
}

/** Transform a normalized size value (e.g. radius, width) from capture to screen scale */
function transformSize(size: number, axis: 'x' | 'y'): number {
  if (!currentBounds) return size;
  const b = currentBounds;
  if (axis === 'x') return (size * b.width) / b.screen_width;
  return (size * b.height) / b.screen_height;
}

/** Deep-transform all coordinate fields in a visual command */
function transformVisual(cmd: VisualCommand): VisualCommand {
  if (!currentBounds) return cmd;

  const out = { ...cmd } as any;

  // Position fields: center, origin, from, to, position
  if (out.center) out.center = transformCoord(out.center.x, out.center.y);
  if (out.origin) out.origin = transformCoord(out.origin.x, out.origin.y);
  if (out.from) out.from = transformCoord(out.from.x, out.from.y);
  if (out.to) out.to = transformCoord(out.to.x, out.to.y);
  if (out.position) out.position = transformCoord(out.position.x, out.position.y);

  // Size fields: radius, width, height
  if (typeof out.radius === 'number') {
    // Use average of x/y scale for circles
    out.radius = (transformSize(out.radius, 'x') + transformSize(out.radius, 'y')) / 2;
  }
  if (out.primitive === 'highlight_rect') {
    if (typeof out.width === 'number') out.width = transformSize(out.width, 'x');
    if (typeof out.height === 'number') out.height = transformSize(out.height, 'y');
  }

  // Freehand path points
  if (out.points && Array.isArray(out.points)) {
    out.points = out.points.map((p: { x: number; y: number }) => transformCoord(p.x, p.y));
  }

  return out as VisualCommand;
}
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
  for (let cmd of commands) {
    // Assign ID if missing
    if (!cmd.id) {
      cmd.id = `v-${now}-${Math.random().toString(36).slice(2, 8)}`;
    }

    // Transform coordinates from capture-space to screen-space
    cmd = transformVisual(cmd);

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
