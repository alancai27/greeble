const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const hooks = path.join(__dirname, "..", "claude", "hooks", "greeble");
const script = path.join(hooks, "luau-check.sh");
const samples = path.join(__dirname, "samples");

// A PATH with neither selene nor stylua on it, so only the rule list runs.
const env = { ...process.env, PATH: "/usr/bin:/bin" };

const rules = fs
  .readFileSync(path.join(hooks, "luau-rules.tsv"), "utf8")
  .split("\n")
  .slice(1)
  .filter(Boolean)
  .map((row) => {
    const [id, , message] = row.split("\t");
    return { id, message };
  });

const shells = ["/bin/bash", "/bin/zsh"].filter((s) => fs.existsSync(s));

function run(shell, args, input) {
  return spawnSync(shell, [script, ...args], { env, input, encoding: "utf8" });
}

test("there is one rule per flag in the brief", () => {
  assert.equal(rules.length, 6);
});

for (const shell of shells) {
  const name = path.basename(shell);

  for (const { id, message } of rules) {
    test(`${name}: ${id} flags the bad sample`, () => {
      const file = path.join(samples, `${id}.bad.luau`);
      const r = run(shell, [file]);
      assert.equal(r.status, 2, r.stderr);
      assert.match(r.stderr, new RegExp(`^${escape(file)}:\\d+: `, "m"));
      assert.ok(r.stderr.includes(`${message} [${id}]`), r.stderr);
    });

    test(`${name}: ${id} passes the clean sample`, () => {
      const file = path.join(samples, `${id}.clean.luau`);
      const r = run(shell, [file]);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stderr, "");
    });
  }

  test(`${name}: non-Luau files exit 0 untouched`, () => {
    const r = run(shell, [path.join(__dirname, "luau-check.test.js")]);
    assert.equal(r.status, 0);
    assert.equal(r.stderr + r.stdout, "");
  });

  test(`${name}: reads the file from a hook payload on stdin`, () => {
    const file = path.join(samples, "setasync.bad.luau");
    const payload = JSON.stringify({ tool_input: { file_path: file } });
    const r = run(shell, [], payload);
    assert.equal(r.status, 2, r.stderr);
    assert.ok(r.stderr.includes(`${file}:7: `), r.stderr);
  });
}

test("every rule has both samples", () => {
  for (const { id } of rules) {
    for (const kind of ["bad", "clean"]) {
      assert.ok(fs.existsSync(path.join(samples, `${id}.${kind}.luau`)), `${id}.${kind}`);
    }
  }
});

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
