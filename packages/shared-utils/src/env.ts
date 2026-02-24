export type Environment = "staging" | "production";

/**
 * Get the current environment from VITE_ENV or NODE_ENV.
 */
export function getEnvironment(): Environment {
  const env =
    (typeof import.meta !== "undefined" &&
      (import.meta as unknown as Record<string, Record<string, string>>).env
        ?.VITE_ENV) ||
    process.env.VITE_ENV ||
    process.env.NODE_ENV;
  return env === "production" ? "production" : "staging";
}

/**
 * Check if running in production.
 */
export function isProduction(): boolean {
  return getEnvironment() === "production";
}
