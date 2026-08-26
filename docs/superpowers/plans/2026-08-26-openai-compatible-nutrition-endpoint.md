# OpenAI-Compatible Nutrition Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route My Gym photo analysis and daily nutrition review through the authenticated OpenAI-compatible endpoint at `https://147.45.248.214/v1` without exposing its API key or weakening existing nutrition safeguards.

**Architecture:** Add a validated `OPENAI_BASE_URL` option to the existing server-side provider while retaining the official OpenAI URL as the default. Transfer the existing key from the AI VPS to the My Gym VPS through restricted temporary files, configure only the API service, and prove the exact provider path with a live structured response before removing maintenance mode in a later administrator-bootstrap task.

**Tech Stack:** Node.js 22, native `fetch`, Node test runner, Docker Compose, PowerShell/OpenSSH/PuTTY, Ubuntu nginx.

---

## File Map

- `api/src/providers/openai-nutrition.js`: validate and normalize the base URL once, then share its `/responses` URL between photo and review calls.
- `api/test/providers.test.js`: prove the official default, custom endpoint routing, trailing-slash normalization, and plaintext rejection.
- `api/server.js`: pass `OPENAI_BASE_URL` from the server environment into the provider.
- `.env.example`: document the portable server-only default.
- `docs/PRODUCTION.md`: document the production endpoint, model discovery, secret handling, and scoped deployment.
- `test/release-contracts.test.mjs`: prevent the server wiring and production documentation from drifting apart.

### Task 1: Drive configurable provider routing with failing tests

**Files:**
- Modify: `api/test/providers.test.js`
- Modify: `api/src/providers/openai-nutrition.js`

- [ ] **Step 1: Add the custom endpoint and transport-safety tests**

Append these tests after the existing default photo-analysis test in
`api/test/providers.test.js`:

```js
test('OpenAI nutrition operations share a normalized custom base URL', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const urls = [];
  const photo = {
    overallConfidence: 0.9,
    items: [{
      name: 'Овсяная каша', searchQuery: 'oatmeal cooked', estimatedGrams: 250,
      confidence: 0.9, preparation: 'варёная', alternatives: [], warnings: []
    }],
    warnings: []
  };
  const review = {
    summary: 'День сбалансирован.',
    suggestions: ['Добавьте овощи.', 'Сохраните режим питания.'],
    warnings: [],
    disclaimer: 'Это справочная информация, не медицинская рекомендация.'
  };
  const fetchImpl = async (url, options) => {
    urls.push(String(url));
    const body = JSON.parse(options.body);
    return openAiJsonResponse(
      body.text.format.name === 'meal_photo_analysis' ? photo : review,
      body.model
    );
  };
  const client = createOpenAiNutritionClient({
    apiKey: 'test-key',
    baseUrl: 'https://ai.example.test/v1/',
    fetchImpl
  });

  await client.analyzePhoto({
    base64: Buffer.from('image').toString('base64'),
    mimeType: 'image/jpeg',
    locale: 'ru'
  });
  await client.reviewDay({ localDate: '2026-08-26', meals: [] });

  assert.deepEqual(urls, [
    'https://ai.example.test/v1/responses',
    'https://ai.example.test/v1/responses'
  ]);
});

test('OpenAI nutrition rejects plaintext non-loopback base URLs', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');

  assert.throws(
    () => createOpenAiNutritionClient({ apiKey: 'test-key', baseUrl: 'http://ai.example.test/v1' }),
    error => error?.code === 'OPENAI_INVALID_BASE_URL'
  );
  assert.doesNotThrow(() => createOpenAiNutritionClient({
    apiKey: 'test-key',
    baseUrl: 'http://127.0.0.1:9000/v1'
  }));
});
```

- [ ] **Step 2: Run the new provider test and observe RED**

Run from `D:\src\opengym\api`:

```powershell
node --disable-warning=ExperimentalWarning --test --test-name-pattern="OpenAI nutrition" test/providers.test.js
```

Expected: the custom endpoint test fails because both requests still target
`https://api.openai.com/v1/responses`; the plaintext validation test also fails
because construction does not throw.

- [ ] **Step 3: Implement the minimal base-URL normalization**

Add this helper before `createOpenAiNutritionClient` in
`api/src/providers/openai-nutrition.js`:

```js
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

function normalizeOpenAiBaseUrl(value = DEFAULT_OPENAI_BASE_URL) {
  let url;
  try { url = new URL(String(value || DEFAULT_OPENAI_BASE_URL).trim()); }
  catch {
    throw Object.assign(new Error('OpenAI base URL must be an absolute HTTP(S) URL'), {
      code: 'OPENAI_INVALID_BASE_URL'
    });
  }
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const validProtocol = url.protocol === 'https:' || (url.protocol === 'http:' && loopback);
  if (!validProtocol || url.username || url.password || url.search || url.hash) {
    throw Object.assign(new Error('OpenAI base URL is not allowed'), {
      code: 'OPENAI_INVALID_BASE_URL'
    });
  }
  return url.toString().replace(/\/+$/, '');
}
```

Extend the constructor argument list and create the shared URL once:

```js
export function createOpenAiNutritionClient({
  apiKey,
  fetchImpl = fetch,
  baseUrl = DEFAULT_OPENAI_BASE_URL,
  primaryModel = 'gpt-5.6-luna',
  fallbackModel = 'gpt-5.6-terra',
  confidenceThreshold = 0.65,
  timeoutMs = 30000
}) {
  const responsesUrl = `${normalizeOpenAiBaseUrl(baseUrl)}/responses`;
```

Replace both literal `https://api.openai.com/v1/responses` arguments with
`responsesUrl`. Do not change prompts, schemas, `store: false`, timeouts,
confidence thresholds, fallback conditions, or safe error codes.

- [ ] **Step 4: Run provider tests and observe GREEN**

Run:

```powershell
node --disable-warning=ExperimentalWarning --test test/providers.test.js
```

Expected: all provider tests pass, including the existing assertion that the
default URL is still `https://api.openai.com/v1/responses`.

- [ ] **Step 5: Commit the provider seam**

```powershell
git add api/src/providers/openai-nutrition.js api/test/providers.test.js
git commit -m "feat: configure nutrition AI endpoint"
```

### Task 2: Wire and document the server configuration contract

**Files:**
- Modify: `test/release-contracts.test.mjs`
- Modify: `api/server.js`
- Modify: `.env.example`
- Modify: `docs/PRODUCTION.md`

- [ ] **Step 1: Add a failing release-contract test**

Append this test to `test/release-contracts.test.mjs`:

```js
test('nutrition AI base URL is server-only, portable, and production documented', () => {
  const server = read('api/server.js');
  const example = read('.env.example');
  const production = read('docs/PRODUCTION.md');

  assert.match(server, /baseUrl: process\.env\.OPENAI_BASE_URL/);
  assert.match(example, /OPENAI_BASE_URL=https:\/\/api\.openai\.com\/v1/);
  assert.match(production, /OPENAI_BASE_URL=https:\/\/147\.45\.248\.214\/v1/);
  assert.match(production, /OPENAI_API_KEY.*server-side|server-side.*OPENAI_API_KEY/i);
});
```

- [ ] **Step 2: Run the release contract and observe RED**

Run from `D:\src\opengym`:

```powershell
node --test test/release-contracts.test.mjs
```

Expected: the new contract fails because `api/server.js`, `.env.example`, and
the production runbook do not yet contain `OPENAI_BASE_URL`.

- [ ] **Step 3: Wire the server setting**

Change the provider construction in `api/server.js` to:

```js
const nutritionAi = createOpenAiNutritionClient({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  primaryModel: process.env.OPENAI_NUTRITION_MODEL_PRIMARY || 'gpt-5.6-luna',
  fallbackModel: process.env.OPENAI_NUTRITION_MODEL_FALLBACK || 'gpt-5.6-terra'
});
```

- [ ] **Step 4: Document the portable and production values**

Add the server-only default immediately before `OPENAI_API_KEY` in
`.env.example`:

```dotenv
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
```

Add the production value to the environment example in `docs/PRODUCTION.md`:

```dotenv
OPENAI_BASE_URL=https://147.45.248.214/v1
OPENAI_API_KEY=
```

Directly below that example, document these operational rules:

```markdown
`OPENAI_BASE_URL` and model names are non-secret server-side settings.
`OPENAI_API_KEY` must be written only to the root-owned production `.env`
with mode `0600`; never put it in Git, frontend variables, command arguments,
CI output, or chat. Before deployment, query authenticated `GET /v1/models`.
Use `gpt-5.6-terra` as fallback only when the endpoint lists it; otherwise set
`OPENAI_NUTRITION_MODEL_FALLBACK=gpt-5.6-luna`.
```

- [ ] **Step 5: Run the targeted contracts and API tests**

Run:

```powershell
node --test test/release-contracts.test.mjs
Set-Location api
node --disable-warning=ExperimentalWarning --test test/providers.test.js test/server-nutrition-integration.test.js
Set-Location ..
git diff --check
```

Expected: release contracts and targeted API tests pass; `git diff --check`
prints nothing.

- [ ] **Step 6: Commit the configuration contract**

```powershell
git add api/server.js .env.example docs/PRODUCTION.md test/release-contracts.test.mjs
git commit -m "docs: configure production nutrition AI"
```

### Task 3: Complete local release verification and publish the code

**Files:**
- Verify only; no new files.

- [ ] **Step 1: Run the scoped nutrition suite**

```powershell
Set-Location api
npm run test:nutrition
Set-Location ..
node --test test/release-contracts.test.mjs
```

Expected: all nutrition and release-contract tests pass.

- [ ] **Step 2: Prove no secret or populated environment file is staged**

```powershell
git status --short
git diff --cached --name-only
git grep -n -E "sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY=.+" HEAD -- ':!*.md' ':!.env.example'
```

Expected: only intentional source/docs commits exist, no `.env` or secret file
is tracked, and the secret-pattern search returns no matches.

- [ ] **Step 3: Push the reviewed commits to the existing public repository**

```powershell
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: local `HEAD` and `refs/heads/main` have the same full hash.

### Task 4: Transfer the existing API key and discover endpoint models

**Files:**
- Modify on VPS: `/opt/my-gym/.env`
- Create on VPS: a timestamped root-only backup matching `/opt/my-gym/.env.before-openai-endpoint-*`
- Temporary only: a private directory under the Windows temp directory and one random root-only file under `/tmp` on the My Gym VPS.

- [ ] **Step 1: Verify both hosts before reading the key**

Read-only checks:

```powershell
curl.exe -fsS https://147.45.248.214/healthz
ssh-keygen -F 147.45.248.214 -f C:\Users\user\.ssh\known_hosts
ssh -i C:\Users\user\.ssh\mygym_deploy_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o BatchMode=yes root@155.212.190.173 "stat -c '%a %U:%G' /opt/my-gym/.env"
```

Expected: AI health succeeds, the stored ED25519 host fingerprint resolves to
`SHA256:BjY94J/uvH4Qrk7SOe6hA1MF/xodouPBk5zWKSlwb0A`, and the target `.env` is
`600 root:root`.

- [ ] **Step 2: Transfer the key without stdout or command-line exposure**

Use the already-authorized Windows Credential Manager target
`ssh@147.45.248.214:22/root`. Read it with `CredReadW` only into process memory,
write it to a user-only temporary `-pwfile`, and capture the API key without
writing a BOM or sending it to stdout:

```powershell
if (-not ('MyGymWinCred' -as [type])) {
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MyGymWinCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags; public UInt32 Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize; public IntPtr CredentialBlob; public UInt32 Persist;
    public UInt32 AttributeCount; public IntPtr Attributes; public string TargetAlias;
    public string UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredRead(string target, uint type, int reserved, out IntPtr credentialPtr);
  [DllImport("advapi32.dll", SetLastError=true)]
  public static extern void CredFree(IntPtr credentialPtr);
}
'@
}
function Read-WinCredentialSecret([string]$Target) {
  $ptr = [IntPtr]::Zero
  if (-not [MyGymWinCred]::CredRead($Target, 1, 0, [ref]$ptr)) {
    throw "Credential Manager entry is unavailable"
  }
  try {
    $cred = [Runtime.InteropServices.Marshal]::PtrToStructure(
      $ptr, [type][MyGymWinCred+CREDENTIAL]
    )
    [Runtime.InteropServices.Marshal]::PtrToStringUni(
      $cred.CredentialBlob, [int]($cred.CredentialBlobSize / 2)
    )
  } finally {
    if ($ptr -ne [IntPtr]::Zero) { [MyGymWinCred]::CredFree($ptr) }
  }
}

