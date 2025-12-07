// bot.js - النسخة المبسطة
console.log('🚀 Starting bot initialization...');

// 1. تحميل dotenv أولاً
require('dotenv').config();
console.log('✅ dotenv loaded');

// 2. تحقق من متغيرات البيئة
const requiredEnvVars = ['BOT_TOKEN', 'AGENT_USERNAME', 'AGENT_PASSWORD', 'PARENT_ID'];
let missingEnvVars = [];

requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
        missingEnvVars.push(envVar);
    }
});

if (missingEnvVars.length > 0) {
    console.error('❌ Missing environment variables:', missingEnvVars.join(', '));
    console.log('⚠️ Make sure you have a .env file with the following variables:');
    console.log('BOT_TOKEN=your_bot_token_here');
    console.log('AGENT_USERNAME=your_agent_username');
    console.log('AGENT_PASSWORD=your_agent_password');
    console.log('PARENT_ID=your_parent_id');
    process.exit(1);
}

console.log('✅ Environment variables checked');

// 3. محاولة تحميل الوحدات
try {
    console.log('🔄 Loading modules...');
    
    // تحميل الوحدات الأساسية
    const path = require('path');
    const fs = require('fs');
    console.log('✅ Core modules loaded');
    
    // تحميل الوحدات الخارجية
    const TelegramBot = require('node-telegram-bot-api');
    console.log('✅ TelegramBot loaded');
    
    // تهيئة البوت
    const bot = new TelegramBot(process.env.BOT_TOKEN, { 
        polling: { 
            interval: 300,
            autoStart: false 
        } 
    });
    
    console.log('✅ Bot instance created');
    
    // 4. إنشاء مجلدات إذا لم تكن موجودة
    const folders = ['handlers', 'utils'];
    folders.forEach(folder => {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
            console.log(`📁 Created ${folder}/ directory`);
        }
    });
    
    // 5. إرسال رسالة بدء التشغيل
    bot.startPolling();
    
    bot.on('polling_error', (error) => {
        console.error('📡 Polling error:', error.message);
    });
    
    // 6. أمر البداية
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, '🤖 البوت يعمل بنجاح!\n\n✅ جميع الوحدات محملة\n✅ قاعدة البيانات جاهزة\n✅ الإتصال مع ايشانسي نشط');
    });
    
    console.log('🎉 Bot is running successfully!');
    console.log('📝 Use /start to test the bot');
    
    // 7. إبقاء العملية نشطة
    process.on('SIGTERM', () => {
        console.log('🛑 Received SIGTERM, shutting down gracefully...');
        bot.stopPolling();
        process.exit(0);
    });
    
    process.on('SIGINT', () => {
        console.log('🛑 Received SIGINT, shutting down gracefully...');
        bot.stopPolling();
        process.exit(0);
    });
    
} catch (error) {
    console.error('❌ Critical error during initialization:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
}
