import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { convertToMp3 } from './audio.js';
import type { TranscriptionResult } from './types.js';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/** Supported audio formats for Gemini */
const GEMINI_FORMATS = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm', '.ogg'];

/** Transcribe an audio file using Gemini 1.5 Flash natively */
export async function transcribeAudio(filePath: string): Promise<TranscriptionResult> {
  const ext = path.extname(filePath).toLowerCase();

  // Convert to mp3 if not in a supported format
  let processedPath = filePath;
  if (!GEMINI_FORMATS.includes(ext)) {
    console.log(`🔄 Converting ${ext} to mp3 for transcription...`);
    processedPath = await convertToMp3(filePath);
  }

  try {
    const audioData = fs.readFileSync(processedPath);
    let mimeType = 'audio/mp3';
    if (ext === '.ogg') mimeType = 'audio/ogg';
    else if (ext === '.wav') mimeType = 'audio/wav';
    
    const inlineData = {
      inlineData: {
        data: audioData.toString('base64'),
        mimeType
      }
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'Listen to this audio. Transcribe the spoken text exactly and detect the language. Do not output anything else.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            text: { type: SchemaType.STRING, description: 'The exact transcription of the audio' },
            language: { type: SchemaType.STRING, description: 'The ISO 639-1 language code (e.g. en, es, fr) of the detected language' }
          },
          required: ['text', 'language']
        }
      }
    });

    const response = await model.generateContent([
      "Transcribe this audio file and return JSON.",
      inlineData
    ]);

    const content = response.response.text();
    const resultJson = JSON.parse(content);

    const result: TranscriptionResult = {
      text: resultJson.text || '',
      language: resultJson.language || 'unknown',
      confidence: 1.0, 
    };

    console.log(`🎤 Transcribed (${result.language}): "${result.text.substring(0, 80)}..."`);
    return result;
  } catch (e) {
    console.error('⚠️ Transcription failed', e);
    return { text: '', language: 'unknown', confidence: 0 };
  } finally {
    // Clean up converted file if we created one
    if (processedPath !== filePath && fs.existsSync(processedPath)) {
      fs.unlinkSync(processedPath);
    }
  }
}
