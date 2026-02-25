export type Environment = "staging" | "production";

/**
 * Get the current environment from VITE_ENV or NODE_ENV.
 */
export function getEnvironment(): Environment {
  // Try Vite's import.meta.env first (works in browser and Vite dev server)
  if (typeof import.meta !== "undefined") {
    const metaEnv = (import.meta as unknown as Record<string, Record<string, string>>).env;
    if (metaEnv?.VITE_ENV) return metaEnv.VITE_ENV === "production" ? "production" : "staging";
    if (metaEnv?.MODE) return metaEnv.MODE === "production" ? "production" : "staging";
  }
  // Fall back to process.env for Node.js environments (discord bot, edge functions)
  if (typeof process !== "undefined" && process.env) {
    const env = process.env.VITE_ENV || process.env.NODE_ENV;
    if (env) return env === "production" ? "production" : "staging";
  }
  return "staging";
}

/**
 * Check if running in production.
 */
export function isProduction(): boolean {
  return getEnvironment() === "production";
}
