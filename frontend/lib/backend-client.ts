// Backend client. Forwards a request to the .NET tier when BACKEND_URL is set
// AND reachable; otherwise falls back to a local synthetic implementation so
// the demo works standalone.
//
// Sentry's @sentry/nextjs auto-instruments fetch and propagates sentry-trace +
// baggage headers when the URL matches tracePropagationTargets in
// sentry.server.config.ts — no manual header forwarding needed here.

export interface BackendResult<T> {
  data: T;
  reachedBackend: boolean;
}

export async function callBackend<T = unknown>(
  path: string,
  body: unknown,
  syntheticFallback: () => T,
): Promise<BackendResult<T>> {
  const backend = process.env.BACKEND_URL;
  if (!backend) {
    return { data: syntheticFallback(), reachedBackend: false };
  }

  try {
    const res = await fetch(`${backend}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      // Short timeout — if the backend is slow/down, fall back fast.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // Treat non-2xx as "backend unreachable" for demo purposes — synthetic fallback.
      return { data: syntheticFallback(), reachedBackend: false };
    }
    const data = (await res.json()) as T;
    return { data, reachedBackend: true };
  } catch {
    return { data: syntheticFallback(), reachedBackend: false };
  }
}
