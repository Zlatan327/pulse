import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';

// Set ffmpeg binary path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as unknown as string);
}

/** Convert any audio file to MP3 (for Whisper compatibility) */
export function convertToMp3(inputPath: string): Promise<string> {
  const outputPath = path.join(
    config.tmpDir,
    `converted_${Date.now()}.mp3`
  );

  fs.mkdirSync(config.tmpDir, { recursive: true });

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .format('mp3')
      .output(outputPath)
      .on('end', () => {
        console.log(`🔄 Converted to MP3: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err: Error) => {
        console.error(`❌ MP3 conversion failed: ${err.message}`);
        reject(err);
      })
      .run();
  });
}

/** Convert any audio file to OGG/Opus (for Telegram & WhatsApp voice notes) */
export function convertToOggOpus(inputPath: string): Promise<string> {
  const outputPath = path.join(
    config.tmpDir,
    `voice_${Date.now()}.ogg`
  );

  fs.mkdirSync(config.tmpDir, { recursive: true });

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libopus')
      .audioBitrate('64k')
      .audioChannels(1)
      .audioFrequency(48000)
      .format('ogg')
      .output(outputPath)
      .on('end', () => {
        console.log(`🔄 Converted to OGG/Opus: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err: Error) => {
        console.error(`❌ OGG/Opus conversion failed: ${err.message}`);
        reject(err);
      })
      .run();
  });
}

/** Clean up a temporary file */
export function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`⚠️ Failed to clean up temp file: ${filePath}`);
  }
}
