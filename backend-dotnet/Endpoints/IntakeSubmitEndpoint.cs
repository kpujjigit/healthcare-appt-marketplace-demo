using HealthcareApi.Services;
using Sentry;

namespace HealthcareApi.Endpoints;

public record IntakeBackendRequest(
    string? intakeId,
    string? appointmentId,
    string? clientPlatform,
    string? formStep,
    int? uploadSize,
    string? patientTenureBucket
);

public static class IntakeSubmitEndpoint
{
    public static IEndpointRouteBuilder MapIntakeSubmit(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/intake/submit", async (IntakeBackendRequest? req) =>
        {
            var span = SpanHelpers.StartBackendSpan("intake.submit.backend");
            try
            {
                var failure = await FailureInjector.InjectAsync(new FailureOpts(
                    SlowRate: 0.06,
                    ErrorRate: 0.025,
                    ErrorCodes: new[] { "S3_UPLOAD_FAIL", "OCR_TIMEOUT", "OCR_LOW_CONFIDENCE", "DB_TIMEOUT" },
                    OkMinMs: 250,
                    OkMaxMs: 1500,
                    SlowAddMinMs: 2500,
                    SlowAddMaxMs: 12000));

                var s3Status = DataGenerators.Pick(DataGenerators.S3Statuses);
                var ocrConfidence = DataGenerators.Pick(DataGenerators.OcrConfidenceBuckets);

                span.SetAttr("s3.upload_status", s3Status);
                span.SetAttr("ocr.confidence_bucket", ocrConfidence);
                span.SetAttr("db.system.name", "postgres");
                span.SetAttr("status", failure.Outcome.ToString().ToLowerInvariant());
                span.SetAttr("error_code", failure.ErrorCode);
                span.SetAttr("latency_ms_bucket", BucketLatency(failure.LatencyMs));
                if (!string.IsNullOrEmpty(req?.patientTenureBucket))
                {
                    span.SetAttr("patient_tenure_bucket", req.patientTenureBucket);
                }

                if (failure.Outcome == FailureOutcome.Error)
                {
                    span.Status = SpanStatus.InternalError;
                    SentrySdk.CaptureException(new Exception($"intake.submit.backend injected: {failure.ErrorCode}"));
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
        if (ms < 2000) return "500-2000";
        if (ms < 10000) return "2000-10000";
        if (ms < 30000) return "10000-30000";
        return "30000+";
    }
}
