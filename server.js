// server.js - الملف الرئيسي الذي يجمع البوت والخادم الصحي
require('dotenv').config();
console.log('🚀 Starting Telegram Bot with Health Check...');

// 1. بدء خادم فحص الصحة
const { startHealthServer } = require('./health');
const healthServer = startHealthServer(process.env.PORT || 3000);

// 2. بدء البوت بعد تأخير قصير
setTimeout(() => {
    try {
        console.log('🤖 Starting Telegram Bot...');
        
        const TelegramBot = require('node-telegram-bot-api');
        const { initDatabase } = require('./sqlite_db');
        const { registerIchancyHandlers } = require('./handlers/ichancy_handlers');
        
        // التحقق من وجود توكن البوت
        if (!process.env.BOT_TOKEN) {
            console.error('❌ BOT_TOKEN is not set in environment variables');
            process.exit(1);
        }
        
        // تهيئة البوت
        const bot = new TelegramBot(process.env.BOT_TOKEN, {
            polling: {
                interval: 300,
                autoStart: true,
                params: {
                    timeout: 10,
                    limit: 100
                }
            },
            request: {
                timeout: 30000,
                agentOptions: {
                    keepAlive: true,
                    maxSockets: Infinity
                }
            }
        });
        
        // معالجة أخطاء البوت
        bot.on('polling_error', (error) => {
            console.error('📡 Telegram polling error:', error.message);
            console.error('Error code:', error.code);
            
            // إعادة المحاولة التلقائية لأخطاء الشبكة
            if (error.code === 'EFATAL' || error.code === 'ETELEGRAM') {
                console.log('🔄 Attempting to reconnect in 10 seconds...');
                setTimeout(() => {
                    bot.stopPolling();
                    setTimeout(() => bot.startPolling(), 1000);
                }, 10000);
            }
        });
        
        bot.on('webhook_error', (error) => {
            console.error('🌐 Webhook error:', error);
        });
        
        bot.on('error', (error) => {
            console.error('🤖 Bot error:', error);
        });
        
        // حدث عند بدء البوت بنجاح
        bot.on('polling_start', () => {
            console.log('✅ Bot polling started successfully');
            console.log(`🤖 Bot username: @${bot.getMe().then(me => me.username).catch(() => 'unknown')}`);
        });
        
        // تهيئة قاعدة البيانات
        initDatabase().then(() => {
            console.log('✅ Database initialized');
            
            // تسجيل معالجات البوت
            registerIchancyHandlers(bot);
            console.log('✅ Bot handlers registered');
            
            // أمر البداية
            bot.onText(/\/start/, (msg) => {
                const chatId = msg.chat.id;
                const welcomeMessage = `✨ *مرحباً بك في بوت ايشانسي!* ✨\n\n` +
                    `✅ *الحالة:* البوت يعمل بنجاح\n` +
                    `🔄 *الخادم:* نشط ومستقر\n` +
                    `📊 *الوقت:* ${new Date().toLocaleString()}\n\n` +
                    `اختر من القائمة أدناه:`;
                
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
            
            // أمر فحص الصحة
            bot.onText(/\/status/, (msg) => {
                const chatId = msg.chat.id;
                const uptime = process.uptime();
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);
                
                bot.sendMessage(chatId, 
                    `📊 *حالة النظام*\n\n` +
                    `✅ *الحالة:* نشط\n` +
                    `⏱️ *مدة التشغيل:* ${hours}س ${minutes}د ${seconds}ث\n` +
                    `💾 *الذاكرة:* ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\n` +
                    `🔄 *الإصدار:* 1.0.0\n` +
                    `📡 *آخر تحديث:* ${new Date().toLocaleTimeString()}`,
                    { parse_mode: 'Markdown' }
                );
            });
            
            console.log('🎉 Bot is fully operational!');
            console.log('📝 Send /start to your bot to test');
            
        }).catch(error => {
            console.error('❌ Database initialization failed:', error);
            process.exit(1);
        });
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}, 1000); // تأخير 1 ثانية لبدء الخادم الصحي أولاً

// 3. معالجة إشارات الإغلاق
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    healthServer.close(() => {
        console.log('✅ Health server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    healthServer.close(() => {
        console.log('✅ Health server closed');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error);
    console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
});
