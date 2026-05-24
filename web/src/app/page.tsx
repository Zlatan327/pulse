import { auth } from "@/auth";
import Dashboard from "@/components/Dashboard";
import db from "@/lib/db";

export default async function Home() {
  const session = await auth();
  
  let linkedAccounts = {
    twitter: false,
    telegram: false,
  };
  let userSettings = { voice_style: 'Standard (Professional)', language: 'English' };
  let audioSummaries: any[] = [];

  if (session?.user?.id) {
    try {
      // 1. Get linked accounts
      const stmt = db.prepare("SELECT provider FROM accounts WHERE userId = ?");
      const rows = stmt.all(session.user.id) as { provider: string }[];
      
      rows.forEach(row => {
        if (row.provider === 'twitter') linkedAccounts.twitter = true;
        if (row.provider === 'telegram') linkedAccounts.telegram = true;
      });

      // 2. Get user settings
      const settingsRow = db.prepare("SELECT voice_style, language FROM user_settings WHERE user_id = ?").get(session.user.id) as any;
      if (settingsRow) {
        userSettings = { voice_style: settingsRow.voice_style, language: settingsRow.language };
      }

      // 3. Get audio summaries
      audioSummaries = db.prepare(`
        SELECT * FROM audio_summaries 
        WHERE user_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 5
      `).all(session.user.id) as any[];

    } catch (e) {
      // Tables might not exist yet if Auth.js hasn't initialized it, ignore
    }
  }

  // We need to pass the bot username for the Telegram Widget
  const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME || "PulseBot";

  return <Dashboard 
    session={session} 
    linkedAccounts={linkedAccounts} 
    telegramBotUsername={telegramBotUsername} 
    userSettings={userSettings}
    audioSummaries={audioSummaries}
  />;
}
