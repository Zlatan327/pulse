import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.resolve(process.cwd(), "../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "pulse.db");
const db = new Database(dbPath);

export default db;
