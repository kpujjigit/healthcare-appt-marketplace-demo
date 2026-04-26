// Hits each instrumented route N times with varied attribute values.
// Defaults: 500 requests per route. Override with LOAD_N=1000 npm run load.
//
// The error counts include the *injected* errors — that's expected. The point
// is to produce realistic span data so dashboards have something to chart.

const ROUTES = [
  "/api/appointment/search",
  "/api/insurance/verify",
  "/api/appointment/book",
  "/api/availability/sync",
  "/api/intake/submit",
];

const REQUESTS_PER_ROUTE = parseInt(process.env.LOAD_N ?? "500", 10);
const BASE_URL = process.env.LOAD_BASE ?? "http://localhost:3000";
const CONCURRENCY = parseInt(process.env.LOAD_CONCURRENCY ?? "8", 10);

async function hit(url: string): Promise<"ok" | "err"> {
  try {
    const res = await fetch(url, { method: "POST" });
    return res.ok ? "ok" : "err";
  } catch {
    return "err";
  }
}

async function runRoute(route: string) {
  const url = BASE_URL + route;
  let ok = 0;
  let err = 0;

  // Process in fixed-size batches. Simpler and more deterministic than a
  // running pool, and CONCURRENCY * route_latency is small enough that
  // batch boundaries don't materially slow the run.
  for (let i = 0; i < REQUESTS_PER_ROUTE; i += CONCURRENCY) {
    const batchSize = Math.min(CONCURRENCY, REQUESTS_PER_ROUTE - i);
    const results = await Promise.all(
      Array.from({ length: batchSize }, () => hit(url)),
    );
    for (const r of results) {
      if (r === "ok") ok++;
      else err++;
    }
  }
  console.log(`  ${route} -> ok=${ok} err=${err}`);
}

async function main() {
  console.log(
    `Hitting ${BASE_URL} — ${REQUESTS_PER_ROUTE} requests/route, concurrency ${CONCURRENCY}`,
  );
  const start = Date.now();
  for (const route of ROUTES) {
    console.log(`-> ${route} (x${REQUESTS_PER_ROUTE})`);
    await runRoute(route);
  }
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s. Check Sentry for spans (should appear within ~30s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
