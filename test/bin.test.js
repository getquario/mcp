// The launcher: a stdio server over the real transport, and the startup
// failure the launch configuration can cause.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { suiteClient, tree } from "./helpers.js";

const BIN = fileURLToPath(new URL("../lib/bin.js", import.meta.url));

// The developer's own QUARIO_* variables must not reach the spawned server.
const ENV = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("QUARIO_")),
);

test("invalid configuration stops the server at startup, with the message on stderr", () => {
  let { status, stdout, stderr } = spawnSync(process.execPath, [BIN], {
    env: { ...ENV, QUARIO_MAX_DEPTH: "lots" },
    encoding: "utf8",
  });
  assert.equal(status, 1);
  assert.equal(stdout, "");
  assert.equal(
    stderr,
    'quario-mcp: QUARIO_MAX_DEPTH: expected a positive integer or Infinity, got "lots"\n',
  );
});

test("the bin serves both tools over stdio", async (t) => {
  let out = tree(t);
  let transport = new StdioClientTransport({
    command: process.execPath,
    args: [BIN],
    env: { ...ENV, QUARIO_OUT_DIR: out },
  });
  let client = suiteClient();
  await client.connect(transport);
  t.after(() => client.close());
  let { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["validate_report", "render_report"],
  );
  let result = await client.callTool({
    name: "render_report",
    arguments: {
      definition: { data: "$.rows[*]", detail: [{ type: "text", value: "{{ @.n }}" }] },
      target: "csv",
      data: { rows: [{ n: 1 }] },
    },
  });
  assert.equal(result.isError, undefined);
  assert.ok(result.structuredContent.path.startsWith(out));
});
