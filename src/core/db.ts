import Database from 'better-sqlite3';
import { config } from './config.js';
import type { PlatformMessage, Platform, CatchupEntry } from './types.js';
import fs from 'fs';
import crypto from 'crypto';

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
      external_id TEXT,
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
  `);

  // Migration: add external_id column if it doesn't exist (for older databases)
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN external_id TEXT;`);
  } catch (e) {
    // Column likely already exists
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_external_id 
      ON messages(external_id, platform);
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

    CREATE TABLE IF NOT EXISTS chat_settings (
      chat_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      daily_digest BOOLEAN DEFAULT 0,
      digest_time TEXT DEFAULT '18:00',
      PRIMARY KEY (chat_id, platform)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      provider TEXT NOT NULL,
      providerAccountId TEXT NOT NULL,
      access_token TEXT,
      UNIQUE(provider, providerAccountId)
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      voice_style TEXT DEFAULT 'standard',
      language TEXT DEFAULT 'en'
    );

    CREATE TABLE IF NOT EXISTS audio_summaries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      title TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watchlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      target TEXT NOT NULL,
      frequency TEXT DEFAULT 'daily',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  console.log('✅ Database initialized');
}

/** Log a message to the database */
export function logMessage(msg: PlatformMessage): void {
  const stmt = db.prepare(`
    INSERT INTO messages (external_id, platform, chat_id, user_id, username, text, message_type, file_path, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    msg.id,
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
      WHERE chat_id = ? AND platform = ? AND timestamp >= ?
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
    id: row.external_id || String(row.id),
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

/** Get a specific message by its platform ID (useful for replies) */
export function getMessageById(id: string, platform: Platform): PlatformMessage | null {
  const row = db.prepare(`
    SELECT * FROM messages 
    WHERE external_id = ? AND platform = ?
    LIMIT 1
  `).get(id, platform) as any;

  if (!row) return null;

  return {
    id: row.external_id || String(row.id),
    platform: row.platform as Platform,
    chatId: row.chat_id,
    userId: row.user_id,
    username: row.username,
    text: row.text,
    messageType: row.message_type,
    filePath: row.file_path,
    timestamp: new Date(row.timestamp),
  };
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

/** Record a generated audio summary */
export function logSummary(userId: string, platform: string, title: string, durationSeconds: number): void {
  db.prepare(`
    INSERT INTO audio_summaries (id, user_id, platform, title, duration_seconds)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), userId, platform, title, durationSeconds);
}

/** Get user settings based on their platform ID */
export function getUserSettingsByPlatformId(platform: string, providerAccountId: string): { userId: string, voiceStyle: string, language: string } | null {
  const row = db.prepare(`
    SELECT u.id as userId, s.voice_style as voiceStyle, s.language as language
    FROM accounts a
    JOIN users u ON a.userId = u.id
    LEFT JOIN user_settings s ON u.id = s.user_id
    WHERE a.provider = ? AND a.providerAccountId = ?
  `).get(platform, providerAccountId) as any;

  if (!row) return null;
  return {
    userId: row.userId,
    voiceStyle: row.voiceStyle || 'Standard (Professional)',
    language: row.language || 'English'
  };
}

/** Delete a message from the local database by its platform ID */
export function deleteMessageByExternalId(externalId: string, platform: Platform): void {
  db.prepare(`
    DELETE FROM messages 
    WHERE external_id = ? AND platform = ?
  `).run(externalId, platform);
}

export interface ChatSettings {
  chatId: string;
  platform: Platform;
  dailyDigest: boolean;
  digestTime: string;
}

export function getChatSettings(chatId: string, platform: Platform): ChatSettings {
  const row = db.prepare(`SELECT * FROM chat_settings WHERE chat_id = ? AND platform = ?`).get(chatId, platform) as any;
  if (!row) {
    db.prepare(`INSERT INTO chat_settings (chat_id, platform, daily_digest, digest_time) VALUES (?, ?, 0, '18:00')`).run(chatId, platform);
    return { chatId, platform, dailyDigest: false, digestTime: '18:00' };
  }
  return {
    chatId: row.chat_id,
    platform: row.platform as Platform,
    dailyDigest: Boolean(row.daily_digest),
    digestTime: row.digest_time
  };
}

export function updateChatSettings(chatId: string, platform: Platform, updates: Partial<ChatSettings>): void {
  const current = getChatSettings(chatId, platform);
  const next = { ...current, ...updates };
  db.prepare(`
    UPDATE chat_settings 
    SET daily_digest = ?, digest_time = ? 
    WHERE chat_id = ? AND platform = ?
  `).run(next.dailyDigest ? 1 : 0, next.digestTime, chatId, platform);
}

export function getAllActiveDailyChats(): ChatSettings[] {
  const rows = db.prepare(`SELECT * FROM chat_settings WHERE daily_digest = 1`).all() as any[];
  return rows.map(r => ({
    chatId: r.chat_id,
    platform: r.platform as Platform,
    dailyDigest: Boolean(r.daily_digest),
    digestTime: r.digest_time
  }));
}

export interface WatchlistItem {
  id: string;
  userId: string;
  type: 'account' | 'topic' | 'space_topic';
  target: string;
  frequency: string;
}

export function getAllWatchlists(): WatchlistItem[] {
  const rows = db.prepare(`SELECT * FROM watchlists`).all() as any[];
  return rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    target: r.target,
    frequency: r.frequency
  }));
}
