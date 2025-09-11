const { IgApiClient } = require('instagram-private-api');
const fs = require('fs');
const express = require('express');

const ig = new IgApiClient();

// Group Info
const THREAD_ID = "794932516795889"; // <-- рдпрд╣рд╛рдВ рдЕрдкрдирд╛ Instagram group thread id рдбрд╛рд▓реЛ
const LOCKED_NAME = "ЁЯФе GROUP LOCKED ЁЯФе";

// Express server (Render/Heroku/Termux keepalive)
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("ЁЯдЦ Instagram Group Locker Bot is alive!"));
app.listen(PORT, () => console.log(`ЁЯМР Web server running on port ${PORT}`));

// ЁЯФС Session-only Login
async function login() {
  if (fs.existsSync("session.json")) {
    console.log("ЁЯУВ Loading saved session...");
    const saved = JSON.parse(fs.readFileSync("session.json"));
    await ig.state.deserialize(saved);
  } else {
    console.error("тЭМ session.json not found! Run generate-session.js first.");
    process.exit(1);
  }
}

// ЁЯФТ Group Name Locker
async function startLocker() {
  await login();

  async function lockLoop() {
    try {
      // тЬЕ рд╕рд╣реА рддрд░реАрдХрд╛ group info fetch рдХрд░рдиреЗ рдХрд╛
      const threadInfo = await ig.directThread.getById(THREAD_ID);
      const currentName = threadInfo.thread_title || "";

      if (currentName !== LOCKED_NAME) {
        console.warn(`тЪая╕П Group name changed to "${currentName}" тЖТ resetting...`);
        await ig.entity.directThread(THREAD_ID).updateTitle(LOCKED_NAME);
        console.log("ЁЯФТ Group name reset successfully.");
      } else {
        console.log("тЬЕ Group name is correct.");
      }
    } catch (err) {
      console.error("тЭМ Error:", err.message);
    }

    setTimeout(lockLoop, 5000); // рд╣рд░ 5 рд╕реЗрдХрдВрдб рдореЗрдВ рдЪреЗрдХ
  }

  lockLoop();
}

startLocker();
