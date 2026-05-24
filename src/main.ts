/**
 * Pulse — Unified Entry Point
 * 
 * Starts the enabled platform adapters based on the ENABLED_PLATFORMS env var.
 * Usage:
 *   npm start              — starts all enabled platforms
 *   npm run start:discord  — starts only Discord
 *   npm run start:telegram — starts only Telegram
 *   npm run start:whatsapp — starts only WhatsApp
 */

import { config, initDatabase } from './core/index.js';

async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║              ⚡ PULSE — AI Chat Companion        ║');
  console.log('║     Audio summaries for Discord, Telegram & WA   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // Initialize shared database
  initDatabase();

  const platforms = config.enabledPlatforms;
  console.log(`📡 Enabled platforms: ${platforms.join(', ')}`);
  console.log('');

  const startPromises: Promise<void>[] = [];

  // Start Discord adapter
  if (platforms.includes('discord')) {
    startPromises.push(
      (async () => {
        try {
          const { startDiscord } = await import('./discord/index.js');
          await startDiscord();
          console.log('✅ Discord adapter started');
        } catch (error) {
          console.error('❌ Failed to start Discord adapter:', error);
        }
      })()
    );
  }

  // Start Telegram adapter
  if (platforms.includes('telegram')) {
    startPromises.push(
      (async () => {
        try {
          const { startTelegram } = await import('./telegram/index.js');
          await startTelegram();
          console.log('✅ Telegram adapter started');
        } catch (error) {
          console.error('❌ Failed to start Telegram adapter:', error);
        }
      })()
    );
  }

  // Start WhatsApp adapter
  if (platforms.includes('whatsapp')) {
    startPromises.push(
      (async () => {
        try {
          const { startWhatsApp } = await import('./whatsapp/index.js');
          await startWhatsApp();
          console.log('✅ WhatsApp adapter started');
        } catch (error) {
          console.error('❌ Failed to start WhatsApp adapter:', error);
        }
      })()
    );
  }

  // Start X adapter
  if (platforms.includes('x')) {
    startPromises.push(
      (async () => {
        try {
          const { startX } = await import('./x/index.js');
          await startX();
          console.log('✅ X (Twitter) adapter started');
        } catch (error) {
          console.error('❌ Failed to start X (Twitter) adapter:', error);
        }
      })()
    );
  }

  if (startPromises.length === 0) {
    console.warn('⚠️  No platforms enabled! Set ENABLED_PLATFORMS in your .env file.');
    console.warn('   Example: ENABLED_PLATFORMS=discord,telegram,whatsapp');
    process.exit(1);
  }

  // Wait for all platforms to initialize
  await Promise.all(startPromises);

  console.log('');
  console.log('🚀 Pulse is running! Press Ctrl+C to stop.');

  // Graceful shutdown
  const { closeDatabase } = await import('./core/index.js');
  const shutdown = () => {
    console.log('\n👋 Shutting down Pulse...');
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
