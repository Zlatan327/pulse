import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/** Map of ISO 639-1 codes to language names */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German',
  it: 'Italian', pt: 'Portuguese', ru: 'Russian', zh: 'Chinese',
  ja: 'Japanese', ko: 'Korean', ar: 'Arabic', hi: 'Hindi',
  nl: 'Dutch', sv: 'Swedish', pl: 'Polish', tr: 'Turkish',
};

/** Check if a detected language should be translated */
export function shouldTranslate(detectedLanguage: string, targetLanguage?: string): boolean {
  const target = targetLanguage || config.defaultLanguage;
  // Don't translate if same language or unknown
  if (detectedLanguage === target || detectedLanguage === 'unknown') return false;
  return true;
}

/** Get human-readable language name */
export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code.toUpperCase();
}

/** Translate text from one language to another */
export async function translateText(
  text: string,
  fromLanguage: string,
  toLanguage?: string
): Promise<string> {
  const target = toLanguage || config.defaultLanguage;
  const fromName = getLanguageName(fromLanguage);
  const toName = getLanguageName(target);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: `You are a professional translator. Translate the following text from ${fromName} to ${toName}. Maintain the original tone, meaning, and nuance. Return ONLY the translated text, nothing else.`,
  });

  try {
    const response = await model.generateContent(text);
    const translated = response.response.text() || text;
    console.log(`🌍 Translated ${fromName} → ${toName}: "${translated.substring(0, 60)}..."`);
    return translated;
  } catch (error) {
    console.error(`⚠️ Translation failed:`, error);
    return text;
  }
}
