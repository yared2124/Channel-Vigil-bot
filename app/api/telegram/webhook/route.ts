import { NextRequest, NextResponse } from "next/server";
import { TelegramBotClient } from "@/lib/telegram/client";
import {
  buildChatMemberAlertHtml,
  buildJoinRequestAlertHtml,
} from "@/lib/telegram/formatters";
import { verifyTelegramWebhookSecret } from "@/lib/telegram/security";
import { TelegramUpdate } from "@/types/telegram";

export const dynamic = "force-dynamic";

function isChannelMatch(
  filter: string | undefined,
  chatId: number,
  chatUsername?: string
): boolean {
  if (!filter || filter.trim() === "") return true;
  const f = filter.trim();
  const idStr = String(chatId);

  if (f === idStr) return true;
  if (f.replace(/^-100/, "") === idStr.replace(/^-100/, "")) return true;
  if (chatUsername) {
    const cleanFilter = f.replace(/^@/, "").toLowerCase();
    const cleanUser = chatUsername.replace(/^@/, "").toLowerCase();
    if (cleanFilter === cleanUser) return true;
  }
  return false;
}

/**
 * Handles incoming Telegram Webhook updates.
 *
 * Requirements:
 * 1. Validates 'x-telegram-bot-api-secret-token' in constant time.
 * 2. Parses 'chat_member' and 'chat_join_request' updates.
 * 3. Quickly dispatches alerts to the admin chat without blocking.
 * 4. Responds with HTTP 200 immediately to prevent Telegram retry storms.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  const configuredSecret = process.env.TELEGRAM_SECRET_TOKEN;

  // 1. Security Verification
  if (!verifyTelegramWebhookSecret(secretHeader, configuredSecret)) {
    console.warn("[Telegram Webhook] Unauthorized request rejected.");
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. Parse Payload
  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const adminChatId = process.env.ADMIN_CHAT_ID;
  const monitoredChannelId = process.env.CHANNEL_ID;

  if (!adminChatId) {
    console.error("[Telegram Webhook] ADMIN_CHAT_ID is not configured in environment.");
    return NextResponse.json({ ok: true, status: "admin_chat_id_missing" });
  }

  // 3. Process the event directly before returning HTTP 200
  try {
    const client = new TelegramBotClient();
    console.log("[Telegram Webhook] Processing update_id:", update.update_id);

    // Case A: Chat Member status change (Join, Leave, Ban, Promote)
    if (update.chat_member) {
      const chatMemberUpdate = update.chat_member;
      const chatTitle = chatMemberUpdate.chat.title || "Channel";
      console.log(
        `[Telegram Webhook] chat_member event received in ${chatTitle} (${chatMemberUpdate.chat.id}) for user ${chatMemberUpdate.new_chat_member.user.first_name}`
      );

      // Optional filter if CHANNEL_ID is defined
      if (!isChannelMatch(monitoredChannelId, chatMemberUpdate.chat.id, chatMemberUpdate.chat.username)) {
        console.warn(
          `[Telegram Webhook] Event ignored: channel filter (${monitoredChannelId}) does not match chat ID (${chatMemberUpdate.chat.id})`
        );
      } else {
        const { html, transition } = buildChatMemberAlertHtml(chatMemberUpdate);

        if (transition !== "UNKNOWN") {
          console.log(`[Telegram Webhook] Dispatching ${transition} alert to admin ${adminChatId}`);
          const res = await client.sendMessage({
            chat_id: adminChatId,
            text: html,
            parse_mode: "HTML",
          });

          if (!res.ok) {
            console.error(`[Telegram Webhook] Failed to dispatch alert: ${res.description}`);
          } else {
            console.log(`[Telegram Webhook] Alert successfully delivered to admin!`);
          }
        }
      }
    }

    // Case B: Chat Join Request (Channels with approval links enabled)
    if (update.chat_join_request) {
      const joinRequest = update.chat_join_request;
      console.log(`[Telegram Webhook] chat_join_request received for ${joinRequest.from.first_name}`);

      if (isChannelMatch(monitoredChannelId, joinRequest.chat.id, joinRequest.chat.username)) {
        const html = buildJoinRequestAlertHtml(joinRequest);
        await client.sendMessage({
          chat_id: adminChatId,
          text: html,
          parse_mode: "HTML",
        });
      }
    }

    // Case C: Bot administrator rights change in channel
    if (update.my_chat_member) {
      const myUpdate = update.my_chat_member;
      const newStatus = myUpdate.new_chat_member.status;
      const chatTitle = myUpdate.chat.title || "Channel";
      console.log(`[Telegram Webhook] my_chat_member status changed to: ${newStatus}`);

      const text = [
        `🤖 <b>Bot Channel Permission Update</b>`,
        `━━━━━━━━━━━━━━━━━━`,
        `📢 <b>Channel:</b> <b>${chatTitle}</b> (<code>${myUpdate.chat.id}</code>)`,
        `📊 <b>New Status:</b> <code>${newStatus}</code>`,
        `⏱️ <b>Date:</b> <code>${new Date(myUpdate.date * 1000).toISOString()}</code>`,
      ].join("\n");

      await client.sendMessage({
        chat_id: adminChatId,
        text,
        parse_mode: "HTML",
      });
    }
  } catch (dispatchErr) {
    console.error("[Telegram Webhook] Processing error:", dispatchErr);
  }

  // 4. Return HTTP 200 acknowledge to Telegram server
  return NextResponse.json({ ok: true });
}

/**
 * Health check / verification endpoint
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    service: "Telegram Channel Join Vigil Webhook",
    timestamp: new Date().toISOString(),
  });
}
