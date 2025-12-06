require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

// استيراد دوال API
const {
  withRetry,
  createPlayer,
  depositToPlayer,
  withdrawFromPlayer,
  getPlayerBalance
} = require('./ichancy_api');

const app = express();

// =============================
//         TELEGRAM BOT
// =============================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// رسالة عند /start
bot.onText(/\/start/, async (msg) => {
  bot.sendMessage(msg.chat.id,
    "مرحباً بك في البوت! 👋\nكل شيء يعمل بنجاح الآن على Railway."
  );
});

// =============================
//      إنشاء حساب جديد
// =============================
bot.onText(/\/create/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const result = await withRetry(createPlayer);

    const login = result.login;
    const pwd = result.password;
    const playerId = result.playerId;

    if (!playerId) {
      return bot.sendMessage(chatId, "❌ تم إنشاء الحساب لكن لم يتم العثور على playerId!");
    }

    bot.sendMessage(
      chatId,
      `✅ تم إنشاء حساب جديد بنجاح:\n\n` +
      `👤 Login: <code>${login}</code>\n` +
      `🔐 Password: <code>${pwd}</code>\n` +
      `🆔 Player ID: <code>${playerId}</code>`,
      { parse_mode: "HTML" }
    );

  } catch (err) {
    bot.sendMessage(chatId, `❌ خطأ أثناء إنشاء الحساب: ${err.message}`);
  }
});

// =============================
//         شحن الرصيد
// =============================
bot.onText(/\/deposit (\d+) (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const amount = parseInt(match[1]);
  const playerId = parseInt(match[2]);

  try {
    const res = await withRetry(depositToPlayer, playerId, amount);
    bot.sendMessage(chatId, `💰 شحن الرصيد:\n${JSON.stringify(res.data)}`);
  } catch (err) {
    bot.sendMessage(chatId, `❌ فشل شحن الرصيد: ${err.message}`);
  }
});

// =============================
//           سحب الرصيد
// =============================
bot.onText(/\/withdraw (\d+) (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const amount = parseInt(match[1]);
  const playerId = parseInt(match[2]);

  try {
    const res = await withRetry(withdrawFromPlayer, playerId, amount);
    bot.sendMessage(chatId, `🏧 تم السحب:\n${JSON.stringify(res.data)}`);
  } catch (err) {
    bot.sendMessage(chatId, `❌ فشل السحب: ${err.message}`);
  }
});

// =============================
//           عرض الرصيد
// =============================
bot.onText(/\/balance (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const playerId = parseInt(match[1]);

  try {
    const res = await withRetry(getPlayerBalance, playerId);
    bot.sendMessage(chatId, `💳 رصيد اللاعب: ${res.balance} NSP`);
  } catch (err) {
    bot.sendMessage(chatId, `❌ فشل جلب الرصيد: ${err.message}`);
  }
});

// ===========================
