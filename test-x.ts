import { Scraper } from 'twitter-agent';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function test() {
  const scraper = new Scraper();
  try {
    if (process.env.X_COOKIES_AUTH_TOKEN && process.env.X_COOKIES_CT0) {
      console.log('Logging in using cookies...');
      await scraper.setCookies([
        `auth_token=${process.env.X_COOKIES_AUTH_TOKEN}`,
        `ct0=${process.env.X_COOKIES_CT0}`
      ]);
      const loggedIn = await scraper.isLoggedIn();
      console.log('Is logged in?', loggedIn);
    } else {
      console.log('Logging in...');
      await scraper.login(
        process.env.X_USERNAME!,
        process.env.X_PASSWORD!,
        process.env.X_EMAIL!
      );
    }
    console.log('Login successful!');
    
    // Test a basic search
    const tweets = scraper.searchTweets('hello', 1);
    for await (const t of tweets) {
      console.log('Got tweet:', t.text);
    }
  } catch (e) {
    console.error('Login failed:', e);
  }
}

test();
