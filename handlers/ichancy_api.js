
const cloudscraper = require('cloudscraper');
const fs = require('fs');
const path = require('path');

// إعدادات البيئة
const AGENT_USERNAME = process.env.AGENT_USERNAME || "tsa_robert@tsa.com";
const AGENT_PASSWORD = process.env.AGENT_PASSWORD || "K041@051kkk";
const PARENT_ID = process.env.PARENT_ID || "2307909";

const ORIGIN = "https://agents.ichancy.com";
const SIGNIN_URL = ORIGIN + "/global/api/User/signIn";
const CREATE_URL = ORIGIN + "/global/api/Player/registerPlayer";
const STATISTICS_URL = ORIGIN + "/global/api/Statistics/getPlayersStatisticsPro";
const DEPOSIT_URL = ORIGIN + "/global/api/Player/depositToPlayer";
const WITHDRAW_URL = ORIGIN + "/global/api/Player/withdrawFromPlayer";
const GET_BALANCE_URL = ORIGIN + "/global/api/Player/getPlayerBalanceById";

const USER_AGENT = (
    "Mozilla/5.0 (Linux; Android 6.0.1; SM-G532F) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/106.0.5249.126 Mobile Safari/537.36"
);
const REFERER = ORIGIN + "/dashboard";

const COOKIE_FILE = path.join(__dirname, "cookies.json");

// تهيئة الـ scraper مع الكوكيز
let scraper = cloudscraper.defaults({
    headers: {
        'User-Agent': USER_AGENT,
        'Origin': ORIGIN,
        'Referer': REFERER
    }
});

// تحميل الكوكيز المحفوظة
let cookies = {};
if (fs.existsSync(COOKIE_FILE)) {
    try {
        const cookieData = fs.readFileSync(COOKIE_FILE, 'utf8');
        cookies = JSON.parse(cookieData);
    } catch (error) {
        console.error('Error loading cookies:', error);
    }
}

let isLoggedIn = false;

/**
 * تسجيل دخول الوكيل
 * @returns {Promise<{success: boolean, data: object}>}
 */
async function loginToAgent() {
    const payload = {
        username: AGENT_USERNAME,
        password: AGENT_PASSWORD
    };
    
    const options = {
        method: 'POST',
        uri: SIGNIN_URL,
        json: payload,
        headers: {
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "Origin": ORIGIN,
            "Referer": REFERER
        }
    };

    try {
        const response = await cloudscraper(options);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        if (data.result === true) {
            // حفظ الكوكيز
            if (response.headers && response.headers['set-cookie']) {
                cookies = response.headers['set-cookie'].reduce((acc, cookie) => {
                    const [cookieStr] = cookie.split(';');
                    const [name, value] = cookieStr.split('=');
                    acc[name] = value;
                    return acc;
                }, {});
                
                fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
            }
            return { success: true, data };
        }
        return { success: false, data };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, data: { error: error.message } };
    }
}

/**
 * التأكد من تسجيل الدخول
 * @throws {Error} إذا فشل تسجيل الدخول
 */
async function ensureLogin() {
    if (!isLoggedIn) {
        const { success, data } = await loginToAgent();
        isLoggedIn = success;
        if (!success) {
            const errorMsg = data.notification?.[0]?.content || "فشل تسجيل دخول الوكيل";
            throw new Error(errorMsg);
        }
    }
}

/**
 * توليد بيانات اعتماد عشوائية
 * @returns {Promise<{login: string, password: string}>}
 */
