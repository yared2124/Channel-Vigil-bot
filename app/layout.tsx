import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Telegram Channel Vigil Bot",
  description: "Real-time Telegram Channel Member Join/Leave Notification Webhook Service",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", margin: 0, padding: 0, backgroundColor: "#0f172a", color: "#f8fafc" }}>
        {children}
      </body>
    </html>
  );
}
