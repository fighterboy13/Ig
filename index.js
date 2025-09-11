const { IgApiClient } = require('instagram-private-api');
const fs = require('fs');
const express = require('express');

const ig = new IgApiClient();

// Group Info
const THREAD_ID = "794932516795889"; // <-- यहां अपना Instagram group thread id डालो
const LOCKED_NAME = "🔥 GROUP LOCKED 🔥";

// Express server (Render/Heroku/Termux keepalive)
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("🤖 Instagram Group Locker Bot is alive!"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// 🔑 Session-only Login
async function login() {
  if (fs.existsSync("session.json")) {
    console.log("📂 Loading saved session...");
    const saved = JSON.parse(fs.readFileSync("session.json"));
    await ig.state.deserialize(saved);
  } else {
    console.error("❌ session.json not found! Run generate-session.js first.");
    process.exit(1);
  }
}

// 🔒 Group Name Locker
async function startLocker() {
  await login();

  async function lockLoop() {
    try {
      const thread = ig.entity.directThread(THREAD_ID);
      const info = await thread.info();   // ✅ सिर्फ info fetch करेगा
      const currentName = info.thread_title || "";

      if (currentName !== LOCKED_NAME) {
        console.warn(`⚠️ Group name changed to "${currentName}" → resetting...`);
        await thread.updateTitle(LOCKED_NAME);
        console.log("🔒 Group name reset successfully.");
      } else {
        console.log("✅ Group name is correct.");
      }
    } catch (err) {
      console.error("❌ Error:", err.message);
    }

    setTimeout(lockLoop, 5000); // हर 5 सेकंड में चेक
  }

  lockLoop();
}

startLocker();
