# Session State

Where things stand right now.

## Multiconnect system — complete and physically validated

- Plate/PegPlate generator: `multiconnectContainerGeometry.ts`.
- Slot terminator (baked mesh) includes a dimple and quick-release cut.
- Pegs are specified in as-mounted view space (see DECISIONS.md).
- 5° shear tilt on the slot cut.
- `plateThickness` minimum is 6.5mm.
- Default OpenGrid spacing is 28mm.

## Socket Tray — built and registered, coupon unprinted (physical gate pending)

- Module: `apps/web/src/lib/socketTrayGeometry.ts` — new sibling primitive,
  additive only; `multiconnectContainerGeometry.ts` was not edited.
  Boundary-rep only, no CSG, no baked mesh (a round pocket's rim is a plain
  parametrized circle).
- Tests: `tests/unit/socketTrayGeometry.test.ts` — 36 tests (manifold check,
  exact directed-edge check, bounding box, validation guards, per-pocket
  raycasts asserting open top-to-floor and solid floor-to-bottom, a
  between-pockets solid check, and a dedicated tightest-gap check). This
  line read 17 until 2026-09-26: 17 was the count at the sampler build, and
  the Corner Radius pass (`4be03de`) added a 19-test describe block without
  this line being updated. Re-counted test by test from the runner's own
  per-file report on 2026-09-26.
- Generator: `scripts/generate-socket-tray-sampler.mjs`
  (`node --experimental-strip-types scripts/generate-socket-tray-sampler.mjs`).
- Coupon: `test-prints/socket-tray-sampler.stl` — 240 × 60 × 18mm
  (width × depth × thickness), ASCII STL, 1,548 triangles. Six round blind
  pockets, 14mm deep over a 4mm floor, 36mm pitch, 30mm end margins, all
  centered at z=30. Diameters left to right: 14, 15, 19, 20.70, 23, 25mm
  (measured socket OD + 2mm clearance). Confirmed mapping: 14mm→5,6;
  15mm→7,8,9; 19mm→10,11,12; 20.70mm→13; 23mm→14; 25mm→15,16 — all 12
  standard sockets 5–16mm across 6 pockets.
- Bed fit: 240mm leaves 16mm spare under the X1C's 256mm bed. Six pockets
  at the earlier 45mm pitch would have needed 285mm; the owner approved the
  36mm pitch instead.
- No back plate on THIS coupon: it is deliberately a standalone block, the
  flat test piece. The wall-mounted version is a separate shape and module —
  see the Mounted Socket Tray section below — and its back is a Multiconnect
  slotted plate, not the OpenGrid Snap the earlier plan assumed (see
  DECISIONS.md).
- Registered in the editor (`fe3e829`): a catalog entry in the OpenGrid
  section of the insert menu, and an inspector with Width / Depth /
  Thickness / Pocket Depth rows plus a per-pocket Diameter / X / Z list
  (add / remove, inline module error). Follows the Multiconnect
  registration pattern across the same eight files; neither geometry
  module was edited. Owner-tested in the dev app and approved.
- The default insert is the six-pocket coupon; exported through the real
  STL writer it reproduces `test-prints/socket-tray-sampler.stl` triangle
  for triangle (1,548 facets, identical bounding box, every vertex within
  7.4e-6mm on the float32 path; only the solid name differs).
- Registration tests: `tests/unit/socketTrayShapeRegistration.test.ts` —
  8 tests (catalog entry, default insert, shape → options mapping, `.skf`
  round-trip, geometry identity with the module, export reproduces the
  coupon, invalid layouts give the friendly messages).
- **Corner Radius rounding added (`4be03de`):** an owner-typed Corner
  Radius field (default 0) rounds the tray's own outer top edges (the
  full top perimeter) and every pocket rim, using a mitered quarter-arc
  technique matching the Multiconnect peg fillet (extra profile points
  inserted along a quarter-circle arc; no CSG). Radius 0 is byte-identical
  to the prior unrounded output, verified by a byte-for-byte diff against
  the committed `test-prints/socket-tray-sampler.stl`. A new demo export,
  `test-prints/socket-tray-sampler-rounded-demo.stl` (cornerRadius 3mm),
  was added alongside the original coupon as a NEW file, not a replacement.
  Full detail: `reference/reports/socket-tray-rounding-recon.md`,
  `reference/reports/socket-tray-rounding-build.md`.
- Status: unvalidated — the coupon has not been printed.
- **Physical gate: print the 6-pocket coupon on the X1C and test all 12
  sockets (5–16mm) in it before any production tray is built.**
- Full detail: `reference/socket-tray-recon.md`,
  `reference/socket-tray-sampler-report.md`,
  `reference/reports/socket-tray-ui-recon.md`,
  `reference/reports/socket-tray-ui-build.md`.

## Mounted Socket Tray — active feature, coupon stage (physical gate pending)

The wall-hanging sibling of the flat tray: a Multiconnect slotted back plate
with NO pegs, and a shelf-like tray projecting forward from its bottom
carrying round blind pockets. The flat Socket Tray is unchanged by this work
and remains the test piece.

- Module: `apps/web/src/lib/mountedSocketTrayGeometry.ts` — new sibling
  primitive, additive only. Neither `socketTrayGeometry.ts` nor
  `multiconnectContainerGeometry.ts` was edited; both are imported from.
- ONE solid, boundary representation only — no CSG, no boolean union, no
  concatenated meshes. The plate and the tray are not two bodies joined at a
  seam: together they are a single prism whose cross-section in the (Y, Z)
  plane is an L, extruded along the width. The L outline is built once as one
  six-point array, and both the extruded side faces and the two end caps read
  their corners out of that same array, so the junction vertices are
  bit-identical because they ARE the same doubles. There is no seam to stitch.
- Slot features come from the same baked source the validated wrench racks
  use (`multiconnectSlotMesh.ts`); the pocket guards are the flat tray's own
  exported constants, so "the same rule" is the same constant, not a copy.
- Plate defaults are the validated wrench-rack recipe: 240 × 60mm, 10mm
  thick, 28mm slot spacing, 8 slots at x = 22 … 218.
- Coupon: `test-prints/mounted-socket-tray-coupon.stl` — footprint
  **240 × 70 × 60mm** (240 wide, 70 deep = tray 60 + plate 10, 60 tall),
  ASCII STL, 3,524 triangles. Tray 60mm deep and 18mm thick; three round
  blind pockets 14mm deep over a 4mm floor, diameters **14, 19, 25mm** at
  x = 30 / 120 / 210 on the z = 30 centreline (30mm end margins, 90mm pitch).
  240mm leaves 16mm spare under the X1C's 256mm bed.
