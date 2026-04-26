# Healthcare Appointment Marketplace — Sentry Custom Span Demo

A small two-tier sample app that shows how to instrument the **critical user experiences** of a healthcare appointment marketplace with Sentry custom spans, so the resulting span data can drive dashboards that map directly to business outcomes (booking-completion rate, EHR partner health, end-to-end booking latency).

The five experiences instrumented are: `appointment.search`, `insurance.verify`, `appointment.book`, `availability.sync`, `intake.submit`. Each carries identity, segment, and outcome attributes following Sentry custom-span and OTEL conventions. Failure injection (~5% slow, ~2% error) keeps the span data realistic so dashboards have signal.

```
.
├── frontend/         Next.js (TypeScript) — patient-facing tier
└── backend-dotnet/   ASP.NET Core minimal API — provider/EHR backend tier
```

The frontend's API routes forward to the .NET backend via HTTP; Sentry's SDKs auto-propagate `sentry-trace` + `baggage` so each request lands as a single distributed trace across two Sentry projects. If the backend isn't running, the frontend silently falls back to a local synthetic implementation — the demo works either way.

---

## Setup

### Quickest path — frontend only

```bash
cd frontend
cp .env.example .env       # set NEXT_PUBLIC_SENTRY_DSN
npm install
npm run dev                # http://localhost:3000
```

In another terminal:

```bash
cd frontend
npm run load               # generates synthetic span data
```

Spans land in your Sentry project within ~30 seconds.

### Full distributed trace — frontend + .NET backend

Install the .NET SDK first:

```bash
brew install --cask dotnet-sdk    # or formula: brew install dotnet
```

Backend:

```bash
cd backend-dotnet
cp .env.example .env       # set SENTRY_DSN
dotnet restore
dotnet run                 # http://localhost:5050
```

Frontend (separate terminal):

```bash
cd frontend
cp .env.example .env       # set NEXT_PUBLIC_SENTRY_DSN and BACKEND_URL=http://127.0.0.1:5050
npm install
npm run dev
```

Load (separate terminal):

```bash
cd frontend
npm run load
```

> **Use `127.0.0.1`, not `localhost`** for `BACKEND_URL` — Node 18+ `fetch` resolves `localhost` to IPv6 (`::1`) first, and the .NET host binds IPv4 only. `localhost` fails silently into the synthetic fallback.

---

## Load options

```bash
npm run load                       # default: 500 requests per route
LOAD_N=1000 npm run load           # bump volume
LOAD_CONCURRENCY=20 npm run load   # bump parallelism
```

## License

MIT
