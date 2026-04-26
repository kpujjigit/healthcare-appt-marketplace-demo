namespace HealthcareApi.Services;

public enum FailureOutcome { Ok, Slow, Error }

public record InjectionResult(FailureOutcome Outcome, int LatencyMs, string ErrorCode);

public record FailureOpts(
    double SlowRate,
    double ErrorRate,
    IReadOnlyList<string> ErrorCodes,
    int OkMinMs,
    int OkMaxMs,
    int SlowAddMinMs,
    int SlowAddMaxMs);

public static class FailureInjector
{
    private static readonly Random Rng = new();

    public static async Task<InjectionResult> InjectAsync(FailureOpts opts)
    {
        var baseMs = opts.OkMinMs + Rng.NextDouble() * (opts.OkMaxMs - opts.OkMinMs);
        var r = Rng.NextDouble();

        if (r < opts.ErrorRate)
        {
            var errorCode = opts.ErrorCodes.Count > 0
                ? opts.ErrorCodes[Rng.Next(opts.ErrorCodes.Count)]
                : "UNKNOWN";
            await Task.Delay((int)baseMs);
            return new InjectionResult(FailureOutcome.Error, (int)baseMs, errorCode);
        }

        if (r < opts.ErrorRate + opts.SlowRate)
        {
            var slowAdd = opts.SlowAddMinMs + Rng.NextDouble() * (opts.SlowAddMaxMs - opts.SlowAddMinMs);
            var total = baseMs + slowAdd;
            await Task.Delay((int)total);
            return new InjectionResult(FailureOutcome.Slow, (int)total, "NONE");
        }

        await Task.Delay((int)baseMs);
        return new InjectionResult(FailureOutcome.Ok, (int)baseMs, "NONE");
    }
}
