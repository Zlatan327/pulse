import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import type { PlatformMessage, AudioResult } from './types.js';
import { generateSpeech } from './tts.js';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/**
 * Handle direct voice queries to Pulse (agentic behavior)
 */
export async function handleVoiceQuery(
  query: string,
  history: PlatformMessage[]
): Promise<{ text: string; audio?: AudioResult }> {
  
  // Format history for context
  const transcript = history
    .map(m => {
      const time = m.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `[${time}] ${m.username}: ${m.text || (m.messageType === 'voice' ? '[Voice Note]' : '[Media]')}`;
    })
    .join('\n');

  const systemInstruction = `You are Pulse, an intelligent AI companion in a group chat. 
The user is asking you a direct follow-up question via voice.

Here is the recent context of the chat:
${transcript}

Your job is to answer their question conversationally based on the chat history.
- Be concise (under 60 words). This will be converted to speech.
- Do NOT use markdown, emojis, or bullet points.
- Speak naturally, like a helpful human participant in the group.
- If they ask you to perform an action you cannot do (like sending an email or booking a flight), politely decline.`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction,
  });

  try {
    console.log(`🤖 Agent thinking... Query: "${query}"`);
    const response = await model.generateContent(query);
    const text = response.response.text() || 'I am not sure how to respond to that.';
    
    // Generate TTS for the response
    const audio = await generateSpeech(text);
    
    return { text, audio };
  } catch (error) {
    console.error('⚠️ Agent failed to process query:', error);
    return { text: 'Sorry, my neural pathways got a little tangled just now.' };
  }
}
