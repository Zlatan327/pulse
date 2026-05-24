import type { Client as WAClient, Message as WAMessage } from 'whatsapp-web.js';
import { MessageMedia } from 'whatsapp-web.js';
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
import { handleCatchup } from '../commands/catchup.js';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import pdfParse from 'pdf-parse';

/** Register message handlers for WhatsApp */
export function registerMessageHandlers(client: WAClient): void {
  client.on('message', async (msg: WAMessage) => {
    try {
      await processMessage(client, msg);
    } catch (error) {
      console.error('❌ WhatsApp message processing error:', error);
    }
  });
}

async function processMessage(client: WAClient, msg: WAMessage): Promise<void> {
  // Only process group messages
  const chat = await msg.getChat();
  if (!chat.isGroup) return;

  // Get contact info
  const contact = await msg.getContact();
  const username = contact.pushname || contact.name || contact.number || 'Unknown';

  const baseMsg: PlatformMessage = {
    id: msg.id.id,
    platform: 'whatsapp',
    chatId: chat.id._serialized,
    userId: msg.author || msg.from,
    username,
    text: msg.body || null,
    messageType: 'text',
    filePath: null,
    timestamp: new Date(msg.timestamp * 1000),
  };

  // Handle /catchup command
  if (msg.body?.toLowerCase().startsWith('/catchup')) {
    await handleCatchup(client, msg, chat);
    return;
  }

  // Handle voice messages
  if (msg.hasMedia && msg.type === 'ptt') {
    const media = await msg.downloadMedia();
    if (media) {
      const voicePath = path.join(config.tmpDir, `wa_voice_${msg.id.id}.ogg`);
      fs.mkdirSync(path.dirname(voicePath), { recursive: true });
      fs.writeFileSync(voicePath, Buffer.from(media.data, 'base64'));

      const transcription = await transcribeAudio(voicePath);

      // Log user voice message immediately
      logMessage({
        ...baseMsg,
        text: transcription.text,
        messageType: 'voice',
        filePath: voicePath,
      });

      // CHECK FOR DIRECT REPLY TO PULSE
      if (msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg.fromMe) {
          const history = getRecentMessages(chat.id._serialized, 'whatsapp', 15);
          const { handleVoiceQuery } = await import('../../core/index.js');
          const reply = await handleVoiceQuery(transcription.text, history);
          
          let sentMsg;
          if (reply.audio) {
            const oggPathReply = await convertToOggOpus(reply.audio.filePath);
            const voiceMediaReply = MessageMedia.fromFilePath(oggPathReply);
            await msg.reply(`🔊 ${reply.text}`);
            sentMsg = await chat.sendMessage(voiceMediaReply, { sendAudioAsVoice: true });
            cleanupAudioFile(reply.audio.filePath);
            cleanupTempFile(oggPathReply);
          } else {
            sentMsg = await msg.reply(reply.text);
          }
          
          // Log the bot's reply so it exists in history
          logMessage({
            id: sentMsg.id.id,
            platform: 'whatsapp',
            chatId: chat.id._serialized,
            userId: client.info.wid._serialized,
            username: client.info.pushname || 'Pulse',
            text: reply.text,
            messageType: reply.audio ? 'voice' : 'text',
            filePath: null,
            timestamp: new Date(sentMsg.timestamp * 1000),
          });
          
          cleanupTempFile(voicePath);
          return;
        }
      }

      // Auto-translate non-English voice notes
      if (shouldTranslate(transcription.language)) {
        const langName = getLanguageName(transcription.language);
        const translated = await translateText(transcription.text, transcription.language);
        const audio = await generateSpeech(translated);

        // Convert to OGG/Opus for WhatsApp voice note
        const oggPath = await convertToOggOpus(audio.filePath);
        const voiceMedia = MessageMedia.fromFilePath(oggPath);

        await chat.sendMessage(`🌍 Translation from ${langName}:\n> ${translated}`);
        await chat.sendMessage(voiceMedia, { sendAudioAsVoice: true });

        cleanupAudioFile(audio.filePath);
        cleanupTempFile(oggPath);
      }

      cleanupTempFile(voicePath);
      return;
    }
  }

  // Handle PDF documents
  if (msg.hasMedia && msg.type === 'document') {
    const media = await msg.downloadMedia();
    if (media && media.mimetype === 'application/pdf') {
      const pdfPath = path.join(config.tmpDir, `wa_pdf_${msg.id.id}.pdf`);
      fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
      fs.writeFileSync(pdfPath, Buffer.from(media.data, 'base64'));

      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdfParse(pdfBuffer);

      logMessage({
        ...baseMsg,
        text: `[PDF: ${media.filename || 'document.pdf'}] ${pdfData.text.substring(0, 5000)}`,
        messageType: 'document',
        filePath: pdfPath,
      });

      cleanupTempFile(pdfPath);
      return;
    }
  }

  // Log regular text messages
  if (msg.body && !msg.body.startsWith('/')) {
    logMessage(baseMsg);
  }
}
