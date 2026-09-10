import {
  MembershipTransition,
  TelegramChatJoinRequest,
  TelegramChatMemberUpdated,
  TelegramUser,
  InlineKeyboardMarkup,
} from "@/types/telegram";
import {
  detectMembershipTransition,
  escapeHtml,
  formatChatDisplayHtml,
  formatUserMentionHtml,
} from "@/lib/telegram/formatters";

export type SupportedLanguage = "en" | "am";

export const translations = {
  en: {
    langName: "English",
    langCode: "en",
    langSwitched: "✅ Language successfully set to <b>English</b>! 🇬🇧",
    chooseLang: "🌐 <b>Please select your preferred language:</b>",
    welcomeTitle: "👋 <b>Welcome to Channel Vigil Bot!</b>",
    welcomeSubtitle: "I monitor your Telegram channels 24/7 and alert you when members join, leave, or request access.",
    howToConnectTitle: "<b>🚀 How to connect your Channel:</b>",
    howToConnectSteps: [
      "1. Open your Telegram Channel settings.",
      "2. Tap <b>Administrators</b> ➡️ <b>Add Administrator</b>.",
      "3. Search and add: <b>@my_channel_vigil_bot</b>",
      "4. Enable <b>Invite Users via Link</b> and <b>Manage Channel</b>.",
      "5. Save. As soon as you add me, I will automatically start sending real-time alerts here!",
    ].join("\n"),
    connectedChannelsTitle: "📋 <b>Your Connected Channels:</b>",
    noChannelsConnected: "<i>No channels connected yet. Add the bot as Admin to start!</i>",
    menuTip: "💡 <i>Use /channels to view active channels, /lang to switch language, /welcome to set auto-welcome messages.</i>",
    joinTitle: "New Member Joined Channel!",
    leaveTitle: "Member Left Channel",
    banTitle: "Member Banned / Kicked",
    promoteTitle: "Member Promoted to Admin",
    restrictTitle: "Member Restricted",
    unknownTransition: "Status Transition",
    joinRequestTitle: "New Channel Join Request Pending!",
    channelLabel: "Channel",
    userLabel: "User",
    userIdLabel: "User ID",
    isBotLabel: "Is Bot",
    premiumLabel: "Premium",
    languageLabel: "Language",
    inviteLinkUsedLabel: "Invite Link Used",
    linkNameLabel: "Link Name",
    linkCreatorLabel: "Link Creator",
    eventTimeLabel: "Event Time",
    approvalRequired: "Admin approval is required to grant channel access.",
    yes: "Yes",
    no: "No",
    channelConnectedTitle: "🎉 <b>Channel Successfully Connected!</b>",
    channelConnectedBody: "is now connected to your account. You will receive real-time alerts right here!",
    channelDisconnectedTitle: "❌ <b>Channel Disconnected</b>",
    channelDisconnectedBody: "Monitoring has been removed.",
    welcomeSaved: "✅ <b>Welcome message saved!</b> New members joining this channel will receive this message privately.",
    welcomeDeleted: "🗑️ <b>Welcome message deleted.</b>",
    welcomePreview: "💌 <b>Current Auto-Welcome Message:</b>",
    welcomeEmpty: "ℹ️ No custom welcome message is set for this channel. Use <code>/setwelcome &lt;your message&gt;</code> to configure one.",
    welcomeInstruction: "💡 To set a custom welcome message for your channel, send:\n<code>/setwelcome Welcome to our channel! Here is our pinned post...</code>",
  },
  am: {
    langName: "አማርኛ",
    langCode: "am",
    langSwitched: "✅ ቋንቋዎ በተሳካ ሁኔታ ወደ <b>አማርኛ</b> ተቀይሯል! 🇪🇹",
    chooseLang: "🌐 <b>እባክዎ የሚፈልጉትን ቋንቋ ይምረጡ፦</b>",
    welcomeTitle: "👋 <b>እንኳን ወደ Channel Vigil Bot በሰላም መጡ!</b>",
    welcomeSubtitle: "ይህ ቦት የቴሌግራም ቻናልዎን 24/7 በመከታተል አባላት ሲቀላቀሉ፣ ሲወጡ ወይም የመግቢያ ጥያቄ ሲልኩ በቅጽበት ያሳውቅዎታል።",
    howToConnectTitle: "<b>🚀 ቻናልዎን እንዴት ማገናኘት እንደሚችሉ፦</b>",
    howToConnectSteps: [
      "1. የቴሌግራም ቻናልዎን ይክፈቱ።",
      "2. <b>Administrators</b> ➡️ <b>Add Administrator</b> የሚለውን ይጫኑ።",
      "3. <b>@my_channel_vigil_bot</b> ብለው ፈልገው ይጨምሩት።",
      "4. <b>Invite Users via Link</b> እና <b>Manage Channel</b> የሚሉትን ያብሩ።",
      "5. ያስቀምጡ (Save)። ቦቱን አድሚን እንዳደረጉት ወዲያውኑ ማሳወቂያዎች እዚህ መድረስ ይጀምራሉ!",
    ].join("\n"),
    connectedChannelsTitle: "📋 <b>እርስዎ ያስተሳሰሯቸው ቻናሎች፦</b>",
    noChannelsConnected: "<i>እስካሁን ምንም የተገናኘ ቻናል የለም። ቦቱን የቻናልዎ አድሚን በማድረግ ይጀምሩ!</i>",
    menuTip: "💡 <i>የተገናኙትን ለማየት /channels፣ ቋንቋ ለመቀየር /lang፣ የአቀባበል መልዕክት ለመጻፍ /welcome ይጠቀሙ።</i>",
    joinTitle: "አዲስ አባል ቻናሉን ተቀላቅሏል!",
    leaveTitle: "አባል ከቻናሉ ወጥቷል",
    banTitle: "አባል ታግዷል / ተባሯል",
    promoteTitle: "አባል ወደ አድሚንነት አድጓል",
    restrictTitle: "አባል ተገድቧል",
    unknownTransition: "የአባልነት ሁኔታ ተቀይሯል",
    joinRequestTitle: "አዲስ የቻናል መግቢያ ጥያቄ ቀርቧል!",
    channelLabel: "ቻናል",
    userLabel: "ተጠቃሚ",
    userIdLabel: "የተጠቃሚ መታወቂያ (ID)",
    isBotLabel: "ቦት ነው",
    premiumLabel: "ፕሪሚየም",
    languageLabel: "ቋንቋ",
    inviteLinkUsedLabel: "ጥቅም ላይ የዋለው ሊንክ",
    linkNameLabel: "የሊንኩ ስም",
    linkCreatorLabel: "ሊንኩን የፈጠረው",
    eventTimeLabel: "የተፈጸመበት ሰዓት",
    approvalRequired: "አባሉ ወደ ቻናሉ እንዲገባ የአድሚን ፈቃድ ያስፈልጋል።",
    yes: "አዎ",
    no: "አይደለም",
    channelConnectedTitle: "🎉 <b>ቻናልዎ በተሳካ ሁኔታ ተገናኝቷል!</b>",
    channelConnectedBody: "ከመለያዎ ጋር ተገናኝቷል። ሰው ሲገባም ሆነ ሲወጣ እዚህ በውስጥ መስመር ይደርስዎታል!",
    channelDisconnectedTitle: "❌ <b>ቻናሉ ተቋርጧል</b>",
    channelDisconnectedBody: "ክትትሉ ቆሟል።",
    welcomeSaved: "✅ <b>የአቀባበል መልዕክት ተቀምጧል!</b> አዲስ አባላት ቻናሉን ሲቀላቀሉ ይህ መልዕክት በግል ይደርሳቸዋል።",
    welcomeDeleted: "🗑️ <b>የአቀባበል መልዕክቱ ተሰርዟል።</b>",
    welcomePreview: "💌 <b>ወቅታዊው የአቀባበል መልዕክት፦</b>",
    welcomeEmpty: "ℹ️ እስካሁን ምንም የአቀባበል መልዕክት አልተዘጋጀም። ለመመዝገብ <code>/setwelcome &lt;መልዕክትዎ&gt;</code> ይጠቀሙ።",
    welcomeInstruction: "💡 አዲስ አባላትን ለመቀበል የሚላክ መልዕክት ለማዘጋጀት እንዲህ ብለው ይላኩ፦\n<code>/setwelcome እንኳን ወደ ቻናላችን በሰላም መጡ! ጠቃሚ መረጃዎችን እዚህ ያገኛሉ...</code>",
  },
};

