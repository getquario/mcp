---
"@quario/mcp": minor
---

**Render data can name an image by path.** `{ "$image": "assets/logo.png" }` reads a PNG or JPEG from inside the data root and decodes it to bytes before the render, as `{ "$base64": … }` does. An agent no longer pastes a picture as base64 into every call. The path resolves against the data root, also inside a `dataPath` file, and the server checks it after it resolves symlinks. The server reads no file that is not a PNG or JPEG, and it reads each file once per call. Without a data root, `$image` is refused. A refusal names its place in the data, such as `$.input.logo`.
