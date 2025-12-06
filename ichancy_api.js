const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const jar = new CookieJar();
const USER_AGENT = "Mozilla/5.0 (Linux; Android 6.0.1; SM-G532F) Chrome/106.0.5249.126 Mobile Safari/537.36";

const ORIGIN = "https://agents.ichancy.com";
const SIGNIN_URL = `${ORIGIN}/global/api/User/signIn`;
const CREATE_URL = `${ORIGIN}/global/api/Player/registerPlayer`;
const STATISTICS_URL = `${ORIGIN}/global/api/Statistics/getPlayersStatisticsPro`;
const DEPOSIT_URL = `${ORIGIN}/global/api/Player/depositToPlayer`;
const WITHDRAW_URL = `${ORIGIN}/global/api/Player/withdrawFromPlayer`;
const GET_BALANCE_URL = `${ORIGIN}/global/api/Player/getPlayerBalanceById`;

const AGENT_USERNAME = process.env.AGENT_USERNAME || "tsa_robert@tsa.com";
const AGENT_PASSWORD = process.env.AGENT_PASSWORD || "K041@051kkk";
const PARENT_ID = process.env.PARENT_ID || "2307909";

let isLoggedIn = false;

// تسجيل دخول الوكيل
async function loginToAgent() {
  try {
    const resp = await axios.post(SIGNIN_URL, { username: AGENT_USERNAME, password: AGENT_PASSWORD }, {
      headers: { "User-Agent": USER_AGENT, "Origin": ORIGIN, "Content-Type": "application/json" },
      jar, withCredentials: true
    });
    const data = resp.data;
    isLoggedIn = data.result || false;
    return data.result || false;
  } catch (err) {
    console.error("Login failed:", err.message);
    return false;
  }
}

// Retry wrapper
async function withRetry(fn, ...args) {
  if (!isLoggedIn) await loginToAgent();
  let res = await fn(...args);
  if (!res || res.status !== 200 || !res.data?.result) {
    isLoggedIn = false;
    await loginToAgent();
    res = await fn(...args);
  }
  return res;
}

// إنشاء بيانات عشوائية
function generateRandomCredentials() {
  const login = "u" + Math.random().toString(36).substring(2, 9);
  const pwd = Math.random().toString(36).substring(2, 12);
  return { login, pwd };
}

// إنشاء لاعب جديد
async function createPlayer() {
  const { login, pwd } = generateRandomCredentials();
  const email = `${login}@example.com`;
  const payload = { player: { email, password: pwd, parentId: PARENT_ID, login } };

  const resp = await axios.post(CREATE_URL, payload, {
    headers: { "User-Agent": USER_AGENT, "Origin": ORIGIN, "Content-Type": "application/json" },
    jar, withCredentials: true
  });

  return { status: resp.status, data: resp.data, login, pwd };
}

// شحن رصيد
async function depositToPlayer(playerId, amount) {
  const payload = { playerId, amount, currency: "NSP", currencyCode: "NSP", moneyStatus: 5 };
  const resp = await axios.post(DEPOSIT_URL, payload, {
    headers: { "User-Agent": USER_AGENT, "Origin": ORIGIN, "Content-Type": "application/json" },
    jar, withCredentials: true
  });
  return { status: resp.status, data: resp.data };
}

// سحب رصيد
async function withdrawFromPlayer(playerId, amount) {
  const payload = { playerId, amount, currency: "NSP", currencyCode: "NSP", moneyStatus: 5 };
  const resp = await axios.post(WITHDRAW_URL, payload, {
    headers: { "User-Agent": USER_AGENT, "Origin": ORIGIN, "Content-Type": "application/json" },
    jar, withCredentials: true
  });
  return { status: resp.status, data: resp.data };
}

// جلب الرصيد
async function getPlayerBalance(playerId) {
  const payload = { playerId: String(playerId) };
  const resp = await axios.post(GET_BALANCE_URL, payload, {
    headers: { "User-Agent": USER_AGENT, "Origin": ORIGIN, "Content-Type": "application/json" },
    jar, withCredentials: true
  });
  const balance = resp.data.result?.[0]?.balance || 0;
  return { status: resp.status, data: resp.data, balance };
}

module.exports = {
  loginToAgent,
  withRetry,
  createPlayer,
  depositToPlayer,
  withdrawFromPlayer,
  getPlayerBalance
};
