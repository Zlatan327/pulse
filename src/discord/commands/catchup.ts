import type { ChatInputCommandInteraction } from 'discord.js';
import { AttachmentBuilder } from 'discord.js';
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

export async function handleCatchup(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const chatId = interaction.channelId;
  const requestedLimit = interaction.options.getInteger('messages') || config.summaryMaxMessages;
  const mode = (interaction.options.getString('mode') as CatchupMode) || 'standard';

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

      await generateAndSendSummary(interaction, platformMessages, chatId, mode);
    } catch (error) {
      console.error('❌ Failed to fetch Discord messages:', error);
      await interaction.editReply('❌ Failed to fetch messages. Make sure I have the "Read Message History" permission.');
    }
    return;
  }

  // Get messages since last catchup, or recent messages
  const lastCatchup = getLastCatchup(chatId, 'discord');
  const messages = getRecentMessages(
    chatId,
    'discord',
    requestedLimit,
    lastCatchup?.timestamp
  );

  if (messages.length === 0) {
    await interaction.editReply('✅ You\'re all caught up! No new messages since your last catchup.');
    return;
  }

  await generateAndSendSummary(interaction, messages, chatId, mode);
}

async function generateAndSendSummary(
  interaction: ChatInputCommandInteraction,
  messages: PlatformMessage[],
  chatId: string,
  mode: CatchupMode
): Promise<void> {
  // Update status
  await interaction.editReply(`⏳ Summarizing ${messages.length} messages...`);

  // Generate summary
  const summary = await summarizeMessages(messages, mode);

  // Generate audio
  const audio = await generateSpeech(summary.text);

  // Build response
  const audioFile = new AttachmentBuilder(audio.buffer, { name: 'catchup.mp3' });

  const timeFrom = summary.timespan.from.toLocaleString();
  const timeTo = summary.timespan.to.toLocaleString();

  let replyContent = `🔊 **Pulse Catchup** — ${summary.messageCount} messages`;
  replyContent += `\n📅 ${timeFrom} → ${timeTo}`;

  // Add task checklist if tasks were found
  const taskList = formatTaskChecklist(summary.tasks);
  if (taskList) {
    replyContent += `\n\n${taskList}`;
  }

  await interaction.editReply({
    content: replyContent,
    files: [audioFile],
  });

  // Record catchup
  markCatchup(chatId, 'discord', messages.length);

  // Cleanup
  cleanupAudioFile(audio.filePath);

  console.log(`📋 Catchup delivered: ${messages.length} messages → ${(audio.durationMs / 1000).toFixed(1)}s audio`);
}
