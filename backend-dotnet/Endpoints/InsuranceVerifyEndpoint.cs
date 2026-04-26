using HealthcareApi.Services;
using Sentry;

namespace HealthcareApi.Endpoints;

public record VerifyBackendRequest(
    string? verificationId,
    string? carrier,
    string? planType,
    string? verificationPath,
    string? patientTenureBucket
);

public static class InsuranceVerifyEndpoint
{
    public static IEndpointRouteBuilder MapInsuranceVerify(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/insurance/verify", async (VerifyBackendRequest? req) =>
        {
            var span = SpanHelpers.StartBackendSpan("insurance.verify.backend");
            try
            {
                var failure = await FailureInjector.InjectAsync(new FailureOpts(
                    SlowRate: 0.05,
                    ErrorRate: 0.025,
                    ErrorCodes: new[] { "AVAILITY_TIMEOUT", "AVAILITY_5XX", "PLAN_MAPPING_MISS" },
                    OkMinMs: 200,
                    OkMaxMs: 800,
                    SlowAddMinMs: 1000,
                    SlowAddMaxMs: 4000));

                var availityCalls = Random.Shared.Next(0, 4);
                var availityStatus = DataGenerators.Pick(DataGenerators.AvailityStatusCodes);
                var cacheLayer = DataGenerators.Pick(DataGenerators.CacheLayers);
                // Retry count: a `200` response with call_count=3 means two retries
                // succeeded silently. Without this, real-time latency tail looks
                // mysteriously high. Skew toward 0 retries on 200, more on errors.
                var availityRetries = availityStatus == "200"
                    ? (Random.Shared.NextDouble() < 0.85 ? 0 : Random.Shared.Next(1, 3))
                    : Random.Shared.Next(1, 4);

                span.SetAttr("downstream.availity_call_count", DataGenerators.BucketAvailityCount(availityCalls));
                span.SetAttr("downstream.availity_status_code", availityStatus);
                span.SetAttr("downstream.availity_retry_count", availityRetries);
                span.SetAttr("cache_layer", cacheLayer);
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
                    SentrySdk.CaptureException(new Exception($"insurance.verify.backend injected: {failure.ErrorCode}"));
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
        if (ms < 200) return "0-200";
        if (ms < 500) return "200-500";
        if (ms < 1500) return "500-1500";
        if (ms < 5000) return "1500-5000";
        return "5000+";
    }
}
