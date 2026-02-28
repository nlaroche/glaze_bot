export interface MockResponse {
  status?: number;
  ok?: boolean;
  body?: unknown;
  text?: string;
  headers?: Record<string, string>;
  /** Delay in ms before resolving */
  delay?: number;
  /** If true, throw AbortError when signal is already aborted */
  abortThrows?: boolean;
}

/**
 * Creates a mock `fetch` function that returns configurable responses per URL pattern.
 * Unmatched URLs return a 404.
 */
export function createMockFetch(
  responses: Map<string | RegExp, MockResponse>,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    let matched: MockResponse | undefined;
    for (const [pattern, response] of responses) {
      if (typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url)) {
        matched = response;
        break;
      }
    }

    if (!matched) {
      matched = { status: 404, ok: false, text: 'Not Found' };
    }

    if (matched.delay) {
      await new Promise((r) => setTimeout(r, matched!.delay));
    }

    // Only throw on abort if configured to do so (default: don't throw,
    // since tests may use pre-aborted signals to test post-LLM abort paths)
    if (init?.signal?.aborted && matched.abortThrows) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    const status = matched.status ?? 200;
    const ok = matched.ok ?? (status >= 200 && status < 300);
    const bodyText = matched.text ?? (matched.body !== undefined ? JSON.stringify(matched.body) : '');

    return {
      ok,
      status,
      headers: new Headers(matched.headers ?? { 'Content-Type': 'application/json' }),
      text: async () => bodyText,
      json: async () => (matched!.body !== undefined ? matched!.body : JSON.parse(bodyText)),
      blob: async () => new Blob([bodyText]),
      body: null,
      clone: () => ({ ok, status, text: async () => bodyText, json: async () => matched!.body }),
    } as unknown as Response;
  }) as typeof fetch;
}
