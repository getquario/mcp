# @quario/mcp

**An MCP server that exposes [quario](https://www.npmjs.com/package/quario) as two tools.** An
agent validates a report definition with `validate_report` and renders one with `render_report`.
The server runs locally over stdio, and `npx @quario/mcp` starts it.

**The server is open source. The engine it runs is not.** This package is Apache-2.0. It installs
`quario` and the five render targets. Those packages are commercial software under the
[Quario License](https://getquario.com). Evaluation is free. Without a license key, every render
carries an unlicensed mark.

## Add it to a client

Claude Code:

```bash
claude mcp add quario -e QUARIO_LICENSE=quario_... -- npx -y @quario/mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "quario": {
      "command": "npx",
      "args": ["-y", "@quario/mcp"],
      "env": { "QUARIO_LICENSE": "quario_..." }
    }
  }
}
```

The package carries the engine and the five render targets as dependencies. Node 22 or later.

## Configuration

The server reads its configuration from environment variables. There are no flags and no config
file. An empty variable counts as unset.

| Variable             | Sets                                 | When unset                                  |
| -------------------- | ------------------------------------ | ------------------------------------------- |
| `QUARIO_LICENSE`     | the license key                      | unlicensed, and the output carries the mark |
| `QUARIO_LOCALE`      | the default `locale`                 | `en-US`                                     |
| `QUARIO_CURRENCY`    | the default `currency`               | none                                        |
| `QUARIO_TIME_ZONE`   | the default `timeZone`               | `UTC`                                       |
| `QUARIO_SCHEMES`     | the `href` schemes, comma-separated  | `https:,mailto:`                            |
| `QUARIO_MAX_DEPTH`   | a query budget, or `Infinity`        | `500`                                       |
| `QUARIO_MAX_NODES`   | a query budget, or `Infinity`        | unbounded                                   |
| `QUARIO_MAX_RESULTS` | a query budget, or `Infinity`        | unbounded                                   |
| `QUARIO_DATA_ROOT`   | the directory `dataPath` resolves in | `CLAUDE_PROJECT_DIR`, else `dataPath` fails |
| `QUARIO_OUT_DIR`     | the directory the server writes to   | `quario-mcp` under the system temp dir      |

**A value the server cannot run with stops it at startup.** The message goes to stderr. That
covers a budget that does not parse, a scheme the engine refuses, a data root that does not exist,
and an output directory the server cannot create or write. A license key that fails verification
is the one exception: the server starts, and the output carries the mark.

## The trust line

The configuration the host sets in the environment is the host. The agent that calls the tools is an author, and the engine
treats an author as untrusted. So no tool argument reaches a host setting: the query budgets, the
`href` schemes, registered functions, fonts, the license key, the data root and the output
directory come from the environment alone.

`locale`, `currency`, `timeZone` and the target options are the exception. They change how a
report looks, not what the server can read, run or write, so a call may set them.

## `validate_report`

Reads a definition for problems without rendering it.

| Field        | Type                                                    | Notes                                          |
| ------------ | ------------------------------------------------------- | ---------------------------------------------- |
| `definition` | object                                                  | required                                       |
| `targets`    | array of `"html" \| "pdf" \| "xlsx" \| "docx" \| "csv"` | optional. Reads `required` against each target |

The `definition` field carries the full JSON Schema of the report document, descriptions included,
so an agent reads the document's semantics from the tool itself. The server reads the envelope
against that schema and hands the definition to the engine unchecked. The engine reports a fault as
one problem at the path it sits at, which is more use to an agent than the schema's list of every
subschema that failed.

A problem is a successful result, never an error. The result carries `structuredContent` with
`{ problems, warnings }`, and one text block with the same object as JSON. Both copies are complete,
because one client gives the model the structured copy and another gives it the text.

- A problem is `{ path, source?, message, code?, start?, end? }`. `code`, `start` and `end` come
  from the located diagnostic when the engine has one.
- A warning is `{ path, message }`.

## `render_report`

Renders a definition to one target and writes the output to a file.

| Field        | Type                                           | Notes                                                |
| ------------ | ---------------------------------------------- | ---------------------------------------------------- |
| `definition` | object                                         | required                                             |
| `target`     | `"html" \| "pdf" \| "xlsx" \| "docx" \| "csv"` | required                                             |
| `data`       | any JSON value                                 | give exactly one of `data` and `dataPath`            |
| `dataPath`   | string                                         | a JSON file inside the data root                     |
| `params`     | object                                         | optional. Values for the definition's `params`       |
| `locale`     | string                                         | optional. Overrides `QUARIO_LOCALE` for this call    |
| `currency`   | string                                         | optional. Overrides `QUARIO_CURRENCY` for this call  |
| `timeZone`   | string                                         | optional. Overrides `QUARIO_TIME_ZONE` for this call |
| `filename`   | string                                         | optional. A basename, see below                      |
| `options`    | object                                         | optional. `page`, `meta`, and `filter` for xlsx      |

The tool plans the definition against its target, so a `required` declaration that target loses
is a problem. A definition with problems returns the same `{ problems, warnings }` as
`validate_report`, marked `isError`.

`options` passes to the target factory. The server refuses `fonts` and `paths`. An unknown key returns
the factory's own message as an error. The csv target takes no options.

### Render data

- Give exactly one of `data` and `dataPath`. Both, or neither, is an error.
- `dataPath` resolves inside the data root. The server tests the path after it resolves symlinks,
  so a link cannot leave the root. Without a data root, the server refuses `dataPath`.
- The file holds JSON. A file that does not parse returns the server's own message, and never the
  file's text.
- An image arrives as `{ "$base64": "<base64>" }`. An object whose only key is `$base64` decodes to
  bytes before the render, at any depth, in inline data and in files alike. The definition reads
  it as usual: `=$.input.logo`. A string that is not base64 is an error that names its path.

### The output file

Every target writes a file and returns its location, never its content.

- The file goes to `QUARIO_OUT_DIR`.
- `filename` is a basename. It holds no separator and is not `..`. The server forces the target's
  extension. Without a `filename`, the name is `report-<timestamp>.<ext>`.
- The server never overwrites. A name that exists gets `-1`, then `-2`, and so on.
- The result carries `structuredContent` with `{ path, target, bytes }`, and the text
  `Wrote <name> (<size>): <absolute path>`.

## Not in this release

Registered functions, image references by path, host fonts, and remote transport.

## Development

`npm run check` is the local gate. It runs formatting, lint, the dead-code checks, the size budget,
the unit and type suites, and the complexity check. CI runs the same gate. A green `check` locally
means a green pull request.

[AGENTS.md](AGENTS.md) holds the conventions for this repo. [docs/adr](docs/adr) holds the decisions
that a reader is most likely to undo.

## License

Copyright 2026 Robin van der Vleuten

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

The `quario` and `@quario/*` packages this server installs have their own license. See the
LICENSE file in each of those packages.
