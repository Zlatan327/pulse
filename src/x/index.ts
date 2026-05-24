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

          // 4. Summarize
          console.log(`🧠 Summarizing ${messages.length} tweets...`);
          const summary = await summarizeMessages(messages, 'standard', tweet.username);

          // 5. Generate Audio
          console.log('🔊 Generating audio...');
          const audio = await generateSpeech(summary.text);

          // X requires specific formats for media. MP4 is best for audio-only video uploads, but MP3 might work if disguised or if we just send the text. 
          // However, agent-twitter-client might have strict rules. Let's try sending the raw audio buffer.
          // Note: agent-twitter-client's sendTweet takes media as { data: Buffer, mediaType: string }
          
          const mediaData = [{
            data: fs.readFileSync(audio.filePath),
            mediaType: 'audio/mpeg' // MP3
          }];

          // Option C: Public Reply + DM
          
          // Reply publicly
          console.log(`💬 Replying publicly to tweet ${tweet.id}...`);
          try {
             await scraper.sendTweet(
               `@${tweet.username} I've summarized this thread for you! Check your DMs for the audio catchup 🎧`, 
               tweet.id
             );
          } catch(e: any) {
             console.error('⚠️ Could not send public reply:', e.message);
          }

          // Send DM
          console.log(`✉️ Sending DM to @${tweet.username} (ID: ${tweet.userId})...`);
          try {
            // Some versions of the library don't expose sendDirectMessage publicly or it requires internal calls
            // If it exists, we use it.
            if (typeof (scraper as any).sendDirectMessage === 'function') {
               // We might need to send the text and media separately or together depending on the client.
               // For now, let's try sending just text if media DM fails, or we can just send the text summary.
               // We'll just send the text summary in the DM for safety since media DMs via unofficial clients are very unstable.
               const dmText = `🔊 Here is your Pulse audio summary (Text Fallback):\n\n${summary.text}`;
               await (scraper as any).sendDirectMessage(tweet.userId, dmText);
               console.log('✅ DM sent!');
            } else {
               console.log('⚠️ DM functionality not available in this client version. Falling back to public reply with summary text.');
               await scraper.sendTweet(`@${tweet.username} Here is the summary:\n\n${summary.text.substring(0, 250)}...`, tweet.id);
            }
          } catch(e: any) {
             console.error('⚠️ Could not send DM:', e.message);
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
