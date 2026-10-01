---
status: accepted
---

# The MCP server's host is its launch configuration

`@quario/mcp` runs quario for an agent. In quario the host is the program that installs the engine and sets its options, and the author is whoever writes a report definition. The engine treats an author as untrusted. Here the agent writes the definition and chooses the data, so the host and the author are different parties. This records the two calls a future reader is most likely to undo.

## The decision

**Whoever writes the server's launch configuration is the host. The agent calling its tools is an
author.** No trust-bearing option can be reached from a tool argument: the query budgets, the `href`
schemes, registered functions, fonts, the license key, the data root and the output directory are
environment variables only. Presentation is the named exemption. `locale`, `currency`, `timeZone`
and a target's `page` and `meta` may come from a call, because they change how a report looks and
not what the server may read, run or write.

So an agent cannot raise a budget to finish a large render, and cannot point `dataPath` outside the
directory the host granted. That is the point. The engine already treats a definition as untrusted,
and a server that let the author reconfigure the host would undo that.

**A render returns a file path, never the document.** Every target, text or binary, writes a file
into the host's output directory and returns its location. A probe of the clients ruled out the
alternatives. Claude Desktop fails the whole tool call on an embedded PDF or workbook. Claude Code
saves an embedded blob to disk and hands the model a path anyway. Neither client follows a
`resource_link`. A path is the one shape that reaches the user in both.

## Considered options

- **Tool arguments for budgets, with host-set ceilings.** Rejected. A ceiling is a budget by another
  name, and two settings for one limit need a rule for which one wins.
- **Inline HTML and CSV, files only for binary targets.** Rejected. Inline output meets the clients'
  result limits, and the agent seldom needs to reread its own render.

## Consequences

A headless HTTP service would inherit the same line: its deployer's configuration is the
host and its caller is the author.
