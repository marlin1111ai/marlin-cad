# Wall-mounted Socket Tray (tray + back plate) — recon (read-only)

Read-only recon for a SECOND, separate primitive: a socket tray with a back
that hangs on a wall board, printed as one part. **No code, test, STL,
config, or doc change was made; this report is the only file created.** The
existing flat Socket Tray, its coupon, its tests, and its UI registration
are untouched and unproposed-against.

Every claim below cites a file path and line range, or the output of a
command pasted in this report.

## Lead finding — read this before step 2

**The wrench racks do not hang on the OpenGrid Snap primitive this app
ships.** They are Multiconnect PegPlates: they hang by Multiconnect keyhole
slots at 28mm spacing (`multiconnectPresets.ts:29-42`). The app's OpenGrid
Snap primitive is baked from `generate_snap="openConnect"` only
(`reference/openconnect/README.md`, "Regenerating the baked snap meshes"),
which presents an **openConnect** head, not a Multiconnect one. The
upstream snap generator does offer a `"multiConnect"` head option
(`reference/openconnect/opengrid_parametric_snap.scad:15`, `:425-427`), but
no variant of it is baked into this codebase.

So "the same way the wrench racks do" resolves to Multiconnect slots, while
`reference/DECISIONS.md`'s existing entry ("The Socket Tray back plate is
the existing OpenGrid Snap primitive") points at the openConnect head. Those
are two different mating features. Which one the back plate should carry is
the single largest unknown in this recon and is listed first in step 8.

No STOP condition was hit: both approaches in step 5 that the owner named
can be built without editing either do-not-touch geometry module. A third
approach that would require editing one is described and labelled a
blocker.

## Step 1 — clean tree, HEAD == origin/main

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
$ git fetch origin
$ git rev-parse HEAD origin/main
6ffc28c706893f5607b37716892c4073fda309ca
6ffc28c706893f5607b37716892c4073fda309ca
```

## Step 2 — how a part attaches to a board today

### 2a. The OpenGrid Snap primitive

**Module:** `apps/web/src/lib/openGridSnapGeometry.ts` (141 lines).
**Data:** `apps/web/src/lib/openGridSnapMesh.ts` — four baked
`positions`/`indices` pairs, no logic.

**Parameters.** Two discrete enums and nothing else:
`OpenGridSnapOptions = { boardType?; snapBodyShape? }` (`:129-132`).
`boardType` normalizes to `"full"` or `"lite"` (`:59-61`) — `"heavy"` folds
to `"full"` because upstream exposes no Heavy thickness and this repo's
Heavy board is a flat-slab placeholder (`:38-45`, `:82-85`). `snapBodyShape`
is `"Directional"` or `"Symmetric"` (`:63-65`). There is no continuous
sizing: `createOpenGridSnapGeometry` picks a table entry, expands the
indexed mesh, applies `rotateX(-Math.PI/2)`, and computes normals
(`:134-141`).

**What the mating feature actually is, geometrically.** A push-fit body that
seats into a board hole, with an **openConnect head** on top. Measured from
the baked data:

```
$ node -e '<parse openGridSnapMesh.ts arrays, take min/max per axis>'
SNAP_FULL_DIRECTIONAL_POSITIONS  (vertices 902)
  SCAD min  X,Y,Z: -12.7950, -12.7950, 0.0000
  SCAD max  X,Y,Z: 12.7950, 13.1950, 9.4000
  SCAD size X,Y,Z: 25.5900 x 25.9900 x 9.4000
SNAP_FULL_SYMMETRIC_POSITIONS  (vertices 1074)
  SCAD size X,Y,Z: 25.5900 x 25.5900 x 9.4000
SNAP_LITE_DIRECTIONAL_POSITIONS  (vertices 878)
  SCAD size X,Y,Z: 25.5900 x 25.9900 x 6.6000
SNAP_LITE_SYMMETRIC_POSITIONS  (vertices 1137)
  SCAD size X,Y,Z: 25.5900 x 25.5900 x 6.6000
