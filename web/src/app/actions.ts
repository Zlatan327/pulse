"use server";

import db from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function updateUserSettings(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const voiceStyle = formData.get("voiceStyle") as string;
  const language = formData.get("language") as string;
  const deliveryPreference = formData.get("deliveryPreference") as string || "x";

  const stmt = db.prepare(`
    INSERT INTO user_settings (user_id, voice_style, language, delivery_preference)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET 
      voice_style = excluded.voice_style,
      language = excluded.language,
      delivery_preference = excluded.delivery_preference
  `);

  stmt.run(session.user.id, voiceStyle, language, deliveryPreference);
  revalidatePath("/");
}
