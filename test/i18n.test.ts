import {
  buildLocalizedChatMemberAlertHtml,
  buildLocalizedJoinRequestAlertHtml,
  getLanguageKeyboard,
  translations,
} from "../lib/i18n";
import {
  deleteChannelWelcome,
  getChannelWelcome,
  getUserLanguage,
  setChannelWelcome,
  setUserLanguage,
} from "../lib/storage";
import {
  TelegramChatJoinRequest,
  TelegramChatMemberUpdated,
} from "../types/telegram";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runI18nAndWelcomeTests() {
  console.log("==================================================");
  console.log("🌍 BILINGUAL (AMHARIC/ENGLISH) & AUTO-WELCOME TESTS");
  console.log("==================================================\n");

  const mockUpdate: TelegramChatMemberUpdated = {
    chat: {
      id: -1001234567890,
      title: "Ethiopian Tech Hub",
      type: "channel",
    },
    from: {
      id: 555444333,
      is_bot: false,
      first_name: "Abebe",
      last_name: "Bikila",
      username: "abebe",
    },
    date: Math.floor(Date.now() / 1000),
    old_chat_member: {
      status: "left",
      user: { id: 555444333, is_bot: false, first_name: "Abebe" },
    },
    new_chat_member: {
      status: "member",
      user: {
        id: 555444333,
        is_bot: false,
        first_name: "Abebe",
        last_name: "Bikila",
        username: "abebe",
      },
    },
  };

  // 1. Amharic Alert Formatting Test
  console.log("--- 1. Amharic Localized Alert ---");
  const amResult = buildLocalizedChatMemberAlertHtml(mockUpdate, "am");
  assert(
    amResult.html.includes(translations.am.joinTitle),
    "Alert contains Amharic join title"
  );
  assert(
    amResult.html.includes("📢 <b>ቻናል:</b>"),
    "Alert contains Amharic channel label"
  );
  assert(
    amResult.html.includes("👤 <b>ተጠቃሚ:</b>"),
    "Alert contains Amharic user label"
  );
  console.log("\nSample Amharic Alert:\n" + amResult.html + "\n");

  // 2. English Alert Formatting Test
  console.log("--- 2. English Localized Alert ---");
  const enResult = buildLocalizedChatMemberAlertHtml(mockUpdate, "en");
  assert(
    enResult.html.includes(translations.en.joinTitle),
    "Alert contains English join title"
  );
  assert(
    enResult.html.includes("📢 <b>Channel:</b>"),
    "Alert contains English channel label"
  );

  // 3. Language Inline Keyboard
  console.log("\n--- 3. Language Selector Keyboard ---");
  const kb = getLanguageKeyboard();
  assert(
    kb.inline_keyboard[0][0].callback_data === "set_lang:am",
    "Amharic button configured"
  );
  assert(
    kb.inline_keyboard[0][1].callback_data === "set_lang:en",
    "English button configured"
  );

  // 4. User Language Preference Storage
  console.log("\n--- 4. User Language Storage ---");
  const testUserId = "987650001";
  await setUserLanguage(testUserId, "am");
  const langAm = await getUserLanguage(testUserId);
  assert(langAm === "am", "Saved language 'am' retrieved");

  await setUserLanguage(testUserId, "en");
  const langEn = await getUserLanguage(testUserId);
  assert(langEn === "en", "Switched language 'en' retrieved");

  // 5. Auto-Welcome Message Storage
  console.log("\n--- 5. Channel Auto-Welcome Message ---");
  const testChannelId = "-10099887766";
  const customWelcomeText = "እንኳን ወደ ቻናላችን በሰላም መጡ! ልዩ ቅናሾች እዚህ ይገኛሉ።";

  await setChannelWelcome(testChannelId, customWelcomeText);
  const fetchedWelcome = await getChannelWelcome(testChannelId);
  assert(
    fetchedWelcome === customWelcomeText,
    "Custom welcome text saved and retrieved correctly"
  );

  await deleteChannelWelcome(testChannelId);
  const welcomeAfterDel = await getChannelWelcome(testChannelId);
  assert(welcomeAfterDel === null, "Welcome message successfully deleted");

  console.log("\n==================================================");
  console.log("🎉 ALL BILINGUAL & AUTO-WELCOME TESTS PASSED!");
  console.log("==================================================\n");
}

runI18nAndWelcomeTests();