```

The local frame is OpenSCAD's Z-up: the ~25.59mm-square footprint is X/Y,
and Z runs `[0, snap_thickness]` through the body then on up through the
head (`openGridSnapGeometry.ts:47-49`). `rotateX(-90°)` sends that Z to the
app's world Y, so in app terms a Full snap is 25.59mm wide, 25.99mm deep and
**9.4mm tall** (`:105-127`, `:138`).

The head's own height is fixed upstream:
`OCHEAD_TOTAL_HEIGHT = OCHEAD_TOP_HEIGHT + OCHEAD_MIDDLE_HEIGHT +
OCHEAD_BOTTOM_HEIGHT` = `0.6 + 1.4 + 0.6` = **2.6mm**
(`reference/openconnect/lib/opengrid_base.scad:43-45`, `:56`), on a
**17 × 10.6mm** large-rectangle profile (`:46-47`). With
`OG_STANDARD_THICKNESS = 6.8` (`:5`), 6.8 + 2.6 = 9.4mm, exactly the baked
Full height above.

**There is no runtime attach interface.** Every consumer just builds the
snap as its own independent shape:
`WorkplaneViewport.tsx:7244-7248` (viewport arm),
`SketchForgeEditor.tsx:2257-2264` (export arm),
`shapeCatalog.ts:315` and `ShapeInspector.tsx:418-436` (dimensions and
inspector rows only). Grepping for any attach/mate helper across the app
source returns nothing of the kind — the only `mount`-named function is
`screwMountPoints` for the board's own screw holes
(`openGridGeometry.ts:667`):

```
$ grep -rniE 'function [a-z]*(attach|mate|mount|snapTo)' apps/web/src --include='*.ts' --include='*.tsx'
apps/web/src/lib/openGridGeometry.ts:51:export function normalizeOpenGridScrewMounting(...)
apps/web/src/lib/openGridGeometry.ts:667:function screwMountPoints(...)
apps/web/src/lib/projectAssets.ts:170:export function attachProjectAsset(shape, assetId)   <- project asset metadata, not geometry
apps/web/src/components/WorkplaneViewport.tsx:977,988,1126: rulerAttachment*  <- measurement rulers, not geometry
```

What holds the Snap and the Container's slot compatible is a **bake-time
shared profile, not runtime code**: `openconnect_lib.scad`'s
`openconnect_head` is called once with `head_type="head"` for the snap and
once with `head_type="slot"` for the container's cutter, the slot being the
head profile plus clearance (`openGridSnapGeometry.ts:17-24`,
`reference/openconnect/README.md`). The two meshes are baked independently
and share no TypeScript.

### 2b. The Multiconnect plate's mounting side

**Module:** `apps/web/src/lib/multiconnectContainerGeometry.ts`, entry
`multiconnectPlatePositions` (`:526-748`). **Data:**
`apps/web/src/lib/multiconnectSlotMesh.ts`.

**What makes it hang.** Blind keyhole slots cut into the mounting face. The
plate frame is X = width `[0, W]`, Y = height `[0, H]`, Z = thickness
`[0, plateThickness]`, front (container-side) face at Z = 0, mounting face
at Z = plateThickness (`:35-40`). All slot geometry is measured from the
mounting face, so extra thickness only thickens the front skin (`:38-40`,
`plateZPlanes` `:210`).

**Where the features come from — half baked, half generated.**

| Piece | Source | Cite |
|---|---|---|
| Slot round top (revolved keyhole + 45° taper + lock dimple crater) | **baked** mesh, transformed and winding-reversed, never re-derived | `multiconnectSlotMesh.ts:50+`, used at `multiconnectContainerGeometry.ts:25-27`, `:44-46` |
| Slot straight channel below the clip plane | **generated** — a prism of the baked `MULTICONNECT_CHANNEL_OUTLINE` | `multiconnectSlotMesh.ts:39-48`; `multiconnectContainerGeometry.ts:28-30` |
| Mounting-face opening | **generated** — the baked mouth rim spliced into the face contour, with the notch strip running down to y = 0 | `pushMountingNotches`, `:577-585` |
| Bottom-edge opening | **generated** — the channel outline spliced into the bottom edge face | `pushBottomNotches`, `:586-593` |

Fixed numbers: head radius **10.15mm**, neck radius **7.65mm**, blind cut
depth **4.15mm** (`multiconnectSlotMesh.ts:26-30`); back thickness /
minimum plate thickness **6.5mm** with **2.35mm** of skin kept behind the
blind floor (`multiconnectContainerGeometry.ts:83-87`); the slot's round-top
center sits **13mm** below the plate's top edge
(`MULTICONNECT_SLOT_TOP_OFFSET`, `:108`, used at `:534`).

**The slot channel exits the plate's bottom edge.** `pushMountingNotches`
runs each notch strip down to y = 0 (`:582`, `:584`) and `pushBottomNotches`
opens the bottom edge face (`:586-593`). That opening is the entry the plate
slides down over. It matters for step 5 and is called out there.

### 2c. Does any code today combine a mounting feature with a separate body into one solid?

**Yes — in two different places, in two different ways.**

1. **Built into a primitive, boundary-rep, no boolean.** The OpenConnect
   Container is exactly a body (base, walls, lips) plus a back wall carrying
   openConnect slot cutouts, emitted as one triangle soup.
   `openConnectSlotGridCells` places slots on a 28mm grid over the back
   wall using upstream's own centering formula ported verbatim
   (`openConnectContainerGeometry.ts:349-370`), and each slot reuses the
   baked slot mesh's own side-wall surface as the hole's interior wall,
   stitched into the wall by shared vertex coordinates rather than a boolean
   (`:44-49`). The Shelf variant is the clearest case: a flat platform, side
   lips, and a back wall with slot cutouts, in one solid (`:82-88`). **This
   is the closest existing precedent to a tray-with-back.**

2. **At runtime, as a user action, via CSG.** The editor exposes boolean
   operations over selected shapes: `booleanMeshShape`
   (`SketchForgeEditor.tsx:3908-3934`) unions the selected solids with
   `ADDITION` and subtracts the ones flagged as holes with `SUBTRACTION`;
   `bvhIntersectionMeshShape` (`:4536-4570`) does the same with
   `useCDTClipping = true`. Both require at least one hole shape in the
   selection (`:3911-3914`, `:4538-4540`), so **neither is a plain
   two-solids union**. There is a `manifoldUnionMeshShape` /
   `mergedMeshShape` path, but it is gated on `hasImportedMesh`
   (`:5240-5242`) — imported meshes, not primitives.

No primitive builder anywhere combines two *primitives* into one solid; each
builder emits its complete part itself.

## Step 3 — the wrench racks

**What they are built from.** Not a dedicated primitive. Each rack is a
`multiconnectContainer` shape pre-filled from a preset:
`MULTICONNECT_PRESETS` (`multiconnectPresets.ts:51-58`), inserted through
ordinary catalog entries that carry a `presetId`
(`shapeCatalog.ts:81-90`), resolved by `makeShapeFromAsset` via
`multiconnectPresetById` (`shapeCatalog.ts:328` region, `multiconnectPresets.ts:60-62`).

**How the back mounts.** By the Multiconnect keyhole slots described in 2b —
`multiconnectShapeType: "PegPlate"` with `multiconnectSlotSpacing: 28`
(`multiconnectPresets.ts:33`, `:35`). Not by the OpenGrid Snap primitive.
See the lead finding.

**Overall dimensions and mounting-feature spacing**, from
`WRENCH_RACK_BASE` (`multiconnectPresets.ts:29-42`) — the file's own header
states these numbers match the printed STLs and must not be tidied
(`:8-13`):

| Parameter | Value | Field |
|---|---|---|
| Plate width | 240mm | `width` |
| Plate height | 60mm | `height` |
| Plate thickness | 10mm | `depth` (the `plateThickness` parameter) |
| Corner radius | 5mm | `multiconnectCornerRadius` |
| **Slot spacing** | **28mm** | `multiconnectSlotSpacing` |
| Slot tolerance | 1.0 | `multiconnectSlotTolerance` |
| Peg length / fillet / tilt | 45mm / 2mm / 5° | `multiconnectPegLength`, `…Fillet`, `…Tilt` |
| Peg row height | z = 35mm | `multiconnectPegRowZ` |

Derived slot layout for that plate, computed with the module's own
`multiconnectSlotCenters` formula (`multiconnectContainerGeometry.ts:261-265`):

```
$ node -e '<multiconnectSlotCenters(240, 28)>'
wrench rack 240mm @ 28mm spacing: 8 slots
centers x: 22, 50, 78, 106, 134, 162, 190, 218
slot round-top center Y = height - 13 = 47
plate z planes at plateThickness 10: mountingFaceZ = 10, blindFloorZ = 5.85
```

(The first center prints as `21.999999999999996` in raw floating point.)

**The physically validated STLs**, listed in `test-prints/README.md` as the
six that presets must stay byte-identical to:
`wrench-rack-metric-1.stl`, `wrench-rack-metric-2.stl`,
`wrench-rack-metric-3.stl`, `wrench-rack-sae-1.stl`,
`wrench-rack-sae-2.stl`, `wrench-rack-sae-3.stl`. None was opened this pass.

## Step 4 — the geometric relationship a mounting feature must hold to the board

| Quantity | Value | Source |
|---|---|---|
| **Board pitch** | **28mm**, both axes | `OPENGRID_TILE_SIZE = 28` (`openGridGeometry.ts:8`); `Tile_Size = 28` (`reference/openGrid.scad:88`, "openGrid standard is 28mm" `:87`); `OG_TILE_SIZE = 28` (`reference/openconnect/lib/opengrid_base.scad:4`) |
| **Board thickness** | Full **6.8mm**, Lite **4mm**, Heavy **13.8mm** | `OPENGRID_THICKNESS` (`openGridGeometry.ts:9-13`); upstream `OG_STANDARD_THICKNESS = 6.8` (`opengrid_base.scad:5`); the snap generator's own customizer exposes only 6.8 / 4 / 3.4mm (`openGridSnapGeometry.ts:38-43`) |
| **openConnect head standoff above the board face** | **2.6mm** | `OCHEAD_TOTAL_HEIGHT` = 0.6 + 1.4 + 0.6 (`opengrid_base.scad:43-45`, `:56`) |
| openConnect head profile | 17 × 10.6mm large rect | `OCHEAD_LARGE_RECT_WIDTH/HEIGHT` (`opengrid_base.scad:46-47`) |
| Snap footprint / total height (Full) | 25.59 × 25.99mm, 9.4mm | measured from `openGridSnapMesh.ts`, step 2a |
| **Multiconnect slot spacing** | default **28mm** in this app; upstream default 25 | `DEFAULT_MULTICONNECT_SLOT_SPACING = 28` with the comment "openGrid pitch per owner decision; the SCAD's Multiboard default is 25" (`multiconnectContainerGeometry.ts:91-92`); `distanceBetweenSlots = 25` (`reference/multiconnect.scad:17`) |
| Multiconnect slot spacing bounds | 24 – 200mm | `MIN_/MAX_MULTICONNECT_SLOT_SPACING` (`:101-102`); below ~24mm adjacent head recesses (2 × 10.15 × max tolerance = 21.8mm) would merge (`:98-100`) |
| Multiconnect slot vertical position | round-top center **13mm** below the plate's top edge | `MULTICONNECT_SLOT_TOP_OFFSET = 13` (`:108`); SCAD `backHeight-13` (`reference/multiconnect.scad:80`) |
| Multiconnect slot depth into the mounting face | **4.15mm**, leaving **2.35mm** skin | `MULTICONNECT_SLOT_CUT_DEPTH = 4.15` (`multiconnectSlotMesh.ts:30`), `MULTICONNECT_BLIND_FLOOR_Z = 2.35` (`multiconnectContainerGeometry.ts:87`); SCAD `backThickness = 6.5`, offset `-2.35` (`reference/multiconnect.scad:74`, `:80`) |
| **Minimum back-plate thickness** | **6.5mm** | `MULTICONNECT_BACK_THICKNESS` (`multiconnectContainerGeometry.ts:83`); the mechanism needs 4.15 + 2.35 (`:81-82`) |
| Minimum plate width / height | 25mm each | `MIN_MULTICONNECT_PLATE_DIMENSION = 25` (`:96`); SCAD `backHeight >= 25`, `backWidth >= distanceBetweenSlots` (`:94-95`, `reference/multiconnect.scad:74`) |
| **The only tolerance knob** | slot tolerance **0.925 – 1.075**, default **1.0** | `MIN_/MAX_/DEFAULT_MULTICONNECT_SLOT_TOLERANCE` (`:93`, `:104-105`); SCAD `slotTolerance = 1.00 //[0.925:0.005:1.075]` (`reference/multiconnect.scad:23`) |

