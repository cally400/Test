// في bot.js، بعد تهيئة البوت مباشرة
bot.on('polling_error', (error) => {
    console.error('📡 Polling error:', error.message);
});

// قائمة الأزرار الرئيسية
const mainMenu = {
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
};

// أمر /start مع القائمة
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `
✨ *مرحباً بك في بوت ايشانسي الرسمي* ✨

*🔹 الخدمات المتاحة:*
🌐 *موقع ايشانسي* - رابط الموقع الرسمي
🆕 *إنشاء حساب جديد* - حساب جديد على منصة ايشانسي
💰 *شحن حساب* - إيداع رصيد إلى حسابك
💸 *سحب رصيد* - سحب من رصيد حسابك
👤 *حسابي* - عرض معلومات حسابك

*📋 التعليمات:*
1. اضغط على "إنشاء حساب جديد"
2. اتبع التعليمات خطوة بخطوة
3. سيتم إنشاء حسابك خلال ثواني

*⚡ الحد الأدنى:*
- الحد الأدنى للإيداع: 10 NSP
- الحد الأدنى للسحب: 10 NSP
    `;
    
    await bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        ...mainMenu
    });
});

// استيراد المعالجات
const ichancyHandlers = require('./handlers/ichancy_handlers');

// تسجيل المعالجات بعد تهيئة البوت
ichancyHandlers.registerIchancyHandlers(bot);
console.log('✅ Ichancy handlers registered');
