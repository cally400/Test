require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const {
  withRetry,
  createPlayerWithCredentials,
  depositToPlayer,
  withdrawFromPlayer,
  getPlayerBalance
} = require('./ichancy_api');

const app = express();
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const activeUsers = new Set();

// =============================
//         TELEGRAM BOT
// =============================

// رسالة عند /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "مرحباً بك في البوت! 👋\nالبوت متصل بالخادم على Replit.");
});

// إنشاء حساب عشوائي وتجريبي
bot.onText(/\/create/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const baseLogin = "testuser";
    const randStr = Array.from({length: 5}, () => (Math.random() * 36 | 0).toString(36)).join('');
    const login = `${baseLogin}_${randStr}`;
    const pwd = Array.from({length: 10}, () => (Math.random() * 62 | 0).toString(36)).join('');

    const initialAmount = 10; // شحن ابتدائي للتجربة

    bot.sendMessage(chatId, `⏳ جاري إنشاء الحساب التجريبي...\nLogin: ${login}\nPassword: ${pwd}`);

    const { status, result, player_id, email } = await withRetry(() => createPlayerWithCredentials(login, pwd));
    if (!(player_id && result?.result)) {
      bot.sendMessage(chatId, "❌ فشل إنشاء الحساب التجريبي.");
      return;
    }

    if (initialAmount > 0) {
      const depositRes = await withRetry(() => depositToPlayer(player_id, initialAmount));
      if (!(depositRes.status === 200 && depositRes.data?.result)) {
        bot.sendMessage(chatId, `❌ فشل شحن الرصيد الابتدائي: ${JSON.stringify(depositRes.data)}`);
        return;
      }
    }

    const balanceRes = await withRetry(() => getPlayerBalance(player_id));
    const balance = balanceRes.balance || initialAmount;

    bot.sendMessage(chatId,
      `✅ تم إنشاء الحساب التجريبي بنجاح!\n` +
      `Login: ${login}\nEmail: ${email}\nPlayer ID: ${player_id}\n` +
      `رصيدك على ichancy: ${balance} NSP`
    );

  } catch (err) {
    bot.sendMessage(chatId, `❌ حدث خطأ أثناء إنشاء الحساب: ${err.message}`);
  }
});

// شحن الرصيد
bot.onText(/\/deposit (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const amount = parseInt(match[1]);
  const playerId = process.env.PLAYER_ID; // ضع معرف اللاعب هنا
  try {
    const res = await withRetry(() => depositToPlayer(playerId, amount));
    bot.sendMessage(chatId, `✅ شحن الرصيد: ${JSON.stringify(res.data)}`);
  } catch (err) {
    bot.sendMessage(chatId, `❌ فشل شحن الرصيد: ${err.message}`);
  }
});

// سحب الرصيد
bot.onText(/\/withdraw (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const amount = parseInt(match[1]);
  const playerId = process.env.PLAYER_ID; // ضع معرف اللاعب هنا
  try {
    const res = await withRetry(() => withdrawFromPlayer(playerId, amount));
    bot.sendMessage(chatId, `✅ تم سحب الرصيد: ${JSON.stringify(res.data)}`);
  } catch (err) {
    bot.sendMessage(chatId, `❌ فشل السحب: ${err.message}`);
  }
});

// عرض الرصيد
bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  const playerId = process.env.PLAYER_ID; // ضع معرف اللاعب هنا
  try {
    const res = await withRetry(() => getPlayerBalance(playerId));
    bot.sendMessage(chatId, `رصيدك الحالي: ${res.balance} NSP`);
  } catch (err) {
    bot.sendMessage(chatId, `❌ فشل جلب الرصيد: ${err.message}`);
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