Two notes on how tolerance is applied, both stated in code:
- Multiconnect tolerance is a **planar (across/slide) scale only**,
  deliberately not scaling the through-wall depth axis, because the baked
  tool is pre-trimmed at the mounting face
  (`multiconnectContainerGeometry.ts:68-78`).
- The openConnect slot's clearance is not a knob at all: it is baked in as
  the difference between `head_type="head"` and `head_type="slot"`
  (`openGridSnapGeometry.ts:20-24`, `reference/openconnect/README.md`).

**Orientation.** The Multiconnect plate stands upright — height along the
app's Y (up), thickness along Z, mounting face at Z = plateThickness
(`multiconnectContainerGeometry.ts:35-40`). The existing Socket Tray lies
flat — thickness along Y, pockets opening upward at Y = thickness
(`socketTrayGeometry.ts:23-34`). Both use the app's Y-up frame, so an
upright back and a flat tray coexist in one coordinate system with no
relabeling.

## Step 5 — approaches for producing tray-with-back as ONE printable solid

Common to every approach: the part must be **one closed manifold triangle
soup**, because that is what every builder in this repo returns and what the
exporter consumes. The STL writer emits every mesh it is handed into a
single `solid sketchforge_design` block with no per-mesh separation
(`stlExport.ts:22-40`), and the export gathers the selection or all shapes
and maps each to its own mesh (`SketchForgeEditor.tsx:8420-8452`,
`:8453`). So exporting a tray shape and a plate shape together already
produces one FILE — but two disjoint volumes inside it, not one solid.

