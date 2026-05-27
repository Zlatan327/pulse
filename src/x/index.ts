import { PlaywrightScraper as Scraper } from './playwrightScraper.js';
import {
  config,
  validatePlatform,
  initDatabase,
  summarizeMessages,
  generateSpeech,
  convertToOggOpus,
  cleanupAudioFile,
  cleanupTempFile,
} from '../core/index.js';
import type { PlatformMessage, CatchupMode } from '../core/types.js';
import fs from 'fs';
import path from 'path';
import { startXIntelligence } from './intelligence.js';
import { downloadSpaceAudio } from './spaceHelper.js';
import { transcribeAudio } from '../core/transcriber.js';

/** Start the X (Twitter) adapter */
export async function startX(): Promise<Scraper> {
  validatePlatform('x');
  initDatabase();

  const scraper = new Scraper();
  
  // Try to load cookies if they exist
  const cookiesPath = path.join(config.dataDir, 'x_cookies.json');
  let loggedIn = false;

  if (fs.existsSync(cookiesPath)) {
    try {
      const cookiesStr = fs.readFileSync(cookiesPath, 'utf8');
      const cookies = JSON.parse(cookiesStr);
      await scraper.setCookies(cookies);
      loggedIn = await scraper.isLoggedIn();
    } catch (e) {
      console.warn('⚠️ Could not load saved X cookies, will re-login');
    }
  }

  if (!loggedIn) {
    if (config.x.cookies.authToken && config.x.cookies.ct0) {
      console.log('🍪 Logging into X using provided cookies from .env...');
      await scraper.setCookies([
        `auth_token=${config.x.cookies.authToken}; Domain=.twitter.com; Path=/; Secure; HttpOnly`,
        `ct0=${config.x.cookies.ct0}; Domain=.twitter.com; Path=/; Secure; HttpOnly`
      ]);
      
      // 🔥 BYPASS: X disabled verify_credentials.json, so isLoggedIn() always returns false.
      // If we have cookies, we assume they are valid and skip calling .login() to avoid the guest token error (code 34).
      loggedIn = true;
      console.log('✅ Logged into X using provided .env cookies! (Bypassed verify_credentials check)');
    }
    
    if (!loggedIn) {
      console.log('⏳ Logging into X (Twitter) using username/password...');
      try {
        await scraper.login();
        const newCookies = await scraper.getCookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(newCookies));
        console.log('✅ Logged into X and saved session cookies!');
      } catch (e: any) {
        console.error('❌ Failed to log into X:', e.message);
        console.error('💡 Tip: Set X_COOKIES_AUTH_TOKEN and X_COOKIES_CT0 in .env to use cookie-based auth.');
        throw e;
      }
    }
  } else {
    console.log('✅ Logged into X using saved cookies!');
  }

  console.log('━'.repeat(50));
  console.log('⚡ PULSE — X (Twitter) Adapter');
  console.log(`✅ Listening for mentions of @${config.x.username}`);
  console.log('━'.repeat(50));

  // State to avoid duplicate processing
  const processedMentionsFile = path.join(config.dataDir, 'x_processed.json');
  let processedMentions = new Set<string>();
  if (fs.existsSync(processedMentionsFile)) {
    try {
      processedMentions = new Set(JSON.parse(fs.readFileSync(processedMentionsFile, 'utf8')));
    } catch (e) {}
  }

  const saveProcessed = () => {
    fs.writeFileSync(processedMentionsFile, JSON.stringify(Array.from(processedMentions)));
  };

  // Polling loop
  let isPolling = false;
  
  setInterval(async () => {
    if (isPolling) {
      console.log('⏳ Skipping X poll interval (previous execution still running)...');
      return;
    }
    isPolling = true;

    try {
      // 1. Fetch recent mentions
      // Using search as it's often more reliable in agent-twitter-client for finding mentions of a specific user
      const query = `@${config.x.username}`;
      const searchResults = scraper.searchTweets(query, 10);
      
      const mentions = [];
      for await (const tweet of searchResults) {
        mentions.push(tweet);
        // We only need the latest few, so break early
        if (mentions.length >= 10) break;
      }

      for (const tweet of mentions) {
        if (!tweet.id || processedMentions.has(tweet.id)) continue;
        
        // Mark as processed immediately so we don't double-process if it fails
        processedMentions.add(tweet.id);
        saveProcessed();

        // 2. Check if the tweet is asking for a summary
        const text = tweet.text?.toLowerCase() || '';
        if (text.includes('pulze this')) {
          console.log(`\n🔔 Processing mention from @${tweet.username}: ${tweet.text}`);
          
          if (!tweet.conversationId) {
            console.log('⚠️ Tweet does not belong to a thread/conversation.');
            continue;
          }

          // Convert to PlatformMessage format for the summarizer
          let messages: PlatformMessage[] = [];
          
          // --- CHECK FOR SPACE URL ---
          let spaceId: string | null = null;
          const spaceRegex = /(?:x\.com|twitter\.com)\/i\/spaces\/([a-zA-Z0-9]+)/i;
          const spaceMatch = tweet.text?.match(spaceRegex);
          
          if (spaceMatch) {
            spaceId = spaceMatch[1];
          } else if (tweet.inReplyToStatusId) {
             // Check parent tweet
             try {
               const parent = await scraper.getTweet(tweet.inReplyToStatusId);
               const parentMatch = parent?.text?.match(spaceRegex);
               if (parentMatch) spaceId = parentMatch[1];
             } catch(e) {}
          }

          if (spaceId) {
             console.log(`🎙️ Space detected! ID: ${spaceId}`);
             try {
               const audioPath = await downloadSpaceAudio(spaceId, scraper);
               console.log(`🎤 Transcribing Space audio...`);
               const transcript = await transcribeAudio(audioPath);
               messages.push({
                  id: String(tweet.id),
                  platform: 'x',
                  chatId: `space_${spaceId}`,
                  userId: String(tweet.userId),
                  username: 'X Space Audio',
                  text: `Transcript of X Space: ${transcript.text}`,
                  messageType: 'text',
                  filePath: null,
                  timestamp: new Date()
               });
               cleanupTempFile(audioPath);
             } catch (e: any) {
               console.error('❌ Failed to process Space:', e.message);
               // Continue as thread summary fallback if space fails?
               // Let's just return early or fall back. We will fall back to empty messages if it fails.
             }
          }

          // --- FETCH THREAD (IF NO SPACE) ---
          if (messages.length === 0 && tweet.conversationId) {
            console.log(`🔍 Fetching thread: ${tweet.conversationId}`);
            const threadQuery = `conversation_id:${tweet.conversationId}`;
            const threadResults = scraper.searchTweets(threadQuery, 100);
            
            const threadTweets = [];
            for await (const t of threadResults) {
              threadTweets.push(t);
              if (threadTweets.length >= 100) break;
            }

            // Sort chronologically (oldest first)
            threadTweets.sort((a, b) => (a.timeParsed?.getTime() || 0) - (b.timeParsed?.getTime() || 0));

            messages = threadTweets.map(t => ({
              id: String(t.id),
              platform: 'x',
              chatId: String(t.conversationId),
              userId: String(t.userId),
              username: t.username || 'Unknown',
              text: t.text || null,
              messageType: 'text',
              filePath: null,
              timestamp: t.timeParsed || new Date(),
            }));
          }

          if (messages.length === 0) {
            console.log('⚠️ Could not fetch thread tweets or process space.');
            continue;
          }

          // 4. Summarize (fetch user settings first if possible)
          console.log(`🧠 Summarizing ${messages.length} tweets...`);
          
          let mode: CatchupMode = 'standard';
          let masterUserId: string | null = null;
          let deliveryPreference: string = 'x';
          
          // Try to get user settings if they linked their X account
          try {
             const { default: Database } = await import('better-sqlite3');
             const path = await import('path');
             const dbPath = path.resolve(config.dataDir, 'pulse.db');
             const db = new Database(dbPath);
             
             const row = db.prepare(`
               SELECT u.id as userId, s.voice_style as voiceStyle, s.delivery_preference as deliveryPref
               FROM accounts a 
               JOIN users u ON a.userId = u.id 
               LEFT JOIN user_settings s ON u.id = s.user_id 
               WHERE a.provider = 'twitter' AND a.providerAccountId = ?
             `).get(String(tweet.userId)) as any;
             
             if (row) {
               masterUserId = row.userId;
               deliveryPreference = row.deliveryPref || 'x';
               if (row.voiceStyle) {
                 if (row.voiceStyle.includes('Marcus')) mode = 'fun';
                 else if (row.voiceStyle.includes('RoastMaster')) mode = 'roast';
                 else if (row.voiceStyle.includes('Storyteller')) mode = 'story';
               }
             }
             db.close();
          } catch(e) {}

          const summary = await summarizeMessages(messages, mode, tweet.username);

          // 5. Generate Audio
          console.log('🔊 Generating audio...');
          const audio = await generateSpeech(summary.text);
          
          // Log summary to DB
          if (masterUserId) {
             try {
                const { default: Database } = await import('better-sqlite3');
                const path = await import('path');
                const crypto = await import('crypto');
                const dbPath = path.resolve(config.dataDir, 'pulse.db');
                const db = new Database(dbPath);
                db.prepare(`
                  INSERT INTO audio_summaries (id, user_id, platform, title, duration_seconds)
                  VALUES (?, ?, ?, ?, ?)
                `).run(crypto.randomUUID(), masterUserId, 'x', summary.title || 'X Thread', Math.round(audio.durationMs / 1000));
                db.close();
             } catch(e) {}
          }

          // 6. Smart Delivery Routing based on user preference
          console.log(`📤 Delivery preference: ${deliveryPreference}`);
          let delivered = false;

          if (deliveryPreference === 'discord') {
            // --- Discord DM ---
            console.log(`✉️ Routing audio to Discord DM for @${tweet.username}...`);
            try {
              const { default: Database } = await import('better-sqlite3');
              const pathMod = await import('path');
              const dbPath = pathMod.resolve(config.dataDir, 'pulse.db');
              const db = new Database(dbPath);

              const linkedDiscord = db.prepare(`
                SELECT d.providerAccountId AS discordId 
                FROM accounts d 
                JOIN accounts x ON d.userId = x.userId 
                WHERE x.provider = 'twitter' 
                  AND x.providerAccountId = ? 
                  AND d.provider = 'discord'
              `).get(String(tweet.userId)) as { discordId: string } | undefined;
              db.close();

              if (linkedDiscord?.discordId) {
                console.log(`✅ Linked Discord account found (ID: ${linkedDiscord.discordId})`);
                const { client } = await import('../discord/index.js');
                
                if (client) {
                  const user = await client.users.fetch(linkedDiscord.discordId);
                  const { AttachmentBuilder } = await import('discord.js');
                  const attachment = new AttachmentBuilder(audio.filePath, { name: 'pulse_summary.mp3' });
                  
                  await user.send({
                    content: `🎧 **Pulse Audio Summary** from X\n\n> Thread by @${tweet.username}\n> ${summary.title || 'Thread Summary'}\n\n${summary.text}`,
                    files: [attachment],
                  });
                  delivered = true;
                  console.log('🚀 Discord DM sent successfully!');
                } else {
                  console.log('⚠️ Discord bot is not running.');
                }
              } else {
                console.log('⚠️ No linked Discord account found, falling back to X reply.');
              }
            } catch (e: any) {
              console.error('⚠️ Discord DM failed:', e.message);
            }
          } else if (deliveryPreference === 'telegram') {
            // --- Telegram DM ---
            console.log(`✉️ Routing audio to Telegram DM for @${tweet.username}...`);
            try {
              const { default: Database } = await import('better-sqlite3');
              const pathMod = await import('path');
              const dbPath = pathMod.resolve(config.dataDir, 'pulse.db');
              const db = new Database(dbPath);

              const linkedTelegram = db.prepare(`
                SELECT t.providerAccountId AS telegramId 
                FROM accounts t 
                JOIN accounts x ON t.userId = x.userId 
                WHERE x.provider = 'twitter' 
                  AND x.providerAccountId = ? 
                  AND t.provider = 'telegram'
              `).get(String(tweet.userId)) as { telegramId: string } | undefined;
              db.close();

              if (linkedTelegram?.telegramId) {
                console.log(`✅ Linked Telegram account found (ID: ${linkedTelegram.telegramId})`);
                const { bot } = await import('../telegram/index.js');
                const { InputFile } = await import('grammy');
                
                if (bot) {
                  await bot.api.sendAudio(
                    linkedTelegram.telegramId, 
                    new InputFile(audio.filePath),
                    { caption: `🔊 Here is your Pulse audio summary from X (@${tweet.username}):\n\n${summary.text}` }
                  );
                  delivered = true;
                  console.log('🚀 Telegram DM sent successfully!');
                } else {
                  console.log('⚠️ Telegram bot is not running.');
                }
              } else {
                console.log('⚠️ No linked Telegram account found, falling back to X reply.');
              }
            } catch (e: any) {
              console.error('⚠️ Telegram DM failed:', e.message);
            }
          }

          // --- Public X Reply (default, or fallback if DM delivery failed) ---
          console.log(`💬 Replying publicly to tweet ${tweet.id}...`);
          try {
             if (delivered) {
                await scraper.sendTweet(
                  `@${tweet.username} I've summarized this thread for you! Check your ${deliveryPreference === 'discord' ? 'Discord' : 'Telegram'} DMs for the audio catchup 🎧`, 
                  tweet.id
                );
             } else {
                // Either preference is 'x' or DM failed — reply with the text summary
                const truncatedSummary = summary.text.length > 240 
                  ? summary.text.substring(0, 237) + '...' 
                  : summary.text;
                await scraper.sendTweet(
                  `@${tweet.username} Here's your thread summary:\n\n${truncatedSummary}`, 
                  tweet.id
                );
             }
          } catch(e: any) {
             console.error('⚠️ Could not send public reply:', e.message);
          }

          cleanupAudioFile(audio.filePath);
        }
      }
    } catch (e: any) {
      console.error('❌ Error in X polling loop:', e.message);
    } finally {
      isPolling = false;
    }
  }, 60000); // Poll every 60 seconds

  // Start the X Intelligence Scheduler
  startXIntelligence(scraper);

  return scraper;
}

// If run directly
const isDirectRun = process.argv[1]?.includes('x/index') || process.argv[1]?.includes('x\\index');
if (isDirectRun) {
  startX().catch((error) => {
    console.error('❌ Failed to start X adapter:', error);
    process.exit(1);
  });
}
