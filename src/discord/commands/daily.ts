import type { ChatInputCommandInteraction } from 'discord.js';
import { updateChatSettings } from '../../core/index.js';

export async function handleDaily(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const enable = interaction.options.getBoolean('enable', true);
  const time = interaction.options.getString('time') || '18:00';

  if (enable && !time.match(/^\d{2}:\d{2}$/)) {
    await interaction.editReply('❌ Invalid time format. Please use 24h format, e.g., "18:00" or "09:30".');
    return;
  }

  updateChatSettings(interaction.channelId, 'discord', {
    dailyDigest: enable,
    digestTime: time
  });

  if (enable) {
    await interaction.editReply(`✅ **Daily Pulse Minutes** have been **enabled** for this channel!\nYou will receive a daily summary and detailed meeting minutes at \`${time}\` every day.`);
  } else {
    await interaction.editReply(`🛑 **Daily Pulse Minutes** have been **disabled** for this channel.`);
  }
}
