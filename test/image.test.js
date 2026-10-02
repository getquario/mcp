// `$image`: a picture by path inside the data root, read as bytes before the
// render. Images only, so the server never reads an arbitrary file into a
// document.
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { decode } from "../lib/data.js";
import { PNG, image } from "./helpers.js";
import { connect, tree } from "./helpers.js";

const JPEG = Uint8Array.from(
  "ffd8ffe000104a46494600010100000100010000ffc00011080001000103011100021101031101ffd9"
    .match(/../g)
    .map((pair) => parseInt(pair, 16)),
);

const DEFINITION = {
  data: "$.rows[*]",
  header: [image("=$.input.logo")],
  detail: [image("=@.pic")],
};

test("render_report: an $image path decodes to the file's bytes anywhere in the data", async (t) => {
  let root = tree(t);
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "assets", "logo.png"), PNG);
  writeFileSync(join(root, "assets", "photo.jpg"), JPEG);
  let { call } = await connect(t, { QUARIO_DATA_ROOT: root });
  let data = {
    logo: { $image: "assets/logo.png" },
    rows: [{ pic: { $image: "assets/photo.jpg" } }],
  };
  let result = await call("render_report", {
    definition: DEFINITION,
    target: "html",
    data: structuredClone(data),
  });
  assert.equal(result.isError, undefined, result.content[0].text);
  let markup = readFileSync(result.structuredContent.path, "utf8");
  assert.ok(markup.includes(`data:image/png;base64,${Buffer.from(PNG).toString("base64")}`));
  assert.ok(markup.includes(`data:image/jpeg;base64,${Buffer.from(JPEG).toString("base64")}`));
  writeFileSync(join(root, "data.json"), JSON.stringify(data));
  let fromFile = await call("render_report", {
    definition: DEFINITION,
    target: "html",
    dataPath: "data.json",
  });
  assert.equal(fromFile.isError, undefined, fromFile.content[0].text);
});

test("render_report: an $image is refused where it sits, and only images are read", async (t) => {
  let root = tree(t);
  let outside = tree(t);
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "assets", "logo.png"), PNG);
  writeFileSync(join(root, ".env"), "SECRET=1");
  writeFileSync(join(outside, "logo.png"), PNG);
  symlinkSync(join(outside, "logo.png"), join(root, "escape.png"));
  let { call } = await connect(t, { QUARIO_DATA_ROOT: root });
  for (let [path, message] of [
    ["assets/missing.png", "$image assets/missing.png does not exist"],
    ["escape.png", "$image escape.png is outside the data root"],
    [
      `../${basename(outside)}/logo.png`,
      `$image ../${basename(outside)}/logo.png is outside the data root`,
    ],
    [".env", "$image .env is not a PNG or JPEG"],
    ["assets", "$image assets is not a PNG or JPEG"],
    ["", "$image is not a path"],
    [5, "$image is not a path"],
  ]) {
    let result = await call("render_report", {
      definition: DEFINITION,
      target: "html",
      data: { logo: null, rows: [{ pic: { $image: path } }] },
    });
    assert.equal(result.isError, true, String(path));
    assert.equal(result.content[0].text, `$.input.rows[0].pic: ${message}`);
  }
});

test("render_report: without a data root, an $image is refused", async (t) => {
  let { call } = await connect(t);
  let result = await call("render_report", {
    definition: DEFINITION,
    target: "html",
    data: { logo: { $image: "logo.png" }, rows: [] },
  });
  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, "$.input.logo: $image needs a data root");
});

test("decode: one picture referenced many times is read once per call", async (t) => {
  let root = tree(t);
  writeFileSync(join(root, "logo.png"), PNG);
  let rows = await decode({ a: { $image: "logo.png" }, b: [{ $image: "./logo.png" }] }, root);
  assert.equal(rows.a, rows.b[0], "the same bytes, shared");
  assert.deepEqual(rows.a, PNG);
  let again = await decode({ a: { $image: "logo.png" } }, root);
  assert.notEqual(again.a, rows.a, "nothing carries over between calls");
});
