// The per-package CSP guard: this package's source must stay free of
// string-to-code constructs. That the SDK's validator is the interpretive one
// is pinned by the tool suites running under the flag.
import { readdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { notOk } from "./helpers.js";

test("source contains no string-to-code constructs", () => {
  const dir = new URL("../lib/", import.meta.url);
  const files = readdirSync(dir, { recursive: true })
    .map(String)
    .filter((name) => name.endsWith(".js"));
  assert.ok(files.length >= 1, "the scan covers every source module");
  for (const name of files) {
    const src = readFileSync(new URL(name, dir), "utf8");
    notOk(
      /\beval\b|\bFunction\s*\(|new\s+Function/.test(src),
      `${name} is free of string-to-code constructs`,
    );
  }
});
