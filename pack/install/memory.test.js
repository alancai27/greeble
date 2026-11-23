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
const FULL = path.join(__dirname, '..', 'claude', 'CLAUDE.full-access.md');
const START = '<!-- greeble:start -->';
const END = '<!-- greeble:end -->';
const FSTART = '<!-- greeble-full-access:start -->';
const FEND = '<!-- greeble-full-access:end -->';
const RULES_Q = "add Greeble's rules to";
const FULL_Q = 'turn on full PC access? [y/N]';
const KEEP_Q = 'full PC access is on. keep it? [Y/n]';
const EXPLAIN = [
  'If you say yes, Claude will do these for Roblox work without asking each time: open, close and restart',
  'Roblox Studio; start and stop playtests; start and install tools the work needs; save the place before risky work.',
  'It will still always ask before: spending Robux or money, publishing to a live game, deleting your work,',
  'or a login only you can pass. This adds rules text only; it does not change any permission setting.',
].join('\n');

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
const fullWrapped = () => `\n${FSTART}\n${fs.readFileSync(FULL, 'utf8')}${FEND}\n`;
// The explanation must come right before each full-access question.
const explainedBefore = (err, q) => {
  const at = err.indexOf(q);
  return at > 0 && err.slice(0, at).trimEnd().endsWith(EXPLAIN.trimEnd()) && count(err, EXPLAIN) === count(err, q);
};

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
  // The only question left is full access; Enter leaves it off.
  const r = run(ctx, { input: '\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.strictEqual(read(ctx), once);
  assert.ok(!r.err.includes(RULES_Q), r.err);
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
  assert.ok(!r.err.includes(RULES_Q), r.err);
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
  fs.copyFileSync(FULL, path.join(pack, 'claude', 'CLAUDE.full-access.md'));
  const r = run(ctx, {
    script: path.join(pack, 'install', 'install.sh'),
    input: 'y\nn\nn\n',
    env: { GREEBLE_URL: 'https://x.test', GREEBLE_KEY: 'k' },
  });
  assert.strictEqual(r.code, 0, r.all);
  assert.strictEqual(read(ctx), wrapped(ctx.vaults));
  // The block file itself is not copied into ~/.claude.
  assert.ok(!fs.existsSync(path.join(ctx.claude, 'CLAUDE.block.md')));
  // The second answer went to the full-access question, the third to ~/.zshrc.
  assert.ok(explainedBefore(r.err, FULL_Q), r.err);
  assert.ok(!fs.existsSync(path.join(ctx.home, '.zshrc')));
});

test('the full-access section holds the contract text and nothing about bypass', () => {
  const f = fs.readFileSync(FULL, 'utf8');
  for (const item of [
    'Open, close and restart Roblox Studio',
    'Start and stop playtests',
    'Start and install tools the work needs',
    'Save the place before risky work',
    'Spending Robux or money',
    'Publishing to a live game',
    "Deleting the dev's work",
    'A login only the dev can pass',
  ]) {
    assert.ok(f.includes(item), item);
  }
  assert.match(f, /overrides the "Ask first" line/);
  assert.match(f, /four items below only/);
  for (const p of [FULL, MEMORY]) assert.doesNotMatch(fs.readFileSync(p, 'utf8'), /bypass/i, p);
  assert.doesNotMatch(f, /permission|settings/i);
  assert.doesNotMatch(fs.readFileSync(MEMORY, 'utf8'), /settings\.json/);
});

