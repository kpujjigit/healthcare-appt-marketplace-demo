import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import {
  pick,
  uuid,
  PROVIDER_INTEGRATION_TYPES,
  APPOINTMENT_TYPES,
  GEO_MARKETS,
  bucketLatencyBook,
  bucketLeadTimeHours,
  randomLeadTimeHours,
  bucketAppointmentValueUsd,
  randomAppointmentValueUsd,
  bucketSlotLockMs,
  randomSlotLockMs,
} from "@/lib/data";
import { injectFailure } from "@/lib/inject-failure";

const ERROR_CODES = [
  "SLOT_RACE",
  "EHR_TIMEOUT",
  "EHR_5XX",
  "IDEMPOTENCY_COLLISION",
  "INTAKE_INCOMPLETE",
] as const;

export async function POST() {
  const userId = uuid();
  const appointmentId = uuid();
  const providerId = uuid();
  // search_id propagates from the originating search span so the booking
  // funnel can be reconstructed (search → verify → book → intake) for
  // conversion-rate widgets in dashboards.
  const searchId = uuid();
  const integration = pick(PROVIDER_INTEGRATION_TYPES);
  const apptType = pick(APPOINTMENT_TYPES);
  const isNewPatient = Math.random() < 0.4;
  const leadTimeHours = randomLeadTimeHours();
  const geo = pick(GEO_MARKETS);
  const apptValueUsd = randomAppointmentValueUsd();

  return await Sentry.startSpan(
    {
      name: "appointment.book",
      op: "http.server",
      attributes: {
        user_id: userId,
        appointment_id: appointmentId,
        provider_id: providerId,
        search_id: searchId,
        provider_integration_type: integration,
        appointment_type: apptType,
        is_new_patient: isNewPatient,
        lead_time_bucket: bucketLeadTimeHours(leadTimeHours),
        geo_market: geo,
        appointment_value_usd_bucket: bucketAppointmentValueUsd(apptValueUsd),
      },
    },
    async (span) => {
      // EHR push dominates real-world latency. Epic + athena are slower in
      // practice; native is fast. Skew the band per integration to make
      // dashboards interesting.
      const okBand =
        integration === "epic" || integration === "athena"
          ? { min: 800, max: 2200 }
          : integration === "native"
            ? { min: 200, max: 600 }
            : { min: 500, max: 1500 };

      const failure = await injectFailure({
        // Slightly higher slow rate for EHR-backed integrations.
        slowRate: integration === "native" ? 0.03 : 0.08,
        errorRate: 0.025,
        errorCodes: ERROR_CODES,
        okMinMs: okBand.min,
        okMaxMs: okBand.max,
        slowAddMinMs: 1500,
        slowAddMaxMs: 8000,
      });

      const bookStatus =
        failure.outcome === "error"
          ? failure.errorCode === "SLOT_RACE"
            ? "slot_lost"
            : failure.errorCode.startsWith("EHR_")
              ? "ehr_push_failed"
              : "error"
          : "confirmed";

      span.setAttribute("status", bookStatus);
      span.setAttribute("error_code", failure.errorCode);
      span.setAttribute("latency_ms_bucket", bucketLatencyBook(failure.latencyMs));
      // slot_lock_duration_ms_bucket: how long the booking flow held the slot lock
      // before confirming or losing it. Together with status="slot_lost" this
      // surfaces lock-TTL tuning data.
      span.setAttribute(
        "slot_lock_duration_ms_bucket",
        bucketSlotLockMs(randomSlotLockMs(failure.outcome)),
      );

      await callBackend(
        "/api/appointment/book",
        { appointmentId, providerId, integration, apptType, searchId },
        () => ({ ok: true, source: "synthetic" }),
      );

      if (failure.outcome === "error") {
        Sentry.captureException(new Error(`appointment.book injected: ${failure.errorCode}`));
        return NextResponse.json({ status: bookStatus, error_code: failure.errorCode }, { status: 503 });
      }

      return NextResponse.json({ status: bookStatus, appointment_id: appointmentId });
    },
  );
}
