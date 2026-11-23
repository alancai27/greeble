// Runs pack/install/mcp.sh against a stub `claude` on PATH and a scratch HOME.
// node --test pack/install/
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MCP = path.join(__dirname, 'mcp.sh');
const INSTALL = path.join(__dirname, 'install.sh');
const KEY = 'sk-test-mcp-9f3e1c77';
const URL = 'http://127.0.0.1:8799';
const ENTRY = {
  type: 'http',
  url: '${GREEBLE_URL}/mcp',
  headers: { Authorization: 'Bearer ${GREEBLE_KEY}' },
};
const BASE_PATH = '/usr/bin:/bin:/usr/sbin:/sbin';

// The stub keeps its one entry in $HOME/stub-entry.json, logs each call to
// $HOME/stub-calls.log (argv plus the GREEBLE_* it saw in its environment),
// and answers `mcp list` per STUB_LIST: connected, 401, refused or none.
const STUB = `#!${process.execPath}
const fs = require('fs');
const path = require('path');
const home = process.env.HOME;
const state = path.join(home, 'stub-entry.json');
const argv = process.argv.slice(2);
fs.appendFileSync(path.join(home, 'stub-calls.log'), JSON.stringify({
  argv, url: process.env.GREEBLE_URL ?? null, key: process.env.GREEBLE_KEY ?? null,
}) + '\\n');
const [cmd, sub] = argv;
if (cmd !== 'mcp') process.exit(2);
const has = fs.existsSync(state);
if (sub === 'get') {
  if (!has) { console.error('No MCP server found with name: ' + argv[2]); process.exit(1); }
  const e = JSON.parse(fs.readFileSync(state, 'utf8'));
  const out = [argv[2] + ':', '  Scope: User config (available in all your projects)',
    '  Status: \\u2718 Failed to connect', '  Type: ' + e.type, '  URL: ' + e.url];
  if (e.headers) {
    out.push('  Headers:');
    for (const [k, v] of Object.entries(e.headers)) out.push('    ' + k + ': ' + v);
  }
  out.push('', 'To remove this server, run: claude mcp remove ' + argv[2] + ' -s user');
  console.log(out.join('\\n'));
} else if (sub === 'add-json') {
  if (has) { console.error('MCP server already exists'); process.exit(1); }
  if (argv[2] !== '-s' || argv[3] !== 'user') process.exit(3);
  fs.writeFileSync(state, argv[5]);
  console.log('Added http MCP server ' + argv[4] + ' to user config');
} else if (sub === 'remove') {
  fs.rmSync(state, { force: true });
} else if (sub === 'list') {
  console.log('Checking MCP server health\\u2026\\n');
  if (!has) { console.log('No MCP servers configured.'); process.exit(0); }
  const e = JSON.parse(fs.readFileSync(state, 'utf8'));
  const mode = process.env.STUB_LIST || 'connected';
  if (mode === 'none') process.exit(0);
  const tail = {
    connected: '\\u2714 Connected',
    401: '\\u2718 Failed to connect \\u2014 Server rejected the configured Authorization header (HTTP 401).',
    refused: '\\u2718 Failed to connect \\u2014 ECONNREFUSED: Unable to connect.',
  }[mode];
  console.log('greeble: ' + e.url + ' (HTTP) - ' + tail);
} else process.exit(2);
`;

const roots = [];
after(() => roots.forEach((r) => fs.rmSync(r, { recursive: true, force: true })));

function setup({ entry, envFile = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'greeble-mcp-'));
  roots.push(root);
  const home = path.join(root, 'home');
  const bin = path.join(root, 'bin');
  fs.mkdirSync(home);
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'claude'), STUB, { mode: 0o755 });
  if (envFile) {
    fs.mkdirSync(path.join(home, '.greeble'));
    fs.writeFileSync(
      path.join(home, '.greeble', 'env'),
      `export GREEBLE_URL='${URL}'\nexport GREEBLE_KEY='${KEY}'\n`,
      { mode: 0o600 },
    );
  }
  if (entry) fs.writeFileSync(path.join(home, 'stub-entry.json'), JSON.stringify(entry));
  return { root, home, bin };
}

function run(ctx, { input = '', env = {}, stub = true, script = MCP } = {}) {
  const r = spawnSync('bash', [script], {
    input,
    encoding: 'utf8',
    env: { PATH: stub ? `${ctx.bin}:${BASE_PATH}` : BASE_PATH, HOME: ctx.home, ...env },
  });
  return { code: r.status, out: r.stdout, err: r.stderr, all: r.stdout + r.stderr };
}

