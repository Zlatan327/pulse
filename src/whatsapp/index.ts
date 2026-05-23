import pkg from 'whatsapp-web.js';
const { Client: WAClient, LocalAuth } = pkg;
import { config, validatePlatform, initDatabase } from '../core/index.js';
import { registerMessageHandlers } from './handlers/message.js';

/** Start the WhatsApp bot adapter */
export async function startWhatsApp(): Promise<InstanceType<typeof WAClient>> {
  validatePlatform('whatsapp');
  initDatabase();

  console.log('━'.repeat(50));
  console.log('⚡ PULSE — WhatsApp Adapter');
  console.log('📱 Initializing WhatsApp Web connection...');
  console.log('━'.repeat(50));

  const client = new WAClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });

  // QR Code event — user needs to scan this
  client.on('qr', (qr: string) => {
    console.log('\n📱 Scan the QR code below with WhatsApp:');
    console.log('Open WhatsApp → Settings → Linked Devices → Link a Device\n');
    // For terminal display, we'll print the QR string
    // In production, consider using 'qrcode-terminal' package
    console.log(qr);
    console.log('\n💡 Tip: Install \'qrcode-terminal\' for a scannable QR code in the terminal.\n');
  });

  // Authentication events
  client.on('authenticated', () => {
    console.log('✅ WhatsApp authenticated successfully!');
  });

  client.on('auth_failure', (error: string) => {
    console.error('❌ WhatsApp authentication failed:', error);
    process.exit(1);
  });

  // Ready event
  client.on('ready', () => {
    console.log('━'.repeat(50));
    console.log('✅ WhatsApp bot is ready!');
    console.log('💬 Listening for messages in group chats...');
    console.log('💡 Type /catchup in any group chat to get a summary');
    console.log('━'.repeat(50));
  });

  // Disconnection handling
  client.on('disconnected', (reason: string) => {
    console.warn('⚠️ WhatsApp disconnected:', reason);
    console.log('🔄 Attempting to reconnect...');
    client.initialize();
  });

  // Register message handlers
  registerMessageHandlers(client);

  // Initialize the client
  await client.initialize();

  return client;
}

// If run directly
const isDirectRun = process.argv[1]?.includes('whatsapp');
if (isDirectRun) {
  startWhatsApp().catch((error) => {
    console.error('❌ Failed to start WhatsApp adapter:', error);
    process.exit(1);
  });
}
