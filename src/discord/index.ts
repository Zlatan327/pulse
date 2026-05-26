import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config, validatePlatform, initDatabase, deleteMessageByExternalId } from '../core/index.js';
import { handleReady } from './events/ready.js';
import { handleMessageCreate } from './events/messageCreate.js';
import { handleInteractionCreate } from './events/interactionCreate.js';

/** Start the Discord bot adapter */
export async function startDiscord(): Promise<Client> {
  validatePlatform('discord');
  initDatabase();



  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  // Register event handlers
  handleReady(client);
  handleMessageCreate(client);
  handleInteractionCreate(client);

  // Handle deleted messages
  client.on('messageDelete', (message) => {
    deleteMessageByExternalId(message.id, 'discord');
  });
  client.on('messageDeleteBulk', (messages) => {
    messages.forEach(message => deleteMessageByExternalId(message.id, 'discord'));
  });

  await client.login(config.discord.token);
  return client;
}

// If run directly
const isDirectRun = process.argv[1]?.includes('discord');
if (isDirectRun) {
  startDiscord().catch((error) => {
    console.error('❌ Failed to start Discord adapter:', error);
    process.exit(1);
  });
}
