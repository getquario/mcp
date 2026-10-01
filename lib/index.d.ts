import type { McpServer } from "@modelcontextprotocol/server";
import type { QuarioOptions } from "quario";

/** The server's configuration, read from its environment by `configure`. */
export interface Config {
  /** The engine instance options the host set: the license key, the presentation defaults, the `href` schemes and the query budgets. */
  instance: QuarioOptions;
  /** The real path `dataPath` resolves in, or none: then `dataPath` is refused. */
  dataRoot: string | undefined;
  /** The real path renders are written to. */
  outDir: string;
}

/**
 * Read the configuration from an environment. An empty variable is an unset
 * one. Throws with the message the launcher prints on a value the server
 * cannot run with.
 */
export function configure(env: Record<string, string | undefined>): Config;

/**
 * The server over one configuration, its two tools registered and not yet
 * connected to a transport. Throws at once on a configuration the engine
 * refuses.
 */
export function createServer(config: Config): McpServer;
