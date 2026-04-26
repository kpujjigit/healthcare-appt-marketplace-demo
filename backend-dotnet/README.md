# Backend tier — .NET 8 minimal API

ASP.NET Core 8 Minimal API instrumented with Sentry, mirroring a healthcare
appointment marketplace's backend services. Each endpoint emits a child span
on the trace propagated from the frontend tier (`appointment.search.backend`,
`insurance.verify.backend`, etc.) with backend-specific attributes (db,
downstream EHR/Availity calls, queue lag, OCR confidence).

## Setup

```bash
# install .NET 8 SDK if you don't have it (macOS)
brew install --cask dotnet-sdk

cp .env.example .env       # then edit SENTRY_DSN
dotnet restore
dotnet run
# listens on http://localhost:5050 by default
```

Then in your `frontend/.env`, set:

```
BACKEND_URL=http://127.0.0.1:5050
```

**Use `127.0.0.1`, not `localhost`** — Node 18+ `fetch` resolves `localhost` to `::1` (IPv6) first, and the .NET host binds to `0.0.0.0` (IPv4 only), so a `localhost` URL fails silently into the frontend's synthetic-backend fallback.

…and restart `npm run dev`. Every frontend route now forwards to its backend
counterpart, and Sentry stitches the two-tier spans into a single trace.

## What this tier emits

| Endpoint | Backend span | Backend-specific attributes |
|---|---|---|
| `POST /api/appointment/search` | `appointment.search.backend` | `backend.cache_hit`, `db.system.name`, `db.query_count_bucket`, `downstream.availability_fanout_count` |
| `POST /api/insurance/verify` | `insurance.verify.backend` | `downstream.availity_call_count`, `downstream.availity_status_code`, `cache_layer` |
| `POST /api/appointment/book` | `appointment.book.backend` | `db.system.name`, `downstream.ehr_call_count`, `downstream.ehr_status_code`, `idempotency_check_result` |
| `POST /api/availability/sync` | `availability.sync.backend` | `queue.system.name`, `queue.lag_ms_bucket`, `downstream.ehr_status_code` |
| `POST /api/intake/submit` | `intake.submit.backend` | `s3.upload_status`, `ocr.confidence_bucket`, `db.system.name` |

All endpoints also carry the universal outcome attributes (`status`,
`error_code`, `latency_ms_bucket`) so the same dashboard widgets that work
on the frontend tier work here, sliced by backend attributes for drill-in.

## Running standalone (without the frontend)

You can also hit the backend directly with `curl` to exercise the .NET span
shape in isolation:

```bash
curl -X POST http://localhost:5050/api/appointment/search
curl -X POST http://localhost:5050/api/insurance/verify
# ...etc
```

When called this way (no `sentry-trace` header), the backend starts its own
transaction so the span still ships, just without a frontend parent.
