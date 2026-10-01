import type { McpServer } from "@modelcontextprotocol/server";
import { configure, createServer, type Config } from "@quario/mcp";

// Declared in plain JS and validated at runtime; here the hand-written
// declarations must stay callable with the same shapes.
const config: Config = configure(process.env);
const server: McpServer = createServer(config);
const root: string | undefined = config.dataRoot;

// @ts-expect-error the configuration is read from an environment, not built by hand
configure({ QUARIO_LICENSE: 1 });
// @ts-expect-error a server needs its configuration
createServer();

void [server, root];
