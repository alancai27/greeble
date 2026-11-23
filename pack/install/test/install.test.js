// Runs pack/install/install.sh against a scratch HOME and a fixture pack.
// node --test pack/install/test/
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'install.sh');
const KEY = "sk-test-'quoted' $secret-4242";
const URL = 'https://greeble.example.test/api//';
const SRCLINE = '[ -f "$HOME/.greeble/env" ] && . "$HOME/.greeble/env"';

function write(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

const roots = [];
after(() => roots.forEach((r) => fs.rmSync(r, { recursive: true, force: true })));

// A scratch root holding a fixture pack (with a copy of the script) and a HOME.
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'greeble-install-'));
  roots.push(root);
  const pack = path.join(root, 'pack');
  const home = path.join(root, 'home');
  fs.mkdirSync(home);
  write(path.join(pack, 'install', 'install.sh'), fs.readFileSync(SCRIPT));
  fs.chmodSync(path.join(pack, 'install', 'install.sh'), 0o755);
  write(path.join(pack, 'claude', 'skills', 'learn', 'SKILL.md'), 'learn skill\n');
  write(path.join(pack, 'claude', 'skills', 'learn', 'refs', 'a.md'), 'ref a\n');
  write(path.join(pack, 'claude', 'skills', 'draft', 'SKILL.md'), 'draft skill\n');
  write(path.join(pack, 'claude', 'commands', 'greeble.md'), 'command\n');
  write(path.join(pack, 'claude', 'commands', 'notes.txt'), 'not a command\n');
  write(path.join(pack, 'claude', 'hooks', 'on-stop.sh'), '#!/bin/sh\n');
  write(path.join(pack, 'vaults', 'Greeble', 'Home.md'), '# Home\n');
  write(path.join(pack, 'vaults', 'Greeble', 'nested dir', 'Note.md'), 'note\n');
  return { root, pack, home };
}

function run(ctx, { input = '', env = {} } = {}) {
  const r = spawnSync('bash', [path.join(ctx.pack, 'install', 'install.sh')], {
    input,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: ctx.home,
      GREEBLE_URL: URL,
      GREEBLE_KEY: KEY,
      ...env,
    },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function lastLine(s) {
  const lines = s.trim().split('\n');
  return lines[lines.length - 1];
}

const expected = [
  '.claude/skills/learn/SKILL.md',
  '.claude/skills/learn/refs/a.md',
  '.claude/skills/draft/SKILL.md',
  '.claude/commands/greeble.md',
  '.claude/hooks/greeble/on-stop.sh',
  'Documents/Obsidian/Greeble/Home.md',
  'Documents/Obsidian/Greeble/nested dir/Note.md',
];

test('first run copies everything, second run copies nothing', () => {
  const ctx = setup();
  const r1 = run(ctx);
  assert.strictEqual(r1.code, 0, r1.err);
  for (const rel of expected) {
    assert.ok(fs.existsSync(path.join(ctx.home, rel)), `missing ${rel}`);
  }
  assert.ok(!fs.existsSync(path.join(ctx.home, '.claude/commands/notes.txt')));
  assert.strictEqual(lastLine(r1.out), `copied ${expected.length}, kept 0, skipped 0`);

  const r2 = run(ctx);
  assert.strictEqual(r2.code, 0, r2.err);
  assert.strictEqual(lastLine(r2.out), `copied 0, kept 0, skipped ${expected.length}`);
});

test('honours GREEBLE_CLAUDE_DIR and GREEBLE_VAULTS_DIR', () => {
  const ctx = setup();
  const claude = path.join(ctx.root, 'c');
  const vaults = path.join(ctx.root, 'v');
  const r = run(ctx, { env: { GREEBLE_CLAUDE_DIR: claude, GREEBLE_VAULTS_DIR: vaults } });
  assert.strictEqual(r.code, 0, r.err);
  assert.ok(fs.existsSync(path.join(claude, 'skills/learn/SKILL.md')));
  assert.ok(fs.existsSync(path.join(vaults, 'Greeble/Home.md')));
  assert.ok(!fs.existsSync(path.join(ctx.home, '.claude')));
});

test('missing source dirs are skipped', () => {
  const ctx = setup();
  fs.rmSync(path.join(ctx.pack, 'vaults'), { recursive: true });
  fs.rmSync(path.join(ctx.pack, 'claude', 'hooks'), { recursive: true });
  const r = run(ctx);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(lastLine(r.out), 'copied 4, kept 0, skipped 0');
});

test('an edited target file is kept on no, or with no input', () => {
  const ctx = setup();
  run(ctx);
  const target = path.join(ctx.home, '.claude/skills/learn/SKILL.md');
  fs.writeFileSync(target, 'my edits\n');

  const rNo = run(ctx, { input: 'n\nn\n' });
  assert.strictEqual(rNo.code, 0, rNo.err);
  assert.match(rNo.err, /overwrite\? \[y\/N\]/);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'my edits\n');
  assert.strictEqual(lastLine(rNo.out), `copied 0, kept 1, skipped ${expected.length - 1}`);

  const rNone = run(ctx, { input: '' });
  assert.strictEqual(rNone.code, 0, rNone.err);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'my edits\n');

  const rYes = run(ctx, { input: 'y\nn\n' });
  assert.strictEqual(rYes.code, 0, rYes.err);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'learn skill\n');
  assert.strictEqual(lastLine(rYes.out), `copied 1, kept 0, skipped ${expected.length - 1}`);
});

