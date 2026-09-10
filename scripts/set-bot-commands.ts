import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN missing in environment");
  process.exit(1);
}

const commands = [
  { command: "start", description: "Start the bot & view instructions / ጀምር" },
  { command: "channels", description: "List your monitored channels / ቻናሎችህን እይ" },
  { command: "lang", description: "ቋንቋ ይቀይሩ / Switch language (Amharic / English)" },
  { command: "welcome", description: "View or configure auto-welcome message" },
  { command: "help", description: "Help & channel connection guide / መመሪያ" },
];

async function registerCommands() {
  console.log("📡 Registering updated bot commands with Telegram API...");
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
