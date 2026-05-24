import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(process.cwd(), "../data/pulse.db");
const db = new Database(dbPath);

export async function GET(req: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized. Please sign in with Google first." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const data = Object.fromEntries(searchParams.entries());
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Telegram bot token not configured" }, { status: 500 });
  }

  const hash = data.hash;
  delete data.hash;

  // Verify Telegram hash
  const dataCheckString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (calculatedHash !== hash) {
    return NextResponse.json({ error: "Invalid Telegram authentication hash" }, { status: 400 });
  }

  // Hash is valid! Link to user account
  const telegramId = data.id;
  const username = data.username || data.first_name;

  try {
    // Auth.js uses standard 'accounts' table
    const stmt = db.prepare(`
      INSERT INTO accounts (userId, type, provider, providerAccountId, access_token)
      VALUES (?, 'oauth', 'telegram', ?, ?)
      ON CONFLICT(provider, providerAccountId) DO UPDATE SET userId = excluded.userId
    `);
    
    // Some older versions of SQLite / Auth.js schema might not have ON CONFLICT so we'll do an upsert safely
    // Actually, BetterSQLite3 adapter creates specific tables. Let's try to just insert.
    stmt.run(session.user.id, telegramId, username);

    return NextResponse.redirect(new URL("/", req.url));
  } catch (error: any) {
    console.error("Failed to link Telegram account:", error);
    return NextResponse.json({ error: "Database error linking account" }, { status: 500 });
  }
}
