import { Scraper, SearchMode } from 'agent-twitter-client';
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
import type { PlatformMessage } from '../core/types.js';
import fs from 'fs';
import path from 'path';

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
    console.log('⏳ Logging into X (Twitter)...');
    try {
      await scraper.login(config.x.username, config.x.password, config.x.email);
      const newCookies = await scraper.getCookies();
      fs.writeFileSync(cookiesPath, JSON.stringify(newCookies));
      console.log('✅ Logged into X and saved session cookies!');
    } catch (e: any) {
      console.error('❌ Failed to log into X. Check your credentials.', e.message);
      throw e;
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
  setInterval(async () => {
    try {
      // 1. Fetch recent mentions
      // Using search as it's often more reliable in agent-twitter-client for finding mentions of a specific user
      const query = `@${config.x.username}`;
      const searchResults = scraper.searchTweets(query, 10, SearchMode.Latest);
      
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
        if (text.includes('summary') || text.includes('catchup') || text.includes('catch up') || text.includes('pulse')) {
          console.log(`\n🔔 Processing mention from @${tweet.username}: ${tweet.text}`);
          
          if (!tweet.conversationId) {
            console.log('⚠️ Tweet does not belong to a thread/conversation.');
            continue;
          }

          // 3. Fetch the full thread
          console.log(`🔍 Fetching thread: ${tweet.conversationId}`);
          const threadQuery = `conversation_id:${tweet.conversationId}`;
          const threadResults = scraper.searchTweets(threadQuery, 50, SearchMode.Latest);
          
          const threadTweets = [];
          for await (const t of threadResults) {
            threadTweets.push(t);
            if (threadTweets.length >= 50) break;
          }

          // Sort chronologically (oldest first)
          threadTweets.sort((a, b) => (a.timeParsed?.getTime() || 0) - (b.timeParsed?.getTime() || 0));

          if (threadTweets.length === 0) {
            console.log('⚠️ Could not fetch thread tweets.');
            continue;
          }

          // Convert to PlatformMessage format for the summarizer
          const messages: PlatformMessage[] = threadTweets.map(t => ({
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

          // 4. Summarize (fetch user settings first if possible)
          console.log(`🧠 Summarizing ${messages.length} tweets...`);
          
          let mode: CatchupMode = 'standard';
          let masterUserId: string | null = null;
          
          // Try to get user settings if they linked their X account
          try {
             const { default: Database } = await import('better-sqlite3');
             const path = await import('path');
             const dbPath = path.resolve(config.dataDir, 'pulse.db');
             const db = new Database(dbPath);
             
             const row = db.prepare(`
               SELECT u.id as userId, s.voice_style as voiceStyle 
               FROM accounts a 
               JOIN users u ON a.userId = u.id 
               LEFT JOIN user_settings s ON u.id = s.user_id 
               WHERE a.provider = 'twitter' AND a.providerAccountId = ?
             `).get(String(tweet.userId)) as any;
             
             if (row) {
               masterUserId = row.userId;
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

          // 6. Cross-Platform Telegram DM Routing
          console.log(`✉️ Checking if @${tweet.username} is linked to Telegram...`);
          
          let telegramLinked = false;
          try {
            // Need a separate DB connection or import the existing one
            // Import dynamically since we are in an ES module
            const { default: Database } = await import('better-sqlite3');
            const path = await import('path');
            const dbPath = path.resolve(config.dataDir, 'pulse.db');
            const db = new Database(dbPath);

            // Find the Telegram ID for this Twitter user ID
            const stmt = db.prepare(`
              SELECT t.providerAccountId AS telegramId 
              FROM accounts t 
              JOIN accounts x ON t.userId = x.userId 
              WHERE x.provider = 'twitter' 
                AND x.providerAccountId = ? 
                AND t.provider = 'telegram'
            `);
            
            const linkedAccount = stmt.get(String(tweet.userId)) as { telegramId: string } | undefined;

            if (linkedAccount?.telegramId) {
              console.log(`✅ Linked Telegram account found (ID: ${linkedAccount.telegramId})`);
              
              // Import the telegram bot dynamically to avoid circular dependencies
              const { bot } = await import('../telegram/index.js');
              const { InputFile } = await import('grammy');
              
              if (bot) {
                // Send the audio via Telegram DM!
                await bot.api.sendAudio(
                  linkedAccount.telegramId, 
                  new InputFile(audio.filePath),
                  { caption: `🔊 Here is your Pulse audio summary from X (@${tweet.username}):\n\n${summary.text}` }
                );
                telegramLinked = true;
                console.log('🚀 Telegram DM sent successfully!');
              } else {
                 console.log('⚠️ Telegram bot is not running. Start it by adding telegram to ENABLED_PLATFORMS.');
              }
            } else {
              console.log('⚠️ No linked Telegram account found.');
            }
            db.close();
          } catch (e: any) {
            console.error('⚠️ Could not check linked accounts:', e.message);
          }

          // Option C: Public Reply + Telegram DM
          console.log(`💬 Replying publicly to tweet ${tweet.id}...`);
          try {
             if (telegramLinked) {
                await scraper.sendTweet(
                  `@${tweet.username} I've summarized this thread for you! Check your Telegram DMs for the audio catchup 🎧`, 
                  tweet.id
                );
             } else {
                await scraper.sendTweet(
                  `@${tweet.username} I've generated your audio summary! To receive it via DM, please link your Telegram account on the Pulse Dashboard (link in bio).`, 
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
    }
  }, 60000); // Poll every 60 seconds

  return scraper;
}

// If run directly
const isDirectRun = process.argv[1]?.includes('x/index');
if (isDirectRun) {
  startX().catch((error) => {
    console.error('❌ Failed to start X adapter:', error);
    process.exit(1);
  });
}
