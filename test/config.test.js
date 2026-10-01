// The configuration surface: every variable, its default, and what stops the
// server at startup.
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { configure, createServer } from "@quario/mcp";
import { tree } from "./helpers.js";

test("unset, the configuration is the engine's defaults and a temp output directory", (t) => {
  let config = configure({});
  assert.deepEqual(config.instance, { query: {} }, "an unset option is absent");
  assert.equal(config.dataRoot, undefined);
  assert.ok(config.outDir.endsWith("quario-mcp"), "the default output directory");
  assert.ok(existsSync(config.outDir), "created at startup");
  // A bad key never stops the server: output is marked instead.
  t.mock.method(console, "warn", () => {});
  assert.doesNotThrow(() => createServer(configure({ QUARIO_LICENSE: "garbage" })));
});

test("an empty variable is an unset one", () => {
  let config = configure({ QUARIO_LICENSE: "", QUARIO_MAX_DEPTH: "", QUARIO_DATA_ROOT: "" });
  assert.deepEqual(config.instance, { query: {} });
  assert.equal(config.dataRoot, undefined);
});

test("each variable sets the option it names", (t) => {
  let dir = tree(t);
  let config = configure({
    QUARIO_LICENSE: "quario_x.y",
    QUARIO_LOCALE: "nl-NL",
    QUARIO_CURRENCY: "EUR",
    QUARIO_TIME_ZONE: "Europe/Amsterdam",
    QUARIO_SCHEMES: "https:, http: ,mailto:",
    QUARIO_MAX_DEPTH: "10",
    QUARIO_MAX_NODES: "Infinity",
    QUARIO_MAX_RESULTS: "5000",
    QUARIO_DATA_ROOT: dir,
    QUARIO_OUT_DIR: join(dir, "out", "nested"),
  });
  assert.deepEqual(config.instance, {
    license: "quario_x.y",
    locale: "nl-NL",
    currency: "EUR",
    timeZone: "Europe/Amsterdam",
    schemes: ["https:", "http:", "mailto:"],
    query: { maxDepth: 10, maxNodes: Infinity, maxResults: 5000 },
  });
  assert.equal(config.dataRoot, dir);
  assert.ok(existsSync(config.outDir), "the output directory is created, parents included");
});

test("the data root falls back to CLAUDE_PROJECT_DIR, resolved to its real path", (t) => {
  let dir = tree(t);
  let real = join(dir, "real");
  mkdirSync(real);
  symlinkSync(real, join(dir, "link"));
  assert.equal(configure({ CLAUDE_PROJECT_DIR: join(dir, "link") }).dataRoot, real);
  assert.equal(
    configure({ CLAUDE_PROJECT_DIR: join(dir, "link"), QUARIO_DATA_ROOT: dir }).dataRoot,
    dir,
    "the quario variable wins",
  );
});

test("invalid configuration throws with the variable named", (t) => {
  let dir = tree(t);
  let file = join(dir, "file");
  writeFileSync(file, "");
  for (let [env, message] of [
    [{ QUARIO_MAX_DEPTH: "x" }, /^QUARIO_MAX_DEPTH: expected a positive integer or Infinity/],
    [{ QUARIO_MAX_NODES: "0" }, /^QUARIO_MAX_NODES: expected/],
    [{ QUARIO_MAX_RESULTS: "1.5" }, /^QUARIO_MAX_RESULTS: expected/],
    [{ QUARIO_MAX_RESULTS: "-1" }, /^QUARIO_MAX_RESULTS: expected/],
    [{ QUARIO_DATA_ROOT: join(dir, "missing") }, /^QUARIO_DATA_ROOT: .* does not exist$/],
    [{ QUARIO_DATA_ROOT: file }, /^QUARIO_DATA_ROOT: .* is not a directory$/],
    [{ QUARIO_OUT_DIR: join(file, "under-a-file") }, /^QUARIO_OUT_DIR: cannot write to /],
  ]) {
    assert.throws(() => configure(env), { message });
  }
  // A scheme the engine refuses stops the server too, in the engine's words.
  assert.throws(() => createServer(configure({ QUARIO_SCHEMES: "HTTP", QUARIO_OUT_DIR: dir })), {
    message: /^schemes: expected an array of lower-case URL schemes/,
  });
});
