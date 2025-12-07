
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { initDatabase } = require('./sqlite_db');
const { registerIchancyHandlers } = require('./handlers/ichancy_handlers');

// تهيئة البوت
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// تهيئة القائمة الرئيسية
const mainKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: "📱 رابط الموقع", callback_data: "ichancy_site" },
                { text: "🆕 إنشاء حساب", callback_data: "neu_account" }
            ],
            [
                { text: "💰 شحن حساب", callback_data: "charge_account" },
                { text: "💸 سحب من حساب", callback_data: "withdraw_account" }
            ],
            [
                { text: "👤 حسابي", callback_data: "my_account" }
            ]
        ]
    }
};

// أمر البداية
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const welcomeMsg = `
مرحباً بك في بوت ايشانسي! 👋

اختر من الأزرار أدناه:

📱 *رابط الموقع* - للدخول إلى موقع ايشانسي
🆕 *إنشاء حساب* - لإنشاء حساب جديد على ايشانسي
💰 *شحن حساب* - لإيداع رصيد إلى حسابك
💸 *سحب من حساب* - لسحب رصيد من حسابك
👤 *حسابي* - لعرض معلومات حسابك

*ملاحظة:* 
- الحد الأدنى للإيداع والسحب هو 10 NSP
- يتم تحديث الأرصدة كل 30 دقيقة
    `;
    
    await bot.sendMessage(chatId, welcomeMsg, {
        parse_mode: 'Markdown',
        ...mainKeyboard
    });
});

// أمر المساعدة
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        `🆘 *مساعدة*

الأوامر المتاحة:
/start - بدء البوت وعرض القائمة الرئيسية
/help - عرض هذه الرسالة
/myaccount - عرض معلومات حسابك

للتواصل مع الدعم: @support_username`,
        { parse_mode: 'Markdown' }
    );
});

// بدء التطبيق
async function startBot() {
    try {
        console.log('🚀 Starting bot...');
        
        // تهيئة قاعدة البيانات
        await initDatabase();
        console.log('✅ Database initialized');
        
        // تسجيل معالجات ايشانسي
        registerIchancyHandlers(bot);
        console.log('✅ Ichancy handlers registered');
        
        console.log('🤖 Bot is running...');
    } catch (error) {
        console.error('❌ Error starting bot:', error);
        process.exit(1);
    }
}

// معالجة الأخطاء غير المتوقعة
process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

// تشغيل البوت
startBot();