$privateRoot = Join-Path ([IO.Path]::GetTempPath()) ("mygym-ai-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $privateRoot | Out-Null
icacls.exe $privateRoot /inheritance:r /grant:r "$env:USERNAME`:(OI)(CI)F" | Out-Null
$passwordFile = Join-Path $privateRoot 'ssh-password'
$localKeyFile = Join-Path $privateRoot 'api-key'
$remoteKeyFile = "/tmp/.mygym-ai-key-" + [guid]::NewGuid().ToString('N')
try {
  $sshPassword = Read-WinCredentialSecret 'ssh@147.45.248.214:22/root'
  [IO.File]::WriteAllText($passwordFile, $sshPassword, [Text.UTF8Encoding]::new($false))
  $keyOutput = & plink.exe -batch -ssh -P 22 -l root -pwfile $passwordFile `
  -hostkey "ssh-ed25519 255 SHA256:BjY94J/uvH4Qrk7SOe6hA1MF/xodouPBk5zWKSlwb0A" `
  147.45.248.214 "cat /etc/codex-ui/api-key" 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'AI key read failed' }
  $apiKey = ($keyOutput -join "`n").Trim()
  if ([string]::IsNullOrWhiteSpace($apiKey)) { throw 'AI key is empty' }
  [IO.File]::WriteAllText($localKeyFile, $apiKey, [Text.UTF8Encoding]::new($false))

  & scp.exe -q -i C:\Users\user\.ssh\mygym_deploy_ed25519 `
    -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes `
    $localKeyFile "root@155.212.190.173:$remoteKeyFile"
  if ($LASTEXITCODE -ne 0) { throw 'AI key transfer failed' }
} finally {
  $sshPassword = $null; $apiKey = $null; $keyOutput = $null
  Remove-Item -LiteralPath $privateRoot -Recurse -Force -ErrorAction SilentlyContinue
}
```

The implementation must generate `$localKeyFile` and `$remoteKeyFile` with
random GUID names, verify only that the local file is non-empty, and remove the
password/key temp directory in a `finally` block. Never print either file.

- [ ] **Step 3: Discover models on the My Gym VPS**

Use the temporary remote key file and write the model response to another
root-only temporary file. Generate `$modelsFile` locally, run the probe over the
already-pinned My Gym SSH connection, and capture the two non-secret result
lines into `$fallbackModel`:

```powershell
$modelsFile = "/tmp/.mygym-ai-models-" + [guid]::NewGuid().ToString('N')
$modelProbe = @'
set -euo pipefail
key_file=$1
models_file=$2
chmod 600 "$key_file"
api_key=$(cat "$key_file")
printf 'header = "Authorization: Bearer %s"\n' "$api_key" |
  curl --fail --silent --show-error --max-time 30 --config - \
    --output "$models_file" https://147.45.248.214/v1/models
unset api_key
chmod 600 "$models_file"
python3 - "$models_file" <<'PY'
import json, sys
payload = json.load(open(sys.argv[1], encoding='utf-8'))
ids = sorted(item['id'] for item in payload.get('data', []) if isinstance(item, dict) and isinstance(item.get('id'), str))
required = 'gpt-5.6-luna'
if required not in ids:
    raise SystemExit('required_model_missing')
print('PRIMARY_MODEL=' + required)
print('FALLBACK_MODEL=' + ('gpt-5.6-terra' if 'gpt-5.6-terra' in ids else required))
PY
'@
$modelOutput = $modelProbe | ssh -i C:\Users\user\.ssh\mygym_deploy_ed25519 `
  -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o BatchMode=yes `
  root@155.212.190.173 "bash -s -- '$remoteKeyFile' '$modelsFile'"
