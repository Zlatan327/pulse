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
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

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

  // Build forward attribution prefix
  let forwardPrefix = '';
  if (msg.forward_origin) {
    const origin = msg.forward_origin;
    if (origin.type === 'user' && 'sender_user' in origin) {
      const u = origin.sender_user as { first_name?: string; username?: string };
      forwardPrefix = `[Forwarded from ${u.first_name || u.username || 'someone'}] `;
    } else if (origin.type === 'channel' && 'chat' in origin) {
      const ch = origin.chat as { title?: string };
      forwardPrefix = `[Forwarded from channel "${ch.title || 'unknown'}"] `;
    } else if (origin.type === 'hidden_user' && 'sender_user_name' in origin) {
      forwardPrefix = `[Forwarded from ${(origin as any).sender_user_name}] `;
    } else {
      forwardPrefix = '[Forwarded] ';
    }
  } else if ((msg as any).forward_from) {
    const fwd = (msg as any).forward_from;
    forwardPrefix = `[Forwarded from ${fwd.first_name || fwd.username || 'someone'}] `;
  } else if ((msg as any).forward_from_chat) {
    const fwd = (msg as any).forward_from_chat;
    forwardPrefix = `[Forwarded from "${fwd.title || 'a chat'}"] `;
  }

  const rawText = msg.text || msg.caption || null;

  const baseMsg: PlatformMessage = {
    id: String(msg.message_id),
    platform: 'telegram',
    chatId: String(ctx.chat.id),
    userId: String(msg.from?.id || 0),
    username: msg.from?.username || msg.from?.first_name || 'Unknown',
    text: rawText ? `${forwardPrefix}${rawText}` : null,
    messageType: 'text',
    filePath: null,
    timestamp: new Date(msg.date * 1000),
  };

  try {
    // Handle voice messages (including forwarded voice notes)
    if (msg.voice) {
      const voicePath = path.join(config.tmpDir, `tg_voice_${msg.message_id}.oga`);
      await downloadTelegramFile(ctx, msg.voice.file_id, voicePath);

      const transcription = await transcribeAudio(voicePath);

      // Log the user's voice message immediately
      logMessage({
        ...baseMsg,
        text: `${forwardPrefix}${transcription.text}`,
        messageType: 'voice',
        filePath: voicePath,
      });

      // CHECK FOR DIRECT REPLY TO PULSE (skip for forwarded voice notes)
      if (!forwardPrefix && msg.reply_to_message && msg.reply_to_message.from?.id === ctx.me.id) {
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
    // Handle audio messages (forwarded music, audio files)
    else if (msg.audio) {
      logMessage({
        ...baseMsg,
        text: `${forwardPrefix}[shared audio: ${msg.audio.title || msg.audio.file_name || 'audio file'}]${msg.caption ? ' — ' + msg.caption : ''}`,
        messageType: 'voice',
      });
      console.log(`[Telegram] Logged audio from ${msg.from?.first_name}`);
    }
    // Handle video notes (round video messages)
    else if (msg.video_note) {
      logMessage({
        ...baseMsg,
        text: `${forwardPrefix}[sent a video note]`,
        messageType: 'voice',
      });
      console.log(`[Telegram] Logged video note from ${msg.from?.first_name}`);
    }
    // Handle documents (PDFs get full text extraction, others get logged as-is)
    else if (msg.document) {
      if (msg.document.mime_type === 'application/pdf') {
        const pdfPath = path.join(config.tmpDir, `tg_pdf_${msg.message_id}.pdf`);
        await downloadTelegramFile(ctx, msg.document.file_id, pdfPath);

        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfData = await pdfParse(pdfBuffer);

        logMessage({
          ...baseMsg,
          text: `${forwardPrefix}[PDF: ${msg.document.file_name || 'document.pdf'}] ${pdfData.text.substring(0, 5000)}`,
          messageType: 'document',
          filePath: pdfPath,
        });
        cleanupTempFile(pdfPath);
      } else if (msg.document.mime_type?.startsWith('text/') || (msg.document.file_name?.toLowerCase() || '').match(/\.(txt|md|csv)$/)) {
        const txtPath = path.join(config.tmpDir, `tg_txt_${msg.message_id}.txt`);
        await downloadTelegramFile(ctx, msg.document.file_id, txtPath);

        const textData = fs.readFileSync(txtPath, 'utf8');

        logMessage({
          ...baseMsg,
          text: `${forwardPrefix}[File: ${msg.document.file_name || 'document.txt'}] ${textData.substring(0, 5000)}`,
          messageType: 'document',
          filePath: txtPath,
        });
        cleanupTempFile(txtPath);
      } else {
        logMessage({
          ...baseMsg,
          text: `${forwardPrefix}[shared file: ${msg.document.file_name || 'unknown'}]${msg.caption ? ' — ' + msg.caption : ''}`,
          messageType: 'document',
        });
      }
      console.log(`[Telegram] Logged document from ${msg.from?.first_name}: ${msg.document.file_name || 'file'}`);
    }
    // Handle photos (with optional caption)
    else if (msg.photo) {
      logMessage({
        ...baseMsg,
        text: `${forwardPrefix}[shared a photo]${msg.caption ? ' — ' + msg.caption : ''}`,
        messageType: 'image',
      });
      console.log(`[Telegram] Logged photo from ${msg.from?.first_name}`);
    }
    // Handle video messages
    else if (msg.video) {
      logMessage({
        ...baseMsg,
        text: `${forwardPrefix}[shared a video]${msg.caption ? ' — ' + msg.caption : ''}`,
        messageType: 'image',
      });
      console.log(`[Telegram] Logged video from ${msg.from?.first_name}`);
    }
    // Handle stickers
    else if (msg.sticker) {
      logMessage({
        ...baseMsg,
        text: `${forwardPrefix}[sent sticker: ${msg.sticker.emoji || ''}]`,
        messageType: 'text',
      });
    }
    // Handle polls
    else if (msg.poll) {
      const options = msg.poll.options.map((o: any) => o.text).join(', ');
      logMessage({
        ...baseMsg,
        text: `${forwardPrefix}[created poll: "${msg.poll.question}"] Options: ${options}`,
        messageType: 'text',
      });
      console.log(`[Telegram] Logged poll from ${msg.from?.first_name}`);
    }
    // Handle regular text messages (including forwarded text)
    else if (rawText && !rawText.startsWith('/')) {
      console.log(`[Telegram] Received text from ${msg.from?.first_name}${forwardPrefix ? ' ' + forwardPrefix : ''}: ${rawText.substring(0, 50)}`);
      logMessage(baseMsg);
    }
    // Handle location messages
    else if (msg.location) {
      logMessage({
        ...baseMsg,
        text: `${forwardPrefix}[shared a location]`,
        messageType: 'text',
      });
    }
    // Handle contact messages
    else if (msg.contact) {
      logMessage({
        ...baseMsg,
        text: `${forwardPrefix}[shared a contact: ${msg.contact.first_name} ${msg.contact.last_name || ''}]`,
        messageType: 'text',
      });
    }
  } catch (error) {
    console.error('❌ Error in message logger:', error);
  }

  await next();
}
