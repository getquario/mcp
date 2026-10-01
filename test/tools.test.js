// The two tools over the wire: the in-memory transport carries exactly what a
// stdio client would get, so a result's shape is pinned where a client reads it.
import { mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { MARKING, PNG, image, item } from "./helpers.js";
import { DATA, DEFINITION, connect, tree } from "./helpers.js";

const SCHEMA = JSON.parse(readFileSync(new URL(import.meta.resolve("quario/schema.json")), "utf8"));

// Every option the launch configuration owns, spelled as a tool argument
// would spell it. None may appear as a property anywhere in an input schema.
const TRUST = [
  "license",
  "schemes",
  "query",
  "maxDepth",
  "maxNodes",
  "maxResults",
  "functions",
  "fonts",
  "paths",
  "dataRoot",
  "outDir",
];

const keys = (schema, found = new Set()) => {
  if (typeof schema !== "object" || schema === null) return found;
  if (Array.isArray(schema)) {
    for (let entry of schema) keys(entry, found);
    return found;
  }
  for (let name of Object.keys(schema.properties ?? {})) found.add(name);
  for (let value of Object.values(schema)) keys(value, found);
  return found;
};

test("the trust line: no trust-bearing option is reachable from a tool argument", async (t) => {
  let { client } = await connect(t);
  let { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["validate_report", "render_report"],
  );
  for (let tool of tools) {
    let reachable = keys(tool.inputSchema);
    for (let option of TRUST)
      assert.ok(!reachable.has(option), `${tool.name} exposes no "${option}"`);
  }
});

test("the definition's input schema is the published schema, descriptions included", async (t) => {
  let { client } = await connect(t);
  let { tools } = await client.listTools();
  let { $schema, $defs, ...document } = SCHEMA;
  void $schema;
  for (let tool of tools) {
    let { description, ...definition } = tool.inputSchema.properties.definition;
    assert.equal(typeof description, "string");
    assert.deepEqual(definition, document);
    assert.deepEqual(tool.inputSchema.$defs, $defs, "the definitions resolve from the tool's root");
  }
  assert.deepEqual(tools[0].inputSchema.required, ["definition"]);
  assert.deepEqual(tools[1].inputSchema.required, ["definition", "target"]);
  assert.deepEqual(tools[1].inputSchema.properties.target.enum, [
    "html",
    "pdf",
    "xlsx",
    "docx",
    "csv",
  ]);
});

test("validate_report: a clean definition is empty lists, in both copies", async (t) => {
  let { call } = await connect(t);
  let result = await call("validate_report", { definition: DEFINITION });
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent, { problems: [], warnings: [] });
  assert.deepEqual(result.content, [{ type: "text", text: '{"problems":[],"warnings":[]}' }]);
});

test("validate_report: problems are a successful result carrying the located fields", async (t) => {
  let { call } = await connect(t);
  let result = await call("validate_report", {
    definition: {
      data: "$.rows[*]",
      detail: [item("{{ @.n + }}"), item("{{ @.n }}", { style: { currency: "EUR" } })],
    },
  });
  assert.equal(result.isError, undefined);
  let { problems, warnings } = result.structuredContent;
  assert.equal(problems.length, 1);
  let [problem] = problems;
  assert.equal(problem.path, "detail[0].value");
  assert.equal(problem.source, "{{ @.n + }}");
  assert.match(problem.message, /^detail\[0\]\.value/);
  assert.equal(typeof problem.code, "string");
  assert.equal(typeof problem.start, "number");
  assert.equal(typeof problem.end, "number");
  assert.ok(!("diagnostic" in problem), "the diagnostic object does not cross");
  assert.deepEqual(Object.keys(warnings[0]), ["path", "message"]);
  assert.equal(warnings[0].path, "detail[1].style.currency");
  assert.equal(result.content[0].text, JSON.stringify(result.structuredContent));
});

