#!/usr/bin/env node
// Copies the package's version into server.json after `changeset version` on
// the Version PR (`npm run release:version`). The MCP Registry refuses a
// server.json whose version is not the npm package it names.

import { readFileSync, writeFileSync } from "node:fs";

let root = new URL("../", import.meta.url);
let manifest = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
let file = new URL("server.json", root);
let server = JSON.parse(readFileSync(file, "utf8"));

server.version = manifest.version;
for (let pkg of server.packages) {
  if (pkg.identifier === manifest.name) pkg.version = manifest.version;
}

writeFileSync(file, `${JSON.stringify(server, null, 2)}\n`);
console.log(`version: server.json is ${manifest.version}`);
