const { IgApiClient } = require("instagram-private-api");
const fs = require("fs");
const express = require("express");

const ig = new IgApiClient();
const USERNAME = process.env.IG_USER || "nfyte_r";
const PASSWORD = process.env.IG_PASS || "g-223344";

// Group Info
const THREAD_ID = "794932516795889"; // apna group thread id daalo
const LOCKED_NAME = "🔒 GROUP LOCKED 🔒";

// State variables
let autoLock = false;
let autoReply = false;
let autoReplyMsg = "Owner is offline right now. Will reply later.";

// Express server (Heroku/Render ke liye)
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("✅ Instagram Group Bot is alive!"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// Session handling
async function login() {
  ig.state.generateDevice(USERNAME);

  if (fs.existsSync("session.json")) {
    console.log("📂 Loading saved session...");
    const saved = JSON.parse(fs.readFileSync("session.json"));
    await ig.state.deserialize(saved);
  } else {
    console.log("🔑 Logging in fresh...");
    await ig.account.login(USERNAME, PASSWORD);
    const serialized = await ig.state.serialize();
    fs.writeFileSync("session.json", JSON.stringify(serialized));
  }
}

// Auto lock loop
async function lockLoop(thread) {
  if (!autoLock) return; // agar lock mode off hai to skip
  try {
    const info = await thread.info();
    const currentName = info.thread_title || "";

    if (currentName !== LOCKED_NAME) {
      console.warn(`⚠️ Name changed to "${currentName}" → resetting...`);
      await thread.updateTitle(LOCKED_NAME);
      console.log("🔒 Group name reset successfully.");
    }
  } catch (err) {
    console.error("❌ Error in lock loop:", err);
  }

  setTimeout(() => lockLoop(thread), 5000);
}

// Start bot
async function startBot() {
  await login();
  const thread = ig.entity.directThread(THREAD_ID);

  // Listen to messages
  setInterval(async () => {
    try {
      const threadInfo = await thread.info();
      const messages = threadInfo.items;
      if (!messages || messages.length === 0) return;

      const lastMsg = messages[0]; // latest msg
      const text = lastMsg?.text?.trim();

      if (!text) return;

      // COMMANDS
      if (text === "/lock") {
        autoLock = true;
        await thread.broadcastText("🔒 Group locked.");
        lockLoop(thread);
      }
      if (text === "/unlock") {
        autoLock = false;
        await thread.broadcastText("🔓 Group unlocked. You can change name.");
      }
      if (text === "/autoreply on") {
        autoReply = true;
        await thread.broadcastText("🤖 Auto-reply enabled.");
      }
      if (text === "/autoreply off") {
        autoReply = false;
        await thread.broadcastText("❌ Auto-reply disabled.");
      }
      if (text.startsWith("/setreply ")) {
        autoReplyMsg = text.replace("/setreply ", "");
        await thread.broadcastText(`✅ Auto-reply message set: "${autoReplyMsg}"`);
      }

      // AUTO REPLY when offline
      if (autoReply && lastMsg.user_id !== ig.state.cookieUserId) {
        await thread.broadcastText(autoReplyMsg);
      }

      // NEW MEMBER JOIN check
      if (
        lastMsg.item_type === "placeholder" &&
        lastMsg.placeholder?.title?.includes("joined")
      ) {
        const username =
          lastMsg.placeholder?.message?.split("joined")[0] || "New member";
        await thread.broadcastText(`👋 Welcome @${username} to the group!`);
      }
    } catch (err) {
      console.error("❌ Error in bot loop:", err);
    }
  }, 4000);
}

startBot();
  
