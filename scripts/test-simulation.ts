import {
  buildChatMemberAlertHtml,
  buildJoinRequestAlertHtml,
  detectMembershipTransition,
  escapeHtml,
} from "../lib/telegram/formatters";
import { verifyTelegramWebhookSecret } from "../lib/telegram/security";
import {
  TelegramChatJoinRequest,
  TelegramChatMemberUpdated,
} from "../types/telegram";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ Passed: ${message}`);
}

console.log("=== 1. Timing-Safe Secret Verification Tests ===");
const secret = "super_secret_token_12345";
assert(
  verifyTelegramWebhookSecret(secret, secret),
  "Matching tokens must return true"
);
assert(
  !verifyTelegramWebhookSecret("wrong_token", secret),
  "Mismatched tokens must return false"
);
assert(
  !verifyTelegramWebhookSecret(null, secret),
  "Null received token must return false"
);
assert(
  !verifyTelegramWebhookSecret(secret, null),
  "Null configured secret must return false"
);
assert(
  !verifyTelegramWebhookSecret("a", "aaaa"),
  "Different length tokens must return false without throwing RangeError"
);

console.log("\n=== 2. Membership Transition State Machine Tests ===");
assert(
  detectMembershipTransition("left", "member") === "JOINED",
  "left -> member is JOINED"
);
assert(
  detectMembershipTransition("kicked", "member") === "JOINED",
  "kicked -> member is JOINED"
);
assert(
  detectMembershipTransition("member", "left") === "LEFT",
  "member -> left is LEFT"
);
assert(
  detectMembershipTransition("member", "kicked") === "BANNED",
  "member -> kicked is BANNED"
);
assert(
  detectMembershipTransition("member", "administrator") === "PROMOTED",
  "member -> administrator is PROMOTED"
);

console.log("\n=== 3. HTML Escaping Tests ===");
const dirtyText = `<script>alert("hack") & 'foo'</script>`;
const safeText = escapeHtml(dirtyText);
assert(
  !safeText.includes("<script>") && safeText.includes("&lt;script&gt;"),
  "Angle brackets correctly converted to HTML entities"
);
assert(
  safeText.includes("&amp;"),
  "Ampersand correctly converted to &amp;"
);

console.log("\n=== 4. Chat Member Join Alert HTML Formatter ===");
const mockJoinUpdate: TelegramChatMemberUpdated = {
  chat: {
    id: -1001234567890,
    type: "channel",
    title: "Alpha Tech Signals",
    username: "alphatech",
  },
  from: {
    id: 987654321,
    is_bot: false,
    first_name: "Jane",
    last_name: "Doe",
    username: "janedoe",
  },
  date: Math.floor(Date.now() / 1000),
  old_chat_member: {
    status: "left",
    user: {
      id: 987654321,
      is_bot: false,
      first_name: "Jane",
      last_name: "Doe",
      username: "janedoe",
    },
  },
  new_chat_member: {
    status: "member",
    user: {
      id: 987654321,
      is_bot: false,
      first_name: "Jane",
      last_name: "Doe",
      username: "janedoe",
      is_premium: true,
    },
  },
  invite_link: {
    invite_link: "https://t.me/+AbCdEfGh123",
    creator: {
      id: 111222333,
      is_bot: false,
      first_name: "Admin",
    },
    creates_join_request: false,
    is_primary: false,
    is_revoked: false,
    name: "Twitter Campaign Q3",
  },
};

const joinResult = buildChatMemberAlertHtml(mockJoinUpdate);
assert(joinResult.transition === "JOINED", "Transition identified as JOINED");
assert(joinResult.html.includes("Jane Doe"), "Alert contains user full name");
assert(
  joinResult.html.includes("Twitter Campaign Q3"),
  "Alert contains invite link tracking attribution"
);
console.log("\n--- Sample Rendered Telegram Message ---");
console.log(joinResult.html);
console.log("----------------------------------------\n");

console.log("=== 5. Chat Join Request Formatter ===");
const mockJoinRequest: TelegramChatJoinRequest = {
  chat: {
    id: -1009876543210,
    type: "channel",
    title: "VIP Crypto Hub",
  },
  from: {
    id: 555666777,
    is_bot: false,
    first_name: "John",
    last_name: "Smith",
  },
  user_chat_id: 555666777,
  date: Math.floor(Date.now() / 1000),
  bio: "Full stack engineer looking for tech news",
};

const requestHtml = buildJoinRequestAlertHtml(mockJoinRequest);
assert(
  requestHtml.includes("VIP Crypto Hub"),
  "Join request contains chat title"
);
assert(
  requestHtml.includes("Full stack engineer"),
  "Join request contains user bio"
);

console.log("\n🎉 All simulation checks passed successfully!");
