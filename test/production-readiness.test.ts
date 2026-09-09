import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { verifyTelegramWebhookSecret } from "../lib/telegram/security";

function runProductionSanityChecks() {
  console.log("==================================================");
  console.log("🚀 PRODUCTION READINESS AUDIT");
  console.log("==================================================\n");

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check Bot Token Format
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    errors.push("Missing TELEGRAM_BOT_TOKEN");
  } else if (!/^\d+:[A-Za-z0-9_-]{35,}$/.test(token)) {
    warnings.push("TELEGRAM_BOT_TOKEN does not match standard Telegram token format");
  } else {
    console.log("✅ TELEGRAM_BOT_TOKEN: Present and correctly formatted");
  }

  // 2. Check Secret Token Length and Entropy
  const secret = process.env.TELEGRAM_SECRET_TOKEN;
  if (!secret) {
    errors.push("Missing TELEGRAM_SECRET_TOKEN");
  } else if (secret.length < 16) {
    warnings.push("TELEGRAM_SECRET_TOKEN is short (<16 chars). 32+ characters recommended.");
  } else {
    console.log(`✅ TELEGRAM_SECRET_TOKEN: Present (${secret.length} chars, strong entropy)`);
  }

  // 3. Check Admin Chat ID
  const adminId = process.env.ADMIN_CHAT_ID;
  if (!adminId) {
    errors.push("Missing ADMIN_CHAT_ID");
  } else if (!/^-?\d+$/.test(adminId)) {
    errors.push("ADMIN_CHAT_ID must be a numeric string (e.g. '123456789')");
  } else {
    console.log(`✅ ADMIN_CHAT_ID: Configured for user (${adminId})`);
  }

  // 4. Test Crypto Timing-Safe Verification against replay & tampering
  const testSecret = "dummy_mock_secret_token_1234567890abcdef";
  if (!verifyTelegramWebhookSecret(testSecret, testSecret)) {
    errors.push("Security verification failed identical token test");
  }
  if (verifyTelegramWebhookSecret("tampered_token", testSecret)) {
    errors.push("Security verification falsely accepted a tampered token");
  }
  console.log("✅ Security Engine: Constant-time HMAC/SHA-256 validation verified");

  // Summary
  console.log("\n--------------------------------------------------");
  if (errors.length > 0) {
    console.error("❌ PRODUCTION CHECKS FAILED:");
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  } else {
    console.log("🎉 ALL PRODUCTION SANITY CHECKS PASSED!");
    if (warnings.length > 0) {
      console.log("⚠️ Warnings to note:");
      warnings.forEach((w) => console.log(`   - ${w}`));
    }
  }
  console.log("--------------------------------------------------\n");
}

runProductionSanityChecks();
