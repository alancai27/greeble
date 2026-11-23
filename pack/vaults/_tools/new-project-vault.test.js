const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, 'new-project-vault.sh');
const templates = path.join(__dirname, '..', '_templates');

function scratch() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'npv-'));
  const vaults = path.join(home, 'Documents', 'Obsidian');
  fs.mkdirSync(vaults, { recursive: true });
  fs.cpSync(templates, path.join(vaults, '_templates'), { recursive: true });
  return { home, vaults };
}

function run(home, args) {
  const env = { ...process.env, HOME: home };
  delete env.GREEBLE_VAULTS_DIR;
  return spawnSync('bash', [script, ...args], { env, encoding: 'utf8' });
}

test('project kind copies the project template', () => {
  const { home, vaults } = scratch();
  const r = run(home, ['--name', 'Alpha']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(vaults, 'Alpha', 'CLAUDE.md')));
  assert.ok(fs.existsSync(path.join(vaults, 'Alpha', '.obsidian')));
  assert.ok(!fs.existsSync(path.join(vaults, 'Alpha', 'remotes.md')));
  assert.match(r.stdout, /Skipped/);
});

test('roblox kind runs git init and adds a .gitignore', () => {
  const { home, vaults } = scratch();
  const code = path.join(home, 'code', 'game');
  const r = run(home, ['--name', 'Game', '--code-path', code, '--kind', 'roblox']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(vaults, 'Game', 'remotes.md')));
  assert.ok(fs.existsSync(path.join(code, '.git')));
  const ignore = fs.readFileSync(path.join(code, '.gitignore'));
  assert.notDeepStrictEqual([...ignore.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.match(ignore.toString('utf8'), /\*\.rbxl/);
});

test('roblox kind keeps an existing .gitignore', () => {
  const { home } = scratch();
  const code = path.join(home, 'code');
  fs.mkdirSync(code);
  fs.writeFileSync(path.join(code, '.gitignore'), 'mine\n');
  const r = run(home, ['--name', 'Keep', '--code-path', code, '--kind', 'roblox']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(fs.readFileSync(path.join(code, '.gitignore'), 'utf8'), 'mine\n');
});

test('existing target is refused and left unchanged', () => {
  const { home, vaults } = scratch();
  const target = path.join(vaults, 'Taken');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'note.md'), 'keep');
  const r = run(home, ['--name', 'Taken']);
  assert.strictEqual(r.status, 1);
  assert.deepStrictEqual(fs.readdirSync(target), ['note.md']);
  assert.strictEqual(fs.readFileSync(path.join(target, 'note.md'), 'utf8'), 'keep');
});

test('name with a space works', () => {
  const { home, vaults } = scratch();
  const r = run(home, ['--name', 'My Project']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(vaults, 'My Project', 'CLAUDE.md')));
});

test('GREEBLE_VAULTS_DIR overrides the default location', () => {
  const { home } = scratch();
  const other = path.join(home, 'elsewhere');
  fs.mkdirSync(other);
  fs.cpSync(templates, path.join(other, '_templates'), { recursive: true });
  const env = { ...process.env, HOME: home, GREEBLE_VAULTS_DIR: other };
  const r = spawnSync('bash', [script, '--name', 'Beta'], { env, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(other, 'Beta', 'CLAUDE.md')));
});
