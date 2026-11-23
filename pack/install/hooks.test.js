// Runs pack/install/hooks.sh against a scratch HOME.
// node --test pack/install/
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOKS = path.join(__dirname, 'hooks.sh');
const INSTALL = path.join(__dirname, 'install.sh');

const roots = [];
after(() => roots.forEach((r) => fs.rmSync(r, { recursive: true, force: true })));

function setup({ settings } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'greeble-hooks-')));
  roots.push(root);
  const home = path.join(root, 'home');
  const claude = path.join(home, '.claude');
  fs.mkdirSync(claude, { recursive: true });
  const file = path.join(claude, 'settings.json');
  if (settings !== undefined) {
    fs.writeFileSync(file, typeof settings === 'string' ? settings : JSON.stringify(settings, null, 2));
  }
  return { root, home, claude, file, dir: path.join(claude, 'hooks', 'greeble') };
}

function run(ctx, { input = '', env = {}, script = HOOKS } = {}) {
  const r = spawnSync('bash', [script], {
    input,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: ctx.home, ...env },
  });
  return { code: r.status, out: r.stdout, err: r.stderr, all: r.stdout + r.stderr };
}

const read = (ctx) => JSON.parse(fs.readFileSync(ctx.file, 'utf8'));
const luau = (ctx) => ({
  matcher: 'Write|Edit|MultiEdit',
  hooks: [{ type: 'command', command: `${ctx.dir}/luau-check.sh`, timeout: 30 }],
});
const session = (ctx) => ({ hooks: [{ type: 'command', command: `${ctx.dir}/session-start.sh` }] });
const status = (ctx) => ({ type: 'command', command: `${ctx.dir}/statusline.sh` });

const FIXTURE = {
  permissions: { allow: ['Bash(npm test)'], deny: ['Read(.env)'], defaultMode: 'acceptEdits' },
  enableWorkflows: true,
  model: 'opus',
  someUnknownKey: { nested: [1, 2.5, null, false, 'x'], 'ünï': 'cödé' },
  hooks: {
    PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/x/mine.sh' }] }],
    Stop: [{ hooks: [{ type: 'command', command: '/x/stop.sh' }] }],
  },
};

test('all yes on a missing file creates it with the three items', () => {
  const ctx = setup();
  const r = run(ctx, { input: 'y\ny\ny\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.deepStrictEqual(read(ctx), {
    hooks: { PostToolUse: [luau(ctx)], SessionStart: [session(ctx)] },
    statusLine: status(ctx),
  });
  assert.strictEqual((r.err.match(/\[y\/N\]/g) || []).length, 3);
  // Nothing to back up: there was no file.
  assert.ok(!fs.existsSync(`${ctx.file}.greeble-bak`));
});

