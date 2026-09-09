import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN;

if (!BOT_TOKEN) {
  console.error("❌ Error: TELEGRAM_BOT_TOKEN is missing in environment.");
  process.exit(1);
}

const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function setWebhook() {
  if (!WEBHOOK_URL) {
    console.error("❌ Error: WEBHOOK_URL is missing in .env (e.g. https://xxxx.ngrok-free.app/api/telegram/webhook)");
    process.exit(1);
  }

  console.log(`📡 Registering webhook with Telegram...`);
  console.log(`🔗 Target URL: ${WEBHOOK_URL}`);
  console.log(`🔐 Secret Token: ${SECRET_TOKEN ? "Configured (Hidden)" : "None"}`);

  // CRITICAL: chat_member and chat_join_request are NOT delivered unless explicitly listed in allowed_updates!
  const allowedUpdates = [
    "chat_member",
    "chat_join_request",
    "my_chat_member",
    "message",
    "channel_post",
  ];

  const payload: Record<string, unknown> = {
    url: WEBHOOK_URL,
    allowed_updates: allowedUpdates,
    drop_pending_updates: false,
    max_connections: 40,
  };

  if (SECRET_TOKEN) {
    payload.secret_token = SECRET_TOKEN;
  }

  const res = await fetch(`${BASE_URL}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (data.ok) {
    console.log("✅ Webhook successfully configured!");
    console.log("Allowed updates:", allowedUpdates.join(", "));
  } else {
    console.error("❌ Failed to set webhook:", data.description);
  }
}

async function getWebhookInfo() {
  console.log(`🔍 Inspecting current Telegram Webhook info...`);
  const res = await fetch(`${BASE_URL}/getWebhookInfo`);
  const data = await res.json();

  if (data.ok) {
    console.log("\n📊 Telegram Webhook Status:");
    console.dir(data.result, { depth: null });
  } else {
    console.error("❌ Failed to fetch webhook info:", data.description);
  }
}

async function deleteWebhook() {
  console.log(`🗑️ Deleting Telegram Webhook...`);
  const res = await fetch(`${BASE_URL}/deleteWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drop_pending_updates: false }),
  });

  const data = await res.json();
  if (data.ok) {
    console.log("✅ Webhook deleted successfully. Bot is back in polling mode.");
  } else {
    console.error("❌ Failed to delete webhook:", data.description);
  }
}

const command = process.argv[2] || "info";

switch (command) {
  case "set":
    setWebhook();
    break;
  case "info":
    getWebhookInfo();
    break;
  case "delete":
    deleteWebhook();
    break;
  default:
    console.log("Usage: npx tsx scripts/manage-webhook.ts [set | info | delete]");
    process.exit(0);
}
