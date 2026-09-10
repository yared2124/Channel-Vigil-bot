import { NextResponse } from "next/server";
import { TelegramBotClient } from "@/lib/telegram/client";

export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint to check Vercel environment variables
 * and test sending a live alert to the admin's Telegram account.
 */
export async function GET(): Promise<NextResponse> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const secretToken = process.env.TELEGRAM_SECRET_TOKEN;
  const adminChatId = process.env.ADMIN_CHAT_ID;
  const channelId = process.env.CHANNEL_ID;

  const envCheck = {
    TELEGRAM_BOT_TOKEN: botToken ? "✅ Set (" + botToken.slice(0, 10) + "...)" : "❌ MISSING IN VERCEL",
    TELEGRAM_SECRET_TOKEN: secretToken ? "✅ Set" : "❌ MISSING IN VERCEL",
    ADMIN_CHAT_ID: adminChatId ? "✅ Set to " + adminChatId : "❌ MISSING IN VERCEL",
    CHANNEL_ID_FILTER: channelId ? "⚠️ Filter active: " + channelId : "✅ No filter (monitors all channels)",
  };

  let testMessageStatus = "Not attempted (missing credentials)";

  if (botToken && adminChatId) {
    try {
      const client = new TelegramBotClient(botToken);
      const res = await client.sendMessage({
        chat_id: adminChatId,
        text: `🔍 <b>Diagnostic Test from Vercel</b>\n\nYour bot successfully connected to Telegram from Vercel Serverless!\n\n⏱️ Timestamp: <code>${new Date().toISOString()}</code>`,
        parse_mode: "HTML",
      });

      if (res.ok) {
        testMessageStatus = "✅ Successfully sent test message to your Telegram!";
      } else {
        testMessageStatus = "❌ Failed to send message: " + (res.description || "Unknown error");
      }
    } catch (err: unknown) {
      testMessageStatus = "❌ Exception: " + (err instanceof Error ? err.message : String(err));
    }
  }

  return NextResponse.json({
    status: "Channel Vigil Bot Diagnostic",
    vercel_environment_variables: envCheck,
    test_message_delivery: testMessageStatus,
    instructions: {
      if_variables_missing: "Go to Vercel Dashboard -> Settings -> Environment Variables, add the missing keys, then go to Deployments -> Redeploy.",
      if_channel_filter_active: "If CHANNEL_ID_FILTER is set to a channel you are not using, delete CHANNEL_ID in Vercel to monitor all channels.",
    },
  });
}
