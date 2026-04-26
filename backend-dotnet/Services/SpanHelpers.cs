using Sentry;

namespace HealthcareApi.Services;

// Helper for emitting backend child spans on the active transaction. The
// ASP.NET Core Sentry middleware reads sentry-trace + baggage from the
// incoming request and attaches a transaction to the scope automatically;
// our child spans become children of that transaction.
public static class SpanHelpers
{
    public static ISpan StartBackendSpan(string name)
    {
        var parent = SentrySdk.GetSpan();
        if (parent != null)
        {
            return parent.StartChild(name, "http.server");
        }
        // Fallback: no incoming transaction. Start one ourselves so the span
        // doesn't get dropped (e.g. when the backend is hit directly without
        // a sentry-trace header).
        var transaction = SentrySdk.StartTransaction(name, "http.server");
        SentrySdk.ConfigureScope(s => s.Transaction = transaction);
        return transaction;
    }

    public static void SetAttr(this ISpan span, string key, string value) =>
        span.SetExtra(key, value);

    public static void SetAttr(this ISpan span, string key, bool value) =>
        span.SetExtra(key, value);

    public static void SetAttr(this ISpan span, string key, int value) =>
        span.SetExtra(key, value);
}
