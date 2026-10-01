import { readFileSync } from "node:fs";
import { McpServer, fromJsonSchema } from "@modelcontextprotocol/server";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";
import { basename } from "node:path";
import { capabilities as csvCapabilities, csv } from "@quario/csv";
import { capabilities as docxCapabilities, docx } from "@quario/docx";
import { capabilities as htmlCapabilities, html } from "@quario/html";
import { capabilities as pdfCapabilities, pdf } from "@quario/pdf";
import { capabilities as xlsxCapabilities, xlsx } from "@quario/xlsx";
import { hostOptions, quario } from "quario";
import { defined } from "./config.js";
import { decode, readData } from "./data.js";
import { size, stemFor, write } from "./output.js";

export { configure } from "./config.js";

/**
 * The five targets, in the order the tools list them: each one's factory and
 * its `capabilities` descriptor.
 * @type {Record<string, { factory: (options?: any) => import("quario").Target<string, Promise<string | Uint8Array>>, capabilities: import("quario").TargetCapabilities }>}
 */
const TARGETS = {
  html: { factory: html, capabilities: htmlCapabilities },
  pdf: { factory: pdf, capabilities: pdfCapabilities },
  xlsx: { factory: xlsx, capabilities: xlsxCapabilities },
  docx: { factory: docx, capabilities: docxCapabilities },
  csv: { factory: csv, capabilities: csvCapabilities },
};
/** @param {string[]} targets */
const capabilities = (targets) => targets.map((target) => TARGETS[target].capabilities);

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

// The report document's own schema, hoisted so its `$defs` resolve from the
// tool's root. The descriptions stay: they are the semantics an agent gets
// in-band.
const { $defs, ...definition } = JSON.parse(
  readFileSync(new URL(import.meta.resolve("quario/schema.json")), "utf8"),
);
delete definition.$schema;

// Interprets the schema rather than compiling it: the SDK's default on Node
// builds each validator from a string, which the suites disallow.
const validator = new CfWorkerJsonSchemaValidator();

// A tool's input is checked as its envelope only. The definition inside goes
// to `plan` unchecked, because the engine's problem is one located line
// where the schema's is every subschema it failed.
/** @type {import("@modelcontextprotocol/server").jsonSchemaValidator} */
const envelope = {
  /** @param {any} schema */
  getValidator: (schema) =>
    validator.getValidator({
      ...schema,
      properties: { ...schema.properties, definition: { type: "object" } },
    }),
};
/**
 * @template T the arguments the schema admits, named at each call site
 * @param {Record<string, any>} properties
 * @param {string[]} required
 * @returns {ReturnType<typeof fromJsonSchema<T>>}
 */
const schema = (properties, required) =>
  fromJsonSchema(
    { type: "object", properties, required, additionalProperties: false, $defs },
    envelope,
  );

const DEFINITION = { ...definition, description: "The report definition to check or render." };
const TARGET = { type: "string", enum: Object.keys(TARGETS) };

/**
 * @typedef {object} ValidateArgs
 * @property {unknown} definition
 * @property {string[]} [targets]
 */
/**
 * @typedef {object} RenderArgs
 * @property {unknown} definition
 * @property {string} target
 * @property {unknown} [data]
 * @property {string} [dataPath]
 * @property {Record<string, import("quario").JsonValue>} [params]
 * @property {string} [locale]
 * @property {string} [currency]
 * @property {string} [timeZone]
 * @property {string} [filename]
 * @property {Record<string, unknown>} [options]
 */

/** @type {ReturnType<typeof fromJsonSchema<ValidateArgs>>} */
const VALIDATE_INPUT = schema(
  {
    definition: DEFINITION,
    targets: {
      type: "array",
      items: TARGET,
      description:
        "Targets to check the definition's `required` declarations against. Omit it to check the document alone.",
    },
  },
  ["definition"],
);

/** @type {ReturnType<typeof fromJsonSchema<RenderArgs>>} */
const RENDER_INPUT = schema(
  {
    definition: DEFINITION,
    target: { ...TARGET, description: "The target to render with." },
    data: {
      description:
        "The render data, any JSON value. Give exactly one of `data` and `dataPath`. An object whose only key is `$base64` decodes to bytes, which is how an image's `source` expression reads a picture.",
    },
    dataPath: {
      type: "string",
      description:
        "A JSON file holding the render data, as a path inside the server's data root. `$base64` objects decode there too.",
    },
    params: {
      type: "object",
      description: "Values for the definition's declared `params`.",
    },
    locale: { type: "string", description: "The locale `format` presents in, for this render." },
    currency: {
      type: "string",
      description: 'The default currency code for `format: "currency"`, for this render.',
    },
    timeZone: { type: "string", description: "The time zone dates present in, for this render." },
    filename: {
      type: "string",
      description:
        "The basename to write under, without a directory. The target's extension is forced, and a name that exists is never overwritten. Omit it for `report-<timestamp>`.",
    },
    options: {
      type: "object",
      description:
        "Options for the target: `page` and `meta` for pdf, xlsx and docx, and `filter` for xlsx. The csv target takes none.",
      properties: {
        page: {
          type: "object",
          description: "Page geometry: `size`, `margin`, and for xlsx `orientation` and `fit`.",
        },
        meta: {
          type: "object",
          description: "Document properties: `title`, `author` and `subject`, each a string.",
        },
        filter: {
          type: "boolean",
          description: "xlsx: an autofilter over each worksheet's one table.",
        },
      },
    },
  },
  ["definition", "target"],
);

