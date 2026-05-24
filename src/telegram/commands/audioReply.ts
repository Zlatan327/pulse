import type { Context } from 'grammy';
import { logMessage } from '../../core/index.js';

export async function handleAudioReply(ctx: Context): Promise<void> {
  if (!ctx.chat || !ctx.from) return;
  
  logMessage({
    id: String(ctx.message?.message_id || Date.now()),
    platform: 'telegram',
    chatId: String(ctx.chat.id),
    userId: String(ctx.from.id),
    username: ctx.from.first_name || ctx.from.username || 'user',
    text: '[Voice Note]',
    messageType: 'voice',
    filePath: null,
    timestamp: new Date(),
  });
}
