import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`❌ Missing required environment variable: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  // AI Services
  gemini: {
    apiKey: required('GEMINI_API_KEY'),
  },
  elevenlabs: {
    apiKey: required('ELEVENLABS_API_KEY'),
    voiceId: required('ELEVENLABS_VOICE_ID'),
    modelId: optional('ELEVENLABS_MODEL_ID', 'eleven_flash_v2_5'),
  },

  // Platforms
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },
  whatsapp: {
    enabled: process.env.WHATSAPP_ENABLED === 'true',
  },
  x: {
    username: process.env.X_USERNAME || '',
    password: process.env.X_PASSWORD || '',
    email: process.env.X_EMAIL || '',
  },

  // General
  enabledPlatforms: optional('ENABLED_PLATFORMS', 'discord').split(',').map(p => p.trim().toLowerCase()),
  summaryMaxMessages: parseInt(optional('SUMMARY_MAX_MESSAGES', '100'), 10),
  summaryTargetDuration: parseInt(optional('SUMMARY_TARGET_DURATION', '30'), 10),
  defaultLanguage: optional('DEFAULT_LANGUAGE', 'en'),
  logLevel: optional('LOG_LEVEL', 'info'),

  // Paths
  dataDir: path.resolve(__dirname, '../../data'),
  tmpDir: path.resolve(__dirname, '../../data/tmp'),
  dbPath: path.resolve(__dirname, '../../data/pulse.db'),
} as const;

/** Validate that required config for a specific platform is present */
export function validatePlatform(platform: string): void {
  switch (platform) {
    case 'discord':
      if (!config.discord.token) throw new Error('❌ DISCORD_TOKEN is required to run the Discord adapter');
      if (!config.discord.clientId) throw new Error('❌ DISCORD_CLIENT_ID is required to run the Discord adapter');
      break;
    case 'telegram':
      if (!config.telegram.botToken) throw new Error('❌ TELEGRAM_BOT_TOKEN is required to run the Telegram adapter');
      break;
    case 'whatsapp':
      if (!config.whatsapp.enabled) throw new Error('❌ WHATSAPP_ENABLED must be true to run the WhatsApp adapter');
      break;
    case 'x':
      if (!config.x.username || !config.x.password) {
        throw new Error('❌ X_USERNAME and X_PASSWORD are required to run the X adapter');
      }
      break;
  }
}