test('all no changes nothing', () => {
  const ctx = setup({ settings: FIXTURE });
  const before = fs.readFileSync(ctx.file, 'utf8');
  const r = run(ctx, { input: 'n\nn\nn\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.strictEqual(fs.readFileSync(ctx.file, 'utf8'), before);
  assert.ok(!fs.existsSync(`${ctx.file}.greeble-bak`));
  assert.match(r.out, /unchanged/);
});

test('no terminal changes nothing, and creates no file', () => {
  const ctx = setup();
  const r = run(ctx, { input: '' });
  assert.strictEqual(r.code, 0, r.all);
  assert.ok(!fs.existsSync(ctx.file));
  const ctx2 = setup({ settings: FIXTURE });
  const before = fs.readFileSync(ctx2.file, 'utf8');
  run(ctx2, { input: '' });
  assert.strictEqual(fs.readFileSync(ctx2.file, 'utf8'), before);
});

test('mixed answers turn on only the yes items', () => {
  const ctx = setup();
  run(ctx, { input: 'n\ny\nn\n' });
  assert.deepStrictEqual(read(ctx), { hooks: { SessionStart: [session(ctx)] } });
});

test('run twice: no duplicates and no second questions', () => {
  const ctx = setup({ settings: FIXTURE });
  run(ctx, { input: 'y\ny\ny\n' });
  const once = read(ctx);
  const r = run(ctx, { input: 'y\ny\ny\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.deepStrictEqual(read(ctx), once);
  assert.ok(!r.err.includes('[y/N]'), r.err);
  assert.match(r.out, /already on/);
  assert.strictEqual(once.hooks.PostToolUse.filter((m) => m.matcher === 'Write|Edit|MultiEdit').length, 1);
  assert.strictEqual(once.hooks.SessionStart.length, 1);
});

test('yes keeps permissions, unknown keys and existing hooks unchanged', () => {
  const ctx = setup({ settings: FIXTURE });
  const original = fs.readFileSync(ctx.file, 'utf8');
  const r = run(ctx, { input: 'y\ny\ny\n' });
  assert.strictEqual(r.code, 0, r.all);
  const s = read(ctx);
  assert.deepStrictEqual(s.permissions, FIXTURE.permissions);
  assert.strictEqual(s.enableWorkflows, true);
  assert.strictEqual(s.model, 'opus');
  assert.deepStrictEqual(s.someUnknownKey, FIXTURE.someUnknownKey);
  assert.deepStrictEqual(s.hooks.Stop, FIXTURE.hooks.Stop);
  assert.deepStrictEqual(s.hooks.PostToolUse, [FIXTURE.hooks.PostToolUse[0], luau(ctx)]);
  assert.deepStrictEqual(s.hooks.SessionStart, [session(ctx)]);
  assert.deepStrictEqual(s.statusLine, status(ctx));
  // Only the listed keys differ.
  const { hooks: _h, statusLine: _s, ...rest } = s;
  const { hooks: _fh, ...fixtureRest } = FIXTURE;
  assert.deepStrictEqual(rest, fixtureRest);
  // Backed up once, holding the original bytes.
  assert.strictEqual(fs.readFileSync(`${ctx.file}.greeble-bak`, 'utf8'), original);
});

test('an existing status line is named in the question and kept on no', () => {
  const mine = { type: 'command', command: '/x/my-status.sh' };
  const ctx = setup({ settings: { ...FIXTURE, statusLine: mine } });
  const r = run(ctx, { input: 'y\ny\nn\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.match(r.err, /status line already set \(\/x\/my-status\.sh\)/);
  assert.deepStrictEqual(read(ctx).statusLine, mine);

  const ctx2 = setup({ settings: { statusLine: mine } });
  run(ctx2, { input: 'n\nn\ny\n' });
  assert.deepStrictEqual(read(ctx2).statusLine, status(ctx2));
});

test('backup is made once and not overwritten', () => {
  const ctx = setup({ settings: { a: 1 } });
  run(ctx, { input: 'y\nn\nn\n' });
  run(ctx, { input: 'y\n' });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(`${ctx.file}.greeble-bak`, 'utf8')), { a: 1 });
  assert.ok(read(ctx).hooks.SessionStart);
});

test('unparseable settings.json: exit 1, one line, file untouched', () => {
  for (const body of ['{"a": 1,', '', '[1, 2]', '{"hooks": []}']) {
    const ctx = setup({ settings: body });
    const r = run(ctx, { input: 'y\ny\ny\n' });
    assert.strictEqual(r.code, 1, r.all);
    assert.strictEqual(r.err.trim().split('\n').length, 1, r.err);
    assert.match(r.err, /^hooks: .*does not parse/);
    assert.strictEqual(fs.readFileSync(ctx.file, 'utf8'), body);
    assert.ok(!fs.existsSync(`${ctx.file}.greeble-bak`));
  }
});

test('GREEBLE_CLAUDE_DIR is used and written as the resolved path', () => {
  const ctx = setup();
  const other = path.join(ctx.root, 'other');
  fs.mkdirSync(other);
  const link = path.join(ctx.root, 'link');
  fs.symlinkSync(other, link);
  const r = run(ctx, { input: 'y\nn\nn\n', env: { GREEBLE_CLAUDE_DIR: link } });
  assert.strictEqual(r.code, 0, r.all);
  const s = JSON.parse(fs.readFileSync(path.join(other, 'settings.json'), 'utf8'));
  assert.strictEqual(s.hooks.PostToolUse[0].hooks[0].command, `${other}/hooks/greeble/luau-check.sh`);
  assert.ok(!fs.existsSync(ctx.file));
});

test('install.sh asks the hook questions after the copy step', () => {
  const ctx = setup();
  const pack = path.join(ctx.root, 'pack', 'install');
  fs.mkdirSync(pack, { recursive: true });
  fs.copyFileSync(INSTALL, path.join(pack, 'install.sh'));
  fs.copyFileSync(HOOKS, path.join(pack, 'hooks.sh'));
  const r = run(ctx, {
    script: path.join(pack, 'install.sh'),
    input: 'y\nn\nn\nn\n',
    env: { GREEBLE_URL: 'https://x.test', GREEBLE_KEY: 'k' },
  });
  assert.strictEqual(r.code, 0, r.all);
  assert.deepStrictEqual(read(ctx), { hooks: { PostToolUse: [luau(ctx)] } });
  // The fourth answer went to the ~/.zshrc question, after the hook questions.
  assert.ok(!fs.existsSync(path.join(ctx.home, '.zshrc')));
});