if ($LASTEXITCODE -ne 0) { throw 'Model discovery failed' }
$selection = ConvertFrom-StringData ($modelOutput -join "`n")
$fallbackModel = $selection.FALLBACK_MODEL
if ($selection.PRIMARY_MODEL -ne 'gpt-5.6-luna' -or
    $fallbackModel -notin @('gpt-5.6-luna', 'gpt-5.6-terra')) {
  throw 'Unexpected model selection'
}
```

Expected: the request returns `200`, Luna is present, and the output contains
only the selected non-secret model IDs.

- [ ] **Step 4: Atomically update the target environment**

Pass the selected non-secret `$fallbackModel` from Step 3 as the third Python
argument over the pinned SSH connection. The root-run script creates a
timestamped backup, reads the key file, updates each setting exactly once,
preserves unrelated lines, and activates a mode-`0600` file atomically. Capture
the single non-secret `ENV_BACKUP` output line for the rollback step:

```powershell
$envUpdater = @'
from pathlib import Path
from datetime import datetime, timezone
import os, shutil, sys, tempfile

env_path = Path(sys.argv[1])
key_path = Path(sys.argv[2])
fallback_model = sys.argv[3]
api_key = key_path.read_text(encoding='utf-8').strip()
if not api_key:
    raise SystemExit('empty_api_key')
if fallback_model not in {'gpt-5.6-luna', 'gpt-5.6-terra'}:
    raise SystemExit('invalid_fallback_model')

updates = {
    'OPENAI_BASE_URL': 'https://147.45.248.214/v1',
    'OPENAI_API_KEY': api_key,
    'OPENAI_NUTRITION_MODEL_PRIMARY': 'gpt-5.6-luna',
    'OPENAI_NUTRITION_MODEL_FALLBACK': fallback_model,
}
st = env_path.stat()
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = env_path.with_name(f'.env.before-openai-endpoint-{stamp}')
if backup.exists():
    raise SystemExit('backup_exists')
shutil.copy2(env_path, backup)
os.chmod(backup, 0o600)

out, seen = [], set()
for line in env_path.read_text(encoding='utf-8').splitlines():
    stripped = line.lstrip()
    name = stripped.split('=', 1)[0].strip() if '=' in stripped and not stripped.startswith('#') else ''
    if name.startswith('export '):
        name = name[7:].strip()
    if name in updates:
        if name not in seen:
            out.append(f'{name}={updates[name]}')
            seen.add(name)
    else:
        out.append(line)
for name, value in updates.items():
    if name not in seen:
        out.append(f'{name}={value}')

fd, tmp_name = tempfile.mkstemp(prefix='.env.openai.', dir=str(env_path.parent), text=True)
os.close(fd)
tmp = Path(tmp_name)
try:
    tmp.write_text('\n'.join(out) + '\n', encoding='utf-8')
    os.chmod(tmp, 0o600)
    os.chown(tmp, st.st_uid, st.st_gid)
    os.replace(tmp, env_path)
finally:
    if tmp.exists():
        tmp.unlink()
print('ENV_BACKUP=' + str(backup))
'@
$envUpdateOutput = $envUpdater | ssh -i C:\Users\user\.ssh\mygym_deploy_ed25519 `
  -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o BatchMode=yes `
  root@155.212.190.173 "python3 - /opt/my-gym/.env '$remoteKeyFile' '$fallbackModel'"
if ($LASTEXITCODE -ne 0) { throw 'Environment update failed' }
$envSelection = ConvertFrom-StringData ($envUpdateOutput -join "`n")
$rollbackEnv = $envSelection.ENV_BACKUP
if ($rollbackEnv -notmatch '^/opt/my-gym/\.env\.before-openai-endpoint-[0-9]{8}T[0-9]{6}Z$') {
  throw 'Unexpected environment backup path'
}
```

Delete `$remoteKeyFile` and `$modelsFile` in a `finally` block even when model
discovery or the environment update fails. Then verify only:

```powershell
ssh -i C:\Users\user\.ssh\mygym_deploy_ed25519 `
  -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o BatchMode=yes `
  root@155.212.190.173 "rm -f -- '$remoteKeyFile' '$modelsFile'; stat -c 'ENV_MODE=%a ENV_OWNER=%U:%G' /opt/my-gym/.env; grep -Eq '^OPENAI_API_KEY=.+$' /opt/my-gym/.env && echo OPENAI_API_KEY=SET; grep -E '^(OPENAI_BASE_URL|OPENAI_NUTRITION_MODEL_PRIMARY|OPENAI_NUTRITION_MODEL_FALLBACK)=' /opt/my-gym/.env"
