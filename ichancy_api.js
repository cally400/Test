// ichancy_api.js
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { loginViaPuppeteer, loadCookies, saveCookies, COOKIE_FILE } = require("./ichancy_puppeteer");
require("dotenv").config();

const ORIGIN = "https://agents.ichancy.com";
const SIGNIN_URL = ORIGIN + "/global/api/User/signIn";
const CREATE_URL = ORIGIN + "/global/api/Player/registerPlayer";
const STATISTICS_URL = ORIGIN + "/global/api/Statistics/getPlayersStatisticsPro";
const DEPOSIT_URL = ORIGIN + "/global/api/Player/depositToPlayer";
const WITHDRAW_URL = ORIGIN + "/global/api/Player/withdrawFromPlayer";
const GET_BALANCE_URL = ORIGIN + "/global/api/Player/getPlayerBalanceById";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function cookiesToHeaderString(cookies) {
  // cookies: array of {name, value, domain, ...}
  if (!cookies || !cookies.length) return "";
  return cookies.map(c => `${c.name}=${c.value}`).join("; ");
}

async function ensureLogged() {
  let cookies = await loadCookies();
  if (!cookies || cookies.length === 0) {
    cookies = await loginViaPuppeteer(false); // during dev: show browser
  }
  return cookies;
}

// helper for requests with auto-retry login
async function requestWithAuth(url, body) {
  let cookies = await ensureLogged();
  let cookieHeader = await cookiesToHeaderString(cookies);
  try {
    const res = await axios.post(url, body, {
      headers: {
        "User-Agent": USER_AGENT,
        "Origin": ORIGIN,
        "Referer": ORIGIN + "/dashboard",
        "Content-Type": "application/json",
        "Cookie": cookieHeader
      },
      timeout: 20000
    });
    const data = res.data;
    // if response implies session invalid, force re-login
    if (!data || data.result === false) {
      // re-login and retry once
      cookies = await loginViaPuppeteer(true);
      cookieHeader = await cookiesToHeaderString(cookies);
      const res2 = await axios.post(url, body, {
        headers: {
          "User-Agent": USER_AGENT,
          "Origin": ORIGIN,
          "Referer": ORIGIN + "/dashboard",
          "Content-Type": "application/json",
          "Cookie": cookieHeader
        },
        timeout: 20000
      });
      return res2.data;
    }
    return data;
  } catch (err) {
    // if axios error, try re-login once
    try {
      cookies = await loginViaPuppeteer(true);
      cookieHeader = await cookiesToHeaderString(cookies);
      const res2 = await axios.post(url, body, {
        headers: {
          "User-Agent": USER_AGENT,
          "Origin": ORIGIN,
          "Referer": ORIGIN + "/dashboard",
          "Content-Type": "application/json",
          "Cookie": cookieHeader
        },
        timeout: 20000
      });
      return res2.data;
    } catch (e2) {
      throw e2;
    }
  }
}

// generate random login/pwd
function generateRandomCredentials() {
  const login = "u" + Math.random().toString(36).substring(2, 9);
  const pwd = Math.random().toString(36).substring(2, 12);
  return { login, pwd };
}

// create player with provided login/pwd
async function createPlayerWithCredentials(login, pwd, parentId = process.env.PARENT_ID) {
  const payload = { player: { email: `${login}@tsa.com`, password: pwd, parentId, login } };
  const data = await requestWithAuth(CREATE_URL, payload);
  // after create, try to fetch playerId
  const playerId = await getPlayerIdByLogin(login);
  return { raw: data, playerId, email: `${login}@tsa.com` };
}

async function getPlayerIdByLogin(login) {
  const body = { page: 1, pageSize: 100, filter: { login } };
  const data = await requestWithAuth(STATISTICS_URL, body);
  const records = data?.result?.records || [];
  for (const r of records) {
    if (r.username === login || r.login === login) return r.playerId || r.playerIdStr || r.id;
  }
  return null;
}

async function depositToPlayer(playerId, amount) {
  const payload = { amount, comment: null, playerId, currencyCode: "NSP", currency: "NSP", moneyStatus: 5 };
  const data = await requestWithAuth(DEPOSIT_URL, payload);
  return data;
}

async function withdrawFromPlayer(playerId, amount) {
  const payload = { amount, comment: null, playerId, currencyCode: "NSP", currency: "NSP", moneyStatus: 5 };
  const data = await requestWithAuth(WITHDRAW_URL, payload);
  return data;
}

async function getPlayerBalance(playerId) {
  const payload = { playerId: String(playerId) };
  const data = await requestWithAuth(GET_BALANCE_URL, payload);
  // extract balance from data.result
  try {
    const results = data.result;
    const balance = Array.isArray(results) && results.length ? (results[0].balance || 0) : (results.balance || 0);
    return { ok: true, balance, raw: data };
  } catch (e) {
    return { ok: false, balance: 0, raw: data };
  }
}

async function checkPlayerExists(login) {
  const pid = await getPlayerIdByLogin(login);
  return pid !== null;
}

module.exports = {
  createPlayerWithCredentials,
  getPlayerIdByLogin,
  depositToPlayer,
  withdrawFromPlayer,
  getPlayerBalance,
  checkPlayerExists,
  ensureLogged
};
