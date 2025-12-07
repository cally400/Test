const winston = require('winston');
const { randomInt } = require('crypto');
const { DateTime } = require('luxon');

// تهيئة الـ logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} - ${level.toUpperCase()} - ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log',
            maxsize: 5242880,
            maxFiles: 5
        })
    ]
});

// استيراد وحدات API وقاعدة البيانات
const ichancyApi = require('./ichancy_api');
const sqliteDb = require('../sqlite_db');

const activeUsers = new Set();

/**
 * توليد اسم عشوائي
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
 * إعداد معالجات القائمة الرئيسية
 */
function setupMainMenuHandlers(bot) {
    // معالجة أزرار القائمة الرئيسية
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;
        
        try {
            // الرد على callback query لإزالة دائرة التحميل
            await bot.answerCallbackQuery(callbackQuery.id);
            
            if (data === 'help') {
                const helpMessage = `🆘 *دليل استخدام البوت*

*📋 خطوات إنشاء حساب جديد:*
1️⃣ اضغط على "إنشاء حساب جديد"
2️⃣ أدخل اسم الدخول (بالإنجليزية فقط)
3️⃣ أدخل كلمة المرور (8-11 حرف)
4️⃣ أدخل مبلغ الإيداع الأولي (10 NSP كحد أدنى)

*⚙️ *متطلبات إنشاء الحساب:*
✅ اسم الدخول: أحرف إنجليزية وأرقام فقط
✅ كلمة المرور: من 8 إلى 11 حرف
✅ مبلغ الإيداع: 10 NSP كحد أدنى

*🔐 معلومات الحساب:*
- سيتم إضافة "_TSA" تلقائياً لاسم الدخول
- ستحصل على إيميل وكلمة مرور فريدين
- يمكنك استخدام نفس الحساب على موقع ايشانسي

*💰 *الحدود الدنيا:*
- الحد الأدنى للإيداع: 10 NSP
- الحد الأدنى للسحب: 10 NSP

*🔄 تحديث الرصيد:*
يتم تحديث الأرصدة تلقائياً كل 30 دقيقة

*📞 *الدعم الفني:*
@TSA_Support - للاستفسارات والشكاوى`;
                
                await bot.sendMessage(chatId, helpMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🔙 العودة للقائمة الرئيسية", callback_data: "back_to_main" }]
                        ]
                    }
                });
            } else if (data === 'back_to_main') {
                // حذف الرسالة الحالية وإرسال القائمة الرئيسية
                try {
                    await bot.deleteMessage(chatId, messageId);
                } catch (e) {
                    // تجاهل خطأ إذا لم نتمكن من حذف الرسالة
                }
                
                const welcomeMessage = `✨ *مرحباً بك في بوت ايشانسي الرسمي* ✨

*🔹 اختر من القائمة أدناه:*`;
                
                await bot.sendMessage(chatId, welcomeMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🌐 موقع ايشانسي", callback_data: "ichancy_site" }],
                            [{ text: "🆕 إنشاء حساب جديد", callback_data: "neu_account" }],
                            [{ text: "💰 شحن حساب", callback_data: "charge_account" }],
                            [{ text: "💸 سحب رصيد", callback_data: "withdraw_account" }],
                            [{ text: "👤 حسابي", callback_data: "my_account" }],
                            [{ text: "🆘 المساعدة", callback_data: "help" }]
                        ]
                    }
                });
            }
        } catch (error) {
            logger.error(`Error handling menu callback ${data}:`, error);
        }
    });
}

/**
 * تسجيل معالجات ايشانسي
 */
function registerIchancyHandlers(bot) {
    logger.info('Registering ichancy handlers...');
    
    // إعداد معالجات القائمة الرئيسية
    setupMainMenuHandlers(bot);
    
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
            try {
                await bot.sendMessage(call.message.chat.id, "❌ حدث خطأ غير متوقع في المعالجة.");
            } catch (e) {
                // تجاهل إذا لم نتمكن من إرسال الرسالة
            }
        }
    });
    
    logger.info('✅ Ichancy handlers registered successfully');
}

/**
 * معالجة إجراء ايشانسي
 */
