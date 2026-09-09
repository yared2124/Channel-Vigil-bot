# Telegram Channel Vigil Bot

A production-grade, highly resilient Telegram Bot Webhook Notification System built with **Next.js (App Router)** and **TypeScript**. It monitors Telegram Channel joins, leaves, and join requests in real time and immediately alerts an administrator via direct Telegram message with rich, clickable attribution data.

---

## 📑 Table of Contents
1. [Architectural Overview](#-architectural-overview)
2. [Technical Reality Check & Scope](#-technical-reality-check--scope)
   - [Channel Member Notifications (Supported)](#1-channel-member-notifications-supported)
   - [Profile View Notifications ("Who Viewed My Profile" - Impossible by Design)](#2-profile-view-notifications-impossible-by-design)
   - [Attribution Pivot: Tracking Joins, Links, and Campaigns](#3-the-attribution-pivot)
3. [Deep Chain-of-Thought & Security Architecture](#-security-architecture)
   - [Timing-Safe Webhook Secret Verification](#timing-safe-webhook-secret-verification)
   - [Non-Blocking Dispatch via Next.js `after()`](#non-blocking-dispatch-via-nextjs-after)
   - [Allowed Updates Array](#the-allowed_updates-requirement)
4. [Step-by-Step Setup Guide](#-step-by-step-setup-guide)
   - [Step 1: Create Bot with @BotFather](#step-1-create-your-bot-with-botfather)
   - [Step 2: Add Bot as Channel Administrator](#step-2-add-bot-as-channel-administrator)
   - [Step 3: Obtain Admin Chat ID](#step-3-obtain-admin-chat-id)
   - [Step 4: Configure Environment Variables](#step-4-configure-environment-variables)
5. [Local Development & Webhook Tunneling](#-local-development--webhook-tunneling)
6. [Webhook Management CLI](#-webhook-management-cli)
7. [Database Layer (Optional Prisma Schema)](#-optional-database-layer)
8. [Testing & Verification](#-testing--verification)

---

## 🏛️ Architectural Overview

```
                           Telegram Servers
                                  │
      (User Joins/Leaves Channel) │ [chat_member / chat_join_request]
                                  ▼
                     POST /api/telegram/webhook
                                  │
        ┌─────────────────────────┴─────────────────────────┐
        │ 1. Validate X-Telegram-Bot-Api-Secret-Token       │
        │    (Constant-time SHA-256 Buffer Comparison)      │
        │ 2. Return HTTP 200 OK Immediately (< 50ms)        │
        └─────────────────────────┬─────────────────────────┘
                                  │ Next.js after()
                                  ▼
                     Background Dispatcher Task
                                  │
         ┌────────────────────────┴────────────────────────┐
         │ 3. Classify Transition (JOIN / LEAVE / BAN / REQ)│
         │ 4. Extract User, Chat & Invite Link Attribution │
         │ 5. Format HTML with Safe Entity Escaping        │
         │ 6. Send Alert to Administrator Chat             │
         └────────────────────────┬────────────────────────┘
                                  │
                                  ▼
                        Admin Telegram Chat
                 [🟢 New Member Joined Channel!]
```

---

## 🔬 Technical Reality Check & Scope

### 1. Channel Member Notifications (Supported)
Telegram Bot API natively emits updates when chat members change state in a channel or supergroup where the bot is an administrator:
- **`chat_member`**: Triggered when a user joins, leaves, is banned/kicked, or promoted.
- **`chat_join_request`**: Triggered when a user clicks an invite link requiring admin approval.
- **`my_chat_member`**: Triggered when the bot's own administrative privileges change.

### 2. Profile View Notifications (Impossible by Design)
> [!CAUTION]
> **Why "Who Viewed My Telegram Profile" is Impossible:**
> Telegram's security and privacy architecture strictly prevents clients and bots from knowing who opened, browsed, or viewed a user's personal profile or avatar.
> - **No API or MTProto Event**: Telegram's MTProto protocol does not generate or emit read-receipt events for user profile views.
> - **Malicious Scams & Token Stealers**: Any third-party service, bot, or application claiming to provide "Profile Visitor Tracker" functionality is either:
>   1. A **phishing scam** attempting to steal user session strings or login codes.
>   2. An unauthorized **spam bot** designed to harvest phone numbers and contact lists.
> - **Userbot Bans**: Unofficial MTProto client automation attempting to poll online statuses of contacts violates Telegram's Terms of Service and triggers immediate account revocation (phone number ban).

### 3. The Attribution Pivot
Rather than attempting impossible or violating hacks, this system focuses on **legitimate, high-impact channel growth attribution**:
1. **Real-time Channel Joins/Leaves**: Instantly know who joined, their User ID, @username, full name, language, and whether they have Telegram Premium.
2. **Custom Invite Link Tracking**: Create named invite links in Telegram (e.g., `Twitter_Campaign_Q3`, `YouTube_Promo`, `Influencer_Collab`). When a member joins, Telegram transmits the exact link object and creator in `update.chat_member.invite_link`, allowing you to attribute ROI to specific marketing channels.
3. **Join Request Screening**: Review applicants and their bios before accepting them into private channels.

---

## 🛡️ Security Architecture

### Timing-Safe Webhook Secret Verification
Telegram sends an optional `X-Telegram-Bot-Api-Secret-Token` header with every webhook payload. If compared using standard `===` operators, differences in execution time can theoretically reveal string length and characters to an attacker via a timing attack.

In `lib/telegram/security.ts`:
```ts
const receivedHash = crypto.createHash("sha256").update(receivedToken, "utf8").digest();
const expectedHash = crypto.createHash("sha256").update(configuredSecret, "utf8").digest();
return crypto.timingSafeEqual(receivedHash, expectedHash);
```
Hashing both values with SHA-256 guarantees fixed 32-byte buffers, preventing `RangeError` from unequal length inputs while executing comparison in constant time.

### Non-Blocking Dispatch via Next.js `after()`
Telegram expects an HTTP `200 OK` within **10 seconds**. If your serverless function experiences a cold start or delays responding while waiting for an external API call, Telegram treats the webhook as failed and retries every few minutes, resulting in duplicate notifications.

This codebase utilizes Next.js App Router's `after()` API:
1. Validates authentication synchronously.
2. Returns `NextResponse.json({ ok: true }, { status: 200 })` immediately.
3. Dispatches formatting and Telegram API messages inside the background execution block scheduled by `after()`.

### The `allowed_updates` Requirement
By default, calling `setWebhook` **does not** subscribe to member updates. You must explicitly supply:
```json
"allowed_updates": ["chat_member", "chat_join_request", "my_chat_member", "message", "channel_post"]
```
Our `scripts/manage-webhook.ts` CLI configures this automatically.

---

## 🚀 Step-by-Step Setup Guide

### Step 1: Create Your Bot with @BotFather
1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to choose a name and username (e.g., `MyChannelVigilBot`).
3. Save the **Bot Token** provided (e.g., `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).

### Step 2: Add Bot as Channel Administrator
1. Open your Telegram Channel settings.
2. Go to **Administrators** ➡️ **Add Administrator**.
3. Search for your bot's username and add it.
4. Grant the bot administrator privileges:
   - **Manage Channel**: Required.
   - **Invite Users via Link**: Required to receive and track invite links.

### Step 3: Obtain Admin Chat ID
1. Message [@userinfobot](https://t.me/userinfobot) or [@RawDataBot](https://t.me/RawDataBot) in Telegram.
2. Copy your numeric User ID (e.g., `987654321`). This will receive the admin join/leave alerts.
3. Send a message like `/start` directly to your newly created bot to open a direct private chat (Telegram bots cannot initiate direct messages to users who have never spoken to them).

### Step 4: Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in the values:
```env
TELEGRAM_BOT_TOKEN="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
TELEGRAM_SECRET_TOKEN="generate_a_random_32_character_string_here"
ADMIN_CHAT_ID="987654321"
CHANNEL_ID="" # Leave blank to monitor all channels the bot administers, or set e.g. -1001234567890
WEBHOOK_URL="https://your-domain.com/api/telegram/webhook"
```

---

## 🌐 Local Development & Webhook Tunneling

Telegram requires an HTTPS URL to deliver webhooks. During local development, use Cloudflare Tunnels or ngrok:

### Using Cloudflare Tunnels (Free & No Account Required):
```bash
npx cloudflared tunnel --url http://localhost:3000
```
Copy the generated URL (e.g., `https://random-words.trycloudflare.com`).

### Using ngrok:
```bash
ngrok http 3000
```
Copy the forwarded HTTPS URL (e.g., `https://xxxx.ngrok-free.app`).

Update `WEBHOOK_URL` in `.env.local`:
```env
WEBHOOK_URL="https://xxxx.ngrok-free.app/api/telegram/webhook"
```

---

## 🛠️ Webhook Management CLI

This project includes a convenient TypeScript CLI to configure and inspect your webhook with Telegram:

```bash
# Register the webhook with secret token and allowed_updates
npm run webhook:set

# Check webhook health, pending updates, and last delivery errors
npm run webhook:info

# Remove the webhook (switches bot back to getUpdates polling mode)
npm run webhook:delete
```

---

## 🗄️ Optional Database Layer

An optional Prisma schema is provided in `prisma/schema.prisma` for PostgreSQL / Supabase / Neon:
- `TelegramChannel`: Records monitored channel metadata.
- `TelegramMember`: Tracks unique members, Premium status, and username history.
- `MembershipEvent`: Records every `JOINED`, `LEFT`, or `BANNED` transition with timestamp and invite link used.

To activate:
```bash
npm install prisma @prisma/client
npx prisma generate
npx prisma db push
```

---

## 🧪 Testing & Verification

Run the built-in offline test suite:
```bash
npm test
```
This verifies:
- SHA-256 timing-safe secret token verification.
- Membership state transition detection (`JOINED`, `LEFT`, `BANNED`, `PROMOTED`).
- HTML entity escaping and user profile link construction.
- Sample payload generation.

To run the Next.js development server:
```bash
npm run dev
```

To run a production build:
```bash
npm run build
npm start
```
