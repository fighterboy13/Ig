const { IgApiClient } = require('instagram-private-api');
const fs = require('fs');
const express = require('express');

const ig = new IgApiClient();
const USERNAME = process.env.IG_USER || "nfyte_r";
const PASSWORD = process.env.IG_PASS || "g-223344";

// Group Info
const THREAD_ID = "794932516795889"; // <--   group thread id 
const LOCKED_NAME = " GROUP LOCKED ";

// Express server (Render/Heroku ke liye)
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send(" Instagram Group Locker Bot is alive!"));
app.listen(PORT, () => console.log(` Web server running on port ${PORT}`));

//  Session handling
async function login() {
  ig.state.generateDevice(USERNAME);

  if (fs.existsSync("session.json")) {
    console.log(" Loading saved session...");
    const saved = JSON.parse(fs.readFileSync("session.json"));
    await ig.state.deserialize(saved);
  } else {
    console.log(" Logging in fresh...");
    await ig.account.login(USERNAME, PASSWORD);
    const serialized = await ig.state.serialize();
    fs.writeFileSync("session.json", JSON.stringify(serialized));
  }
}

//  Start Locker
async function startLocker() {
  await login();

  async function lockLoop() {
    try {
      const thread = ig.entity.directThread(THREAD_ID);
      const info = await thread.broadcastText("name"); // dummy action
      const currentName = info.thread_title || "";

      if (currentName !== LOCKED_NAME) {
        console.warn(` Name changed to "${currentName}"  resetting...`);
        await thread.updateTitle(LOCKED_NAME);
        console.log(" Group name reset successfully.");
      } else {
        console.log(" Group name is correct.");
      }
    } catch (err) {
      console.error(" Error:", err.message);
    }

    setTimeout(lockLoop, 5000); //  5   
  }

  lockLoop();
}

startLocker();
