// bot_handlers.js
const { createPlayerWithCredentials, depositToPlayer, withdrawFromPlayer, getPlayerBalance, checkPlayerExists } = require("./ichancy_api");
const fs = require("fs-extra");
const playersFile = "./players.json";

function loadPlayers() {
  if (!fs.existsSync(playersFile)) return { last: null, all: [] };
  return fs.readJsonSync(playersFile);
}
function savePlayers(obj) {
  fs.writeJsonSync(playersFile, obj, { spaces: 2 });
}

const activeUsers = new Set();

function registerIchancyHandlers(bot) {
  bot.onText(/\/create/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "⏳ أدخل اسم الحساب المطلوب (أحرف لاتينية فقط):").then(() => {
      bot.once("message", async (m) => {
        const base = m.text.trim();
        if (!/^[A-Za-z0-9_.-]+$/.test(base)) return bot.sendMessage(chatId, "يرجى استخدام الأحرف اللاتينية فقط.");
        let login = base + "_TSA";
        // check duplicates
        const store = loadPlayers();
        const existingLogins = new Set((store.all||[]).map(x=>x.login));
        let counter = 1;
        while (existingLogins.has(login) || await checkPlayerExists(login)) {
          login = `${base}_TSA${counter++}`;
          if (counter > 20) {
            login = `${base}${Math.random().toString(36).slice(2,4)}`;
            break;
          }
        }
        bot.sendMessage(chatId, "ادخل كلمة السر (8-11 خانة):").then(()=>{
          bot.once("message", async (m2)=>{
            const pwd = m2.text.trim();
            if (pwd.length < 8 || pwd.length > 11) return bot.sendMessage(chatId, "طول كلمة السر غير صحيح.");
            bot.sendMessage(chatId, "ادخل مبلغ الشحن الابتدائي (≥10):").then(()=> {
              bot.once("message", async (m3)=>{
                const amount = parseInt(m3.text.trim());
                if (isNaN(amount) || amount < 10) return bot.sendMessage(chatId, "أدخل مبلغ صحيح ≥10");
                bot.sendMessage(chatId, "⏳ جاري إنشاء الحساب...");
                try {
                  const { raw, playerId, email } = await createPlayerWithCredentials(login, pwd);
                  if (!playerId || !(raw?.result)) {
                    return bot.sendMessage(chatId, "❌ فشل إنشاء الحساب، حاول لاحقاً.");
                  }
                  // save
                  const now = new Date().toISOString();
                  const store = loadPlayers();
                  const rec = { login, password: pwd, playerId, email, created_at: now };
                  store.last = rec;
                  store.all = store.all || [];
                  store.all.push(rec);
                  savePlayers(store);

                  // deposit if amount >0
                  const dep = await depositToPlayer(playerId, amount);
                  if (!(dep && dep.result)) {
                    // optionally revert or notify
                    return bot.sendMessage(chatId, `❌ فشل الشحن الابتدائي: ${dep?.notification?.[0]?.content || JSON.stringify(dep)}`);
                  }

                  // get balance
                  const bal = (await getPlayerBalance(playerId)).balance || amount;
                  bot.sendMessage(chatId, `✅ تم إنشاء الحساب!\nLogin: ${login}\nPassword: ${pwd}\nPlayerId: ${playerId}\nرصيد: ${bal} NSP`);
                } catch (err) {
                  console.error(err);
                  bot.sendMessage(chatId, `❌ خطأ: ${err.message || err}`);
                }
              });
            });
          });
        });
      });
    });
  });

  // deposit command that uses last player
  bot.onText(/\/deposit (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseInt(match[1]);
    const store = loadPlayers();
    const last = store.last;
    if (!last) return bot.sendMessage(chatId, "❌ لا يوجد حساب محفوظ.");
    try {
      const res = await depositToPlayer(last.playerId, amount);
      if (res?.result) bot.sendMessage(chatId, `✅ تم شحن ${amount} NSP.`);
      else bot.sendMessage(chatId, `❌ فشل الشحن: ${JSON.stringify(res)}`);
    } catch (e) {
      bot.sendMessage(chatId, `❌ خطأ خلال الشحن: ${e.message || e}`);
    }
  });

  // withdraw command
  bot.onText(/\/withdraw (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseInt(match[1]);
    const store = loadPlayers();
    const last = store.last;
    if (!last) return bot.sendMessage(chatId, "❌ لا يوجد حساب محفوظ.");
    try {
      // check remote balance first
      const balObj = await getPlayerBalance(last.playerId);
      if (!balObj.ok) return bot.sendMessage(chatId, "❌ فشل جلب الرصيد من الموقع.");
      if (amount > Number(balObj.balance)) return bot.sendMessage(chatId, "❌ لا يوجد رصيد كافٍ في الحساب.");
      const res = await withdrawFromPlayer(last.playerId, -amount); // note: your API expects negative?
      if (res?.result) bot.sendMessage(chatId, `✅ تم سحب ${amount} NSP.`);
      else bot.sendMessage(chatId, `❌ فشل السحب: ${JSON.stringify(res)}`);
    } catch (e) {
      bot.sendMessage(chatId, `❌ خطأ خلال السحب: ${e.message || e}`);
    }
  });

  // balance command
  bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const store = loadPlayers();
    const last = store.last;
    if (!last) return bot.sendMessage(chatId, "❌ لا يوجد حساب محفوظ.");
    try {
      const balObj = await getPlayerBalance(last.playerId);
      if (!balObj.ok) return bot.sendMessage(chatId, "❌ فشل جلب الرصيد.");
      bot.sendMessage(chatId, `💸 رصيد الحساب: ${balObj.balance} NSP`);
    } catch (e) {
      bot.sendMessage(chatId, `❌ خطأ: ${e.message || e}`);
    }
  });
}

module.exports = { registerIchancyHandlers };
