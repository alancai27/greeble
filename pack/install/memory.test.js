// Runs pack/install/memory.sh against a scratch HOME.
// node --test pack/install/
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MEMORY = path.join(__dirname, 'memory.sh');
const INSTALL = path.join(__dirname, 'install.sh');
const BLOCK = path.join(__dirname, '..', 'claude', 'CLAUDE.block.md');
const START = '<!-- greeble:start -->';
const END = '<!-- greeble:end -->';

const roots = [];
after(() => roots.forEach((r) => fs.rmSync(r, { recursive: true, force: true })));

function setup({ claudeMd } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'greeble-memory-')));
  roots.push(root);
  const home = path.join(root, 'home');
  const claude = path.join(home, '.claude');
  fs.mkdirSync(claude, { recursive: true });
  const file = path.join(claude, 'CLAUDE.md');
  if (claudeMd !== undefined) fs.writeFileSync(file, claudeMd);
  const vaults = path.join(home, 'Documents', 'Obsidian');
  return { root, home, claude, file, vaults };
}

function run(ctx, { input = '', env = {}, script = MEMORY } = {}) {
  const r = spawnSync('bash', [script], {
    input,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: ctx.home, ...env },
  });
  return { code: r.status, out: r.stdout, err: r.stderr, all: r.stdout + r.stderr };
}

const read = (ctx) => fs.readFileSync(ctx.file, 'utf8');
const rendered = (vaults) => fs.readFileSync(BLOCK, 'utf8').replaceAll('<VAULTS>', vaults);
const wrapped = (vaults) => `${START}\n${rendered(vaults)}${END}\n`;
const count = (s, sub) => s.split(sub).length - 1;

test('the block is short, plain and holds the contract rules', () => {
  const b = fs.readFileSync(BLOCK, 'utf8');
  assert.ok(b.trimEnd().split('\n').length < 15);
  for (const bad of [/full/i, /bypass/i, /permission mode/i, /\/Users\//, /\/home\//, /~\//, /sk-[a-z0-9]/i]) {
    assert.doesNotMatch(b, bad);
  }
  assert.match(b, /<VAULTS>\/Roblox Knowledge/);
  assert.match(b, /list_roblox_skills/);
  assert.match(b, /Precedence/);
  assert.match(b, /Never ask for a key in chat/);
});

test('yes on a missing file creates it with the block', () => {
  const ctx = setup();
  const r = run(ctx, { input: 'y\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.strictEqual(read(ctx), wrapped(ctx.vaults));
  assert.ok(r.err.includes(`add Greeble's rules to ${ctx.file}? [y/N]`), r.err);
  assert.doesNotMatch(read(ctx), /<VAULTS>/);
});

test('yes on an existing file appends and keeps the old text', () => {
  const old = '# Mine\n\n- my rule\n- no trailing newline';
  const ctx = setup({ claudeMd: old });
  const r = run(ctx, { input: 'y\n' });
  assert.strictEqual(r.code, 0, r.all);
  const body = read(ctx);
  assert.ok(body.startsWith(`${old}\n`));
  assert.ok(body.endsWith(wrapped(ctx.vaults)));
});

test('no changes nothing', () => {
  const ctx = setup({ claudeMd: '# Mine\n' });
  const r = run(ctx, { input: 'n\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.strictEqual(read(ctx), '# Mine\n');
  assert.match(r.out, /unchanged/);
  const ctx2 = setup();
  run(ctx2, { input: '\n' });
  assert.ok(!fs.existsSync(ctx2.file));
});

test('no terminal changes nothing, and creates no file', () => {
  const ctx = setup();
  const r = run(ctx, { input: '' });
  assert.strictEqual(r.code, 0, r.all);
  assert.ok(!fs.existsSync(ctx.file));
  const ctx2 = setup({ claudeMd: '# Mine\n' });
  run(ctx2, { input: '' });
  assert.strictEqual(read(ctx2), '# Mine\n');
});

test('run twice: one block and no second question', () => {
  const ctx = setup({ claudeMd: '# Mine\n' });
  run(ctx, { input: 'y\n' });
  const once = read(ctx);
  const r = run(ctx, { input: 'y\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.strictEqual(read(ctx), once);
  assert.ok(!r.err.includes('[y/N]'), r.err);
  assert.match(r.out, /already/);
  assert.strictEqual(count(once, START), 1);
  assert.strictEqual(count(once, END), 1);
});

test('a changed block is replaced in place without asking', () => {
  const before = '# Mine\n\nabove\n';
  const afterText = '\nbelow\n- keep me\n';
  const ctx = setup({ claudeMd: `${before}${START}\nold greeble rules\nline two\n${END}\n${afterText}` });
  const r = run(ctx, { input: '' });
  assert.strictEqual(r.code, 0, r.all);
  assert.ok(!r.err.includes('[y/N]'), r.err);
  assert.strictEqual(read(ctx), `${before}${wrapped(ctx.vaults)}${afterText}`);
  assert.match(r.out, /updated/);
});

test('GREEBLE_CLAUDE_DIR and GREEBLE_VAULTS_DIR are used, vaults as the resolved path', () => {
  const ctx = setup();
  const claude = path.join(ctx.root, 'claude-alt');
  const realVaults = path.join(ctx.root, 'vaults-real');
  fs.mkdirSync(realVaults);
  const link = path.join(ctx.root, 'vaults-link');
  fs.symlinkSync(realVaults, link);
  const r = run(ctx, { input: 'y\n', env: { GREEBLE_CLAUDE_DIR: claude, GREEBLE_VAULTS_DIR: link } });
  assert.strictEqual(r.code, 0, r.all);
  assert.ok(!fs.existsSync(ctx.file));
  assert.strictEqual(fs.readFileSync(path.join(claude, 'CLAUDE.md'), 'utf8'), wrapped(realVaults));
});

test('unbalanced markers change nothing', () => {
  const body = `# Mine\n${START}\nhalf a block\n`;
  const ctx = setup({ claudeMd: body });
  const r = run(ctx, { input: 'y\n' });
  assert.notStrictEqual(r.code, 0);
  assert.strictEqual(read(ctx), body);
});

test('install.sh asks the rules question after the hook questions', () => {
  const ctx = setup();
  const pack = path.join(ctx.root, 'pack');
  fs.mkdirSync(path.join(pack, 'install'), { recursive: true });
  fs.mkdirSync(path.join(pack, 'claude'), { recursive: true });
  fs.copyFileSync(INSTALL, path.join(pack, 'install', 'install.sh'));
  fs.copyFileSync(MEMORY, path.join(pack, 'install', 'memory.sh'));
  fs.copyFileSync(BLOCK, path.join(pack, 'claude', 'CLAUDE.block.md'));
  const r = run(ctx, {
    script: path.join(pack, 'install', 'install.sh'),
    input: 'y\nn\n',
    env: { GREEBLE_URL: 'https://x.test', GREEBLE_KEY: 'k' },
  });
  assert.strictEqual(r.code, 0, r.all);
  assert.strictEqual(read(ctx), wrapped(ctx.vaults));
  // The block file itself is not copied into ~/.claude.
  assert.ok(!fs.existsSync(path.join(ctx.claude, 'CLAUDE.block.md')));
  // The second answer went to the ~/.zshrc question.
  assert.ok(!fs.existsSync(path.join(ctx.home, '.zshrc')));
});
