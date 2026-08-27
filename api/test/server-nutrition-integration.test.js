import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function freePort() {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

function sessionCookie(secret, userId) {
  const payload = `${userId}:${Date.now() + 60_000}:0`;
  const mac = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `gymsid=${payload}.${mac}`;
}

test('the production server dispatches authenticated nutrition and health routes', async t => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'mygym-server-'));
  const secret = 'integration-test-secret';
  writeFileSync(path.join(dataDir, 'secret'), secret);
  writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({
    users: [{ id: 'user-a', name: 'Test User', sv: 0 }], creds: [], subs: [], invites: []
  }));
  const port = await freePort();
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port), DATA_DIR: dataDir, RP_ID: 'localhost', ORIGIN: `http://localhost:${port}`,
      AUDIT_LOG: '0', OPENAI_API_KEY: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    if (!child.killed) child.kill();
    await new Promise(resolve => child.once('exit', resolve));
    rmSync(dataDir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server start timeout')), 5000);
    child.stdout.on('data', chunk => {
      if (String(chunk).includes('gym-api on')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`server exited before startup (${code})`));
    });
  });

  const response = await fetch(`http://127.0.0.1:${port}/api/nutrition/profile`, {
    headers: { Cookie: sessionCookie(secret, 'user-a') }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { profile: null, targets: null });

  const missingOrigin = await fetch(`http://127.0.0.1:${port}/api/health/pairing-code`, {
    method: 'POST',
    headers: { Cookie: sessionCookie(secret, 'user-a') }
  });
  assert.equal(missingOrigin.status, 403);

  const crossSite = await fetch(`http://127.0.0.1:${port}/api/health/pairing-code`, {
    method: 'POST',
    headers: {
      Cookie: sessionCookie(secret, 'user-a'),
      Origin: 'https://attacker.example'
    }
  });
  assert.equal(crossSite.status, 403);

  const pairing = await fetch(`http://127.0.0.1:${port}/api/health/pairing-code`, {
    method: 'POST',
    headers: {
      Cookie: sessionCookie(secret, 'user-a'),
      Origin: `http://localhost:${port}`
    }
  });
  assert.equal(pairing.status, 201);
  const pairingBody = await pairing.json();
  assert.match(pairingBody.code, /^[A-Z0-9]{8}$/);
  assert.ok(Date.parse(pairingBody.expiresAt) > Date.now());
});
