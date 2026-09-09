export default function HomePage() {
  return (
    <main style={{ maxWidth: 760, margin: "60px auto", padding: "0 24px", lineHeight: 1.6 }}>
      <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "#1e293b", color: "#38bdf8", fontSize: "0.875rem", fontWeight: 600, marginBottom: 16 }}>
        Channel Vigil Bot Service
      </div>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 800, margin: "0 0 16px 0", color: "#f8fafc" }}>
        Telegram Channel Webhook Active
      </h1>
      <p style={{ color: "#94a3b8", fontSize: "1.125rem", margin: "0 0 32px 0" }}>
        Production-grade Telegram Bot webhook listener monitoring channel joins, leaves, and join requests with timing-safe authentication.
      </p>

      <div style={{ background: "#1e293b", borderRadius: 12, padding: 24, border: "1px solid #334155" }}>
        <h3 style={{ margin: "0 0 12px 0", color: "#e2e8f0" }}>Webhook Endpoint</h3>
        <code style={{ background: "#0f172a", padding: "8px 12px", borderRadius: 6, color: "#38bdf8", display: "block", wordBreak: "break-all" }}>
          POST /api/telegram/webhook
        </code>
        <p style={{ margin: "12px 0 0 0", color: "#94a3b8", fontSize: "0.9rem" }}>
          Secured with <code>X-Telegram-Bot-Api-Secret-Token</code> header validation.
        </p>
      </div>
    </main>
  );
}
