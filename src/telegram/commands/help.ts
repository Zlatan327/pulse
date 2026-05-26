import type { Context } from 'grammy';

export async function handleHelp(ctx: Context): Promise<void> {
  const helpText = `
⚡ **Pulse Advanced Instructions**

Pulse now supports advanced timeframes, targeted users, and contextual thread summaries!

🕒 **Timeframes:**
Append a timeframe to summarize a specific window:
• \`/catchup 1hr\`
• \`/catchup 30m\`
• \`/catchup 1d\`

🎯 **Targeted Users:**
Tag someone to heavily focus the summary on what they said:
• \`/catchup @username\`
• \`/catchup @username 2hrs\`

🧵 **Contextual Replies:**
Reply directly to ANY message in the chat with \`/catchup\`, and Pulse will read exactly from that point forward!

🎭 **Personas:**
You can also change my personality on the fly:
• \`/catchup fun\` (High energy)
• \`/catchup roast\` (Sarcastic)
• \`/catchup manager\` (Executive summary)
• \`/catchup for-me\` (Personalized to you)

*(You can combine them: \`/catchup roast @username 1d\`)*
  `;

  await ctx.reply(helpText, { parse_mode: 'Markdown' });
}
