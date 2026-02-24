/** Standard API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Token usage tracking */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalCalls: number;
}

/** Provider pricing per million tokens */
export interface ProviderPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

/** App settings */
export interface AppSettings {
  minGap: number;
  interval: number;
  micMode: "always_on" | "push_to_talk" | "off";
  interactionMode: boolean;
  interactionChance: number;
  aiProvider: string;
  visionModel: string;
  captureScale: number;
  captureQuality: number;
  gameHint: string;
  captureSourceType: "window" | "monitor";
  captureSourceId: number;
  captureSourceName: string;
}
