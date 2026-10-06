// server.json is what the MCP Registry lists. The registry checks it against
// the npm package it names, so a drift fails the publish, not this suite,
// unless this suite catches it first.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), "utf8"));
const manifest = read("package.json");
const server = read("server.json");

test("server.json carries the package's registry name", () => {
  assert.equal(server.name, manifest.mcpName);
});

test("server.json carries the package's version", () => {
  assert.equal(server.version, manifest.version);
  const pkg = server.packages.find((entry) => entry.identifier === manifest.name);
  assert.ok(pkg, `server.json lists ${manifest.name}`);
  assert.equal(pkg.version, manifest.version);
});
