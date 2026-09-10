import {
  getChannelOwner,
  getUserChannels,
  removeChannelOwner,
  saveChannelOwner,
} from "../lib/storage";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runMultiUserTests() {
  console.log("==================================================");
  console.log("👥 MULTI-USER DYNAMIC ROUTING TEST SUITE");
  console.log("==================================================\n");

  const userA = "7220676785"; // Admin/User A
  const userB = "9988776655"; // Friend/User B

  const channel1 = "-1001111111111"; // User A's channel
  const channel2 = "-1002222222222"; // User B's channel

  console.log("--- 1. Register Channel 1 to User A ---");
  await saveChannelOwner(channel1, userA, "User A Tech News");
  const owner1 = await getChannelOwner(channel1);
  assert(owner1 === userA, `Channel 1 correctly maps to User A (${userA})`);

  console.log("\n--- 2. Register Channel 2 to User B (Friend) ---");
  await saveChannelOwner(channel2, userB, "Friend Crypto Channel");
  const owner2 = await getChannelOwner(channel2);
  assert(owner2 === userB, `Channel 2 correctly maps to User B (${userB})`);

  console.log("\n--- 3. Verify Isolation Between Users ---");
  const userAChannels = await getUserChannels(userA);
  assert(
    userAChannels.some((c) => c.channelId === channel1),
    "User A has Channel 1"
  );
  assert(
    !userAChannels.some((c) => c.channelId === channel2),
    "User A does NOT have User B's channel (Isolation verified)"
  );

  const userBChannels = await getUserChannels(userB);
  assert(
    userBChannels.some((c) => c.channelId === channel2),
    "User B has Channel 2"
  );
  assert(
    !userBChannels.some((c) => c.channelId === channel1),
    "User B does NOT have User A's channel"
  );

  console.log("\n--- 4. Disconnect Channel ---");
  await removeChannelOwner(channel2, userB);
  const ownerAfterRemoval = await getChannelOwner(channel2);
  assert(
    ownerAfterRemoval === null,
    "Channel 2 successfully unmapped after bot removal"
  );

  console.log("\n==================================================");
  console.log("🎉 ALL MULTI-USER ROUTING TESTS PASSED!");
  console.log("==================================================\n");
}

runMultiUserTests();
