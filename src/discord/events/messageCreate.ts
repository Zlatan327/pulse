import type { Client, Message } from 'discord.js';
import {
  logMessage,
  transcribeAudio,
  shouldTranslate,
  translateText,
  generateSpeech,
  convertToOggOpus,
  cleanupAudioFile,
  cleanupTempFile,
  getLanguageName,
  getRecentMessages,
  config,
} from '../../core/index.js';
import type { PlatformMessage } from '../../core/types.js';
import { AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/** Download a file from a URL to a local path */
async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
}

export function handleMessageCreate(client: Client): void {
  client.on('messageCreate', async (message: Message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    const baseMsg: PlatformMessage = {
      id: message.id,
      platform: 'discord',
      chatId: message.channelId,
      userId: message.author.id,
      username: message.author.displayName || message.author.username,
      text: message.content || null,
      messageType: 'text',
      filePath: null,
      timestamp: message.createdAt,
    };

    // Process attachments
    for (const [, attachment] of message.attachments) {
      try {
        // Voice messages (have duration and waveform)
        if (attachment.duration !== undefined && attachment.duration !== null) {
          const voicePath = path.join(config.tmpDir, `discord_voice_${message.id}.ogg`);
          await downloadFile(attachment.url, voicePath);

          // Transcribe
          const transcription = await transcribeAudio(voicePath);

          // Log the user's voice message immediately
          logMessage({
            ...baseMsg,
            text: transcription.text,
            messageType: 'voice',
            filePath: voicePath,
          });

          // CHECK FOR DIRECT REPLY TO PULSE
          if (message.reference && message.reference.messageId) {
            try {
              const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
              
              // Feature: Reply-based catchup (@PulseBot summarize)
              if (message.mentions.has(client.user?.id || '') && message.content.toLowerCase().includes('summarize')) {
                if ('sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
                  await message.channel.sendTyping();
                }
                
                const { summarizeMessages, generateSpeech, formatTaskChecklist, logSummary } = await import('../../core/index.js');
                
                // Fetch messages from the replied message's timestamp forward
                const recentHistory = getRecentMessages(message.channelId, 'discord', 100, repliedMessage.createdAt);
                
                if (recentHistory.length > 0) {
                  const requester = message.author.displayName || message.author.username;
                  const summary = await summarizeMessages(recentHistory, 'standard', requester);
                  const audio = await generateSpeech(summary.text);
                  
                  const audioFile = new AttachmentBuilder(audio.buffer, { name: 'catchup.mp3' });
                  let replyContent = `🔊 **Pulse Catchup** — ${summary.messageCount} messages\n📅 ${summary.timespan.from.toLocaleString()} → ${summary.timespan.to.toLocaleString()}`;
                  
                  const taskList = formatTaskChecklist(summary.tasks);
                  if (taskList) replyContent += `\n\n${taskList}`;
                  
                  await message.reply({ content: replyContent, files: [audioFile] });
                  
                  logSummary(message.author.id, 'discord', summary.title || 'Contextual Summary', Math.round(audio.durationMs / 1000));
                  cleanupAudioFile(audio.filePath);
                }
                
                cleanupTempFile(voicePath);
                continue;
              }

              // Normal voice reply to bot
              if (repliedMessage.author.id === client.user?.id) {
                if ('sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
                  await message.channel.sendTyping();
                }
                
                // Fetch recent history for context
                const history = getRecentMessages(message.channelId, 'discord', 15);
                
                // Route to Voice Agent
                const { handleVoiceQuery } = await import('../../core/index.js');
                const requester = message.author.displayName || message.author.username;
                const reply = await handleVoiceQuery(transcription.text, history, requester);
                
                let sentMsg;
                if (reply.audio) {
                  const responseAudio = new AttachmentBuilder(reply.audio.buffer, { name: 'reply.mp3' });
                  sentMsg = await message.reply({
                    content: `🔊 ${reply.text}`,
                    files: [responseAudio]
                  });
                  cleanupAudioFile(reply.audio.filePath);
                } else {
                  sentMsg = await message.reply(reply.text);
                }
                
                // Log the bot's reply so it exists in history
                logMessage({
                  id: sentMsg.id,
                  platform: 'discord',
                  chatId: message.channelId,
                  userId: client.user?.id || 'pulse',
                  username: client.user?.username || 'Pulse',
                  text: reply.text,
                  messageType: reply.audio ? 'voice' : 'text',
                  filePath: null,
                  timestamp: sentMsg.createdAt,
                });
                
                cleanupTempFile(voicePath);
                continue; // Skip auto-translation block
              }
            } catch (e) {
              console.error('Failed to process direct reply', e);
            }
          }

          // Auto-translate if non-English
          if (shouldTranslate(transcription.language)) {
            const langName = getLanguageName(transcription.language);
            const translated = await translateText(transcription.text, transcription.language);
            const audio = await generateSpeech(translated);

            const audioFile = new AttachmentBuilder(audio.buffer, { name: 'translation.mp3' });
            await message.reply({
              content: `🌍 **Translation from ${langName}:**\n> ${translated}`,
              files: [audioFile],
            });

            cleanupAudioFile(audio.filePath);
          }

          cleanupTempFile(voicePath);
          continue;
        }

        // PDF documents
        if (attachment.contentType === 'application/pdf') {
          const pdfPath = path.join(config.tmpDir, `discord_pdf_${message.id}.pdf`);
          await downloadFile(attachment.url, pdfPath);

          const pdfBuffer = fs.readFileSync(pdfPath);
          const pdfData = await pdfParse(pdfBuffer);

          logMessage({
            ...baseMsg,
            text: `[PDF: ${attachment.name}] ${pdfData.text.substring(0, 5000)}`,
            messageType: 'document',
            filePath: pdfPath,
          });

          cleanupTempFile(pdfPath);
          continue;
        }

        // Text/Markdown documents
        const fileNameLower = attachment.name.toLowerCase();
        if (attachment.contentType?.startsWith('text/') || fileNameLower.endsWith('.txt') || fileNameLower.endsWith('.md') || fileNameLower.endsWith('.csv')) {
          const txtPath = path.join(config.tmpDir, `discord_txt_${message.id}.txt`);
          await downloadFile(attachment.url, txtPath);

          const textData = fs.readFileSync(txtPath, 'utf8');

          logMessage({
            ...baseMsg,
            text: `[File: ${attachment.name}] ${textData.substring(0, 5000)}`,
            messageType: 'document',
            filePath: txtPath,
          });

          cleanupTempFile(txtPath);
          continue;
        }
      } catch (error) {
        console.error(`❌ Error processing attachment: ${error}`);
      }
    }

    // Log the text message (if it has text content and wasn't already logged as voice/doc)
    if (message.content) {
      logMessage(baseMsg);
    }
  });
}
