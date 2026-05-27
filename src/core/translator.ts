import OpenAI from 'openai';
import { config } from './config.js';

const openai = new OpenAI({
  apiKey: config.mimo.apiKey,
  baseURL: config.mimo.baseUrl,
});

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

  try {
    const response = await openai.chat.completions.create({
      model: config.mimo.model,
      messages: [
        { role: 'system', content: `You are a professional translator. Translate the following text from ${fromName} to ${toName}. Maintain the original tone, meaning, and nuance. Return ONLY the translated text, nothing else.` },
        { role: 'user', content: text }
      ]
    });
    const translated = response.choices[0]?.message?.content || text;
    console.log(`🌍 Translated ${fromName} → ${toName}: "${translated.substring(0, 60)}..."`);
    return translated;
  } catch (error) {
    console.error(`⚠️ Translation failed:`, error);
    return text;
  }
}