- Generator: `scripts/generate-mounted-socket-tray-coupon.mjs`.
- Tests: `tests/unit/mountedSocketTrayGeometry.test.ts` — 57 tests, and
  `tests/unit/mountedSocketTrayShapeRegistration.test.ts` — 13 tests. These
  read 40 and 12 until 2026-09-26 — the counts at the build (`c98cff5`,
  40 + 12 = the 52 recorded there); the Corner Radius pass (`4be03de`) and
  the pocket-X mirror fix (`3f5aba8`) added tests without this line being
  updated. Re-counted test by test on 2026-09-26.
  Coverage includes the exact directed-edge check over the whole mesh, a
  dedicated inner-corner test isolating the plate-to-tray junction line,
  per-pocket raycasts, and a check that the slot channel is unobstructed
  along its full run at all 8 slots.
- Raycast of the EXPORTED STL (not just the in-memory mesh): every pocket
  open from the tray top down to its 4mm floor and solid below it; the
  channel open along its full run at all 8 slots with the blind floor
  intact; 0 boundary and 0 non-manifold edges.
- Registered in the editor (`c98cff5`): a catalog entry in the OpenGrid
  section, and an inspector with Plate Width / Plate Height / Plate Thickness
  / Slot Spacing / Slot Count / Tray Depth / Tray Thickness / Pocket Depth
  rows plus a per-pocket Diameter / X / Z list (add / remove, inline module
  error). Same eight-file registration pattern as the flat tray. Plate width
  maps to the app's X, plate height to its Y-up height, and `shape.depth`
  holds the solid's full Z extent so the selection frame matches the mesh.
  Owner-tested in the dev app and approved.
- **Corner Radius rounding added (`4be03de`):** the same owner-typed Corner
  Radius field (default 0) as the flat tray, rounding the plate's own
  outer top edge (top-front) and the tray's own outer top edge (top-front),
  plus every pocket rim, via the same mitered quarter-arc technique matching
  the Multiconnect peg fillet — no CSG. **The plate-to-tray L-junction is
  deliberately excluded from rounding and stays sharp**, as are the plate's
  bottom edges and the edge where the plate top meets the mounting face.
  Radius 0 is byte-identical to the prior unrounded output, verified by a
  byte-for-byte diff against the committed
  `test-prints/mounted-socket-tray-coupon.stl` (this check caught and led to
  fixing a triangle-emission-order bug in the first draft — see
  KNOWN-FIXES.md). A new demo export,
  `test-prints/mounted-socket-tray-coupon-rounded-demo.stl` (cornerRadius
  3mm), was added alongside the original coupon as a NEW file, not a
  replacement. Full detail: `reference/reports/socket-tray-rounding-recon.md`,
  `reference/reports/socket-tray-rounding-build.md`.
- **Pocket-X mirror fix (2026-09-06):** pocket `x` on the MOUNTED tray is now
  specified in as-mounted view space and mirrored into geometry space at one
  marked spot in `normalizedPockets` (`x_geometry = plateWidth - x_viewed`),
  matching `normalizedPegs`. It had wrongly inherited the flat tray's
  no-mirror rule, so a pocket typed at X = 30 rendered near the RIGHT end of
  the shelf. Found by the owner in the running app; diagnosed across four
  read-only recon passes that first ruled out the pocket math itself, any
  default rotation, and the whole inspector→mesh data path before landing on
  the convention mismatch. Slots needed no change
  (`mountedSocketTraySlotCenters` is mirror-symmetric by construction) and
  pocket z is unaffected. The flat Socket Tray is correct as-is and was not
  touched. See DECISIONS.md's corrected entry and KNOWN-FIXES.md.
- **Both mounted coupon STLs were regenerated with the fix and deliberately
  replace their previous contents** (owner approved; neither had been
  printed, so nothing physical depended on the old bytes).
  `test-prints/mounted-socket-tray-coupon.stl` is 3,524 triangles as before —
  same topology, mirrored pocket positions — and
  `test-prints/mounted-socket-tray-coupon-rounded-demo.stl` is 5,876. As
  mounted and read left to right, the coupon's pockets are now 14 / 19 / 25mm
  at viewed x = 30 / 120 / 210, which is what the defaults always said.
- Status: **unvalidated — the coupon has not been printed.**
- Full detail: `reference/reports/socket-tray-mounted-recon.md`,
  `reference/reports/mounted-socket-tray-build.md`.

## Screwdriver Tray (flat) — built and registered, unprinted

The through-hole sibling of the flat Socket Tray: a screwdriver's shaft passes
all the way through and its handle rests on the top face, so a hole has no
floor and there is no Pocket Depth anywhere in the shape. Built as Pass A of a
two-pass plan; the MOUNTED Screwdriver Tray is a separate later pass and
nothing was built for it. Both Socket Trays are unchanged by this work.

- Module: `apps/web/src/lib/screwdriverTrayGeometry.ts` — new sibling
  primitive, additive only. `socketTrayGeometry.ts` was not edited, only
  imported from (`SOCKET_TRAY_POCKET_EDGE_CLEARANCE`,
  `SOCKET_TRAY_POCKET_GAP`, `SOCKET_TRAY_POCKET_SEGMENTS`,
  `SOCKET_TRAY_FILLET_SEGMENTS`). Boundary-rep only, no CSG, no baked mesh.
- What differs from the flat Socket Tray, and nothing else does: no floor cap
  is emitted at all; the cylindrical wall spans the full tray thickness (top
  face to Y = 0) instead of stopping at a floor plane; and the BOTTOM face is
  an earcut cap notched with one hole per bore, where the socket tray's bottom
  face is a plain uncut rectangle by construction. Both notches and the wall
  reuse the same ring point objects, so both seams are bit-identical (the
  exact-stitch contract) — pinned by an exact directed-edge test.
- Guards: the floor-thickness guard and both pocket-depth guards are gone; the
  socket tray's `cornerRadius >= pocket.depth` check collapses into the
  tray-thickness check that already existed; a new
  `MIN_SCREWDRIVER_TRAY_THICKNESS = 10` guard is added. Edge clearance (5mm)
  and hole gap (4mm) carry over unchanged as the same imported constants.
- Corner Radius: same owner-typed field and same mitered quarter-arc technique
  as both socket trays, rounding the tray's outer top perimeter and every
  hole's TOP rim. **The bottom rim is sharp** and there is no bottom fillet
  code in the module — see DECISIONS.md.
