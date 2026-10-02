# @quario/mcp

A local stdio MCP server over `@modelcontextprotocol/server` that exposes the quario engine and its five render targets as two tools, `validate_report` and `render_report`. Plain JS + JSDoc, ESM only. `README.md` is the contract. [ADR 0001](docs/adr/0001-the-servers-host-is-its-launch-configuration.md) holds the two decisions a reader would otherwise undo.

Work is done when `npm run check` is green. Run it on Node 22 or later. A single suite is `node --disallow-code-generation-from-strings --test test/tools.test.js`.

## Architecture

- `lib/config.js` reads the environment and is the one place a startup failure is minted.
- `lib/index.js` registers the two tools over `quario/schema.json`, hoisted so its `$defs` resolve from the tool's root. It validates only the envelope and leaves the definition to the engine's `plan`, because a located problem beats a subschema trail.
- `lib/data.js` is the data-root check (after `realpath`) and the `$base64` and `$image` decode. `$image` reads PNG and JPEG only, for the reason in [ADR 0002](docs/adr/0002-a-data-file-reference-reads-images-only.md).
- `lib/output.js` is the never-overwrite writer: `wx`, then `-1`, `-2`, and so on.
- `lib/bin.js` is the `quario-mcp` entry. The suite covers it by spawning it.

## Safety

- The launch configuration is the host and a tool call is an author, so nothing trust-bearing is reachable from a tool argument. `test/tools.test.js` walks every input schema to pin that.
- No string-to-code path. `test/safety.test.js` greps `lib/` for `\beval\b`, `Function(` and `new Function`, so comments in `lib/` avoid those spellings. The suite runs under `--disallow-code-generation-from-strings`.
- The server names the SDK's interpretive `cf-worker` validator wherever it registers a schema, for the reason `lib/index.js` states beside it.

## Conventions

- The engine and the targets are commercial packages from npm. Dependabot bumps them, and CI decides whether a bump is safe. Before 1.0 a caret range never takes the next minor, so a breaking engine release waits for that bump.
- oxfmt owns formatting on its defaults. `npm run fmt`.
- Coverage of `lib/` is 100%, enforced by `c8 --100`.
- `lib/index.d.ts` is hand-written. `checkJs` under `strict` keeps it honest, and `test/types.check.ts` pins the public types.
- `oxlint-tsgolint` is the binary that runs the type-aware rules. Without it they drop silently.
- Conventional Commits, at most 80 characters, checked by `commitlint.config.mjs` from `.githooks/commit-msg`. Enable it once per clone with `git config core.hooksPath .githooks`. A change that ships carries a changeset (`npx changeset`). Its summary is the CHANGELOG entry, so write it for a user of the server.
- The README is user-facing prose: no semicolons, one idea per sentence, active voice, and one word per action.

## Code comments

A comment carries a _why_ the code cannot: a constraint, a deliberate deviation, a gotcha, a workaround. The code already shows the _how_, so the default is no comment. Write for a reader who sees the file fresh. What changed goes in the commit message.
