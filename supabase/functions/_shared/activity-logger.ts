import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface LogEntry {
  user_id: string;
  character_id?: string | null;
  session_id?: string | null;
  request_id?: string | null;
  scope: "character" | "session" | "system";
  event: string;
  level: "info" | "warn" | "error";
  data?: Record<string, unknown> | null;
}

interface LogDefaults {
  characterId?: string;
  sessionId?: string;
  requestId?: string;
  scope?: "character" | "session" | "system";
}

/**
 * Buffered activity logger for edge functions.
 * Collects log entries during a request, then batch-inserts on flush().
 * Never throws — falls back to console.error if the insert fails.
 */
export class ActivityLogger {
  private buffer: LogEntry[] = [];
  private client: SupabaseClient;
  private userId: string;
  private defaults: LogDefaults;

  constructor(
    client: SupabaseClient,
    userId: string,
    defaults: LogDefaults = {},
  ) {
    this.client = client;
    this.userId = userId;
    this.defaults = defaults;
  }

  /** Set or update the character ID default (useful after character is inserted) */
  setCharacterId(id: string) {
    this.defaults.characterId = id;
  }

  log(
    event: string,
    data?: Record<string, unknown> | null,
    opts?: Partial<Pick<LogEntry, "character_id" | "session_id" | "scope" | "level">>,
  ) {
    this.push("info", event, data, opts);
  }

  warn(
    event: string,
    data?: Record<string, unknown> | null,
    opts?: Partial<Pick<LogEntry, "character_id" | "session_id" | "scope" | "level">>,
  ) {
    this.push("warn", event, data, opts);
  }

  error(
    event: string,
    data?: Record<string, unknown> | null,
    opts?: Partial<Pick<LogEntry, "character_id" | "session_id" | "scope" | "level">>,
  ) {
    this.push("error", event, data, opts);
  }

  private push(
    level: "info" | "warn" | "error",
    event: string,
    data?: Record<string, unknown> | null,
    opts?: Partial<Pick<LogEntry, "character_id" | "session_id" | "scope" | "level">>,
  ) {
    this.buffer.push({
      user_id: this.userId,
      character_id: opts?.character_id ?? this.defaults.characterId ?? null,
      session_id: opts?.session_id ?? this.defaults.sessionId ?? null,
      request_id: this.defaults.requestId ?? null,
      scope: opts?.scope ?? this.defaults.scope ?? "system",
      event,
      level: opts?.level ?? level,
      data: data ?? null,
    });
  }

  /** Batch-insert all buffered entries. Safe to call multiple times. */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const entries = this.buffer.splice(0);
    try {
      const { error } = await this.client.from("activity_log").insert(entries);
      if (error) {
        console.error("[ActivityLogger] flush failed:", error.message, JSON.stringify(entries));
      }
    } catch (err) {
      console.error("[ActivityLogger] flush exception:", err, JSON.stringify(entries));
    }
  }
}
