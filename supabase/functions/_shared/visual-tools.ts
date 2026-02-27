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

// ── Public API ─────────────────────────────────────────────────────

/** Get all visual tool definitions in MCP-compatible format */
export function getVisualToolDefinitions(): ToolDefinition[] {
  return VISUAL_TOOL_DEFINITIONS;
}

/** Convert tool definitions to provider-specific format */
export function toProviderTools(
  provider: "dashscope" | "anthropic" | "gemini",
): unknown[] {
  if (provider === "anthropic") {
    // Anthropic Messages API tool format
    return VISUAL_TOOL_DEFINITIONS.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }

  // Dashscope and Gemini use OpenAI-compatible format
  return VISUAL_TOOL_DEFINITIONS.map((t) => ({
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

/** System prompt addendum when visuals are enabled */
export const VISUAL_SYSTEM_ADDENDUM = `

You have visual tools available. Use them SPARINGLY — only when something on screen genuinely warrants visual annotation. Most responses should be text-only.

When you do use visuals:
- All coordinates are normalized 0-1 (0,0 = top-left, 1,1 = bottom-right)
- Use arrow/circle/highlight_rect to point at specific things on screen
- Use emote_burst for genuine hype/shock moments
- Use floating_text for emphasis on big plays
- Use stat_comparison/info_table only when comparing concrete values
- Max 1-2 visuals per response. Less is more.
- Match your character personality: serious characters use clean annotations, chaotic characters use emotes and doodles.`;
