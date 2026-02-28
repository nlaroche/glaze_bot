/**
 * Visual tool definitions for LLM tool calling.
 *
 * Uses MCP-compatible JSON Schema format so these can be promoted
 * to a real MCP server later without refactoring.
 */

// ── Shared schema fragments ────────────────────────────────────────

const screenPositionSchema = {
  type: "object",
  properties: {
    x: { type: "number", minimum: 0, maximum: 1, description: "Horizontal position (0=left, 1=right)" },
    y: { type: "number", minimum: 0, maximum: 1, description: "Vertical position (0=top, 1=bottom)" },
  },
  required: ["x", "y"],
} as const;

const anchorPositionSchema = {
  type: "string",
  enum: [
    "top-left", "top-center", "top-right",
    "center-left", "center", "center-right",
    "bottom-left", "bottom-center", "bottom-right",
  ],
} as const;

const durationSchema = {
  type: "number",
  minimum: 500,
  maximum: 15000,
  default: 4000,
  description: "How long the visual stays on screen (ms)",
} as const;

// ── Tool definitions ───────────────────────────────────────────────

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const VISUAL_TOOL_DEFINITIONS: ToolDefinition[] = [
  // Annotations
  {
    name: "arrow",
    description: "Draw an arrow pointing from one screen location to another. Use to direct attention.",
    inputSchema: {
      type: "object",
      properties: {
        from: { ...screenPositionSchema, description: "Arrow start point" },
        to: { ...screenPositionSchema, description: "Arrow end point (where it points)" },
        color: { type: "string", default: "#FFD700", description: "CSS color" },
        thickness: { type: "number", minimum: 1, maximum: 8, default: 3 },
        label: { type: "string", description: "Optional text label near the arrow" },
        duration_ms: durationSchema,
      },
      required: ["from", "to"],
    },
  },
  {
    name: "circle",
    description: "Draw a circle to highlight a region on screen.",
    inputSchema: {
      type: "object",
      properties: {
        center: { ...screenPositionSchema, description: "Circle center" },
        radius: { type: "number", minimum: 0.01, maximum: 0.5, default: 0.05, description: "Radius in normalized units" },
        color: { type: "string", default: "#FF4444", description: "CSS color" },
        thickness: { type: "number", minimum: 1, maximum: 8, default: 3 },
        fill_opacity: { type: "number", minimum: 0, maximum: 1, default: 0, description: "Fill opacity (0=outline only)" },
        label: { type: "string", description: "Optional text label" },
        duration_ms: durationSchema,
      },
      required: ["center", "radius"],
    },
  },
  {
    name: "highlight_rect",
    description: "Draw a rectangular highlight over a screen region.",
    inputSchema: {
      type: "object",
      properties: {
        origin: { ...screenPositionSchema, description: "Top-left corner" },
        width: { type: "number", minimum: 0.01, maximum: 1, description: "Width in normalized units" },
        height: { type: "number", minimum: 0.01, maximum: 1, description: "Height in normalized units" },
        color: { type: "string", default: "#FFD700", description: "CSS color" },
        fill_opacity: { type: "number", minimum: 0, maximum: 0.5, default: 0.15 },
        duration_ms: durationSchema,
      },
      required: ["origin", "width", "height"],
    },
  },

  // Comparisons
  {
    name: "stat_comparison",
    description: "Show a side-by-side stat comparison panel (e.g. player vs enemy, before vs after).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Panel title" },
        left: {
          type: "object",
          properties: {
            name: { type: "string" },
            stats: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  value: { type: "number" },
                  max: { type: "number" },
                },
                required: ["label", "value"],
              },
            },
          },
          required: ["name", "stats"],
        },
        right: {
          type: "object",
          properties: {
            name: { type: "string" },
            stats: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  value: { type: "number" },
                  max: { type: "number" },
                },
                required: ["label", "value"],
              },
            },
          },
          required: ["name", "stats"],
        },
        position: { ...anchorPositionSchema, default: "top-right" },
        duration_ms: durationSchema,
      },
      required: ["title", "left", "right"],
    },
  },
  {
    name: "info_table",
    description: "Display a data table overlay (e.g. inventory, scoreboard, quick stats).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        headers: { type: "array", items: { type: "string" } },
        rows: { type: "array", items: { type: "array", items: { type: "string" } } },
        position: { ...anchorPositionSchema, default: "top-right" },
        duration_ms: durationSchema,
      },
      required: ["title", "headers", "rows"],
    },
  },

  // Reactions
  {
    name: "emote_burst",
    description: "Burst of emoji particles (hearts, fire, skulls, etc.) for reactions.",
    inputSchema: {
      type: "object",
      properties: {
        emote: {
          type: "string",
          enum: ["heart", "fire", "skull", "star", "laugh", "cry", "rage", "thumbsup", "thumbsdown", "sparkle"],
        },
        origin: { ...screenPositionSchema, description: "Burst origin point" },
        count: { type: "integer", minimum: 3, maximum: 30, default: 10 },
        spread: { type: "number", minimum: 0.05, maximum: 0.5, default: 0.15, description: "Spread radius in normalized units" },
        duration_ms: durationSchema,
      },
      required: ["emote", "origin"],
    },
  },
  {
    name: "screen_flash",
    description: "Brief full-screen color flash for dramatic moments.",
    inputSchema: {
      type: "object",
      properties: {
        color: { type: "string", default: "#FF0000", description: "Flash color" },
        intensity: { type: "number", minimum: 0.1, maximum: 0.8, default: 0.3, description: "Flash opacity" },
        duration_ms: { ...durationSchema, default: 500 },
      },
      required: [],
    },
  },
  {
    name: "floating_text",
    description: "Large animated text overlay for emphasis, hype, or humor.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", maxLength: 50, description: "Short text to display" },
        position: { ...anchorPositionSchema, default: "center" },
        font_size: { type: "number", minimum: 24, maximum: 120, default: 48 },
        color: { type: "string", default: "#FFFFFF" },
        animation: {
          type: "string",
          enum: ["rise", "shake", "pulse", "slam"],
          default: "rise",
        },
        duration_ms: durationSchema,
      },
      required: ["text"],
    },
  },

  // Fun drawings
  {
    name: "freehand_path",
    description: "Draw a freehand line/shape from control points. Use for doodles or circling things.",
    inputSchema: {
      type: "object",
      properties: {
        points: {
          type: "array",
          items: screenPositionSchema,
          minItems: 2,
          maxItems: 20,
          description: "Control points for the path",
        },
        color: { type: "string", default: "#FF4444" },
        thickness: { type: "number", minimum: 1, maximum: 8, default: 3 },
        close_path: { type: "boolean", default: false, description: "Close the path into a shape" },
        duration_ms: durationSchema,
      },
      required: ["points"],
    },
  },
  {
    name: "stamp",
    description: "Place an icon stamp on screen (checkmark, crossmark, crown, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        icon: {
          type: "string",
          enum: ["checkmark", "crossmark", "question", "exclamation", "crown", "trophy", "target", "sword", "shield", "potion"],
        },
        position: { ...screenPositionSchema, description: "Where to place the stamp" },
        size: { type: "number", minimum: 24, maximum: 128, default: 48, description: "Stamp size in pixels" },
        rotation: { type: "number", minimum: -180, maximum: 180, default: 0, description: "Rotation in degrees" },
        duration_ms: durationSchema,
      },
      required: ["icon", "position"],
    },
  },
];