function generateRandomCredentials() {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const lettersAndDigits = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    let login = 'u';
    for (let i = 0; i < 7; i++) {
        login += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    let password = '';
    for (let i = 0; i < 10; i++) {
        password += lettersAndDigits.charAt(Math.floor(Math.random() * lettersAndDigits.length));
    }
    
    return { login, password };
}

/**
 * إنشاء لاعب جديد
 * @returns {Promise<{status: number, data: object, login: string, password: string, playerId: string|null}>}
 */
async function createPlayer() {
    await ensureLogin();
    
    const { login, password } = generateRandomCredentials();
    const email = `${login}@example.com`;
    
    const payload = {
        player: {
            email: email,
            password: password,
            parentId: PARENT_ID,
            login: login
        }
    };
    
    const options = {
        method: 'POST',
        uri: CREATE_URL,
        json: payload,
        headers: {
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "Origin": ORIGIN,
            "Referer": REFERER,
            "Cookie": Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ')
        }
    };
    
    try {
        const response = await cloudscraper(options);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        const playerId = await getPlayerIdByLogin(login);
        return {
            status: 200,
            data: data,
            login: login,
            password: password,
            playerId: playerId
        };
    } catch (error) {
        console.error('Create player error:', error);
        return {
            status: error.statusCode || 500,
            data: { error: error.message },
            login: login,
            password: password,
            playerId: null
        };
    }
}

/**
 * الحصول على معرف اللاعب بواسطة اسم الدخول
 * @param {string} login - اسم الدخول
 * @returns {Promise<string|null>} - معرف اللاعب
 */
async function getPlayerIdByLogin(login) {
    await ensureLogin();
    
    const payload = {
        page: 1,
        pageSize: 100,
        filter: { login: login }
    };
    
    const options = {
        method: 'POST',
        uri: STATISTICS_URL,
        json: payload,
        headers: {
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "Origin": ORIGIN,
            "Referer": REFERER,
            "Cookie": Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ')
        }
    };
    
    try {
        const response = await cloudscraper(options);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        const records = data.result?.records || [];
        for (const record of records) {
            if (record.username === login) {
                return record.playerId;
            }
        }
        return null;
    } catch (error) {
        console.error('Get player ID error:', error);
        return null;
    }
}

/**
 * إيداع مبلغ للاعب
 * @param {string} playerId - معرف اللاعب
 * @param {number} amount - المبلغ
 * @returns {Promise<{status: number, result: object}>}
 */
async function depositToPlayer(playerId, amount) {
    await ensureLogin();
    
    const payload = {
        amount: amount,
        comment: null,
        playerId: playerId,
        currencyCode: "NSP",
        currency: "NSP",
        moneyStatus: 5
    };
    
    const options = {
        method: 'POST',
        uri: DEPOSIT_URL,
        json: payload,
        headers: {
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "Origin": ORIGIN,
            "Referer": REFERER,
            "Cookie": Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ')
        }
    };
    
    try {
        const response = await cloudscraper(options);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        return { status: 200, result: data };
    } catch (error) {
        console.error('Deposit error:', error);
        // محاولة إعادة تسجيل الدخول والمحاولة مرة أخرى
        isLoggedIn = false;
        await ensureLogin();
        
        try {
            const retryResponse = await cloudscraper(options);
            const retryData = typeof retryResponse === 'string' ? JSON.parse(retryResponse) : retryResponse;
            return { status: 200, result: retryData };
        } catch (retryError) {
            return { 
                status: retryError.statusCode || 500, 
                result: { error: retryError.message, result: false } 
            };
        }
    }
}

/**
 * سحب مبلغ من اللاعب
 * @param {string} playerId - معرف اللاعب
 * @param {number} amount - المبلغ
 * @returns {Promise<{status: number, result: object}>}
 */
async function withdrawFromPlayer(playerId, amount) {
    await ensureLogin();
    
    const payload = {
        amount: amount,
        comment: null,
        playerId: playerId,
        currencyCode: "NSP",
        currency: "NSP",
        moneyStatus: 5
    };
    
    const options = {
        method: 'POST',
        uri: WITHDRAW_URL,
        json: payload,
        headers: {
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "Origin": ORIGIN,
            "Referer": REFERER,
            "Cookie": Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ')
        }
    };
    
    try {
        const response = await cloudscraper(options);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        return { status: 200, result: data };
    } catch (error) {
        console.error('Withdraw error:', error);
        // محاولة إعادة تسجيل الدخول والمحاولة مرة أخرى
        isLoggedIn = false;
        await ensureLogin();
        
        try {
            const retryResponse = await cloudscraper(options);
            const retryData = typeof retryResponse === 'string' ? JSON.parse(retryResponse) : retryResponse;
            return { status: 200, result: retryData };
        } catch (retryError) {
            return { 
                status: retryError.statusCode || 500, 
                result: { error: retryError.message, result: false } 
            };
        }
    }
}

/**
 * الحصول على رصيد اللاعب
 * @param {string} playerId - معرف اللاعب
 * @returns {Promise<{status: number, result: object, balance: number}>}
 */
async function getPlayerBalance(playerId) {
    await ensureLogin();
    
    const payload = {
        playerId: String(playerId)
    };
    
    const options = {
        method: 'POST',
        uri: GET_BALANCE_URL,
        json: payload,
        headers: {
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "Origin": ORIGIN,
            "Referer": REFERER,
            "Cookie": Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ')
        }
    };
    
    try {
        const response = await cloudscraper(options);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        const results = data.result || [];
        const balance = Array.isArray(results) && results.length > 0 
            ? results[0].balance || 0 
            : 0;
            
        return {
            status: 200,
            result: data,
            balance: balance
        };
    } catch (error) {
        console.error('Get balance error:', error);
        // محاولة إعادة تسجيل الدخول والمحاولة مرة أخرى
        isLoggedIn = false;
        await ensureLogin();
        
        try {
            const retryResponse = await cloudscraper(options);
            const retryData = typeof retryResponse === 'string' ? JSON.parse(retryResponse) : retryResponse;
            const retryResults = retryData.result || [];
            const retryBalance = Array.isArray(retryResults) && retryResults.length > 0 
                ? retryResults[0].balance || 0 
                : 0;
                
            return {
                status: 200,
                result: retryData,
                balance: retryBalance
            };
        } catch (retryError) {
            return { 
                status: retryError.statusCode || 500, 
                result: { error: retryError.message, result: [] },
                balance: 0
            };
        }
    }
}

/**
 * إنشاء لاعب ببيانات اعتماد محددة
 * @param {string} login - اسم الدخول
 * @param {string} password - كلمة المرور
 * @returns {Promise<{status: number, result: object, playerId: string|null, email: string}>}
 */
async function createPlayerWithCredentials(login, password) {
    await ensureLogin();
    
    let email = `${login}@TSA.com`;
    
    // التأكد من تفرد الإيميل
    while (await checkEmailExists(email)) {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        email = `${login}_${randomSuffix}@TSA.com`;
    }
    
    const payload = {
        player: {
            email: email,
            password: password,
            parentId: PARENT_ID,
            login: login
        }
    };
    
    const options = {
        method: 'POST',
        uri: CREATE_URL,
        json: payload,
        headers: {
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "Origin": ORIGIN,
            "Referer": REFERER,
            "Cookie": Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ')
        }
    };
    
    try {
        const response = await cloudscraper(options);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        const playerId = await getPlayerIdByLogin(login);
        return {
            status: 200,
            result: data,
            playerId: playerId,
            email: email
        };
    } catch (error) {
        console.error('Create player with credentials error:', error);
        return {
            status: error.statusCode || 500,
            result: { error: error.message },
            playerId: null,
            email: email
        };
    }
}

/**
 * التحقق من وجود الإيميل
 * @param {string} email - الإيميل
 * @returns {Promise<boolean>}
 */
async function checkEmailExists(email) {
    await ensureLogin();
    
    const payload = {
        page: 1,
        pageSize: 100,
        filter: { email: email }
    };
    
    const options = {
        method: 'POST',
        uri: STATISTICS_URL,
        json: payload,
        headers: {
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "Origin": ORIGIN,
            "Referer": REFERER,
            "Cookie": Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ')
        }
    };
    
    try {
        const response = await cloudscraper(options);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        const records = data.result?.records || [];
        for (const record of records) {
            if (record.email === email) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Check email exists error:', error);
        return false;
    }
}

/**
 * التحقق من وجود اللاعب
 * @param {string} login - اسم الدخول
 * @returns {Promise<boolean>}
 */
async function checkPlayerExists(login) {
    await ensureLogin();
    
    const payload = {
        page: 1,
        pageSize: 100,
        filter: { login: login }
    };
    
    const options = {
        method: 'POST',
        uri: STATISTICS_URL,
        json: payload,
        headers: {
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "Origin": ORIGIN,
            "Referer": REFERER,
            "Cookie": Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ')
        }
    };
    
    try {
        const response = await cloudscraper(options);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        const records = data.result?.records || [];
        for (const record of records) {
            if (record.username === login) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Check player exists error:', error);
        return false;
    }
}

// تصدير الدوال
module.exports = {
    loginToAgent,
    createPlayer,
    depositToPlayer,
    withdrawFromPlayer,
    getPlayerBalance,
    createPlayerWithCredentials,
    checkEmailExists,
    checkPlayerExists,
    getPlayerIdByLogin,
    isLoggedIn: () => isLoggedIn
};
