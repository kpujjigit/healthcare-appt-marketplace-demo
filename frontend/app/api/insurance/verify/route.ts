import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import {
  pick,
  uuid,
  INSURANCE_CARRIERS,
  PLAN_TYPES,
  bucketLatencyVerify,
} from "@/lib/data";
import { injectFailure } from "@/lib/inject-failure";

const ERROR_CODES = ["AVAILITY_TIMEOUT", "AVAILITY_5XX", "PLAN_MAPPING_MISS", "MEMBER_ID_INVALID"] as const;
const VERIFICATION_PATHS = ["realtime_270", "cached_24h", "manual_fallback"] as const;

export async function POST() {
  const userId = uuid();
  const verificationId = uuid();
  const carrier = pick(INSURANCE_CARRIERS);
  const planType = pick(PLAN_TYPES);
  const verificationPath = pick(VERIFICATION_PATHS);
  const isMemberIdVerified = Math.random() > 0.1;

  return await Sentry.startSpan(
    {
      name: "insurance.verify",
      op: "http.server",
      attributes: {
        user_id: userId,
        verification_id: verificationId,
        insurance_carrier: carrier,
        plan_type: planType,
        is_member_id_verified: isMemberIdVerified,
        verification_path: verificationPath,
      },
    },
    async (span) => {
      // Cached path is fast; realtime is slower; manual_fallback is slowest.
      const okBand =
        verificationPath === "cached_24h"
          ? { min: 30, max: 100 }
          : verificationPath === "realtime_270"
            ? { min: 250, max: 900 }
            : { min: 1500, max: 4500 };

      const failure = await injectFailure({
        errorCodes: ERROR_CODES,
        okMinMs: okBand.min,
        okMaxMs: okBand.max,
        slowAddMinMs: 1000,
        slowAddMaxMs: 4000,
      });

      // Verification may "pass through" as unverified_proceed under stress.
      const verifyStatus =
        failure.outcome === "error"
          ? "error"
          : failure.outcome === "slow" && Math.random() < 0.3
            ? "unverified_proceed"
            : Math.random() < 0.05
              ? "not_verified"
              : "verified";

      span.setAttribute("status", verifyStatus);
      span.setAttribute("error_code", failure.errorCode);
      span.setAttribute("latency_ms_bucket", bucketLatencyVerify(failure.latencyMs));

      await callBackend(
        "/api/insurance/verify",
        { verificationId, carrier, planType, verificationPath },
        () => ({ ok: true, source: "synthetic" }),
      );

      if (failure.outcome === "error") {
        Sentry.captureException(new Error(`insurance.verify injected: ${failure.errorCode}`));
        return NextResponse.json({ status: "error", error_code: failure.errorCode }, { status: 503 });
      }

      return NextResponse.json({ status: verifyStatus, verification_id: verificationId });
    },
  );
}
