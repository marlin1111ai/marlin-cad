# Socket Tray geometry — recon (read-only)

Read-only recon per foreman brief. No files were modified; no commits, pushes,
or STL opens occurred. This document only.

## 1. OpenGrid Snap mount primitive — location and attach interface

**Files:**
- `apps/web/src/lib/openGridSnapGeometry.ts:1-141` — the primitive builder.
- `apps/web/src/lib/openGridSnapMesh.ts` (6062 lines) — generated data only:
  4 baked mesh variants (`SNAP_FULL_DIRECTIONAL_*`, `SNAP_FULL_SYMMETRIC_*`,
  `SNAP_LITE_DIRECTIONAL_*`, `SNAP_LITE_SYMMETRIC_*`), each a flat
  `positions`/`indices` pair. Not hand-edited; regenerated from
  `reference/openconnect/opengrid_parametric_snap.scad`.

**How it's built:** `createOpenGridSnapGeometry` (`openGridSnapGeometry.ts:134-141`)
selects one of the 4 variants via `meshVariant()` (`:88-92`), expands the
indexed mesh (`:94-103`), sets it as a `THREE.BufferGeometry` position
attribute, applies the same `rotateX(-Math.PI/2)` convention used by every
other primitive in this codebase (`:138`), and calls
`computeVertexNormals()`. No parameters beyond the two discrete enums
(`boardType`, `snapBodyShape`) — see `OpenGridSnapOptions` (`:129-132`).

**"Attach" interface today — there isn't a runtime one.** I read every
consumer of `createOpenGridSnapGeometry` / `openGridSnapDimensions`:
- `apps/web/src/components/WorkplaneViewport.tsx:7242-7247` and
  `apps/web/src/components/SketchForgeEditor.tsx:2257-2264` both just call
  `createOpenGridSnapGeometry({ boardType, snapBodyShape })` and add the
  resulting mesh to the scene as its own independent shape — same
  `sharedShapeGeometry`-cache-then-`addMesh`/`.clone()` pattern every other
  primitive (Board, Container, Multiconnect) uses. No positional/transform
  relationship to any other shape is computed here.
- `apps/web/src/lib/shapeCatalog.ts:235` and
  `apps/web/src/components/workplane/ShapeInspector.tsx:399-410` call
  `openGridSnapDimensions()` (bounding-box-only helper,
  `openGridSnapGeometry.ts:110-127`) purely to size the inspector/asset
  defaults — again, no attach/mate computation.

