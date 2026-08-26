import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('openAppDatabase creates the nutrition schema and persists a profile', async () => {
  let databaseModule = null;
  try { databaseModule = await import('../src/database.js'); } catch {}
  assert.equal(typeof databaseModule?.openAppDatabase, 'function');

  const dir = mkdtempSync(path.join(tmpdir(), 'mygym-db-'));
  const dbPath = path.join(dir, 'mygym.sqlite');
  const db = databaseModule.openAppDatabase(dbPath);
  try {
    db.prepare(`INSERT INTO nutrition_profiles
      (user_id, profile_json, targets_json, updated_at)
      VALUES (?, ?, ?, ?)`).run('user-a', '{}', '{}', '2026-08-25T00:00:00.000Z');
    const row = db.prepare('SELECT user_id FROM nutrition_profiles WHERE user_id = ?').get('user-a');
    assert.equal(row.user_id, 'user-a');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('openAppDatabase records and reapplies schema migrations idempotently', async () => {
  const { openAppDatabase } = await import('../src/database.js');
  const dir = mkdtempSync(path.join(tmpdir(), 'mygym-migrations-'));
  const dbPath = path.join(dir, 'mygym.sqlite');
  let db = openAppDatabase(dbPath);
  try {
    assert.deepEqual(
      db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(row => row.version),
      [1, 2]
    );
    db.close();
    db = openAppDatabase(dbPath);
    assert.deepEqual(
      db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(row => row.version),
      [1, 2]
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
