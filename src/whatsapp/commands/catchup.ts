import type { Client as WAClient, Message as WAMessage, Chat } from 'whatsapp-web.js';
import { MessageMedia } from 'whatsapp-web.js';
import {
  getRecentMessages,
  getLastCatchup,
  markCatchup,
  logMessage,
  summarizeMessages,
  generateSpeech,
  convertToOggOpus,
  cleanupAudioFile,
  cleanupTempFile,
  formatTaskChecklist,
  config,
} from '../../core/index.js';
import type { PlatformMessage, CatchupMode } from '../../core/types.js';

export async function handleCatchup(
  client: WAClient,
  msg: WAMessage,
  chat: Chat
): Promise<void> {
  const chatId = chat.id._serialized;

  const requesterContact = await msg.getContact();
  const requester = requesterContact.pushname || requesterContact.name || requesterContact.number || 'user';

  const args = msg.body.split(' ').map(s => s.trim()).filter(Boolean);
  let mode: CatchupMode = 'standard';
  const modes = ['standard', 'fun', 'roast', 'story', 'urgent', 'manager', 'empathic', 'for-me'];
  for (const arg of args) {
    if (modes.includes(arg.toLowerCase())) {
      mode = arg.toLowerCase() as CatchupMode;
      break;
    }
  }

  await chat.sendMessage('⏳ Catching up on recent messages...');

  try {
    // WhatsApp unique advantage: we can fetch past messages directly!
    const waMessages = await chat.fetchMessages({ limit: config.summaryMaxMessages });

    // Convert to PlatformMessage format
    const platformMessages: PlatformMessage[] = [];

    for (const waMsg of waMessages) {
      if (waMsg.fromMe) continue; // Skip bot's own messages
      if (!waMsg.body && waMsg.type === 'chat') continue; // Skip empty

      const contact = await waMsg.getContact();
      const username = contact.pushname || contact.name || contact.number || 'Unknown';

      platformMessages.push({
        id: waMsg.id.id,
        platform: 'whatsapp',
        chatId,
        userId: waMsg.author || waMsg.from,
        username,
        text: waMsg.body || null,
        messageType: waMsg.type === 'ptt' ? 'voice' : waMsg.type === 'document' ? 'document' : 'text',
        filePath: null,
        timestamp: new Date(waMsg.timestamp * 1000),
      });
    }

    // Also merge with DB messages (may have transcriptions)
    const lastCatchup = getLastCatchup(chatId, 'whatsapp');
    const dbMessages = getRecentMessages(
      chatId,
      'whatsapp',
      config.summaryMaxMessages,
      lastCatchup?.timestamp
    );

    // Merge: prefer DB messages (they have transcriptions), add WA messages we don't have
    const dbIds = new Set(dbMessages.map((m: PlatformMessage) => m.id));
    const mergedMessages = [...dbMessages];
    for (const waMsg of platformMessages) {
      if (!dbIds.has(waMsg.id) && waMsg.text) {
        mergedMessages.push(waMsg);
      }
    }

    // Sort chronologically
    mergedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (mergedMessages.length === 0) {
      await chat.sendMessage('✅ You\'re all caught up! No new messages to summarize.');
      return;
    }

    // Generate summary
    const summary = await summarizeMessages(mergedMessages, mode, requester);

    // Generate audio
    const audio = await generateSpeech(summary.text);

    // Convert to OGG/Opus for WhatsApp voice note
    const oggPath = await convertToOggOpus(audio.filePath);

    // Send voice note
    const voiceMedia = MessageMedia.fromFilePath(oggPath);
    const timeFrom = summary.timespan.from.toLocaleString();
    const timeTo = summary.timespan.to.toLocaleString();

    await chat.sendMessage(
      `🔊 *Pulse Catchup* — ${summary.messageCount} messages\n📅 ${timeFrom} → ${timeTo}\n\n🎙️ *Reply to this message with a voice note to ask me follow-up questions!*`
    );
    await chat.sendMessage(voiceMedia, { sendAudioAsVoice: true });

    // Send task checklist if tasks found
    const taskList = formatTaskChecklist(summary.tasks);
    if (taskList) {
      await chat.sendMessage(taskList);
    }

    // Record catchup
    markCatchup(chatId, 'whatsapp', mergedMessages.length);

    // Cleanup
    cleanupAudioFile(audio.filePath);
    cleanupTempFile(oggPath);

    console.log(`📋 WA Catchup delivered: ${mergedMessages.length} messages → ${(audio.durationMs / 1000).toFixed(1)}s audio`);
  } catch (error) {
    console.error('❌ WhatsApp catchup error:', error);
    await chat.sendMessage('❌ Something went wrong generating your catchup. Please try again.');
  }
}