test("validate_report: a definition of the wrong shape is the engine's problem, not the SDK's", async (t) => {
  let { call } = await connect(t);
  let result = await call("validate_report", { definition: { data: 5 } });
  assert.equal(result.isError, undefined);
  assert.deepEqual(
    result.structuredContent.problems.map((p) => p.path),
    ["data"],
  );
  // The envelope is still the SDK's: a target outside the five is refused there.
  let refused = await call("render_report", { definition: DEFINITION, target: "rtf", data: {} });
  assert.equal(refused.isError, true);
  assert.match(refused.content[0].text, /Input validation error/);
});

test("validate_report: targets check the required declarations", async (t) => {
  let { call } = await connect(t);
  let definition = { ...DEFINITION, required: { valign: true } };
  assert.deepEqual((await call("validate_report", { definition })).structuredContent.problems, []);
  let { problems } = (await call("validate_report", { definition, targets: ["csv", "html"] }))
    .structuredContent;
  assert.deepEqual(problems, [
    { path: "required.valign", message: 'required.valign: the csv target withdraws "valign"' },
  ]);
});

test("render_report: every target writes a file and returns its location", async (t) => {
  let { call, out } = await connect(t);
  for (let target of ["html", "pdf", "xlsx", "docx", "csv"]) {
    let result = await call("render_report", {
      definition: DEFINITION,
      target,
      data: DATA,
      filename: "q1",
    });
    assert.equal(result.isError, undefined, `${target}: ${result.content[0].text}`);
    let { path, bytes } = result.structuredContent;
    assert.equal(result.structuredContent.target, target);
    assert.equal(path, join(out, `q1.${target}`));
    assert.equal(statSync(path).size, bytes);
    assert.match(
      result.content[0].text,
      new RegExp(`^Wrote q1\\.${target} \\(\\d+(\\.\\d)? k?B\\): ${path}$`),
    );
  }
  assert.ok(
    readFileSync(join(out, "q1.html"), "utf8").includes(MARKING),
    "unlicensed output is marked",
  );
  assert.ok(readFileSync(join(out, "q1.csv"), "utf8").includes("1\n2"), "the data rendered");
});

test("render_report: never overwrites", async (t) => {
  let { call, out } = await connect(t);
  let names = [];
  for (let i = 0; i < 3; i++) {
    let result = await call("render_report", {
      definition: DEFINITION,
      target: "csv",
      data: DATA,
      filename: "same",
    });
    names.push(basename(result.structuredContent.path));
    assert.match(
      result.content[0].text,
      new RegExp(`^Wrote ${names[i]} `),
      "the text names the file written",
    );
  }
  assert.deepEqual(names, ["same.csv", "same-1.csv", "same-2.csv"]);
  writeFileSync(join(out, "same-3.csv"), "taken");
  let result = await call("render_report", {
    definition: DEFINITION,
    target: "csv",
    data: DATA,
    filename: "same",
  });
  assert.equal(basename(result.structuredContent.path), "same-4.csv");
  assert.equal(readFileSync(join(out, "same-3.csv"), "utf8"), "taken");
});

test("render_report: the filename is a basename with the target's extension forced", async (t) => {
  let { call } = await connect(t);
  let render = (filename) =>
    call("render_report", {
      definition: DEFINITION,
      target: "csv",
      data: DATA,
      ...(filename === undefined ? {} : { filename }),
    });
  let written = async (filename) => {
    let result = await render(filename);
    assert.equal(result.isError, undefined, result.content[0].text);
    return basename(result.structuredContent.path);
  };
  assert.equal(await written("Report.CSV"), "Report.csv");
  assert.equal(await written("q1.pdf"), "q1.pdf.csv");
  assert.match(await written(undefined), /^report-\d{4}-\d\d-\d\dT[\d-]+Z\.csv$/);
  for (let bad of ["", ".", "..", "a/b", "../b", "a\\b"]) {
    let result = await render(bad);
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /^filename: expected a basename/);
  }
});

