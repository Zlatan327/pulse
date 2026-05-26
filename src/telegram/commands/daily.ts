import { PulseContext } from '../index.js';
import { updateChatSettings } from '../../core/index.js';

export async function handleDaily(ctx: PulseContext): Promise<void> {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  // Expected format: /daily on 18:00
  const args = ctx.match?.toString().trim().split(/\s+/) || [];
  const action = args[0]?.toLowerCase();
  
  if (action === 'on' || action === 'enable') {
    const time = args[1] || '18:00';
    if (!time.match(/^\d{2}:\d{2}$/)) {
      await ctx.reply('❌ Invalid time format. Please use 24h format, e.g., `/daily on 18:00`');
      return;
    }
    updateChatSettings(chatId, 'telegram', { dailyDigest: true, digestTime: time });
    await ctx.reply(`✅ **Daily Pulse Minutes** enabled!\nI will send an automated summary to this group every day at \`${time}\`.`, { parse_mode: 'Markdown' });
  } else if (action === 'off' || action === 'disable') {
    updateChatSettings(chatId, 'telegram', { dailyDigest: false });
    await ctx.reply(`🛑 **Daily Pulse Minutes** disabled for this group.`, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(`ℹ️ **Pulse Daily Minutes**\n\nTo enable automated daily summaries, type:\n\`/daily on 18:00\`\n\nTo disable, type:\n\`/daily off\``, { parse_mode: 'Markdown' });
  }
}
