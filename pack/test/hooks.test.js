const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const hooks = path.join(__dirname, "..", "claude", "hooks");
const sessionStart = path.join(hooks, "session-start.sh");
const statusline = path.join(hooks, "statusline.sh");
const shells = ["/bin/bash", "/bin/zsh"].filter((s) => fs.existsSync(s));

// A scratch HOME with a vault folder, and a separate place for games.
function scratch() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "greeble-hooks-")));
  const home = path.join(base, "home");
  const vaults = path.join(home, "Documents", "Obsidian");
  const games = path.join(base, "games");
  fs.mkdirSync(vaults, { recursive: true });
  fs.mkdirSync(games, { recursive: true });
  return { base, home, vaults, games };
}

function write(file, text, mtimeSec) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  if (mtimeSec) fs.utimesSync(file, mtimeSec, mtimeSec);
}

// A bare-bones repo: only what the scripts read, so no git binary is needed.
function fakeRepo(dir, branch) {
  write(path.join(dir, ".git", "HEAD"), `ref: refs/heads/${branch}\n`);
}

function run(shell, script, s, input, cwd) {
  const env = { ...process.env, HOME: s.home };
  delete env.GREEBLE_VAULTS_DIR;
  return spawnSync(shell, [script], {
    env,
    input,
    cwd: cwd || s.base,
    encoding: "utf8",
  });
}

for (const shell of shells) {
  const name = path.basename(shell);

  test(`${name}: session-start prints the vault CLAUDE.md and newest handoff`, () => {
    const s = scratch();
    const game = path.join(s.games, "obby");
    fakeRepo(game, "main");
    const sub = path.join(game, "src", "deep");
    fs.mkdirSync(sub, { recursive: true });
    write(path.join(s.vaults, "obby", "CLAUDE.md"), "| route | file |\n");
    write(path.join(game, "HANDOFF.md"), "old handoff\n", 1_600_000_000);
    write(path.join(s.vaults, "obby", "notes", "HANDOFF.md"), "new handoff\n", 1_700_000_000);

    const r = run(shell, sessionStart, s, JSON.stringify({ cwd: sub }));
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
    assert.match(r.stdout, /^## Vault: .*obby\/CLAUDE\.md\n\n\| route \| file \|\n/);
    assert.match(r.stdout, /## Handoff: .*notes\/HANDOFF\.md\n\nnew handoff\n$/);
    assert.ok(!r.stdout.includes("old handoff"));
  });

  test(`${name}: session-start uses GREEBLE_VAULTS_DIR and the folder outside a repo`, () => {
    const s = scratch();
    const game = path.join(s.games, "tycoon");
    fs.mkdirSync(game);
    const vaults = path.join(s.base, "elsewhere");
    write(path.join(vaults, "tycoon", "CLAUDE.md"), "routes\n");
    const env = { ...process.env, HOME: s.home, GREEBLE_VAULTS_DIR: vaults };
    const r = spawnSync(shell, [sessionStart], {
      env,
      input: JSON.stringify({ cwd: game }),
      encoding: "utf8",
    });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^## Vault: .*tycoon\/CLAUDE\.md\n\nroutes\n$/);
  });

  test(`${name}: session-start prints nothing without a vault`, () => {
    const s = scratch();
    const game = path.join(s.games, "novault");
    fakeRepo(game, "main");
    write(path.join(game, "HANDOFF.md"), "Stage: build\n");
    const r = run(shell, sessionStart, s, JSON.stringify({ cwd: game }));
    assert.equal(r.status, 0);
    assert.equal(r.stdout + r.stderr, "");
  });

  test(`${name}: statusline shows game, stage, branch and studio in a repo`, () => {
    const s = scratch();
    const game = path.join(s.games, "racer");
    fakeRepo(game, "feature/laps");
    write(path.join(game, "HANDOFF.md"), "# Handoff\nStage: playtest\nStage: later\n");
    const input = JSON.stringify({ cwd: "/nowhere", workspace: { current_dir: path.join(game) } });
    const start = Date.now();
    const r = run(shell, statusline, s, input);
    assert.ok(Date.now() - start < 1000, "took a second or more");
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
    assert.match(r.stdout, /^racer \| playtest \| feature\/laps \| studio (open|closed)\n$/);
  });

  test(`${name}: statusline outside a repo with no stage`, () => {
    const s = scratch();
    const game = path.join(s.games, "plain");
    write(path.join(game, "HANDOFF.md"), "no stage line here\n");
    const r = run(shell, statusline, s, JSON.stringify({ cwd: game }));
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
    assert.match(r.stdout, /^plain \| - \| - \| studio (open|closed)\n$/);
  });

  test(`${name}: statusline reads the stage from the vault handoff`, () => {
    const s = scratch();
    const game = path.join(s.games, "sim");
    fs.mkdirSync(game);
    write(path.join(s.vaults, "sim", "HANDOFF.md"), "**Stage:** polish\n");
    const r = run(shell, statusline, s, JSON.stringify({ cwd: game }));
    assert.match(r.stdout, /^sim \| polish \| - \| studio (open|closed)\n$/);
  });

  for (const [label, input] of [
    ["empty", ""],
    ["bad", "{not json"],
    ["wrong-shape", '["a", 1]'],
  ]) {
    test(`${name}: ${label} stdin makes neither script fail`, () => {
      const s = scratch();
      const a = run(shell, sessionStart, s, input);
      assert.equal(a.status, 0);
      assert.equal(a.stdout + a.stderr, "");
      const b = run(shell, statusline, s, input);
      assert.equal(b.status, 0);
      assert.equal(b.stderr, "");
      assert.match(b.stdout, /^\S+ \| - \| - \| studio (open|closed)\n$/);
    });
  }
}
