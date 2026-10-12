---
"@quario/mcp": minor
---

**The server renders with quario 0.15.0.** Three changes reach a definition an agent writes:

- A table under a group keeps one set of column widths from one group to the next. A PDF of such a report changes its geometry, and its text stays the same.
- A group aggregate that reads another aggregate of the same group is a render error, also when the group declares `take`. Before, it gave a value that depended on the order of the declarations.
- A link to `#` and a name goes only to a group that declares that name as its `label`. In a docx, a link to a label that no group declares keeps its text and loses its link.

The xlsx target's `page.margin` now takes an object with `top`, `right`, `bottom` and `left`, as pdf and docx do. It refuses a paper name it does not know, and a margin that leaves the page no room.
