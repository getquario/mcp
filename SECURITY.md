# Security Policy

## Security considerations

The server runs on the machine of the person who starts it. It reads data files and writes rendered output for an agent. The agent counts as an untrusted author.

- The environment sets every trust-bearing option: the query budgets, the `href` schemes, the license key, the data root and the output directory. No tool argument can change them.
- `dataPath` resolves inside the data root after the server resolves symlinks. Set `QUARIO_DATA_ROOT` to the smallest directory the agent needs.
- The server writes only into `QUARIO_OUT_DIR` and never overwrites a file.
- A report definition is untrusted. The engine evaluates it without a string-to-code path.

## Reporting a vulnerability

Do not open a public GitHub issue for a security vulnerability.

Use [GitHub's private vulnerability form](https://github.com/getquario/mcp/security/advisories/new).

Include the affected code, its impact, and steps that reproduce the issue. Tell us whether and how to credit you.

We do not accept AI slop reports.

Keep the report private while we investigate and prepare a fix.
