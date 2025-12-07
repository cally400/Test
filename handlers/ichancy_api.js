// ichancy_api.js - النسخة المحسنة
const cloudscraper = require('cloudscraper');
const fs = require('fs').promises;
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

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const REFERER = ORIGIN + "/dashboard";

const COOKIE_FILE = path.join(__dirname, '..', 'cookies.json');

// تخزين الكوكيز
let cookies = {};

/**
 * تحميل الكوكيز من الملف
 */
async function loadCookies() {
    try {
        if (await fs.access(COOKIE_FILE).then(() => true).catch(() => false)) {
            const data = await fs.readFile(COOKIE_FILE, 'utf8');
            cookies = JSON.parse(data);
            console.log('✅ تم تحميل الكوكيز');
            return true;
        }
    } catch (error) {
        console.log('⚠️ لم يتم تحميل الكوكيز:', error.message);
    }
    return false;
}

/**
 * حفظ الكوكيز إلى الملف
 */
async function saveCookies() {
    try {
        await fs.writeFile(COOKIE_FILE, JSON.stringify(cookies, null, 2));
        console.log('💾 تم حفظ الكوكيز');
    } catch (error) {
        console.log('❌ خطأ في حفظ الكوكيز:', error.message);
    }
}

/**
 * تسجيل دخول الوكيل
 */
async function loginToAgent() {
    console.log('🔐 محاولة تسجيل الدخول...');
    
    try {
        const response = await cloudscraper.post(SIGNIN_URL, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT,
                'Origin': ORIGIN,
                'Referer': REFERER
            },
            json: {
                username: AGENT_USERNAME,
                password: AGENT_PASSWORD
            },
            resolveWithFullResponse: true
        });

        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            
            if (data.result === true) {
                // استخراج الكوكيز من الاستجابة
                if (response.headers['set-cookie']) {
                    response.headers['set-cookie'].forEach(cookie => {
                        const [cookieStr] = cookie.split(';');
                        const [name, value] = cookieStr.split('=');
                        if (name && value) {
                            cookies[name.trim()] = value.trim();
                        }
                    });
                    
                    await saveCookies();
                    console.log('✅ تسجيل الدخول ناجح');
                    return { success: true, data };
                }
            }
        }
        
        console.log('❌ تسجيل الدخول فاشل:', response.body);
        return { success: false, data: { error: 'فشل تسجيل الدخول' } };
        
    } catch (error) {
        console.log('❌ خطأ في تسجيل الدخول:', error.message);
        return { success: false, data: { error: error.message } };
    }
}

/**
 * التأكد من تسجيل الدخول
 */
async function ensureLogin() {
    console.log('🔍 التحقق من تسجيل الدخول...');
    
    // محاولة تحميل الكوكيز أولاً
    await loadCookies();
    
    // إذا كان لدينا كوكيز، اختبرها
    if (Object.keys(cookies).length > 0) {
        try {
            const testResponse = await cloudscraper.get(ORIGIN + '/dashboard', {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Cookie': Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
                }
            });
            
            if (testResponse.includes('dashboard')) {
                console.log('✅ الدخول نشط بالفعل');
                return true;
            }
        } catch (error) {
            console.log('⚠️ الجلسة منتهية، إعادة تسجيل الدخول...');
        }
    }
    
    // إعادة تسجيل الدخول
    const { success } = await loginToAgent();
    return success;
}

/**
 * طلب API مع إعادة محاولة تلقائية
 */
async function makeRequest(options, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // إضافة الكوكيز إلى الطلب
            if (Object.keys(cookies).length > 0) {
                options.headers = options.headers || {};
                options.headers['Cookie'] = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
            }
            
            const response = await cloudscraper(options);
            return response;
            
        } catch (error) {
            console.log(`❌ محاولة ${attempt}/${maxRetries} فشلت:`, error.message);
            
            if (attempt < maxRetries) {
                // إذا كان خطأ جلسة، حاول إعادة تسجيل الدخول
                if (error.message.includes('session') || error.message.includes('cookie') || error.message.includes('401') || error.message.includes('403')) {
                    console.log('🔄 إعادة تسجيل الدخول...');
                    await ensureLogin();
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // تأخير متزايد
            } else {
                throw error;
            }
        }
    }
}