/**
 * Returns the language selection inline keyboard markup.
 */
export function getLanguageKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "🇪🇹 አማርኛ (Amharic)", callback_data: "set_lang:am" },
        { text: "🇬🇧 English", callback_data: "set_lang:en" },
      ],
    ],
  };
}

/**
 * Builds localized HTML for chat_member events (Join, Leave, Ban, Promote).
 */
export function buildLocalizedChatMemberAlertHtml(
  update: TelegramChatMemberUpdated,
  lang: SupportedLanguage = "en"
): { transition: MembershipTransition; html: string } {
  const t = translations[lang] || translations.en;
  const oldStatus = update.old_chat_member.status;
  const newStatus = update.new_chat_member.status;
  const transition = detectMembershipTransition(oldStatus, newStatus);
  const user = update.new_chat_member.user;
  const chat = update.chat;
  const inviteLink = update.invite_link;
  const dateFormatted = new Date(update.date * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", " UTC");

  let emoji = "ℹ️";
  let title = t.unknownTransition;

  switch (transition) {
    case "JOINED":
      emoji = "🟢";
      title = t.joinTitle;
      break;
    case "LEFT":
      emoji = "🔴";
      title = t.leaveTitle;
      break;
    case "BANNED":
      emoji = "⛔";
      title = t.banTitle;
      break;
    case "PROMOTED":
      emoji = "⭐";
      title = t.promoteTitle;
      break;
    case "RESTRICTED":
      emoji = "⚠️";
      title = t.restrictTitle;
      break;
  }

  const lines: string[] = [
    `${emoji} <b>${escapeHtml(title)}</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    `📢 <b>${t.channelLabel}:</b> ${formatChatDisplayHtml(chat)} (<code>${chat.id}</code>)`,
    `👤 <b>${t.userLabel}:</b> ${formatUserMentionHtml(user)}`,
    `🆔 <b>${t.userIdLabel}:</b> <code>${user.id}</code>`,
    `🤖 <b>${t.isBotLabel}:</b> ${user.is_bot ? t.yes : t.no}`,
    user.is_premium ? `⭐ <b>${t.premiumLabel}:</b> ${t.yes}` : "",
    user.language_code ? `🌐 <b>${t.languageLabel}:</b> <code>${escapeHtml(user.language_code)}</code>` : "",
  ].filter(Boolean);

  if (inviteLink) {
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(`🔗 <b>${t.inviteLinkUsedLabel}:</b>`);
    if (inviteLink.name) {
      lines.push(`🏷️ <b>${t.linkNameLabel}:</b> ${escapeHtml(inviteLink.name)}`);
    }
    lines.push(`📎 <code>${escapeHtml(inviteLink.invite_link)}</code>`);
    lines.push(`👤 <b>${t.linkCreatorLabel}:</b> ${formatUserMentionHtml(inviteLink.creator)}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`⏱️ <b>${t.eventTimeLabel}:</b> <code>${escapeHtml(dateFormatted)}</code>`);

  return {
    transition,
    html: lines.join("\n"),
  };
}

/**
 * Builds localized HTML for chat_join_request events.
 */
export function buildLocalizedJoinRequestAlertHtml(
  request: TelegramChatJoinRequest,
  lang: SupportedLanguage = "en"
): string {
  const t = translations[lang] || translations.en;
  const user = request.from;
  const chat = request.chat;
  const inviteLink = request.invite_link;
  const dateFormatted = new Date(request.date * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", " UTC");

  const lines: string[] = [
    `📩 <b>${t.joinRequestTitle}</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    `📢 <b>${t.channelLabel}:</b> ${formatChatDisplayHtml(chat)} (<code>${chat.id}</code>)`,
    `👤 <b>${t.userLabel}:</b> ${formatUserMentionHtml(user)}`,
    `🆔 <b>${t.userIdLabel}:</b> <code>${user.id}</code>`,
    request.bio ? `📝 <b>Bio:</b> <i>${escapeHtml(request.bio)}</i>` : "",
  ].filter(Boolean);

  if (inviteLink) {
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(`🔗 <b>${t.inviteLinkUsedLabel}:</b>`);
    if (inviteLink.name) {
      lines.push(`🏷️ <b>${t.linkNameLabel}:</b> ${escapeHtml(inviteLink.name)}`);
    }
    lines.push(`📎 <code>${escapeHtml(inviteLink.invite_link)}</code>`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`⏱️ <b>${t.eventTimeLabel}:</b> <code>${escapeHtml(dateFormatted)}</code>`);
  lines.push(`💡 <i>${t.approvalRequired}</i>`);

  return lines.join("\n");
}
