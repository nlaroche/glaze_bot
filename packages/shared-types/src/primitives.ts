/** Normalized screen position (0-1 range, resolution-independent) */
export interface ScreenPosition {
  x: number;
  y: number;
}

/** Anchor positions for panels (stat comparisons, tables, floating text) */
export type AnchorPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/** Base fields shared by all visual commands */
export interface VisualCommandBase {
  id: string;
  primitive: string;
  duration_ms: number;
}

// ── Annotation Primitives ──────────────────────────────────────────

export interface ArrowCommand extends VisualCommandBase {
  primitive: 'arrow';
  from: ScreenPosition;
  to: ScreenPosition;
  color: string;
  thickness: number;
  label?: string;
}

export interface CircleCommand extends VisualCommandBase {
  primitive: 'circle';
  center: ScreenPosition;
  radius: number;
  color: string;
  thickness: number;
  fill_opacity?: number;
  label?: string;
}

export interface HighlightRectCommand extends VisualCommandBase {
  primitive: 'highlight_rect';
  origin: ScreenPosition;
  width: number;
  height: number;
  color: string;
  fill_opacity?: number;
}

// ── Comparison Primitives ──────────────────────────────────────────

export interface StatEntry {
  label: string;
  value: number;
  max?: number;
}

export interface StatSide {
  name: string;
  stats: StatEntry[];
}

export interface StatComparisonCommand extends VisualCommandBase {
  primitive: 'stat_comparison';
  title: string;
  left: StatSide;
  right: StatSide;
  position: AnchorPosition;
}

export interface InfoTableCommand extends VisualCommandBase {
  primitive: 'info_table';
  title: string;
  headers: string[];
  rows: string[][];
  position: AnchorPosition;
}

// ── Reaction Primitives ────────────────────────────────────────────

export type EmoteType =
  | 'heart'
  | 'fire'
  | 'skull'
  | 'star'
  | 'laugh'
  | 'cry'
  | 'rage'
  | 'thumbsup'
  | 'thumbsdown'
  | 'sparkle';

export interface EmoteBurstCommand extends VisualCommandBase {
  primitive: 'emote_burst';
  emote: EmoteType;
  origin: ScreenPosition;
  count: number;
  spread: number;
}

export interface ScreenFlashCommand extends VisualCommandBase {
  primitive: 'screen_flash';
  color: string;
  intensity: number;
}

export type FloatingTextAnimation =
  | 'rise'
  | 'shake'
  | 'pulse'
  | 'slam';

export interface FloatingTextCommand extends VisualCommandBase {
  primitive: 'floating_text';
  text: string;
  position: AnchorPosition;
  font_size: number;
  color: string;
  animation: FloatingTextAnimation;
}

// ── Search Primitives ─────────────────────────────────────────────

export interface SearchSource {
  title: string;
  uri: string;
}

export interface SearchPanelCommand extends VisualCommandBase {
  primitive: 'search_panel';
  query: string;
  summary: string;
  sources: SearchSource[];
  position: AnchorPosition;
  pinned: boolean;
}

// ── Drawing Primitives ─────────────────────────────────────────────

export interface FreehandPathCommand extends VisualCommandBase {
  primitive: 'freehand_path';
  points: ScreenPosition[];
  color: string;
  thickness: number;
  close_path: boolean;
}

export type StampIcon =
  | 'checkmark'
  | 'crossmark'
  | 'question'
  | 'exclamation'
  | 'crown'
  | 'trophy'
  | 'target'
  | 'sword'
  | 'shield'
  | 'potion';

export interface StampCommand extends VisualCommandBase {
  primitive: 'stamp';
  icon: StampIcon;
  position: ScreenPosition;
  size: number;
  rotation?: number;
}

// ── Union Type ─────────────────────────────────────────────────────

export type VisualCommand =
  | ArrowCommand
  | CircleCommand
  | HighlightRectCommand
  | StatComparisonCommand
  | InfoTableCommand
  | EmoteBurstCommand
  | ScreenFlashCommand
  | FloatingTextCommand
  | FreehandPathCommand
  | StampCommand
  | SearchPanelCommand;

export type VisualPrimitive = VisualCommand['primitive'];

/** All primitive names for iteration */
export const VISUAL_PRIMITIVES: VisualPrimitive[] = [
  'arrow',
  'circle',
  'highlight_rect',
  'stat_comparison',
  'info_table',
  'emote_burst',
  'screen_flash',
  'floating_text',
  'freehand_path',
  'stamp',
  'search_panel',
];
