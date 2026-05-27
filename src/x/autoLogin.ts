import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function autoLogin() {
  const username = process.env.X_USERNAME;
  const password = process.env.X_PASSWORD;
  const email = process.env.X_EMAIL;

  if (!username || !password) {
    console.error('❌ Missing X_USERNAME or X_PASSWORD in .env');
    process.exit(1);
  }

  console.log(`🤖 Starting Puppeteer to automate login for ${username}...`);
  
  // Launch in non-headless mode so user can see and intervene if needed
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set a realistic user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    console.log('🌐 Opened X login page. Please log in manually in the browser window.');
    await page.goto('https://twitter.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 0 });

    console.log('⏳ Waiting for you to complete the login process...');
    console.log('👀 The script will automatically detect when you reach the home page.');

    // Wait until the URL changes to home
    await page.waitForFunction(() => window.location.href.includes('twitter.com/home') || window.location.href.includes('x.com/home'), { timeout: 300000 }); // 5 minute timeout

    console.log('✅ Login detected! Extracting cookies...');
    const cookies = await page.cookies();
    
    const authToken = cookies.find(c => c.name === 'auth_token')?.value;
    const ct0 = cookies.find(c => c.name === 'ct0')?.value;

    if (!authToken || !ct0) {
      throw new Error('auth_token or ct0 cookie not found. Login might have failed silently.');
    }

    console.log('🍪 Cookies extracted successfully!');
    
    // Update .env file
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Replace existing or append
    if (envContent.includes('X_COOKIES_AUTH_TOKEN=')) {
      envContent = envContent.replace(/X_COOKIES_AUTH_TOKEN=.*/, `X_COOKIES_AUTH_TOKEN=${authToken}`);
    } else {
      envContent += `\nX_COOKIES_AUTH_TOKEN=${authToken}`;
    }

    if (envContent.includes('X_COOKIES_CT0=')) {
      envContent = envContent.replace(/X_COOKIES_CT0=.*/, `X_COOKIES_CT0=${ct0}`);
    } else {
      envContent += `\nX_COOKIES_CT0=${ct0}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log('💾 Cookies securely saved to .env file!');

  } catch (err: any) {
    console.error('❌ Automation failed:', err.message);
  } finally {
    await browser.close();
  }
}

autoLogin();
