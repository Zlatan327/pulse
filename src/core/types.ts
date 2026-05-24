/** Supported chat platforms */
export type Platform = 'discord' | 'telegram' | 'whatsapp';

/** Catchup persona modes */
export type CatchupMode = 'standard' | 'fun' | 'roast' | 'story' | 'urgent';

/** Normalized message from any platform */
export interface PlatformMessage {
  id: string;
  platform: Platform;
  chatId: string;
  userId: string;
  username: string;
  text: string | null;
  messageType: 'text' | 'voice' | 'document' | 'image';
  filePath: string | null;
  timestamp: Date;
  rawData?: unknown;
}

/** Result from the summarization engine */
export interface ChatSummary {
  text: string;
  tasks: TaskItem[];
  messageCount: number;
  timespan: {
    from: Date;
    to: Date;
  };
}

/** An extracted task/action item */
export interface TaskItem {
  assignee: string;
  description: string;
  deadline: string | null;
  priority: 'high' | 'medium' | 'low';
}

/** Generated audio result */
export interface AudioResult {
  buffer: Buffer;
  filePath: string;
  format: 'mp3' | 'ogg';
  durationMs: number;
}

/** Transcription result from speech-to-text */
export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
}

/** Catchup log entry */
export interface CatchupEntry {
  chatId: string;
  platform: Platform;
  timestamp: Date;
  messageCount: number;
}