function calls(ctx) {
  const f = path.join(ctx.home, 'stub-calls.log');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

const entry = (ctx) => JSON.parse(fs.readFileSync(path.join(ctx.home, 'stub-entry.json'), 'utf8'));
const subs = (ctx) => calls(ctx).map((c) => c.argv[1]);

// No argument to any claude call, and nothing printed, holds the URL or key.
function assertNoLeak(ctx, r) {
  assert.ok(!r.all.includes(KEY), 'key in output');
  assert.ok(!r.all.includes(URL), 'url in output');
  for (const c of calls(ctx)) {
    const args = c.argv.join(' ');
    assert.ok(!args.includes(KEY), `key in argv: ${c.argv[1]}`);
    assert.ok(!args.includes(URL), `url in argv: ${c.argv[1]}`);
    if (c.argv[1] !== 'list') assert.strictEqual(c.key, null, `key in env of ${c.argv[1]}`);
  }
  const stored = path.join(ctx.home, 'stub-entry.json');
  if (fs.existsSync(stored)) assert.ok(!fs.readFileSync(stored, 'utf8').includes(KEY));
}

test('first add stores the placeholders literally, then reports connected', () => {
  const ctx = setup();
  const r = run(ctx, { env: { GREEBLE_URL: URL, GREEBLE_KEY: KEY } });
  assert.strictEqual(r.code, 0, r.all);
  const add = calls(ctx).find((c) => c.argv[1] === 'add-json');
  assert.deepStrictEqual(add.argv.slice(0, 5), ['mcp', 'add-json', '-s', 'user', 'greeble']);
  assert.strictEqual(
    add.argv[5],
    '{"type":"http","url":"${GREEBLE_URL}/mcp","headers":{"Authorization":"Bearer ${GREEBLE_KEY}"}}',
  );
  assert.deepStrictEqual(entry(ctx), ENTRY);
  // The check ran with the values sourced from ~/.greeble/env.
  const list = calls(ctx).find((c) => c.argv[1] === 'list');
  assert.deepStrictEqual(list.argv, ['mcp', 'list']);
  assert.strictEqual(list.key, KEY);
  assert.strictEqual(list.url, URL);
  assert.match(r.out, /added the greeble MCP entry/);
  assert.strictEqual(r.out.trim().split('\n').pop(), 'ok greeble connected');
  assertNoLeak(ctx, r);
  // Never a project .mcp.json or a settings change.
  assert.ok(!fs.existsSync(path.join(ctx.home, '.mcp.json')));
  assert.ok(!fs.existsSync(path.join(ctx.home, '.claude')));
});

test('same entry already there is skipped', () => {
  const ctx = setup({ entry: ENTRY });
  const r = run(ctx);
  assert.strictEqual(r.code, 0, r.all);
  assert.deepStrictEqual(subs(ctx), ['get', 'list']);
  assert.match(r.out, /already there/);
  assert.ok(!r.err.includes('replace?'));
  assertNoLeak(ctx, r);
});

test('different entry is kept with no input', () => {
  const other = { type: 'http', url: 'https://elsewhere.test/mcp' };
  const ctx = setup({ entry: other });
  const r = run(ctx, { input: '' });
  assert.match(r.err, /replace\? \[y\/N\]/);
  assert.deepStrictEqual(entry(ctx), other);
  assert.ok(!subs(ctx).includes('remove'));
  assert.ok(!subs(ctx).includes('add-json'));
  assert.match(r.out, /kept the existing greeble MCP entry/);
  assertNoLeak(ctx, r);
});

test('different entry is kept on "n" and replaced on "y"', () => {
  const other = { type: 'http', url: 'https://elsewhere.test/mcp' };
  const n = setup({ entry: other });
  run(n, { input: 'n\n' });
  assert.deepStrictEqual(entry(n), other);

  const y = setup({ entry: other });
  const r = run(y, { input: 'y\n' });
  assert.strictEqual(r.code, 0, r.all);
  assert.deepStrictEqual(subs(y), ['get', 'remove', 'add-json', 'list']);
  assert.deepStrictEqual(entry(y), ENTRY);
  assertNoLeak(y, r);
});

test('not connected: 401, unreachable and missing each exit 1 with one line', () => {
  const cases = [
    ['401', 'mcp: greeble key not accepted (401)'],
    ['refused', 'mcp: greeble server not reachable'],
    ['none', 'mcp: greeble entry missing from claude mcp list'],
  ];
  for (const [mode, msg] of cases) {
    const ctx = setup({ entry: ENTRY });
    const r = run(ctx, { env: { STUB_LIST: mode } });
    assert.strictEqual(r.code, 1, `${mode}: ${r.all}`);
    assert.strictEqual(r.err.trim(), msg);
    assert.ok(!r.out.includes('ok greeble connected'));
    assertNoLeak(ctx, r);
  }
});

test('no claude on PATH: exit 1 and install nothing', () => {
  const ctx = setup();
  const r = run(ctx, { stub: false });
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.err.trim(), 'mcp: install Claude Code first, then run this again');
  assert.deepStrictEqual(calls(ctx), []);
  assert.deepStrictEqual(fs.readdirSync(ctx.home).sort(), ['.greeble']);
});

test('install.sh runs mcp.sh as its last step', () => {
  const ctx = setup({ envFile: false });
  const pack = path.join(ctx.root, 'pack', 'install');
  fs.mkdirSync(pack, { recursive: true });
  fs.copyFileSync(INSTALL, path.join(pack, 'install.sh'));
  fs.copyFileSync(MCP, path.join(pack, 'mcp.sh'));
  const r = run(ctx, {
    script: path.join(pack, 'install.sh'),
    env: { GREEBLE_URL: URL, GREEBLE_KEY: KEY },
  });
  assert.strictEqual(r.code, 0, r.all);
  assert.strictEqual(r.out.trim().split('\n').pop(), 'ok greeble connected');
  assert.deepStrictEqual(entry(ctx), ENTRY);
  assertNoLeak(ctx, r);
});
