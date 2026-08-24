# marlin-cad

SketchForge: a browser-based parametric CAD editor (Next.js + three.js,
`apps/web`) whose flagship features are printable mounting-system
primitives — OpenGrid Board, OpenGrid Snap, OpenConnect Container,
Multiconnect Plate/PegPlate — built as synchronous boundary-rep geometry
builders in `apps/web/src/lib`, unit-tested in `tests/unit`, with an MCP
server (`scripts/sketchforge-mcp-server.mjs`) for driving a live editor.
Work runs foreman/builder: the owner (Marlin) makes design decisions and
rules on scope; Claude sessions build in small phases, each committed and
pushed under an agreed gate. Phases that produce physical geometry are
print-gated — a coupon or sampler STL from `test-prints/` (untracked) is
actually printed and hand-verified before the next phase builds on it, and
findings from those prints are banked as lessons.

@CLAUDE-LESSONS.md
