import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN missing in environment");
  process.exit(1);
}

const commands = [
  { command: "start", description: "Start the bot & view instructions" },
  { command: "channels", description: "List all your monitored channels" },
  { command: "help", description: "How to connect your channel" },
];

async function registerCommands() {
  console.log("📡 Registering bot commands with Telegram API...");
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  });

  const data = await res.json();
  if (data.ok) {
    console.log("✅ Bot commands registered successfully in Telegram menu!");
    commands.forEach((c) => console.log(`   /${c.command} - ${c.description}`));
  } else {
    console.error("❌ Failed to register commands:", data.description);
  }
}

registerCommands();
