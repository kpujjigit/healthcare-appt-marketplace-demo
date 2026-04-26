using DotNetEnv;
using HealthcareApi.Endpoints;

// Load .env (DSN, environment, port). Skip silently if missing — appsettings
// can also supply these via the environment.
Env.TraversePath().Load();

var builder = WebApplication.CreateBuilder(args);

var dsn = Environment.GetEnvironmentVariable("SENTRY_DSN");
var environment = Environment.GetEnvironmentVariable("SENTRY_ENVIRONMENT") ?? "demo";

if (string.IsNullOrWhiteSpace(dsn))
{
    Console.Error.WriteLine(
        "WARN: SENTRY_DSN is not set. The backend will run but no spans will be ingested. " +
        "Set it in backend-dotnet/.env or export it before `dotnet run`.");
}

builder.WebHost.UseSentry(options =>
{
    options.Dsn = dsn;
    options.Environment = environment;
    options.TracesSampleRate = 1.0;
    options.SendDefaultPii = false;
    options.AutoSessionTracking = false;
});

var app = builder.Build();

app.MapGet("/", () => "Healthcare Appointment Marketplace — backend tier (.NET 8)");
app.MapGet("/health", () => Results.Ok(new { ok = true }));

app.MapAppointmentSearch();
app.MapInsuranceVerify();
app.MapAppointmentBook();
app.MapAvailabilitySync();
app.MapIntakeSubmit();

var port = Environment.GetEnvironmentVariable("PORT") ?? "5050";
app.Run($"http://0.0.0.0:{port}");
