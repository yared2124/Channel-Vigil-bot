import { NextRequest, NextResponse } from "next/server";
import { TelegramBotClient } from "@/lib/telegram/client";
import {
  buildChatMemberAlertHtml,
  buildJoinRequestAlertHtml,
  escapeHtml,
} from "@/lib/telegram/formatters";
import { verifyTelegramWebhookSecret } from "@/lib/telegram/security";
import {
  getChannelOwner,
  getUserChannels,
  removeChannelOwner,
  saveChannelOwner,
} from "@/lib/storage";
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
 * Supports:
 * - Multi-user dynamic channel registration via `my_chat_member`
 * - Direct routing of member join/leave alerts to the channel owner
 * - Interactive commands (/start, /help, /channels) in private chat
 * - Timing-safe secret token verification
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

  const fallbackAdminChatId = process.env.ADMIN_CHAT_ID;
  const monitoredChannelId = process.env.CHANNEL_ID;

  // 3. Process the event directly before returning HTTP 200
  try {
    const client = new TelegramBotClient();
    console.log("[Telegram Webhook] Processing update_id:", update.update_id);

    // Case 1: Direct Private Messages (/start, /help, /channels)
    if (update.message && update.message.chat.type === "private") {
      const msg = update.message;
      const text = (msg.text || "").trim();
      const userId = msg.from ? msg.from.id : msg.chat.id;
      const userName = msg.from ? msg.from.first_name : "there";

      if (text.startsWith("/start") || text.startsWith("/help")) {
        const userChannels = await getUserChannels(userId);
        let channelsListHtml = "<i>No channels connected yet.</i>";

        if (userChannels.length > 0) {
          channelsListHtml = userChannels
            .map((c, i) => `${i + 1}. <b>${escapeHtml(c.channelTitle)}</b> (<code>${c.channelId}</code>)`)
            .join("\n");
        }

        const replyHtml = [
          `👋 <b>Hello, ${escapeHtml(userName)}! Welcome to Channel Vigil Bot!</b>`,
          `━━━━━━━━━━━━━━━━━━`,
          `I monitor your Telegram channels 24/7 and notify you immediately when someone joins, leaves, or requests access.`,
          ``,
          `<b>🚀 How to connect your Channel:</b>`,
          `1. Open your Telegram Channel settings.`,
          `2. Tap <b>Administrators</b> ➡️ <b>Add Administrator</b>.`,
          `3. Search for: <b>@my_channel_vigil_bot</b>`,
          `4. Enable <b>Invite Users via Link</b> and <b>Manage Channel</b>.`,
          `5. Tap <b>Done / Save</b>.`,
          ``,
          `As soon as you add me, I will automatically bind your channel to your account and start sending you real-time alerts right here!`,
          `━━━━━━━━━━━━━━━━━━`,
          `📋 <b>Your Connected Channels:</b>`,
          channelsListHtml,
          ``,
          `💡 <i>Tip: Send /channels anytime to inspect your active channels.</i>`,
        ].join("\n");

        await client.sendMessage({
          chat_id: userId,
          text: replyHtml,
          parse_mode: "HTML",
        });
      } else if (text.startsWith("/channels")) {
        const userChannels = await getUserChannels(userId);
        if (userChannels.length === 0) {
          await client.sendMessage({
            chat_id: userId,
            text: `📋 <b>No Channels Connected</b>\n\nAdd <b>@my_channel_vigil_bot</b> as an Administrator in your channel to begin monitoring!`,
            parse_mode: "HTML",
          });
        } else {
          const list = userChannels
            .map((c, i) => `${i + 1}. 📢 <b>${escapeHtml(c.channelTitle)}</b> (<code>${c.channelId}</code>)\n   Connected: <code>${c.connectedAt.split("T")[0]}</code>`)
            .join("\n\n");

          await client.sendMessage({
            chat_id: userId,
            text: `📋 <b>Your Monitored Channels:</b>\n━━━━━━━━━━━━━━━━━━\n${list}`,
            parse_mode: "HTML",
          });
        }
      }
    }

    // Case 2: Bot Administrator Status Change (Auto-Registration / De-Registration)
    if (update.my_chat_member) {
      const myUpdate = update.my_chat_member;
      const newStatus = myUpdate.new_chat_member.status;
      const chatTitle = myUpdate.chat.title || "Channel";
      const channelId = myUpdate.chat.id;
      const addedByUserId = myUpdate.from ? myUpdate.from.id : null;

      console.log(
        `[Telegram Webhook] my_chat_member update in ${chatTitle} (${channelId}): status=${newStatus} by user=${addedByUserId}`
      );

      if (newStatus === "administrator" && addedByUserId) {
        // User added bot as admin: bind channel to user!
        await saveChannelOwner(channelId, addedByUserId, chatTitle);

        const welcomeText = [
          `🎉 <b>Channel Successfully Connected!</b>`,
          `━━━━━━━━━━━━━━━━━━`,
          `📢 <b>Channel:</b> <b>${escapeHtml(chatTitle)}</b> (<code>${channelId}</code>)`,
          `✅ <b>Status:</b> Administrator active`,
          `👤 <b>Owner:</b> Connected to your account`,
          ``,
          `Whenever anyone joins, leaves, or requests access to <b>${escapeHtml(chatTitle)}</b>, you will receive real-time notifications right here!`,
        ].join("\n");

        await client.sendMessage({
          chat_id: addedByUserId,
          text: welcomeText,
          parse_mode: "HTML",
        });
      } else if ((newStatus === "left" || newStatus === "kicked") && addedByUserId) {
        // Bot was removed: unbind channel
        await removeChannelOwner(channelId, addedByUserId);

        await client.sendMessage({
          chat_id: addedByUserId,
          text: `❌ <b>Channel Disconnected</b>\n\nMonitoring for <b>${escapeHtml(chatTitle)}</b> has been disabled.`,
          parse_mode: "HTML",
        });
      }
    }

    // Case 3: Chat Member Status Change (Join, Leave, Ban)
    if (update.chat_member) {
      const chatMemberUpdate = update.chat_member;
      const chatTitle = chatMemberUpdate.chat.title || "Channel";
      console.log(
        `[Telegram Webhook] chat_member event in ${chatTitle} (${chatMemberUpdate.chat.id}) for user ${chatMemberUpdate.new_chat_member.user.first_name}`
      );

      // Optional legacy filter if CHANNEL_ID is defined
      if (!isChannelMatch(monitoredChannelId, chatMemberUpdate.chat.id, chatMemberUpdate.chat.username)) {
        console.warn(
          `[Telegram Webhook] Event ignored: channel filter (${monitoredChannelId}) does not match chat ID (${chatMemberUpdate.chat.id})`
        );
      } else {
        const { html, transition } = buildChatMemberAlertHtml(chatMemberUpdate);

        if (transition !== "UNKNOWN") {
          // Look up channel owner dynamically, or fallback to default admin
          const dynamicOwner = await getChannelOwner(chatMemberUpdate.chat.id);
          const recipientId = dynamicOwner || fallbackAdminChatId;

          if (recipientId) {
            console.log(
              `[Telegram Webhook] Dispatching ${transition} alert to recipient ${recipientId} (owner: ${dynamicOwner || "fallback"})`
            );

            const res = await client.sendMessage({
              chat_id: recipientId,
              text: html,
              parse_mode: "HTML",
            });

            if (!res.ok) {
              console.error(`[Telegram Webhook] Failed to dispatch alert: ${res.description}`);
            } else {
              console.log(`[Telegram Webhook] Alert delivered to recipient ${recipientId}!`);
            }
          } else {
            console.warn(`[Telegram Webhook] No recipient found for channel ${chatMemberUpdate.chat.id}`);
          }
        }
      }
    }

    // Case 4: Chat Join Request (Channels with approval links enabled)
    if (update.chat_join_request) {
      const joinRequest = update.chat_join_request;
      console.log(`[Telegram Webhook] chat_join_request received for ${joinRequest.from.first_name}`);

      if (isChannelMatch(monitoredChannelId, joinRequest.chat.id, joinRequest.chat.username)) {
        const dynamicOwner = await getChannelOwner(joinRequest.chat.id);
        const recipientId = dynamicOwner || fallbackAdminChatId;

        if (recipientId) {
          const html = buildJoinRequestAlertHtml(joinRequest);
          await client.sendMessage({
            chat_id: recipientId,
            text: html,
            parse_mode: "HTML",
          });
        }
      }
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
    multi_user_support: true,
    timestamp: new Date().toISOString(),
  });
}
