import { auth } from "@/auth";
import Dashboard from "@/components/Dashboard";
import db from "@/lib/db";

export default async function Home() {
  const session = await auth();
  
  let linkedAccounts = {
    twitter: false,
    telegram: false,
  };

  if (session?.user?.id) {
    try {
      const stmt = db.prepare("SELECT provider FROM accounts WHERE userId = ?");
      const rows = stmt.all(session.user.id) as { provider: string }[];
      
      rows.forEach(row => {
        if (row.provider === 'twitter') linkedAccounts.twitter = true;
        if (row.provider === 'telegram') linkedAccounts.telegram = true;
      });
    } catch (e) {
      // Table might not exist yet if Auth.js hasn't initialized it, ignore
    }
  }

  // We need to pass the bot username for the Telegram Widget
  const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME || "PulseBot";

  return <Dashboard session={session} linkedAccounts={linkedAccounts} telegramBotUsername={telegramBotUsername} />;
}