### Approach (a) — a new geometry module that generates tray + back together

**What it requires.** A new sibling file (name by analogy, e.g.
`apps/web/src/lib/mountedSocketTrayGeometry.ts`) that emits the whole
L-shaped part as one boundary representation: the tray's faces and pockets,
the back plate's faces, the mounting features, and the shared internal seam
where the two bodies meet, with the overlapping faces omitted rather than
emitted and later merged.

**What it reuses.** The construction pattern, not the code. The
OpenConnect Container is a working example of exactly this shape class — a
platform plus a slotted back wall in one soup
(`openConnectContainerGeometry.ts:82-88`, `:340-370`). The pocket
construction is already solved and readable in `socketTrayGeometry.ts`
(`:213-288`). The mounting cutter, if Multiconnect, is already baked and
exported as data: `MULTICONNECT_CHANNEL_OUTLINE`, `MULTICONNECT_HEAD_RADIUS`,
`MULTICONNECT_SLOT_CUT_DEPTH`, and the terminator arrays are all `export`ed
from `multiconnectSlotMesh.ts` (`:26-48`, `:50+`) — that file is **not** on
the do-not-touch list and importing from it is a read, not an edit. If
openConnect instead, `openConnectSlotMesh.ts` is the equivalent and
`openConnectContainerGeometry.ts` already exports `openConnectSlotGridCells`
and `transformedOutline` as reusable placement helpers (`:340-370`).

