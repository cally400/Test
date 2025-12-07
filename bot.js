// bot.js - النسخة الصحيحة
require('dotenv').config();

// 1. استيراد الوحدات أولاً
const TelegramBot = require('node-telegram-bot-api');

// 2. التحقق من وجود توكن البوت
if (!process.env.BOT_TOKEN) {
    console.error('❌ خطأ: BOT_TOKEN غير موجود في متغيرات البيئة');
    console.log('📝 تأكد من وجود ملف .env مع المتغيرات التالية:');
    console.log('BOT_TOKEN=توكن_بوتك_هنا');
    console.log('AGENT_USERNAME=tsa_robert@tsa.com');
    console.log('AGENT_PASSWORD=K041@051kkk');
    console.log('PARENT_ID=2307909');
    process.exit(1);
}

// 3. تعريف البوت
const bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: {
        interval: 300,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});

// 4. الآن يمكنك استخدام bot
bot.on('polling_error', (error) => {
    console.error('📡 خطأ في الاتصال بالتلجرام:', error.message);
    console.error('كود الخطأ:', error.code);
});

bot.on('webhook_error', (error) => {
    console.error('🌐 خطأ في webhook:', error);
});

// 5. حدث بدء التشغيل الناجح
bot.on('polling_start', () => {
    console.log('✅ بدء الاتصال بالبوت بنجاح');
    console.log('🤖 البوت جاهز للاستخدام');
});

// 6. أمر البداية
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `✨ *مرحباً بك في بوت ايشانسي!* ✨

✅ *الحالة:* البوت يعمل بنجاح
📅 *التاريخ:* ${new Date().toLocaleDateString('ar-AR')}
⏰ *الوقت:* ${new Date().toLocaleTimeString('ar-AR')}

*الخدمات المتاحة:*
🆕 إنشاء حساب جديد
💰 شحن الحساب
💸 سحب الرصيد
👤 عرض معلومات الحساب
🌐 رابط موقع ايشانسي

*تعليمات:*
- اضغط على الأزرار التي ستظهر أدناه
- اتبع التعليمات خطوة بخطوة`;

    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🆕 إنشاء حساب جديد", callback_data: "neu_account" }],
                [{ text: "💰 شحن حساب", callback_data: "charge_account" }],
                [{ text: "💸 سحب رصيد", callback_data: "withdraw_account" }],
                [{ text: "👤 حسابي", callback_data: "my_account" }],
                [{ text: "🌐 موقع ايشانسي", callback_data: "ichancy_site" }]
            ]
        }
    });
});

// 7. أمر المساعدة
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        `🆘 *مساعدة*

*الأوامر المتاحة:*
/start - بدء البوت وعرض القائمة
/help - عرض رسالة المساعدة
/status - عرض حالة البوت

*لإنشاء حساب جديد:*
1. اضغط على "إنشاء حساب جديد"
2. اتبع التعليمات خطوة بخطوة
3. احفظ بيانات الدخول

*الدعم الفني:* @TSA_Support`,
        { parse_mode: 'Markdown' }
    );
});

// 8. أمر حالة البوت
bot.onText(/\/status/, (msg) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    bot.sendMessage(msg.chat.id,
        `📊 *حالة النظام*

✅ *الحالة:* نشط
⏱️ *مدة التشغيل:* ${hours}س ${minutes}د ${seconds}ث
💾 *الذاكرة:* ${Math.round(process.memoryUsage().rss / 1024 / 1024)} ميجابايت
🔄 *آخر تحديث:* ${new Date().toLocaleTimeString('ar-AR')}`,
        { parse_mode: 'Markdown' }
    );
});

// 9. معالجات callback (لأزرار القائمة)
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
    if (data === 'ichancy_site') {
        await bot.sendMessage(chatId, 
            '🌐 *موقع ايشانسي الرسمي:*\nhttps://ichancy.com\n\n' +
            '🔗 *رابط تسجيل الدخول:*\nhttps://ichancy.com/login',
            { parse_mode: 'Markdown' }
        );
    } else if (data === 'neu_account') {
        await bot.sendMessage(chatId,
            '🆕 *إنشاء حساب جديد*\n\n' +
            'هذه الميزة قيد التطوير حالياً.\n' +
            'سيتم تفعيلها قريباً إن شاء الله.',
            { parse_mode: 'Markdown' }
        );
    } else if (data === 'charge_account') {
        await bot.sendMessage(chatId,
            '💰 *شحن الحساب*\n\n' +
            'هذه الميزة قيد التطوير حالياً.\n' +
            'سيتم تفعيلها قريباً إن شاء الله.',
            { parse_mode: 'Markdown' }
        );
    } else if (data === 'withdraw_account') {
        await bot.sendMessage(chatId,
            '💸 *سحب الرصيد*\n\n' +
            'هذه الميزة قيد التطوير حالياً.\n' +
            'سيتم تفعيلها قريباً إن شاء الله.',
            { parse_mode: 'Markdown' }
        );
    } else if (data === 'my_account') {
        await bot.sendMessage(chatId,
            '👤 *حسابي*\n\n' +
            'هذه الميزة قيد التطوير حالياً.\n' +
            'سيتم تفعيلها قريباً إن شاء الله.',
            { parse_mode: 'Markdown' }
        );
    }
});

// 10. رسالة بدء التشغيل
console.log('🚀 بدء تشغيل بوت ايشانسي...');
console.log(`✅ BOT_TOKEN: ${process.env.BOT_TOKEN ? 'موجود' : 'مفقود'}`);
console.log(`✅ AGENT_USERNAME: ${process.env.AGENT_USERNAME ? 'موجود' : 'مفقود'}`);
console.log(`✅ PARENT_ID: ${process.env.PARENT_ID ? 'موجود' : 'مفقود'}`);
console.log('🤖 انتظر بدء الاتصال بالبوت...');

// 11. معالجة إشارات الإغلاق
process.on('SIGTERM', () => {
    console.log('🛑 إغلاق البوت...');
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 إغلاق البوت...');
    bot.stopPolling();
    process.exit(0);
});
