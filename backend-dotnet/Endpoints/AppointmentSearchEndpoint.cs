using HealthcareApi.Services;
using Sentry;

namespace HealthcareApi.Endpoints;

public record SearchBackendRequest(
    string? searchId,
    string? specialty,
    string? carrier,
    string? geo,
    string? patientTenureBucket
);

public static class AppointmentSearchEndpoint
{
    public static IEndpointRouteBuilder MapAppointmentSearch(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/appointment/search", async (SearchBackendRequest? req) =>
        {
            var span = SpanHelpers.StartBackendSpan("appointment.search.backend");
            try
            {
                var failure = await FailureInjector.InjectAsync(new FailureOpts(
                    SlowRate: 0.05,
                    ErrorRate: 0.02,
                    ErrorCodes: new[] { "INDEX_TIMEOUT", "DB_TIMEOUT", "AVAIL_FANOUT_FAIL" },
                    OkMinMs: 30,
                    OkMaxMs: 200,
                    SlowAddMinMs: 400,
                    SlowAddMaxMs: 1500));

                var cacheHit = Random.Shared.NextDouble() < 0.55;
                var dbQueryCount = cacheHit ? 0 : Random.Shared.Next(1, 25);
                var fanoutCount = Random.Shared.Next(1, 30);
                // Fan-out latency is independent of fanout count — together they
                // distinguish "many providers but each fast" from "few providers
                // but each slow." Cache hits skip the fan-out entirely.
                var fanoutLatencyMs = cacheHit
                    ? Random.Shared.Next(0, 30)
                    : Random.Shared.Next(40, 1800);

                // is_peak_hours: cache hit rates and fanout latency behave
                // differently at peak (US daytime UTC) vs off-peak. Computed
                // server-side from current UTC hour. Stringified for indexer.
                var hourUtc = DateTime.UtcNow.Hour;
                var isPeakHours = hourUtc >= 13 && hourUtc <= 23; // 9am-7pm ET-ish

                span.SetAttr("backend.cache_hit", cacheHit);
                span.SetAttr("db.system.name", "postgres");
                span.SetAttr("db.query_count_bucket", DataGenerators.BucketDbQueryCount(dbQueryCount));
                span.SetAttr("downstream.availability_fanout_count", DataGenerators.BucketDownstreamCount(fanoutCount));
                span.SetAttr("downstream.availability_fanout_latency_ms_bucket", DataGenerators.BucketFanoutLatencyMs(fanoutLatencyMs));
                span.SetAttr("is_peak_hours", isPeakHours);
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
                    SentrySdk.CaptureException(new Exception($"appointment.search.backend injected: {failure.ErrorCode}"));
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
        if (ms < 1000) return "500-1000";
        if (ms < 3000) return "1000-3000";
        return "3000+";
    }
}
