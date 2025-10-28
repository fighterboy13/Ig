const { IgApiClient } = require("instagram-private-api");
const fs = require("fs");
require('dotenv').config();

const express = require("express");
const ig = new IgApiClient();

const USERNAME = process.env.IG_USER;
const PASSWORD = process.env.IG_PASS;
const THREAD_ID = process.env.THREAD_ID || "794932516795889";  // अपने ग्रुप थ्रेड ID डालें

const LOCKED_NAME = "🔒 GROUP LOCKED 🔒";

let autoLock = false;
let autoReply = false;
let autoReplyMsg = "Owner is offline right now. Will reply later.";

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Instagram Group Bot is alive!"));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

async function login() {
  ig.state.generateDevice(USERNAME);
  if (fs.existsSync("session.json")) {
    const saved = JSON.parse(fs.readFileSync("session.json"));
    await ig.state.deserialize(saved);
  } else {
    await ig.account.login(USERNAME, PASSWORD);
    const serialized = await ig.state.serialize();
    fs.writeFileSync("session.json", JSON.stringify(serialized));
  }
}

async function lockLoop() {
  if (!autoLock) return;
  try {
    const thread = await ig.entity.directThread(THREAD_ID);
    const threadInfo = await thread.info();
    const botIsAdmin = threadInfo.users.some(u => u.pk === ig.state.cookieUserId && u.is_admin);

    if (!botIsAdmin) {
      console.warn("Bot is not admin. /lock and /unlock won't work.");
      return;
    }

    const currentName = threadInfo.thread_title || "";
    if (currentName !== LOCKED_NAME) {
      await thread.updateTitle(LOCKED_NAME);
      console.log("Group name reset successfully.");
    }
  } catch (err) {
    console.error("Error in lock loop:", err);
  }
  setTimeout(lockLoop, 5000);
}

async function startBot() {
  await login();

  setInterval(async () => {
    try {
      if (!THREAD_ID) {
        console.error("THREAD_ID missing or invalid.");
        return;
      }
      const feed = ig.feed.directThread(THREAD_ID);
      const messages = await feed.items();
      if (!messages || messages.length === 0) return;

      const lastMsg = messages[0];
      const text = lastMsg?.text?.trim();
      const fromSelf = lastMsg.user_id === ig.state.cookieUserId;
      if (!text) return;
      const thread = await ig.entity.directThread(THREAD_ID);

      if (text === "/lock" && !fromSelf) {
        const threadInfo = await thread.info();
        const botIsAdmin = threadInfo.users.some(u => u.pk === ig.state.cookieUserId && u.is_admin);
        if (!botIsAdmin) {
          await thread.broadcastText("I am not admin. /lock won't work.");
        } else {
          autoLock = true;
          await thread.broadcastText("Group locked.");
          lockLoop();
        }
      } else if (text === "/unlock" && !fromSelf) {
        const threadInfo = await thread.info();
        const botIsAdmin = threadInfo.users.some(u => u.pk === ig.state.cookieUserId && u.is_admin);
        if (!botIsAdmin) {
          await thread.broadcastText("I am not admin. /unlock won't work.");
        } else {
          autoLock = false;
          await thread.broadcastText("Group unlocked. You can change name.");
        }
      } else if (text === "/autoreply on" && !fromSelf) {
        autoReply = true;
        await thread.broadcastText("Auto-reply enabled.");
      } else if (text === "/autoreply off" && !fromSelf) {
        autoReply = false;
        await thread.broadcastText("Auto-reply disabled.");
      } else if (text.startsWith("/setreply ") && !fromSelf) {
        autoReplyMsg = text.substring(10);
        await thread.broadcastText(`Auto-reply message set: "${autoReplyMsg}"`);
      } else if (text === "/listgroups" && !fromSelf) {
        const inbox = await ig.feed.directInbox().items();
        inbox.forEach((chat, i) => {
          console.log(`#${i + 1} → ID: ${chat.thread_id}, Title: ${chat.thread_title}`);
        });
        await thread.broadcastText("Groups printed in console logs.");
      } else if (autoReply && !fromSelf) {
        await thread.broadcastText(autoReplyMsg);
      }

      if (
        lastMsg.item_type === "placeholder" &&
        lastMsg.placeholder?.title?.includes("joined")
      ) {
        const username = lastMsg.placeholder?.message?.split("joined")[0] || "New member";
        await thread.broadcastText(`Welcome @${username} to the group!`);
      }
    } catch (error) {
      console.error("Error in bot loop:", error);
    }
  }, 4000);
}

startBot();
