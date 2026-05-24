import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { config } from './config.js';
import type { PlatformMessage, ChatSummary, TaskItem, CatchupMode } from './types.js';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/** Build a chronological transcript from messages */
function buildTranscript(messages: PlatformMessage[]): string {
  return messages
    .map(m => {
      const time = m.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const prefix = `[${time}] ${m.username}`;
      
      switch (m.messageType) {
        case 'voice':
          return `${prefix} (voice note): ${m.text || '[audio not transcribed]'}`;
        case 'document':
          return `${prefix} (shared a document): ${m.text || '[document content not extracted]'}`;
        case 'image':
          return `${prefix} (shared an image)`;
        default:
          return `${prefix}: ${m.text || ''}`;
      }
    })
    .filter(line => line.trim())
    .join('\n');
}

/** Get persona instructions based on mode */
function getModePrompt(mode: CatchupMode, requesterName?: string): string {
  switch (mode) {
    case 'fun': return 'Make the summary highly energetic, humorous, and entertaining. Use playful language and mild exaggeration.';
    case 'roast': return 'Adopt a sarcastic, brutally honest, "roast" persona. Playfully mock the team for their lack of progress or chaotic communication, but keep it lighthearted.';
    case 'story': return 'Narrate the summary like an epic bedtime story or a dramatic movie trailer. Use vivid imagery and dramatic pauses.';
    case 'urgent': return 'Adopt a highly professional, rapid-fire, urgent tone. Focus strictly on what needs to be done right now.';
    case 'manager': return 'Adopt a high-level executive tone. Focus strictly on progress, blockers, and overall team alignment. Skip granular details.';
    case 'empathic': return 'Adopt a warm, highly supportive, and empathetic tone. Highlight team wins, show appreciation, and speak calmly.';
    case 'for-me': return `Provide a highly personalized summary specifically for ${requesterName || 'the user'}. Focus strictly on tasks, mentions, or topics that involve them directly.`;
    case 'standard':
    default: return 'Write in a natural, conversational tone as if you are briefing someone verbally.';
  }
}

/** Summarize a batch of messages into a spoken summary */
export async function summarizeMessages(messages: PlatformMessage[], mode: CatchupMode = 'standard', requesterName?: string): Promise<ChatSummary> {
  if (messages.length === 0) {
    return {
      text: 'There are no new messages to catch up on.',
      tasks: [],
      messageCount: 0,
      timespan: { from: new Date(), to: new Date() },
    };
  }

  const transcript = buildTranscript(messages);
  const targetWords = config.summaryTargetDuration * 2.5; // ~150 words per minute speaking rate = 2.5 words/sec

  const modeInstruction = getModePrompt(mode, requesterName);

  const systemPrompt = `You are Pulse, an AI assistant that creates concise audio summaries of group chat conversations.

Your task is to create a spoken summary that will be converted to audio. Follow these rules:
- ${modeInstruction}
- Keep it under ${Math.round(targetWords)} words (approximately ${config.summaryTargetDuration} seconds when spoken)
- Start with a brief time context (e.g., "In the last few hours..." or "Since you've been away...")
- Highlight KEY decisions, important updates, and action items
- Attribute actions and statements to people by their name
- Skip small talk, greetings, reactions, and filler messages
- If there are deadlines or urgent items, mention them prominently
- Do NOT use markdown, bullet points, or formatting — this is for speech
- Do NOT say "here's your summary" or similar meta-commentary
- End with any pending questions or items that need the listener's attention`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
  });

  const response = await model.generateContent(`Summarize this group chat conversation:\n\n${transcript}`);
  const summaryText = response.response.text() || 'Unable to generate summary.';

  // Extract tasks in a second call
  const tasks = await extractTasks(transcript);

  return {
    text: summaryText,
    tasks,
    messageCount: messages.length,
    timespan: {
      from: messages[0].timestamp,
      to: messages[messages.length - 1].timestamp,
    },
  };
}

/** Extract action items from a conversation transcript */
async function extractTasks(transcript: string): Promise<TaskItem[]> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: `Extract action items and tasks from this group chat conversation.`,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            assignee: { type: SchemaType.STRING, description: "the person responsible (use their name from the chat)" },
            description: { type: SchemaType.STRING, description: "what they need to do" },
            deadline: { type: SchemaType.STRING, nullable: true, description: "the deadline if mentioned, or null" },
            priority: { type: SchemaType.STRING, description: "\"high\", \"medium\", or \"low\" based on urgency" }
          },
          required: ["assignee", "description", "priority"]
        }
      }
    }
  });

  try {
    const response = await model.generateContent(transcript);
    const content = response.response.text() || '[]';
    const parsed = JSON.parse(content);
    const tasks: TaskItem[] = Array.isArray(parsed) ? parsed : (parsed.tasks || []);
    return tasks;
  } catch (e) {
    console.warn('⚠️ Failed to parse tasks from AI response', e);
    return [];
  }
}