**What must be newly written.** The tray-plus-plate outline and all its
faces; the junction seam; a second copy of the pocket construction (the
existing one cannot be imported as a sub-part — `socketTrayGeometry.ts`
exports only whole-tray entry points, `:213`, `:290`); the slot or head
placement along the plate; and a new unit test file following the existing
contract (manifold check, exact directed-edge check, per-pocket raycasts
open-top-to-floor and solid-floor-to-bottom, per
`CLAUDE-LESSONS.md` and `tests/unit/socketTrayGeometry.test.ts`).

**Specific technical risk.** The junction. Where the vertical plate meets
the horizontal tray, two independently built face sets share an edge, and
`CLAUDE-LESSONS.md`'s exact-stitch entry is explicit that two construction
paths computing "the same" corner can disagree by a few ULPs and only at
larger coordinate magnitudes — passing on a small test case and failing
scaled up. At 240mm width this is the regime that lesson warns about. The
mitigation the lesson prescribes (build both sides of a seam through the
same shared transform function) has to be designed in from the start, not
retrofitted.

**Second, sharper risk — the slot channel exit.** If the mounting feature is
the Multiconnect slot, its channel opens out the plate's **bottom edge**
(`multiconnectContainerGeometry.ts:582-593`) and that opening is how the
plate slides down onto seated connectors. A tray joined at the plate's
bottom must not close or obstruct it. The geometry gives some room —
the channel occupies Z from the blind floor to the mounting face (5.85 to 10
at the wrench racks' 10mm thickness), while a forward-projecting tray starts
at the front face Z = 0 — but this is a layout constraint that has to be
decided explicitly, not discovered at print time.

**Do-not-touch verdict: CLEAN.** No edit to
`socketTrayGeometry.ts` or `multiconnectContainerGeometry.ts` is required.
This is the same conclusion `reference/socket-tray-recon.md` §3-4 reached
for the original tray, and it holds here for the same reason: every helper
in the Multiconnect module is local and unexported, so there is nothing to
import and nothing to widen.

### Approach (b) — compose the existing tray geometry with existing Snap/mount geometry at runtime

**What it requires.** A composition step that takes
`createSocketTrayGeometry(...)` and a mount geometry, places them, and
produces a single shape.

**What it reuses.** Both geometry builders unchanged, called through their
public entry points.

**What must be newly written.** The composition itself, and this is where
the approach splits into two variants with very different outcomes:

- **(b1) Concatenate the triangle soups.** Cheap: merge two position arrays,
  or hand the exporter two meshes. **It does not produce one solid.** Two
  interpenetrating closed volumes remain two volumes; the exporter writes
  them into one file under one solid name (`stlExport.ts:23`, `:39`) but the
  geometry is unchanged. `analyzeTriangleSoup` would report each as
  well-formed while the interpenetrating region is still there. This
  satisfies "one file", not "one printable solid", and the internal
  interpenetration is exactly the class of defect
  `CLAUDE-LESSONS.md`'s slicer-slit-fusion entry says geometry validation
  cannot catch.
- **(b2) Real boolean union.** The only way concatenation becomes one solid.
  This runs straight into the repo's most firmly banked lesson: `three-bvh-csg`
  SUBTRACTION reliably leaves open boundary edges wherever the cutter's
  boundary reaches the target's surface, and a union of two bodies that
  share a face is precisely that case (`CLAUDE-LESSONS.md`, "Prefer boundary
  representation over runtime CSG"; `openConnectContainerGeometry.ts:29-42`
  records the same failure being hit and abandoned in this repo). The
  alternative kernel, manifold-3d, is async-loaded while primitive builders
  must stay synchronous (`multiconnectContainerGeometry.ts:21-24`) — the
  existing `manifoldUnionMeshShape` path is gated to imported meshes, not
  primitives (`SketchForgeEditor.tsx:5240-5242`).

**Specific technical risk.** (b1) ships a part that looks right in every
check and is not one solid. (b2) contradicts the repo's central geometry
decision (`reference/DECISIONS.md`, "Boundary-rep/earcut over runtime CSG")
and inherits a failure mode already reproduced here on a minimal
box-minus-box case.

**Additional blocker specific to using the Snap primitive as the mount.**
`createOpenGridSnapGeometry` returns the *whole snap* — the push-fit body
that goes **into** the board plus its head (`openGridSnapGeometry.ts:47-49`,
9.4mm tall). That is the male part that seats in the board, not a feature to
add to the back of a tray. A tray would need the mating **slot**, which
lives in `openConnectSlotMesh.ts` / `openConnectContainerGeometry.ts`, or the
Multiconnect slot in `multiconnectSlotMesh.ts`. Composing the Snap geometry
onto a tray would model a tray with snaps growing out of its back, which is
a different (and possibly intended, but undecided) mechanical design.

**Do-not-touch verdict: CLEAN for (b1) and (b2)** as far as the two
protected modules go — composition would live in a new file or in
`shapeCatalog.ts`. The blockers here are geometric, not path-based.

### Approach (c) — extend the existing Socket Tray with an optional back — BLOCKER

Adding a back-plate option to `socketTrayGeometry.ts` (a `back?:` option, a
new variant branch) would mean **editing
`apps/web/src/lib/socketTrayGeometry.ts`, which is on the ABSOLUTE
DO-NOT-TOUCH list**, and would change the existing tray's module, contrary
to the owner's stated requirement that the existing tray stay exactly as it
is. Recorded here only so it is visibly ruled out. **Do not take this
approach.**

### Summary table

| Approach | One real solid? | Edits a do-not-touch module? | Principal risk |
|---|---|---|---|
| (a) new combined geometry module | Yes | **No** | ULP seam at the tray/plate junction; slot channel exit must stay clear |
| (b1) concatenate soups | **No** — two volumes in one file | No | Ships an interpenetrating part that passes every check |
| (b2) runtime boolean union | Yes, if the boolean holds | No | Contradicts the banked CSG decision; the exact failure is already on record here |
| (c) extend the existing tray module | Yes | **YES — blocker** | Ruled out |

## Step 6 — how the app would present it

### Option 1 — a variant on the existing `socketTray` kind

**Precedent exists and is the house pattern**, stated three times in the
catalog's own comments: Bin/Shelf is a property on one `openConnectContainer`
entry, not two entries (`shapeCatalog.ts:63-66`); boardType/snapBodyShape are
properties on one `openGridSnap` entry (`:68-71`); Plate/PegPlate is a
property (`multiconnectShapeType`) on one `multiconnectContainer` entry
(`:73-76`). The type-level shape of it is
`MulticonnectShapeType = "Plate" | "PegPlate"`
(`types/sketchforge.ts:142`, field at `:272`), selected by a `select` row in
the inspector (`ShapeInspector.tsx:352`, `:380`) which gates the extra
property block and the peg card (`:391`, `:784`).

**Cost.** It changes the existing Socket Tray's registration — its inspector
grows a Shape Type row, its geometry dispatch grows a branch, and
`socketTrayShapeRegistration.test.ts` (which asserts the default insert and
the shape→options mapping, 269 lines) needs updating. The owner's stated
requirement is a *second, separate thing*, so this option touches work the
brief says to leave alone.

### Option 2 — its own catalog entry and shape kind

Independent of the existing tray. The file list is the one already
established in `reference/reports/socket-tray-ui-recon.md` step 4, which
`fe3e829` then executed. **Re-confirmed against HEAD 6ffc28c** — all eight
files exist and each already carries socket-tray anchors to sit beside:

```
apps/web/src/types/sketchforge.ts                           332 lines  socketTray-hits=7
apps/web/src/lib/shapeCatalog.ts                            405 lines  socketTray-hits=28
apps/web/src/components/WorkplaneViewport.tsx              7767 lines  socketTray-hits=6
apps/web/src/components/SketchForgeEditor.tsx             10168 lines  socketTray-hits=3
apps/web/src/components/workplane/ShapeInspector.tsx       1218 lines  socketTray-hits=12
apps/web/src/lib/workplaneShapes.ts                         273 lines  socketTray-hits=3
apps/web/src/lib/skfProject.ts                             1308 lines  socketTray-hits=1
tests/unit/socketTrayShapeRegistration.test.ts              269 lines  socketTray-hits=34
```

Role per file, unchanged from that recon and verified present at HEAD:

| File | Role | Current anchor |
|---|---|---|
| `types/sketchforge.ts` | `ShapeKind` member, per-item record type, optional fields | `"socketTray"` at `:25`; `SocketTrayShapePocket` at `:156`; fields at `:285-286` |
| `lib/shapeCatalog.ts` | catalog entry, insert defaults, shape→options mapping, geometry helper, error translation | entry `:80`; defaults `:111-119`; mapping `:127-135`; geometry helper `:141-148`; message translation `:153-171` |
| `components/WorkplaneViewport.tsx` | geometry cache signature, render `case`, `complexEdges` kind | signature `:970-971`; case `:7257`; list `:7381` |
| `components/SketchForgeEditor.tsx` | export `case` | import `:97`; case `:2272` |
| `components/workplane/ShapeInspector.tsx` | property rows, unit labels, list card | rows `:410-414`; unit labels `:161`; card `SocketTrayPocketCard` at `:913`, mounted `:788` |
| `lib/workplaneShapes.ts` | fallback color, equality | color `:136`; equality `:244-245` |
| `lib/skfProject.ts` | `SHAPE_KINDS` whitelist | `:33` |
| new `tests/unit/*ShapeRegistration.test.ts` | registration test | pattern at `tests/unit/socketTrayShapeRegistration.test.ts` |

Plus the new geometry module from approach (a). **Neither do-not-touch
geometry module appears in either option's file list.**

**Cost.** Eight shared files edited additively plus two new files, and the
existing Socket Tray registration is untouched. This is the option that
matches the owner's "second, separate thing" framing.

One caveat carried forward from the earlier recon: `makeShapeFromAsset`
resolves any `presetId` through `multiconnectPresetById`
(`shapeCatalog.ts` preset branch, `multiconnectPresets.ts:60-62`), so it is
Multiconnect-specific. That only matters if the mounted tray ever wants
presets; a plain catalog entry does not touch it.

## Step 7 — print orientation, as a geometric observation

Stated from the geometry only. No slicer setting is recommended and no
profile was consulted.

The part is an L: a plate whose height runs along the app's Y with thickness
along Z (`multiconnectContainerGeometry.ts:35-40`), and a tray whose
thickness runs along Y with pockets opening upward at Y = thickness
(`socketTrayGeometry.ts:27-34`). The two limbs are perpendicular, so no
single build direction is parallel to both.

**Orientation A — mounting face flat on the bed** (the plate's Z = thickness
face down, the tray cantilevering horizontally):
- The slot cavities are blind cuts opening on that same mounting face
  (`multiconnectContainerGeometry.ts:41-46`), so they face the bed. Their
  4.15mm depth (`multiconnectSlotMesh.ts:30`) becomes a downward-facing
  cavity.
- Each pocket's axis is now horizontal. A pocket's cylindrical wall
  (`socketTrayGeometry.ts:259-281`) presents an unsupported upper half over
  its full diameter, which is 25mm at the coupon's largest pocket
  (`shapeCatalog.ts:64` region, diameter 25 at x = 210).
- The tray limb projects horizontally from the plate with nothing beneath it.

**Orientation B — tray bottom flat on the bed** (the tray's Y = 0 face down,
the plate rising vertically):
- Each pocket's axis is vertical, matching how the existing coupon is
  generated and how its floor is a flat cap at Y = thickness − depth
  (`socketTrayGeometry.ts:228`, `:282-284`). No pocket wall is unsupported.
- The plate rises perpendicular to the bed, so the slot channel runs
  vertically and the mounting face is vertical. The blind floor is then a
  vertical wall face, not a ceiling.
- The junction between the two limbs carries the whole plate's weight during
  the print as a tall thin wall on a flat base.

**Geometric facts that bear on either choice, without recommending one:**
- Every pocket is blind — solid material always lies below the floor
  (`socketTrayGeometry.ts:29-34`, `:247-248`), so no pocket creates a
  through-hole in any orientation.
- The Multiconnect slot is likewise blind, keeping 2.35mm of skin behind the
  floor at default thickness (`multiconnectContainerGeometry.ts:87`).
- Any surface facing downward at a shallow angle is an overhang. In
  orientation A the pocket walls' upper halves and the slot cavity ceilings
  qualify; in orientation B the underside of the tray where it meets the
  plate qualifies if the junction is a right angle with no fillet.
- `CLAUDE-LESSONS.md`'s slicer-slit-fusion entry applies to whichever
  orientation is chosen: any internal clearance narrower than a line width
  fuses regardless of geometry validity.

## Step 8 — unknowns a build prompt would have to settle

These cannot be resolved from the code.

1. **Which mounting system the back plate carries — Multiconnect slot or
   openConnect head/slot.** The lead finding above. The wrench racks use
   Multiconnect keyhole slots at 28mm (`multiconnectPresets.ts:33-35`); the
   existing DECISIONS entry names the OpenGrid Snap primitive, which is
   openConnect-headed (`openGridSnapGeometry.ts:17-24`). They are different
   profiles with different clearances and different baked data files. A
   build prompt must name one.
2. **If openConnect: whether the tray carries slots or snaps.** The Snap
   primitive is the male part that seats into the board
   (`openGridSnapGeometry.ts:47-49`); the female slot lives in
   `openConnectSlotMesh.ts`. Which one goes on the tray's back is a
   mechanical decision, not a code fact.
3. **Back plate dimensions.** Height, thickness, and width relative to the
   tray. The code supplies only floors: 6.5mm minimum thickness, 25mm
   minimum width and height (`multiconnectContainerGeometry.ts:83`, `:96`).
   The wrench racks' 240 × 60 × 10 is a validated recipe but is a plate on
   its own, not a plate carrying a cantilevered tray.
4. **How many mounting features and where.** Slot count follows from width
   and spacing (`multiconnectSlotCenters`, `:261-265`) — 8 at 240mm/28mm —
   but whether the mounted tray is 240mm wide at all is undecided
   (`reference/OPEN-ITEMS.md` records the production tray layout as
   undecided).
5. **Where the tray joins the plate, and at what height.** This determines
   whether the slot channel's bottom-edge exit stays clear (step 5) and
   whether the tray sits at the plate's bottom, partway up, or flush with
   its base. Nothing in the code implies a choice.
6. **Whether the junction gets a fillet or gusset.** The Shelf variant
   deliberately has none (`reference/DECISIONS.md`; simplification recorded
   at `openConnectContainerGeometry.ts:82-85`). Whether this part follows
   that precedent is a design call, and it changes the overhang picture in
   step 7.
7. **Load direction and cantilever strength.** A tray full of sockets hangs
   forward off the plate. Nothing in this repo models loads. Not a code
   question.
8. **Whether the mounted tray's pockets reuse the coupon's six diameters or
   the undecided 12-pocket production layout.** `reference/OPEN-ITEMS.md`
   records the production layout as undecided pending the coupon print, and
   the coupon is still unprinted (`reference/SESSION-STATE.md`).
9. **Pocket depth is still unvalidated.** 14mm remains the only estimate in
   the coupon (`reference/socket-tray-sampler-report.md`, Open Questions),
   and the physical gate has not been cleared. A mounted tray built on that
   number inherits the same uncertainty.

## Open questions (outside steps 1–8, not investigated)

- Whether the owner intends to print the `"multiConnect"`-head snap variant
  from the upstream SCAD (`opengrid_parametric_snap.scad:15`) to hang the
  wrench racks, or already has such connectors from elsewhere. This
  determines what physically exists on the wall today. Not investigated:
  outside steps 1–8 and not answerable from the repo.
- Whether an openGrid Snap variant with a Multiconnect head should ever be
  baked into this app. Out of scope; recorded only because the option exists
  upstream.
- The `reference/DECISIONS.md` entry naming the OpenGrid Snap as the back
  plate predates this recon's finding about the wrench racks. Whether it
  should be revised is the owner's call; no doc was edited this pass.

## Credential scan

Every command output pasted in this report was scanned for `ghp_`, `ghs_`,
`token`, `secret`, `password`: no hits. The report contains no credentials.
Command output includes only SHAs, file paths, line counts, and geometry
coordinates.

## SCOPE CHECK

```
$ git status --short          (after writing this report, before commit)
?? reference/reports/socket-tray-mounted-recon.md
```

**Files created:** `reference/reports/socket-tray-mounted-recon.md` (this
file). **Files modified: none.**

| Path | Action | Step |
|---|---|---|
| `apps/web/src/lib/socketTrayGeometry.ts` | read only (full) | 5, 7 |
| `apps/web/src/lib/multiconnectContainerGeometry.ts` | read only (`:1-120`, `:525-600`, greps) | 2b, 4 |
| `apps/web/src/lib/multiconnectSlotMesh.ts` | read only (`:1-95`) | 2b, 4 |
| `apps/web/src/lib/openGridSnapGeometry.ts` | read only (full) | 2a |
| `apps/web/src/lib/openGridSnapMesh.ts` | read only (numeric parse for bounding boxes) | 2a, 4 |
| `apps/web/src/lib/openConnectContainerGeometry.ts` | read only (`:1-100`, `:340-380`) | 2c, 5 |
| `apps/web/src/lib/openGridGeometry.ts` | read only (`:8-30`, greps) | 4 |
| `apps/web/src/lib/multiconnectPresets.ts` | read only (full) | 3 |
| `apps/web/src/lib/shapeCatalog.ts` | read only (`:55-125`, greps) | 3, 6 |
| `apps/web/src/lib/stlExport.ts` | read only | 5 |
| `apps/web/src/components/SketchForgeEditor.tsx` | read only (`:2140-2160`, `:3900-3935`, `:4535-4570`, `:8415-8460`, greps) | 2c, 5 |
| `apps/web/src/components/WorkplaneViewport.tsx` | read only (greps) | 2a |
| `apps/web/src/components/workplane/ShapeInspector.tsx` | read only (greps) | 2a, 6 |
| `apps/web/src/types/sketchforge.ts` | read only (greps) | 6 |
| `tests/unit/openGridSnapGeometry.test.ts` | read only (full) | 2a |
| `reference/openGrid.scad` | read only (greps) | 4 |
| `reference/multiconnect.scad` | read only (greps) | 2b, 4 |
| `reference/openconnect/*.scad`, `lib/*.scad` | read only (greps) | 2a, 4 |
| `reference/openconnect/README.md` | read only (full) | 2a |
| `reference/SESSION-STATE.md`, `OPEN-ITEMS.md`, `DECISIONS.md`, `KNOWN-FIXES.md` | read only | orientation |
| `reference/socket-tray-recon.md`, `socket-tray-sampler-report.md` | read only | orientation |
| `reference/reports/socket-tray-ui-recon.md`, `socket-tray-ui-build.md` | read only | 6 |
| `test-prints/README.md` | read only | 3 |
| `test-prints/*.stl` (7 files) | **not opened** | do-not-touch |
| `deploy/docker/*`, `.github/workflows/*`, `package*.json`, config files | **not touched, not opened** | do-not-touch |
| every existing `reference/` file | **not modified** | do-not-touch |

No code, test, STL, config, or existing-doc change. Nothing was built,
prototyped, stubbed, or scaffolded. No approach was chosen.
