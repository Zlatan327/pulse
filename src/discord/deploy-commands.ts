import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from '../core/config.js';

const commands = [
  new SlashCommandBuilder()
    .setName('catchup')
    .setDescription('Summarize recent messages in this channel')
    .addStringOption(option => 
      option.setName('timeframe')
        .setDescription('How far back to summarize (e.g., "15m", "2h", "1d")')
        .setRequired(false))
    .addIntegerOption(option => 
      option.setName('messages')
        .setDescription('Number of messages to summarize (default: 50)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Choose a personality for the summary')
        .addChoices(
          { name: 'Standard (Default)', value: 'standard' },
          { name: 'Fun & Energetic', value: 'fun' },
          { name: 'Roast Mode (Sarcastic)', value: 'roast' },
          { name: 'Epic Story', value: 'story' },
          { name: 'Urgent/Action-oriented', value: 'urgent' },
          { name: 'Executive/Manager', value: 'manager' },
          { name: 'Empathic/Supportive', value: 'empathic' },
          { name: 'Just For Me', value: 'for-me' }
        )
        .setRequired(false))
    .addUserOption(option => 
      option.setName('user')
        .setDescription('Focus the summary strictly on this user')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('format')
        .setDescription('Output format: audio or text')
        .addChoices(
          { name: 'Audio (Default)', value: 'audio' },
          { name: 'Text Only', value: 'text' }
        )
        .setRequired(false))
    .addStringOption(option =>
      option.setName('delivery')
        .setDescription('Where to deliver the summary')
        .addChoices(
          { name: 'Public (Thread)', value: 'public' },
          { name: 'Private (DM)', value: 'private' }
        )
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Enable or disable automated daily summaries for this channel')
    .addBooleanOption(option =>
      option.setName('enable')
        .setDescription('Enable or disable the daily digest')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('time')
        .setDescription('Time of day to deliver in 24h format (e.g., 18:00)')
        .setRequired(false))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(config.discord.token);

async function deployCommands() {
  try {
    console.log('🚀 Registering Discord slash commands...');

    // Register globally (takes up to 1 hour to propagate)
    const data = await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: commands },
    ) as unknown[];

    console.log(`✅ Successfully registered ${data.length} global command(s).`);
    console.log('ℹ️  Global commands may take up to 1 hour to appear in all servers.');
    console.log('💡 For instant updates during development, use guild-scoped commands instead.');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    process.exit(1);
  }
}

deployCommands();
