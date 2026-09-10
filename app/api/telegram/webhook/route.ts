import { NextRequest, NextResponse } from "next/server";
import { TelegramBotClient } from "@/lib/telegram/client";
import {
  buildLocalizedChatMemberAlertHtml,
  buildLocalizedJoinRequestAlertHtml,
  getLanguageKeyboard,
  SupportedLanguage,
  translations,
} from "@/lib/i18n";
import { escapeHtml } from "@/lib/telegram/formatters";
import { verifyTelegramWebhookSecret } from "@/lib/telegram/security";
import {
  deleteChannelWelcome,
  getChannelOwner,
  getChannelWelcome,
  getUserChannels,
  getUserLanguage,
  removeChannelOwner,
  saveChannelOwner,
  setChannelWelcome,
  setUserLanguage,
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
 * Supported features:
 * - Multi-user dynamic channel registration
 * - Bilingual localization (Amharic 🇪🇹 & English 🇬🇧)
 * - Interactive language switcher (/lang) with inline keyboards
 * - Auto-Welcome message system (/welcome, /setwelcome, /delwelcome)
 * - Channel vigilance (Join, Leave, Ban, Join Requests)
 * - Timing-safe webhook secret authentication
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

    // Case 1: Callback Query (Language Selector Inline Buttons)
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data || "";
      const userId = cb.from.id;

      if (data.startsWith("set_lang:")) {
        const selectedLang = data.split(":")[1] as SupportedLanguage;
        await setUserLanguage(userId, selectedLang);

        const confirmation =
          selectedLang === "am"
            ? "ቋንቋ ወደ አማርኛ ተቀይሯል! 🇪🇹"
            : "Language set to English! 🇬🇧";

        await client.answerCallbackQuery(cb.id, confirmation, false);

        await client.sendMessage({
          chat_id: userId,
          text: translations[selectedLang].langSwitched,
          parse_mode: "HTML",
        });
      }
    }

    // Case 2: Direct Private Messages (/start, /help, /lang, /channels, /welcome, /setwelcome)
    if (update.message && update.message.chat.type === "private") {
      const msg = update.message;
      const text = (msg.text || "").trim();
      const userId = msg.from ? msg.from.id : msg.chat.id;
      const userName = msg.from ? msg.from.first_name : "there";
      const userLang = await getUserLanguage(userId);
      const t = translations[userLang];

      if (text.startsWith("/lang") || text.startsWith("/language")) {
        await client.sendMessage({
          chat_id: userId,
          text: t.chooseLang,
          parse_mode: "HTML",
          reply_markup: getLanguageKeyboard(),
        });
      } else if (text.startsWith("/start") || text.startsWith("/help")) {
        const userChannels = await getUserChannels(userId);
        let channelsListHtml = t.noChannelsConnected;

        if (userChannels.length > 0) {
          channelsListHtml = userChannels
            .map((c, i) => `${i + 1}. <b>${escapeHtml(c.channelTitle)}</b> (<code>${c.channelId}</code>)`)
            .join("\n");
        }

        const replyHtml = [
          t.welcomeTitle,
          `━━━━━━━━━━━━━━━━━━`,
          t.welcomeSubtitle,
          ``,
          t.howToConnectTitle,
          t.howToConnectSteps,
          `━━━━━━━━━━━━━━━━━━`,
          t.connectedChannelsTitle,
          channelsListHtml,
          ``,
          t.menuTip,
        ].join("\n");

        await client.sendMessage({
          chat_id: userId,
          text: replyHtml,
          parse_mode: "HTML",
          reply_markup: getLanguageKeyboard(),
        });
      } else if (text.startsWith("/channels")) {
        const userChannels = await getUserChannels(userId);
        if (userChannels.length === 0) {
          await client.sendMessage({
            chat_id: userId,
            text: t.noChannelsConnected,
            parse_mode: "HTML",
          });
        } else {
          const list = userChannels
            .map((c, i) => `${i + 1}. 📢 <b>${escapeHtml(c.channelTitle)}</b> (<code>${c.channelId}</code>)\n   Connected: <code>${c.connectedAt.split("T")[0]}</code>`)
            .join("\n\n");

          await client.sendMessage({
            chat_id: userId,
            text: `${t.connectedChannelsTitle}\n━━━━━━━━━━━━━━━━━━\n${list}`,
            parse_mode: "HTML",
          });
        }
      } else if (text.startsWith("/setwelcome")) {
        const welcomeContent = text.replace(/^\/setwelcome\s*/, "").trim();

        if (!welcomeContent) {
          await client.sendMessage({
            chat_id: userId,
            text: t.welcomeInstruction,
            parse_mode: "HTML",
          });
        } else {
          const userChannels = await getUserChannels(userId);
          if (userChannels.length === 0) {
            await client.sendMessage({
              chat_id: userId,
              text: `${t.noChannelsConnected}\n\n${t.welcomeInstruction}`,
              parse_mode: "HTML",
            });
          } else {
            // Save welcome message for the user's connected channels
            for (const c of userChannels) {
              await setChannelWelcome(c.channelId, welcomeContent);
            }

            await client.sendMessage({
              chat_id: userId,
              text: `${t.welcomeSaved}\n\n${t.welcomePreview}\n<i>${escapeHtml(welcomeContent)}</i>`,
              parse_mode: "HTML",
            });
          }
        }
      } else if (text.startsWith("/delwelcome")) {
        const userChannels = await getUserChannels(userId);
        for (const c of userChannels) {
          await deleteChannelWelcome(c.channelId);
        }
        await client.sendMessage({
          chat_id: userId,
          text: t.welcomeDeleted,
          parse_mode: "HTML",
        });
      } else if (text.startsWith("/welcome")) {
        const userChannels = await getUserChannels(userId);
        if (userChannels.length === 0) {
          await client.sendMessage({
            chat_id: userId,
            text: `${t.noChannelsConnected}\n\n${t.welcomeInstruction}`,
            parse_mode: "HTML",
          });
        } else {
          const currentWelcome = await getChannelWelcome(userChannels[0].channelId);
          if (currentWelcome) {
            await client.sendMessage({
              chat_id: userId,
              text: `${t.welcomePreview}\n━━━━━━━━━━━━━━━━━━\n${escapeHtml(currentWelcome)}\n\n💡 <i>To change it, use /setwelcome &lt;new message&gt;. To remove, use /delwelcome</i>`,
              parse_mode: "HTML",
            });
          } else {
            await client.sendMessage({
              chat_id: userId,
              text: `${t.welcomeEmpty}\n\n${t.welcomeInstruction}`,
              parse_mode: "HTML",
            });
          }
        }
      }
    }

    // Case 3: Bot Administrator Status Change (Channel Auto-Registration / De-Registration)
    if (update.my_chat_member) {
      const myUpdate = update.my_chat_member;
      const newStatus = myUpdate.new_chat_member.status;
      const chatTitle = myUpdate.chat.title || "Channel";
      const channelId = myUpdate.chat.id;
      const addedByUserId = myUpdate.from ? myUpdate.from.id : null;

      console.log(
        `[Telegram Webhook] my_chat_member in ${chatTitle} (${channelId}): status=${newStatus} by user=${addedByUserId}`
      );

      if (newStatus === "administrator" && addedByUserId) {
        await saveChannelOwner(channelId, addedByUserId, chatTitle);
        const ownerLang = await getUserLanguage(addedByUserId);
        const t = translations[ownerLang];

        const welcomeText = [
          t.channelConnectedTitle,
          `━━━━━━━━━━━━━━━━━━`,
          `📢 <b>${t.channelLabel}:</b> <b>${escapeHtml(chatTitle)}</b> (<code>${channelId}</code>)`,
          `👤 <b>${t.userLabel}:</b> ${t.channelConnectedBody}`,
          ``,
          t.menuTip,
        ].join("\n");

        await client.sendMessage({
          chat_id: addedByUserId,
          text: welcomeText,
          parse_mode: "HTML",
        });
      } else if ((newStatus === "left" || newStatus === "kicked") && addedByUserId) {
        await removeChannelOwner(channelId, addedByUserId);
        const ownerLang = await getUserLanguage(addedByUserId);
        const t = translations[ownerLang];

        await client.sendMessage({
          chat_id: addedByUserId,
          text: `${t.channelDisconnectedTitle}\n\n${escapeHtml(chatTitle)}: ${t.channelDisconnectedBody}`,
          parse_mode: "HTML",
        });
      }
    }

    // Case 4: Chat Member Status Change (Join, Leave, Ban)
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
        const dynamicOwner = await getChannelOwner(chatMemberUpdate.chat.id);
        const recipientId = dynamicOwner || fallbackAdminChatId;

        if (recipientId) {
          const recipientLang = await getUserLanguage(recipientId);
          const { html, transition } = buildLocalizedChatMemberAlertHtml(
            chatMemberUpdate,
            recipientLang
          );

          if (transition !== "UNKNOWN") {
            console.log(
              `[Telegram Webhook] Dispatching ${transition} alert (${recipientLang}) to recipient ${recipientId}`
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

            // AUTO-WELCOME FEATURE: If a new member joined, send the configured welcome message
            if (transition === "JOINED") {
              const customWelcome = await getChannelWelcome(chatMemberUpdate.chat.id);
              if (customWelcome) {
                const joiner = chatMemberUpdate.new_chat_member.user;
                const joinerMsg = [
                  `👋 <b>Welcome, ${escapeHtml(joiner.first_name)}!</b>`,
                  `Welcome to <b>${escapeHtml(chatTitle)}</b>!`,
                  ``,
                  customWelcome,
                ].join("\n");

                try {
                  await client.sendMessage({
                    chat_id: joiner.id,
                    text: joinerMsg,
                    parse_mode: "HTML",
                  });
                  console.log(`[Telegram Webhook] Auto-welcome sent to joiner ${joiner.id}`);
                } catch (welcomeErr) {
                  console.warn(
                    `[Telegram Webhook] Could not send welcome DM to joiner (user may not have started the bot):`,
                    welcomeErr
                  );
                }
              }
            }
          }
        }
      }
    }

    // Case 5: Chat Join Request (Channels with approval links enabled)
    if (update.chat_join_request) {
      const joinRequest = update.chat_join_request;
      console.log(`[Telegram Webhook] chat_join_request received for ${joinRequest.from.first_name}`);

      if (isChannelMatch(monitoredChannelId, joinRequest.chat.id, joinRequest.chat.username)) {
        const dynamicOwner = await getChannelOwner(joinRequest.chat.id);
        const recipientId = dynamicOwner || fallbackAdminChatId;

        if (recipientId) {
          const recipientLang = await getUserLanguage(recipientId);
          const html = buildLocalizedJoinRequestAlertHtml(joinRequest, recipientLang);
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
    languages: ["en", "am"],
    features: ["bilingual", "auto_welcome", "channel_vigil"],
    timestamp: new Date().toISOString(),
  });
}
