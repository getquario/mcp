#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { configure, createServer } from "./index.js";

let server;
try {
  server = createServer(configure(process.env));
} catch (error) {
  process.stderr.write(`quario-mcp: ${/** @type {Error} */ (error).message}\n`);
  process.exit(1);
}
await server.connect(new StdioServerTransport());