if ($LASTEXITCODE -ne 0) { throw 'Post-update verification failed' }
```

Expected: `ENV_MODE=600`, owner `root:root`, key state `SET`, and only non-secret
settings are printed.

### Task 5: Build and deploy only the API service with rollback

**Files:**
- Deployment directory: `/opt/my-gym`
- Runtime image: `my-gym-api:latest`

- [ ] **Step 1: Confirm the server source matches the published commit**

Create the deployment archive from the exact reviewed commit, not from the
working tree, and transfer the archive plus a BOM-free SHA-256 sidecar:

```powershell
$commit = (git rev-parse HEAD).Trim()
$remoteCommit = ((git ls-remote origin refs/heads/main) -split '\s+')[0]
if ($commit -ne $remoteCommit) { throw 'Published commit mismatch' }
$archive = Join-Path ([IO.Path]::GetTempPath()) "my-gym-$commit.tar.gz"
$sidecar = "$archive.sha256"
git archive --format=tar.gz --output=$archive $commit
if ($LASTEXITCODE -ne 0) { throw 'git archive failed' }
$digest = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
$archiveName = Split-Path -Leaf $archive
[IO.File]::WriteAllText(
  $sidecar, "$digest  $archiveName`n", [Text.UTF8Encoding]::new($false)
)
scp.exe -q -i C:\Users\user\.ssh\mygym_deploy_ed25519 `
  -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes `
  $archive $sidecar root@155.212.190.173:/tmp/
if ($LASTEXITCODE -ne 0) { throw 'Source archive transfer failed' }
```

On the VPS, verify the checksum and archive paths before extraction, preserve a
source rollback archive, then overlay only tracked source. Because `.env`,
`data/`, and downloaded exercise media are not tracked, they cannot be members
of this archive; verify that invariant explicitly. Pass the published commit as
the only argument and capture the non-secret rollback path:

```powershell
$sourceDeploy = @'
set -euo pipefail
commit=$1
cd /tmp
archive="my-gym-$commit.tar.gz"
sha256sum -c "$archive.sha256"
tar -tzf "$archive" > "$archive.list"
! grep -Eq '(^|/)(\.env|data/|media/(img|gif)/)' "$archive.list"
! grep -Eq '(^/|(^|/)\.\.(/|$)|\\)' "$archive.list"
install -d -m 700 /var/backups/my-gym
source_backup="/var/backups/my-gym/source-before-$commit-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
tar -C /opt/my-gym \
  --exclude='.env*' --exclude=data --exclude=media/img --exclude=media/gif \
  --exclude=backups --exclude=.git -czf "$source_backup" .
tar -xzf "$archive" -C /opt/my-gym
python3 - /opt/my-gym/RELEASE-MANIFEST.txt "$commit" <<'PY'
from pathlib import Path
import os, sys, tempfile

path = Path(sys.argv[1])
commit = sys.argv[2]
st = path.stat()
lines, replaced = [], False
for line in path.read_text(encoding='utf-8').splitlines():
    if line.startswith('published_commit='):
        lines.append('published_commit=' + commit)
        replaced = True
    else:
        lines.append(line)
if not replaced:
    lines.append('published_commit=' + commit)
fd, tmp_name = tempfile.mkstemp(prefix='.release-manifest.', dir=str(path.parent), text=True)
os.close(fd)
tmp = Path(tmp_name)
try:
    tmp.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    os.chmod(tmp, st.st_mode & 0o777)
    os.chown(tmp, st.st_uid, st.st_gid)
    os.replace(tmp, path)
finally:
    if tmp.exists():
        tmp.unlink()
PY
grep -Fx "published_commit=$commit" /opt/my-gym/RELEASE-MANIFEST.txt
rm -f -- "$archive" "$archive.sha256" "$archive.list"
printf 'SOURCE_BACKUP=%s\n' "$source_backup"
'@
$sourceOutput = $sourceDeploy | ssh -i C:\Users\user\.ssh\mygym_deploy_ed25519 `
  -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o BatchMode=yes `
  root@155.212.190.173 "bash -s -- '$commit'"