async function handleIchancyAction(call, bot) {
    const chatId = call.message.chat.id;
    const userId = call.from.id.toString();
    const data = call.data;
    
    // الرد على callback query
    await bot.answerCallbackQuery(call.id);
    
    logger.info(`Processing ichancy action: ${data} from user ${userId}`);
    
    // إزالة علامات التنسيق من الرسالة الأصلية
    try {
        await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: call.message.message_id }
        );
    } catch (e) {
        // تجاهل الخطأ إذا لم نتمكن من تعديل الرسالة
    }
    
    /**
     * جلب حساب المستخدم
     */
    async function getUserAccount(uid) {
        try {
            return await sqliteDb.getIchancyAccountByUserId(uid);
        } catch (error) {
            logger.error(`Error in getUserAccount for user ${uid}: ${error}`);
            await bot.sendMessage(chatId, "❌ حدث خطأ أثناء جلب بيانات الحساب.");
            return null;
        }
    }

    if (data === "ichancy_site") {
        await bot.sendMessage(chatId, 
            "🌐 *رابط موقع ايشانسي الرسمي:*\n" +
            "https://ichancy.com\n\n" +
            "🔗 *رابط تسجيل الدخول:*\n" +
            "https://ichancy.com/login\n\n" +
            "*💡 ملاحظة:* يمكنك استخدام نفس بيانات الدخول التي تحصل عليها من البوت",
            { parse_mode: 'Markdown' }
        );

    } else if (data === "neu_account") {
        // التحقق من عدم وجود حساب بالفعل
        const existing = await getUserAccount(userId);
        if (existing) {
            await bot.sendMessage(chatId, 
                "❗️ *لديك حساب بالفعل*\n\n" +
                "يمكنك استخدام الحساب الحالي أو التواصل مع الدعم لإنشاء حساب جديد.\n\n" +
                "📞 الدعم: @TSA_Support",
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        const msg = await bot.sendMessage(chatId, 
            "🆕 *إنشاء حساب جديد*\n\n" +
            "📝 *الخطوة 1/3:* أدخل اسم الدخول الذي تريده\n\n" +
            "*شروط اسم الدخول:*\n" +
            "✅ أحرف إنجليزية فقط (A-Z, a-z)\n" +
            "✅ أرقام مسموحة (0-9)\n" +
            "✅ يمكن استخدام النقاط والشرطات\n" +
            "❌ لا مسافات\n" +
            "❌ لا رموز خاصة\n\n" +
            "*مثال:* `ahmed123` أو `john.smith`\n\n" +
            "✍️ *اكتب اسم الدخول الآن:*",
            { parse_mode: 'Markdown' }
        );
        
        // تسجيل معالج الخطوة التالية
        bot.once('message', async function getLoginHandler(m) {
            if (m.chat.id === chatId && m.from.id.toString() === userId) {
                await getLoginStep(m, { user_id: userId, bot: bot });
            }
        });

    } else if (data === "charge_account") {
        const acct = await getUserAccount(userId);
        if (!acct) {
            await bot.sendMessage(chatId, 
                "❗️ *لم تنشئ حساباً بعد*\n\n" +
                "يجب إنشاء حساب أولاً قبل الشحن.\n" +
                "اضغط على \"إنشاء حساب جديد\" لبدء العملية.",
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        if (activeUsers.has(chatId)) {
            return await bot.sendMessage(chatId, "⏳ *يرجى الانتظار* قبل المحاولة مرة أخرى.", { parse_mode: 'Markdown' });
        }
        
        activeUsers.add(chatId);
        const msg = await bot.sendMessage(chatId, 
            "💰 *شحن الحساب*\n\n" +
            "💳 *الحد الأدنى للإيداع:* 10 NSP\n" +
            "⚡ *المعالجة:* فورية\n\n" +
            "✍️ *أدخل المبلغ الذي تريد شحنه:*",
            { parse_mode: 'Markdown' }
        );
        
        bot.once('message', async function chargeHandler(m) {
            if (m.chat.id === chatId && m.from.id.toString() === userId) {
                activeUsers.delete(chatId);
                await processCharge(m, acct.player_id, bot);
            }
        });

    } else if (data === "withdraw_account") {
        const acct = await getUserAccount(userId);
        if (!acct) {
            await bot.sendMessage(chatId, 
                "❗️ *لم تنشئ حساباً بعد*\n\n" +
                "يجب إنشاء حساب أولاً قبل السحب.\n" +
                "اضغط على \"إنشاء حساب جديد\" لبدء العملية.",
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        if (activeUsers.has(chatId)) {
            return await bot.sendMessage(chatId, "⏳ *يرجى الانتظار* قبل المحاولة مرة أخرى.", { parse_mode: 'Markdown' });
        }
        
        activeUsers.add(chatId);
        const msg = await bot.sendMessage(chatId, 
            "💸 *سحب الرصيد*\n\n" +
            "💳 *الحد الأدنى للسحب:* 10 NSP\n" +
            "⏱️ *المعالجة:* من 1 إلى 5 دقائق\n\n" +
            "✍️ *أدخل المبلغ الذي تريد سحبه:*",
            { parse_mode: 'Markdown' }
        );
        
        bot.once('message', async function withdrawHandler(m) {
            if (m.chat.id === chatId && m.from.id.toString() === userId) {
                activeUsers.delete(chatId);
                await processWithdraw(m, acct.player_id, bot);
            }
        });

    } else if (data === "my_account") {
        const acct = await getUserAccount(userId);
        if (!acct) {
            await bot.sendMessage(chatId, 
                "👤 *حسابي*\n\n" +
                "❗️ *ليس لديك حسابات ايشانسي*\n\n" +
                "اضغط على \"إنشاء حساب جديد\" لإنشاء أول حساب لك.",
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        // جلب الرصيد الحالي
        let balanceStr = "-";
        try {
            const { status, balance } = await ichancyApi.getPlayerBalance(acct.player_id);
            if (status === 200) {
                balanceStr = `${balance} NSP`;
            }
        } catch (error) {
            logger.error(`Error fetching balance for player ${acct.player_id}: ${error}`);
        }
        
        const msgText = `👤 *معلومات حسابك*

📊 *عدد الحسابات:* 1 حساب
🔄 *تحديث الرصيد:* كل 30 دقيقة

🔐 *معلومات الدخول:*
├ الدخول: \`${acct.player_login}\`
├ الإيميل: \`${acct.email}\`
├ كلمة السر: \`${acct.player_password}\`
├ معرف اللاعب: \`${acct.player_id}\`
└ تاريخ الإنشاء: \`${acct.created_at}\`

💰 *الرصيد الحالي:* \`${balanceStr}\`

💡 *نصائح أمنية:*
• لا تشارك بيانات الدخول مع أي شخص
• يمكنك تغيير كلمة المرور من موقع ايشانسي
• تواصل مع الدعم لأي مشكلة`;

        await bot.sendMessage(chatId, msgText, { 
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "💰 شحن الرصيد", callback_data: "charge_account" },
                        { text: "💸 سحب الرصيد", callback_data: "withdraw_account" }
                    ],
                    [
                        { text: "🌐 زيارة الموقع", callback_data: "ichancy_site" }
                    ]
                ]
            }
        });
    }
}

/**
 * معالجة عملية الشحن
 */
async function processCharge(msg, playerId, bot) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const amount = parseInt(msg.text.trim());
        
        if (isNaN(amount) || amount < 10) {
            const msg2 = await bot.sendMessage(chatId, 
                "❌ *المبلغ غير صالح*\n\n" +
                "الحد الأدنى للإيداع هو 10 NSP\n\n" +
                "✍️ *أدخل المبلغ من جديد:*",
                { parse_mode: 'Markdown' }
            );
            
            bot.once('message', async function retryHandler(m) {
                if (m.chat.id === chatId && m.from.id === userId) {
                    await processCharge(m, playerId, bot);
                }
            });
            return;
        }
        
        await bot.sendMessage(chatId, "⏳ *جاري معالجة طلب الشحن...*", { parse_mode: 'Markdown' });
        
        const { status, result } = await ichancyApi.depositToPlayer(playerId, amount);
        
        if (status === 200 && result.result === true) {
            const success = await sqliteDb.deductUserBalance(userId, amount);
            if (!success) {
                logger.error(`Failed to deduct user balance for user ${userId} and amount ${amount}`);
                return await bot.sendMessage(chatId, 
                    "❌ *حدث خطأ أثناء خصم الرصيد المحلي*\n\n" +
                    "يرجى التواصل مع الدعم الفني.",
                    { parse_mode: 'Markdown' }
                );
            }
            
            await bot.sendMessage(chatId, 
                `✅ *تم الشحن بنجاح*\n\n` +
                `💰 *المبلغ:* ${amount} NSP\n` +
                `🔄 *الحالة:* مكتمل\n` +
                `⏱️ *الوقت:* فوري\n\n` +
                `🎉 *تمت إضافة الرصيد إلى حسابك بنجاح*`,
                { parse_mode: 'Markdown' }
            );
        } else {
            const err = result.notification?.[0]?.content || "فشل عملية الشحن";
            logger.error(`Charge failed for player ${playerId} with amount ${amount}: ${err}`);
            
            await bot.sendMessage(chatId, 
                `❌ *فشل عملية الشحن*\n\n` +
                `📋 *السبب:* ${err}\n\n` +
                `💡 *حلول مقترحة:*\n` +
                `• تحقق من اتصال الإنترنت\n` +
                `• حاول مرة أخرى بعد قليل\n` +
                `• تواصل مع الدعم إذا استمرت المشكلة`,
                { parse_mode: 'Markdown' }
            );
        }
    } catch (error) {
        logger.error(`Error in processCharge for player ${playerId}: ${error}`);
        await bot.sendMessage(chatId, 
            `❌ *حدث خطأ غير متوقع*\n\n` +
            `📋 *التفاصيل:* ${error.message}\n\n` +
            `🔧 *يرجى المحاولة مرة أخرى أو التواصل مع الدعم*`,
            { parse_mode: 'Markdown' }
        );
    }
}

/**
 * معالجة عملية السحب
 */
async function processWithdraw(msg, playerId, bot) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const amount = Math.abs(parseInt(msg.text.trim()));
        
        if (isNaN(amount) || amount < 10) {
            const msg2 = await bot.sendMessage(chatId, 
                "❌ *المبلغ غير صالح*\n\n" +
                "الحد الأدنى للسحب هو 10 NSP\n\n" +
                "✍️ *أدخل المبلغ من جديد:*",
                { parse_mode: 'Markdown' }
            );
            
            bot.once('message', async function retryHandler(m) {
                if (m.chat.id === chatId && m.from.id === userId) {
                    await processWithdraw(m, playerId, bot);
                }
            });
            return;
        }
        
        // جلب الرصيد الحالي من الموقع
        await bot.sendMessage(chatId, "⏳ *جاري التحقق من الرصيد المتاح...*", { parse_mode: 'Markdown' });
        
        const { status: balanceStatus, balance: siteBalance } = await ichancyApi.getPlayerBalance(playerId);
        
        if (balanceStatus !== 200) {
            logger.error(`Failed to get player balance for player ${playerId}. Status: ${balanceStatus}`);
            return await bot.sendMessage(chatId, 
                "❌ *تعذر جلب الرصيد من الموقع حالياً*\n\n" +
                "يرجى المحاولة مرة أخرى بعد قليل.",
                { parse_mode: 'Markdown' }
            );
        }
        
        if (amount > parseFloat(siteBalance)) {
            logger.warn(`Withdrawal amount ${amount} exceeds site balance ${siteBalance} for player ${playerId}`);
            return await bot.sendMessage(chatId, 
                `❌ *رصيد غير كافي*\n\n` +
                `💰 *الرصيد المتاح:* ${siteBalance} NSP\n` +
                `💸 *المبلغ المطلوب:* ${amount} NSP\n\n` +
                `⚠️ *لا يمكن سحب مبلغ أكبر من الرصيد المتاح*`,
                { parse_mode: 'Markdown' }
            );
        }
        
        await bot.sendMessage(chatId, "⏳ *جاري معالجة طلب السحب...*", { parse_mode: 'Markdown' });
        
        const { status, result } = await ichancyApi.withdrawFromPlayer(playerId, -amount);
        
        if (status === 200 && result.result === true) {
            await sqliteDb.updateBalance(userId, amount, "add");
            
            await bot.sendMessage(chatId, 
                `✅ *تم السحب بنجاح*\n\n` +
                `💰 *المبلغ:* ${amount} NSP\n` +
                `🔄 *الحالة:* مكتمل\n` +
                `⏱️ *الوقت:* من 1 إلى 5 دقائق\n\n` +
                `💡 *سيصلك الرصيد في محفظتك قريباً*`,
                { parse_mode: 'Markdown' }
            );
        } else {
            const err = result.notification?.[0]?.content || "فشل عملية السحب";
            logger.error(`Withdrawal failed for player ${playerId} with amount ${amount}: ${err}`);
            
            await bot.sendMessage(chatId, 
                `❌ *فشل عملية السحب*\n\n` +
                `📋 *السبب:* ${err}\n\n` +
                `💡 *حلول مقترحة:*\n` +
                `• تحقق من اتصال الإنترنت\n` +
                `• حاول مرة أخرى بعد قليل\n` +
                `• تواصل مع الدعم إذا استمرت المشكلة`,
                { parse_mode: 'Markdown' }
            );
        }
    } catch (error) {
        logger.error(`Error in processWithdraw for player ${playerId}: ${error}`);
        await bot.sendMessage(chatId, 
            `❌ *حدث خطأ غير متوقع*\n\n` +
            `📋 *التفاصيل:* ${error.message}\n\n` +
            `🔧 *يرجى المحاولة مرة أخرى أو التواصل مع الدعم*`,
            { parse_mode: 'Markdown' }
        );
    }
}

