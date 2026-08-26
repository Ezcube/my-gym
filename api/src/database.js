import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openAppDatabase(file) {
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map(row => Number(row.version))
  );
  if (!applied.has(1)) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(`

    CREATE TABLE IF NOT EXISTS nutrition_profiles (
      user_id TEXT PRIMARY KEY,
      profile_json TEXT NOT NULL,
      targets_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_meals (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      eaten_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE INDEX IF NOT EXISTS nutrition_meals_user_date
      ON nutrition_meals (user_id, local_date, eaten_at);

    CREATE TABLE IF NOT EXISTS nutrition_daily_reviews (
      user_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      review_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, local_date)
    );
      `);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(1, new Date().toISOString());
      db.exec('COMMIT;');
    } catch (error) {
      db.exec('ROLLBACK;');
      db.close();
      throw error;
    }
  }
  if (!applied.has(2)) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS nutrition_ai_usage (
          user_id TEXT NOT NULL,
          usage_date TEXT NOT NULL,
          operation TEXT NOT NULL,
          used_count INTEGER NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, usage_date, operation)
        );
      `);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(2, new Date().toISOString());
      db.exec('COMMIT;');
    } catch (error) {
      db.exec('ROLLBACK;');
      db.close();
      throw error;
    }
  }
  return db;
}
