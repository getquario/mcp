// The file writer's own rules, driven directly: the size label, and the one
// failure that is not a taken name.
import { rmSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { size } from "../lib/output.js";
import { DATA, DEFINITION, connect } from "./helpers.js";

test("a byte count reads in the unit that fits it", () => {
  assert.equal(size(0), "0 B");
  assert.equal(size(1023), "1023 B");
  assert.equal(size(1024), "1.0 kB");
  assert.equal(size(12_600), "12.3 kB");
  assert.equal(size(1024 * 1024), "1.0 MB");
  assert.equal(size(1.85 * 1024 * 1024), "1.9 MB");
});

test("an output directory removed after startup is a render error, not a crash", async (t) => {
  let { call, out } = await connect(t);
  rmSync(out, { recursive: true });
  let result = await call("render_report", { definition: DEFINITION, target: "csv", data: DATA });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /ENOENT/);
});