/**
 * خطوة الحصول على اسم الدخول
 */
async function getLoginStep(msg, userData) {
    const bot = userData.bot;
    const chatId = msg.chat.id;
    const userId = userData.user_id;
    
    try {
        let baseLogin = msg.text.trim();
        
        // تحقق من الأحرف اللاتينية فقط
        if (!/^[A-Za-z0-9_.-]+$/.test(baseLogin)) {
            const errorMsg = await bot.sendMessage(chatId, 
                "❌ *اسم الدخول غير صالح*\n\n" +
                "يرجى استخدام الأحرف اللاتينية فقط (A-Z, a-z, 0-9)\n" +
                "يمكن استخدام النقاط (.) والشرطات (-) والشرطة السفلية (_)\n\n" +
                "✍️ *أعد إدخال اسم الدخول:*",
                { parse_mode: 'Markdown' }
            );
            
            bot.once('message', async function retryHandler(m) {
                if (m.chat.id === chatId && m.from.id.toString() === userId) {
                    await getLoginStep(m, userData);
                }
            });
            return;
        }
        
        baseLogin = baseLogin + "_TSA";
        const accounts = await sqliteDb.getAllIchancyAccounts();
        const existingLogins = new Set(
            accounts.filter(acc => acc && acc.player_login).map(acc => acc.player_login)
        );
        
        let newLogin = baseLogin;
        let counter = 1;
        
        // التحقق من التكرار
        while (existingLogins.has(newLogin) || (await ichancyApi.checkPlayerExists(newLogin))) {
            newLogin = `${baseLogin}${counter}`;
            counter++;
            if (counter > 10) {
                newLogin = generateRandomName(baseLogin);
                if (!existingLogins.has(newLogin) && !(await ichancyApi.checkPlayerExists(newLogin))) {
                    break;
                }
            }
        }
        
        userData.login = newLogin;
        
        const msg2 = await bot.sendMessage(chatId, 
            "🔐 *الخطوة 2/3: كلمة المرور*\n\n" +
            "✍️ *أدخل كلمة المرور للحساب*\n\n" +
            "*شروط كلمة المرور:*\n" +
            "✅ من 8 إلى 11 حرف\n" +
            "✅ أحرف إنجليزية (كبيرة وصغيرة)\n" +
            "✅ أرقام مسموحة\n" +
            "❌ لا مسافات\n\n" +
            "*مثال:* `MyPass123` أو `Secret456`\n\n" +
            "📝 *اكتب كلمة المرور الآن:*",
            { parse_mode: 'Markdown' }
        );
        
        bot.once('message', async function passwordHandler(m) {
            if (m.chat.id === chatId && m.from.id.toString() === userId) {
                await getPasswordStep(m, userData);
            }
        });
    } catch (error) {
        logger.error(`Error in getLoginStep: ${error}`);
        await bot.sendMessage(chatId, 
            "❌ *حدث خطأ أثناء معالجة اسم الدخول*\n\n" +
            "يرجى المحاولة مرة أخرى أو التواصل مع الدعم.",
            { parse_mode: 'Markdown' }
        );
    }
}