- Tests: `tests/unit/screwdriverTrayGeometry.test.ts` — 50 tests, and
  `tests/unit/screwdriverTrayShapeRegistration.test.ts` — 9 tests. Coverage
  includes the manifold check, the exact directed-edge check, bounding box,
  every validation guard, per-hole raycasts asserting ZERO crossings on a
  bore's axis (open top to bottom, the inverse of the socket tray's
  open-to-floor/solid-below assertion), a between-holes solid-slab check, a
  dedicated tightest-accepted-gap check (two 12mm bores 16.1mm apart, 0.1mm
  above the pairwise minimum, with the 0.1mm-tighter case asserted to throw),
  and a rounded-radius exported-STL raycast that also pins the bottom rim as
  sharp (material reaches Y = 0 at a radius the top rim has already opened).
- **Asymmetric layout test:** a dedicated fixture with no two holes sharing an
  x or a z and none at another's mirror image, plus explicit assertions that
  each hole's image about the width centreline and about its own z is SOLID.
  This exists because the mounted tray's pocket-X mirror bug was invisible to
  every geometry check and to a symmetric layout (KNOWN-FIXES.md).
- Registered in the editor: a catalog entry in the OpenGrid section (colour
  `#db2777`, box-icon stand-in like every other OpenGrid shape), and an
  inspector with Width / Depth / Thickness / Corner Radius rows plus a
  per-hole Diameter / X / Z list (add / remove, inline module error).
  **No Pocket Depth row.** Same eight-file registration pattern both socket
  trays used; neither socket tray's geometry module was edited.
- Default insert: 240 × 60 × 18mm with three through-holes at 8 / 10 / 12mm,
  x = 30 / 120 / 210 on the z = 30 centreline (30mm end margins, 90mm pitch).
  The diameters are **generic placeholders**, not measured shafts — see
  DECISIONS.md.
- Verified hands-on by exporting the default insert through the real STL
  writer (`exportMeshesToStl`) and raycasting the **exported file**, not the
  in-memory mesh: 792 facets, bounding box 0..240 × −60..0 × 0..18 in file
  (Z-up) coordinates. All six bore samples (each hole's axis plus an off-axis
  point at 60% of its radius) returned an EMPTY crossing list — open all the
  way through. All five solid samples (between bores 1–2 and 2–3, 0.5mm
  outside a rim, and in front of / behind the hole row) returned exactly
  `[0.000000, 18.000000]`.
- **No coupon STL and no generator script** — not approved for this pass;
  `test-prints/` was untouched.
- Status: **unvalidated and unprinted**, with no candidate file to print.

## Mounted Screwdriver Tray — built and registered, unprinted

The wall-hanging sibling of the flat Screwdriver Tray, and the through-bore
sibling of the Mounted Socket Tray: a Multiconnect slotted back plate with NO
pegs and a shelf projecting forward from its bottom, carrying round bores that
run all the way through. Built as Pass B of the two-pass screwdriver plan. All
three earlier trays are unchanged by this work.

- Module: `apps/web/src/lib/mountedScrewdriverTrayGeometry.ts` — new sibling
  primitive, additive only. Imports the baked slot data
  (`multiconnectSlotMesh.ts`), the plate constants
  (`multiconnectContainerGeometry.ts`), the hole-layout guards
  (`socketTrayGeometry.ts`) and `MIN_SCREWDRIVER_TRAY_THICKNESS`
  (`screwdriverTrayGeometry.ts`); edits none of them.
- ONE solid, boundary representation only — no CSG, no boolean union, no
  concatenated meshes. Same L-prism construction as the Mounted Socket Tray:
  one six-point outline array, and both the extruded side faces and the two end
  caps read their corners out of it, so the plate-to-tray junction vertices are
  bit-identical because they ARE the same doubles.
- What differs from the Mounted Socket Tray, and nothing else does: no floor
  cap is emitted; the bore wall spans the full tray thickness (shelf top to
  Y = 0); and the bottom face — already one earcut cap carrying a channel-notch
  indentation per slot — now also carries one hole per bore. Bores and channels
  are disjoint in Z by at least 7.35mm under every allowed parameter
  combination.
- **Hole x is mirrored** into geometry space at one marked spot in
  `normalizedHoles` (`x_geometry = plateWidth - x_viewed`), matching
  `normalizedPegs` and the Mounted Socket Tray's `normalizedPockets`. Hole z is
  not. See DECISIONS.md.
- Guards: the floor-thickness guard and the `pocketDepth` guards are gone; the
  `cornerRadius >= pocketDepth` check is covered by the existing
  `cornerFRoom = min(trayDepth, trayThickness)` room check; a 10mm minimum tray
  thickness guard is added, using the flat Screwdriver Tray's own exported
  constant. Edge clearance (5mm), hole gap (4mm), the 6.5mm plate-thickness
  floor, the slot-fit guard and the tray-shorter-than-plate guard all carry
  over unchanged.
- Corner Radius: the plate's own top edge (corner D), the tray's own top edge
  (corner F) and every bore's TOP rim. The L-junction (corner E) stays sharp as
  before, and **every bore's BOTTOM rim is sharp** — no bottom fillet code in
  the module.
- Tests: `tests/unit/mountedScrewdriverTrayGeometry.test.ts` — 59 tests, and
  `tests/unit/mountedScrewdriverTrayShapeRegistration.test.ts` — 13 tests.
  Coverage includes the manifold check, the exact directed-edge check over the
  whole mesh, the dedicated inner-corner test isolating the plate-to-tray
  junction line, bounding box, every validation guard, per-bore raycasts
  asserting ZERO crossings, a between-bores solid-slab check, the
  slot-channel-unobstructed check **re-run on this mesh at all 8 slots and 9
  heights** plus the fused-junction and plate-stands-alone checks, and a
  rounded-radius exported-STL raycast that also pins the bottom rim as sharp.
- **Asymmetric mirror test:** a fixture with no two bores sharing an x or a z
  and none at another's mirror image, asserting each bore's UN-mirrored
  position is SOLID. The default insert cannot prove the mirror on its own —
  viewed 30 / 120 / 210 maps onto the same set in geometry — so the suite also
  pins it by diameter on the default insert.
- Registered in the editor: a catalog entry in the OpenGrid section (colour
  `#7c3aed`), and an inspector with Plate Width / Plate Height / Plate
  Thickness / Slot Spacing / Slot Count / Tray Depth / Tray Thickness / Corner
  Radius rows plus a per-hole Diameter / X / Z list (add / remove, inline
  module error). **No Pocket Depth row.** Same eight-file registration pattern.
