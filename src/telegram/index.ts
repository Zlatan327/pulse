import { Bot } from 'grammy';
import { config, validatePlatform, initDatabase } from '../core/index.js';
import { messageLogger } from './middleware/logger.js';
import { handleCatchup } from './commands/catchup.js';

/** Start the Telegram bot adapter */
export async function startTelegram(): Promise<Bot> {
  validatePlatform('telegram');
  initDatabase();

  const bot = new Bot(config.telegram.botToken);

  // Install middleware (must be before command handlers)
  bot.use(messageLogger);

  // Register commands
  bot.command('catchup', handleCatchup);

  // Set bot commands menu
  await bot.api.setMyCommands([
    { command: 'catchup', description: 'Get an audio summary of recent messages' },
  ]);

  // Error handler
  bot.catch((err) => {
    console.error('❌ Telegram bot error:', err);
  });

  // Start polling
  bot.start({
    onStart: (botInfo) => {
      console.log('━'.repeat(50));
      console.log('⚡ PULSE — Telegram Adapter');
      console.log(`✅ Bot started: @${botInfo.username}`);
      console.log('⚠️  Make sure Privacy Mode is DISABLED via @BotFather');
      console.log('━'.repeat(50));
    },
  });

  return bot;
}

// If run directly
const isDirectRun = process.argv[1]?.includes('telegram');
if (isDirectRun) {
  startTelegram().catch((error) => {
    console.error('❌ Failed to start Telegram adapter:', error);
    process.exit(1);
  });
}
