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
  getUserSettingsByPlatformId,
  logSummary
} from '../../core/index.js';
import type { CatchupMode } from '../../core/types.js';

function parseTimeframeToDate(timeStr: string): Date | null {
  const match = timeStr.match(/^(\d+)\s*(m|min|mins|minutes|h|hr|hrs|hours|d|day|days)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  let ms = 0;
  if (unit.startsWith('m')) ms = val * 60 * 1000;
  else if (unit.startsWith('h')) ms = val * 60 * 60 * 1000;
  else if (unit.startsWith('d')) ms = val * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

export async function handleCatchup(ctx: Context): Promise<void> {
  if (!ctx.chat) return;

  const chatId = String(ctx.chat.id);

  // Parse all arguments from the command text
  const args = ((ctx.match as string) || '').split(' ').map(s => s.trim()).filter(Boolean);

  const requester = ctx.from?.first_name || ctx.from?.username || 'user';

  // Check user settings from db
  const userSettings = ctx.from?.id ? getUserSettingsByPlatformId('telegram', String(ctx.from.id)) : null;

  let mode: CatchupMode = 'standard';
  let targetUser: string | undefined;
  let sinceDate: Date | undefined;
  let format = 'audio';
  let delivery = 'public';

  // Apply saved voice style if user has one
  if (userSettings?.voiceStyle) {
    const style = userSettings.voiceStyle;
    if (style.includes('Marcus')) mode = 'fun';
    else if (style.includes('RoastMaster')) mode = 'roast';
    else if (style.includes('Storyteller')) mode = 'story';
  }

  // Parse arguments for mode, target user, timeframe, format, and delivery
  const modes = ['standard', 'fun', 'roast', 'story', 'urgent', 'manager', 'empathic', 'for-me'];
  for (const arg of args) {
    const lArg = arg.toLowerCase();
    if (lArg.match(/^\d+(m|min|mins|minutes|h|hr|hrs|hours|d|day|days)$/)) {
      const parsed = parseTimeframeToDate(arg);
      if (parsed) sinceDate = parsed;
    } else if (lArg === 'text') {
      format = 'text';
    } else if (lArg === 'private') {
      delivery = 'private';
    } else if (modes.includes(lArg)) {
      mode = lArg as CatchupMode;
    } else if (arg.startsWith('@')) {
      targetUser = arg.substring(1);
    }
  }

  // If replied to a message, prioritize its timestamp directly from Telegram
  if (ctx.message?.reply_to_message) {
    sinceDate = new Date(ctx.message.reply_to_message.date * 1000);
  }

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

  // Get messages since last catchup if no explicit timeframe
  if (!sinceDate) {
    const lastCatchup = getLastCatchup(chatId, 'telegram');
    if (lastCatchup) sinceDate = lastCatchup.timestamp;
  }

  const messages = getRecentMessages(chatId, 'telegram', config.summaryMaxMessages, sinceDate);

  if (messages.length === 0) {
    await ctx.reply('✅ You\'re all caught up! No new messages since your last catchup.', { reply_to_message_id: ctx.message?.message_id });
    return;
  }

  // Update status
  const statusMsg = await ctx.reply(`⏳ Summarizing ${messages.length} messages...`, { reply_to_message_id: ctx.message?.message_id });

  try {
    // Generate summary
    const summary = await summarizeMessages(messages, mode, requester, targetUser);

    const timeFrom = summary.timespan.from.toLocaleString();
    const timeTo = summary.timespan.to.toLocaleString();
    const userMention = ctx.from?.username ? `@${ctx.from.username}` : (ctx.from?.first_name || 'there');

    let caption = `Hey ${userMention}! `;
    caption += format === 'text' ? `📝 Pulse Text Summary — ${summary.messageCount} messages` : `🔊 Pulse Catchup — ${summary.messageCount} messages`;
    caption += `\n📅 ${timeFrom} → ${timeTo}\n\n`;

    if (format === 'text') {
      caption += `**Summary:**\n${summary.text}\n\n`;
    }

    const taskList = formatTaskChecklist(summary.tasks);
    if (taskList) caption += `${taskList}\n\n`;

    caption += `#PulseSummary`;

    const sendTarget = delivery === 'private' ? ctx.from?.id : chatId;

    if (!sendTarget) {
      throw new Error('Cannot determine target');
    }

    if (format === 'text') {
      await ctx.api.sendMessage(sendTarget, caption, { parse_mode: 'Markdown' });
    } else {
      const audio = await generateSpeech(summary.text);
      const oggPath = await convertToOggOpus(audio.filePath);

      caption += `\n\n🎙️ **Reply to this message with a voice note to ask me follow-up questions!**`;

      const inputFile = new InputFile(oggPath);
      await ctx.api.sendVoice(sendTarget, inputFile, { caption, parse_mode: 'Markdown' });

      cleanupTempFile(oggPath);
      cleanupAudioFile(audio.filePath);

      // Log summary if user has settings
      if (userSettings?.userId) {
        logSummary(userSettings.userId, 'telegram', summary.title || 'Telegram Summary', Math.round(audio.durationMs / 1000));
      }

      console.log(`📋 TG Catchup delivered: ${messages.length} messages → ${(audio.durationMs / 1000).toFixed(1)}s audio`);
    }

    if (delivery === 'private' && ctx.chat?.type !== 'private') {
      await ctx.api.editMessageText(chatId, statusMsg.message_id, `✅ I have sent the summary to your DMs!`);
    } else {
      await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
    }

    markCatchup(chatId, 'telegram', messages.length);

  } catch (error) {
    console.error('❌ Telegram catchup error:', error);
    await ctx.api.editMessageText(chatId, statusMsg.message_id, `❌ Something went wrong generating your catchup.`);
  }
}
