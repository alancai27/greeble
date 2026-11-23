// Runs pack/install/doctor.sh against a scratch HOME, stub tools and a local
// stub server. node --test pack/install/doctor.test.js
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFile, execFileSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, 'doctor.sh');
const KEY = 'sk-test-"quoted" \'single\' $secret\\4242';
const REAL_CURL = execFileSync('/bin/sh', ['-c', 'command -v curl']).toString().trim();

const roots = [];
const servers = [];
after(() => {
  roots.forEach((r) => fs.rmSync(r, { recursive: true, force: true }));
  servers.forEach((s) => s.close());
});

function write(file, body, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  if (mode !== undefined) fs.chmodSync(file, mode);
}

// Stub server: 200 for the right bearer key on /v1/profile, else 401.
function startServer() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const okAuth = req.headers.authorization === `Bearer ${KEY}`;
      res.statusCode = req.url === '/v1/profile' && okAuth ? 200 : 401;
      res.end('{}');
    });
    servers.push(s);
    s.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${s.address().port}`));
  });
}

// A port that nothing listens on.
function deadUrl() {
  return new Promise((resolve) => {
    const s = http.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(`http://127.0.0.1:${port}`));
    });
  });
}

function setup({ files = true, keyMode = 0o600 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'greeble-doctor-'));
  roots.push(root);
  const home = path.join(root, 'home');
  const bin = path.join(root, 'bin');
  const curlLog = path.join(root, 'curl-args.log');
  fs.mkdirSync(home);
  write(path.join(bin, 'claude'),
    '#!/bin/sh\n[ "$1" = --version ] && { echo "9.9.9 (Claude Code)"; exit 0; }\n' +
    '[ "$1 $2 $3" = "mcp get greeble" ] && { echo greeble; exit 0; }\nexit 1\n', 0o755);
  for (const t of ['rojo', 'selene', 'stylua']) {
    write(path.join(bin, t), `#!/bin/sh\necho "${t} 1.0.0"\n`, 0o755);
  }
  // Wraps real curl and records its arguments so the test can inspect them.
  write(path.join(bin, 'curl'),
    `#!/bin/sh\nprintf '%s\\n' "$@" >> '${curlLog}'\nexec '${REAL_CURL}' "$@"\n`, 0o755);
  write(path.join(home, '.greeble', 'env'), `export GREEBLE_KEY='x'\n`, keyMode);
  if (files) {
    write(path.join(home, '.claude', 'skills', 'greeble', 'SKILL.md'), 'skill\n');
    write(path.join(home, '.claude', 'hooks', 'greeble', 'luau-check.sh'), '#!/bin/sh\n');
    write(path.join(home, 'Documents', 'Obsidian', 'Roblox Knowledge', 'CLAUDE.md'), 'vault\n');
  }
  return { root, home, bin, curlLog };
}

function run(ctx, url) {
  const env = {
    HOME: ctx.home,
    PATH: `${ctx.bin}:${process.env.PATH}`,
    GREEBLE_URL: url,
    GREEBLE_KEY: KEY,
  };
  return new Promise((resolve) => {
    execFile('bash', [SCRIPT], { env }, (err, stdout, stderr) => {
      const code = err ? err.code : 0;
      const args = fs.existsSync(ctx.curlLog) ? fs.readFileSync(ctx.curlLog, 'utf8') : '';
      // The key must never leak into output or curl's argument list.
      assert.ok(!stdout.includes(KEY) && !stderr.includes(KEY), 'key leaked to output');
      assert.ok(!args.includes(KEY) && !args.includes('Bearer'), 'key passed as curl argument');
      resolve({ code, stdout, lines: stdout.trim().split('\n') });
    });
  });
}

const line = (r, prefix) => r.lines.find((l) => l.startsWith(prefix));

test('all ok', async () => {
  const ctx = setup();
  const r = await run(ctx, await startServer());
  assert.strictEqual(r.code, 0, r.stdout);
  for (const l of r.lines) assert.match(l, /^ok [^:]+: /);
  assert.ok(line(r, 'ok server:'));
  assert.ok(line(r, 'ok mcp entry:'));
  assert.ok(fs.readFileSync(ctx.curlLog, 'utf8').length > 0, 'curl was not called');
});

test('401 means key not accepted', async () => {
  const ctx = setup();
  const url = await startServer();
  const env = { HOME: ctx.home, PATH: `${ctx.bin}:${process.env.PATH}`, GREEBLE_URL: url, GREEBLE_KEY: 'wrong' };
  const r = await new Promise((resolve) => execFile('bash', [SCRIPT], { env }, (err, stdout) =>
    resolve({ code: err ? err.code : 0, lines: stdout.trim().split('\n') })));
  assert.strictEqual(r.code, 1);
  assert.match(line(r, 'fail server:'), /key not accepted/);
  // Same check with the real key against a path-mismatched server still hides it.
  const r2 = await run(ctx, `${url}/nope`);
  assert.match(line(r2, 'fail server:'), /key not accepted/);
});

test('server down', async () => {
  const r = await run(setup(), await deadUrl());
  assert.strictEqual(r.code, 1);
  assert.match(line(r, 'fail server:'), /server not reachable/);
});

test('missing files', async () => {
  const r = await run(setup({ files: false }), await startServer());
  assert.strictEqual(r.code, 1);
  const missing = r.lines.filter((l) => l.startsWith('fail file:'));
  assert.strictEqual(missing.length, 3, r.stdout);
  assert.ok(missing.some((l) => l.includes('SKILL.md')));
  assert.ok(missing.some((l) => l.includes('luau-check.sh')));
  assert.ok(missing.some((l) => l.includes('Roblox Knowledge/CLAUDE.md')));
});

test('key file mode 644', async () => {
  const r = await run(setup({ keyMode: 0o644 }), await startServer());
  assert.strictEqual(r.code, 1);
  assert.match(line(r, 'fail key file:'), /644.*chmod 600/);
});
