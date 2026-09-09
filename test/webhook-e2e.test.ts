import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const SECRET = process.env.TELEGRAM_SECRET_TOKEN;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runE2EProductionTests() {
  console.log("==================================================");
  console.log("🧪 E2E WEBHOOK ENDPOINT PRODUCTION TEST SUITE");
  console.log(`📡 Testing endpoint: ${BASE_URL}/api/telegram/webhook`);
  console.log("==================================================\n");

  try {
    // Test 1: Health Check GET Request
    console.log("--- Test 1: Health Check (GET) ---");
    const getRes = await fetch(`${BASE_URL}/api/telegram/webhook`);
    assert(getRes.status === 200, "GET /api/telegram/webhook returns HTTP 200");
    const getData = (await getRes.json()) as { ok: boolean; service: string };
    assert(getData.ok === true, "Health check body contains ok: true");
    assert(typeof getData.service === "string", "Health check reports service title");

    // Test 2: Reject request missing secret header
    console.log("\n--- Test 2: Missing Secret Token (Security) ---");
    const noSecretRes = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ update_id: 1001 }),
    });
    assert(
      noSecretRes.status === 401,
      "POST without secret header rejected with HTTP 401 Unauthorized"
    );

    // Test 3: Reject request with forged secret header
    console.log("\n--- Test 3: Forged Secret Token (Security) ---");
    const fakeSecretRes = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": "attacker_fake_token_attempt_123",
      },
      body: JSON.stringify({ update_id: 1002 }),
    });
    assert(
      fakeSecretRes.status === 401,
      "POST with invalid secret header rejected with HTTP 401 Unauthorized"
    );

    // Test 4: Accept valid chat_member (JOIN) event
    console.log("\n--- Test 4: Valid Chat Member Join Webhook Event ---");
    const joinPayload = {
      update_id: 1003,
      chat_member: {
        chat: {
          id: -1001234567890,
          title: "Production Test Channel",
          type: "channel",
        },
        from: {
          id: 999888777,
          is_bot: false,
          first_name: "Test",
          last_name: "User",
          username: "testuser",
        },
        date: Math.floor(Date.now() / 1000),
        old_chat_member: {
          status: "left",
          user: {
            id: 999888777,
            is_bot: false,
            first_name: "Test",
          },
        },
        new_chat_member: {
          status: "member",
          user: {
            id: 999888777,
            is_bot: false,
            first_name: "Test",
          },
        },
        invite_link: {
          invite_link: "https://t.me/+TestInvite123",
          creator: {
            id: 111222333,
            is_bot: false,
            first_name: "Admin",
          },
          creates_join_request: false,
          is_primary: false,
          is_revoked: false,
          name: "Vercel Launch Promo",
        },
      },
    };

    const validJoinRes = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": SECRET || "",
      },
      body: JSON.stringify(joinPayload),
    });

    assert(
      validJoinRes.status === 200,
      "POST with valid secret token accepted with HTTP 200 OK"
    );
    const joinData = (await validJoinRes.json()) as { ok: boolean };
    assert(joinData.ok === true, "Response body contains { ok: true }");

    // Test 5: Accept valid chat_join_request event
    console.log("\n--- Test 5: Valid Chat Join Request Webhook Event ---");
    const requestPayload = {
      update_id: 1004,
      chat_join_request: {
        chat: {
          id: -1001234567890,
          title: "Production Test Channel",
          type: "channel",
        },
        from: {
          id: 444333222,
          is_bot: false,
          first_name: "Prospective",
          last_name: "Member",
        },
        user_chat_id: 444333222,
        date: Math.floor(Date.now() / 1000),
        bio: "Interested in the community!",
      },
    };

    const validReqRes = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": SECRET || "",
      },
      body: JSON.stringify(requestPayload),
    });

    assert(
      validReqRes.status === 200,
      "POST chat_join_request accepted with HTTP 200 OK"
    );
    const reqData = (await validReqRes.json()) as { ok: boolean };
    assert(reqData.ok === true, "Response body contains { ok: true }");

    console.log("\n==================================================");
    console.log("🎉 ALL E2E PRODUCTION TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================\n");
  } catch (err: unknown) {
    console.error("❌ E2E Test execution failed:", err);
    process.exit(1);
  }
}

runE2EProductionTests();
