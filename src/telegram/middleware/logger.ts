import type { Context, NextFunction } from 'grammy';
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
import { InputFile } from 'grammy';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import pdfParse from 'pdf-parse';

/** Download a file from Telegram using the bot API */
async function downloadTelegramFile(
  ctx: Context,
  fileId: string,
  outputPath: string
): Promise<void> {
  const file = await ctx.api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
}

/** Message logging middleware — intercepts ALL messages */
export async function messageLogger(ctx: Context, next: NextFunction): Promise<void> {
  const msg = ctx.message;
  if (!msg || !ctx.chat) {
    await next();
    return;
  }

  // Skip bot messages
  if (msg.from?.is_bot) {
    await next();
    return;
  }

  const baseMsg: PlatformMessage = {
    id: String(msg.message_id),
    platform: 'telegram',
    chatId: String(ctx.chat.id),
    userId: String(msg.from?.id || 0),
    username: msg.from?.username || msg.from?.first_name || 'Unknown',
    text: msg.text || msg.caption || null,
    messageType: 'text',
    filePath: null,
    timestamp: new Date(msg.date * 1000),
  };

  try {
    // Handle voice messages
    if (msg.voice) {
      const voicePath = path.join(config.tmpDir, `tg_voice_${msg.message_id}.oga`);
      await downloadTelegramFile(ctx, msg.voice.file_id, voicePath);

      const transcription = await transcribeAudio(voicePath);

      // Log the user's voice message immediately
      logMessage({
        ...baseMsg,
        text: transcription.text,
        messageType: 'voice',
        filePath: voicePath,
      });

      // CHECK FOR DIRECT REPLY TO PULSE
      if (msg.reply_to_message && msg.reply_to_message.from?.id === ctx.me.id) {
        await ctx.replyWithChatAction('record_voice');
        const history = getRecentMessages(String(ctx.chat.id), 'telegram', 15);
        const { handleVoiceQuery } = await import('../../core/index.js');
        const requester = msg.from?.first_name || msg.from?.username || 'user';
        const reply = await handleVoiceQuery(transcription.text, history, requester);
        
        let sentMsg;
        if (reply.audio) {
          const oggPathReply = await convertToOggOpus(reply.audio.filePath);
          sentMsg = await ctx.replyWithVoice(new InputFile(oggPathReply), { caption: reply.text });
          cleanupAudioFile(reply.audio.filePath);
          cleanupTempFile(oggPathReply);
        } else {
          sentMsg = await ctx.reply(reply.text);
        }
        
        // Log the bot's reply so it exists in history
        logMessage({
          id: String(sentMsg.message_id),
          platform: 'telegram',
          chatId: String(ctx.chat.id),
          userId: String(ctx.me.id),
          username: ctx.me.username || 'Pulse',
          text: reply.text,
          messageType: reply.audio ? 'voice' : 'text',
          filePath: null,
          timestamp: new Date(sentMsg.date * 1000),
        });
        
        cleanupTempFile(voicePath);
        return await next();
      }

      // Auto-translate non-English voice notes
      if (shouldTranslate(transcription.language)) {
        const langName = getLanguageName(transcription.language);
        const translated = await translateText(transcription.text, transcription.language);
        const audio = await generateSpeech(translated);

        // Convert to OGG/Opus for Telegram voice note
        const oggPath = await convertToOggOpus(audio.filePath);

        await ctx.reply(`🌍 Translation from ${langName}:\n> ${translated}`);
        await ctx.replyWithVoice(new InputFile(oggPath));

        cleanupAudioFile(audio.filePath);
        cleanupTempFile(oggPath);
      }

      cleanupTempFile(voicePath);
    }
    // Handle documents (PDFs)
    else if (msg.document && msg.document.mime_type === 'application/pdf') {
      const pdfPath = path.join(config.tmpDir, `tg_pdf_${msg.message_id}.pdf`);
      await downloadTelegramFile(ctx, msg.document.file_id, pdfPath);

      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdfParse(pdfBuffer);

      logMessage({
        ...baseMsg,
        text: `[PDF: ${msg.document.file_name || 'document.pdf'}] ${pdfData.text.substring(0, 5000)}`,
        messageType: 'document',
        filePath: pdfPath,
      });

      cleanupTempFile(pdfPath);
    }
    // Handle regular text messages
    else if (msg.text && !msg.text.startsWith('/')) {
      logMessage(baseMsg);
    }
  } catch (error) {
    console.error('❌ Error in message logger:', error);
  }

  await next();
}