/**
 * خطوة الحصول على كلمة السر
 */
async function getPasswordStep(msg, userData) {
    const bot = userData.bot;
    const chatId = msg.chat.id;
    const userId = userData.user_id;
    
    try {
        const password = msg.text.trim();
        
        // تحقق من الطول بين 8 و11
        if (password.length < 8 || password.length > 11) {
            const msg2 = await bot.sendMessage(
                chatId,
                "❌ *طول كلمة المرور غير صالح*\n\n" +
                "يجب أن تكون كلمة المرور بين 8 إلى 11 حرف\n\n" +
                "✍️ *أعد إدخال كلمة المرور:*",
                { parse_mode: 'Markdown' }
            );
            
            bot.once('message', async function retryHandler(m) {
                if (m.chat.id === chatId && m.from.id.toString() === userId) {
                    await getPasswordStep(m, userData);
                }
            });
            return;
        }
        
        userData.password = password;
        
        const msg2 = await bot.sendMessage(chatId, 
            "💰 *الخطوة 3/3: الإيداع الأولي*\n\n" +
            "💳 *الحد الأدنى:* 10 NSP\n" +
            "⚡ *المعالجة:* فورية\n\n" +
            "✍️ *أدخل مبلغ الشحن الابتدائي:*\n" +
            "(يمكنك تركها 0 إذا كنت لا تريد إيداعاً أولياً)",
            { parse_mode: 'Markdown' }
        );
        
        bot.once('message', async function depositHandler(m) {
            if (m.chat.id === chatId && m.from.id.toString() === userId) {
                await processCreateAndDeposit(m, userData);
            }
        });
    } catch (error) {
        logger.error(`Error in getPasswordStep: ${error}`);
        await bot.sendMessage(chatId, 
            "❌ *حدث خطأ أثناء معالجة كلمة المرور*\n\n" +
            "يرجى المحاولة مرة أخرى أو التواصل مع الدعم.",
            { parse_mode: 'Markdown' }
        );
    }
}

