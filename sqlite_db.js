// sqlite_db.js
console.log('📦 Loading sqlite_db module...');

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

let db;

async function initDatabase() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(__dirname, 'database.db');
        
        // إنشاء مجلد logs إذا لم يكن موجوداً
        if (!fs.existsSync('logs')) {
            fs.mkdirSync('logs', { recursive: true });
        }
        
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error opening database:', err.message);
                reject(err);
                return;
            }
            
            console.log('✅ Connected to SQLite database');
            
            // إنشاء الجداول
            const createTables = `
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `;
            
            db.exec(createTables, (err) => {
                if (err) {
                    console.error('❌ Error creating tables:', err.message);
                    reject(err);
                    return;
                }
                
                console.log('✅ Database tables created/verified');
                resolve(db);
            });
        });
    });
}

// دوال مجمدة
async function deductUserBalance(userId, amount) {
    console.log(`📝 Mock: deductUserBalance - ${userId}, ${amount}`);
    return true;
}

async function updateBalance(userId, amount, operation) {
    console.log(`📝 Mock: updateBalance - ${userId}, ${amount}, ${operation}`);
    return true;
}

async function getIchancyAccountByUserId(userId) {
    console.log(`📝 Mock: getIchancyAccountByUserId - ${userId}`);
    return null;
}

async function insertIchancyAccount(userId, playerId, login, password, email, balance, createdAt) {
    console.log(`📝 Mock: insertIchancyAccount - ${login}`);
    return 1;
}

async function getAllIchancyAccounts() {
    console.log(`📝 Mock: getAllIchancyAccounts`);
    return [];
}

module.exports = {
    initDatabase,
    deductUserBalance,
    updateBalance,
    getIchancyAccountByUserId,
    insertIchancyAccount,
    getAllIchancyAccounts
};
