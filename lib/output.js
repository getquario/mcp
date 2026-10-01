import { open } from "node:fs/promises";
import { join } from "node:path";

/**
 * The stem a render is written under: the caller's basename with the
 * target's extension stripped, or `report-<timestamp>` without one. Every
 * target's extension is its name.
 * @param {string | undefined} filename
 * @param {string} ext
 */
export function stemFor(filename, ext) {
  if (filename === undefined) return `report-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;
  // Both separators, whatever the platform: a name is written on this host
  // and read on any other.
  if (filename === "" || filename === "." || filename === ".." || /[\\/]/.test(filename))
    throw Error(`filename: expected a basename, got ${JSON.stringify(filename)}`);
  return filename.toLowerCase().endsWith(`.${ext}`) ? filename.slice(0, -ext.length - 1) : filename;
}

/**
 * Write a render into the output directory and never over a file that
 * exists: a taken name gets `-1`, `-2` and so on, decided by the exclusive
 * create itself so two concurrent renders cannot race for one name.
 * @param {string} dir
 * @param {string} stem
 * @param {string} ext
 * @param {string | Uint8Array} content
 * @returns {Promise<{ path: string, bytes: number }>}
 */
export async function write(dir, stem, ext, content) {
  let n = 0;
  while (true) {
    let path = join(dir, `${stem}${n === 0 ? "" : `-${n}`}.${ext}`);
    let handle;
    try {
      handle = await open(path, "wx");
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "EEXIST") throw error;
      n++;
      continue;
    }
    let bytes = typeof content === "string" ? Buffer.from(content) : content;
    try {
      await handle.writeFile(bytes);
      return { path, bytes: bytes.byteLength };
    } finally {
      await handle.close();
    }
  }
}

/**
 * A byte count as text: `512 B`, `12.3 kB`, `1.8 MB`.
 * @param {number} bytes
 */
export function size(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