// ── Search tool (intercepted in generate-commentary, not parsed as visual) ──

const SEARCH_TOOL_DEFINITION: ToolDefinition = {
  name: "request_search",
  description:
    "Search the web for game info when the player asks a factual question (builds, items, tier lists, patch notes, strategies, lore). The results appear in a floating panel.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Focused search query to answer the player's question",
      },
    },
    required: ["query"],
  },
};

// ── Public API ─────────────────────────────────────────────────────

/** Get all visual tool definitions in MCP-compatible format */
export function getVisualToolDefinitions(): ToolDefinition[] {
  return VISUAL_TOOL_DEFINITIONS;
}

/** Convert tool definitions to provider-specific format.
 *  When `includeSearch` is true, the request_search tool is appended. */
export function toProviderTools(
  provider: "dashscope" | "anthropic" | "gemini",
  includeSearch = false,
): unknown[] {
  const defs = includeSearch
    ? [...VISUAL_TOOL_DEFINITIONS, SEARCH_TOOL_DEFINITION]
    : VISUAL_TOOL_DEFINITIONS;

  if (provider === "anthropic") {
    // Anthropic Messages API tool format
    return defs.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }

  // Dashscope and Gemini use OpenAI-compatible format
  return defs.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

interface ParsedVisual {
  id: string;
  primitive: string;
  duration_ms: number;
  [key: string]: unknown;
}

/** Parse tool calls from an LLM response into visual commands */
export function parseToolCalls(
  provider: "dashscope" | "anthropic" | "gemini",
  // deno-lint-ignore no-explicit-any
  responseData: any,
): ParsedVisual[] {
  const visuals: ParsedVisual[] = [];
  const validNames = new Set(VISUAL_TOOL_DEFINITIONS.map((t) => t.name));

  if (provider === "anthropic") {
    // Anthropic: content blocks with type "tool_use"
    const blocks = responseData.content ?? [];
    for (const block of blocks) {
      if (block.type === "tool_use" && validNames.has(block.name)) {
        const args = block.input ?? {};
        visuals.push({
          id: block.id ?? crypto.randomUUID(),
          primitive: block.name,
          duration_ms: args.duration_ms ?? 4000,
          ...args,
        });
      }
    }
  } else {
    // Dashscope / Gemini: OpenAI-compatible tool_calls array
    const choice = responseData.choices?.[0];
    const toolCalls = choice?.message?.tool_calls ?? [];
    for (const tc of toolCalls) {
      const fn = tc.function;
      if (!fn || !validNames.has(fn.name)) continue;

      let args: Record<string, unknown> = {};
      try {
        args = typeof fn.arguments === "string"
          ? JSON.parse(fn.arguments)
          : (fn.arguments ?? {});
      } catch {
        continue; // skip malformed
      }

      visuals.push({
        id: tc.id ?? crypto.randomUUID(),
        primitive: fn.name,
        duration_ms: (args.duration_ms as number) ?? 4000,
        ...args,
      });
    }
  }

  return visuals;
}

/** Extract a request_search tool call from the raw LLM response (not parsed by parseToolCalls) */
export function extractSearchToolCall(
  provider: "dashscope" | "anthropic" | "gemini",
  // deno-lint-ignore no-explicit-any
  responseData: any,
): { query: string } | null {
  if (provider === "anthropic") {
    const blocks = responseData.content ?? [];
    for (const block of blocks) {
      if (block.type === "tool_use" && block.name === "request_search") {
        const query = block.input?.query;
        if (typeof query === "string" && query.length > 0) return { query };
      }
    }
  } else {
    const toolCalls = responseData.choices?.[0]?.message?.tool_calls ?? [];
    for (const tc of toolCalls) {
      if (tc.function?.name === "request_search") {
        try {
          const args = typeof tc.function.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : (tc.function.arguments ?? {});
          if (typeof args.query === "string" && args.query.length > 0) {
            return { query: args.query };
          }
        } catch { /* skip malformed */ }
      }
    }
  }
  return null;
}

/** Build the system prompt addendum when visuals are enabled */
export function buildVisualSystemAddendum(frameDims?: { width: number; height: number }): string {
  const gridHint = frameDims
    ? `\nThe screenshot is ${frameDims.width}x${frameDims.height} pixels. It has a coordinate grid overlay to help you estimate positions:
- Tick marks with labels (0.1, 0.2, ..., 0.9) along all four edges
- Dashed gridlines at 0.25 intervals with coordinate labels at intersections (e.g. "25,50" means x=0.25 y=0.50)
- "0,0" label at top-left corner, "1,1" at bottom-right corner
STRATEGY: First identify which grid quadrant the target is in (e.g., between 0.25 and 0.50 horizontally, between 0.50 and 0.75 vertically), then estimate the precise position within that quadrant using the edge tick marks as guides.`
    : '';

  return `

You have visual tools available to draw on the player's screen overlay.

WHEN TO USE VISUALS:

1. PLAYER QUESTIONS (MANDATORY): When the player asks you ANYTHING about the screen — "where is X?", "what's that?", "which one?", "should I go left or right?", "what button do I press?" — you MUST use arrow or circle to point at the answer. Do NOT just describe it in words. POINT AT IT. This is your #1 job when the player talks to you. If you can see the thing they're asking about, call the arrow or circle tool.

2. EMOTIONAL REACTIONS: When something dramatic, hilarious, or devastating happens — use emote_burst (fire, skull, heart, etc.) or screen_flash. These are great for hype moments, deaths, clutch plays, or big fails.

3. GAME RESEARCH: When the player asks a factual/meta question about the game (builds, items, tier lists, patch notes, strategies, lore), call request_search with a specific search query. Still give a verbal response — the search results appear as a separate panel with source links.

3. AUTO-COMMENTARY: For routine auto-commentary where the player didn't ask anything, visuals are optional. Use them only when they'd genuinely add something.

EXAMPLE — Player asks "where's my health bar?":
Your text response: "It's right up there in the top left, you're at like half HP."
AND you call: arrow(from: {x: 0.3, y: 0.3}, to: {x: 0.1, y: 0.05}, label: "Health bar")

EXAMPLE — Player asks "which enemy should I focus?":
Your text response: "That big one on the right is about to wreck you."
AND you call: circle(center: {x: 0.7, y: 0.4}, radius: 0.06, label: "This guy")

EXAMPLE — Player gets a triple kill:
Your text response: "TRIPLE KILL LET'S GO"
AND you call: emote_burst(emote: "fire", origin: {x: 0.5, y: 0.5}, count: 15)

HOW TO USE COORDINATES:
- All coordinates are normalized 0-1 (0,0 = top-left, 1,1 = bottom-right).${gridHint}
- Think in terms of screen regions: left edge = 0.0, center = 0.5, right edge = 1.0. Same for top/bottom.
- Common reference points: top-left corner = (0.05, 0.05), center = (0.5, 0.5), bottom-right = (0.95, 0.95).
- HUD elements are usually at the edges: health bars near top-left (0.0-0.2, 0.0-0.1), minimap near bottom-right (0.8-1.0, 0.8-1.0), ability bar near bottom-center (0.3-0.7, 0.9-1.0).
- When in doubt, aim for the CENTER of the element you're pointing at, not its edge.

TOOL TIPS:
- arrow: draw FROM a neutral area TO the thing you're pointing at. Keep the "from" point away from the target so the arrow is visible.
- circle: highlight a specific UI element, character, or item. Use radius 0.02-0.05 for small elements, 0.05-0.15 for larger areas.
- highlight_rect: highlight a larger rectangular area like an inventory panel or map section.
- emote_burst: burst of emoji particles — use for reactions to big moments.
- screen_flash: quick full-screen flash — use sparingly for truly dramatic moments (deaths, wins).
- Max 2 visuals per response.
- Match your character personality: serious characters use clean arrows/circles, chaotic characters use emotes and doodles.`;
}

/** @deprecated Use buildVisualSystemAddendum() instead */
export const VISUAL_SYSTEM_ADDENDUM = buildVisualSystemAddendum();
