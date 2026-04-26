export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 720 }}>
      <h1>Healthcare Appointment Marketplace — Sentry Demo</h1>
      <p>
        This sample app instruments a healthcare appointment marketplace's critical
        user experiences with Sentry custom spans.
      </p>
      <p>
        Run <code>npm run load</code> in another terminal to generate synthetic span
        data, then open Sentry to see the resulting traces and dashboards.
      </p>
      <h2>Instrumented routes</h2>
      <ul>
        <li>
          <code>POST /api/appointment/search</code> — span <code>appointment.search</code>
        </li>
        <li>
          <code>POST /api/insurance/verify</code> — span <code>insurance.verify</code>
        </li>
        <li>
          <code>POST /api/appointment/book</code> — span <code>appointment.book</code>
        </li>
        <li>
          <code>POST /api/availability/sync</code> — span <code>availability.sync</code>
        </li>
        <li>
          <code>POST /api/intake/submit</code> — span <code>intake.submit</code>
        </li>
      </ul>
      <p>
        When <code>BACKEND_URL</code> is set and the .NET backend is running, each route
        also emits a child span (<code>*.backend</code>) in the backend project for the
        full distributed-trace story.
      </p>
    </main>
  );
}