/**
 * إنشاء لاعب ببيانات اعتماد محددة
 */
async function createPlayerWithCredentials(login, password) {
    console.log(`👤 محاولة إنشاء حساب: ${login}`);
    
    try {
        // التأكد من تسجيل الدخول أولاً
        const isLoggedIn = await ensureLogin();
        if (!isLoggedIn) {
            throw new Error('فشل تسجيل دخول الوكيل');
        }
        
        // توليد إيميل فريد
        let email = `${login}@TSA.com`;
        let counter = 1;
        
        while (await checkEmailExists(email) && counter < 5) {
            email = `${login}_${counter}@TSA.com`;
            counter++;
        }
        
        // إنشاء payload الطلب
        const payload = {
            player: {
                email: email,
                password: password,
                parentId: PARENT_ID,
                login: login
            }
        };
        
        console.log(`📧 الإيميل: ${email}`);
        console.log(`🔑 كلمة المرور: ${password}`);
        console.log(`👤 اسم الدخول: ${login}`);
        console.log(`👨‍👦 Parent ID: ${PARENT_ID}`);
        
        const response = await makeRequest({
            method: 'POST',
            url: CREATE_URL,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT,
                'Origin': ORIGIN,
                'Referer': REFERER
            },
            json: payload
        });
        
        console.log('📥 استجابة إنشاء الحساب:', JSON.stringify(response).substring(0, 200));
        
        let data;
        if (typeof response === 'string') {
            try {
                data = JSON.parse(response);
            } catch {
                data = { result: false, notification: [{ content: 'استجابة غير صالحة من الخادم' }] };
            }
        } else {
            data = response;
        }
        
        if (data.result === true) {
            console.log(`✅ تم إنشاء الحساب: ${login}`);
            
            // الحصول على player_id
            const playerId = await getPlayerIdByLogin(login);
            
            return {
                status: 200,
                result: data,
                playerId: playerId,
                email: email
            };
        } else {
            const errorMsg = data.notification?.[0]?.content || 'فشل إنشاء الحساب';
            console.log(`❌ فشل إنشاء الحساب: ${errorMsg}`);
            
            return {
                status: 400,
                result: data,
                playerId: null,
                email: email
            };
        }
        
    } catch (error) {
        console.log(`❌ خطأ في إنشاء الحساب: ${error.message}`);
        return {
            status: 500,
            result: { error: error.message, result: false },
            playerId: null,
            email: `${login}@TSA.com`
        };
    }
}

/**
 * الحصول على معرف اللاعب بواسطة اسم الدخول
 */
async function getPlayerIdByLogin(login) {
    console.log(`🔍 البحث عن معرف اللاعب: ${login}`);
    
    try {
        const response = await makeRequest({
            method: 'POST',
            url: STATISTICS_URL,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT,
                'Origin': ORIGIN,
                'Referer': REFERER
            },
            json: {
                page: 1,
                pageSize: 10,
                filter: { login: login }
            }
        });
        
        let data;
        if (typeof response === 'string') {
            data = JSON.parse(response);
        } else {
            data = response;
        }
        
        if (data.result && data.result.records && data.result.records.length > 0) {
            const player = data.result.records.find(r => r.username === login);
            if (player) {
                console.log(`✅ تم العثور على معرف اللاعب: ${player.playerId}`);
                return player.playerId;
            }
        }
        
        console.log(`⚠️ لم يتم العثور على لاعب باسم: ${login}`);
        return null;
        
    } catch (error) {
        console.log(`❌ خطأ في البحث عن اللاعب: ${error.message}`);
        return null;
    }
}

/**
 * التحقق من وجود الإيميل
 */
async function checkEmailExists(email) {
    try {
        const response = await makeRequest({
            method: 'POST',
            url: STATISTICS_URL,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT,
                'Origin': ORIGIN,
                'Referer': REFERER
            },
            json: {
                page: 1,
                pageSize: 5,
                filter: { email: email }
            }
        });
        
        let data;
        if (typeof response === 'string') {
            data = JSON.parse(response);
        } else {
            data = response;
        }
        
        return data.result?.records?.some(r => r.email === email) || false;
        
    } catch (error) {
        console.log(`❌ خطأ في التحقق من الإيميل: ${error.message}`);
        return false;
    }
}

