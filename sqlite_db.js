
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;

/**
 * تهيئة قاعدة البيانات
 */
async function initDatabase() {
    try {
        db = await open({
            filename: path.join(__dirname, 'database.db'),
            driver: sqlite3.Database
        });

        // إنشاء الجداول إذا لم تكن موجودة
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                balance REAL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS ichancy_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                player_id TEXT NOT NULL UNIQUE,
                player_login TEXT NOT NULL UNIQUE,
                player_password TEXT NOT NULL,
                email TEXT NOT NULL,
                initial_balance REAL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_user_id ON ichancy_accounts(user_id);
            CREATE INDEX IF NOT EXISTS idx_player_login ON ichancy_accounts(player_login);
        `);

        console.log('Database initialized successfully');
        return db;
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

/**
 * خصم رصيد المستخدم
 */
async function deductUserBalance(userId, amount) {
    try {
        const result = await db.run(
            'UPDATE users SET balance = balance - ? WHERE user_id = ? AND balance >= ?',
            [amount, userId, amount]
        );
        return result.changes > 0;
    } catch (error) {
        console.error('Error deducting user balance:', error);
        return false;
    }
}

/**
 * تحديث رصيد المستخدم
 */
async function updateBalance(userId, amount, operation = "add") {
    try {
        const operator = operation === "add" ? "+" : "-";
        const query = `UPDATE users SET balance = balance ${operator} ? WHERE user_id = ?`;
        const result = await db.run(query, [amount, userId]);
        return result.changes > 0;
    } catch (error) {
        console.error('Error updating balance:', error);
        return false;
    }
}

/**
 * تحديث رصيد ايشانسي في السجل
 */
async function updateSheetIchancyBalance(userId, balance) {
    try {
        const result = await db.run(
            'UPDATE ichancy_accounts SET initial_balance = ? WHERE user_id = ?',
            [balance, userId]
        );
        return result.changes > 0;
    } catch (error) {
        console.error('Error updating ichancy balance:', error);
        return false;
    }
}

/**
 * جلب حساب ايشانسي بواسطة معرف المستخدم
 */
async function getIchancyAccountByUserId(userId) {
    try {
        return await db.get(
            'SELECT * FROM ichancy_accounts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );
    } catch (error) {
        console.error('Error getting ichancy account:', error);
        return null;
    }
}

/**
 * إدراج حساب ايشانسي جديد
 */
async function insertIchancyAccount(userId, playerId, login, password, email, initialBalance, createdAt) {
    try {
        // التأكد من وجود المستخدم في جدول users أولاً
        await db.run(
            'INSERT OR IGNORE INTO users (user_id, balance) VALUES (?, 0)',
            [userId]
        );

        const result = await db.run(
            `INSERT INTO ichancy_accounts 
            (user_id, player_id, player_login, player_password, email, initial_balance, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, playerId, login, password, email, initialBalance, createdAt]
        );
        
        return result.lastID;
    } catch (error) {
        console.error('Error inserting ichancy account:', error);
        throw error;
    }
}

/**
 * جلب جميع حسابات ايشانسي
 */
async function getAllIchancyAccounts() {
    try {
        return await db.all('SELECT * FROM ichancy_accounts');
    } catch (error) {
        console.error('Error getting all ichancy accounts:', error);
        return [];
    }
}

// تصدير الدوال
module.exports = {
    initDatabase,
    deductUserBalance,
    updateBalance,
    updateSheetIchancyBalance,
    getIchancyAccountByUserId,
    insertIchancyAccount,
    getAllIchancyAccounts
};