test('answering yes twice leaves .zshrc with one source line', () => {
  const ctx = setup();
  const zshrc = path.join(ctx.home, '.zshrc');
  fs.writeFileSync(zshrc, 'export FOO=1');
  run(ctx, { input: 'y\n' });
  run(ctx, { input: 'y\n' });
  const body = fs.readFileSync(zshrc, 'utf8');
  assert.strictEqual(body.split('\n').filter((l) => l === SRCLINE).length, 1);
  assert.ok(body.startsWith('export FOO=1\n'));
});

test('answering no leaves .zshrc untouched and prints the line', () => {
  const ctx = setup();
  const zshrc = path.join(ctx.home, '.zshrc');
  fs.writeFileSync(zshrc, 'export FOO=1\n');
  const r = run(ctx, { input: 'n\n' });
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(fs.readFileSync(zshrc, 'utf8'), 'export FOO=1\n');
  assert.ok(r.out.includes(SRCLINE));

  const ctx2 = setup();
  const r2 = run(ctx2, { input: '' });
  assert.ok(!fs.existsSync(path.join(ctx2.home, '.zshrc')));
  assert.ok(r2.out.includes(SRCLINE));
});

test('env file is mode 600, URL has no trailing slash, and sourcing it gives the values', () => {
  const ctx = setup();
  const r = run(ctx);
  assert.strictEqual(r.code, 0, r.err);
  const envfile = path.join(ctx.home, '.greeble', 'env');
  assert.strictEqual(fs.statSync(envfile).mode & 0o777, 0o600);
  const lines = fs.readFileSync(envfile, 'utf8').trim().split('\n');
  assert.strictEqual(lines.length, 2);
  assert.ok(lines.every((l) => l.startsWith('export ')));
  for (const sh of ['bash', 'zsh']) {
    const s = spawnSync(sh, ['-c', `. "${envfile}"; printf '%s\\n%s' "$GREEBLE_URL" "$GREEBLE_KEY"`], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    });
    if (s.error) continue; // shell not installed
    assert.strictEqual(s.stdout, `https://greeble.example.test/api\n${KEY}`);
  }
});

test('the key never appears in stdout or stderr, from env or prompt', () => {
  const ctx = setup();
  const fromEnv = run(ctx);
  assert.ok(!fromEnv.out.includes(KEY) && !fromEnv.err.includes(KEY));
  assert.ok(!fromEnv.out.includes('4242') && !fromEnv.err.includes('4242'));

  const ctx2 = setup();
  const prompted = run(ctx2, {
    input: `https://x.test/\n${KEY}\nn\n`,
    env: { GREEBLE_URL: '', GREEBLE_KEY: '' },
  });
  assert.strictEqual(prompted.code, 0, prompted.err);
  assert.ok(!prompted.out.includes('4242') && !prompted.err.includes('4242'));
  const env = fs.readFileSync(path.join(ctx2.home, '.greeble', 'env'), 'utf8');
  assert.ok(env.includes("GREEBLE_URL='https://x.test'"));
});

test('fails with one line when there is no key, and rejects arguments', () => {
  const ctx = setup();
  const r = run(ctx, { env: { GREEBLE_KEY: '' } });
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.err.trim().split('\n').pop().startsWith('install: '), true);

  const a = spawnSync('bash', [path.join(ctx.pack, 'install', 'install.sh'), KEY], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: ctx.home },
  });
  assert.strictEqual(a.status, 1);
  assert.ok(!a.stdout.includes('4242') && !a.stderr.includes('4242'));
});

test('bash -n and zsh -n accept the script', () => {
  for (const sh of ['bash', 'zsh']) {
    const s = spawnSync(sh, ['-n', SCRIPT], { encoding: 'utf8' });
    if (s.error && sh === 'zsh') continue; // zsh not installed
    assert.strictEqual(s.status, 0, `${sh} -n: ${s.stderr}`);
  }
});
