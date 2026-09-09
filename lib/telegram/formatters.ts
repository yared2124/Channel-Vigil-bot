import {
  MembershipTransition,
  TelegramChat,
  TelegramChatInviteLink,
  TelegramChatJoinRequest,
  TelegramChatMemberUpdated,
  TelegramUser,
} from "@/types/telegram";

/**
 * Escapes special characters for Telegram HTML mode.
 * Allowed in HTML: <b>, <i>, <code>, <s>, <u>, <pre>, <a>.
 * All other characters must be escaped: &, <, >
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Determines the membership transition from old and new chat member status.
 */
export function detectMembershipTransition(
  oldStatus: string,
  newStatus: string
): MembershipTransition {
  if (
    (oldStatus === "left" || oldStatus === "kicked") &&
    (newStatus === "member" || newStatus === "administrator")
  ) {
    return "JOINED";
  }

  if (
    (oldStatus === "member" || oldStatus === "restricted" || oldStatus === "administrator") &&
    newStatus === "left"
  ) {
    return "LEFT";
  }

  if (newStatus === "kicked") {
    return "BANNED";
  }

  if (oldStatus === "kicked" && newStatus === "left") {
    return "UNBANNED";
  }

  if (oldStatus === "member" && newStatus === "administrator") {
    return "PROMOTED";
  }

  if (oldStatus === "member" && newStatus === "restricted") {
    return "RESTRICTED";
  }

  return "UNKNOWN";
}

/**
 * Formats a user display string with an HTML link to their profile.
 */
export function formatUserMentionHtml(user: TelegramUser): string {
  const fullName = user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.first_name;

  const safeName = escapeHtml(fullName);

  if (user.username) {
    return `<a href="https://t.me/${escapeHtml(user.username)}">${safeName}</a> (@${escapeHtml(user.username)})`;
  }

  // Telegram deep-link for users without username
  return `<a href="tg://user?id=${user.id}">${safeName}</a>`;
}

/**
 * Formats a channel display string.
 */
export function formatChatDisplayHtml(chat: TelegramChat): string {
  const title = escapeHtml(chat.title || "Channel");
  if (chat.username) {
    return `<b><a href="https://t.me/${escapeHtml(chat.username)}">${title}</a></b>`;
  }
  return `<b>${title}</b>`;
}

/**
 * Generates an alert message for chat_member updates (join, leave, ban).
 */
export function buildChatMemberAlertHtml(update: TelegramChatMemberUpdated): {
  transition: MembershipTransition;
  html: string;
} {
  const oldStatus = update.old_chat_member.status;
  const newStatus = update.new_chat_member.status;
  const transition = detectMembershipTransition(oldStatus, newStatus);
  const user = update.new_chat_member.user;
  const chat = update.chat;
  const inviteLink = update.invite_link;
  const dateFormatted = new Date(update.date * 1000).toISOString().replace("T", " ").replace("Z", " UTC");

  let emoji = "ℹ️";
  let title = "Channel Status Update";

  switch (transition) {
    case "JOINED":
      emoji = "🟢";
      title = "New Member Joined Channel!";
      break;
    case "LEFT":
      emoji = "🔴";
      title = "Member Left Channel";
      break;
    case "BANNED":
      emoji = "⛔";
      title = "Member Banned / Kicked";
      break;
    case "PROMOTED":
      emoji = "⭐";
      title = "Member Promoted to Admin";
      break;
    case "RESTRICTED":
      emoji = "⚠️";
      title = "Member Restricted";
      break;
    default:
      title = `Status Transition: ${oldStatus} ➡️ ${newStatus}`;
  }

  const lines: string[] = [
    `${emoji} <b>${escapeHtml(title)}</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    `📢 <b>Channel:</b> ${formatChatDisplayHtml(chat)} (<code>${chat.id}</code>)`,
    `👤 <b>User:</b> ${formatUserMentionHtml(user)}`,
    `🆔 <b>User ID:</b> <code>${user.id}</code>`,
    `🤖 <b>Is Bot:</b> ${user.is_bot ? "Yes" : "No"}`,
    user.is_premium ? `⭐ <b>Premium:</b> Yes` : "",
    user.language_code ? `🌐 <b>Language:</b> <code>${escapeHtml(user.language_code)}</code>` : "",
  ].filter(Boolean);

  if (inviteLink) {
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(`🔗 <b>Invite Link Used:</b>`);
    if (inviteLink.name) {
      lines.push(`🏷️ <b>Link Name:</b> ${escapeHtml(inviteLink.name)}`);
    }
    lines.push(`📎 <code>${escapeHtml(inviteLink.invite_link)}</code>`);
    lines.push(`👤 <b>Link Creator:</b> ${formatUserMentionHtml(inviteLink.creator)}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`⏱️ <b>Event Time:</b> <code>${escapeHtml(dateFormatted)}</code>`);

  return {
    transition,
    html: lines.join("\n"),
  };
}

/**
 * Generates an alert message for chat_join_request events.
 */
export function buildJoinRequestAlertHtml(request: TelegramChatJoinRequest): string {
  const user = request.from;
  const chat = request.chat;
  const inviteLink: TelegramChatInviteLink | undefined = request.invite_link;
  const dateFormatted = new Date(request.date * 1000).toISOString().replace("T", " ").replace("Z", " UTC");

  const lines: string[] = [
    `📩 <b>New Channel Join Request Pending!</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    `📢 <b>Channel:</b> ${formatChatDisplayHtml(chat)} (<code>${chat.id}</code>)`,
    `👤 <b>User:</b> ${formatUserMentionHtml(user)}`,
    `🆔 <b>User ID:</b> <code>${user.id}</code>`,
    request.bio ? `📝 <b>Bio:</b> <i>${escapeHtml(request.bio)}</i>` : "",
  ].filter(Boolean);

  if (inviteLink) {
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(`🔗 <b>Via Invite Link:</b>`);
    if (inviteLink.name) {
      lines.push(`🏷️ <b>Name:</b> ${escapeHtml(inviteLink.name)}`);
    }
    lines.push(`📎 <code>${escapeHtml(inviteLink.invite_link)}</code>`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`⏱️ <b>Requested At:</b> <code>${escapeHtml(dateFormatted)}</code>`);
  lines.push(`💡 <i>Admin approval is required to grant channel access.</i>`);

  return lines.join("\n");
}