/**
 * التحقق من وجود اللاعب
 */
async function checkPlayerExists(login) {
    try {
        const response = await makeRequest({
            method: 'POST',
            url: STATISTICS_URL,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT,
                'Origin': ORIGIN,
                'Referer': REFERER
            },
            json: {
                page: 1,
                pageSize: 5,
                filter: { login: login }
            }
        });
        
        let data;
        if (typeof response === 'string') {
            data = JSON.parse(response);
        } else {
            data = response;
        }
        
        return data.result?.records?.some(r => r.username === login) || false;
        
    } catch (error) {
        console.log(`❌ خطأ في التحقق من اللاعب: ${error.message}`);
        return false;
    }
}

/**
 * إيداع مبلغ للاعب
 */
async function depositToPlayer(playerId, amount) {
    console.log(`💰 محاولة إيداع ${amount} لـ ${playerId}`);
    
    try {
        const response = await makeRequest({
            method: 'POST',
            url: DEPOSIT_URL,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT,
                'Origin': ORIGIN,
                'Referer': REFERER
            },
            json: {
                amount: amount,
                comment: null,
                playerId: playerId,
                currencyCode: "NSP",
                currency: "NSP",
                moneyStatus: 5
            }
        });
        
        let data;
        if (typeof response === 'string') {
            data = JSON.parse(response);
        } else {
            data = response;
        }
        
        console.log('📥 استجابة الإيداع:', JSON.stringify(data).substring(0, 200));
        
        return {
            status: 200,
            result: data
        };
        
    } catch (error) {
        console.log(`❌ خطأ في الإيداع: ${error.message}`);
        return {
            status: 500,
            result: { error: error.message, result: false }
        };
    }
}

/**
 * سحب مبلغ من اللاعب
 */
async function withdrawFromPlayer(playerId, amount) {
    console.log(`💸 محاولة سحب ${amount} من ${playerId}`);
    
    try {
        const response = await makeRequest({
            method: 'POST',
            url: WITHDRAW_URL,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT,
                'Origin': ORIGIN,
                'Referer': REFERER
            },
            json: {
                amount: amount,
                comment: null,
                playerId: playerId,
                currencyCode: "NSP",
                currency: "NSP",
                moneyStatus: 5
            }
        });
        
        let data;
        if (typeof response === 'string') {
            data = JSON.parse(response);
        } else {
            data = response;
        }
        
        console.log('📥 استجابة السحب:', JSON.stringify(data).substring(0, 200));
        
        return {
            status: 200,
            result: data
        };
        
    } catch (error) {
        console.log(`❌ خطأ في السحب: ${error.message}`);
        return {
            status: 500,
            result: { error: error.message, result: false }
        };
    }
}

/**
 * الحصول على رصيد اللاعب
 */
async function getPlayerBalance(playerId) {
    console.log(`📊 محاولة جلب رصيد اللاعب: ${playerId}`);
    
    try {
        const response = await makeRequest({
            method: 'POST',
            url: GET_BALANCE_URL,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT,
                'Origin': ORIGIN,
                'Referer': REFERER
            },
            json: {
                playerId: String(playerId)
            }
        });
        
        let data;
        if (typeof response === 'string') {
            data = JSON.parse(response);
        } else {
            data = response;
        }
        
        let balance = 0;
        if (data.result && Array.isArray(data.result) && data.result.length > 0) {
            balance = data.result[0].balance || 0;
        }
        
        console.log(`💰 الرصيد: ${balance}`);
        
        return {
            status: 200,
            result: data,
            balance: balance
        };
        
    } catch (error) {
        console.log(`❌ خطأ في جلب الرصيد: ${error.message}`);
        return {
            status: 500,
            result: { error: error.message, result: [] },
            balance: 0
        };
    }
}

// تصدير الدوال
module.exports = {
    loginToAgent,
    createPlayerWithCredentials,
    getPlayerIdByLogin,
    checkEmailExists,
    checkPlayerExists,
    depositToPlayer,
    withdrawFromPlayer,
    getPlayerBalance,
    ensureLogin
};
