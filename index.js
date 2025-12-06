require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();

// =============================
//         TELEGRAM BOT
// =============================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// رسالة عند /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "مرحباً بك في البوت! 👋\nالبوت متصل بالخادم على Replit.");
});

// رد على أي رسالة
bot.on('message', (msg) => {
  if (msg.text !== "/start") {
    bot.sendMessage(msg.chat.id, `لقد استلمت رسالتك:\n${msg.text}`);
  }
});

// =============================
//           WEBSITE
// =============================

// صفحة رئيسية
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// مسار ping لـ UptimeRobot
app.get('/ping', (req, res) => {
  res.send("pong");
});

// تشغيل الخادم
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
