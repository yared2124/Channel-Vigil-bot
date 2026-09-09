# 🛡️ Telegram Channel Vigil Bot

A production-grade, highly resilient Telegram Bot Webhook Notification System built with **Next.js (App Router)** and **TypeScript**. It monitors Telegram Channel joins, leaves, and join requests in real time and immediately alerts the administrator via direct Telegram message with rich, clickable attribution data.

---

## 📑 Table of Contents
1. [About the Project](#-about-the-project)
2. [Technical Reality Check & Privacy Scope](#-technical-reality-check--privacy-scope)
   - [Channel Member Notifications (Supported)](#1-channel-member-notifications-supported)
   - [Profile View Notifications ("Who Viewed My Profile" - Impossible by Design)](#2-profile-view-notifications-impossible-by-design)
   - [The Attribution Pivot: Tracking Links & Campaigns](#3-the-attribution-pivot)
3. [Architecture & Security Model](#-architecture--security-model)
   - [Timing-Safe Webhook Secret Verification](#timing-safe-webhook-secret-verification)
   - [Immediate HTTP 200 with Next.js `after()`](#immediate-http-200-with-nextjs-after)
   - [The `allowed_updates` Requirement](#the-allowed_updates-requirement)
4. [Project Directory Structure](#-project-directory-structure)
5. [Complete Step-by-Step Setup Guide](#-complete-step-by-step-setup-guide)
   - [Step 1: Create Bot with @BotFather](#step-1-create-your-bot-with-botfather)
   - [Step 2: Get Your Admin Chat ID](#step-2-get-your-admin-chat-id)
   - [Step 3: Add Bot as Channel Administrator](#step-3-add-bot-as-channel-administrator)
   - [Step 4: Configure Environment Variables](#step-4-configure-environment-variables)
6. [Local Development & Webhook Tunneling](#-local-development--webhook-tunneling)
7. [Deploying to Production on Vercel](#-deploying-to-production-on-vercel)
8. [Webhook Management CLI](#-webhook-management-cli)
9. [Testing & Quality Assurance](#-testing--quality-assurance)
10. [Optional Database Integration (Prisma)](#-optional-database-integration-prisma)

---

## 📖 About the Project

Managing and growing a Telegram channel requires knowing **who joins**, **who leaves**, and **which marketing links perform best**. 

Standard Telegram channels only show a generic subscriber counter and an activity log that must be opened manually. **Channel Vigil Bot** automates this by listening to official Telegram Webhook events and sending instant, rich notifications directly to your private Telegram chat whenever:
- 🟢 A new member **joins** your channel (displaying their name, username, ID, and which invite link they used).
- 🔴 A member **leaves** or is removed from your channel.
- ⛔ A user is **banned** or unbanned.
- 📩 A prospective subscriber submits a **join request** (for private channels requiring admin approval).
- ⭐ A member is **promoted** or permissions are updated.

### Key Engineering Features:
- **Zero Framework Bloat**: Uses native `fetch` with strict TypeScript types instead of heavy wrapper libraries.
- **Timing-Safe Crypto**: Webhook secret tokens are authenticated in constant time using SHA-256 buffer comparison.
- **Non-Blocking Execution**: Leverages Next.js `after()` from `next/server` to reply `HTTP 200 OK` to Telegram within milliseconds, preventing webhook timeout retries and duplicate messages.
- **Vercel & Serverless Ready**: Designed for zero cold-start overhead and instant serverless scaling.

---

## 🔬 Technical Reality Check & Privacy Scope

### 1. Channel Member Notifications (Supported)
Telegram Bot API natively provides webhooks when chat members change status in channels or supergroups where the bot is an administrator:
- **`chat_member`**: Emitted when a member joins, leaves, is restricted, or banned.
- **`chat_join_request`**: Emitted when a user requests access via an approval link.
- **`my_chat_member`**: Emitted when the bot's own administrative permissions are modified.

### 2. Profile View Notifications (Impossible by Design)
> [!CAUTION]
> **Why "Who Viewed My Profile" Is Impossible:**
> Telegram's security model strictly guarantees user privacy. Neither the **Telegram Bot API** nor the internal **MTProto Client API** provides any event, webhook, or read receipt indicating that a user opened another user's profile or viewed their avatar.
> - **Malware / Phishing Scams**: Any bot or app claiming to show "Profile Visitors" is fraudulent, typically designed to steal Telegram login sessions or harvest contact lists.
> - **MTProto Userbot Bans**: Unofficial userbot automation attempting to scrape online presence indicators violates Telegram's Terms of Service and triggers permanent phone number bans.

### 3. The Attribution Pivot
Channel Vigil Bot focuses on **legitimate, high-ROI growth tracking**:
1. **Instant Member Identification**: Full name, @username, numeric User ID, language code, and Telegram Premium status.
2. **Custom Campaign Invite Link Attribution**: Create custom invite links for influencers, Twitter, YouTube, or ads. When a member joins, Telegram includes the exact link object (`update.chat_member.invite_link`) and link name, letting you accurately measure campaign ROI.
3. **Private Channel Join Screening**: Review applicant bios and profiles before accepting join requests.

---

## 🛡️ Architecture & Security Model

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

### Timing-Safe Webhook Secret Verification
Telegram sends an `X-Telegram-Bot-Api-Secret-Token` header with incoming webhooks. Comparing strings with standard `===` operators leaks timing information.

In `lib/telegram/security.ts`:
```ts
const receivedHash = crypto.createHash("sha256").update(receivedToken, "utf8").digest();
const expectedHash = crypto.createHash("sha256").update(configuredSecret, "utf8").digest();
return crypto.timingSafeEqual(receivedHash, expectedHash);
```
Both strings are hashed into fixed 32-byte buffers prior to calling `crypto.timingSafeEqual`, preventing length leakage and `RangeError` exceptions.

### Immediate HTTP 200 with Next.js `after()`
Telegram expects an HTTP `200 OK` within **10 seconds**. If a cold start or slow external API call delays the response, Telegram treats delivery as failed and retries, triggering duplicate messages.

Our route handler returns `NextResponse.json({ ok: true })` immediately, delegating message formatting and delivery to the background using Next.js `after()`.

### The `allowed_updates` Requirement
By default, Telegram's `setWebhook` API **does not deliver** `chat_member` updates unless explicitly listed in `allowed_updates`:
```json
"allowed_updates": ["chat_member", "chat_join_request", "my_chat_member", "message", "channel_post"]
```
Our built-in CLI handles this configuration automatically.

---

## 📁 Project Directory Structure

```text
Channel-Vigil-bot/
├── app/
│   ├── api/telegram/webhook/
│   │   └── route.ts          # Webhook POST handler with timing-safe auth & background dispatch
│   ├── layout.tsx            # Global application layout
│   └── page.tsx              # Webhook status dashboard
├── lib/
│   └── telegram/
│       ├── client.ts         # Native fetch Telegram API client with timeout protection
│       ├── formatters.ts     # HTML entity escaping & alert message builder
│       └── security.ts       # Timing-safe HMAC/SHA-256 secret validator
├── prisma/
│   └── schema.prisma         # Optional database schema for member history & analytics
├── scripts/
│   ├── manage-webhook.ts     # Webhook management CLI (set, info, delete)
│   └── test-simulation.ts    # Offline crypto & state machine unit tests
├── test/
│   ├── production-readiness.test.ts # Environment & token sanity checks
│   └── webhook-e2e.test.ts          # End-to-end webhook HTTP simulation test
├── types/
│   └── telegram.ts           # Strict TypeScript interfaces for Telegram API v7+
├── .env                      # Local environment credentials (git-ignored)
├── .env.example              # Template environment file
├── next.config.ts            # Next.js configuration
├── package.json              # Project dependencies and operational scripts
└── tsconfig.json             # Strict TypeScript configuration
```

---

## 🚀 Complete Step-by-Step Setup Guide

### Step 1: Create Your Bot with @BotFather
1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/start`, then send `/newbot`.
3. Give your bot a display name (e.g., `Channel Join Alert Bot`).
4. Give your bot a unique username ending in `bot` (e.g., `my_channel_vigil_bot`).
5. Copy the **HTTP API Token** (format: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).

### Step 2: Get Your Admin Chat ID
1. In Telegram, search for [@userinfobot](https://t.me/userinfobot) and press **Start**.
2. Copy your numeric **User ID** (e.g., `123456789`).
3. **IMPORTANT**: Open a chat with your newly created bot and press **Start** (or send `/start`).  
   *(Telegram prevents bots from messaging users who have never spoken to them).*

### Step 3: Add Bot as Channel Administrator
1. Open your Telegram Channel.
2. Go to **Channel Settings** (pencil icon) ➡️ **Administrators** ➡️ **Add Administrator**.
3. Search for your bot username (e.g., `@my_channel_vigil_bot`) and add it.
4. Grant the following permissions:
   - ✅ **Manage Channel**: On
   - ✅ **Invite Users via Link**: On *(Required for Telegram to emit invite link attribution data)*
5. Save the administrator settings.

### Step 4: Configure Environment Variables
Create or edit your `.env` file in the project root:

```env
# Your Bot Token from @BotFather
TELEGRAM_BOT_TOKEN="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"

# Cryptographic random secret token for webhook verification
TELEGRAM_SECRET_TOKEN="your_random_secret_token_here"

# Your personal Telegram User ID (receives the join/leave alerts)
ADMIN_CHAT_ID="your_telegram_user_id_here"

# (Optional) Restrict alerts to a specific channel ID (e.g. -1001234567890), or leave blank for all
CHANNEL_ID=""

# Public URL of your webhook endpoint
WEBHOOK_URL="https://your-domain.com/api/telegram/webhook"
```

---

## 🌐 Local Development & Webhook Tunneling

Telegram requires a publicly accessible **HTTPS** endpoint to deliver webhooks.

### 1. Start the Next.js App:
```bash
npm run dev
```

### 2. Start a Free HTTPS Tunnel (Cloudflare Tunnel):
In a second terminal:
```bash
npx cloudflared tunnel --url http://localhost:3000
```
It will output a temporary HTTPS address, for example:
`https://random-assigned-name.trycloudflare.com`

### 3. Connect Telegram to Your Local Tunnel:
Update `WEBHOOK_URL` in your `.env` file:
```env
WEBHOOK_URL="https://random-assigned-name.trycloudflare.com/api/telegram/webhook"
```
Then run:
```bash
npm run webhook:set
```

You will see:
```text
✅ Webhook successfully configured!
Allowed updates: chat_member, chat_join_request, my_chat_member, message, channel_post
```

---

## ⚡ Deploying to Production on Vercel

When deploying to Vercel, you get 24/7 uptime without needing your local machine or tunnels running.

### Step 1: Import Project in Vercel
1. Log in to [vercel.com](https://vercel.com) using your GitHub account.
2. Click **Add New...** ➡️ **Project**.
3. Under **Import Git Repository**, select `Channel-Vigil-bot` and click **Import**.

### Step 2: Add Environment Variables in Vercel
Before clicking Deploy, open the **Environment Variables** section and configure:

| Key | Value | Description |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | `your_bot_token` | Bot token from @BotFather |
| `TELEGRAM_SECRET_TOKEN` | `your_secret_token` | Random secret token |
| `ADMIN_CHAT_ID` | `your_user_id` | Your personal Telegram User ID |
| `CHANNEL_ID` | *(Optional)* | Filter by specific channel |

### Step 3: Deploy
- Click **Deploy**. Vercel will build and launch your service.
- You will receive a permanent production domain, for example:
  `https://channel-vigil-bot.vercel.app`

### Step 4: Register Production Webhook
Update `WEBHOOK_URL` in your `.env` file:
```env
WEBHOOK_URL="https://channel-vigil-bot.vercel.app/api/telegram/webhook"
```
Run the setup command from your computer:
```bash
npm run webhook:set
```
Your bot is now live 24/7 on Vercel!

---

## 🛠️ Webhook Management CLI

Manage and diagnose your Telegram Webhook at any time:

```bash
# Register or update webhook with allowed_updates and secret_token
npm run webhook:set

# Check webhook status, pending updates, and last delivery errors
npm run webhook:info

# Delete webhook (switches bot back to getUpdates polling mode)
npm run webhook:delete
```

---

## 🧪 Testing & Quality Assurance

### 1. Offline Simulation Tests
Verifies constant-time crypto, state machine transitions, and HTML entity escaping:
```bash
npm test
```

### 2. Production Readiness & E2E Webhook Tests
Simulates real HTTP requests against the `/api/telegram/webhook` endpoint:
```bash
npm run test:prod
```
Tests:
- ✅ Format and strength of `TELEGRAM_BOT_TOKEN` and `TELEGRAM_SECRET_TOKEN`.
- ✅ Rejection of requests with missing secret header (`HTTP 401`).
- ✅ Rejection of requests with forged secret header (`HTTP 401`).
- ✅ Acceptance and processing of valid `chat_member` join events (`HTTP 200`).
- ✅ Acceptance of `chat_join_request` events (`HTTP 200`).

### 3. Static Type Checking
```bash
npm run typecheck
```

---

## 🗄️ Optional Database Integration (Prisma)

If you wish to persist membership logs, channel statistics, and member history in PostgreSQL, Supabase, or Neon:

1. A complete schema is already provided at [`prisma/schema.prisma`](file:///d:/full%20stack%20with%20%20yared/Channel-Vigil-bot/prisma/schema.prisma).
2. Install Prisma and push the schema:
   ```bash
   npm install prisma @prisma/client
   npx prisma db push
   ```
3. Models included:
   - `TelegramChannel`: Tracks channels and creation dates.
   - `TelegramMember`: Tracks member IDs, usernames, and Telegram Premium status.
   - `MembershipEvent`: Tracks every `JOINED`, `LEFT`, or `BANNED` transition with timestamp and invite link used.

---

## 📄 License
MIT License. Free for commercial and personal use.
