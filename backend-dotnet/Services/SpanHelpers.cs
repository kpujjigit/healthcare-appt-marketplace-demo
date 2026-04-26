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

    // Sentry .NET 5+ uses SetData for span attributes (SetExtra is event-level).
    public static void SetAttr(this ISpan span, string key, string value) =>
        span.SetData(key, value);

    // Stringify booleans explicitly. Sentry .NET 6's SetData persists bools but
    // Sentry's span-attribute indexer treats string enums more reliably for
    // dashboard group-by — booleans sometimes don't show up as a queryable
    // attribute. Pinning to "true"/"false" string makes group-by widgets work.
    public static void SetAttr(this ISpan span, string key, bool value) =>
        span.SetData(key, value ? "true" : "false");

    public static void SetAttr(this ISpan span, string key, int value) =>
        span.SetData(key, value);
}
