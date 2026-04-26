import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import {
  pick,
  uuid,
  CLIENT_PLATFORMS,
  FORM_STEPS,
  bucketUploadBytes,
  bucketLatencyIntake,
  randomUploadBytes,
} from "@/lib/data";
import { injectFailure } from "@/lib/inject-failure";

const ERROR_CODES = [
  "S3_UPLOAD_FAIL",
  "OCR_TIMEOUT",
  "OCR_LOW_CONFIDENCE",
  "VALIDATION_REGEX",
  "NETWORK_FLAP",
] as const;

export async function POST() {
  const userId = uuid();
  const intakeId = uuid();
  const appointmentId = uuid();
  const clientPlatform = pick(CLIENT_PLATFORMS);
  const formStep = pick(FORM_STEPS);
  const uploadSize = randomUploadBytes();
  const isResubmission = Math.random() < 0.15;

  return await Sentry.startSpan(
    {
      name: "intake.submit",
      op: "http.server",
      attributes: {
        user_id: userId,
        intake_id: intakeId,
        appointment_id: appointmentId,
        client_platform: clientPlatform,
        form_step: formStep,
        upload_size_bucket: bucketUploadBytes(uploadSize),
        is_resubmission: isResubmission,
      },
    },
    async (span) => {
      // Mobile platforms are slower on upload; large uploads are slower.
      const platformBoost = clientPlatform === "ios" || clientPlatform === "android" ? 1.3 : 1.0;
      const sizeBoost = uploadSize > 1_000_000 ? 1.5 : 1.0;
      const okMin = Math.round(200 * platformBoost * sizeBoost);
      const okMax = Math.round(1500 * platformBoost * sizeBoost);

      const failure = await injectFailure({
        slowRate: 0.07,
        errorRate: 0.025,
        errorCodes: ERROR_CODES,
        okMinMs: okMin,
        okMaxMs: okMax,
        slowAddMinMs: 2500,
        slowAddMaxMs: 12_000,
      });

      const intakeStatus =
        failure.outcome === "error"
          ? failure.errorCode === "VALIDATION_REGEX" || failure.errorCode === "OCR_LOW_CONFIDENCE"
            ? "validation_failed"
            : failure.errorCode === "S3_UPLOAD_FAIL" || failure.errorCode === "NETWORK_FLAP"
              ? "upload_failed"
              : "error"
          : "submitted";

      span.setAttribute("status", intakeStatus);
      span.setAttribute("error_code", failure.errorCode);
      span.setAttribute("latency_ms_bucket", bucketLatencyIntake(failure.latencyMs));

      await callBackend(
        "/api/intake/submit",
        { intakeId, appointmentId, clientPlatform, formStep, uploadSize },
        () => ({ ok: true, source: "synthetic" }),
      );

      if (failure.outcome === "error") {
        Sentry.captureException(new Error(`intake.submit injected: ${failure.errorCode}`));
        return NextResponse.json({ status: intakeStatus, error_code: failure.errorCode }, { status: 503 });
      }

      return NextResponse.json({ status: intakeStatus, intake_id: intakeId });
    },
  );
}
