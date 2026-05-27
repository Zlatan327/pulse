import { PlaywrightScraper as Scraper } from './playwrightScraper.js';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { config } from '../core/config.js';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as unknown as string);
}

/**
 * Downloads the HLS audio stream from an X Space.
 * Caps the download at 45 minutes to keep file sizes within Gemini API limits.
 * Compresses to 24kbps mono MP3.
 * 
 * @param spaceId The ID of the X Space
 * @param scraper The authenticated Scraper instance
 * @returns The path to the downloaded MP3 file
 */
export async function downloadSpaceAudio(spaceId: string, scraper: Scraper): Promise<string> {
  console.log(`🎙️ Fetching details for Space ${spaceId}...`);
  
  // Cast scraper to any to access space methods
  const s = scraper as any;
  const audioSpace = await s.getAudioSpaceById(spaceId);

  if (!audioSpace || !audioSpace.metadata) {
    throw new Error('Could not retrieve Space metadata.');
  }

  if (audioSpace.metadata.state !== 'Ended') {
    throw new Error(`Space is currently ${audioSpace.metadata.state}. Pulse only summarizes recorded/ended spaces.`);
  }

  const mediaKey = audioSpace.metadata.media_key;
  if (!mediaKey) {
    throw new Error('Media key not found for this Space.');
  }

  console.log(`🎙️ Fetching audio stream status for media key ${mediaKey}...`);
  const status = await s.getAudioSpaceStreamStatus(mediaKey);
  
  if (!status || !status.source || !status.source.location) {
    throw new Error('Could not retrieve HLS stream URL for this Space.');
  }

  const hlsUrl = status.source.location;
  console.log(`📡 HLS Stream found: ${hlsUrl}`);

  const outputPath = path.join(
    config.tmpDir,
    `space_${spaceId}_${Date.now()}.mp3`
  );

  fs.mkdirSync(config.tmpDir, { recursive: true });

  console.log(`⬇️ Downloading and compressing Space audio (capped at 45 mins)...`);

  return new Promise((resolve, reject) => {
    ffmpeg(hlsUrl)
      // Input options
      .inputOptions([
        '-protocol_whitelist file,http,https,tcp,tls,crypto'
      ])
      // Cap duration at 45 minutes (2700 seconds)
      .duration(2700)
      // Output options for high compression (radio quality voice)
      .audioCodec('libmp3lame')
      .audioBitrate('24k')
      .audioChannels(1)
      .audioFrequency(16000)
      .format('mp3')
      .output(outputPath)
      .on('end', () => {
        console.log(`✅ Space audio downloaded successfully: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err: Error) => {
        console.error(`❌ Space audio download failed: ${err.message}`);
        reject(err);
      })
      .run();
  });
}
