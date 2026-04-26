import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { pick, uuid, PROVIDER_INTEGRATION_TYPES } from "@/lib/data";
import { injectFailure } from "@/lib/inject-failure";

const ERROR_CODES = [
  "EHR_RATE_LIMIT",
  "WEBHOOK_RETRY_EXHAUSTED",
  "CLOCK_SKEW",
  "QUEUE_BACKPRESSURE",
] as const;

const SYNC_DIRECTIONS = ["inbound_webhook", "outbound_poll", "manual_force"] as const;

function bucketSlotDelta(n: number): string {
  if (n === 0) return "0";
  if (n <= 10) return "1-10";
  if (n <= 50) return "11-50";
  if (n <= 200) return "51-200";
  return "200+";
}

function bucketStalenessMs(ms: number): string {
  if (ms < 60_000) return "0-60s";
  if (ms < 5 * 60_000) return "60s-5m";
  if (ms < 30 * 60_000) return "5m-30m";
  if (ms < 2 * 60 * 60_000) return "30m-2h";
  return "2h+";
}

function bucketSyncLatency(ms: number): string {
  if (ms < 500) return "0-500";
  if (ms < 2000) return "500-2000";
  if (ms < 10_000) return "2000-10000";
  if (ms < 60_000) return "10000-60000";
  return "60000+";
}

export async function POST() {
  const providerId = uuid();
  const syncId = uuid();
  const integration = pick(PROVIDER_INTEGRATION_TYPES);
  const direction = pick(SYNC_DIRECTIONS);
  const slotDelta = Math.floor(Math.random() * 250);
  const stalenessMs = Math.floor(Math.random() * 4 * 60 * 60_000); // 0..4h

  return await Sentry.startSpan(
    {
      name: "availability.sync",
      op: "http.server",
      attributes: {
        provider_id: providerId,
        sync_id: syncId,
        provider_integration_type: integration,
        sync_direction: direction,
        slot_delta_bucket: bucketSlotDelta(slotDelta),
        staleness_ms_bucket: bucketStalenessMs(stalenessMs),
      },
    },
    async (span) => {
      const failure = await injectFailure({
        slowRate: 0.07,
        errorRate: 0.03,
        errorCodes: ERROR_CODES,
        okMinMs: 200,
        okMaxMs: 1500,
        slowAddMinMs: 2000,
        slowAddMaxMs: 30_000,
      });

      const syncStatus =
        failure.outcome === "error"
          ? failure.errorCode === "EHR_RATE_LIMIT"
            ? "rate_limited"
            : "error"
          : failure.outcome === "slow" && Math.random() < 0.4
            ? "partial"
            : "ok";

      span.setAttribute("status", syncStatus);
      span.setAttribute("error_code", failure.errorCode);
      span.setAttribute("latency_ms_bucket", bucketSyncLatency(failure.latencyMs));

      await callBackend(
        "/api/availability/sync",
        {
          syncId,
          providerId,
          integration,
          direction,
          slotDeltaBucket: bucketSlotDelta(slotDelta),
        },
        () => ({ ok: true, source: "synthetic" }),
      );

      if (failure.outcome === "error") {
        Sentry.captureException(new Error(`availability.sync injected: ${failure.errorCode}`));
        return NextResponse.json({ status: syncStatus, error_code: failure.errorCode }, { status: 503 });
      }

      return NextResponse.json({ status: syncStatus, sync_id: syncId });
    },
  );
}
