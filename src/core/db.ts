import Database from 'better-sqlite3';
import { config } from './config.js';
import type { PlatformMessage, Platform, CatchupEntry } from './types.js';
import fs from 'fs';

// Ensure data directory exists
fs.mkdirSync(config.dataDir, { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

/** Initialize database schema */
export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      text TEXT,
      message_type TEXT NOT NULL DEFAULT 'text',
      file_path TEXT,
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat_time 
      ON messages(chat_id, platform, timestamp DESC);

    CREATE INDEX IF NOT EXISTS idx_messages_platform 
      ON messages(platform);

    CREATE TABLE IF NOT EXISTS catchup_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      message_count INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_catchup_chat 
      ON catchup_log(chat_id, platform, timestamp DESC);
  `);

  console.log('✅ Database initialized');
}

/** Log a message to the database */
export function logMessage(msg: PlatformMessage): void {
  const stmt = db.prepare(`
    INSERT INTO messages (platform, chat_id, user_id, username, text, message_type, file_path, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    msg.platform,
    msg.chatId,
    msg.userId,
    msg.username,
    msg.text,
    msg.messageType,
    msg.filePath,
    msg.timestamp.toISOString()
  );
}

/** Get recent messages for a chat, optionally since a specific timestamp */
export function getRecentMessages(
  chatId: string,
  platform: Platform,
  limit: number = 100,
  since?: Date
): PlatformMessage[] {
  let query: string;
  let params: unknown[];

  if (since) {
    query = `
      SELECT * FROM messages 
      WHERE chat_id = ? AND platform = ? AND timestamp > ?
      ORDER BY timestamp ASC
      LIMIT ?
    `;
    params = [chatId, platform, since.toISOString(), limit];
  } else {
    query = `
      SELECT * FROM messages 
      WHERE chat_id = ? AND platform = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    params = [chatId, platform, limit];
  }

  const rows = db.prepare(query).all(...params) as any[];

  // If we fetched DESC (no since), reverse to chronological
  if (!since) rows.reverse();

  return rows.map(row => ({
    id: String(row.id),
    platform: row.platform as Platform,
    chatId: row.chat_id,
    userId: row.user_id,
    username: row.username,
    text: row.text,
    messageType: row.message_type,
    filePath: row.file_path,
    timestamp: new Date(row.timestamp),
  }));
}

/** Get the last catchup timestamp for a chat */
export function getLastCatchup(chatId: string, platform: Platform): CatchupEntry | null {
  const row = db.prepare(`
    SELECT * FROM catchup_log 
    WHERE chat_id = ? AND platform = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `).get(chatId, platform) as any;

  if (!row) return null;

  return {
    chatId: row.chat_id,
    platform: row.platform as Platform,
    timestamp: new Date(row.timestamp),
    messageCount: row.message_count,
  };
}

/** Record a catchup event */
export function markCatchup(chatId: string, platform: Platform, messageCount: number): void {
  db.prepare(`
    INSERT INTO catchup_log (chat_id, platform, message_count)
    VALUES (?, ?, ?)
  `).run(chatId, platform, messageCount);
}

/** Get total message count for a chat */
export function getMessageCount(chatId: string, platform: Platform): number {
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM messages 
    WHERE chat_id = ? AND platform = ?
  `).get(chatId, platform) as any;
  return row.count;
}

/** Close the database connection */
export function closeDatabase(): void {
  db.close();
  console.log('📦 Database connection closed');
}
