---
status: accepted
---

# A data file reference reads images only

Render data can name a picture by path, `{ "$image": "assets/logo.png" }`, so an agent no longer
pastes base64 into every call. The server resolves the path inside the data root and reads it to
bytes before the render. It reads a file only when its magic number says PNG or JPEG. It refuses
everything else with an error located at the reference.

## Why not any file

A generic `{ "$file": … }` would turn the server into a file reader. The engine prints a byte array
in a text cell as its byte values, so `{ "$file": ".env" }` beside a `{{ $.input.x }}` cell would
copy the file into the output document. The data root defaults to the client's project directory,
and some clients give the agent no file access of its own. An image-only reference gives the agent
nothing it could not already pass as `$base64`, except the bytes of pictures the host placed in
the root.

The name says the rule. `$image` promises what it accepts, and `$file` stays free for a use that
needs it, with its own trust decision.

## Considered options

- **Any file, as bytes.** Rejected for the reason above.
- **A host setting for the allowed types.** Rejected. The engine accepts PNG and JPEG and nothing
  else, so a wider list would only admit files that fail at the image item, or print as bytes.