if ($LASTEXITCODE -ne 0) { throw 'Source activation failed' }
$sourceSelection = ConvertFrom-StringData (($sourceOutput | Where-Object { $_ -like 'SOURCE_BACKUP=*' }) -join "`n")
$sourceBackup = $sourceSelection.SOURCE_BACKUP
if ($sourceBackup -notmatch '^/var/backups/my-gym/source-before-[0-9a-f]{40}-[0-9]{8}T[0-9]{6}Z\.tar\.gz$') {
  throw 'Unexpected source backup path'
}
```

The remote script updates only `published_commit` in
`/opt/my-gym/RELEASE-MANIFEST.txt` with an atomic root-owned write and verifies
that it equals `$commit`. Remove the local archive and sidecar in a `finally`
block. Do not modify `data/`, `.env`, nginx, or the web image.

- [ ] **Step 2: Preserve the active API image and bind the existing environment backup**

```bash
cd /opt/my-gym
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker image inspect my-gym-api:latest >/dev/null
docker image tag my-gym-api:latest "my-gym-api:rollback-$stamp"
rollback_env="$rollbackEnv"
source_backup="$sourceBackup"
test -f "$rollback_env"
test -f "$source_backup"
stat -c '%a %U:%G' "$rollback_env" | grep -qx '600 root:root'
```

Record `$stamp`, `$rollback_env`, and the `SOURCE_BACKUP` path in the deployment
log without recording any environment values.

- [ ] **Step 3: Build and restart only API**

```bash
cd /opt/my-gym
docker compose build api
docker compose up -d --no-deps api
```

Poll `docker inspect --format '{{.State.Health.Status}}' my-gym-api-1` for at most
60 seconds. Expected: `healthy`. Also verify:

```bash
docker compose ps api web
curl -fsS http://127.0.0.1:8080/api/health
```

Expected: API and web remain healthy and health returns `{"ok":true,"users":0}`.

- [ ] **Step 4: Roll back immediately on build or health failure**

If Step 3 fails, run:

```bash
cd /opt/my-gym
cp -a "$rollback_env" .env
chmod 600 .env
tar -xzf "$source_backup" -C /opt/my-gym
docker image tag "my-gym-api:rollback-$stamp" my-gym-api:latest
docker compose up -d --no-deps api
curl -fsS http://127.0.0.1:8080/api/health
```

Stop the release and report the failing boundary. Do not continue to inference.

### Task 6: Prove exact live inference and preserve maintenance mode

**Files:**
- Verify runtime only; no source changes.

- [ ] **Step 1: Invoke the exact provider path inside the API container**

Run without printing environment variables:

```bash
cd /opt/my-gym
docker compose exec -T api node --input-type=module -e '
import { createOpenAiNutritionClient } from "./src/providers/openai-nutrition.js";
const client = createOpenAiNutritionClient({
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: process.env.OPENAI_BASE_URL,
  primaryModel: process.env.OPENAI_NUTRITION_MODEL_PRIMARY,
  fallbackModel: process.env.OPENAI_NUTRITION_MODEL_FALLBACK
});
const result = await client.reviewDay({
  localDate: "2026-08-26",
  targets: { kcal: 2200, proteinG: 130 },
  meals: [{ totals: { kcal: 1900, proteinG: 120, fatG: 70, carbsG: 210 } }],
  activity: { workouts: 1 },
  preferences: { allergies: [] }
});
if (!result.summary || !Array.isArray(result.suggestions) || result.suggestions.length < 2) {
  throw new Error("invalid_live_review");
}
console.log(JSON.stringify({ ok: true, model: result.model, suggestions: result.suggestions.length }));
'
```

Expected: `{ "ok": true, ... }`, the selected model, and 2 or 3 suggestions;
no key or upstream payload is printed.

- [ ] **Step 2: Verify the public maintenance boundary**

From the Windows client:

```powershell
curl.exe -sS -D - -o NUL http://gym.innu.ru/
curl.exe -sS -D - -o NUL https://gym.innu.ru/
```

Expected: HTTP returns `301` to HTTPS; HTTPS still returns intentional `503`
with `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and
`Retry-After` headers.

- [ ] **Step 3: Final verification record**

Record the published Git hash, API image ID, rollback tag, container health,
model IDs, live provider result shape, and maintenance response codes. Record
only `OPENAI_API_KEY=SET`; never record the value. Keep the root-only `.env`
backup and rollback image until administrator bootstrap and the first real photo
analysis are complete.
