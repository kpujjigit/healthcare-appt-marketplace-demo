import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import {
  pick,
  uuid,
  SPECIALTY_TYPES,
  INSURANCE_CARRIERS,
  GEO_MARKETS,
  bucketResultCount,
  bucketLatencyMs,
  randomPatientTenure,
  searchSloBreach,
} from "@/lib/data";
import { injectFailure } from "@/lib/inject-failure";

const ERROR_CODES = ["INDEX_TIMEOUT", "AVAIL_FANOUT_FAIL", "PLAN_FILTER_OOM"] as const;

export async function POST() {
  const userId = uuid();
  const sessionId = uuid();
  const searchId = uuid();
  const specialty = pick(SPECIALTY_TYPES);
  const carrier = pick(INSURANCE_CARRIERS);
  const geo = pick(GEO_MARKETS);
  const patientTenure = randomPatientTenure();

  return await Sentry.startSpan(
    {
      name: "appointment.search",
      op: "http.server",
      attributes: {
        user_id: userId,
        session_id: sessionId,
        search_id: searchId,
        specialty_type: specialty,
        insurance_carrier: carrier,
        geo_market: geo,
        patient_tenure_bucket: patientTenure,
      },
    },
    async (span) => {
      const failure = await injectFailure({
        errorCodes: ERROR_CODES,
        okMinMs: 80,
        okMaxMs: 350,
        slowAddMinMs: 600,
        slowAddMaxMs: 2200,
      });

      const resultCount = failure.outcome === "ok"
        ? Math.floor(Math.random() * 60)
        : failure.outcome === "slow"
          ? Math.floor(Math.random() * 30)
          : 0;

      span.setAttribute("status", failure.outcome === "error" ? "error" : failure.outcome === "slow" ? "slow" : "ok");
      span.setAttribute("error_code", failure.errorCode);
      span.setAttribute("latency_ms_bucket", bucketLatencyMs(failure.latencyMs));
      span.setAttribute("result_count_bucket", bucketResultCount(resultCount));
      span.setAttribute(
        "slo_breach",
        searchSloBreach(failure.outcome, resultCount, failure.latencyMs),
      );

      // Forward to backend; falls back to synthetic if backend not reachable.
      await callBackend(
        "/api/appointment/search",
        {
          searchId,
          specialty,
          carrier,
          geo,
          patientTenureBucket: patientTenure,
        },
        () => ({ ok: true, source: "synthetic" }),
      );

      if (failure.outcome === "error") {
        Sentry.captureException(new Error(`appointment.search injected: ${failure.errorCode}`));
        return NextResponse.json({ status: "error", error_code: failure.errorCode }, { status: 503 });
      }

      return NextResponse.json({
        status: failure.outcome,
        result_count: resultCount,
        search_id: searchId,
      });
    },
  );
}
