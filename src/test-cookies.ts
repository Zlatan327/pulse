import { Scraper } from 'twitter-agent';
import dotenv from 'dotenv';
dotenv.config();

async function testCookies() {
  const scraper = new Scraper();
  
  const auth = process.env.X_COOKIES_AUTH_TOKEN;
  const ct0 = process.env.X_COOKIES_CT0;

  await scraper.setCookies([
    `auth_token=${auth}; Domain=.twitter.com; Path=/; Secure; HttpOnly`,
    `ct0=${ct0}; Domain=.twitter.com; Path=/; Secure; HttpOnly`
  ]);
  
  // Monkeypatch isLoggedIn to bypass verify_credentials
  scraper.isLoggedIn = async () => true;
  
  console.log('Testing searchTweets...');
  try {
    const iterator = scraper.searchTweets('@elonmusk', 2);
    for await (const tweet of iterator) {
      console.log('Tweet:', tweet.text);
    }
  } catch (e) {
    console.error('Search failed:', e);
  }
}

testCookies().catch(console.error);