/**
 * معالجة إنشاء الحساب والإيداع
 */
async function processCreateAndDeposit(msg, userData) {
    const bot = userData.bot;
    const chatId = msg.chat.id;
    const userId = userData.user_id;
    
    try {
        const amount = parseInt(msg.text.trim());
        
        if (isNaN(amount) || amount < 0) {
            const msg2 = await bot.sendMessage(chatId, 
                "❌ *المبلغ غير صالح*\n\n" +
                "يرجى إدخال رقم صحيح موجب\n" +
                "(أدخل 0 إذا كنت لا تريد إيداعاً أولياً)\n\n" +
                "✍️ *أعد إدخال المبلغ:*",
                { parse_mode: 'Markdown' }
            );
            
            bot.once('message', async function retryHandler(m) {
                if (m.chat.id === chatId && m.from.id.toString() === userId) {
                    await processCreateAndDeposit(m, userData);
                }
            });
            return;
        }
        
        if (amount > 0 && amount < 10) {
            const msg2 = await bot.sendMessage(chatId, 
                "❌ *المبلغ أقل من الحد الأدنى*\n\n" +
                "الحد الأدنى للإيداع عند إنشاء الحساب هو 10 NSP\n\n" +
                "✍️ *أعد إدخال المبلغ:*",
                { parse_mode: 'Markdown' }
            );
            
            bot.once('message', async function retryHandler(m) {
                if (m.chat.id === chatId && m.from.id.toString() === userId) {
                    await processCreateAndDeposit(m, userData);
                }
            });
            return;
        }
        
        const login = userData.login;
        const pwd = userData.password;

        // إرسال رسالة التحميل
        const loadingMsg = await bot.sendMessage(chatId, 
            "⏳ *جاري إنشاء الحساب...*\n\n" +
            "⚡ *قد تستغرق العملية بضع ثواني*",
            { parse_mode: 'Markdown' }
        );
        
        const { status, result, player_id, email } = await ichancyApi.createPlayerWithCredentials(login, pwd);
        
        if (!(player_id && result.result === true)) {
            // محاولة باسم عشوائي
            logger.warn(`Initial account creation failed for login ${login}. Attempting random name.`);
            const randomLogin = generateRandomName(login);
            
            const retryResult = await ichancyApi.createPlayerWithCredentials(randomLogin, pwd);
            
            if (!(retryResult.player_id && retryResult.result.result === true)) {
                logger.error(`Account creation failed even with random name for user ${userId}.`);
                await bot.deleteMessage(chatId, loadingMsg.message_id);
                return await bot.sendMessage(chatId, 
                    "❌ *فشل إنشاء الحساب*\n\n" +
                    "قد يكون الاسم محجوزاً أو حدث خطأ في الخادم.\n" +
                    "يرجى المحاولة باسم مختلف أو التواصل مع الدعم.",
                    { parse_mode: 'Markdown' }
                );
            }
            
            userData.login = randomLogin;
            player_id = retryResult.player_id;
            email = retryResult.email;
        }

        const creationDate = DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss');
        const initialBalance = amount > 0 ? amount : 0;

        // حفظ الحساب في قاعدة البيانات
        await sqliteDb.insertIchancyAccount(
            userId,
            player_id,
            userData.login,
            pwd,
            email,
            initialBalance,
            creationDate
        );

        // إيداع المبلغ إذا كان أكبر من 0
        if (amount > 0) {
            await bot.editMessageText(
                "⏳ *جاري إيداع الرصيد الأولي...*",
                {
                    chat_id: chatId,
                    message_id: loadingMsg.message_id,
                    parse_mode: 'Markdown'
                }
            );
            
            const { status: depositStatus, result: depositResult } = await ichancyApi.depositToPlayer(player_id, amount);
            
            if (!(depositStatus === 200 && depositResult.result === true)) {
                const err = depositResult.notification?.[0]?.content || "فشل الشحن الابتدائي";
                logger.error(`Initial deposit failed for player ${player_id} with amount ${amount}: ${err}`);
                
                await bot.deleteMessage(chatId, loadingMsg.message_id);
                return await bot.sendMessage(chatId, 
                    `❌ *تم إنشاء الحساب ولكن فشل الإيداع*\n\n` +
                    `📋 *السبب:* ${err}\n\n` +
                    `💡 *يمكنك شحن الرصيد لاحقاً من خلال قائمة "شحن حساب"*`,
                    { parse_mode: 'Markdown' }
                );
            }
        }

        // جلب الرصيد النهائي
        const { balance: finalBalance } = await ichancyApi.getPlayerBalance(player_id);
        
        // تحديث الرصيد في قاعدة البيانات
        await sqliteDb.updateSheetIchancyBalance(userId, finalBalance || amount);

        // إرسال رسالة النجاح
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        
        const successMessage = `🎉 *تم إنشاء الحساب بنجاح!*

🔐 *معلومات الدخول:*
├ الدخول: \`${userData.login}\`
├ الإيميل: \`${email}\`
├ كلمة السر: \`${pwd}\`
├ معرف اللاعب: \`${player_id}\`
└ تاريخ الإنشاء: \`${creationDate}\`

💰 *الرصيد الحالي:* \`${finalBalance || amount}\` NSP

🌐 *رابط تسجيل الدخول:*
https://ichancy.com/login

📋 *تعليمات مهمة:*
• احتفظ ببيانات الدخول في مكان آمن
• لا تشارك بياناتك مع أي شخص
• يمكنك تغيير كلمة المرور من الموقع
• للدعم: @TSA_Support

💡 *يمكنك الآن:*
• استخدام الحساب على موقع ايشانسي
• شحن رصيد إضافي
• سحب الرصيد إلى محفظتك`;

        await bot.sendMessage(chatId, successMessage, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "💰 شحن الرصيد", callback_data: "charge_account" },
                        { text: "👤 حسابي", callback_data: "my_account" }
                    ],
                    [
                        { text: "🌐 زيارة الموقع", callback_data: "ichancy_site" }
                    ]
                ]
            }
        });
        
        logger.info(`Account created successfully for user ${userId}: ${userData.login}`);
        
    } catch (error) {
        logger.error(`Error in processCreateAndDeposit for user ${userData.user_id || 'N/A'}: ${error}`);
        await bot.sendMessage(chatId, 
            `❌ *حدث خطأ غير متوقع*\n\n` +
            `📋 *التفاصيل:* ${error.message}\n\n` +
            `🔧 *يرجى المحاولة مرة أخرى أو التواصل مع الدعم*`,
            { parse_mode: 'Markdown' }
        );
    }
}

// تصدير الدوال
module.exports = {
    registerIchancyHandlers,
    generateRandomName,
    activeUsers,
    logger
};
