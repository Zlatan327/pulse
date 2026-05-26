import { Scraper, SearchMode } from 'agent-twitter-client';
import {
  config,
  summarizeMessages,
  generateSpeech,
} from '../core/index.js';
import type { PlatformMessage } from '../core/types.js';
import { getAllWatchlists, getUserSettingsByPlatformId } from '../core/db.js';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

/**
 * Helper to dispatch the generated audio to the user's preferred platform
 */
async function dispatchAudio(
  userId: string,
  summary: any,
  audioPath: string,
  title: string,
  context: string
) {
  const dbPath = path.resolve(config.dataDir, 'pulse.db');
  const db = new Database(dbPath);

  // 1. Get delivery preference
  const row = db.prepare(`
    SELECT delivery_preference FROM user_settings WHERE user_id = ?
  `).get(userId) as any;
  const deliveryPreference = row?.delivery_preference || 'x';

  // 2. Log summary
  db.prepare(`
    INSERT INTO audio_summaries (id, user_id, platform, title, duration_seconds)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), userId, 'x_intel', title, 30); // Approx duration for now

  let delivered = false;

  // 3. Dispatch
  if (deliveryPreference === 'discord') {
    const d = db.prepare(`SELECT providerAccountId as id FROM accounts WHERE userId = ? AND provider = 'discord'`).get(userId) as any;
    if (d?.id) {
      try {
        const { client } = await import('../discord/index.js');
        if (client) {
          const user = await client.users.fetch(d.id);
          const { AttachmentBuilder } = await import('discord.js');
          const attachment = new AttachmentBuilder(audioPath, { name: 'pulse_intel.mp3' });
          await user.send({
            content: `🧠 **X Intelligence Digest**\n\n> ${context}\n> ${title}\n\n${summary.text}`,
            files: [attachment]
          });
          delivered = true;
          console.log(`🚀 Intel digest delivered to Discord for user ${userId}`);
        }
      } catch (e) {
        console.error('Discord delivery failed:', e);
      }
    }
  } else if (deliveryPreference === 'telegram') {
    const t = db.prepare(`SELECT providerAccountId as id FROM accounts WHERE userId = ? AND provider = 'telegram'`).get(userId) as any;
    if (t?.id) {
      try {
        const { bot } = await import('../telegram/index.js');
        const { InputFile } = await import('grammy');
        if (bot) {
          await bot.api.sendAudio(
            t.id,
            new InputFile(audioPath),
            { caption: `🧠 X Intelligence Digest:\n\n${context}\n${title}\n\n${summary.text}` }
          );
          delivered = true;
          console.log(`🚀 Intel digest delivered to Telegram for user ${userId}`);
        }
      } catch (e) {
        console.error('Telegram delivery failed:', e);
      }
    }
  }

  db.close();

  // If X or if DM failed, we can't easily DM on X without an API key for the user, 
  // so we just log it or maybe don't deliver if they chose X (X requires a public tweet usually)
  if (!delivered) {
    console.log(`⚠️ Could not deliver intel digest to Discord/Telegram for user ${userId}. X DM delivery not supported yet.`);
  }
}

/**
 * Start the X Intelligence Scheduler
 */
export function startXIntelligence(scraper: Scraper) {
  console.log('🧠 Starting X Intelligence Scheduler...');

  // Run every 2 hours (120 minutes)
  const INTERVAL_MS = 120 * 60 * 1000;
  
  // Track the most recent tweet ID for each watchlist item to avoid duplicates
  const lastSeenMap = new Map<string, string>();
  let isPolling = false;

  setInterval(async () => {
    if (isPolling) return;
    isPolling = true;

    try {
      console.log('🔍 Running X Intelligence routines...');
      const watchlists = getAllWatchlists();

      if (watchlists.length === 0) {
        console.log('   No active monitors found.');
        return;
      }

      for (const item of watchlists) {
        const messages: PlatformMessage[] = [];
        let title = '';
        let context = '';

        if (item.type === 'account') {
          console.log(`   Monitoring account: ${item.target}`);
          const targetUser = item.target.replace('@', '');
          let query = `from:${targetUser}`;
          
          const sinceId = lastSeenMap.get(item.id);
          if (sinceId) query += ` since_id:${sinceId}`;

          const results = scraper.searchTweets(query, 15, SearchMode.Latest);
          
          for await (const t of results) {
            messages.push({
              id: String(t.id),
              platform: 'x',
              chatId: item.target,
              userId: String(t.userId),
              username: t.username || targetUser,
              text: t.text || null,
              messageType: 'text',
              filePath: null,
              timestamp: t.timeParsed || new Date()
            });
            if (messages.length >= 15) break;
          }
          title = `Recent tweets by ${item.target}`;
          context = `Account Monitor: ${item.target}`;
        } 
        else if (item.type === 'topic') {
          console.log(`   Monitoring topic: ${item.target}`);
          let query = `${item.target} min_faves:10`; // filtering for quality
          
          const sinceId = lastSeenMap.get(item.id);
          if (sinceId) query += ` since_id:${sinceId}`;

          const results = scraper.searchTweets(query, 20, SearchMode.Latest);
          
          for await (const t of results) {
            messages.push({
              id: String(t.id),
              platform: 'x',
              chatId: item.target,
              userId: String(t.userId),
              username: t.username || 'User',
              text: t.text || null,
              messageType: 'text',
              filePath: null,
              timestamp: t.timeParsed || new Date()
            });
            if (messages.length >= 20) break;
          }
          title = `Discourse around ${item.target}`;
          context = `Topic Tracker: ${item.target}`;
        }
        else if (item.type === 'space_topic') {
          console.log(`   Monitoring Spaces discourse: ${item.target}`);
          let query = `twitter spaces ${item.target}`;
          
          const sinceId = lastSeenMap.get(item.id);
          if (sinceId) query += ` since_id:${sinceId}`;

          const results = scraper.searchTweets(query, 20, SearchMode.Latest);
          
          for await (const t of results) {
            messages.push({
              id: String(t.id),
              platform: 'x',
              chatId: item.target,
              userId: String(t.userId),
              username: t.username || 'User',
              text: t.text || null,
              messageType: 'text',
              filePath: null,
              timestamp: t.timeParsed || new Date()
            });
            if (messages.length >= 20) break;
          }
          title = `Spaces Recap: ${item.target}`;
          context = `Spaces Tracker: ${item.target}`;
        }

        if (messages.length > 0) {
          // Chronological order
          messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          
          // Update the last seen ID
          const latestId = messages[messages.length - 1].id;
          lastSeenMap.set(item.id, latestId);

          // Summarize and generate audio
          const summary = await summarizeMessages(messages, 'standard', 'Pulse Intel');
          const audio = await generateSpeech(summary.text);
          
          // Dispatch
          await dispatchAudio(item.userId, summary, audio.filePath, title, context);
        } else {
          console.log(`   No new updates for ${item.target} since last check.`);
        }
      }

    } catch (e: any) {
      console.error('❌ Error in X Intelligence routine:', e.message);
    } finally {
      isPolling = false;
    }
  }, INTERVAL_MS);

  // Run once on startup (after a small delay to let login finish)
  setTimeout(() => {
    console.log('▶️ Running initial X Intelligence sweep...');
    // We can emit a synthetic tick here or just wait for the interval.
  }, 15000);
}
