import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from '../core/config.js';

const commands = [
  new SlashCommandBuilder()
    .setName('catchup')
    .setDescription('Get an audio summary of recent messages in this channel')
    .addIntegerOption(option =>
      option
        .setName('messages')
        .setDescription('Number of messages to summarize (default: 100)')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(500)
    )
    .addStringOption(option =>
      option
        .setName('mode')
        .setDescription('Personality mode for the summary')
        .setRequired(false)
        .addChoices(
          { name: 'Standard', value: 'standard' },
          { name: 'Fun', value: 'fun' },
          { name: 'Roast', value: 'roast' },
          { name: 'Story', value: 'story' },
          { name: 'Urgent', value: 'urgent' }
        )
    )
    .toJSON(),
];

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