So "how does another component attach to it" has no callable
function/interface answer — there's no `attachTo(snap)` or similar. What
exists instead is a **shared-profile guarantee established at bake time,
not at runtime**: the file header comment
(`openGridSnapGeometry.ts:17-24`) states the OpenConnect Container's slot
cutout and the Snap's head are both derived from the *same* upstream
OpenSCAD module (`openconnect_lib.scad`'s `openconnect_head`, called once
with `head_type="head"` for the Snap and once with `head_type="slot"` — the
slot profile is the head profile plus clearance, "confirmed identical
before baking this primitive"). Both meshes are baked independently into
`openGridSnapMesh.ts` and `openConnectContainerGeometry.ts`'s slot-mesh
data; there is no TypeScript-level geometric dependency between them, only
dimensional compatibility inherited from the shared SCAD source at bake
time. Placement in the scene (so a Snap actually sits inside a
Container/Board slot) is left to the user positioning independent shapes,
not computed by any attach function.

## 2. Multiconnect Plate/PegPlate blind-pocket construction pattern

**File:** `apps/web/src/lib/multiconnectContainerGeometry.ts` (755 lines),
main entry `multiconnectPlatePositions()` (`:526-748`); supporting baked
data in `apps/web/src/lib/multiconnectSlotMesh.ts` (`MULTICONNECT_HEAD_RADIUS`,
`MULTICONNECT_CHANNEL_OUTLINE`, `MULTICONNECT_TERMINATOR_*`,
`:26-90` and following).

**Generic pattern** (per the file's own header comment,
`multiconnectContainerGeometry.ts:20-33`, and confirmed reading the code):
each blind pocket is a **"segment stack"** built as pure boundary
representation — no CSG boolean at any point:

1. **Bake a "terminator" mesh once, offline.** The pocket's curved/complex
   end (here: revolved keyhole + taper + lock dimple) is rendered from the
   OpenSCAD reference straight to a triangle soup and stored as flat
   `positions`/`indices` arrays (`multiconnectSlotMesh.ts`), the same way
   the Snap body is baked. The bake also records a fixed 2D cross-section
   at the point the terminator is clipped (`MULTICONNECT_CHANNEL_OUTLINE`,
   8 points in (across, depth) — `multiconnectSlotMesh.ts:39-48`) — this is
   the exact stitch outline the straight continuation must match.
2. **At load time, split the terminator soup into "kept" interior surface
   vs. its two flat caps**, and extract the ordered mouth-rim polyline
   where it meets the mounting face — `buildTerminatorData()`
   (`multiconnectContainerGeometry.ts:285-335`). Triangles whose 3 vertices
   all sit exactly on the mouth-cap plane or the clip plane are dropped
   (cap membership is an *exact* equality check against baked, pre-quantized
   coordinates — `:302-306`, `:311-314`); everything else becomes hole-interior
   surface, transformed and re-emitted with reversed winding
   (`:700-710`) — "cutter-outward becomes hole-inward."
3. **Continue the pocket with a straight prism** of the fixed 2D
   cross-section from the terminator's clip plane down to wherever the
   pocket needs to open (here: the plate's bottom edge) —
   `MULTICONNECT_CHANNEL_OUTLINE` extruded as one quad per outline edge
   except the edge that lies in the open face (`:712-738`, skipping
   `edge === 3`, the neck-top edge that's open at the mounting face).
4. **The host solid's own faces are built with a notch cut directly into
   their outline** wherever a pocket opens through them — never as a
   separate solid subtracted afterward. E.g. the mounting face contour
   walks the plate rectangle and splices in the exact mouth-rim polyline at
   each slot center (`pushMountingNotches`, `:577-585`,
   `pushCap(...)` at `:622`); the bottom edge face similarly splices in the
   channel outline at each slot (`pushBottomNotches`, `:586-593`,
   `:632`). The front face is emitted as one uncut rectangle/rounded-rect
   with **no** notches (the "must not perforate" front face — blind by
   construction, since a boundary rep only has the holes it explicitly
   cuts, `:596-599`).
5. **Every world coordinate for a given pocket instance goes through the
   same shared transform functions** (`worldX`/`worldY`/`worldZ`,
   `:571-573`) so a seam vertex computed twice (once as part of a host
   face's notch, once as part of the pocket's own wall) lands on
   bit-identical doubles — this is the "exact-stitch vertex contract" from
   `CLAUDE-LESSONS.md`, verified in
   `tests/unit/multiconnectContainerGeometry.test.ts` by an exact
   directed-edge test.

**Genericizing for "a row of round blind pockets":** a round pocket is
simpler than the keyhole case — no baked terminator mesh would be needed at
all if the pocket is a plain cylinder/hemisphere-bottom hole; the
"terminator" step could shrink to directly parametrizing a circular rim
polyline at each pocket center (analogous to `mouthRim`) and a straight
cylindrical prism analogous to the channel prism. The reusable shape of the
pattern is: (a) define the pocket's exact rim contour in local 2D, (b)
splice that contour as a notch into whichever host face the pocket opens
through, (c) build the pocket's own interior walls (cap + side wall(s)) as
independent triangles sharing the identical rim-contour point objects, (d)
leave every non-perforated face as an uncut rectangle/outline. Nothing
about this requires the keyhole-specific bake/terminator machinery — that
machinery exists because the Multiconnect keyhole shape is complex, not
because blind pockets in general require it.

## 3. Proposed file location for Socket Tray geometry

`apps/web/src/lib/socketTrayGeometry.ts`, sibling to
`multiconnectContainerGeometry.ts`, `openConnectContainerGeometry.ts`, and
`openGridSnapGeometry.ts` in the same directory — matching this codebase's
existing one-primitive-per-file convention (each primitive's builder,
options type, and normalize/dimension helpers live in one file; baked mesh
data, if any, lives in a separate sibling `*Mesh.ts` file, e.g.
`multiconnectSlotMesh.ts` / `openGridSnapMesh.ts`).

This is clean of the do-not-touch list because:
- It is a **new file**, not an edit to `multiconnectContainerGeometry.ts`.
- Nothing in the Multiconnect module is exported for reuse as a function
  call (its helpers — `pushCap`, `pushRectangleCap`, `pushTriangle`,
  `triangleNormal`, `buildTerminatorData`, etc., `:349-404`, `:285-335` —
  are all local/unexported). A Socket Tray file would at most **read the
  pattern by eye** (as this recon did) and reimplement the same
  boundary-rep technique locally, exactly the way
  `openConnectContainerGeometry.ts` and `multiconnectContainerGeometry.ts`
  are two independent files that each implement their own version of the
  same boundary-rep approach rather than sharing a common cut-pocket
  library today. There is no existing shared helper module this would need
  to touch or extend.
- It would not go near `openGridSnapMesh.ts`, `multiconnectSlotMesh.ts`, or
  any file under `test-prints/`.

## 4. Does placing round blind pockets in a flat tray require touching multiconnectContainerGeometry.ts?

**No — it can be fully additive in a new file.** Reasoning:
- The Multiconnect module exports only plate-specific surface: the
  `MulticonnectPlateOptions`/`MulticonnectPeg` types, the
  `normalizeMulticonnect*` / `multiconnect*` dimension helpers, and
  `multiconnectPlatePositions` / `createMulticonnectPlateGeometry`
  (`:526-756`) — all scoped to *this* plate shape (its own width/height/
  slot-spacing/corner-radius/peg model). None of it is generic
  pocket-cutting infrastructure with a public seam a Socket Tray could or
  would need to plug into; a Socket Tray has its own outline, its own
  pocket layout rule (presumably a grid of round holes rather than
  bottom-edge keyhole slots), and its own thickness/floor logic.
- The boundary-rep *technique* (cap-with-notch + independent pocket walls +
  shared-transform seam contract) is a pattern to imitate, not a library to
  import — see §2. Nothing about round pockets in a flat tray forces
  reopening the keyhole-specific file.
- The only place a real coupling could conceivably arise is if a Socket
  Tray were meant to physically snap onto an OpenGrid Board the way
  Multiconnect does — but per the brief, the back-plate/Snap-mount piece is
  explicitly out of scope for the first sampler, so that coupling doesn't
  apply yet.

I did not find anything that tangles the OpenGrid Snap mount or the
blind-pocket pattern with the Plate/PegPlate code beyond what's described
above, so no STOP-AND-REPORT condition was hit.

## SCOPE CHECK — files read, mapped to task item

| File | Lines read | Informed |
|---|---|---|
| `reference/SESSION-STATE.md` | 1-70 (full) | orientation |
| `reference/DECISIONS.md` | 1-21 (full) | orientation, §2, §3 |
| `reference/OPEN-ITEMS.md` | 1-13 (full) | orientation |
| `reference/KNOWN-FIXES.md` | 1-16 (full) | orientation |
| `apps/web/src/lib/openGridSnapGeometry.ts` | 1-141 (full) | §1 |
| `apps/web/src/lib/openGridSnapMesh.ts` | 1-90 (header + constants) | §1 (confirmed baked-data-only nature) |
| `apps/web/src/lib/multiconnectContainerGeometry.ts` | 1-756 (full) | §2, §3, §4 |
| `apps/web/src/lib/multiconnectSlotMesh.ts` | 1-90 (header + constants) | §2 |
| `apps/web/src/lib/multiconnectPresets.ts` | line count only (62 lines, not opened in detail — not relevant to placement question) | scoping |
| `apps/web/src/components/WorkplaneViewport.tsx` | 7220-7259 | §1 (attach-interface search) |
| `apps/web/src/components/SketchForgeEditor.tsx` | 2240-2279 | §1 (attach-interface search) |
| `apps/web/src/lib/shapeCatalog.ts` | grep line 17, 235 | §1 |
| `apps/web/src/components/workplane/ShapeInspector.tsx` | grep lines 58, 399-410 | §1 |
| `apps/web/src/lib/openConnectContainerGeometry.ts` | grep for head/Snap/mate/slot (lines 15-789 selectively) | §1 (shared-head-profile claim) |
| `test-prints/README.md` | full | context only, per brief — confirms the 6 byte-identical STLs; STL binaries themselves were never opened |

No files were written or modified. No git operations were run.

## Closing summary (plain English)

New Socket Tray code should live in a new sibling file,
`apps/web/src/lib/socketTrayGeometry.ts` — it's fully additive, no existing
file needs to change. The OpenGrid Snap mount has no callable "attach"
function today (Snap and Container/slot geometry are just two independently
baked meshes that happen to share a profile from the same upstream SCAD
source); a Socket Tray with round blind pockets would follow the same
technique used by the Multiconnect keyhole slots — notch the host face's
outline where each pocket opens, build the pocket's own cap/walls as
separate triangles sharing exact rim coordinates, leave every other face as
a plain rectangle — but round pockets are simpler and likely don't need a
baked terminator mesh at all. The thing I'm least certain about: whether
the round pockets are meant to be a straight-through hole in a floor
(no blind bottom, more like an OpenConnect-style opening) or a genuinely
blind pocket like Multiconnect's slots — that changes whether the "must
not perforate" front/back-face guarantee even applies, and I didn't see
that spec'd anywhere I read.
