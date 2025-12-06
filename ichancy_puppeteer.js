// ichancy_puppeteer.js
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs-extra");
const path = require("path");
require("dotenv").config();

puppeteer.use(StealthPlugin());

const AGENT_USERNAME = process.env.AGENT_USERNAME;
const AGENT_PASSWORD = process.env.AGENT_PASSWORD;
const COOKIE_FILE = path.join(__dirname, "cookies.json");
const ORIGIN = "https://agents.ichancy.com";
const SIGNIN_PAGE = `${ORIGIN}/dashboard`; // adjust if login page differs

async function saveCookies(cookies) {
  await fs.writeJson(COOKIE_FILE, cookies, { spaces: 2 });
}

async function loadCookies() {
  if (await fs.pathExists(COOKIE_FILE)) {
    return await fs.readJson(COOKIE_FILE);
  }
  return null;
}

/**
 * Launch browser, go to login, authenticate, save cookies.
 * Returns cookies array.
 */
async function loginViaPuppeteer(headless = true) {
  // headless: false during development can help debugging
  const browser = await puppeteer.launch({
    headless: headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
  );

  // go to dashboard (or signin) to let CF/Turnstile run
  await page.goto(SIGNIN_PAGE, { waitUntil: "networkidle2", timeout: 60000 });

  // Wait for login form fields - adjust selectors if the page differs
  // Try common selectors; if site uses SPA change accordingly
  try {
    // Example: find username & password inputs
    await page.waitForSelector('input[name="UserName"], input[name="username"], input#username', { timeout: 15000 });
  } catch (e) {
    // fallback: continue — some dashboards render form later
  }

  // Try multiple selectors to fill credentials
  const setInput = async () => {
    const usernameSelectors = ['input[name="UserName"]','input[name="username"]','input#username','input[type="email"]'];
    const passwordSelectors = ['input[name="Password"]','input[name="password"]','input#password','input[type="password"]'];
    let uSel = null, pSel = null;
    for (const s of usernameSelectors) {
      const el = await page.$(s);
      if (el) { uSel = s; break; }
    }
    for (const s of passwordSelectors) {
      const el = await page.$(s);
      if (el) { pSel = s; break; }
    }
    if (!uSel || !pSel) {
      // try generic form inputs
      const inputs = await page.$$('input');
      if (inputs.length >= 2) {
        uSel = await page.evaluate(el => el.getAttribute('name') || el.getAttribute('id') || null, inputs[0]);
        pSel = await page.evaluate(el => el.getAttribute('name') || el.getAttribute('id') || null, inputs[1]);
      }
    }

    if (uSel && pSel) {
      await page.type(uSel, AGENT_USERNAME, { delay: 50 }).catch(()=>{});
      await page.type(pSel, AGENT_PASSWORD, { delay: 50 }).catch(()=>{});
      // submit: try pressing Enter on password
      await page.keyboard.press('Enter');
    } else {
      // If selectors not found, try direct JS to fill any input placeholders
      await page.evaluate((u, p) => {
        const inps = document.querySelectorAll('input');
        if (inps.length >= 2) {
          inps[0].value = u;
          inps[1].value = p;
          const form = inps[1].closest('form');
          if (form) form.submit();
        }
      }, AGENT_USERNAME, AGENT_PASSWORD);
    }
  };

  await setInput();

  // Wait for navigation after login
  try {
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
  } catch (e) {
    // navigation may not happen; continue
  }

  // Wait some seconds to let Cloudflare tokens settle
  await page.waitForTimeout(4000);

  // save cookies
  const cookies = await page.cookies();
  await saveCookies(cookies);
  await browser.close();
  return cookies;
}

module.exports = {
  loginViaPuppeteer,
  loadCookies,
  saveCookies,
  COOKIE_FILE
};