- Default insert: the validated wrench-rack plate (240 × 60 × 10mm, 28mm
  spacing, 8 slots at x = 22 … 218) with a 60mm-deep, 18mm-thick shelf and
  three bores at 8 / 10 / 12mm, viewed x = 30 / 120 / 210 on the z = 30
  centreline. The diameters are **generic placeholders**.
- Verified hands-on by exporting the default insert through the real STL writer
  and raycasting the **exported file**: 3,536 facets; 0 boundary and 0
  non-manifold edges on the parsed-back file; all six bore samples returned an
  EMPTY crossing list; five solid samples returned exactly
  `[0.000000, 18.000000]`; all 8 slots read open at the mounting face and solid
  at the blind floor at all 9 sampled heights, with all 7 between-slot
  midpoints solid. The mirror was measured, not asserted: scanning x in 0.05mm
  steps, the bore typed at viewed x = 30 (d = 8) opens from x = 206.05 to
  213.95 — centre 210.00, width 7.90mm — and the bore typed at viewed x = 210
  (d = 12) opens from x = 24.05 to 35.95, centre 30.00, width 11.90mm.
- **No coupon STL and no generator script** — not approved; `test-prints/` was
  untouched.
- Status: **unvalidated and unprinted**, with no candidate file to print.

## Label test piece — printed and passed

Text labels as printable geometry, built and printed before any tray was
built on labels.

- Module: `apps/web/src/lib/labelSlabGeometry.ts` (`742dcb1`) — a plain flat
  slab whose top face carries labels, each raised 0.8mm or recessed 0.8mm.
  Boundary-rep only, no CSG. Not registered in the editor.
- Font: Helvetiker bold, from three's bundled typeface fonts. One uniform
  scale makes the digit set 0–9 exactly 5.00mm tall; individual digits
  measure 4.69mm to 4.99mm. Only the characters `0123456789m` are accepted.
- Tests: `tests/unit/labelSlabGeometry.test.ts` — 49 tests, including the
  exact directed-edge test on every label in both styles and a byte-for-byte
  match between the committed STL and the module. The raycast test was sped
  up in `6f8813f` after it timed out in CI on `742dcb1` and `e40575f`.
- Generator: `scripts/generate-label-test-piece.mjs`.
- File: `test-prints/label-test-piece.stl` — 87.44 × 51 × 3mm (3.8mm over
  the raised labels), 24 labels ("5mm" to "16mm", each raised and recessed),
  40,864 triangles.
- Status: **printed 2026-09-27 and passed** — the owner reported "they all
  good" (DECISIONS.md).

## Gridfinity foot test piece — printed and passed

The Gridfinity foot as printable geometry, built and printed before the
Gridfinity Socket Tray was built on it.

- Module: `apps/web/src/lib/gridfinityFootGeometry.ts` (`b1cbb5f`) — an
  N × M grid of feet on a 42mm pitch under a plain flat plate. Boundary-rep,
  one solid, no CSG and no earcut. Not registered in the editor on its own.
- Every foot dimension was measured from the owner's reference Gridfinity
  STL: 35.6mm square at the bed, 37.2mm at 0.8mm and 2.6mm, 41.5mm at
  4.75mm, with plan corner radii 0.8 / 1.6 / 1.6 / 3.75mm.
- Tests: `tests/unit/gridfinityFootGeometry.test.ts` — 39 tests, including a
  byte-for-byte match between the committed STL and the module.
- Generator: `scripts/generate-gridfinity-foot-test-piece.mjs`.
- File: `test-prints/gridfinity-foot-test-piece.stl` — 2 × 1 squares, two
  feet joined by a 3mm plate, 83.5 × 41.5 × 7.75mm, 1,250 triangles.
- Status: **printed 2026-09-27 and passed** — the owner checked it in his
  Gridfinity baseplate and reported "looks good" (DECISIONS.md).

## Gridfinity Socket Tray — built, registered, deployed and printed

The fifth tray shape: a Gridfinity-footed tray sized in whole squares, with
round blind holes and a text label in front of each hole. The other four
trays are unchanged by this work.

- Module: `apps/web/src/lib/gridfinitySocketTrayGeometry.ts` (`586033e`) —
  new, additive. It imports from `gridfinityFootGeometry.ts`,
  `labelSlabGeometry.ts` and `socketTrayGeometry.ts` and edits none of them.
  Boundary-rep, one solid, no CSG.
- Size: 42N − 0.5 by 42M − 0.5mm, at most 6 squares per axis (the 256mm
  bed). The top face is 22.75mm above the bed: 4.75mm feet, a 4mm floor and
  14mm holes. Body height and hole depth are fixed. Raised labels add 0.8mm.
- Holes: owner-typed diameter, X from the left edge and Z from the edge
  nearest the viewer, which is geometry Z = depth; Z is turned into geometry
  space at one marked spot (`normalizedHoles`). No auto-layout.
- Labels: text typed per hole (`0123456789m` only, blank for none),
  Helvetiker bold, centred on the hole, 3mm in front of its rim. One
  raised / recessed setting for the whole tray, default raised.
- Corner Radius: owner-typed, on every hole's top edge and the top
  perimeter; it must stay below 3.75mm.
- Guards, thrown and shown inline, nothing moved: 4mm to the tray edge and
  3mm between holes, for holes and labels alike.
- Tests: `tests/unit/gridfinitySocketTrayGeometry.test.ts` — 64 tests, and
  `tests/unit/gridfinitySocketTrayShapeRegistration.test.ts` — 12 tests. The
  registration test pins the four earlier trays' catalog entries and default
  inserts to the values captured on `b1cbb5f`.
- Registered in the editor as "Gridfinity Socket Tray" in its own Gridfinity
  section (colour `#0d9488`), with inspector rows for Squares Wide, Squares
  Deep, Corner Radius and Labels, a per-hole Diameter / X / Z / Label list,
  and Add Hole.
- Default insert: 3 × 2 squares, 125.5 × 83.5 × 23.55mm overall, Corner
  Radius 0, raised labels, three holes of 15 / 19 / 19mm at X = 20.75 /
  62.75 / 104.75 and Z = 41.75, labelled "8mm" / "10mm" / "12mm".
- Exported from the running dev app on 2026-09-27, the default insert was
  9,776 facets with 0 boundary and 0 non-manifold edges.
- **No coupon STL and no generator script** — not in scope; `test-prints/`
  was untouched, and the file the owner printed is not in the repo.
- Status: **deployed to Unraid and printed 2026-09-27** — the owner checked
  it in the dev app ("looks good"), deployed it and checked it in production
  ("all good updated and checked"), then printed the default insert and
  reported "it prints and works" (DECISIONS.md,
  `reference/reports/gridfinity-socket-tray-deploy-2026-09-27.md`).

