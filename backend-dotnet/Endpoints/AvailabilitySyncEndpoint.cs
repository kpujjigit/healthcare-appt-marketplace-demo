using HealthcareApi.Services;
using Sentry;

namespace HealthcareApi.Endpoints;

public static class AvailabilitySyncEndpoint
{
    public static IEndpointRouteBuilder MapAvailabilitySync(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/availability/sync", async () =>
        {
            var span = SpanHelpers.StartBackendSpan("availability.sync.backend");
            try
            {
                var failure = await FailureInjector.InjectAsync(new FailureOpts(
                    SlowRate: 0.07,
                    ErrorRate: 0.03,
                    ErrorCodes: new[] { "EHR_RATE_LIMIT", "WEBHOOK_RETRY_EXHAUSTED", "QUEUE_BACKPRESSURE" },
                    OkMinMs: 150,
                    OkMaxMs: 1200,
                    SlowAddMinMs: 2000,
                    SlowAddMaxMs: 30000));

                var queueLag = DataGenerators.Pick(DataGenerators.QueueLagBuckets);
                var ehrStatus = DataGenerators.Pick(DataGenerators.EhrStatusCodes);

                span.SetAttr("queue.system.name", "kafka");
                span.SetAttr("queue.lag_ms_bucket", queueLag);
                span.SetAttr("downstream.ehr_status_code", ehrStatus);
                span.SetAttr("status", failure.Outcome.ToString().ToLowerInvariant());
                span.SetAttr("error_code", failure.ErrorCode);
                span.SetAttr("latency_ms_bucket", BucketLatency(failure.LatencyMs));

                if (failure.Outcome == FailureOutcome.Error)
                {
                    span.Status = SpanStatus.InternalError;
                    SentrySdk.CaptureException(new Exception($"availability.sync.backend injected: {failure.ErrorCode}"));
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
        if (ms < 60000) return "10000-60000";
        return "60000+";
    }
}
