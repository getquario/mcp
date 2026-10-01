import { accessSync, constants, mkdirSync, realpathSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * An object without its undefined entries, so an unset option is absent
 * rather than present as `undefined`.
 * @template {Record<string, unknown>} T
 * @param {T} object
 * @returns {T}
 */
export const defined = (object) =>
  /** @type {T} */ (Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined)));

/**
 * An existing directory's real path.
 * @param {string} name
 * @param {string} value
 */
const directory = (name, value) => {
  let path = resolve(value);
  let real;
  try {
    real = realpathSync(path);
  } catch (cause) {
    throw Error(`${name}: ${path} does not exist`, { cause });
  }
  if (!statSync(real).isDirectory()) throw Error(`${name}: ${path} is not a directory`);
  return real;
};

/**
 * Read the server's configuration from its environment. An empty variable is
 * an unset one. Throws on a value the server cannot run with; the launcher
 * prints that message and exits.
 * @param {Record<string, string | undefined>} env
 */
export function configure(env) {
  /** @param {string} name */
  let read = (name) => env[name] || undefined;
  /** A budget variable: a positive integer, or `Infinity` to opt out. */
  let budget = (/** @type {string} */ name) => {
    let value = read(name);
    if (value === undefined) return undefined;
    let n = Number(value);
    if (n === Infinity || (Number.isInteger(n) && n > 0)) return n;
    throw Error(`${name}: expected a positive integer or Infinity, got ${JSON.stringify(value)}`);
  };
  let schemes = read("QUARIO_SCHEMES")
    ?.split(",")
    .map((scheme) => scheme.trim())
    .filter(Boolean);
  let dataRoot = read("QUARIO_DATA_ROOT") ?? read("CLAUDE_PROJECT_DIR");
  let outDir = resolve(read("QUARIO_OUT_DIR") ?? join(tmpdir(), "quario-mcp"));
  try {
    mkdirSync(outDir, { recursive: true });
    accessSync(outDir, constants.W_OK);
  } catch (cause) {
    throw Error(`QUARIO_OUT_DIR: cannot write to ${outDir}`, { cause });
  }
  return {
    instance: defined({
      license: read("QUARIO_LICENSE"),
      locale: read("QUARIO_LOCALE"),
      currency: read("QUARIO_CURRENCY"),
      timeZone: read("QUARIO_TIME_ZONE"),
      schemes,
      query: defined({
        maxDepth: budget("QUARIO_MAX_DEPTH"),
        maxNodes: budget("QUARIO_MAX_NODES"),
        maxResults: budget("QUARIO_MAX_RESULTS"),
      }),
    }),
    dataRoot: dataRoot === undefined ? undefined : directory("QUARIO_DATA_ROOT", dataRoot),
    outDir: realpathSync(outDir),
  };
}