## Viewport mouse controls — changed, passed by the owner and deployed

The 3D viewport's mouse movement was changed on 2026-09-28 to follow Bambu
Studio's (DECISIONS.md, owner's answers 1a and 2a). The change is
`bf755c5`; `d5c8af0` corrects one line of its build report.

- What changed, for the mouse:
  - Left-drag starting on empty space spins the view and leaves the
    selection unchanged. It used to draw a selection box.
  - Right-drag slides the view. It used to spin it.
  - The selection box is Shift + left-drag starting on empty space, and
    adds to the selection as before. Plain left-drag no longer draws one.
  - Only a direct hit on a part selects or grabs it. A press near a part's
    centre used to count as the part.
  - Align and Mirror: left-drag on empty space spins. Align's click on a
    selected part still sets the anchor.
- What did not change: middle-drag slide; wheel zoom toward the pointer;
  F / Home, O, +, - and the arrow keys; left-drag on a part; Shift + click
  on a part; the handles and their Shift / Alt behaviour; Ctrl / Cmd +
  left-drag, which spins; a left-click on empty space clearing the
  selection; Chamfer / Fillet, Ruler and Place-workplane; the 2D sketch
  view; touch input; the suppressed right-click menu.
- One side effect of the right button moving: Shift / Ctrl / Cmd +
  right-drag now spins, where it used to slide. OrbitControls swaps a
  button's action while one of those keys is held.
- Files: `apps/web/src/components/WorkplaneViewport.tsx` is the only code
  file changed. No test, geometry module, stylesheet or file in
  `test-prints/` was touched.
- Checked live in headless Chrome 154 against the dev server, with input
  sent through Chrome's own input pipeline, before and after the change;
  no physical mouse was used. 739 tests pass across 58 files and typecheck
  is clean.
- Status: **passed by the owner, 2026-09-28**, after his hands-on test on
  his Mac; his words: "bank it" (DECISIONS.md). This line read "awaiting
  the owner's hands-on test" until then. For the test a dev server was left
  running on the dev box on port 3000, started with
  `SKETCHFORGE_ALLOWED_DEV_ORIGINS=192.168.1.245 npm run dev`; without that
  setting the dev server refuses the app's scripts to a browser on another
  machine. The owner opened `http://192.168.1.245:3000`.
