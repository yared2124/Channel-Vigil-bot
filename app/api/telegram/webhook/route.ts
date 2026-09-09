import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
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

  // 3. Process the event asynchronously via Next.js `after` to guarantee immediate HTTP 200 return
  after(async () => {
    try {
      const client = new TelegramBotClient();

      // Case A: Chat Member status change (Join, Leave, Ban, Promote)
      if (update.chat_member) {
        const chatMemberUpdate = update.chat_member;
        const chatId = String(chatMemberUpdate.chat.id);
        const chatUsername = chatMemberUpdate.chat.username
          ? `@${chatMemberUpdate.chat.username}`
          : null;

        // Optional filter if CHANNEL_ID is defined
        if (!isChannelMatch(monitoredChannelId, chatMemberUpdate.chat.id, chatMemberUpdate.chat.username)) {
          return;
        }

        const { html, transition } = buildChatMemberAlertHtml(chatMemberUpdate);

        // Discard internal unknown transitions if desired, or notify admin
        if (transition !== "UNKNOWN") {
          const res = await client.sendMessage({
            chat_id: adminChatId,
            text: html,
            parse_mode: "HTML",
          });

          if (!res.ok) {
            console.error(
              `[Telegram Webhook] Failed to dispatch chat_member alert: ${res.description}`
            );
          }
        }
      }

      // Case B: Chat Join Request (Channels with approval links enabled)
      if (update.chat_join_request) {
        const joinRequest = update.chat_join_request;
        const chatId = String(joinRequest.chat.id);
        const chatUsername = joinRequest.chat.username
          ? `@${joinRequest.chat.username}`
          : null;

        if (!isChannelMatch(monitoredChannelId, joinRequest.chat.id, joinRequest.chat.username)) {
          return;
        }

        const html = buildJoinRequestAlertHtml(joinRequest);
        const res = await client.sendMessage({
          chat_id: adminChatId,
          text: html,
          parse_mode: "HTML",
        });

        if (!res.ok) {
          console.error(
            `[Telegram Webhook] Failed to dispatch join_request alert: ${res.description}`
          );
        }
      }

      // Case C: Bot administrator rights change in channel
      if (update.my_chat_member) {
        const myUpdate = update.my_chat_member;
        const newStatus = myUpdate.new_chat_member.status;
        const chatTitle = myUpdate.chat.title || "Channel";

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
      console.error("[Telegram Webhook] Background task error:", dispatchErr);
    }
  });

  // 4. Immediate HTTP 200 acknowledge to Telegram server
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
