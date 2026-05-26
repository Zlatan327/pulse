import { ElevenLabsClient } from 'elevenlabs';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import type { AudioResult } from './types.js';
import { speedUpAudio } from './audio.js';

const elevenlabs = new ElevenLabsClient({
  apiKey: config.elevenlabs.apiKey,
});

/** Generate speech audio from text using ElevenLabs */
export async function generateSpeech(text: string): Promise<AudioResult> {
  const outputFileName = `pulse_${Date.now()}.mp3`;
  const outputPath = path.join(config.tmpDir, outputFileName);

  // Ensure tmp directory exists
  fs.mkdirSync(config.tmpDir, { recursive: true });

  console.log(`🔊 Generating speech (${text.length} chars, model: ${config.elevenlabs.modelId})...`);

  const audio = await elevenlabs.textToSpeech.convert(config.elevenlabs.voiceId, {
    text,
    model_id: config.elevenlabs.modelId,
    output_format: 'mp3_44100_128',
  });

  // The response is a Readable stream — collect into buffer
  const chunks: Buffer[] = [];
  for await (const chunk of audio) {
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  // Save to file
  fs.writeFileSync(outputPath, buffer);

  // Estimate initial duration: MP3 at 128kbps -> bytes * 8 / 128000 * 1000
  let estimatedDurationMs = Math.round((buffer.length * 8) / 128000 * 1000);
  console.log(`✅ Base Audio generated: ${outputPath} (${(buffer.length / 1024).toFixed(1)}KB, ~${(estimatedDurationMs / 1000).toFixed(1)}s)`);

  // Speed up audio by 1.15x for a more natural, upbeat pace
  let finalBuffer = buffer;
  let finalPath = outputPath;
  try {
    const fastPath = await speedUpAudio(outputPath, 1.15);
    finalBuffer = fs.readFileSync(fastPath);
    estimatedDurationMs = Math.round(estimatedDurationMs / 1.15);
    
    // Clean up original slow file
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    finalPath = fastPath;
  } catch (e) {
    console.error('⚠️ Failed to speed up audio, falling back to base rate:', e);
  }

  return {
    buffer: finalBuffer,
    filePath: finalPath,
    format: 'mp3',
    durationMs: estimatedDurationMs,
  };
}

/** Clean up temporary audio files */
export function cleanupAudioFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`⚠️ Failed to clean up audio file: ${filePath}`);
  }
}
