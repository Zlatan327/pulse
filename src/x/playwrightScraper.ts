import { chromium, Browser, Page } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from '../core/config.js';
import type { Tweet } from 'agent-twitter-client';

// Add stealth plugin
chromium.use(stealthPlugin());

export class PlaywrightScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;

  async init() {
    if (this.isInitialized) return;

    console.log('🚀 Initializing Playwright Stealth Scraper...');
    
    // Pass proxy arguments to bypass VPN issues
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-notifications',
        '--proxy-server=direct://',
        '--proxy-bypass-list=*'
      ]
    });

    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Set cookies
    const cookies = [
      {
        name: 'auth_token',
        value: config.x.cookies.authToken,
        domain: '.twitter.com',
        path: '/',
        secure: true,
        httpOnly: true
      },
      {
        name: 'ct0',
        value: config.x.cookies.ct0,
        domain: '.twitter.com',
        path: '/',
        secure: true,
        httpOnly: true
      }
    ];

    await context.addCookies(cookies);
    this.page = await context.newPage();
    
    this.isInitialized = true;
    console.log('🍪 Playwright browser initialized with stealth and cookies.');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.isInitialized = false;
    }
  }

  async isLoggedIn(): Promise<boolean> {
    await this.init();
    try {
      await this.page!.goto('https://twitter.com/home', { waitUntil: 'networkidle' });
      const url = this.page!.url();
      if (url.includes('login') || url.includes('logout')) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  async *searchTweets(query: string, max: number): AsyncGenerator<Tweet, void, unknown> {
    await this.init();
    
    const encodedQuery = encodeURIComponent(query);
    const url = `https://twitter.com/search?q=${encodedQuery}&src=typed_query&f=live`;

    const tweets: Tweet[] = [];
    let resolveSearch: (() => void) | null = null;

    const responseHandler = async (response: any) => {
      const reqUrl = response.url();
      if (reqUrl.includes('SearchTimeline') && response.request().method() === 'GET') {
        try {
          const json = await response.json();
          const instructions = json.data?.search_by_raw_query?.search_timeline?.timeline?.instructions || [];
          
          for (const instruction of instructions) {
            if (instruction.type === 'TimelineAddEntries') {
              for (const entry of instruction.entries || []) {
                const tweetResult = entry.content?.itemContent?.tweet_results?.result;
                if (!tweetResult) continue;

                const legacy = tweetResult.legacy || tweetResult.tweet?.legacy;
                const core = tweetResult.core || tweetResult.tweet?.core;
                
                if (legacy && core) {
                  tweets.push({
                    id: legacy.id_str,
                    text: legacy.full_text,
                    username: core.user_results?.result?.legacy?.screen_name,
                    userId: legacy.user_id_str,
                    conversationId: legacy.conversation_id_str,
                    inReplyToStatusId: legacy.in_reply_to_status_id_str,
                    timeParsed: new Date(legacy.created_at)
                  });
                }
              }
            }
          }
          if (resolveSearch) resolveSearch();
        } catch (e) {}
      }
    };

    this.page!.on('response', responseHandler);

    await this.page!.goto(url, { waitUntil: 'domcontentloaded' });

    await new Promise<void>((resolve) => {
      resolveSearch = resolve;
      setTimeout(resolve, 15000); // 15s timeout
    });

    this.page!.off('response', responseHandler);

    let count = 0;
    for (const tweet of tweets) {
      if (count >= max) break;
      yield tweet;
      count++;
    }
  }

  async getTweet(id: string): Promise<Tweet | null> {
    await this.init();
    
    const url = `https://twitter.com/i/web/status/${id}`;
    let foundTweet: Tweet | null = null;
    let resolveTweet: (() => void) | null = null;

    const responseHandler = async (response: any) => {
      const reqUrl = response.url();
      if (reqUrl.includes('TweetDetail') && response.request().method() === 'GET') {
        try {
          const json = await response.json();
          const instructions = json.data?.threaded_conversation_with_injections_v2?.instructions || [];
          
          for (const instruction of instructions) {
            if (instruction.type === 'TimelineAddEntries') {
              for (const entry of instruction.entries || []) {
                const tweetResult = entry.content?.itemContent?.tweet_results?.result;
                if (!tweetResult) continue;

                const legacy = tweetResult.legacy || tweetResult.tweet?.legacy;
                const core = tweetResult.core || tweetResult.tweet?.core;
                
                if (legacy && core && legacy.id_str === id) {
                  foundTweet = {
                    id: legacy.id_str,
                    text: legacy.full_text,
                    username: core.user_results?.result?.legacy?.screen_name,
                    userId: legacy.user_id_str,
                    conversationId: legacy.conversation_id_str,
                    inReplyToStatusId: legacy.in_reply_to_status_id_str,
                    timeParsed: new Date(legacy.created_at)
                  };
                }
              }
            }
          }
          if (resolveTweet) resolveTweet();
        } catch (e) {}
      }
    };

    this.page!.on('response', responseHandler);
    await this.page!.goto(url, { waitUntil: 'domcontentloaded' });

    await new Promise<void>((resolve) => {
      resolveTweet = resolve;
      setTimeout(resolve, 10000);
    });

    this.page!.off('response', responseHandler);
    return foundTweet;
  }

  async sendTweet(text: string, replyToId?: string): Promise<void> {
    await this.init();
    console.log(`🐦 Sending tweet via Playwright: "${text}" (replyTo: ${replyToId})`);
    
    try {
      if (replyToId) {
        await this.page!.goto(`https://twitter.com/intent/tweet?in_reply_to=${replyToId}&text=${encodeURIComponent(text)}`, { waitUntil: 'domcontentloaded' });
      } else {
        await this.page!.goto(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, { waitUntil: 'domcontentloaded' });
      }

      await this.page!.waitForSelector('[data-testid="tweetButton"]', { state: 'visible', timeout: 15000 });
      await this.page!.click('[data-testid="tweetButton"]');
      
      await this.page!.waitForTimeout(3000);
    } catch (e) {
      console.error('❌ Failed to send tweet via Playwright:', e);
    }
  }

  async getCookies(): Promise<any[]> {
    return [];
  }

  async setCookies(cookies: any[]): Promise<void> {
    console.log('✅ Cookies registered (handled internally by PlaywrightScraper)');
  }

  async login(): Promise<void> {
    throw new Error('Username/password login is disabled. Please provide valid cookies in .env.');
  }
}
