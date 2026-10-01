import { readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/**
 * Decode every `{ "$base64": "…" }` in a JSON value to a `Uint8Array`, in
 * place: the one way a tool call carries image bytes. A string that is not
 * base64 is refused by its path as a definition reads it, from `$.input`.
 * @param {unknown} value
 * @param {string} [at]
 */
export function decode(value, at = "$.input") {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = decode(value[i], `${at}[${i}]`);
    return value;
  }
  let keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === "$base64") {
    let text = /** @type {Record<string, unknown>} */ (value).$base64;
    if (typeof text !== "string" || !BASE64.test(text))
      throw Error(`${at}: $base64 is not a base64 string`);
    return new Uint8Array(Buffer.from(text, "base64"));
  }
  let object = /** @type {Record<string, unknown>} */ (value);
  for (let key of keys) object[key] = decode(object[key], `${at}.${key}`);
  return object;
}

/**
 * Read a JSON file under the data root. The path is checked after `realpath`,
 * so a symlink cannot leave the root. The parse failure is the server's own
 * message: `JSON.parse`'s would quote the file.
 * @param {string} dataPath
 * @param {string | undefined} root
 */
export async function readData(dataPath, root) {
  if (root === undefined) throw Error("dataPath: no data root is configured");
  let real;
  try {
    real = await realpath(resolve(root, dataPath));
  } catch (cause) {
    throw Error(`dataPath: ${dataPath} does not exist`, { cause });
  }
  if (real !== root && !real.startsWith(root + sep))
    throw Error(`dataPath: ${dataPath} is outside the data root`);
  try {
    return JSON.parse(await readFile(real, "utf8"));
  } catch (cause) {
    throw Error(`dataPath: ${dataPath} is not JSON`, { cause });
  }
}
