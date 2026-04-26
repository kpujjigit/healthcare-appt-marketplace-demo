# Healthcare Appointment Marketplace — Sentry Custom Span Demo

A two-tier sample application demonstrating how to instrument a healthcare
appointment marketplace's critical user experiences with Sentry custom spans
and how the resulting span data drives business-KPI dashboards.

This demo represents the shape of a two-sided marketplace where patients book
in-person and telehealth appointments with providers, with insurance
eligibility verification and EHR/PMS sync as inline dependencies.

## What's in here

```
.
├── frontend/          Next.js (TypeScript) — patient-facing web tier
└── backend-dotnet/    ASP.NET Core 8 minimal API — provider/EHR backend tier
```

The frontend's API routes act as a BFF: each route emits a root span for the
critical user experience (e.g. `appointment.search`) and forwards the request
to the .NET backend, which emits a child span (`appointment.search.backend`)
with backend-specific attributes (db, downstream EHR/Availity calls, cache
layer). Sentry's Next.js + .NET SDKs auto-propagate `sentry-trace` and
`baggage` headers, so both spans land as a single distributed trace across
two Sentry projects.

If the .NET backend is not running, the frontend falls back to a local
synthetic implementation that still produces realistic span data — the demo
works either way, and turning on the backend tier just adds the second-tier
spans and the cross-tier trace.

## Critical user experiences instrumented

| Span (frontend) | Backend child | What it represents |
|---|---|---|
| `appointment.search` | `appointment.search.backend` | Symptom/specialty + ZIP + insurance → ranked provider list with live slots |
| `insurance.verify` | `insurance.verify.backend` | Real-time eligibility (Availity 270/271) at booking |
| `appointment.book` | `appointment.book.backend` | Slot lock → patient record → EHR/PMS push → confirmation |
| `availability.sync` | `availability.sync.backend` | EHR webhook / outbound poll updating provider slots |
| `intake.submit` | `intake.submit.backend` | Pre-visit forms + insurance card upload + OCR |

## Setup — frontend only (quickest)

The frontend stands alone with a synthetic-backend fallback.

```bash
cd frontend
cp .env.example .env       # then edit NEXT_PUBLIC_SENTRY_DSN
npm install
npm run dev                # http://localhost:3000
# in another terminal:
npm run load               # generates synthetic span data — npm run load
```

You should see spans land in your Sentry project within ~30 seconds.

## Setup — full distributed trace (frontend + .NET backend)

Requires the .NET 8 SDK.

```bash
# install .NET 8 SDK (macOS)
brew install --cask dotnet-sdk

# backend
cd backend-dotnet
cp .env.example .env       # then edit SENTRY_DSN
dotnet restore
dotnet run                 # http://localhost:5050

# frontend (in a separate terminal)
cd frontend
cp .env.example .env       # set NEXT_PUBLIC_SENTRY_DSN and BACKEND_URL=http://127.0.0.1:5050
                           # IMPORTANT: use 127.0.0.1, not localhost — Node 18+ fetch resolves
                           # localhost to ::1 (IPv6) first, and the .NET host binds IPv4 only.
                           # localhost will fail silently into the synthetic fallback.
npm install
npm run dev

# load (in a separate terminal)
cd frontend
npm run load
```

You'll now see two-tier traces: each request produces a root span in the
frontend project and a child span in the backend project, stitched together
by trace ID.

## Generating synthetic load

```bash
cd frontend
npm run load                       # default: 500 requests per route
LOAD_N=1000 npm run load           # bump volume
LOAD_BASE=http://localhost:3000 npm run load
```

The load script hits each instrumented route N times with varied attribute
values, so a single run produces enough span data to populate dashboards.

## What this demonstrates

- **Custom span attribute instrumentation** for healthcare-marketplace
  critical experiences (search, verify, book, sync, intake)
- **Two-tier distributed tracing** with auto-propagated trace headers
  between Next.js and .NET via Sentry SDKs
- **Controlled failure injection** (~5% slow, ~2% error) so the resulting
  dashboards have realistic signal
- **Span-attribute taxonomy** that aligns with OTEL semantic conventions
  where they apply (`http.*`, `db.*`) and uses `snake_case` business
  attributes elsewhere

## License

MIT
