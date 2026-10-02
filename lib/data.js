import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/**
 * Decode every `{ "$base64": "…" }` and `{ "$image": "<path>" }` in a JSON
 * value to a `Uint8Array`, in place: the two ways a tool call carries image
 * bytes. A refusal names its path as a definition reads it, from `$.input`.
 * @param {unknown} value
 * @param {string | undefined} root the data root an `$image` resolves in
 */
export async function decode(value, root) {
  /** @type {Map<string, Promise<Uint8Array | null>>} */
  let images = new Map();
  /** @type {(value: unknown, at: string) => Promise<unknown>} */
  let walk = async (value, at) => {
    if (typeof value !== "object" || value === null) return value;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) value[i] = await walk(value[i], `${at}[${i}]`);
      return value;
    }
    let object = /** @type {Record<string, unknown>} */ (value);
    let keys = Object.keys(object);
    if (keys.length === 1 && keys[0] === "$base64") return base64(object.$base64, at);
    if (keys.length === 1 && keys[0] === "$image") return image(object.$image, root, at, images);
    for (let key of keys) object[key] = await walk(object[key], `${at}.${key}`);
    return object;
  };
  return walk(value, "$.input");
}

/**
 * @param {unknown} text
 * @param {string} at
 */
function base64(text, at) {
  if (typeof text !== "string" || !BASE64.test(text))
    throw Error(`${at}: $base64 is not a base64 string`);
  return new Uint8Array(Buffer.from(text, "base64"));
}

/**
 * A PNG or JPEG under the data root, read once per call however often the
 * data names it. Only those two: any other file would print into the
 * document as its byte values.
 * @param {unknown} path
 * @param {string | undefined} root
 * @param {string} at
 * @param {Map<string, Promise<Uint8Array | null>>} images
 */
async function image(path, root, at, images) {
  if (typeof path !== "string" || path === "") throw Error(`${at}: $image is not a path`);
  if (root === undefined) throw Error(`${at}: $image needs a data root`);
  let real = await inside(root, path, `${at}: $image ${path}`);
  if (!images.has(real)) images.set(real, readImage(real));
  let bytes = await images.get(real);
  if (bytes === null) throw Error(`${at}: $image ${path} is not a PNG or JPEG`);
  return bytes;
}

/** @param {string} real */
async function readImage(real) {
  if (!(await stat(real)).isFile()) return null;
  let bytes = new Uint8Array(await readFile(real));
  return PNG.every((byte, i) => bytes[i] === byte) || JPEG.every((byte, i) => bytes[i] === byte)
    ? bytes
    : null;
}

/**
 * The real path of `path` under `root`, checked after `realpath` so a symlink
 * cannot leave the root.
 * @param {string} root
 * @param {string} path
 * @param {string} label the start of each refusal
 */
async function inside(root, path, label) {
  let real;
  try {
    real = await realpath(resolve(root, path));
  } catch (cause) {
    throw Error(`${label} does not exist`, { cause });
  }
  if (real !== root && !real.startsWith(root + sep))
    throw Error(`${label} is outside the data root`);
  return real;
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
  let real = await inside(root, dataPath, `dataPath: ${dataPath}`);
  try {
    return JSON.parse(await readFile(real, "utf8"));
  } catch (cause) {
    throw Error(`dataPath: ${dataPath} is not JSON`, { cause });
  }
}
