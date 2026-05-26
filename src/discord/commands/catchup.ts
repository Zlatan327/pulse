import type { ChatInputCommandInteraction } from 'discord.js';
import {
  getRecentMessages,
  getLastCatchup,
  markCatchup,
  getMessageCount,
  summarizeMessages,
  generateSpeech,
  cleanupAudioFile,
  formatTaskChecklist,
  config,
} from '../../core/index.js';
import type { PlatformMessage, CatchupMode } from '../../core/types.js';

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

export async function handleCatchup(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const chatId = interaction.channelId;
  const requestedLimit = interaction.options.getInteger('messages') || config.summaryMaxMessages;
  const mode = (interaction.options.getString('mode') as CatchupMode) || 'standard';
  const requester = interaction.user.displayName || interaction.user.username;
  
  const timeframeStr = interaction.options.getString('timeframe');
  const targetUserObj = interaction.options.getUser('user');
  const targetUser = targetUserObj ? (targetUserObj.displayName || targetUserObj.username) : undefined;
  const format = interaction.options.getString('format') || 'audio';
  const delivery = interaction.options.getString('delivery') || 'public';
  let sinceDate = (timeframeStr ? parseTimeframeToDate(timeframeStr) : undefined) || undefined;

  // Check if we have enough messages
  const totalMessages = getMessageCount(chatId, 'discord');
  if (totalMessages < 3) {
    // Fallback: try to fetch from Discord API directly
    await interaction.editReply(
      '🔍 I\'m still learning this channel. Let me fetch recent messages...'
    );

    try {
      const channel = interaction.channel;
      if (!channel || !('messages' in channel)) {
        await interaction.editReply('❌ Cannot access this channel\'s messages.');
        return;
      }

      const discordMessages = await channel.messages.fetch({ limit: Math.min(requestedLimit, 100) });
      const platformMessages: PlatformMessage[] = [];

      for (const [, msg] of discordMessages) {
        if (msg.author.bot) continue;
        platformMessages.push({
          id: msg.id,
          platform: 'discord',
          chatId,
          userId: msg.author.id,
          username: msg.author.displayName || msg.author.username,
          text: msg.content || null,
          messageType: 'text',
          filePath: null,
          timestamp: msg.createdAt,
        });
      }

      // Sort chronologically
      platformMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      if (platformMessages.length === 0) {
        await interaction.editReply('📭 No messages found to summarize.');
        return;
      }

      await generateAndSendSummary(interaction, platformMessages, chatId, mode, requester, targetUser, format, delivery);
    } catch (error) {
      console.error('❌ Failed to fetch Discord messages:', error);
      await interaction.editReply('❌ Failed to fetch messages. Make sure I have the "Read Message History" permission.');
    }
    return;
  }

  // Get messages since last catchup, or recent messages
  if (!sinceDate) {
    const lastCatchup = getLastCatchup(chatId, 'discord');
    if (lastCatchup) sinceDate = lastCatchup.timestamp;
  }
  
  const messages = getRecentMessages(
    chatId,
    'discord',
    requestedLimit,
    sinceDate
  );

  if (messages.length === 0) {
    await interaction.editReply('✅ You\'re all caught up! No new messages since your last catchup.');
    return;
  }

  await generateAndSendSummary(interaction, messages, chatId, mode, requester, targetUser, format, delivery);
}

async function generateAndSendSummary(
  interaction: ChatInputCommandInteraction,
  messages: PlatformMessage[],
  chatId: string,
  mode: CatchupMode,
  requester: string,
  targetUser?: string,
  format?: string,
  delivery?: string
): Promise<void> {
  // Update status
  await interaction.editReply(`⏳ Summarizing ${messages.length} messages...`);

  try {
    // Generate summary
    const summary = await summarizeMessages(messages, mode, requester, targetUser);

    const timeFrom = summary.timespan.from.toLocaleString();
    const timeTo = summary.timespan.to.toLocaleString();

    let replyContent = `Hey <@${interaction.user.id}>! 🔊 **Pulse Catchup** — ${summary.messageCount} messages`;
    if (format === 'text') replyContent = `Hey <@${interaction.user.id}>! 📝 **Pulse Text Summary** — ${summary.messageCount} messages`;
    
    replyContent += `\n📅 ${timeFrom} → ${timeTo}\n\n`;

    if (format === 'text') {
      replyContent += `**Summary:**\n${summary.text}\n\n`;
    }

    // Add task checklist if tasks were found
    const taskList = formatTaskChecklist(summary.tasks);
    if (taskList) {
      replyContent += `${taskList}\n\n`;
    }

    replyContent += `#PulseSummary`;

    const payload: any = { content: replyContent };

    let audioPath: string | null = null;
    if (format !== 'text') {
      const audio = await generateSpeech(summary.text);
      audioPath = audio.filePath;
      const { AttachmentBuilder } = await import('discord.js');
      const audioFile = new AttachmentBuilder(audio.buffer, { name: 'catchup.mp3' });
      payload.files = [audioFile];
      payload.content += `\n\n🎙️ **Reply to this message with a voice note to ask me follow-up questions!**`;
    }

    // Handle Delivery Mode
    if (delivery === 'private') {
      await interaction.user.send(payload).catch(async () => {
        await interaction.followUp({ content: '❌ I could not send you a DM. Please check your privacy settings.', ephemeral: true });
      });
      await interaction.editReply('✅ Summary sent to your DMs!');
    } else {
      const message = await interaction.editReply(payload);
      // Start a thread
      if (interaction.channel && !interaction.channel.isThread()) {
        try {
          await message.startThread({
            name: `Pulse Summary - ${new Date().toLocaleTimeString()}`,
            autoArchiveDuration: 60,
          });
        } catch (e) {
          console.warn('Could not start thread:', e);
        }
      }
    }

    // Record catchup
    markCatchup(chatId, 'discord', messages.length);

    // Cleanup
    if (audioPath) cleanupAudioFile(audioPath);
  } catch (error: any) {
    console.error('❌ Discord catchup error:', error);
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      await interaction.editReply(`❌ **Rate Limit Exceeded:** I've been summarizing too much recently! Please wait a minute and try again.`);
    } else {
      await interaction.editReply(`❌ Something went wrong generating your catchup.`);
    }
  }
}
