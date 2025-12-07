
const winston = require('winston');
const { CallbackQuery } = require('node-telegram-bot-api');
const {
    createPlayer,
    depositToPlayer,
    withdrawFromPlayer,
    createPlayerWithCredentials,
    checkPlayerExists,
    getPlayerBalance
} = require('./handlers/ichancy_api');
const {
    deductUserBalance,
    updateBalance,
    updateSheetIchancyBalance,
    getIchancyAccountByUserId,
    insertIchancyAccount,
    getAllIchancyAccounts
} = require('./sqlite_db');
const { randomInt } = require('crypto');
const { DateTime } = require('luxon');

// تكوين الـ logger
const logger = winston.createLogger({
    level: 'error',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} - ${level.toUpperCase()} - ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' })
    ]
});

const activeUsers = new Set();

/**
 * توليد اسم عشوائي
 * @param {string} baseName - الاسم الأساسي
 * @returns {string} - الاسم المولد
 */
function generateRandomName(baseName) {
    try {
        const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let randStr = '';
        for (let i = 0; i < 2; i++) {
            randStr += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return `${baseName}${randStr}`;
    } catch (error) {
        logger.error(`Error in generateRandomName: ${error}`);
        throw error;
    }
}

/**
 * تسجيل معالجات ايشانسي
 * @param {object} bot - كائن البوت
 */
function registerIchancyHandlers(bot) {
    // معالجة إجراءات ايشانسي
    bot.on('callback_query', async (call) => {
        try {
            const validActions = ["ichancy_site", "neu_account", "charge_account", "withdraw_account", "my_account"];
            
            if (!validActions.includes(call.data)) {
                return;
            }
            
            await handleIchancyAction(call, bot);
        } catch (error) {
            logger.error(`Error in callback query handler: ${error}`);
        }
    });
}

/**
 * معالجة إجراء ايشانسي
 * @param {CallbackQuery} call - بيانات الـ callback
 * @param {object} bot - كائن البوت
 */
async function handleIchancyAction(call, bot) {
    try {
        const chatId = call.message.chat.id;
        const userId = call.from.id.toString();
        const data = call.data;

        /**
         * جلب حساب المستخدم
         * @param {string} uid - معرف المستخدم
         * @returns {Promise<object|null>} - بيانات الحساب
         */
        async function getUserAccount(uid) {
            try {
                return await getIchancyAccountByUserId(uid);
            } catch (error) {
                logger.error(`Error in getUserAccount: ${error}`);
                await bot.sendMessage(chatId, "❌ حدث خطأ أثناء جلب بيانات الحساب.");
                return null;
            }
        }

        if (data === "ichancy_site") {
            await bot.sendMessage(chatId, "رابط موقع ايشانسي:\nhttps://ichancy.com");

        } else if (data === "neu_account") {
            const existing = await getUserAccount(userId);
            if (existing) {
                await bot.sendMessage(chatId, "❗️ لديك حساب بالفعل.");
                return;
            }
            const msg = await bot.sendMessage(chatId, "أدخل اسم الحساب الذي تريده:");
            bot.onReplyToMessage(msg.chat.id, msg.message_id, async (m) => {
                await getLoginStep(m, { user_id: userId, bot });
            });

        } else if (data === "charge_account") {
            const acct = await getUserAccount(userId);
            if (!acct) {
                await bot.sendMessage(chatId, "❗️ لم تنشئ حساباً بعد.");
                return;
            }
            if (activeUsers.has(chatId)) {
                return await bot.sendMessage(chatId, "⏳ يرجى الانتظار قبل المحاولة مرة أخرى.");
            }
            activeUsers.add(chatId);
            const msg = await bot.sendMessage(chatId, "أدخل المبلغ الذي تريد شحنه:");
            
            bot.onReplyToMessage(msg.chat.id, msg.message_id, async (m) => {
                activeUsers.delete(chatId);
                await processCharge(m, acct.player_id, bot);
            });

        } else if (data === "withdraw_account") {
            const acct = await getUserAccount(userId);
            if (!acct) {
                await bot.sendMessage(chatId, "❗️ لم تنشئ حساباً بعد.");
                return;
            }
            if (activeUsers.has(chatId)) {
                return await bot.sendMessage(chatId, "⏳ يرجى الانتظار قبل المحاولة مرة أخرى.");
            }
            activeUsers.add(chatId);
            const msg = await bot.sendMessage(chatId, "أدخل المبلغ الذي تريد سحبه:");
            
            bot.onReplyToMessage(msg.chat.id, msg.message_id, async (m) => {
                activeUsers.delete(chatId);
                await processWithdraw(m, acct.player_id, bot);
            });

        } else if (data === "my_account") {
            const acct = await getUserAccount(userId);
            if (!acct) {
                await bot.sendMessage(chatId, "❗️ لديك 0 حسابات ايتشانسي.");
                return;
            }
            const { status, balance } = await getPlayerBalance(acct.player_id);
            const balanceStr = status === 200 ? balance.toString() : "-";
            const msgText = `لديك 1 حساب ايتشانسي
يتم تحديث معلومات الرصيد في الحسابات كل 30 دقيقة
1- الدخول: \`${acct.player_login}\`
الايميل: \`${acct.email}\`
كلمة السر: \`${acct.player_password}\`
تاريخ الانشاء: \`${acct.created_at}\`
الرصيد في الحساب: \`${balanceStr}\` ليرة`;
            
            await bot.sendMessage(chatId, msgText, { parse_mode: "Markdown" });
        }
    } catch (error) {
        logger.error(`Error in handleIchancyAction: ${error}`);
        await bot.sendMessage(call.message.chat.id, "❌ حدث خطأ غير متوقع.");
    }
}

/**
 * معالجة عملية الشحن
 * @param {object} msg - رسالة المستخدم
 * @param {string} playerId - معرف اللاعب
 * @param {object} bot - كائن البوت
 */
async function processCharge(msg, playerId, bot) {
    const chatId = msg.chat.id;
    try {
        const amount = parseInt(msg.text.trim());
        if (amount < 10) {
            const msg2 = await bot.sendMessage(chatId, "أقل مبلغ إيداع هو 10");
            bot.onReplyToMessage(msg2.chat.id, msg2.message_id, async (m) => {
                await processCharge(m, playerId, bot);
            });
            return;
        }
        const userId = msg.from.id;
        
        await bot.sendMessage(chatId, "⏳ جاري شحن الرصيد...");
        const { status, result } = await depositToPlayer(playerId, amount);
        
        if (status === 200 && result.result === true) {
            const success = await deductUserBalance(userId, amount);
            if (!success) {
                logger.error(`Failed to deduct user balance for user ${userId} and amount ${amount}`);
                return await bot.sendMessage(chatId, "❌ حدث خطأ أثناء خصم الرصيد المحلي.");
            }
            await bot.sendMessage(chatId, `✅ تم شحن ${amount} NSP بنجاح.`);
        } else {
            const err = result.notification?.[0]?.content || "فشل الشحن";
            logger.error(`Charge failed for player ${playerId} with amount ${amount}: ${err}`);
            await bot.sendMessage(chatId, `❌ ${err}`);
        }
    } catch (error) {
        logger.error(`Error in processCharge for player ${playerId}: ${error}`);
        await bot.sendMessage(chatId, `❌ خطأ: ${error.message}`);
    }
}

/**
 * معالجة عملية السحب
 * @param {object} msg - رسالة المستخدم
 * @param {string} playerId - معرف اللاعب
 * @param {object} bot - كائن البوت
 */
async function processWithdraw(msg, playerId, bot) {
    const chatId = msg.chat.id;
    try {
        const amount = Math.abs(parseInt(msg.text.trim()));
        if (amount < 10) {
            const msg2 = await bot.sendMessage(chatId, "أقل مبلغ سحب هو 10");
            bot.onReplyToMessage(msg2.chat.id, msg2.message_id, async (m) => {
                await processWithdraw(m, playerId, bot);
            });
            return;
        }
        const userId = msg.from.id;

        // جلب الرصيد من الموقع أولاً
        const { status: balanceStatus, balance: siteBalance } = await getPlayerBalance(playerId);
        if (balanceStatus !== 200) {
            logger.error(`Failed to get player balance for player ${playerId}. Status: ${balanceStatus}`);
            return await bot.sendMessage(chatId, "❌ تعذر جلب الرصيد من الموقع حالياً، حاول لاحقاً.");
        }
        if (amount > parseFloat(siteBalance)) {
            logger.warn(`Withdrawal amount ${amount} exceeds site balance ${siteBalance} for player ${playerId}`);
            return await bot.sendMessage(chatId, "لا يوجد رصيد بالمبلغ المطلوب في الحساب.");
        }

        await bot.sendMessage(chatId, "⏳ جاري سحب الرصيد...");
        const { status, result } = await withdrawFromPlayer(playerId, -amount);
        
        if (status === 200 && result.result === true) {
            await updateBalance(userId, amount, "add");
            await bot.sendMessage(chatId, `✅ تم سحب ${amount} NSP بنجاح.`);
        } else {
            const err = result.notification?.[0]?.content || "فشل السحب";
            logger.error(`Withdrawal failed for player ${playerId} with amount ${amount}: ${err}`);
            await bot.sendMessage(chatId, `❌ ${err}`);
        }
    } catch (error) {
        logger.error(`Error in processWithdraw for player ${playerId}: ${error}`);
        await bot.sendMessage(chatId, `❌ خطأ: ${error.message}`);
    }
}

/**
 * خطوة الحصول على اسم الدخول
 * @param {object} msg - رسالة المستخدم
 * @param {object} userData - بيانات المستخدم
 */
async function getLoginStep(msg, userData) {
    const bot = userData.bot;
    const chatId = msg.chat.id;
    try {
        let baseLogin = msg.text.trim();
        
        // تحقق من الأحرف اللاتينية فقط
        if (!/^[A-Za-z0-9_.-]+$/.test(baseLogin)) {
            return await bot.sendMessage(chatId, "يرجى استخدام الاحرف اللاتينية فقط");
        }
        
        baseLogin = baseLogin + "_TSA";
        const accounts = await getAllIchancyAccounts();
        const existingLogins = new Set(
            accounts.filter(acc => acc && acc.login).map(acc => acc.login)
        );
        
        let newLogin = baseLogin;
        let counter = 1;
        
        while (existingLogins.has(newLogin) || (await checkPlayerExists(newLogin))) {
            newLogin = `${baseLogin}${counter}`;
            counter++;
            if (counter > 10) {
                newLogin = generateRandomName(baseLogin);
                if (!existingLogins.has(newLogin) && !(await checkPlayerExists(newLogin))) {
                    break;
                }
            }
        }
        
        userData.login = newLogin;
        const msg2 = await bot.sendMessage(chatId, "ادخل كلمة سر أطول من 8 خانات:");
        
        bot.onReplyToMessage(msg2.chat.id, msg2.message_id, async (m) => {
            await getPasswordStep(m, userData);
        });
    } catch (error) {
        logger.error(`Error in getLoginStep: ${error}`);
        await bot.sendMessage(chatId, "❌ حدث خطأ أثناء معالجة اسم الدخول.");
    }
}

/**
 * خطوة الحصول على كلمة السر
 * @param {object} msg - رسالة المستخدم
 * @param {object} userData - بيانات المستخدم
 */
async function getPasswordStep(msg, userData) {
    const bot = userData.bot;
    const chatId = msg.chat.id;
    try {
        const password = msg.text.trim();
        
        // تحقق من الطول بين 8 و11
        if (password.length < 8 || password.length > 11) {
            const msg2 = await bot.sendMessage(
                chatId,
                "يجب ان تكون كلمة السر المدخلة منك بين 8 خانات الى 11 خانة كحد اقصى يرجى اعادة الادخال 👇"
            );
            bot.onReplyToMessage(msg2.chat.id, msg2.message_id, async (m) => {
                await getPasswordStep(m, userData);
            });
            return;
        }
        
        userData.password = password;
        const msg2 = await bot.sendMessage(chatId, "ادخل مبلغ الشحن الابتدائي:");
        
        bot.onReplyToMessage(msg2.chat.id, msg2.message_id, async (m) => {
            await processCreateAndDeposit(m, userData);
        });
    } catch (error) {
        logger.error(`Error in getPasswordStep: ${error}`);
        await bot.sendMessage(chatId, "❌ حدث خطأ أثناء معالجة كلمة السر.");
    }
}

/**
 * معالجة إنشاء الحساب والإيداع
 * @param {object} msg - رسالة المستخدم
 * @param {object} userData - بيانات المستخدم
 */
async function processCreateAndDeposit(msg, userData) {
    const bot = userData.bot;
    const chatId = msg.chat.id;
    try {
        const amount = parseInt(msg.text.trim());
        if (amount < 10) {
            const msg2 = await bot.sendMessage(chatId, "أقل مبلغ إيداع عند إنشاء الحساب هو 10");
            bot.onReplyToMessage(msg2.chat.id, msg2.message_id, async (m) => {
                await processCreateAndDeposit(m, userData);
            });
            return;
        }
        
        const userId = userData.user_id;
        let login = userData.login;
        const pwd = userData.password;

        await bot.sendMessage(chatId, "⏳ جاري إنشاء الحساب...");
        let { status, result, player_id, email } = await createPlayerWithCredentials(login, pwd);
        
        if (!(player_id && result.result === true)) {
            // لو الاسم احتجز أثناء العملية جرب اسم عشوائي
            logger.warn(`Initial account creation failed for login ${login}. Attempting random name.`);
            login = generateRandomName(login);
            const retryResult = await createPlayerWithCredentials(login, pwd);
            status = retryResult.status;
            result = retryResult.result;
            player_id = retryResult.player_id;
            email = retryResult.email;
            
            if (!(player_id && result.result === true)) {
                logger.error(`Account creation failed even with random name for user ${userId}.`);
                return await bot.sendMessage(chatId, "❌ فشل إنشاء الحساب.");
            }
        }

        const creationDate = DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss');
        const initialBalance = amount > 0 ? amount : 0;

        await insertIchancyAccount(
            userId,
            player_id,
            login,
            pwd,
            email,
            initialBalance,
            creationDate
        );

        if (amount > 0) {
            const { status: depositStatus, result: depositResult } = await depositToPlayer(player_id, amount);
            if (!(depositStatus === 200 && depositResult.result === true)) {
                const err = depositResult.notification?.[0]?.content || "فشل الشحن الابتدائي";
                logger.error(`Initial deposit failed for player ${player_id} with amount ${amount}: ${err}`);
                return await bot.sendMessage(chatId, `❌ ${err}`);
            }
        }

        const { balance } = await getPlayerBalance(player_id);
        let finalBalance = balance;
        if (balance === 0 && amount > 0) {
            finalBalance = amount;
        }
        
        await updateSheetIchancyBalance(userId, finalBalance);

        await bot.sendMessage(
            chatId,
            `✅ تم إنشاء الحساب بنجاح!
Login: \`${login}\`
Email: \`${email}\`
Player ID: \`${player_id}\`
تاريخ الإنشاء: \`${creationDate}\`
رصيدك على ichancy: \`${finalBalance}\` NSP`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        logger.error(`Error in processCreateAndDeposit for user ${userData.user_id || 'N/A'}: ${error}`);
        await bot.sendMessage(chatId, `❌ حصل خطأ: ${error.message}`);
    }
}

module.exports = {
    registerIchancyHandlers,
    generateRandomName,
    activeUsers
};
