using HealthcareApi.Services;
using Sentry;

namespace HealthcareApi.Endpoints;

public static class InsuranceVerifyEndpoint
{
    public static IEndpointRouteBuilder MapInsuranceVerify(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/insurance/verify", async () =>
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

                span.SetAttr("downstream.availity_call_count", DataGenerators.BucketAvailityCount(availityCalls));
                span.SetAttr("downstream.availity_status_code", availityStatus);
                span.SetAttr("cache_layer", cacheLayer);
                span.SetAttr("status", failure.Outcome.ToString().ToLowerInvariant());
                span.SetAttr("error_code", failure.ErrorCode);
                span.SetAttr("latency_ms_bucket", BucketLatency(failure.LatencyMs));

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
