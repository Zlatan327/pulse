import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Twitter from "next-auth/providers/twitter"
import Database from "better-sqlite3"
import path from "path"
import { randomUUID } from "crypto"

const dbPath = path.resolve(process.cwd(), "../data/pulse.db");
const db = new Database(dbPath);

// Ensure accounts table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    provider TEXT NOT NULL,
    providerAccountId TEXT NOT NULL,
    access_token TEXT,
    UNIQUE(provider, providerAccountId)
  );
  
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    image TEXT
  );
`);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Twitter({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      version: "2.0",
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;
      
      try {
        // 1. Get or create user
        let internalUserId = user.id;
        
        const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(user.email) as { id: string };
        
        if (existingUser) {
          internalUserId = existingUser.id;
        } else {
          internalUserId = internalUserId || randomUUID();
          db.prepare("INSERT INTO users (id, email, name, image) VALUES (?, ?, ?, ?)").run(
            internalUserId, user.email, user.name, user.image
          );
        }
        
        // Ensure user.id is set for the session callback
        user.id = internalUserId;

        // 2. Upsert account link
        if (account) {
          const stmt = db.prepare(`
            INSERT INTO accounts (id, userId, provider, providerAccountId, access_token)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(provider, providerAccountId) DO UPDATE SET 
              userId = excluded.userId,
              access_token = excluded.access_token
          `);
          stmt.run(randomUUID(), internalUserId, account.provider, account.providerAccountId, account.access_token || null);
        }
        
        return true;
      } catch (e) {
        console.error("SignIn error:", e);
        return false;
      }
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // token.sub usually contains the user.id we set during signIn or from the JWT
        // NextAuth JWT defaults to user.id in token.sub
        session.user.id = token.sub;
      }
      return session;
    }
  }
})
