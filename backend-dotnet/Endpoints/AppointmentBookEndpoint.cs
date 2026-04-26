using HealthcareApi.Services;
using Sentry;

namespace HealthcareApi.Endpoints;

public record BookBackendRequest(
    string? appointmentId,
    string? providerId,
    string? integration,
    string? apptType,
    string? searchId,
    string? appointmentValueUsdBucket,
    int? retryAttempt,
    string? patientTenureBucket
);

public static class AppointmentBookEndpoint
{
    public static IEndpointRouteBuilder MapAppointmentBook(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/appointment/book", async (BookBackendRequest? req) =>
        {
            var span = SpanHelpers.StartBackendSpan("appointment.book.backend");
            try
            {
                var failure = await FailureInjector.InjectAsync(new FailureOpts(
                    SlowRate: 0.06,
                    ErrorRate: 0.025,
                    ErrorCodes: new[] { "EHR_TIMEOUT", "EHR_5XX", "DB_DEADLOCK", "IDEMPOTENCY_COLLISION" },
                    OkMinMs: 400,
                    OkMaxMs: 1500,
                    SlowAddMinMs: 1500,
                    SlowAddMaxMs: 8000));

                var ehrCalls = Random.Shared.Next(1, 4);
                var ehrStatus = DataGenerators.Pick(DataGenerators.EhrStatusCodes);
                var idempotency = DataGenerators.Pick(DataGenerators.IdempotencyResults);

                span.SetAttr("db.system.name", "postgres");
                span.SetAttr("downstream.ehr_call_count", DataGenerators.BucketEhrCount(ehrCalls));
                span.SetAttr("downstream.ehr_status_code", ehrStatus);
                span.SetAttr("idempotency_check_result", idempotency);
                span.SetAttr("status", failure.Outcome.ToString().ToLowerInvariant());
                span.SetAttr("error_code", failure.ErrorCode);
                span.SetAttr("latency_ms_bucket", BucketLatency(failure.LatencyMs));
                // Forwarded fields — set only when present so curl-direct tests
                // (no body) still produce a valid span.
                if (!string.IsNullOrEmpty(req?.appointmentValueUsdBucket))
                {
                    span.SetAttr("appointment_value_usd_bucket", req.appointmentValueUsdBucket);
                }
                if (req?.retryAttempt is int retry)
                {
                    span.SetAttr("retry_attempt", retry);
                }
                if (!string.IsNullOrEmpty(req?.patientTenureBucket))
                {
                    span.SetAttr("patient_tenure_bucket", req.patientTenureBucket);
                }

                if (failure.Outcome == FailureOutcome.Error)
                {
                    span.Status = SpanStatus.InternalError;
                    SentrySdk.CaptureException(new Exception($"appointment.book.backend injected: {failure.ErrorCode}"));
                    return Results.StatusCode(503);
                }

                return Results.Ok(new { status = failure.Outcome.ToString().ToLowerInvariant() });
            }
            finally
            {
                span.Finish();
            }
        });
        return app;
    }

    private static string BucketLatency(int ms)
    {
        if (ms < 500) return "0-500";
        if (ms < 1500) return "500-1500";
        if (ms < 5000) return "1500-5000";
        if (ms < 15000) return "5000-15000";
        return "15000+";
    }
}
