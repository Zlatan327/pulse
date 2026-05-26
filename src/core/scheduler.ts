import cron from 'node-cron';
import { getAllActiveDailyChats, getRecentMessages, markCatchup } from './db.js';
import { summarizeMessages, generateDetailedMinutes } from './summarizer.js';
import { generateSpeech, cleanupAudioFile } from './tts.js';
import { convertToOggOpus, cleanupTempFile } from './utils.js';
import { config } from './config.js';
import path from 'path';
import fs from 'fs';

export interface SchedulerClients {
  discordClient?: any;
  telegramBot?: any;
}

export function startScheduler(clients: SchedulerClients) {
  console.log('⏱️  Daily Digest Scheduler initialized.');

  // Run every minute to check if it's time for any chat's digest
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    // format as HH:MM
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMinute = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMinute}`;

    const activeChats = getAllActiveDailyChats();
    for (const chat of activeChats) {
      if (chat.digestTime === currentTimeStr) {
        try {
          console.log(`[Scheduler] Triggering daily digest for ${chat.platform} chat ${chat.chatId}`);
          await sendDailyDigest(chat.chatId, chat.platform, clients);
        } catch (error) {
          console.error(`[Scheduler] Failed digest for ${chat.chatId}:`, error);
        }
      }
    }
  });
}

async function sendDailyDigest(chatId: string, platform: 'discord' | 'telegram' | 'whatsapp', clients: SchedulerClients) {
  // Get messages from the last 24 hours
  const sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const messages = getRecentMessages(chatId, platform, 500, sinceDate);

  if (messages.length === 0) {
    return; // No messages, don't spam
  }

  // 1. Generate Audio Summary
  const summary = await summarizeMessages(messages, 'standard', 'the team');
  const audio = await generateSpeech(summary.text);

  // 2. Generate Detailed Minutes File
  const minutesText = await generateDetailedMinutes(messages);
  const minutesPath = path.join(config.tmpDir, `daily_minutes_${chatId}_${Date.now()}.md`);
  fs.writeFileSync(minutesPath, minutesText);

  // 3. Dispatch to specific platform
  if (platform === 'discord' && clients.discordClient) {
    const channel = await clients.discordClient.channels.fetch(chatId).catch(() => null);
    if (channel && channel.isTextBased()) {
      const { AttachmentBuilder } = await import('discord.js');
      const audioFile = new AttachmentBuilder(audio.buffer, { name: 'daily_summary.mp3' });
      const minutesFile = new AttachmentBuilder(minutesPath, { name: 'daily_minutes.md' });
      
      const content = `📊 **#PulseDailyMinutes**\nYour automated daily summary is here! (${summary.messageCount} messages analyzed)`;
      
      await channel.send({ content, files: [audioFile, minutesFile] });
      markCatchup(chatId, 'discord', messages.length);
    }
  } else if (platform === 'telegram' && clients.telegramBot) {
    const { InputFile } = await import('grammy');
    const oggPath = await convertToOggOpus(audio.filePath);
    
    const caption = `📊 #PulseDailyMinutes\nYour automated daily summary is here! (${summary.messageCount} messages analyzed)`;
    
    // Send Audio
    await clients.telegramBot.api.sendVoice(chatId, new InputFile(oggPath), { caption });
    // Send Minutes Doc
    await clients.telegramBot.api.sendDocument(chatId, new InputFile(minutesPath));
    
    markCatchup(chatId, 'telegram', messages.length);
    cleanupTempFile(oggPath);
  }

  cleanupAudioFile(audio.filePath);
  cleanupTempFile(minutesPath);
}
