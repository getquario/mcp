# @quario/mcp

## 0.1.0

### Minor Changes

- **An MCP server that exposes quario as two tools.** `npx @quario/mcp` starts a local stdio server for an agent client such as Claude Code or Claude Desktop. `validate_report` checks a report definition and returns its problems and warnings, each at the path it sits at, and can check the definition's `required` declarations against named targets. `render_report` renders a definition to html, pdf, xlsx, docx or csv and writes the output to a file, returning its path rather than its content.

  The launch configuration is the host: the license key, the presentation defaults, the `href` schemes, the query budgets, the data root and the output directory are environment variables, and no tool argument can reach them. A call may still set `locale`, `currency`, `timeZone` and the target's own options. Render data arrives inline or as a JSON file inside the data root, and an image arrives as a `{ "$base64": … }` object that decodes to bytes before the render. The server never overwrites a file, and invalid configuration stops it at startup with the message on stderr.
