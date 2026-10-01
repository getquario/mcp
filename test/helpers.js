// What the tool suites share: a temp tree per test, and a client wired to a
// server over an in-memory transport under the interpretive validator.
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/client/validators/cf-worker";
import { configure, createServer } from "@quario/mcp";

/** A fresh directory, removed when the test ends. */
export const tree = (t) => {
  // Real path, since the server resolves both roots that way and macOS puts
  // the temp directory behind a symlink.
  let dir = realpathSync(mkdtempSync(join(tmpdir(), "quario-mcp-")));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

/** A client under the interpretive validator, so the suite runs without code generation. */
export const suiteClient = () =>
  new Client(
    { name: "suite", version: "0.0.0" },
    { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() },
  );

/** A connected client over a server configured from `env`, closed with the test. */
export const connect = async (t, env = {}) => {
  let out = tree(t);
  let server = createServer(configure({ QUARIO_OUT_DIR: out, ...env }));
  let client = suiteClient();
  let [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
  await server.connect(serverEnd);
  await client.connect(clientEnd);
  t.after(() => client.close());
  let call = (name, args) => client.callTool({ name, arguments: args });
  return { client, call, out };
};

export const DEFINITION = {
  data: "$.rows[*]",
  detail: { columns: [{ header: "N", value: "{{ @.n }}" }] },
};
export const DATA = { rows: [{ n: 1 }, { n: 2 }] };

export const notOk = (value, message) => assert.ok(!value, message);

// A text item and an image item, as an author writes them.
export const item = (value, extra) => ({ type: "text", value, ...extra });
export const image = (source, extra) => ({ type: "image", source, ...extra });

// A real 1x1 PNG. The engine reads an image's size out of its header, so
// bytes without one render nowhere.
export const PNG = Uint8Array.from(
  (
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de" +
    "0000000c49444154789c63f8cfc0000003010100c9fe92ef0000000049454e44ae426082"
  )
    .match(/../g)
    .map((pair) => parseInt(pair, 16)),
);

// The marking wording, spelled out rather than imported from the engine: a
// golden that reads the constant it pins proves nothing.
export const MARKING = "Unlicensed evaluation — getquario.com";
