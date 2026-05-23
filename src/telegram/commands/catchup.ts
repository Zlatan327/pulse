import type { Context } from 'grammy';
import { InputFile } from 'grammy';
import {
  getRecentMessages,
  getLastCatchup,
  markCatchup,
  getMessageCount,
  summarizeMessages,
  generateSpeech,
  convertToOggOpus,
  cleanupAudioFile,
  cleanupTempFile,
  formatTaskChecklist,
  config,
} from '../../core/index.js';

export async function handleCatchup(ctx: Context): Promise<void> {
  if (!ctx.chat) return;

  const chatId = String(ctx.chat.id);

  // Check if we have enough messages
  const totalMessages = getMessageCount(chatId, 'telegram');

  if (totalMessages < 3) {
    await ctx.reply(
      '🧠 I\'m still learning this chat! I need to see more messages before I can generate a meaningful summary.\n\n' +
      '💡 Make sure:\n' +
      '1. Privacy mode is **disabled** via @BotFather\n' +
      '2. I was **removed and re-added** to this group after disabling privacy mode\n\n' +
      'I\'ll be ready to catch you up once I\'ve logged some conversations!'
    );
    return;
  }

  // Send typing indicator
  await ctx.reply('⏳ Catching up on recent messages...');

  try {
    // Get messages since last catchup, or recent messages
    const lastCatchup = getLastCatchup(chatId, 'telegram');
    const messages = getRecentMessages(
      chatId,
      'telegram',
      config.summaryMaxMessages,
      lastCatchup?.timestamp
    );

    if (messages.length === 0) {
      await ctx.reply('✅ You\'re all caught up! No new messages since your last catchup.');
      return;
    }

    // Generate summary
    const summary = await summarizeMessages(messages);

    // Generate audio
    const audio = await generateSpeech(summary.text);

    // Convert to OGG/Opus for Telegram voice message
    const oggPath = await convertToOggOpus(audio.filePath);

    // Send voice message
    const timeFrom = summary.timespan.from.toLocaleString();
    const timeTo = summary.timespan.to.toLocaleString();

    let caption = `🔊 Pulse Catchup — ${summary.messageCount} messages`;
    caption += `\n📅 ${timeFrom} → ${timeTo}`;

    await ctx.replyWithVoice(new InputFile(oggPath), {
      caption,
    });

    // Send task checklist if tasks were found
    const taskList = formatTaskChecklist(summary.tasks);
    if (taskList) {
      await ctx.reply(taskList);
    }

    // Record catchup
    markCatchup(chatId, 'telegram', messages.length);

    // Cleanup
    cleanupAudioFile(audio.filePath);
    cleanupTempFile(oggPath);

    console.log(`📋 TG Catchup delivered: ${messages.length} messages → ${(audio.durationMs / 1000).toFixed(1)}s audio`);
  } catch (error) {
    console.error('❌ Telegram catchup error:', error);
    await ctx.reply('❌ Something went wrong generating your catchup. Please try again.');
  }
}