test('full access: Enter means off', () => {
  const ctx = setup({ claudeMd: '# Mine\n' });
  const r = run(ctx, { input: 'y\n\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.strictEqual(read(ctx), `# Mine\n\n${wrapped(ctx.vaults)}`);
  assert.ok(explainedBefore(r.err, FULL_Q), r.err);
  assert.match(r.out, /full PC access is off/);
});

test('full access: anything but y or yes means off', () => {
  for (const a of ['n', 'sure', 'yess']) {
    const ctx = setup({ claudeMd: '# Mine\n' });
    run(ctx, { input: `y\n${a}\n` });
    assert.ok(!read(ctx).includes(FSTART), a);
  }
});

test('full access: "yes" turns it on, and the explanation comes first', () => {
  for (const a of ['yes', 'Y', 'YeS']) {
    const ctx = setup({ claudeMd: '# Mine\n' });
    const r = run(ctx, { input: `y\n${a}\n` });
    assert.strictEqual(r.code, 0, r.all);
    assert.strictEqual(read(ctx), `# Mine\n\n${wrapped(ctx.vaults)}${fullWrapped()}`, a);
    assert.ok(explainedBefore(r.err, FULL_Q), r.err);
    assert.strictEqual(count(read(ctx), FSTART), 1);
  }
});

test('full access is asked on a later run when the rules block is already there', () => {
  const ctx = setup({ claudeMd: '# Mine\n' });
  run(ctx, { input: 'y\nn\n' });
  const r = run(ctx, { input: 'yes\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.ok(!r.err.includes(RULES_Q), r.err);
  assert.ok(explainedBefore(r.err, FULL_Q), r.err);
  assert.strictEqual(read(ctx), `# Mine\n\n${wrapped(ctx.vaults)}${fullWrapped()}`);
});

test('full access is not asked when the rules block is declined', () => {
  const ctx = setup({ claudeMd: '# Mine\n' });
  const r = run(ctx, { input: 'n\ny\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.strictEqual(read(ctx), '# Mine\n');
  assert.ok(!r.err.includes(FULL_Q), r.err);
  assert.ok(!r.err.includes(EXPLAIN), r.err);
});

test('full access: a second run with n removes it cleanly; Enter keeps it', () => {
  const mine = '# Mine\n\n- my rule\n';
  const ctx = setup({ claudeMd: mine });
  run(ctx, { input: 'y\ny\n' });
  const on = read(ctx);
  const keep = run(ctx, { input: '\n' });
  assert.strictEqual(keep.code, 0, keep.all);
  assert.ok(explainedBefore(keep.err, KEEP_Q), keep.err);
  assert.ok(!keep.err.includes(FULL_Q), keep.err);
  assert.strictEqual(read(ctx), on);
  const r = run(ctx, { input: 'n\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.ok(explainedBefore(r.err, KEEP_Q), r.err);
  assert.strictEqual(read(ctx), `${mine}\n${wrapped(ctx.vaults)}`);
  assert.ok(!read(ctx).includes('greeble-full-access'));
});

test('full access removal keeps text after it, and the rules block, intact', () => {
  const ctx = setup({ claudeMd: '# Mine\n' });
  run(ctx, { input: 'y\ny\n' });
  fs.appendFileSync(ctx.file, '\n- added later by the dev\n');
  const r = run(ctx, { input: 'No\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.strictEqual(read(ctx), `# Mine\n\n${wrapped(ctx.vaults)}\n\n- added later by the dev\n`);
});

test('full access: no terminal changes nothing, on or off', () => {
  const ctx = setup({ claudeMd: '# Mine\n' });
  run(ctx, { input: 'y\n' });
  const off = read(ctx);
  const r1 = run(ctx, { input: '' });
  assert.strictEqual(r1.code, 0, r1.all);
  assert.ok(explainedBefore(r1.err, FULL_Q), r1.err);
  assert.strictEqual(read(ctx), off);
  run(ctx, { input: 'y\n' });
  const on = read(ctx);
  assert.ok(on.includes(FSTART));
  const r2 = run(ctx, { input: '' });
  assert.strictEqual(r2.code, 0, r2.all);
  assert.ok(explainedBefore(r2.err, KEEP_Q), r2.err);
  assert.strictEqual(read(ctx), on);
  assert.ok(on.startsWith(`# Mine\n\n${wrapped(ctx.vaults)}`));
});

test('full access: a yes run leaves settings.json byte-identical', () => {
  const ctx = setup({ claudeMd: '# Mine\n' });
  const settings = path.join(ctx.claude, 'settings.json');
  const bytes = Buffer.from('{\n  "permissions": { "allow": ["Bash(ls:*)"] },\r\n  "x": "\u00e9"\n}');
  fs.writeFileSync(settings, bytes);
  const mtime = fs.statSync(settings).mtimeMs;
  const r = run(ctx, { input: 'y\nyes\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.ok(read(ctx).includes(FSTART));
  assert.ok(fs.readFileSync(settings).equals(bytes));
  assert.strictEqual(fs.statSync(settings).mtimeMs, mtime);
});

test('unbalanced full-access markers change nothing', () => {
  const ctx = setup({ claudeMd: '# Mine\n' });
  run(ctx, { input: 'y\nn\n' });
  fs.appendFileSync(ctx.file, `${FSTART}\nhalf\n`);
  const body = read(ctx);
  const r = run(ctx, { input: 'y\n' });
  assert.notStrictEqual(r.code, 0);
  assert.strictEqual(read(ctx), body);
});
