import puppeteer, { Browser, Page } from 'puppeteer';
import { config } from '../core/index.js';

export interface Tweet {
  id: string;
  username: string;
  text: string;
  userId?: string;
  conversationId?: string;
  inReplyToStatusId?: string;
  timeParsed?: Date;
}

export class PuppeteerScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;

  async init() {
    if (this.isInitialized) return;

    this.browser = await puppeteer.launch({
      headless: true,
      channel: 'chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications', '--proxy-server="direct://"', '--proxy-bypass-list=*']
    });

    this.page = await this.browser.newPage();
    
    await this.page.setViewport({ width: 1280, height: 800 });

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

    await this.page.setCookie(...cookies);
    this.isInitialized = true;
    console.log('✅ Puppeteer browser initialized with provided cookies.');
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
      await this.page!.goto('https://twitter.com/home', { waitUntil: 'networkidle2' });
      // If we see the login screen or it redirects to /i/flow/login, we are not logged in.
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

    // Intercept GraphQL SearchTimeline responses
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

                // Handle regular tweets and retweeted tweets
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
        } catch (e) {
          // ignore
        }
      }
    };

    this.page!.on('response', responseHandler);

    await this.page!.goto(url, { waitUntil: 'networkidle2' });

    // Wait for the interceptor to catch the API call (or timeout)
    await new Promise<void>((resolve) => {
      resolveSearch = resolve;
      setTimeout(resolve, 10000); // 10s timeout
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
        } catch (e) {
          // ignore
        }
      }
    };

    this.page!.on('response', responseHandler);
    await this.page!.goto(url, { waitUntil: 'networkidle2' });

    await new Promise<void>((resolve) => {
      resolveTweet = resolve;
      setTimeout(resolve, 8000);
    });

    this.page!.off('response', responseHandler);
    return foundTweet;
  }

  async sendTweet(text: string, replyToId?: string): Promise<void> {
    await this.init();
    console.log(`💬 Sending tweet: "${text}" (replyTo: ${replyToId})`);
    
    try {
      if (replyToId) {
        await this.page!.goto(`https://twitter.com/intent/tweet?in_reply_to=${replyToId}&text=${encodeURIComponent(text)}`, { waitUntil: 'networkidle2' });
      } else {
        await this.page!.goto(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, { waitUntil: 'networkidle2' });
      }

      // Wait for the "Post" or "Reply" button to appear and click it
      await this.page!.waitForSelector('[data-testid="tweetButton"]', { timeout: 10000 });
      await this.page!.click('[data-testid="tweetButton"]');
      
      // Wait for sending to finish
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      console.error('❌ Failed to send tweet via Puppeteer:', e);
    }
  }

  async getAudioSpaceById(spaceId: string) {
    throw new Error('Spaces downloading is currently disabled in the Puppeteer workaround.');
  }

  async getAudioSpaceStreamStatus(mediaKey: string) {
    throw new Error('Spaces downloading is currently disabled in the Puppeteer workaround.');
  }

  async getCookies(): Promise<any[]> {
    return [];
  }

  async setCookies(cookies: any[]): Promise<void> {
    // PuppeteerScraper reads cookies directly from config in init(), but we can also set them here
    console.log('✅ Cookies registered (handled internally by PuppeteerScraper)');
  }

  async login(username?: string, password?: string, email?: string): Promise<void> {
    throw new Error('Username/password login is not supported in the Puppeteer workaround. Please provide valid cookies in .env.');
  }
}
