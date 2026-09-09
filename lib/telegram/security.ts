import crypto from "crypto";

/**
 * Validates the incoming Telegram Webhook Secret Token in constant time.
 *
 * Prevents timing attacks by hashing both strings with SHA-256 prior to comparison,
 * ensuring fixed-length buffers for crypto.timingSafeEqual and eliminating length-leakage.
 *
 * @param receivedToken - Token extracted from the 'x-telegram-bot-api-secret-token' request header
 * @param configuredSecret - Expected secret token configured in TELEGRAM_SECRET_TOKEN
 * @returns boolean indicating whether the request is authentic
 */
export function verifyTelegramWebhookSecret(
  receivedToken: string | null | undefined,
  configuredSecret: string | null | undefined
): boolean {
  if (!receivedToken || !configuredSecret) {
    return false;
  }

  try {
    const receivedHash = crypto
      .createHash("sha256")
      .update(receivedToken, "utf8")
      .digest();

    const expectedHash = crypto
      .createHash("sha256")
      .update(configuredSecret, "utf8")
      .digest();

    return crypto.timingSafeEqual(receivedHash, expectedHash);
  } catch {
    return false;
  }
}
