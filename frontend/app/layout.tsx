export const metadata = {
  title: "Healthcare Appointment Marketplace Demo",
  description: "Sentry custom span instrumentation demo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