const PROBLEM = {
  type: "object",
  properties: {
    path: { type: "string" },
    source: { type: "string" },
    message: { type: "string" },
    code: { type: "string" },
    start: { type: "integer" },
    end: { type: "integer" },
  },
  required: ["path", "message"],
};
const WARNING = {
  type: "object",
  properties: { path: { type: "string" }, message: { type: "string" } },
  required: ["path", "message"],
};
const VALIDATE_OUTPUT = fromJsonSchema(
  {
    type: "object",
    properties: {
      problems: { type: "array", items: PROBLEM },
      warnings: { type: "array", items: WARNING },
    },
    required: ["problems", "warnings"],
  },
  validator,
);
const RENDER_OUTPUT = fromJsonSchema(
  {
    type: "object",
    properties: {
      path: { type: "string" },
      target: TARGET,
      bytes: { type: "integer" },
    },
    required: ["path", "target", "bytes"],
  },
  validator,
);

/**
 * One problem with the located diagnostic's fields lifted off it; the
 * diagnostic object itself does not cross.
 * @param {import("quario").Problem} problem
 */
const lift = ({ path, source, message, diagnostic }) =>
  defined({
    path,
    source,
    message,
    code: diagnostic?.code,
    start: diagnostic?.start,
    end: diagnostic?.end,
  });

/**
 * The plan's two lists.
 * @param {Pick<import("quario").Plan, "problems" | "warnings">} plan
 */
const report = ({ problems, warnings }) => ({
  problems: problems.map(lift),
  warnings: warnings.map(({ path, message }) => ({ path, message })),
});

/**
 * A tool result carrying one object both as structured content and as text.
 * @param {Record<string, unknown>} structuredContent
 * @param {string} [text]
 * @returns {import("@modelcontextprotocol/server").CallToolResult}
 */
const result = (structuredContent, text = JSON.stringify(structuredContent)) => ({
  content: [{ type: "text", text }],
  structuredContent,
});

/**
 * The server: `validate_report` and `render_report` over one configuration.
 * The configuration is the host; a tool call is an author and can reach none
 * of it.
 * @param {ReturnType<typeof import("./config.js").configure>} config
 */
export function createServer({ instance, dataRoot, outDir }) {
  let server = new McpServer({ name: "quario", version }, { jsonSchemaValidator: validator });
  // Built now rather than at the first call, so a configuration the engine
  // refuses stops the server at startup. One instance per presentation
  // triple: each construction verifies the key again, and a rejected key
  // warns on stderr every time.
  let base = quario(instance);
  /** @type {Map<string, import("quario").Quario>} */
  let engines = new Map();
  /** @param {Pick<RenderArgs, "locale" | "currency" | "timeZone">} overrides */
  let engine = (overrides) => {
    if (Object.keys(overrides).length === 0) return base;
    let key = JSON.stringify(overrides);
    let cached = engines.get(key);
    if (cached === undefined) {
      // The triple is the author's to vary, so the memo is bounded.
      if (engines.size >= 32) engines.clear();
      engines.set(key, (cached = quario({ ...instance, ...overrides })));
    }
    return cached;
  };

  server.registerTool(
    "validate_report",
    {
      description:
        "Check a quario report definition without rendering it. Returns its problems, each at the schema path it sits at, and its warnings. Name targets to also check the definition's `required` declarations against what each target makes of them.",
      inputSchema: VALIDATE_INPUT,
      outputSchema: VALIDATE_OUTPUT,
    },
    async ({ definition, targets = [] }) =>
      result(report(base.plan(definition, undefined, { targets: capabilities(targets) }))),
  );

  /** @param {RenderArgs} args */
  async function render({
    definition,
    target,
    data,
    dataPath,
    params,
    locale,
    currency,
    timeZone,
    filename,
    options,
  }) {
    if ((data === undefined) === (dataPath === undefined))
      throw Error("give exactly one of data and dataPath");
    // The keys a call may set; the host's own (`fonts`, `paths`) are not
    // among them.
    hostOptions(options, ["page", "meta", "filter"], "options");
    let plan = engine(defined({ locale, currency, timeZone })).plan(definition, undefined, {
      targets: capabilities([target]),
    });
    if (plan.report === null) return { ...result(report(plan)), isError: true };
    let stem = stemFor(filename, target);
    let input = decode(dataPath === undefined ? data : await readData(dataPath, dataRoot));
    let output = await plan.report.render(TARGETS[target].factory(options), input, params);
    let { path, bytes } = await write(outDir, stem, target, output);
    return result({ path, target, bytes }, `Wrote ${basename(path)} (${size(bytes)}): ${path}`);
  }

  server.registerTool(
    "render_report",
    {
      description:
        "Render a quario report definition to one target and write the output to a file. Returns the file's absolute path, never its content. A definition with problems returns them instead, as validate_report does.",
      inputSchema: RENDER_INPUT,
      outputSchema: RENDER_OUTPUT,
    },
    render,
  );

  return server;
}
