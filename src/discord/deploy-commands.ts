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
      option.setName('mode')
        .setDescription('Persona or style for the summary')
        .addChoices(
          { name: 'Standard (Professional)', value: 'standard' },
          { name: 'Marcus (Fun & Energetic)', value: 'fun' },
          { name: 'RoastMaster (Sarcastic)', value: 'roast' },
          { name: 'Storyteller (Dramatic)', value: 'story' },
          { name: 'Urgent (Action-oriented)', value: 'urgent' },
          { name: 'Executive Manager', value: 'manager' },
          { name: 'Empathic Supporter', value: 'empathic' },
          { name: 'For Me (Personalized)', value: 'for-me' }
        ))
    .addStringOption(option => 
      option.setName('timeframe')
        .setDescription('Timeframe to summarize (e.g. 1hr, 2hrs, 1d)'))
    .addUserOption(option => 
      option.setName('user')
        .setDescription('Focus the summary specifically on this user'))
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
