// Controlled failure injection so dashboards have realistic signal.
// Defaults: ~5% slow, ~2% error. The error_code enum is per-span and is
// passed in so each route uses its own realistic error set.

export type FailureOutcome = "ok" | "slow" | "error";

export interface InjectionResult {
  outcome: FailureOutcome;
  latencyMs: number;
  errorCode: string | "NONE";
}

export interface InjectOpts {
  slowRate?: number;
  errorRate?: number;
  errorCodes: readonly string[];
  // Base latency band in ms when "ok" — overridable per route.
  okMinMs?: number;
  okMaxMs?: number;
  // Slow-path adds this much on top of the base.
  slowAddMinMs?: number;
  slowAddMaxMs?: number;
}

export async function injectFailure(opts: InjectOpts): Promise<InjectionResult> {
  const slowRate = opts.slowRate ?? 0.05;
  const errorRate = opts.errorRate ?? 0.02;
  const okMinMs = opts.okMinMs ?? 50;
  const okMaxMs = opts.okMaxMs ?? 250;
  const slowAddMinMs = opts.slowAddMinMs ?? 800;
  const slowAddMaxMs = opts.slowAddMaxMs ?? 2500;

  const base = okMinMs + Math.random() * (okMaxMs - okMinMs);
  const r = Math.random();

  if (r < errorRate) {
    // Errored path — short latency, throws after we've returned the metadata.
    const errorCode = opts.errorCodes[Math.floor(Math.random() * opts.errorCodes.length)] ?? "UNKNOWN";
    await sleep(base);
    return { outcome: "error", latencyMs: Math.round(base), errorCode };
  }

  if (r < errorRate + slowRate) {
    const slowAdd = slowAddMinMs + Math.random() * (slowAddMaxMs - slowAddMinMs);
    const total = base + slowAdd;
    await sleep(total);
    return { outcome: "slow", latencyMs: Math.round(total), errorCode: "NONE" };
  }

  await sleep(base);
  return { outcome: "ok", latencyMs: Math.round(base), errorCode: "NONE" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
