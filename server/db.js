import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "evv.db");

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS user_logins (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    email       TEXT,
    username    TEXT,
    full_name   TEXT,
    pollus_id   TEXT,
    country     TEXT,
    is_doctor   INTEGER DEFAULT 0,
    ip_address  TEXT,
    user_agent  TEXT,
    logged_in_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_user_logins_user_id ON user_logins(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_logins_logged_in_at ON user_logins(logged_in_at);
`);

// Backfill schema updates for existing databases.
const existingColumns = db.prepare("PRAGMA table_info(user_logins)").all().map((col) => col.name);
if (!existingColumns.includes("city")) {
  db.exec("ALTER TABLE user_logins ADD COLUMN city TEXT");
}
if (!existingColumns.includes("state")) {
  db.exec("ALTER TABLE user_logins ADD COLUMN state TEXT");
}

export default db;
