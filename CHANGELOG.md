# @quario/mcp

## 0.3.0

### Minor Changes

- bbad226: **The server renders with quario 0.15.0.** Three changes reach a definition an agent writes:

  - A table under a group keeps one set of column widths from one group to the next. A PDF of such a report changes its geometry, and its text stays the same.
  - A group aggregate that reads another aggregate of the same group is a render error, also when the group declares `take`. Before, it gave a value that depended on the order of the declarations.
  - A link to `#` and a name goes only to a group that declares that name as its `label`. In a docx, a link to a label that no group declares keeps its text and loses its link.

  The xlsx target's `page.margin` now takes an object with `top`, `right`, `bottom` and `left`, as pdf and docx do. It refuses a paper name it does not know, and a margin that leaves the page no room.

## 0.2.1

### Patch Changes

- 27cabd1: **The server can be listed in the official MCP Registry.** The package declares its registry name, `com.getquario/mcp`. The registry checks that name in the published package before it accepts a listing. Nothing changes in how the server runs.

## 0.2.0

### Minor Changes

- 3de746f: **Render data can name an image by path.** `{ "$image": "assets/logo.png" }` reads a PNG or JPEG from inside the data root and decodes it to bytes before the render, as `{ "$base64": … }` does. An agent no longer pastes a picture as base64 into every call. The path resolves against the data root, also inside a `dataPath` file, and the server checks it after it resolves symlinks. The server reads no file that is not a PNG or JPEG, and it reads each file once per call. Without a data root, `$image` is refused. A refusal names its place in the data, such as `$.input.logo`.

## 0.1.0

### Minor Changes

- **An MCP server that exposes quario as two tools.** `npx @quario/mcp` starts a local stdio server for an agent client such as Claude Code or Claude Desktop. `validate_report` checks a report definition and returns its problems and warnings, each at the path it sits at, and can check the definition's `required` declarations against named targets. `render_report` renders a definition to html, pdf, xlsx, docx or csv and writes the output to a file, returning its path rather than its content.

  The launch configuration is the host: the license key, the presentation defaults, the `href` schemes, the query budgets, the data root and the output directory are environment variables, and no tool argument can reach them. A call may still set `locale`, `currency`, `timeZone` and the target's own options. Render data arrives inline or as a JSON file inside the data root, and an image arrives as a `{ "$base64": … }` object that decodes to bytes before the render. The server never overwrites a file, and invalid configuration stops it at startup with the message on stderr.
