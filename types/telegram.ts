/**
 * Comprehensive, strictly-typed Telegram Bot API definitions.
 * Follows official Telegram Bot API specification (v7.0+).
 */

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
}

export type ChatType = "private" | "group" | "supergroup" | "channel";

export interface TelegramChat {
  id: number;
  type: ChatType;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_forum?: boolean;
  description?: string;
  invite_link?: string;
}

export interface TelegramChatInviteLink {
  invite_link: string;
  creator: TelegramUser;
  creates_join_request: boolean;
  is_primary: boolean;
  is_revoked: boolean;
  name?: string;
  expire_date?: number;
  member_limit?: number;
  pending_join_request_count?: number;
}

export type ChatMemberStatus =
  | "creator"
  | "administrator"
  | "member"
  | "restricted"
  | "left"
  | "kicked";

export interface ChatMemberBase {
  status: ChatMemberStatus;
  user: TelegramUser;
}

export interface TelegramChatMemberOwner extends ChatMemberBase {
  status: "creator";
  is_anonymous: boolean;
  custom_title?: string;
}

export interface TelegramChatMemberAdministrator extends ChatMemberBase {
  status: "administrator";
  can_be_edited: boolean;
  is_anonymous: boolean;
  can_manage_chat: boolean;
  can_delete_messages: boolean;
  can_manage_video_chats: boolean;
  can_restrict_members: boolean;
  can_promote_members: boolean;
  can_change_info: boolean;
  can_invite_users: boolean;
  can_post_stories?: boolean;
  can_edit_stories?: boolean;
  can_delete_stories?: boolean;
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
  can_pin_messages?: boolean;
  can_manage_topics?: boolean;
  custom_title?: string;
}

export interface TelegramChatMemberMember extends ChatMemberBase {
  status: "member";
  until_date?: number;
}

export interface TelegramChatMemberRestricted extends ChatMemberBase {
  status: "restricted";
  is_member: boolean;
  can_send_messages: boolean;
  can_send_audios: boolean;
  can_send_documents: boolean;
  can_send_photos: boolean;
  can_send_videos: boolean;
  can_send_video_notes: boolean;
  can_send_voice_notes: boolean;
  can_send_polls: boolean;
  can_send_other_messages: boolean;
  can_add_web_page_previews: boolean;
  can_change_info: boolean;
  can_invite_users: boolean;
  can_pin_messages: boolean;
  can_manage_topics: boolean;
  until_date: number;
}

export interface TelegramChatMemberLeft extends ChatMemberBase {
  status: "left";
}

export interface TelegramChatMemberBanned extends ChatMemberBase {
  status: "kicked";
  until_date: number;
}

export type TelegramChatMember =
  | TelegramChatMemberOwner
  | TelegramChatMemberAdministrator
  | TelegramChatMemberMember
  | TelegramChatMemberRestricted
  | TelegramChatMemberLeft
  | TelegramChatMemberBanned;

export interface TelegramChatMemberUpdated {
  chat: TelegramChat;
  from: TelegramUser;
  date: number;
  old_chat_member: TelegramChatMember;
  new_chat_member: TelegramChatMember;
  invite_link?: TelegramChatInviteLink;
  via_chat_folder_invite_link?: boolean;
}

export interface TelegramChatJoinRequest {
  chat: TelegramChat;
  from: TelegramUser;
  user_chat_id: number;
  date: number;
  bio?: string;
  invite_link?: TelegramChatInviteLink;
}

export interface TelegramMessage {
  message_id: number;
  message_thread_id?: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  text?: string;
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
  chat_instance?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  my_chat_member?: TelegramChatMemberUpdated;
  chat_member?: TelegramChatMemberUpdated;
  chat_join_request?: TelegramChatJoinRequest;
  callback_query?: TelegramCallbackQuery;
}

export type ParseMode = "HTML" | "MarkdownV2" | "Markdown";

export interface SendMessagePayload {
  chat_id: number | string;
  text: string;
  parse_mode?: ParseMode;
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?: InlineKeyboardMarkup;
}

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}

export type MembershipTransition =
  | "JOINED"
  | "LEFT"
  | "BANNED"
  | "UNBANNED"
  | "PROMOTED"
  | "RESTRICTED"
  | "REQUESTED_ACCESS"
  | "UNKNOWN";
