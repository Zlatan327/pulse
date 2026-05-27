import chromeCookies from 'chrome-cookies-secure';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

async function extractCookies() {
  console.log('🔍 Connecting to your main Chrome browser to extract X cookies...');
  
  try {
    const cookies = await new Promise<any>((resolve, reject) => {
      chromeCookies.getCookies('https://x.com', 'puppeteer', function(err: any, cookies: any) {
        if (err) {
           return reject(err);
        }
        resolve(cookies);
      });
    });

    const authToken = cookies.find((c: any) => c.name === 'auth_token')?.value;
    const ct0 = cookies.find((c: any) => c.name === 'ct0')?.value;

    if (!authToken || !ct0) {
      console.log('❌ Could not find auth_token or ct0. Are you sure you are logged into x.com on your main Chrome browser?');
      return;
    }

    console.log('✅ Cookies extracted successfully from your main Chrome browser!');
    
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
    console.error('❌ Failed to extract cookies:', err.message);
  }
}

extractCookies();
