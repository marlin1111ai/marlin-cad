# Read-only recon — Gridfinity labeled socket tray (fifth tray shape)

Date: 2026-09-25. Diagnose-only pass; no source file was modified, no
dependency added, nothing built. This report is the only new file.

Target (owner's brief): a fifth tray shape — Gridfinity socket tray, round
blind pockets, a printed number label beside each pocket (engraved/raised
choice), owner-typed hole diameters, NO magnet pockets. Reference numbers:
42mm grid, 0.5mm inter-unit clearance, 4.75mm base height, 2mm floor, 12mm
hole depth, 0.6mm diameter clearance, 3mm spacing, 4mm edge margin, 0.8mm
label depth, 5mm label size, 0.8mm hole-top lead-in chamfer; reference
exports 167.50 × 83.50 × 19.55mm (4×2) and 125.50 × 83.50 × 19.55mm (3×2).

Headline answers:

- **Text labels boundary-rep with what is already installed: YES.**
  `three` (0.184.0, `node_modules/three/package.json:3`) ships
  `FontLoader`/`Font.generateShapes`, which return pure vector outlines
  (`THREE.Shape[]`, no geometry, no CSG —
  `node_modules/three/examples/jsm/loaders/FontLoader.js:115-128`), plus
  bundled digit-bearing fonts the editor ALREADY imports and parses
  (`apps/web/src/components/SketchForgeEditor.tsx:9-17`, `:232-240`). The
  outlines feed the exact earcut path the trays already use
  (`THREE.ShapeUtils.triangulateShape` inside `pushCap`,
  `apps/web/src/lib/socketTrayGeometry.ts:277-297`). Nothing to install.
- **Biggest risk:** font glyphs are not CAD contours. Making every
  curve-sampled digit outline satisfy the manifold + exact directed-edge
  contract as top-face notches is the one genuinely new meshing problem in
  this shape, and it fails per-character, not per-module (detail in §7).

---

## 1. What the four tray modules already give us

Convention first: per DECISIONS.md ("a pattern to imitate, not a library to
import", the `multiconnectContainerGeometry` entry) the emission helpers in
every tray module are module-private; only constants/normalizers are
exported, and the screwdriver trays established the precedent of importing
those (`screwdriverTrayGeometry.ts` header per SESSION-STATE.md, and
DECISIONS.md's Screwdriver Tray entry). So: **exported constants =
importable as-is; techniques = re-derive in the new module.**

### Importable as-is (exported)

From `apps/web/src/lib/socketTrayGeometry.ts`:

| Export | Line | Use for the Gridfinity tray |
|---|---|---|
| `MIN_SOCKET_TRAY_FLOOR_THICKNESS = 2` | :97 | Reference floor is exactly 2mm — same rule, same constant |
| `SOCKET_TRAY_POCKET_EDGE_CLEARANCE = 5` | :101 | Reference edge margin is 4mm — near-miss, see open question Q7 |
| `SOCKET_TRAY_POCKET_GAP = 4` | :104 | Reference spacing is 3mm — same near-miss |
| `SOCKET_TRAY_POCKET_SEGMENTS = 64` | :89 | Round pocket resolution |
| `SOCKET_TRAY_FILLET_SEGMENTS = 6` | :83 | Rim fillet band resolution |
| `normalizeSocketTray{Width,Depth,Thickness,CornerRadius}` | :131,:137,:143,:159 | Pattern only — a derived-footprint shape validates differently |
| `socketTrayPositions` / `createSocketTrayGeometry` | :325,:533 | Not composable — each module emits one whole solid |

From `apps/web/src/lib/screwdriverTrayGeometry.ts`:
`MIN_SCREWDRIVER_TRAY_THICKNESS = 10` (:75) — not relevant (blind pockets
here, so the socket tray's floor constant is the right guard).

From `apps/web/src/lib/multiconnectContainerGeometry.ts` (not a tray, read
for plan-rounding only): `MULTICONNECT_CORNER_SEGMENTS = 10` (:114) — the
segment-count convention for quarter-arc plan corners.

The mounted modules (`mountedSocketTrayGeometry.ts`,
`mountedScrewdriverTrayGeometry.ts`) export plate/slot machinery
(slot centers, plate dimensions — e.g. `mountedSocketTraySlotCenters`
:275) that a flat Gridfinity tray does not need. Nothing to import from
either.

### Techniques to re-derive (module-private, proven in the tray family)

- **Earcut cap with holes** — `pushCap` wraps
  `THREE.ShapeUtils.triangulateShape` with contour + holes and a
  dot-product winding flip (`socketTrayGeometry.ts:277-297`). This is the
  workhorse for the top face (pocket rims + label outlines as holes) and
  the bottom face (foot outlines as holes).
- **Rim-notch pocket** — pocket wall + floor cap reuse the SAME ring point
  objects the top-face notch uses, so the seam is bit-identical by
  construction (`socketTrayGeometry.ts:339-373`, `:496-528`). Round blind
  pockets for this tray are this code pattern verbatim (12mm deep over
  2mm floor instead of 14 over 4).
- **Swept inset rings** — `boxRing(k)` sweeps the tray rectangle through K
  rings of varying inset/Y with exact literal endpoints at k=0 and k=K
  (`socketTrayGeometry.ts:412-432`). This is half of the Gridfinity foot
  (§4).
- **Rounded-rect plan outline** — quarter-circle corner arcs on a plate
  outline, caps and perimeter walls all following the same outline
  (`multiconnectContainerGeometry.ts` header :60-65, corner machinery
  around :216-260, `roundedRectInsideDistance` :419-423). The other half
  of the foot.
- **Bottom cap carrying multiple hole families** — the mounted screwdriver
  tray's single earcut bottom cap carries per-slot channel notches AND
  per-bore holes (SESSION-STATE, Mounted Screwdriver Tray section). Direct
  precedent for a bottom face notched with one foot outline per grid unit.
- **Validation style** — explicit layouts, thrown (not clamped) errors with
  friendly per-index messages (`normalizedPockets`,
  `socketTrayGeometry.ts:171-203`; widened-by-fillet recheck :209-249).

## 2. Text in geometry — the unknown, resolved to a known

**The repo already turns text into mesh — but via the wrong path for a
print primitive.** There is a `"text"` shape kind
(`SketchForgeEditor.tsx:974` catalog default, `:2300-2302` build arm).
`createBooleanTextGeometry` (`:2089-2124`) feeds `TextGeometry` (an
`ExtrudeGeometry` subclass) with one of six pre-parsed fonts
(`:232-240`): helvetiker bold, droid sans bold / serif bold / sans mono
regular, gentilis bold, optimer bold — all imported from
`three/examples/fonts/*.typeface.json` (`:12-17`), which proves those JSON
imports work in this exact build. That path is float32 `ExtrudeGeometry`
with bevels — fine for freeform modeling, not usable for a boundary-rep
print primitive.

**The reusable core one layer down is exactly right.**
`Font.generateShapes(text, size)` returns `Array<THREE.Shape>` — vector
outlines only, produced by path commands, no triangles, no CSG
(`FontLoader.js:107-128`). `Shape.prototype.extractPoints(divisions)`
yields the outer contour and its holes as `Vector2` lists in float64.
Those lists drop straight into the tray family's existing earcut/notch
pattern:

- **Engraved** (cut 0.8mm into the top face): each glyph's outer contour
  becomes one more hole in the top-face earcut cap — precisely how pocket
  rims are notched today (`socketTrayGeometry.ts:390`). Glyph side walls
  run down 0.8mm reusing the same sampled points (exact-stitch holds
  because they ARE the same doubles, the rule the pocket rim already
  follows, `:339-347`). A label floor cap closes each glyph at −0.8mm,
  with the glyph's counters (the enclosed holes of 0, 4, 6, 8, 9) as holes
  in that floor; each counter then needs its own wall back up and its own
  small island cap at top level. Earcut never sees nesting — islands are
  emitted as separate caps, which `pushCap`'s contract already permits.
- **Raised** (extruded 0.8mm above the top face): the mirror image. The
  top face is notched with the same outlines, walls run UP, glyph top
  caps sit at +0.8mm, counters re-expose a floor at top-face level.

**Difficulty: engraved and raised are structurally symmetric — neither is
meaningfully harder to mesh.** Two real asymmetries: (a) raised grows the
solid's bounding box by the label height, so the registration must resync
the shape's height field (same move as the mounted tray's depth resync,
`ShapeInspector.tsx:457`, `:460`); (b) the difference that matters is
printability, not geometry — engraved makes narrow internal grooves at
stroke width, raised makes free-standing thin walls (§7, risk 2).

Caveats that stay true on either variant: outlines are curve-sampled from
quadratic béziers, so points are derived float64 — the exact-stitch
contract is satisfied by reuse of the same arrays, never by recomputation;
and glyph contours are not authored as CAD outlines, so each character
used must be proven manifold by the exact directed-edge test (risk 1).

## 3. Dependencies that could supply glyph outlines (no new install)

Checked every entry in the root `package.json` (:38-67; there is no
`apps/web/package.json`):

- **`three` ^0.184.0 — YES, and sufficient.** `FontLoader` +
  `Font.generateShapes` + bundled typeface fonts with full digit sets
  (`node_modules/three/examples/fonts/`: helvetiker, optimer, gentilis,
  droid ×5). Already imported by the editor via the same module
  specifiers (`SketchForgeEditor.tsx:12-17`).
- **`opentype.js` 1.3.4 — present in `node_modules` but NOT a direct
  dependency.** It is a dependency of `brepjs`
  (`node_modules/brepjs/package.json:305`, lockfile entry). Importing it
  directly would be relying on an undeclared transitive — effectively a
  new dependency. Not needed, since `three` covers it.
- **`brepjs` — disqualified for this use.** Async lazy-loaded together
  with the 22MB OCCT wasm (`apps/web/src/lib/brepKernel.ts:19-33`), while
  primitive builders must stay synchronous (DECISIONS.md boundary-rep
  entry / CLAUDE-LESSONS CSG entry); also engine-mismatched on this box
  (OPEN-ITEMS.md, brepjs wants Node ≥24).
- **`lucide-react`** — icon paths only, no digit glyphs (inferred from the
  package's purpose; not exhaustively audited).
- **`occt-wasm`, `manifold-3d`, `three-bvh-csg`, `three-mesh-bvh`,
  `fflate`, UI/React packages** — no font/outline machinery (inferred;
  none is plausibly a glyph source).

Conclusion: `three` alone does it; nothing to install, nothing to propose.

## 4. Gridfinity base (stacking foot) as boundary-rep, no CSG hull

The reference hulls three stacked rounded-rect sections per unit. A hull
of coaxial, same-center rounded rects IS the linear surface between their
profiles — so a banded sweep produces it directly and no hull operation is
needed. Profile per owner's spec, bottom-up: 45° chamfer 0.8mm → straight
1.8mm → 45° chamfer 2.15mm = 4.75mm.

**The repo has no swept/lofted rounded-rect helper.** The closest thing
deliberately is not one: `openGridGeometry.ts` approximates its profile's
diagonal transitions as stepped bands "rather than a true lofted taper"
precisely to avoid a separate lofting code path (comment at
`openGridGeometry.ts:197-202`). But both ingredients exist as
print-validated patterns:

1. Inset-ring sweep vs height — `boxRing` (`socketTrayGeometry.ts:412-432`)
   already sweeps a rectangle through rings of (inset, y). A 45° chamfer
   is the single-band linear case of that same move — simpler than the
   existing fillet, which needs K arc bands.
2. Rounded plan corners with a fixed arc segment count —
   `multiconnectContainerGeometry.ts` (:60-65, :114). Fixed segment count
   per corner means every ring has an identical point count, so band
   quads stitch ring-to-ring trivially.

What must be derived new: a `roundedRectRing(inset, y)` builder whose
corner radius shrinks with inset (`r_k = r_top − inset_k`; Gridfinity's
bottom radius stays positive so no degenerate-corner case at these
numbers — verify against the SCAD when specifying), with exact literal
coordinates at each profile knot per the exact-stitch lesson. Feet attach
by notching the tray body's bottom face with each foot's top outline as
earcut holes — one foot per 42mm unit, the same
multiple-hole-families-on-one-bottom-cap move the mounted screwdriver
tray already ships (SESSION-STATE, its bottom cap carries slot notches +
bore holes).

Not confirmed anywhere in the repo: an existing equivalent swept/lofted
profile. Statement stands: none exists; this is new but small, and both
halves have validated parents.

## 5. Footprint constraint today, and a derived-size shape

Today's trays: Width/Depth are free numeric inspector rows with min/max
clamps (flat socket tray rows at `ShapeInspector.tsx:426-441`: min = 2 ×
edge clearance, max 320, step 0.5); layout validity is the geometry
module's thrown guards surfaced inline by the pocket card, never clamped
in the UI.

**A derived-size shape fits the existing registration pattern — there are
three live precedents, not zero:**

- OpenGrid Board: the user types Grid Width/Height in UNITS; the handler
  writes both the unit field and the derived mm footprint
  (`onUpdate({ gridWidth: units, width: units * OPENGRID_TILE_SIZE, ... })`,
  `ShapeInspector.tsx:284-296`), and the geometry side derives mm from
  units too (`openGridGeometry.ts:64-70`). This is exactly the Gridfinity
  shape's need: `width = 42·unitsX − 0.5` (the reference exports check
  out: 4×42−0.5 = 167.5, 2×42−0.5 = 83.5).
- OpenConnect Container: any envelope-affecting edit re-derives
  width/height/depth from the same dimensions function the builder uses,
  "mirroring the board's own gridWidth/gridHeight -> width/depth pattern"
  (`ShapeInspector.tsx:320-330`).
- Mounted trays: `shape.depth` is derived (tray projection + plate
  thickness) and resynced by two different rows' onChange handlers
  (`ShapeInspector.tsx:457`, `:460`).

Strain to note, not a blocker: the brief says size is computed **from hole
count**, which is one derivation deeper than the board (holes → unit
count → mm). The resync precedents are all per-row `onUpdate` patches with
no central recompute, so a footprint that must change whenever the hole
LIST changes puts the resync inside the pocket-card add/remove/edit
handlers too — more call sites to keep in lockstep than any existing
shape has (see risk 3 and open question Q1).

## 6. The eight-file registration pattern

From the socket tray UI build's own `git status` block
(`reference/reports/socket-tray-ui-build.md`, Verification section) —
seven modified files plus the new registration test file = the eight:

1. `apps/web/src/types/sketchforge.ts` — kind union (:25-26), per-shape
   option fields + pocket row type (:157-167, :310-317).
2. `apps/web/src/lib/shapeCatalog.ts` — catalog entry (:116), geometry
   imports (:65-73), shape→options mapping helper and layout-error
   translation (report: `shapeCatalog.ts:121-147`, `:149-172`).
3. `apps/web/src/lib/workplaneShapes.ts` — fallback color (:136),
   `workplaneShapesEqual` geometry-affecting fields (:247-249).
4. `apps/web/src/lib/skfProject.ts` — `SHAPE_KINDS` (:33) for `.skf`
   round-trip.
5. `apps/web/src/components/workplane/ShapeInspector.tsx` — dimension rows
   (:426-441) + per-pocket card (:879-881, `SocketTrayPocketCard` :1014).
6. `apps/web/src/components/WorkplaneViewport.tsx` — render arm
   (:7278-7283) via `sharedShapeGeometry` cache.
7. `apps/web/src/components/SketchForgeEditor.tsx` — insert-menu default +
   export arm (report: `:2153-2293`, `:1882-1907`, `:1762-1784`).
8. `tests/unit/<shape>ShapeRegistration.test.ts` — new file (all four
   trays have one; `tests/unit/` listing).

What the new shape strains:

- **Labels list:** pocket rows today are pure-numeric
  `{ diameter, x, z }` (`types/sketchforge.ts:159`). A per-pocket label
  string (and an engraved/raised choice) flows fine through serialization
  (plain JSON in `.skf`), `workplaneShapesEqual` (the pocket array is
  compared by reference, `workplaneShapes.ts:248` — no change needed) and
  the mapping helper. The strain is UI-shaped: the pocket card would gain
  its first non-numeric input; every existing row is a min/max/step
  number. Dropdown precedent exists (board type,
  `ShapeInspector.tsx:296-300` area; the text shape's font choice), text
  input precedent inside a pocket card does not.
- **Derived footprint:** the Width/Depth rows disappear or go read-only in
  favor of unit counts — board precedent covers the inspector, but the
  registration test family's "export reproduces the coupon" pattern and
  the geometry-identity tests need their fixtures specified in units, and
  each pocket-list edit becomes a footprint-affecting edit (cache keys via
  `shapeGeometrySignature` already include pocket lists, so caching is
  safe; the resync fan-out in §5 is the real cost).

## 7. Top three risks

1. **Glyph outlines are not CAD contours (biggest).** The whole label
   feature rides on earcut and the exact directed-edge test accepting
   curve-sampled font outlines as top-face notch contours. Font glyphs may
   self-intersect, carry near-degenerate segments after sampling, or
   produce sliver triangles — any of which breaks the manifold contract
   that every shape in this family is pinned by. Evidence: `pushCap`
   trusts `ShapeUtils.triangulateShape` unconditionally
   (`socketTrayGeometry.ts:277-297`); the repo has only ever notched faces
   with contours it authored itself (circles, rects, the baked keyhole
   rim); and the exact-stitch lesson (CLAUDE-LESSONS 2026-08-22→24) shows
   how unforgiving the directed-edge test is. Failure is per-character
   and per-font, so the mitigation is a per-glyph validation harness
   (likely: restrict to digits of one vetted font first), not a one-time
   check.
2. **Label printability at 5mm size / 0.8mm depth.** Bold digit strokes
   and counters at 5mm cap height are on the order of one extrusion line
   width. The slicer-slit-fusion lesson (CLAUDE-LESSONS 2026-08-24) is
   explicit that geometry validation CANNOT catch this class — engraved
   grooves can fuse shut and raised strokes can be too thin to slice as
   walls. Only a printed label coupon (digits 0–9, engraved AND raised,
   before any tray is built on top) settles it. This is the risk the
   print gate exists for.
3. **Two new derivations stacked in one shape: the foot sweep and the
   hole-count-derived footprint.** The rounded-rect profile sweep is the
   repo's first true loft-like construction — `openGridGeometry.ts:197-202`
   shows the previous builder deliberately avoided writing one — and its
   corner-arc bookkeeping across rings must hold the exact-stitch
   contract at every knot. Meanwhile the footprint derivation has no
   settled rule (§5) and the reference's own height doesn't decompose
   cleanly: 4.75 base + 2 floor + 12 hole = 18.75mm, but the exports
   measure 19.55mm — an unexplained 0.8mm (the label depth? a top
   chamfer? a lip?) that must be resolved from the owner's SCAD before
   any coupon is cut. Building both novelties into one phase multiplies
   the ways a print can fail for un-diagnosable reasons; they are
   separable (foot coupon vs label coupon).

## Open questions (for the owner — nothing here was built or decided)

- **Q1 — Footprint derivation rule.** "Size computed from hole count":
  what exactly is the rule? Smallest unit count whose interior fits the
  hole row(s) at 3mm spacing + 4mm margin? Does the owner type hole
  positions (as on every existing tray, DECISIONS.md "no auto-layout")
  or does this shape break that decision and lay out its own rows
  ("holes split across rows" in the reference is an auto-layout
  behavior)? This is the largest unsettled design decision.
- **Q2 — The 0.8mm height discrepancy.** 19.55mm measured vs 18.75mm
  decomposed (risk 3). What occupies the top 0.8mm in the reference?
- **Q3 — Engraved/raised: per tray or per pocket?** And which is the
  default?
- **Q4 — Font choice.** Droid Sans Mono Regular (bundled, already parsed
  in the editor) gives uniform digit widths — is monospace wanted, or a
  bold face for thicker printable strokes? (Bundled fonts carry their own
  licenses under `node_modules/three/examples/fonts/`; worth a glance
  before shipping glyph geometry in exports.)
- **Q5 — Lead-in chamfer vs fillet.** The reference wants a 0.8mm CHAMFER
  at each hole's top edge; the tray family's Corner Radius is documented
  as "never a chamfer" (`socketTrayGeometry.ts:40-46`). New chamfer band
  (geometrically simpler than the existing fillet), or reuse the fillet?
- **Q6 — Stacking lip.** The reference exports appear lipless (Q2 aside).
  Confirm no Gridfinity stacking lip is in scope.
- **Q7 — Clearance constants.** Reference margin/spacing (4mm / 3mm) are
  tighter than the tray family's imported guards (5mm / 4mm,
  `socketTrayGeometry.ts:101,:104`). Import the family constants and
  deviate from the reference, or new module constants at the reference's
  numbers?
- **Q8 — Label size vs pocket gap.** A 5mm label "beside each pocket"
  must fit inside whatever gap/margin rule wins Q7 — does the label
  participate in the layout guards (it should), and where exactly does
  it sit (above, below, right of the pocket)?

## SCOPE CHECK — every file read, mapped to its step

No file was modified; no dependency installed; `test-prints/`, `deploy/`
and `.github/` untouched and unread. The DO-NOT-TOUCH geometry modules
below were READ ONLY because Step 1 explicitly requires inventorying
them; none was edited (working tree is clean except this report).

| File | Access | Step |
|---|---|---|
| `reference/SESSION-STATE.md` | full read | orientation |
| `reference/DECISIONS.md` | full read | orientation, 1, 3, 5 |
| `reference/KNOWN-FIXES.md` | full read | orientation |
| `reference/OPEN-ITEMS.md` | full read | orientation, 3 |
| `CLAUDE-LESSONS.md` | loaded via project instructions | orientation, 2, 7 |
| `apps/web/src/lib/socketTrayGeometry.ts` (do-not-touch) | full read | 1, 2, 4 |
| `apps/web/src/lib/screwdriverTrayGeometry.ts` (do-not-touch) | export lines via grep | 1 |
| `apps/web/src/lib/mountedSocketTrayGeometry.ts` (do-not-touch) | export lines via grep | 1 |
| `apps/web/src/lib/mountedScrewdriverTrayGeometry.ts` (do-not-touch) | export lines via grep | 1 |
| `apps/web/src/lib/multiconnectContainerGeometry.ts` (do-not-touch) | export + corner-radius lines via grep | 1, 4 |
| `apps/web/src/lib/multiconnectSlotMesh.ts` (do-not-touch) | NOT read | — |
| `apps/web/src/lib/openGridGeometry.ts` | targeted grep + excerpts | 4, 5 |
| `apps/web/src/lib/shapeCatalog.ts` | targeted grep | 5, 6 |
| `apps/web/src/lib/workplaneShapes.ts` | targeted grep | 6 |
| `apps/web/src/lib/skfProject.ts` | targeted grep | 6 |
| `apps/web/src/types/sketchforge.ts` | targeted grep | 6 |
| `apps/web/src/lib/brepKernel.ts` | first 40 lines | 3 |
| `apps/web/src/components/workplane/ShapeInspector.tsx` | excerpts (:280-300, :320-330, :420-480) + grep | 5, 6 |
| `apps/web/src/components/SketchForgeEditor.tsx` | excerpts (:2080-2320) + grep | 2, 6 |
| `apps/web/src/components/WorkplaneViewport.tsx` | targeted grep | 6 |
| `package.json` | full read | 3 |
| `package-lock.json` | grep for opentype.js only | 3 |
| `reference/reports/socket-tray-ui-build.md` | excerpts + grep | 6 |
| `node_modules/three/package.json`, `examples/jsm/loaders/FontLoader.js` (:100-140), `examples/fonts/` listing + README | targeted read | 2, 3 |
| `node_modules/brepjs/package.json` | grep for opentype | 3 |
| `tests/unit/` | directory listing | 6 |
| `apps/web/src/lib/` | directory listing | 1 |

Inferred rather than confirmed, marked in place: lucide-react and the
non-font packages in §3; the Gridfinity bottom corner radius staying
positive in §4; the reference SCAD's own behavior everywhere (it is not
in the repo and was not imported, per the brief).
