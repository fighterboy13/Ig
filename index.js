const { IgApiClient } = require("instagram-private-api");
const fs = require("fs");
const express = require("express");

const ig = new IgApiClient();
const USERNAME = process.env.IG_USER || "nfyte_r";
const PASSWORD = process.env.IG_PASS || "g-223344";

// ग्रुप थ्रेड ID को स्ट्रिंग में सेट करें
let THREAD_ID = "794932516795889"; // ध्यान दें यह स्ट्रिंग है
const LOCKED_NAME = "🔒 GROUP LOCKED 🔒";

// स्टेट वैरिएबल्स
let autoLock = false;
let autoReply = false;
let autoReplyMsg = "Owner is offline right now. Will reply later.";

// एक्सप्रेस सर्वर सेटअप
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("✅ Instagram Group Bot is alive!"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

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

async function lockLoop() {
  if (!autoLock || !THREAD_ID) return;
  try {
    const thread = ig.entity.directThread(THREAD_ID);

    const threadInfo = await thread.info();
    const botIsAdmin = threadInfo.users.some(
      u => u.pk === ig.state.cookieUserId && u.is_admin
    );

    if (!botIsAdmin) {
      console.warn("⚠️ Bot is not admin. /lock and /unlock will not work.");
      return;
    }

    const currentName = threadInfo.thread_title || "";

    if (currentName !== LOCKED_NAME) {
      console.warn(`⚠️ Name changed to "${currentName}" → resetting...`);
      await thread.updateTitle(LOCKED_NAME);
      console.log("🔒 Group name reset successfully.");
    }
  } catch (err) {
    console.error("❌ Error in lock loop:", err);
  }

  setTimeout(lockLoop, 5000);
}

async function startBot() {
  await login();

  setInterval(async () => {
    try {
      if (!THREAD_ID || THREAD_ID === "undefined") {
        console.error("THREAD_ID is missing or undefined. Skipping this iteration.");
        return;
      }

      console.log("Using THREAD_ID:", THREAD_ID);

      const feed = ig.feed.directThread(THREAD_ID);
      const messages = await feed.items();
      if (!messages || messages.length === 0) return;

      const lastMsg = messages[0];
      const text = lastMsg?.text?.trim();
      const fromSelf = lastMsg.user_id === ig.state.cookieUserId;

      if (!text) return;

      const thread = ig.entity.directThread(THREAD_ID);

      if (text === "/lock" && !fromSelf) {
        const threadInfo = await thread.info();
        const botIsAdmin = threadInfo.users.some(
          u => u.pk === ig.state.cookieUserId && u.is_admin
        );

        if (!botIsAdmin) {
          console.warn("⚠️ Bot is not admin. Cannot execute /lock.");
          await thread.broadcastText("⚠️ I am not admin. /lock won't work.");
        } else {
          autoLock = true;
          await thread.broadcastText("🔒 Group locked.");
          lockLoop();
        }
      }

      if (text === "/unlock" && !fromSelf) {
        const threadInfo = await thread.info();
        const botIsAdmin = threadInfo.users.some(
          u => u.pk === ig.state.cookieUserId && u.is_admin
        );

        if (!botIsAdmin) {
          console.warn("⚠️ Bot is not admin. Cannot execute /unlock.");
          await thread.broadcastText("⚠️ I am not admin. /unlock won't work.");
        } else {
          autoLock = false;
          await thread.broadcastText("🔓 Group unlocked. You can change name.");
        }
      }

      if (text === "/autoreply on" && !fromSelf) {
        autoReply = true;
        await thread.broadcastText("🤖 Auto-reply enabled.");
      }

      if (text === "/autoreply off" && !fromSelf) {
        autoReply = false;
        await thread.broadcastText("❌ Auto-reply disabled.");
      }

      if (text.startsWith("/setreply ") && !fromSelf) {
        autoReplyMsg = text.replace("/setreply ", "");
        await thread.broadcastText(`✅ Auto-reply message set: "${autoReplyMsg}"`);
      }

      if (text === "/listgroups" && !fromSelf) {
        const inbox = await ig.feed.directInbox().items();
        console.log("📋 Available Threads:");
        inbox.forEach((chat, i) => {
          console.log(`#${i + 1} → ID: ${chat.thread_id}, Title: ${chat.thread_title}`);
        });
        await thread.broadcastText("✅ Groups printed in console logs.");
      }

      if (autoReply && !fromSelf) {
        await thread.broadcastText(autoReplyMsg);
      }

      if (
        lastMsg.item_type === "placeholder" &&
        lastMsg.placeholder?.title?.includes("joined")
      ) {
        const username = lastMsg.placeholder?.message?.split("joined")[0] || "New member";
        await thread.broadcastText(`👋 Welcome @${username} to the group!`);
      }
    } catch (err) {
      console.error("❌ Error in bot loop:", err);
    }
  }, 4000);
}

startBot();