test("render_report: exactly one of data and dataPath", async (t) => {
  let { call } = await connect(t);
  for (let args of [{}, { data: {}, dataPath: "x.json" }]) {
    let result = await call("render_report", { definition: DEFINITION, target: "csv", ...args });
    assert.equal(result.isError, true);
    assert.equal(result.content[0].text, "give exactly one of data and dataPath");
  }
});

test("render_report: dataPath resolves inside the data root, after realpath", async (t) => {
  let root = tree(t);
  let outside = tree(t);
  mkdirSync(join(root, "in"));
  writeFileSync(join(root, "in", "rows.json"), JSON.stringify(DATA));
  writeFileSync(join(root, "bad.json"), "{ not json");
  writeFileSync(join(outside, "rows.json"), JSON.stringify(DATA));
  symlinkSync(join(outside, "rows.json"), join(root, "escape.json"));
  let { call } = await connect(t, { QUARIO_DATA_ROOT: root });
  let render = (dataPath) =>
    call("render_report", { definition: DEFINITION, target: "csv", dataPath });
  assert.equal((await render("in/rows.json")).isError, undefined);
  assert.equal(
    (await render(join(root, "in", "rows.json"))).isError,
    undefined,
    "an absolute path inside",
  );
  for (let [dataPath, message] of [
    ["in/../../" + basename(outside) + "/rows.json", /is outside the data root$/],
    [join(outside, "rows.json"), /is outside the data root$/],
    ["escape.json", /^dataPath: escape\.json is outside the data root$/],
    ["in/missing.json", /^dataPath: in\/missing\.json does not exist$/],
    ["bad.json", /^dataPath: bad\.json is not JSON$/],
  ]) {
    let result = await render(dataPath);
    assert.equal(result.isError, true, dataPath);
    assert.match(result.content[0].text, message);
    assert.ok(!result.content[0].text.includes("not json"), "the file's text is never quoted");
  }
});

test("render_report: without a data root, dataPath is refused", async (t) => {
  let { call } = await connect(t);
  let result = await call("render_report", {
    definition: DEFINITION,
    target: "csv",
    dataPath: "rows.json",
  });
  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, "dataPath: no data root is configured");
});

test("render_report: a $base64 object decodes to bytes anywhere in the data", async (t) => {
  let root = tree(t);
  let { call } = await connect(t, { QUARIO_DATA_ROOT: root });
  let definition = {
    data: "$.rows[*]",
    header: [image("=$.input.logo")],
    detail: [image("=@.pic")],
  };
  let png = Buffer.from(PNG).toString("base64");
  let data = { logo: { $base64: png }, rows: [{ pic: { $base64: png } }] };
  let result = await call("render_report", {
    definition,
    target: "html",
    data: structuredClone(data),
  });
  assert.equal(result.isError, undefined, result.content[0].text);
  let markup = readFileSync(result.structuredContent.path, "utf8");
  assert.equal(markup.split("data:image/png;base64,").length, 3, "both images embedded");
  writeFileSync(join(root, "data.json"), JSON.stringify(data));
  let fromFile = await call("render_report", { definition, target: "html", dataPath: "data.json" });
  assert.equal(fromFile.isError, undefined, "files decode too");
  for (let { bad, at } of [
    { bad: { logo: { $base64: "not base64!" }, rows: [] }, at: "$.input.logo" },
    { bad: { logo: { $base64: png }, rows: [{ pic: { $base64: 5 } }] }, at: "$.input.rows[0].pic" },
  ]) {
    let refused = await call("render_report", { definition, target: "html", data: bad });
    assert.equal(refused.isError, true);
    assert.equal(refused.content[0].text, `${at}: $base64 is not a base64 string`);
  }
  // An object with more keys than `$base64` is data, not bytes.
  let plain = await call("render_report", {
    definition: { data: "$.rows[*]", detail: [item("{{ @.extra.other }}")] },
    target: "csv",
    data: { rows: [{ extra: { $base64: "AA==", other: 1 } }] },
  });
  assert.equal(plain.isError, undefined, plain.content[0].text);
  assert.ok(readFileSync(plain.structuredContent.path, "utf8").includes("1"));
});

