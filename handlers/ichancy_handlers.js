// handlers/ichancy_handlers.js
console.log('📦 Loading ichancy_handlers module...');

const winston = require('winston');

// تهيئة الـ logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.simple()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
    ]
});

const activeUsers = new Set();

function generateRandomName(baseName) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randStr = '';
    for (let i = 0; i < 2; i++) {
        randStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${baseName}${randStr}`;
}

function registerIchancyHandlers(bot) {
    logger.info('Registering ichancy handlers...');
    
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        
        logger.info(`Callback received: ${data} from chat ${chatId}`);
        
        if (data === 'ichancy_site') {
            await bot.sendMessage(chatId, '🌐 موقع ايشانسي: https://ichancy.com');
        } else if (data === 'neu_account') {
            await bot.sendMessage(chatId, '🆕 إنشاء حساب جديد: هذه الميزة قيد التطوير');
        } else if (data === 'charge_account') {
            await bot.sendMessage(chatId, '💰 شحن حساب: هذه الميزة قيد التطوير');
        } else if (data === 'withdraw_account') {
            await bot.sendMessage(chatId, '💸 سحب من حساب: هذه الميزة قيد التطوير');
        } else if (data === 'my_account') {
            await bot.sendMessage(chatId, '👤 حسابي: هذه الميزة قيد التطوير');
        }
    });
}

module.exports = {
    registerIchancyHandlers,
    generateRandomName,
    activeUsers,
    logger
};
