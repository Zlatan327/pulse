import type { Client } from 'discord.js';

export function handleReady(client: Client): void {
  client.once('ready', (readyClient) => {
    console.log('━'.repeat(50));
    console.log('⚡ PULSE — Discord Adapter');
    console.log(`✅ Logged in as ${readyClient.user.tag}`);
    console.log(`📡 Serving ${readyClient.guilds.cache.size} server(s)`);
    console.log(`🔗 Invite: https://discord.com/api/oauth2/authorize?client_id=${readyClient.user.id}&permissions=274877991936&scope=bot%20applications.commands`);
    console.log('━'.repeat(50));
  });
}