test("render_report: options pass to the target, and the host's stay the host's", async (t) => {
  let { call } = await connect(t);
  let render = (target, options) =>
    call("render_report", { definition: DEFINITION, target, data: DATA, options });
  let pdf = await render("pdf", { page: { size: "letter" }, meta: { title: "Q1" } });
  assert.equal(pdf.isError, undefined, pdf.content[0].text);
  let xlsx = await render("xlsx", { filter: true });
  assert.equal(xlsx.isError, undefined, xlsx.content[0].text);
  for (let options of [{ fonts: {} }, { paths: true }]) {
    let refused = await render("pdf", options);
    assert.equal(refused.isError, true);
    assert.match(refused.content[0].text, /^options: unknown option "(fonts|paths)"/);
  }
  let meta = await render("pdf", { meta: { keywords: "x" } });
  assert.equal(meta.isError, true);
  assert.match(meta.content[0].text, /^options\.meta: /, "the engine's own meta rule speaks");
  let unknown = await render("pdf", { nope: 1 });
  assert.equal(unknown.isError, true);
  assert.match(unknown.content[0].text, /^options: /, "the factory's own message");
  let csv = await render("csv", { page: {} });
  assert.equal(csv.isError, true);
  assert.equal(csv.content[0].text, "options: this target takes no options");
});

test("render_report: a definition with problems is the validate result, as an error", async (t) => {
  let { call } = await connect(t);
  let definition = { ...DEFINITION, required: { valign: true } };
  let result = await call("render_report", { definition, target: "csv", data: DATA });
  assert.equal(result.isError, true);
  assert.deepEqual(result.structuredContent, {
    problems: [
      { path: "required.valign", message: 'required.valign: the csv target withdraws "valign"' },
    ],
    warnings: [],
  });
  assert.equal(result.content[0].text, JSON.stringify(result.structuredContent));
});

test("render_report: a render that throws is an error result in the engine's words", async (t) => {
  let { call } = await connect(t);
  let definition = { data: "$.rows[*]", detail: [image("=@.pic")] };
  let result = await call("render_report", {
    definition,
    target: "html",
    data: { rows: [{ pic: { $base64: "AAAA" } }] },
  });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /detail\[0\]/);
});

test("render_report: a presentation triple reuses its engine, and the memo stays bounded", async (t) => {
  let { call } = await connect(t);
  t.mock.method(console, "warn", () => {});
  // A rejected key warns once per engine built; a repeated triple builds none.
  let render = (locale) =>
    call("render_report", { definition: DEFINITION, target: "csv", data: DATA, locale });
  for (let i = 0; i < 40; i++) {
    let result = await render(`en-${String(i).padStart(3, "0")}`);
    assert.equal(result.isError, undefined, result.content[0].text);
  }
  assert.equal(
    (await render("en-000")).isError,
    undefined,
    "past the bound, a triple still renders",
  );
});

test("render_report: params, and the presentation defaults a call may set", async (t) => {
  let { call } = await connect(t, { QUARIO_CURRENCY: "USD" });
  let definition = {
    data: "$.rows[*]",
    params: { title: "none" },
    header: [item("{{ $.params.title }}")],
    detail: [item("{{ @.n }}", { style: { format: "currency" } })],
  };
  let render = (args) => call("render_report", { definition, target: "html", data: DATA, ...args });
  let text = async (args) => {
    let result = await render(args);
    assert.equal(result.isError, undefined, result.content[0].text);
    return readFileSync(result.structuredContent.path, "utf8");
  };
  assert.ok((await text({})).includes("none"), "the declared default");
  assert.ok((await text({ params: { title: "Given" } })).includes("Given"));
  assert.ok((await text({})).includes("$1.00"), "the host's currency, the engine's locale");
  assert.match(
    await text({ currency: "EUR", locale: "nl-NL" }),
    /€\s1,00/,
    "a call's presentation overrides",
  );
});
