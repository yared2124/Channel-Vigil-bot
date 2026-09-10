import {
  SendMessagePayload,
  TelegramApiResponse,
  TelegramMessage,
  TelegramWebhookInfo,
} from "@/types/telegram";

export class TelegramBotClient {
  private readonly baseUrl: string;
  private readonly botToken: string;

  constructor(token?: string) {
    const activeToken = token || process.env.TELEGRAM_BOT_TOKEN;
    if (!activeToken) {
      throw new Error(
        "TelegramBotClient: Missing bot token. Provide it in the constructor or set TELEGRAM_BOT_TOKEN."
      );
    }
    this.botToken = activeToken;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Internal helper for executing Telegram Bot API calls.
   */
  private async execute<T>(
    method: string,
    body?: Record<string, unknown>,
    timeoutMs = 8000
  ): Promise<TelegramApiResponse<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/${method}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = (await response.json()) as TelegramApiResponse<T>;
      return data;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.name === "AbortError"
            ? "Request timed out after " + timeoutMs + "ms"
            : err.message
          : "Unknown error occurred";

      return {
        ok: false,
        description: errorMessage,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Sends an alert message to a specified chat or admin user.
   */
  async sendMessage(payload: SendMessagePayload): Promise<TelegramApiResponse<TelegramMessage>> {
    const body: Record<string, unknown> = {
      chat_id: payload.chat_id,
      text: payload.text,
      parse_mode: payload.parse_mode ?? "HTML",
      disable_web_page_preview: payload.disable_web_page_preview ?? true,
      disable_notification: payload.disable_notification ?? false,
      reply_to_message_id: payload.reply_to_message_id,
    };

    if (payload.reply_markup) {
      body.reply_markup = payload.reply_markup;
    }

    return this.execute<TelegramMessage>("sendMessage", body);
  }

  /**
   * Responds to an inline button callback query.
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    showAlert = false
  ): Promise<TelegramApiResponse<boolean>> {
    return this.execute<boolean>("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }

  /**
   * Configures the webhook URL with allowed updates and secret token.
   */
  async setWebhook(params: {
    url: string;
    secretToken?: string;
    allowedUpdates?: string[];
    dropPendingUpdates?: boolean;
    maxConnections?: number;
  }): Promise<TelegramApiResponse<boolean>> {
    const body: Record<string, unknown> = {
      url: params.url,
      drop_pending_updates: params.dropPendingUpdates ?? false,
      max_connections: params.maxConnections ?? 40,
    };

    if (params.secretToken) {
      body.secret_token = params.secretToken;
    }

    if (params.allowedUpdates) {
      body.allowed_updates = params.allowedUpdates;
    }

    return this.execute<boolean>("setWebhook", body, 15000);
  }

  /**
   * Retrieves current webhook status.
   */
  async getWebhookInfo(): Promise<TelegramApiResponse<TelegramWebhookInfo>> {
    return this.execute<TelegramWebhookInfo>("getWebhookInfo", undefined, 10000);
  }

  /**
   * Removes webhook integration (switching to getUpdates or disabling).
   */
  async deleteWebhook(
    dropPendingUpdates = false
  ): Promise<TelegramApiResponse<boolean>> {
    return this.execute<boolean>(
      "deleteWebhook",
      { drop_pending_updates: dropPendingUpdates },
      10000
    );
  }
}
