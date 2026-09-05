# Socket Tray edge rounding — recon (read-only)

Read-only recon for adding rounded edges (outer edges + pocket rims) to the
flat Socket Tray (`apps/web/src/lib/socketTrayGeometry.ts`) and the Mounted
Socket Tray (`apps/web/src/lib/mountedSocketTrayGeometry.ts`). **No code,
test, STL, config, or doc change was made; this report is the only file
created.** No fillet-vs-chamfer choice or radius value was made — every
place a decision is needed is named and left to the owner.

## Step 1 — clean tree, HEAD == origin/main

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
$ git fetch origin
$ git rev-parse HEAD
d3c864df7ebfd5710984a784235246031d66029b
$ git rev-parse origin/main
d3c864df7ebfd5710984a784235246031d66029b
```

Tree clean, HEAD matches `origin/main`. No STOP condition.

## Step 2 — does any existing shape already round edges (fillet/chamfer)?

**Yes, in four distinct forms, none of which does exactly what the owner is
asking for.** Full-repo greps for `fillet`, `chamfer`, `round`, `bevel`
across `apps/web/src` (`--include='*.ts' --include='*.tsx'`) returned 86,
132, 213, and 37 hits respectively (468 total). The great majority are
noise: `Math.round`, UI copy ("Round the outside" in a tutorial panel),
`background`/`foreground` substring matches, SVG `stroke-linecap="round"`,
gear-type `"bevel"`, `THREE.ExtrudeGeometry`'s `bevelEnabled` (always
`false` except on Text/Tube/Ring, an unrelated 2D-outline-extrusion bevel),
and the unrelated CAD-tree shape kinds `"roundRoof"` / `"round-roof"`. Every
hit that is a real rounding **technique** is one of these four:

### 2a. Multiconnect peg fillet — a genuine 3D revolved-profile fillet (closest precedent to pocket-rim rounding)

`apps/web/src/lib/multiconnectContainerGeometry.ts`, `pushPegSurfaces`
(`:481-522`) and the profile builder in `multiconnectPlatePositions`
(`:546-564`).

- **How it's built.** Each peg is a body of revolution built from a 2D
  `(radius, depth)` profile (`:554-562`): the profile starts at
  `[peg.radius + pegFilletRadius, 0]` (the face plane, at the outer edge of
  the fillet collar), then walks `MULTICONNECT_PEG_FILLET_SEGMENTS = 6`
  (`:122`) extra points around a quarter-circle arc centered at
  `(peg.radius + pegFilletRadius, pegFilletRadius)` in profile space
  (`:556-559`), landing exactly on `[peg.radius, pegFilletRadius]`
  (`:560`, the point tangent to the peg's own cylindrical wall), then
  continues straight out to the tip. Each profile point becomes one
  revolved ring (`pegRing`, `:477-479`); `pushPegSurfaces` (`:481-522`)
  connects each pair of adjacent rings ("bands") with a quad strip, and
  detects which bands are the fillet by comparing profile radii
  (`isFillet = profile[band][0] !== profile[band+1][0]`, `:484`) so it can
  compute the correct outward normal for a curved band (pointing away from
  a per-band revolved arc-center ring, `:493-498`) versus a straight
  cylindrical band (`:499-500`).
- **Fillet vs chamfer / radius / segments.** Fillet only (arc), no chamfer
  option for pegs. Radius is `pegFilletRadius`, default
  `DEFAULT_MULTICONNECT_PEG_FILLET_RADIUS = 2` (`:123`), clamped 0–5
  (`normalizeMulticonnectPegFilletRadius`, `:408-411`). Arc resolution is
  the fixed constant `MULTICONNECT_PEG_FILLET_SEGMENTS = 6` (`:122`), not a
  parameter.
- **Library or hand-rolled?** Fully hand-rolled — plain trig on a profile
  array, the same triangle-emission helpers (`pushTriangle`,
  `triangleNormal`) every primitive in this codebase reimplements locally.
  No CSG, no THREE.js bevel/fillet API.
- **Is this the shape the owner is asking for?** Partially. This is a
  **convex** fillet (rounding a raised cylinder's base into a flat face
  it protrudes FROM) — the mechanical inverse of a pocket rim, which needs
  a **concave** fillet (rounding a recessed cylinder's rim into a flat face
  it's cut INTO). The construction technique (extra revolved profile
  points, per-band curved-vs-straight normal handling) transfers directly;
  the concavity flips.
- **Is a fillet radius already exposed to the user for this specific
  feature?** Yes — see step 5.

### 2b. Multiconnect plate corner rounding — vertical-corner-only, not a horizontal edge

`multiconnectContainerGeometry.ts:109-113` (comment), `:417-419`
(`roundedRectInsideDistance`), `:634+` (outline generation),
`normalizeMulticonnectCornerRadius` region near `:60-62`. Rounds the
plate's 4 **vertical** corners (its XZ footprint) with quarter-circle arcs
spliced into the outline that every face (front, mounting, top/bottom
edges) shares — extruded straight through the plate's full height, so the
rounding is a vertical column, not a horizontal edge treatment. Exposed to
the user as "Corner Radius" (see step 5). No chamfer option for this
feature (fillet/arc only).

### 2c. OpenConnect Container `cornerRounding` — the "Chamfer" vs "Fillet" naming precedent, still vertical-corner-only

`apps/web/src/lib/openConnectContainerGeometry.ts`, type
`OpenConnectCornerRounding = "None" | "Chamfer" | "Fillet"`
(`apps/web/src/types/sketchforge.ts:134`), `CORNER_ROUNDING_OPTIONS`
(`openConnectContainerGeometry.ts:116`), `roundedRectOutline`
(`:547-573`).

- **How it's built.** A direct generalization of OpenGrid Board's own
  corner-clip technique (file's own comment, `:539-544`): for each of the 4
  footprint corners, compute an "arrive" point (offset inward along the
  incoming edge) and a "depart" point (offset inward along the outgoing
  edge), both at distance `size` from the corner. `"Chamfer"` just emits
  those two points as a straight 2-point line (`:557-559`, a true straight
  chamfer, not an arc). `"Fillet"` instead sweeps an 8-segment arc between
  them, computed generically from the two points' angles around a shared
  center (`:561-573`) — the file's comment says this generalizes to work
  "unmodified for all 4 corners without hand-casing each quadrant."
- **Fixed or parametrized size?** `cornerSize = clamp(wallThickness * 2, 3,
  10)` (`:712`) — **derived from another field, not directly user-typed.**
  Only the MODE (`None`/`Chamfer`/`Fillet`) is a user-facing select
  (`ShapeInspector.tsx:359`); the size itself has no inspector row.
- **Scope limitation, stated in the file's own comment (`:534-538`):**
  "Applied to the base slab's own footprint outline only (not carried
  through the walls) — keeps this to a single, low-risk earcut outline
  change rather than reworking every wall piece into an outline-extrusion
  too." So even within this codebase's most general-purpose rounding
  routine, rounding was deliberately kept to ONE face's outline, not
  carried through the full 3D solid.

### 2d. OpenGrid Board corner chamfer — hand-rolled boundary-rep, explicitly replaced an earlier CSG approach

`apps/web/src/lib/openGridGeometry.ts`. `chamferMode: "everywhere" |
"corners" | "none"` (`types/sketchforge.ts:128`), `CHAMFER_INSET = 4.2`
(`:20`), `cornerWedgeChamferAt` (`:295-303`), `boardOuterOutlineWithFeatures`
(`:594+`).

- **How it's built.** A per-Z-band wedge chamfer: `cornerWedgeChamferAt(z)`
  computes a Z-varying inset distance derived directly from
  `openGrid.scad`'s own constants (`CORNER_TOP_CAPTURE_INITIAL_INSET`,
  `CORNER_INSIDE_GRID_MIDDLE_CHAMFER`, `CORNER_PROFILE_CHAMFER`,
  `:282-303`) rather than a measured lookup table, and
  `boardOuterOutlineWithFeatures` clips each of the 4 corners by that
  distance using the same incoming/outgoing-edge-offset technique as 2c
  (`clipRectangleCorners`, referenced at `:546`). It is a straight chamfer
  only — no arc/fillet variant exists for the board.
- **Explicit CSG-to-boundary-rep migration, on record.** The file's own
  comment (`:587-593`) states: "`subtractOuterCorners` (CSG) was the
  original approach for the chamfer... confirmed empirically (Chamfers =
  Corners + a connector notch...)" caused a non-manifold T-junction, which
  is why this moved to the current boundary-rep outline-splice approach.
  This is the concrete precedent CLAUDE-LESSONS.md's "prefer boundary
  representation over runtime CSG" lesson is generalized from for the
  rounding/chamfer case specifically, not just the "cut reaches a surface"
  slot case.
- **Fixed or parametrized?** Fully hardcoded constants; only the MODE
  (everywhere/corners/none) is user-facing (`ShapeInspector.tsx:290`), the
  chamfer SIZE has no inspector row anywhere.
- Same vertical-corner-only scope as 2b/2c — never rounds a horizontal
  (top-face-meets-wall) edge.

### 2e. Generic runtime OCCT Fillet/Chamfer tool — a completely different mechanism, works on arbitrary edges of any shape including this one

`apps/web/src/components/workplane/EdgeModifierPanel.tsx`,
`apps/web/src/workers/cadModifier.worker.ts`,
`apps/web/src/lib/cadModifierTypes.ts` (`CadModifierKind = "chamfer" |
"fillet"`).

- **What it is.** A user-driven toolbar tool ("Fillet"/"Chamfer" buttons,
  `SketchForgeEditor.tsx:9633-9634`) enabled for any single, non-locked,
  non-hole selected shape (`canEdgeModify`, `SketchForgeEditor.tsx:9018`) —
  this condition does not exclude Socket Tray or Mounted Socket Tray. The
  user picks specific mesh edges in the 3D view; the operation runs in a
  Web Worker against a real OCCT/B-rep kernel (`activeCad.fillet(...)`,
  `activeCad.chamfer(...)`, `cadModifier.worker.ts:451-454`), with a
  numeric amount and (for chamfer) an angle (5–85°) as user inputs
  (`EdgeModifierPanel.tsx:257`, `:268`).
- **How it gets a solid to operate on.** `reconstructSolid`
  (`cadModifier.worker.ts:186-236`) prefers a native parametric part or a
  stored B-rep (`part.primitive`/`part.brep`), but **falls back to
  `cad.importStl(meshPartToAsciiStl(part))`** (`:206`) for any shape with
  neither — i.e., it round-trips the shape's own triangle mesh through an
  ASCII STL string into OCCT, then heals it (`healSolid`, `fixShape`,
  `fixFaceOrientations`, `removeDegenerateEdges`, `unifySameDomain`,
  `:207-216`) before edge selection/fillet/chamfer can run. This means the
  Socket Tray's and Mounted Socket Tray's own triangle-soup output — never
  touching `socketTrayGeometry.ts`/`mountedSocketTrayGeometry.ts` at all —
  is already a mechanically valid input to this tool today, as a per-shape,
  user-driven, ad hoc 3D-viewport action.
- **Why this is not "the same kind of thing" as 2a–2d, and not what a build
  task would draw on.** It is asynchronous (a Web Worker; CLAUDE-LESSONS.md
  is explicit that primitive builders must stay synchronous, reserving
  async kernels for bake-time scripts), it is applied per-shape-instance by
  the user picking edges at runtime rather than being a property of the
  geometry module's own construction, its result is recorded as
  `shape.edgeTreatments` (a post-hoc feature list, `types/sketchforge.ts:176`
  region) rather than a `SocketTrayOptions`/`MountedSocketTrayOptions`
  field, and it depends on an STL-roundtrip mesh healing step whose
  reliability on this specific geometry (thin floors, tightly-packed
  pockets) is untested. It is real, working precedent that edge rounding on
  these two shapes is *mechanically possible without any geometry-module
  edit at all* — but it is a fundamentally different mechanism than "insert
  extra boundary vertices in the construction," and does not give a
  fillet/chamfer **radius parameter on the shape itself** (see step 5).

**Summary for step 2:** the closest reusable TECHNIQUE for pocket-rim
rounding is 2a (Multiconnect peg fillet — revolved profile, extra arc
bands, hand-rolled, no CSG); nothing in the codebase does a horizontal
box-edge (top/side/end edge) fillet or chamfer anywhere — 2b/2c/2d only
ever round vertical footprint corners, deliberately scoped to avoid
"reworking every wall piece into an outline-extrusion" (2c's own words). 2e
is a separate, already-working, per-instance runtime path that needs no
code change to touch either tray but does not produce a stored, adjustable
radius property.

## Step 3 — per-shape boundary-rep analysis

### 3a. Flat Socket Tray (`socketTrayGeometry.ts`)

**Outer-edge vertices.** `socketTrayPositions()` (`:213-288`) builds the six
box faces as six independent calls: top (`:242` uncut, or `:244` notched),
bottom (`:248`), and four side walls (`:252-255`). Each call's corner
points are written as literal `Point3` tuples inline at the call site (e.g.
`[width, topY, 0]` appears independently in the top-face call and the
right-side-wall call) — **these are not shared point objects today**, only
numerically-identical literals. There is no single "outline array" the
outer box faces read from (unlike the Mounted Socket Tray, see 3b).

**Pocket rim vertices.** Built once per pocket in `pocketBuilds`
(`:227-232`): `rim` (top ring, `Point3[]`) and `floorRing` (`Point3[]`).
The SAME `rim` objects feed both (1) the top face's earcut hole contour via
`pocketHoles` (`:233`, consumed at `:244`) and (2) the pocket wall's top
ring (`:259-281`) — this is the exact-stitch pattern from
CLAUDE-LESSONS.md, already in place and tested (the exact directed-edge
test in `tests/unit/socketTrayGeometry.test.ts`).

**Would a fillet/chamfer require CSG, or can it be boundary-rep additions?**

- **Pocket rim: no CSG needed.** Directly analogous to 2a (Multiconnect peg
  fillet), just concave instead of convex. Today `rim` sits at exactly
  `Y = topY` and is used directly as both the notch contour and the wall's
  top ring. Adding a rounded/chamfered rim means: keep the top face's
  notch contour at a (possibly now-smaller) "true opening" ring at
  `Y = topY`, and insert one or more additional revolved rings between it
  and the existing `rim`/wall construction, following the same
  profile-with-arc-bands technique 2a uses, with the per-band inward/outward
  normal test already present in this file's own pocket-wall loop
  (`:270-280`, the `midAngle`/`inward` dot-product-flip pattern) extended to
  the new bands. No CSG; purely additional triangles from additional
  profile points, same construction family.
- **Outer edges (top/side/end edges of the plate): no CSG needed either, but
  no existing worked example does exactly this.** Because the six faces are
  built as flat, non-shared-outline rectangles today, rounding a top
  perimeter edge (where the top face meets a side wall) means restructuring
  those two faces into a shared cross-section profile swept along the
  perimeter — closer in spirit to combining 2d's per-band idea (a profile
  that varies along one sweep direction) with 2a's arc-insertion technique,
  but nothing in this codebase currently sweeps an arc-filleted profile
  along a straight box edge. This is a materially larger, novel-to-this-
  codebase construction than the pocket-rim case, not a small addition.

### 3b. Mounted Socket Tray (`mountedSocketTrayGeometry.ts`)

**Outer-edge vertices.** The ENTIRE solid is one L-shaped prism built from a
single six-point `outline: Point2[]` array (`:450-457`) — every face reads
its corners from this one array: the two end caps at `X=0`/`X=plateWidth`
are the L-polygon itself (`:482-483`); three of the six side faces (edges
2, 3, 5 — plate top, plate front, tray front) are plain rectangles read
straight out of `outline` via `pushQuad` (`:526-542`); the other three
(edges 0, 1, 4 — bottom, mounting face, tray top) are earcut caps built
from contours that start/end at `outline` points and splice in slot/pocket
notches (`:485-522`). **So literally every outer edge of this part traces
back to one shared array**, a stronger and more centralized precedent than
the flat tray's independent-per-face literals.

**Pocket rim vertices.** Identical pattern to the flat tray:
`pocketBuilds` (`:473-478`) builds `rim`/`floorRing` once; the same `rim`
objects feed the tray-top notch (`pocketHoles`, consumed at `:522`) and the
pocket wall (`:588-610`).

**Would a fillet/chamfer require CSG, or can it be boundary-rep additions?**

- **Pocket rim: same answer as the flat tray** — no CSG, same
  peg-fillet-style technique transfers directly (the pocket construction
  code, `:586-611`, is a byte-for-byte copy of the flat tray's own pocket
  code).
- **Outer edges away from the L-junction (edges 2, 3, 5 and the straight
  portions of 0/1/4): no CSG needed**, same reasoning as 3a — would need a
  swept-fillet-profile construction not currently present anywhere in this
  codebase, but purely additive triangles, no boolean.
- **The L-junction inner corner (point E in the `outline` array, where the
  tray top meets the plate's front face) is a THIRD, harder case, distinct
  from both "ordinary outer edge" and "pocket rim."** The file's own header
  comment (`:45-76`) states this junction was deliberately "designed out,
  not mitigated" by making it a single shared array entry every face reads
  by reference — not a seam between two constructions. Rounding it would
  mean splicing an arc into the `outline` array itself at point E, which is
  NOT local to one face: it is read by both end caps (`:482-483`, which
  already handle arbitrary contours via `pushCap`/earcut and could accept
  extra points) AND by the plain-rectangle side-face extrusion
  (`pushQuad`, `:526-542`), which explicitly assumes a straight 2-point
  edge per outline segment and has no notion of an inserted curve. Edges 0,
  1, and 4 (the earcut caps) also consume `outline` points as fixed corners
  of their own contours (`:491`, `:505`, `:513`, `:521`) and would need
  those splice points re-derived to match a curved edge E if it changed.
  This is a bigger structural change than either the ordinary-outer-edge
  case or the pocket-rim case — it touches the one array every other face
  in the entire module depends on. **The owner's brief describes "outer
  edges of the printed part (top/side/end edges of the plate and tray
  body)" and does not explicitly mention this inner junction; whether it is
  in scope is left as an open question (step 8), not decided here.**

## Step 4 — pocket-rim rounding vs. the sealed-pocket / raycast requirement

**Real risk: yes.** A pocket-rim fillet/chamfer, implemented incorrectly,
is exactly the failure class CLAUDE-LESSONS.md's sealed-pocket entry
describes: a mesh that is topologically a perfectly valid closed manifold
(0 boundary edges, 0 non-manifold edges — every existing manifold and
exact-directed-edge test would still pass) while the pocket opening is
nonetheless fully or partially closed by a stray patch of the new fillet
geometry. Concrete way this could happen here: today the top-face notch
hole contour and the pocket wall's top ring are the exact same `rim`
object (`socketTrayGeometry.ts:229`/`:233`/`:259`,
`mountedSocketTrayGeometry.ts:475`/`:479`/`:588`). Introducing a rounded rim
means the notch's "true opening" contour and the wall's outermost ring are
no longer necessarily the same ring — if the new construction doesn't
re-derive both from the SAME point objects the way this file already does
today (the exact-stitch contract), or gets the arc's start/end tangent
points slightly wrong, the top-face triangulation could end up spanning
across what should be open pocket bore, sealing it — with every existing
mesh-level check still green.

**What would need re-verifying, concretely:**

- Both trays' existing per-pocket raycast tests (`tests/unit/socketTrayGeometry.test.ts`,
  `tests/unit/mountedSocketTrayGeometry.test.ts`) raycast at the pocket's
  exact center and at one or more fixed off-center offsets, asserting
  "open from the top face down to the floor, solid below the floor." With
  a rounded/chamfered rim, the pocket's open bore is narrower than the
  nominal diameter over the height of the fillet/chamfer band (the fillet
  material itself occupies an annulus near the top that isn't there today)
  — so an off-center sample point that used to be safely inside the open
  bore at every height could now land inside the new fillet material near
  the top face specifically, and the raycast sample coordinates would need
  to be re-derived against the new, height-varying open diameter, not
  reused as-is.
- Per KNOWN-FIXES.md ("raycast the exported STL, don't trust mesh checks
  alone"), these raycasts must be re-run against the freshly exported STL,
  not only the in-memory geometry — both trays' existing reports show this
  was already done once (mounted tray step 9, flat tray's registration test
  step 9) and would need repeating.
- The EPS-tolerance lesson is directly relevant to whatever new
  cap-membership or notch-splice logic a rim rounding implementation adds:
  both modules ultimately call `Float32BufferAttribute` on their finished
  position array (`socketTrayGeometry.ts:292`,
  `mountedSocketTrayGeometry.ts:618`), the exact float32-backed case
  CLAUDE-LESSONS.md flags as landing vertices ~1.8e-6 off an exact target
  plane — any new equality-based plane/ring test in a rounding
  implementation should use `1e-4`, not a tighter epsilon, per that lesson.
- The mounted tray's existing "material continuous across the junction" and
  "inner-corner" tests (`tests/unit/mountedSocketTrayGeometry.test.ts`,
  per `reference/reports/mounted-socket-tray-build.md` step 5) are
  unrelated to the pockets but would also need re-running if the outer-edge
  rounding work (step 3b) touches the shared `outline` array at all.

## Step 5 — fixed constant or user-facing parameter? (precedent, not a choice)

**Precedent exists for BOTH**, so this codebase does not have one settled
convention:

- **User-facing radius field exists today:** Multiconnect's "Peg Fillet"
  row — `{ label: "Peg Fillet", value: normalizeMulticonnectPegFilletRadius(shape.multiconnectPegFillet
  ?? DEFAULT_MULTICONNECT_PEG_FILLET_RADIUS), min: 0, max: 5, step: 0.1, ... }`
  (`ShapeInspector.tsx:406`), backed by `multiconnectPegFillet?: number` on
  `WorkplaneShape` (`types/sketchforge.ts:287`) and
  `DEFAULT_MULTICONNECT_PEG_FILLET_RADIUS = 2` /
  `normalizeMulticonnectPegFilletRadius` (clamped 0–5) in the geometry
  module (`multiconnectContainerGeometry.ts:123`, `:408-411`). The
  Multiconnect plate's "Corner Radius" (`ShapeInspector.tsx:396`, min 0,
  max `maxCornerRadius`, step 0.5) is a second such precedent. Text/Tube/
  Ring's "Bevel" field (0–8, `ShapeInspector.tsx:486`, `:593`) is a third,
  though it drives THREE.js's built-in `ExtrudeGeometry` bevel rather than
  a hand-rolled boundary-rep fillet — a different mechanism, same
  "user-typed size" pattern.
- **Hardcoded, non-exposed constant also exists today:** OpenGrid Board's
  chamfer geometry — only the MODE (`everywhere`/`corners`/`none`) is a
  user-facing select (`ShapeInspector.tsx:290`); the chamfer's actual size
  (`CHAMFER_INSET = 4.2`, `CORNER_PROFILE_CHAMFER`, etc.,
  `openGridGeometry.ts:20`, `:290-292`) has no inspector row at all and
  cannot be changed by the user. OpenConnect Container's corner-rounding
  size (`cornerSize = clamp(wallThickness * 2, 3, 10)`,
  `openConnectContainerGeometry.ts:712`) is a middle case: not a bare
  literal, but **derived** from another field rather than directly typed —
  only the style (`None`/`Chamfer`/`Fillet`) is user-facing.

No single answer is forced by precedent; both patterns are in active,
validated use in this codebase today.

## Step 6 — file list for a build (additive-only convention, and where it does/doesn't apply)

**This recon's own do-not-touch list names `socketTrayGeometry.ts` and
`mountedSocketTrayGeometry.ts` only for THIS recon pass**, per the brief;
they are explicitly not protected for a build task.

**Does adding rounding require editing the two geometry modules themselves?
Yes, for the actual triangle emission — this is different from the
additive-only precedent the owner has used twice already.** Both prior
socket-tray phases (registering the flat tray's UI, building the mounted
tray) were "add a new sibling thing that imports from an existing module,
never editing it" (`reference/DECISIONS.md`: "Socket geometry is
additive-only... zero edits to `multiconnectContainerGeometry.ts`"; "The
mounted tray is a separate shape and module... imports from
`socketTrayGeometry.ts` and `multiconnectContainerGeometry.ts` but edits
neither"). Rounding a tray's OWN outer edges and OWN pocket rims is not
that shape of change — it is a modification to what each module's own
`positions()` function emits for faces that module already owns. There is
no way to add rim/edge rounding to the Socket Tray's pockets without the
Socket Tray's own top-face/pocket-wall code changing, and likewise for the
Mounted Socket Tray.

**What COULD be factored into a shared file, mirroring precedent:** the
generic pieces of the technique (a reusable "profile with an inserted arc
band, revolved or swept" helper) could live in a new shared sibling file,
the same way `pushTriangle`/`triangleNormal`/`pushCap` are today
independently reimplemented in both `socketTrayGeometry.ts` and
`mountedSocketTrayGeometry.ts` rather than centralized — except a NEW
shared helper file would be a departure from that existing "reimplement,
don't share" convention (recorded in `reference/socket-tray-recon.md` §3:
"the boundary-rep technique is a pattern to imitate, not a library to
import... there is no shared cut-pocket library today"), not a violation of
any rule, just not what has been done twice already. Either way, the
call sites that decide WHICH rings/bands to emit for a given tray's own
faces still live inside `socketTrayGeometry.ts` /
`mountedSocketTrayGeometry.ts` themselves and would need edits there.

**UI/inspector files — needed only if the radius becomes a user-facing
field (step 5's open choice):**

| File | Needed only if radius is user-adjustable |
|---|---|
| `apps/web/src/types/sketchforge.ts` | new optional field(s) on `WorkplaneShape` |
| `apps/web/src/lib/shapeCatalog.ts` | default value(s), shape→options mapping update |
| `apps/web/src/components/workplane/ShapeInspector.tsx` | new `RangeProperty` row(s), unit-label list update |
| `apps/web/src/components/WorkplaneViewport.tsx` | new field(s) in the geometry cache signature |
| `apps/web/src/components/SketchForgeEditor.tsx` | none beyond what the mapping helper already routes through |
| `apps/web/src/lib/workplaneShapes.ts` | new equality comparison(s) |
| `apps/web/src/lib/skfProject.ts` | none — no new `ShapeKind`, existing kinds gain fields, generic spread already round-trips them |

If the owner instead wants a fixed hardcoded constant, **none** of the
seven files above need touching — only the two geometry modules (or a
shared helper plus the two geometry modules) change, plus each shape's own
existing test file (`tests/unit/socketTrayGeometry.test.ts`,
`tests/unit/mountedSocketTrayGeometry.test.ts`, and both
`*ShapeRegistration.test.ts` files, all of which pin exact vertex/bbox/
raycast numbers that a mesh change invalidates regardless of the
constant-vs-parameter choice).

## Step 7 — byte-identity / coupon reprint risk

**Confirmed and understood: rounding either tray's edges changes the mesh
by definition** (different vertex positions at every affected face,
different vertex/triangle counts wherever new bands are inserted), so
neither existing coupon STL would match a freshly generated export:

- `test-prints/socket-tray-sampler.stl` (the flat, 6-pocket sampler,
  currently 1,548 triangles per `reference/socket-tray-sampler-report.md`)
  would need a fresh coupon print and hand-verification, per
  CLAUDE.md's print-gated-phases process — **not** a byte/triangle-count
  comparison against the currently committed file, which is the pre-
  rounding shape.
- `test-prints/mounted-socket-tray-coupon.stl` (currently 3,524 triangles
  per `reference/reports/mounted-socket-tray-build.md`) needs the same
  treatment.
- Both coupons are already flagged **unprinted** in
  `reference/SESSION-STATE.md`'s "Physical gate — both coupons are
  unprinted" section, so this recon is not proposing to invalidate any
  physical validation that has actually happened yet — but it does mean
  any rounding work is itself a shape change requiring its own fresh print,
  compounding rather than replacing the two prints already pending.

**Wrench rack STLs are unaffected — confirmed.** `wrench-rack-metric-{1,2,3}.stl`
and `wrench-rack-sae-{1,2,3}.stl` are generated from
`multiconnectContainerGeometry.ts` via the presets in
`multiconnectPresets.ts`, a different shape entirely (Multiconnect
PegPlate) from either Socket Tray. Neither this recon's scope, the brief,
nor anything found in steps 2–6 proposes touching
`multiconnectContainerGeometry.ts`'s own emitted geometry (the Mounted
Socket Tray's existing imports from it, per step 6 of
`reference/reports/mounted-socket-tray-build.md`, are read-only constants:
`MULTICONNECT_BACK_THICKNESS`, `MULTICONNECT_SLOT_TOP_OFFSET`, plate/
spacing/tolerance bounds — none of which a rounding pass on the tray's own
edges would need to change). `reference/reports/mounted-socket-tray-build.md`
step 10 already confirmed all six wrench-rack STLs byte-identical after
building the mounted tray; the same would hold after a rounding pass that
stays within the two socket-tray modules.

## Step 8 — unknowns a build prompt would have to specify

These cannot be resolved from the code as it stands today:

1. **Fillet vs. chamfer** (owner's call, per the brief — not decided here).
   No default to infer: the codebase has fillet-only (peg), chamfer-only
   (OpenGrid Board), and both-as-a-choice (OpenConnect Container)
   precedents, so there is no single house style.
2. **The radius/distance value(s)**, and whether the outer edges and the
   pocket rims use the same value or two independent ones.
3. **Fixed constant vs. user-facing parameter** (step 5) — real precedent
   for both exists; nothing forces one.
4. **Whether the Mounted Socket Tray's L-junction inner corner (outline
   point E, step 3b) is in scope for "outer edges."** The brief's wording
   ("top/side/end edges of the plate and tray body") does not clearly
   include or exclude this specific internal transition, and it is
   structurally the hardest of the three edge classes identified in step 3
   because it is the one point every face in that module reads from.
5. **Which outer edges, specifically.** A box has 12 edges; the brief says
   "outer edges... top/side/end edges," which likely means the 4 top-face
   perimeter edges and possibly the 4 bottom-face perimeter edges and/or
   the 4 vertical corners, but this recon found zero precedent anywhere in
   the codebase for a fully-rounded-box treatment to default to — every
   existing "rounding" feature here (2b/2c/2d) only ever touches vertical
   footprint corners, never a horizontal top/bottom perimeter edge, so
   there is no established convention to fall back on for exactly which
   edges "outer edges" means.
6. **Arc/tessellation segment count for any new bands**, if a fillet is
   chosen over a chamfer — the closest precedent
   (`MULTICONNECT_PEG_FILLET_SEGMENTS = 6`) is a hardcoded constant with no
   stated derivation beyond "looks smooth enough," not a value obviously
   right for a much larger radius on a box edge.
7. **Interaction with print orientation.** Both coupons already have
   unresolved/unconsulted print-orientation open items
   (`reference/OPEN-ITEMS.md`: "Mounted tray print orientation undecided").
   A rounded pocket rim or box edge changes the local overhang geometry
   right at that feature; this recon does not analyze or recommend
   anything about orientation, per its explicit scope, but a build prompt
   may want to revisit orientation once the rounded shape exists.

## Credential scan

Every command output pasted in this report, and every file read during this
recon, was scanned for `ghp_`, `ghs_`, `token`, `secret`, `password`: no
hits. The report contains no credentials.

## SCOPE CHECK

```
$ git status --short          (after writing this report, before commit)
?? reference/reports/socket-tray-rounding-recon.md
```

**Files created:** `reference/reports/socket-tray-rounding-recon.md` (this
file). **Files modified: none.**

| Path | Action |
|---|---|
| `CLAUDE.md`, `CLAUDE-LESSONS.md` | read only |
| `reference/SESSION-STATE.md`, `OPEN-ITEMS.md`, `DECISIONS.md`, `KNOWN-FIXES.md` | read only |
| `reference/socket-tray-recon.md`, `socket-tray-sampler-report.md` | read only |
| `reference/reports/socket-tray-ui-recon.md`, `socket-tray-ui-build.md`, `socket-tray-mounted-recon.md`, `mounted-socket-tray-build.md` | read only |
| `apps/web/src/lib/socketTrayGeometry.ts` | read only (full, do-not-touch honored) |
| `apps/web/src/lib/mountedSocketTrayGeometry.ts` | read only (full, do-not-touch honored) |
| `apps/web/src/lib/multiconnectContainerGeometry.ts` | read only (peg fillet, corner rounding, slot regions) |
| `apps/web/src/lib/openConnectContainerGeometry.ts` | read only (corner rounding region, `:534-573`) |
| `apps/web/src/lib/openGridGeometry.ts` | read only (chamfer region) |
| `apps/web/src/lib/gearGeometry.ts`, `svgImport.ts`, `stepExport.ts`, `workplaneShapes.ts`, `projectAssets.ts`, `gridSnap.ts`, `placementWorkplane.ts`, `svgExport.ts`, `openGridSnapGeometry.ts`, `openGridSnapMesh.ts`, `multiconnectSlotMesh.ts`, `workplaneGrid.ts`, `workplaneSettings.ts`, `stlExport.ts` | read only (grep hits only, ruled out as noise or unrelated) |
| `apps/web/src/lib/cadModifierTypes.ts` | read only (full) |
| `apps/web/src/workers/cadModifier.worker.ts` | read only (`reconstructParts`/`reconstructSolid` regions, `:175-260`, `:390-490`) |
| `apps/web/src/components/workplane/EdgeModifierPanel.tsx` | read only (grep hits) |
| `apps/web/src/components/workplane/ShapeInspector.tsx` | read only (`:173`, `:359`, `:369-410`, `:486`, `:593`) |
| `apps/web/src/components/SketchForgeEditor.tsx` | read only (`canEdgeModify` region `:9018`, `:9633-9646`, grep hits) |
| `apps/web/src/components/WorkplaneViewport.tsx`, `types/sketchforge.ts`, `skfProject.ts` | read only (grep hits) |
| `apps/web/src/components/official/ChallengesDashboard.tsx`, `workplane/NameplateTutorialPanel.tsx`, `workplane/KeyTagTutorialPanel.tsx`, `icons.tsx`, `SketchWorkspace.tsx` | read only (grep hits, confirmed unrelated UI/tutorial copy) |
| `apps/web/src/lib/multiconnectContainerGeometry.ts`, `socketTrayGeometry.ts` | **not edited** — do-not-touch honored |
| `test-prints/` (all files) | **not touched, not opened** — do-not-touch honored |
| `deploy/docker/`, `.github/workflows/`, `package.json`, `package-lock.json`, any config file | **not touched, not opened** — do-not-touch honored |
| every existing `reference/` file | **not modified** — do-not-touch honored |

No code, test, STL, config, or existing-doc change. Nothing was built,
prototyped, stubbed, or scaffolded. No fillet/chamfer/radius choice was
made.

## Closing summary (plain English)

**Is there an existing rounding technique to copy?** Partially. The
Multiconnect peg fillet (a revolved profile with an inserted quarter-arc
band, hand-rolled, no CSG) is a close technical match for rounding a
pocket's rim — it's the convex version of the same problem, and the
construction pattern transfers directly. Nothing in the codebase does a
horizontal top/side/end box-edge fillet or chamfer anywhere — every other
"rounding" feature here (OpenGrid Board's corner chamfer, the Multiconnect
plate's corner radius, OpenConnect Container's corner rounding) only ever
rounds a VERTICAL footprint corner, and one of those files says outright it
was scoped that way specifically to avoid "reworking every wall piece into
an outline-extrusion." So pocket-rim rounding has a real template to copy;
outer-edge rounding does not.

**Can rounding be added without CSG for both shapes?** Yes for both, and
for both feature types (pocket rims and outer edges) — everything found
supports doing this as additional boundary-rep triangles (extra profile
points / extra bands), consistent with this codebase's standing decision
against runtime CSG for anything that reaches a surface. The Mounted Socket
Tray's L-shaped junction is the one spot that's structurally different from
"just another edge" — it's the single shared array every face in that
module reads from — and whether it's even in scope wasn't settled by the
brief's wording.

**Does pocket-rim rounding risk resealing pockets, and what needs
re-checking?** Yes, materially — it's exactly the failure class
CLAUDE-LESSONS.md's sealed-pocket lesson describes, because a sealed rim
still passes every existing manifold/edge-count check. Every per-pocket
raycast test in both trays would need re-deriving (not just re-running) to
account for the pocket's open bore narrowing near a rounded/chamfered rim,
and per KNOWN-FIXES.md that has to happen against the freshly exported STL,
not only the in-memory mesh.

**Fixed number or owner-typed?** Both patterns exist in this codebase
today with real precedent (Multiconnect's Peg Fillet field is user-typed
0–5mm; OpenGrid Board's chamfer size is a hardcoded, non-exposed constant)
— nothing here settles it one way.

**Coupon reprinting and the wrench racks:** confirmed — rounding either
tray changes its mesh by definition, so both coupons (already unprinted)
would need fresh prints, not a comparison against the currently committed
STLs. The wrench rack STLs come from a completely different shape/module
(`multiconnectContainerGeometry.ts` via presets) and are unaffected by
anything a socket-tray rounding pass would touch.

**Three things I'm least certain about:**

1. Whether the owner's "top/side/end edges" phrase is meant to include the
   Mounted Socket Tray's internal L-junction — the hardest of the three
   edge classes found, and not obviously covered by that wording either
   way.
2. Whether a genuinely swept-fillet box-edge construction (needed for the
   outer edges, since nothing in this codebase already does one) is as
   low-risk as the pocket-rim case, which has a direct worked precedent —
   I could not find anything to benchmark its difficulty against.
3. Whether the existing runtime OCCT Fillet/Chamfer tool (step 2e) — which
   already works on these shapes today with zero code change, through an
   STL-import-and-heal path — is robust enough on this specific geometry
   (thin 2–4mm floors, pockets as close as 12mm apart) to be a real
   alternative to hand-building the rounding into the primitives, or
   whether it would choke on exactly the thin/tight features these trays
   are designed around. Nothing in this recon exercised that tool against
   either shape.