- Commits: `bf755c5` (the change, the notebook entries and the build
  report) and `d5c8af0` (the build report's line on the F key, corrected).
- **Deployed to Unraid 2026-09-28** and checked by the owner in
  production: "all good". The owner force-updated the `1.3.3` container to
  the `0fc0b75` build. This line read "Not deployed" until then. The dev
  server left running for the hands-on test was stopped the same day.
- Full detail: `reference/reports/viewport-mouse-controls-recon.md`,
  `reference/reports/viewport-mouse-controls-build.md`,
  `reference/reports/viewport-mouse-controls-deploy-2026-09-28.md`.

## Physical gate — both coupons are unprinted

Neither `test-prints/socket-tray-sampler.stl` (flat, 6 pockets) nor
`test-prints/mounted-socket-tray-coupon.stl` (mounted, 3 pockets) has been
printed. **No production tray is built until both are printed and
hand-verified.** The mounted coupon was regenerated on 2026-09-06 to carry
the pocket-X mirror fix, so its bytes deliberately differ from the
originally committed file; the flat sampler is unchanged and still holds its
byte-identical regression check. Both files stay frozen at Corner Radius 0
(sharp);
rounding changes the mesh, so any future production or demo print at a
chosen Corner Radius is a NEW coupon printed and hand-verified on its own
terms, never a comparison against these frozen zero-radius files.

**2026-09-27:** the Gridfinity Socket Tray, a separate fifth shape, was
built, deployed and printed by the owner while both coupons were still
unprinted. Both coupons remain unprinted.

## Recent shipped work (all pushed to origin/main)

- Paste keeps a shape's own fields (`877951f`, 2026-09-29): a pasted Gridfinity Socket Tray, and every other OpenGrid, Multiconnect and tray shape, had come out bare because paste dropped every field `sceneShape` does not keep; see `reference/KNOWN-FIXES.md`. **Deployed to Unraid 2026-09-29** in the `d80e102` build, at the one-time switch of the container's tag from `1.3.3` to `1.3.4`, and checked by the owner in production: "all good copy paste all the same" (`reference/reports/paste-fix-deploy-2026-09-29.md`). This line read "Not deployed" until then.
- Viewport mouse controls deployed to Unraid on 2026-09-28: the owner
  force-updated the `1.3.3` container to the `0fc0b75` build and checked
  the controls in production: "all good"
  (`reference/reports/viewport-mouse-controls-deploy-2026-09-28.md`).
- **Released as `1.3.4`** (`c9a4c6d`, 2026-09-28): built and published, not
  deployed. **Note, 2026-09-29:** the container was switched to the `1.3.4`
  tag on 2026-09-29 and runs the `d80e102` build under it; the `c9a4c6d`
  build itself was never deployed.
- Viewport mouse controls changed to follow Bambu Studio's movement
  (`bf755c5`, with `d5c8af0` correcting one line of the build report), and
  passed by the owner on his Mac (`0fc0b75`), all on 2026-09-28. Recon
  first, in `020c8f0`.
- Gridfinity Socket Tray, the fifth tray shape: built and registered
  (`586033e`), deployed to Unraid (`9afa443`,
  `reference/reports/gridfinity-socket-tray-deploy-2026-09-27.md`) and
  printed by the owner (`0803ac0`), all on 2026-09-27.
- Gridfinity foot test piece: module, 39 tests, generator and STL
  (`b1cbb5f`); printed and passed 2026-09-27.
- Label test piece: module, 49 tests, generator and STL (`742dcb1`), with
  the CI timeout fixed in `6f8813f`; printed and passed 2026-09-27
  (`6765ec8`).
- Read-only recon for the Gridfinity labeled socket tray (`ea3c88f`,
  `reference/reports/gridfinity-labeled-tray-recon.md`), which preceded the
  three entries above.
- Read-only recon of where projects are actually written (`b0db792`,
  `reference/reports/projects-storage-recon.md`): local projects live only in
  the browser; the mapped `/data/projects` volume is written only by Export →
  SKF → Save to shared.
- **Released as `1.3.3`, built, pushed and deployed to Unraid (supersedes
  `1.3.1`).** **Note, 2026-09-29:** superseded as the deployed tag by
  `1.3.4` on 2026-09-29 (Production deployment, below). `9e926bf` makes
  the project-thumbnail origin guard derive host and port from the `Host`
  header instead of `request.url`, and bumps the version. Verified live on a standalone production build run the way the
  container runs it (`HOSTNAME=0.0.0.0`): POST / GET / DELETE with
  `Host: 192.168.1.250:3001` all returned 200 and the PNG came back
  byte-identical. **Confirmed working on the deployed `1.3.3` container by
  owner observation (2026-09-26):** the owner has seen thumbnails on the
  project cards. That confirmation is by sight in the running app, not by
  inspecting the image or the container's filesystem — but a thumbnail can
  only be served back if the container's `node` user created
  `.codex/project-thumbnails` and wrote the PNG, so it closes that
  previously unconfirmed point too. See DECISIONS.md for the guard and its
  tradeoff.
- **`1.3.2` was built and pushed (`6ae02f7`) but never deployed**, because
  it was a no-op on Unraid: it widened the guard to private-LAN IPv4 but
  still tested `new URL(request.url)`, whose hostname in the container is
  always the bind address `0.0.0.0`, and whose port (3000) could never match
  the published port (3001). Its own commit message recorded that limit.
- Read-only recon of the project snapshot thumbnails (`b4541de`,
  `reference/reports/snapshot-recon.md`), which found the 403 that `1.3.3`
  fixes.
- Mounted Screwdriver Tray added: new geometry module, 72 tests across two new
  files, and editor registration across the same eight files. One L-prism
  solid, slotted plate plus a bored forward shelf; through-bores instead of
  blind pockets, with the bottom face now carrying both bore holes and slot
  notches on one earcut cap. Hole x mirrored into geometry space at one marked
  spot. Pocket Depth removed entirely; 10mm minimum tray thickness; bottom rim
  sharp. All three earlier trays byte-identical and asserted so by a
  registration test; no coupon STL or generator script.
- Flat Screwdriver Tray added: new geometry module, 59 tests across two new
  files, and editor registration across the same eight files the socket trays
  used. Through-holes instead of blind pockets — no floor cap, wall spans the
  full thickness, bottom face notched with the same holes as the top. Pocket
  Depth removed entirely from the shape; new 10mm minimum thickness guard;
  bottom rim sharp. Both Socket Trays untouched and asserted so by a
  registration test; no coupon STL or generator script.
- **Released as `1.3.1` and deployed to Unraid at the time (superseded by
  `1.3.3` above).** The release ships the two new
  Screwdriver Tray shapes — the flat tray (`7b86e6d`) and the mounted tray
  (`80df302`) — plus the version bump (`2c35f4c`); GitHub Actions built and
  published the image on the push, and the owner pulled it and verified it
  working in the browser. The container had again gone missing from the
  Unraid Docker tab during this update and was recreated by hand from the
  recorded settings; no project data was lost.
- **Released as `1.3.0` and deployed to Unraid at the time (superseded by
  `1.3.1` above).** The release carries the Mounted Socket Tray pocket-X
  mirror fix (`3f5aba8`) plus the version bump (`feea3e7`); GitHub Actions
  built and published the image on the push, and the owner pulled it and
  verified it working in the browser.
- Mounted Socket Tray pocket-X mirror fix: `normalizedPockets` now mirrors
  viewed x into geometry space the way `normalizedPegs` does, correcting
  pockets that rendered and would have printed at the wrong end of the shelf;
  both mounted coupon STLs regenerated, the flat tray untouched (`3f5aba8`).
  Both mounted coupons were regenerated from the fixed geometry —
  `test-prints/mounted-socket-tray-coupon.stl` (3,524 triangles) and
  `test-prints/mounted-socket-tray-coupon-rounded-demo.stl` (5,876) — and
  **both coupons, flat and mounted, remain unprinted; the physical gate is
  unchanged.**
- Owner-typed Corner Radius fillet added to both Socket Trays: rounds the
  tray's own outer top edges and every pocket rim via a mitered quarter-arc
  technique matching the Multiconnect peg fillet, no CSG; radius 0 (default)
  is byte-identical to the pre-rounding output on both existing coupons; the
  Mounted Socket Tray's plate-to-tray L-junction is excluded and stays
  sharp; two new demo STLs added alongside (not replacing) the frozen
  coupons. Owner-tested and approved (`4be03de`).
- Docker workflow tags images with the `package.json` version on every push
  to `main`, in addition to `main` / `sha` / `latest`; version bumped to
  `1.1.0` (`2c3767d`).
- Release investigation and Actions-enablement reports
  (`2e19746`, `2bde431`, `23571b9`).
- Mounted Socket Tray added: new geometry module, 52 tests, generator
  script, coupon STL, and editor registration (`c98cff5`).
- Read-only recon for a wall-mounted Socket Tray, which established that the
  wrench racks hang on Multiconnect slots rather than the OpenGrid Snap
  (`4eecc37`).
- Socket Tray registered in the editor: catalog entry, inspector, pocket
  card, registration tests (`fe3e829`).
- Read-only recon report for the Socket Tray UI registration (`1827a84`).
- reference/ session docs brought current with the socket tray sampler
  (`26d127b`, push verification recorded in `21ccf00`).
- Socket Tray primitive, unit tests, generator script, and unvalidated
  sampler coupon added (`88c37a1`).
- Socket Tray sampler pocket depth reduced to 14mm, tray thickness to 18mm
  (`a32a314`).
- Socket Tray sampler diameters shifted to 10/14/18/22/27mm (`75d79d8`).
- Socket Tray sampler expanded to 6 real-measured diameters at 36mm pitch
  (`107af0b`).
- Sockets-per-pocket mapping replaced with the owner's real measured
  mapping, docs only (`cc4f3ff`).
- Multiconnect UI registered in the editor (`10982d5`).
- Wrench Racks presets added to the OpenGrid insert menu (`f4e3248`).
- Six validated reference STLs committed to `test-prints/` (`c851e06`).
- reference/ session-orientation docs (SESSION-STATE, OPEN-ITEMS, DECISIONS, KNOWN-FIXES) added (`640ebe3`).
- Docker deployment consolidated on `deploy/docker/Dockerfile`; root Dockerfile removed (`edb8101`).

## Dev environment

- Fresh Pop!_OS 24.04 install. User `marlinai`, host `pop-os`, `192.168.1.245`.
- The repo lives at `/Apps/marlin-cad` — `/Apps` is a separate drive, not the
  home folder. See DECISIONS.md for why.
- Node 22.23.2 LTS via nvm, not apt. npm 10.9.8.
- Claude Code 2.1.251, native installer, at `~/.local/bin`.
- Rebuild verified end to end on this box: clone, `npm install`,
  `npm run dev` on port 3000, Wrench Rack Metric 2 preset loads and renders,
  STL export confirmed working.
- **Docker is installed on this box, and marlin-cad does not use it.**
  `docker.io` 29.1.3 has been installed since 2026-09-04 (package log), and
  it runs a container from another project (`marlin-cast-recon`, seen
  running on 2026-09-28). marlin-cad's images are built by GitHub Actions
  and the owner updates Unraid; the `docker:*` npm scripts are not run on
  this box. The owner's process is Claude Code publishes to GitHub, the
  owner pulls on Unraid. **Corrected 2026-09-28:** until then this line
  read "Docker is deliberately not installed here" and "Docker runs on
  Unraid only".

## Production deployment

- marlin-cad runs as a Docker container on Unraid (`192.168.1.250`), pulled
  from `ghcr.io/marlin1111ai/marlin-cad:1.3.4` (deployed 2026-09-29;
  supersedes `1.3.3`, which superseded `1.3.1`, which was pulled by the
  owner and verified working in the browser). `1.3.2` was never deployed.
  **Changed 2026-09-29:** until then this line named `1.3.3` as the
  deployed tag. marlin-cad's container runs on
  Unraid only — not on the Linux dev box, and the owner does not want it
  there. **Corrected 2026-09-28:** until then this line read "Docker runs on
  Unraid only"; Docker is installed on the dev box for another project, and
  marlin-cad does not use it (Dev environment, above).
- **Since 2026-09-29 the container runs the image built from `d80e102`**
  (`sha256:f7d1836999c4d7ae1fce3e767d1017970463d629163c9ec7f81704f01f6e182b`,
  also tagged `sha-d80e102`) under the `1.3.4` tag. It adds the paste fix
  (`877951f`). The owner switched the container's tag from `1.3.3` to
  `1.3.4` and checked it in production: projects still listed, "i have all
  my stuff"; the paste fix, "all good copy paste all the same". See
  `reference/reports/paste-fix-deploy-2026-09-29.md`. **Changed
  2026-09-29:** until then this line said the container runs the `0fc0b75`
  build under the `1.3.3` tag, which it did from 2026-09-28
  (`reference/reports/viewport-mouse-controls-deploy-2026-09-28.md`).
- **The rollback tag is `ghcr.io/marlin1111ai/marlin-cad:sha-0fc0b75`**
  (`sha256:4a802164bba1562475b631c7afc94daf98d04d7db53c54a433416d5fb569cb54`),
  the build the container ran from 2026-09-28 until this update; it added
  the viewport mouse controls (`bf755c5`). **Changed 2026-09-29:** until
  then the rollback tag recorded here was `sha-586033e`, and until
  2026-09-28 it was `sha-9e926bf`.
- **The `1.3.3` tag resolves to the rollback image, not the deployed one**
  (read from the public registry, 2026-09-29): `1.3.3` and `sha-0fc0b75`
  both resolve to the digest above. It stays put, because the version in
  `package.json` is `1.3.4` and pushes re-point that tag instead.
  **Changed 2026-09-29:** until then this line read "The `1.3.3` tag
  resolves to the deployed image".
- **`1.3.4` is the deployed tag since 2026-09-29.** The one-time switch
  from `1.3.3` was made on 2026-09-29, and the container is force-updated
  from then on (Release process, below; DECISIONS.md, 2026-09-28). The
  `1.3.4` tag is re-pointed by every push to `main`, so it does not stay at
  the deployed digest; `sha-d80e102` does. `1.3.4` was first built from
  `c9a4c6d`
  (`sha256:e3906a1e266949facd9fd88a6db9da48d4f585907722cee2feb2b3a95ad4f9fd`,
  also tagged `sha-c9a4c6d`). **Changed 2026-09-29:** until then this line
  read "`1.3.4` is published but not deployed" and said the switch was to
  be made at the next update.
- Unraid backups are run by the owner by hand in Unraid's web terminal; the
  dev box has no route to Unraid (DECISIONS.md).
- Host port 3001 → container port 3000.
- Host path `/mnt/user/appdata/marlin-cad/projects` → `/data/projects`.
  `SKETCHFORGE_SHARED_PROJECTS_DIR=/data/projects` is baked into the image, so
  only the path mapping is needed; without it, projects live inside the
  container and are lost on update.
- The `1.0.0` image was built and pushed from Unraid by hand, before GitHub
  Actions was enabled on this fork. `1.1.0` was the first image GitHub
  Actions built and published; see the Release process subsection below.
  Those two version numbers are history, not the deployed tag — the
  container runs `1.3.4`. **Changed 2026-09-29:** until then this line
  read `1.3.3`.
- The `marlin-cad` container has now gone missing from the Unraid Docker tab
  **twice**, and was recreated by hand from the settings above on both
  occasions: the first time at the `1.1.0` tag, and again on 2026-09-07
  during the `1.3.1` update. The cause is unrecorded on both occasions. The
  projects volume mapping meant no project data was lost either time. Port
  mapping, volume mapping and every other setting are as recorded above; only
  the image tag has moved forward, to `1.3.1` then, to `1.3.3` after, and
  to `1.3.4` on 2026-09-29. See KNOWN-FIXES.md. **Changed 2026-09-29:**
  until then this line ended "and to `1.3.3` since".
- **Project thumbnails work on `1.3.3`** (owner observation, 2026-09-26)
  **but are NOT on the mapped volume.** The container writes
  them to `/app/apps/web/.codex/project-thumbnails` (`process.cwd()` of the
  standalone server plus `.codex/project-thumbnails`, no env var), which is
  the container's disposable layer — every recreate discards them. How
  many times the container has been recreated is not recorded. Local
  projects themselves are not on Unraid at all: they live in the browser's
  IndexedDB/localStorage. See OPEN-ITEMS.md and
  `reference/reports/projects-storage-recon.md`. **Changed 2026-09-29:**
  until then this bullet said "the container has been recreated twice";
  that counted the two times it went missing and was rebuilt by hand (the
  bullet above), not the updates applied on Unraid, and whether `1.2.0`
  was ever applied there is not recorded. **Note, 2026-09-29:** after the
  2026-09-29 update, which recreated the container, the owner reported the
  project cards still show their pictures: "thet good"
  (`reference/reports/paste-fix-deploy-2026-09-29.md`).
- Blinking Docker Manager icon fix re-applied on Unraid:
  `cp /mnt/user/appdata/marlin-cad/freecad.png /usr/local/emhttp/plugins/dynamix.docker.manager/images/question.png`
  — RAM-only, lost on reboot.
- Dev on the Linux box is unchanged: `npm run dev`, port 3000. The container
  never binds 3000 on the host.
- Image built from `deploy/docker/Dockerfile`; the root Dockerfile was removed
  in `edb8101`.

### Release process

Since 2026-09-28 (DECISIONS.md, "Unraid is updated by force update"):

1. Claude Code pushes to `main`. The version is not bumped for a release.
2. GitHub Actions (`.github/workflows/docker.yml`) builds and publishes the
   image, and re-points the current version tag,
   `ghcr.io/marlin1111ai/marlin-cad:1.3.4`, to it, alongside `sha-<short>`,
   `main` and `latest`.
3. The owner force-updates the container on Unraid.

**The one-time switch from `1.3.3` to `1.3.4` was made on 2026-09-29.**
The owner changed the container's Repository from `1.3.3` to `1.3.4` in
the Unraid Docker tab and applied
(`reference/reports/paste-fix-deploy-2026-09-29.md`); from now on the owner
force-updates it. The `1.3.3` tag no longer moves, because the version in
`package.json` is `1.3.4`, so a force update of it would pick up nothing
new. **Changed 2026-09-29:** until then this paragraph said the switch was
pending at the next update and the container still named the `1.3.3` tag.

Until 2026-09-28 the process was three different steps, and the history
below is written against them: (1) Claude Code bumped the version in the
root `package.json` and pushed to `main`; (2) GitHub Actions built the image
and published it to `ghcr.io/marlin1111ai/marlin-cad:<version>`; (3) the
owner changed the tag in the Unraid container's image field to the new
version and applied the update.

Actions had never run on this repo because it is a fork of
`Formsmith746/SketchForge-3D` — GitHub disables workflows by default on a
fork that already contained workflow files. The owner enabled it manually
from the Actions tab and ran "Build and Push Docker Images" once
(run #1, on `23571b9`). That run failed at the push step with
`denied: permission_denied: write_package`; fixed by (a) Settings → Actions
→ General → Workflow permissions → "Read and write permissions", and
(b) the package's own settings at
`github.com/users/marlin1111ai/packages/container/marlin-cad/settings` →
Manage Actions access → Add Repository `marlin-cad` → role Write. The re-run
succeeded and published `1.1.0`. Full detail:
`reference/reports/release-1.1.0.md`,
`reference/reports/release-1.1.0-actions.md`,
`reference/reports/release-1.1.0-publish.md`,
`reference/reports/release-1.1.0-banked.md`.

Since then the process has run unattended: `1.2.0`
(`reference/reports/release-1.2.0.md`) confirmed Actions publishes
automatically on a push to `main` with no manual dispatch, and `1.3.0`,
`1.3.1` and `1.3.3` each followed the earlier three steps. `1.3.2` ran
steps 1 and 2 only — step 3 was deliberately skipped because it would not
have changed anything on Unraid. `1.3.4` (`c9a4c6d`, 2026-09-28) also ran
the earlier steps 1 and 2 only: it is published and was not deployed,
because the owner force-updated the `1.3.3` container instead. It is the
last version bump made for a release. `1.3.4` is the tag now deployed;
since 2026-09-29 the container runs the `d80e102` build under it (see
above). **Changed 2026-09-29:** until then this sentence named `1.3.3` as
the tag deployed and the `0fc0b75` build as the one running under it.

The two deploys recorded on 2026-09-27 and 2026-09-28 were both force
updates of the `1.3.3` container. Each picked up the build that tag
pointed at: `586033e`, then `0fc0b75`, the last push made at version
`1.3.3`. **Note, 2026-09-29:** the third deploy, on 2026-09-29, was the
one-time switch to `1.3.4`, which picked up the `d80e102` build; this
paragraph began "The two deploys recorded so far" until then.

## Print status

- Metric 1: printed and validated on the board.
- Metric 2, Metric 3, SAE 1, SAE 2, SAE 3: queued to print.
- Socket Tray sampler coupon (`test-prints/socket-tray-sampler.stl`): not
  yet printed; it is the physical gate for the socket work.
- Mounted Socket Tray coupon (`test-prints/mounted-socket-tray-coupon.stl`):
  not yet printed; the second half of that gate.
- Label test piece (`test-prints/label-test-piece.stl`): printed 2026-09-27
  and passed.
- Gridfinity foot test piece (`test-prints/gridfinity-foot-test-piece.stl`):
  printed 2026-09-27 and passed in the owner's baseplate.
- Gridfinity Socket Tray, the default insert: printed 2026-09-27; "it prints
  and works".
- Screwdriver Tray and Mounted Screwdriver Tray: not printed; no candidate
  file.

## Other validated primitives

- OpenGrid Board — full board only exposed in the UI.
- OpenConnect Container — Bin and Shelf variants.
- OpenGrid Snap — 4 variants.

## Test suite

739 unit tests passing across 58 files (`npm test`, re-run 2026-09-27 on
`0803ac0`, not carried forward), of which 36 are in
`tests/unit/socketTrayGeometry.test.ts`, 8 in
`tests/unit/socketTrayShapeRegistration.test.ts`, 57 in
`tests/unit/mountedSocketTrayGeometry.test.ts`, 13 in
`tests/unit/mountedSocketTrayShapeRegistration.test.ts`, 50 in
`tests/unit/screwdriverTrayGeometry.test.ts`, 9 in
`tests/unit/screwdriverTrayShapeRegistration.test.ts`, 59 in
`tests/unit/mountedScrewdriverTrayGeometry.test.ts`, 13 in
`tests/unit/mountedScrewdriverTrayShapeRegistration.test.ts`, 28 in
`tests/unit/projectThumbnailOrigin.test.ts`, 49 in
`tests/unit/labelSlabGeometry.test.ts`, 39 in
`tests/unit/gridfinityFootGeometry.test.ts`, 64 in
`tests/unit/gridfinitySocketTrayGeometry.test.ts` and 12 in
`tests/unit/gridfinitySocketTrayShapeRegistration.test.ts` (the last four
files are new since 2026-09-26; their 164 tests account for the whole
575 → 739 difference). Every per-file
figure here was counted from the runner's own per-file report, test by
test, not inherited; the per-shape figures in the sections above now agree
with them. The four socket-tray files total 114, the two flat-screwdriver
files 59, the two mounted-screwdriver files 72 and the two Gridfinity
Socket Tray files 76. `npm run typecheck` is clean.

## Printers

- Bambu X1C (256mm bed)
- Bambu H2D
