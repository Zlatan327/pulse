import { Bot, Context } from 'grammy';
import { FileFlavor, hydrateFiles } from '@grammyjs/files';
import { config, validatePlatform, initDatabase } from '../core/index.js';
import { messageLogger } from './middleware/logger.js';
import { handleCatchup } from './commands/catchup.js';
import { handleAudioReply } from './commands/audioReply.js';
import { handleHelp } from './commands/help.js';
import { handleDaily } from './commands/daily.js';

export type PulseContext = FileFlavor<Context>;

// Export bot so other adapters (like X) can send DMs
export let bot: Bot<PulseContext>;

/** Start the Telegram adapter */
export async function startTelegram(): Promise<Bot<PulseContext>> {
  validatePlatform('telegram');
  initDatabase();

  bot = new Bot<PulseContext>(config.telegram.botToken);
  bot.api.config.use(hydrateFiles(bot.token));

  // Install middleware (must be before command handlers)
  bot.use(messageLogger);

  // Register commands
  bot.command('catchup', handleCatchup);
  bot.command('help', handleHelp);
  bot.command('daily', handleDaily);
  bot.on('message:audio', handleAudioReply);
  bot.on('message:voice', handleAudioReply);

  // Set bot commands menu (fire-and-forget — don't block startup)
  bot.api.setMyCommands([
    { command: 'catchup', description: 'Get an audio summary of recent messages' },
    { command: 'daily', description: 'Enable/disable automated daily summaries' },
    { command: 'help', description: 'See advanced Pulse catchup instructions' }
  ]).catch((err) => console.warn('⚠️ Could not set commands menu (non-critical):', err.message));

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
