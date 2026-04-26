namespace HealthcareApi.Services;

// Synthetic data generators mirroring the frontend's lib/data.ts. The two
// tiers must agree on attribute values — same span attribute names, same
// bucket boundaries — so a join across the trace stays consistent.
public static class DataGenerators
{
    private static readonly Random Rng = new();

    public static T Pick<T>(IReadOnlyList<T> arr) => arr[Rng.Next(arr.Count)];

    public static readonly IReadOnlyList<string> ProviderIntegrationTypes = new[]
    {
        "epic", "athena", "eclinicalworks", "cerner", "native"
    };

    public static readonly IReadOnlyList<string> CacheLayers = new[] { "l1", "l2", "miss" };
    public static readonly IReadOnlyList<string> AvailityStatusCodes = new[] { "200", "5xx", "timeout" };
    public static readonly IReadOnlyList<string> EhrStatusCodes = new[] { "200", "429", "5xx", "timeout" };
    public static readonly IReadOnlyList<string> IdempotencyResults = new[] { "fresh", "replay", "collision" };
    public static readonly IReadOnlyList<string> S3Statuses = new[] { "200", "5xx", "timeout" };
    public static readonly IReadOnlyList<string> OcrConfidenceBuckets = new[] { "0-50", "50-80", "80-95", "95-100" };
    public static readonly IReadOnlyList<string> QueueLagBuckets = new[] { "0-100", "100-1000", "1000-10000", "10000+" };

    public static string BucketDbQueryCount(int n)
    {
        if (n == 0) return "0";
        if (n <= 5) return "1-5";
        if (n <= 20) return "6-20";
        return "20+";
    }

    public static string BucketDownstreamCount(int n)
    {
        if (n == 0) return "0";
        if (n <= 5) return "1-5";
        if (n <= 20) return "6-20";
        return "20+";
    }

    public static string BucketAvailityCount(int n)
    {
        if (n == 0) return "0";
        if (n == 1) return "1";
        if (n <= 5) return "2-5";
        return "5+";
    }

    public static string BucketEhrCount(int n)
    {
        if (n == 0) return "0";
        if (n == 1) return "1";
        return "2-5";
    }

    // Latency of the fan-out to the availability service, separate from the
    // total span latency. Together with downstream.availability_fanout_count,
    // this distinguishes "fanned out to too many" from "each call was slow."
    public static string BucketFanoutLatencyMs(int ms)
    {
        if (ms < 50) return "0-50";
        if (ms < 200) return "50-200";
        if (ms < 500) return "200-500";
        if (ms < 1500) return "500-1500";
        return "1500+";
    }
}
