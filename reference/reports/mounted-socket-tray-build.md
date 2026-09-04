# Mounted Socket Tray — build report

Builds a NEW primitive: a Multiconnect-style slotted back plate (no pegs)
with a shelf-like tray projecting forward from its bottom, carrying round
blind pockets, emitted as ONE solid. Committed locally only; NOT pushed
(owner tests first).

The existing flat Socket Tray is untouched — its geometry module, its tests,
its coupon STL, its UI registration and its defaults are all unchanged, and
a dedicated test asserts it. Neither protected geometry module was edited.

## Step 1 — clean tree, HEAD == origin/main

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
$ git fetch origin
$ git rev-parse HEAD origin/main
4eecc3752799297aa3045e23574f3dd228405708
4eecc3752799297aa3045e23574f3dd228405708
```

## Step 2 — slot-channel clearance (read-only, before any code)

**Finding: a forward-projecting tray cannot obstruct the channel at any
height, for any plate at or above the enforced minimum thickness. No STOP.**

Where the channel runs, from source:

| Axis | Extent | Source |
|---|---|---|
| Z (through-wall) | the rear `MULTICONNECT_SLOT_CUT_DEPTH` = **4.15mm** of the plate, measured from the mounting face | `multiconnectSlotMesh.ts:30`; `plateZPlanes` returns `blindFloorZ = 2.35 + (thickness − 6.5)`, `mountingFaceZ = blindFloorZ + 4.15` (`multiconnectContainerGeometry.ts:210-213`) |
| Y (run) | from the bottom edge `y = 0` up to the round top at `height − 13`, plus the baked dome | notch strips run down to `y = 0` (`:582`, `:584`); bottom edge opened at `:586-593`; `MULTICONNECT_SLOT_TOP_OFFSET = 13` (`:108`, used `:534`); SCAD `backHeight-13` (`reference/multiconnect.scad:80`) |
| X | `cx ± 10.15mm` at the head recess, `cx ± 7.65mm` at the mouth | `MULTICONNECT_HEAD_RADIUS`, `MULTICONNECT_NECK_RADIUS` (`multiconnectSlotMesh.ts:26-27`); channel outline `:39-48` |

Measured extent of the baked terminator, to confirm the dome never reaches
the plate's top edge:

```
$ node -e '<parse multiconnectSlotMesh.ts terminator arrays, min/max per axis>'
terminator WITH_DIMPLE: vertices 163
  across(X) -10.15 .. 10.15
  slide (Y) -2 .. 10.13     <- +Y is toward the round top
  depth (Z) 0 .. 4.15       <- 0 = blind floor, 4.15 = mounting face
terminator NO_DIMPLE: vertices 112
  (identical extents)
```

**Why the tray always clears it.** All slot geometry is measured from the
MOUNTING face, so extra plate thickness goes entirely into the front skin —
the blind floor moves away from the front face, never toward it
(`multiconnectContainerGeometry.ts:38-40` and the `plateZPlanes` comment at
`:201-210`). The tray attaches to the plate's front face and lives entirely
forward of it. The two therefore never share a Z band, at any Y, as long as

```
plateThickness  >=  MULTICONNECT_BACK_THICKNESS  =  6.5mm
              =  4.15mm cut  +  2.35mm skin
```

which is `MULTICONNECT_BACK_THICKNESS` (`:83`) and
`MULTICONNECT_BLIND_FLOOR_Z` (`:87`). At the minimum thickness there is
2.35mm of solid material between the channel's blind floor and the face the
tray joins; at the coupon's 10mm plate there is 5.85mm.

**Consequences taken into the build.** The tray needs no clearance rule of
its own and no height restriction — so no such guard was invented. The
guard that carries the guarantee is the plate-thickness floor, enforced by
`normalizeMountedSocketTrayPlateThickness` and pinned by a test. The
bottom-edge opening also stays clear: it sits at Z 65.85–70 on the coupon
while the tray occupies Z 0–60, so the combined bottom face carries the
channel notches in a band the tray never reaches.

## Step 3 — the validated wrench-rack plate numbers

From `WRENCH_RACK_BASE`, `apps/web/src/lib/multiconnectPresets.ts:29-42`.
That file's own header states these numbers match the printed STLs and must
not be tidied (`:8-13`).

| Parameter | Value | Cite |
|---|---|---|
| Plate width | **240mm** | `multiconnectPresets.ts:30` |
| Plate height | **60mm** | `:31` |
| Plate thickness | **10mm** (the `plateThickness` parameter, held in `depth`) | `:32` |
| Slot spacing | **28mm** | `:35` |
| Slot tolerance | **1.0** | `:37` |
| **Slot count** | **8** | derived: `floor(240 / 28) = 8` via `multiconnectSlotCenters` (`multiconnectContainerGeometry.ts:261-265`) |

Resulting slot centers, computed with that formula: **22, 50, 78, 106, 134,
162, 190, 218mm**. The new module reproduces this layout — verified by a
test — using `first = (plateWidth − (count − 1) × spacing) / 2`, which is
`(240 − 196) / 2 = 22`. These become the mounted tray's plate defaults.

## Step 4 — the geometry module

`apps/web/src/lib/mountedSocketTrayGeometry.ts` (new, 480 lines).

### The seam: designed out, not mitigated

The recon named the plate-to-tray junction as the primary risk: two
independently built face sets sharing an edge is the ULP-mismatch failure in
`CLAUDE-LESSONS.md`'s exact-stitch entry, which shows up only at larger
coordinate magnitudes — i.e. at this part's 240mm width.

**The plate and tray are not two bodies joined at a seam.** Together they
are one prism whose cross-section in the (Y, Z) plane is an L, extruded
along X:

```
     Z = 0                        Z = mountingFaceZ
Y=plateHeight              D +--------------+ C   plate top      (edge 2)
                             |              |
              plate front -> |              | <- mounting face   (edge 1)
                  (edge 3)   |              |    carries slot mouths
Y=trayThickness  F +---------+ E  inner corner
   tray top (edge 4)|                       |
   carries pockets  |                       |
         Y=0      A +-----------------------+ B   bottom          (edge 0)
                     tray front (edge 5)          carries channel exits
```

The L outline is built once as one array of six points
(`mountedSocketTrayGeometry.ts`, the `outline` array). Every face reads its
corners out of that array: the six side faces are the six outline edges
extruded from X = 0 to X = plateWidth, and the two end caps at X = 0 and
X = plateWidth are that same L polygon. Points D, E and F — the junction —
are ordinary entries consumed by reference on both sides. **There is no
second construction path to disagree with the first**, so shared vertices
are bit-identical because they are the same doubles, not because two
computations happened to agree.

Faces carrying features are emitted as earcut caps rather than plain quads:
the bottom face (channel exit notches), the mounting face (slot mouth
notches spliced from the baked mouth rim), and the tray top (pocket rims as
holes). The other three are plain rectangles read from the same outline.

No CSG anywhere. No mesh concatenation. The internal face between plate and
tray is never emitted because the outline never crosses that region.

### Shared data is imported, never copy-pasted

| From | Imported | Why |
|---|---|---|
| `multiconnectSlotMesh.ts` | `MULTICONNECT_CHANNEL_OUTLINE`, `MULTICONNECT_HEAD_RADIUS`, `MULTICONNECT_SLOT_CUT_DEPTH`, `MULTICONNECT_TERMINATOR_CLIP_Y`, the WITH_DIMPLE terminator arrays | the slot features come from the same baked source the validated plate uses |
| `multiconnectContainerGeometry.ts` | `MULTICONNECT_BACK_THICKNESS`, `MULTICONNECT_SLOT_TOP_OFFSET`, the plate/spacing/tolerance bounds | dimensional constants, read only |
| `socketTrayGeometry.ts` | `MIN_SOCKET_TRAY_FLOOR_THICKNESS`, `SOCKET_TRAY_POCKET_EDGE_CLEARANCE`, `SOCKET_TRAY_POCKET_GAP`, `SOCKET_TRAY_POCKET_SEGMENTS` | "the same rule the existing tray uses" is literally the same constant, not a duplicated number that can drift |

Both protected modules are imported from and neither is edited. The one
piece restated rather than imported is `buildTerminatorData` (the split of
the baked soup into kept surface plus mouth rim), because that function is
local and unexported in the plate module; the DATA it consumes is imported.

### Parameters

`plateWidth`, `plateHeight`, `plateThickness`, `slotSpacing`, `slotCount`,
`trayDepth`, `trayThickness`, `pocketDepth` (one for the whole tray), and
`pockets: { diameter, x, z }[]`. Slot tolerance is pinned at the
Multiconnect default of 1.0 — the value the validated racks use — and is not
exposed. The dimpled terminator is used; quick-release is not exposed.

### Validation guards

| Guard | Message matches | Rule |
|---|---|---|
| Pocket off the tray | `/edge/` | rim within `SOCKET_TRAY_POCKET_EDGE_CLEARANCE` (5mm) of any tray edge |
| Pockets overlapping | `/overlap/` | centers closer than `r_i + r_j + SOCKET_TRAY_POCKET_GAP` (4mm) |
| Floor too thin | `/minimum floor/` | `trayThickness − pocketDepth < MIN_SOCKET_TRAY_FLOOR_THICKNESS` (2mm) |
| Non-positive pocket depth | `/pocket depth/` | finite and > 0 |
| Tray taller than the plate | `/tray thickness/` | `trayThickness >= plateHeight` would self-intersect the L |
| Slot run off the plate | `/do not fit/` | outer slot's head extent within 0.5mm of a side edge |
| Non-positive tray depth/thickness | `/must be positive/` | — |
| **Plate too thin for a clear channel** | floored, not thrown | `plateThickness` clamped up to `MULTICONNECT_BACK_THICKNESS`; this is the step-2 clearance guarantee |

## Step 5 — geometry tests

`tests/unit/mountedSocketTrayGeometry.test.ts` (new). **40 tests, all
passing.**

```
$ npx vitest run --config tests/vitest.config.ts tests/unit/mountedSocketTrayGeometry.test.ts
 Test Files  1 passed (1)
      Tests  40 passed (40)
```

Coverage: watertight/manifold check; exact directed-edge check over the
whole mesh; **a dedicated inner-corner test** that isolates edges lying on
the plate-front/tray-top corner line and asserts each pairs exactly (with a
guard that the filter is non-empty, so it cannot pass vacuously); bounding
box; the dimensions helper; the wrench-rack slot layout; per-pocket
raycasts at the center and off-center proving open top-to-floor and solid
floor-to-bottom; between-pocket and front/back solid checks; **channel
unobstructed along its full run** at every one of the 8 slots, sampled at 9
heights, asserting void just inside the mounting face and solid at the blind
floor; mounting face solid between slots; material continuous across the
junction; every validation guard; and six further configurations (single
slot, minimum and thick plates, tall plate, shallow tray, two pocket rows)
each re-checked for manifoldness and exact directed edges.

**One diagnosis worth recording.** The channel test first failed at every
slot, but only at `y = 18` — exactly the tray's top face plane. A probe
showed why:

```
y=17.999  crossings@x=22: [0.0000, 65.8500]      <- tray+plate solid, channel void
y=18      crossings@x=22: [0.0000, 60.0000, 65.8500]   <- 3 crossings, parity broken
y=18.001  crossings@x=22: [60.0000, 65.8500]     <- plate only, channel void
```

The ray was grazing the tray-top face's own boundary edge at the inner
corner, which reports an extra crossing. The geometry is correct either side
of that plane. Fixed by bracketing the plane (`TRAY_THICKNESS ± 0.5`)
instead of sampling on it — not by loosening an assertion.

## Step 6 — UI registration

Additive across the same eight files the flat tray used, plus a new
registration test.

**Axis mapping.** The flat tray's build report established the rule that the
app's `height` field IS the Y-up dimension, `width` is X and `depth` is Z.
Applying the same rule here:

| User-facing | `WorkplaneShape` field | Axis |
|---|---|---|
| Plate Width | `width` | X |
| Plate Height | `height` | **Y (up)** |
| (full solid depth) | `depth` = tray projection + plate thickness | Z |
| Plate Thickness | `mountedTrayPlateThickness` | dedicated |
| Slot Spacing / Slot Count | `mountedTraySlotSpacing` / `mountedTraySlotCount` | dedicated |
| Tray Depth | `mountedTrayProjection` | dedicated |
| Tray Thickness | `mountedTrayThickness` | dedicated |
| Pocket Depth | `mountedTrayPocketDepth` | dedicated |
| Pockets | `mountedTrayPockets` | dedicated |

The difference from the flat tray is that this part stands up against a
board, so the Y-up dimension is the plate's height rather than the tray's
thickness. `shape.depth` holds the solid's **full** Z extent so the
selection frame matches the mesh; the Tray Depth and Plate Thickness rows
each write their own field and resync `depth`. A test pins that
`shape.depth` equals the geometry's Z extent for the default insert.

| File | Change |
|---|---|
| `types/sketchforge.ts` | `"mountedSocketTray"` in `ShapeKind`; `MountedSocketTrayShapePocket`; seven optional fields |
| `lib/shapeCatalog.ts` | catalog entry in the OpenGrid section (colour `#0ea5a4`, unique in the category); coupon defaults; `mountedSocketTrayOptionsForShape`; `createMountedSocketTrayGeometryForShape` with a bare-tray fallback; `mountedSocketTrayLayoutError`; insert defaults |
| `components/WorkplaneViewport.tsx` | import; seven fields in the geometry cache signature; `case "mountedSocketTray"`; kind in `complexEdges` |
| `components/SketchForgeEditor.tsx` | import; `case "mountedSocketTray"` in the export arm |
| `components/workplane/ShapeInspector.tsx` | imports; five new mm labels in `propertyUsesLengthUnit` (**Slot Count deliberately excluded** — it is a count, not a length); the eight property rows; `MountedSocketTrayPocketCard` and its mount |
| `lib/workplaneShapes.ts` | `fallbackSolidColor` branch; seven comparisons in `workplaneShapesEqual` |
| `lib/skfProject.ts` | kind in the `SHAPE_KINDS` whitelist |
| `tests/unit/mountedSocketTrayShapeRegistration.test.ts` | new, 12 tests |

All rows use the existing shared `RangeProperty` control; no new input
component was written. The pocket card is the existing pattern (Diameter /
X / Z per row, add and remove, inline `role="alert"` error).

```
$ npx tsc -p apps/web/tsconfig.json --noEmit
tsc exit=0
$ npx vitest run --config tests/vitest.config.ts tests/unit/mountedSocketTrayShapeRegistration.test.ts
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

One of those 12 asserts the flat Socket Tray's registration is unchanged
(id, name, colour, 240 × 60 × 18, pocket depth 14, six pockets) and that the
mounted tray's fields never appear on it.

## Step 7 — default insert (a coupon, not a production tray)

Plate values are step 3 verbatim. Tray values are the brief's.

| Value | Number | Where it comes from |
|---|---|---|
| Plate width / height / thickness | 240 / 60 / 10mm | step 3 |
| Slot spacing / count | 28mm / 8 | step 3 (8 = `floor(240 / 28)`) |
| Tray depth (projection) | 60mm | brief |
| Tray thickness | 18mm | brief |
| Pocket depth | 14mm | brief |
| **Floor under each pocket** | **4mm** | `18 − 14 = 4`, above the 2mm minimum |
| Pockets | 3, diameters 14 / 19 / 25mm | brief |

**Pocket placement arithmetic.** End margins are 30mm, the same convention
the flat coupon uses:

```
span between the first and last centre = 240 − 30 − 30 = 180mm
pitch                                  = 180 / (3 − 1)  = 90mm
centres                                = 30, 120, 210mm
z (tray depth centreline)              = 60 / 2 = 30mm
```

Clearance check against the imported guards:

| Check | Worst case | Limit | Margin |
|---|---|---|---|
| Left edge | `30 − 7 = 23mm` | 5mm | 18mm |
| Right edge | `240 − (210 + 12.5) = 17.5mm` | 5mm | 12.5mm |
| Front / back edge | `30 − 12.5 = 17.5mm` | 5mm | 12.5mm |
| Pocket gap (14↔19) | `90 − 7 − 9.5 = 73.5mm` | 4mm | 69.5mm |
| Pocket gap (19↔25) | `90 − 9.5 − 12.5 = 68mm` | 4mm | 64mm |
| Floor | `18 − 14 = 4mm` | 2mm | 2mm |

**Footprint: 240mm (X) × 70mm (Z) × 60mm tall**, the 70 being tray depth 60
plus plate thickness 10. The 240mm span leaves **16mm spare** under the
Bambu X1C's 256mm bed.

## Step 8 — coupon STL

New file, no collision: **`test-prints/mounted-socket-tray-coupon.stl`**,
written by the new `scripts/generate-mounted-socket-tray-coupon.mjs` (same
pattern as the flat tray's generator: it calls the real primitive rather
than reimplementing it).

```
$ node --experimental-strip-types scripts/generate-mounted-socket-tray-coupon.mjs
Wrote /Apps/marlin-cad/test-prints/mounted-socket-tray-coupon.stl: 3524 triangles

$ git status --short test-prints/
?? test-prints/mounted-socket-tray-coupon.stl
```

Only an untracked entry — no existing file under `test-prints/` is modified.
Byte-identity re-verified per file against HEAD:

```
identical: wrench-rack-metric-1.stl
identical: wrench-rack-metric-2.stl
identical: wrench-rack-metric-3.stl
identical: wrench-rack-sae-1.stl
identical: wrench-rack-sae-2.stl
identical: wrench-rack-sae-3.stl
identical: socket-tray-sampler.stl
```

Note on the generator: unlike the flat tray's module, this primitive imports
through the app's `@/...` path alias (that is how it reuses the baked slot
mesh instead of copying it), which plain node cannot resolve. The script
registers a five-line resolve hook inline as a `data:` URL. No dependency
was added and no config file was touched.

## Step 9 — raycasting the exported STL

Run against the written file, parsed back from disk and converted from the
file's Z-up frame to scene coordinates — not against the in-memory mesh.

```
file: test-prints/mounted-socket-tray-coupon.stl
  solid name : solid mounted_socket_tray_coupon
  facets     : 3524
  vertices   : 10572  (= facets x 3: true)
  scene bbox : X 0..240   Y 0..60   Z 0..70
  footprint  : 240.00 x 70.00 mm, height 60.00 mm
  boundary edges 0, non-manifold edges 0

  pockets (expect open from tray top 18 down to floor 4, solid 4 -> 0):
  [PASS] pocket d=14 centre: crossings [0.0000, 4.0000]
  [PASS] pocket d=14 off-centre: crossings [0.0000, 4.0000]
  [PASS] pocket d=19 centre: crossings [0.0000, 4.0000]
  [PASS] pocket d=19 off-centre: crossings [0.0000, 4.0000]
  [PASS] pocket d=25 centre: crossings [0.0000, 4.0000]
  [PASS] pocket d=25 off-centre: crossings [0.0000, 4.0000]

  between pockets (expect solid slab 0 -> 18):
  [PASS] x=75: crossings [0.0000, 18.0000]
  [PASS] x=165: crossings [0.0000, 18.0000]

  slot channel (expect void just inside the mounting face z=70, solid at the blind floor z=65.85):
  [PASS] slot at x=22: channel open along its full run, blind floor solid
  [PASS] slot at x=50: channel open along its full run, blind floor solid
  [PASS] slot at x=78: channel open along its full run, blind floor solid
  [PASS] slot at x=106: channel open along its full run, blind floor solid
  [PASS] slot at x=134: channel open along its full run, blind floor solid
  [PASS] slot at x=162: channel open along its full run, blind floor solid
  [PASS] slot at x=190: channel open along its full run, blind floor solid
  [PASS] slot at x=218: channel open along its full run, blind floor solid

  between slots (expect mounting face solid):
  [PASS] x=36: solid at the mounting face
  [PASS] x=64: solid at the mounting face
  [PASS] x=92: solid at the mounting face
  [PASS] x=120: solid at the mounting face
  [PASS] x=148: solid at the mounting face
  [PASS] x=176: solid at the mounting face
  [PASS] x=204: solid at the mounting face

  RESULT: ALL CHECKS PASSED
```

Every pocket reads open to its 4mm floor and solid below it. No pocket reads
sealed. The exported file is watertight at the 1e-4 quantization the EPS
lesson prescribes for float-derived data.

## Step 10 — full unit suite

```
$ npm test
 Test Files  49 passed (49)
      Tests  378 passed (378)
   Duration  2.20s
```

378 across 49 files, up from 326 across 47: **+52 tests** (40 geometry + 12
registration) in **+2 files**. Counts read from this run, not inherited.

The existing socket tray and wrench rack suites re-run explicitly:

```
$ npx vitest run --config tests/vitest.config.ts \
    tests/unit/socketTrayGeometry.test.ts \
    tests/unit/socketTrayShapeRegistration.test.ts \
    tests/unit/multiconnectPresets.test.ts \
    tests/unit/multiconnectContainerGeometry.test.ts
 Test Files  4 passed (4)
      Tests  85 passed (85)
```

`socketTrayShapeRegistration.test.ts` is the suite that pins the flat
coupon's byte-identity through the real STL writer, and
`multiconnectPresets.test.ts` pins the wrench rack presets. Both pass
unchanged.

Protected paths, confirmed untouched by diff:

```
$ git diff --stat HEAD -- test-prints/ \
    apps/web/src/lib/socketTrayGeometry.ts \
    apps/web/src/lib/multiconnectContainerGeometry.ts \
    tests/unit/socketTrayGeometry.test.ts \
    tests/unit/socketTrayShapeRegistration.test.ts
(no output — every protected path unchanged)
```

## Step 11 — dev server

A stale `next-server` from an earlier session held port 3000; it was stopped
and the server restarted so the reported pid is definitely serving this
code.

```
$ npm run dev          (setsid nohup, so it outlives this session)
   ▲ Next.js 15.5.18
   - Local:        http://localhost:3000
 ✓ Ready in 1028ms
 ✓ Compiled / in 1782ms (1160 modules)
 GET / 200 in 2182ms

$ curl -s -o index.html -w '%{http_code}' http://localhost:3000/
GET / -> HTTP 200, 12040 bytes

$ ss -ltnp | grep ':3000 '
LISTEN 0 511 *:3000 *:* users:(("next-server (v1",pid=60927,fd=22))
```

**What was checked.** The insert menu is client-rendered and only populates
when opened, so its labels are not in the SSR HTML; the served JavaScript
chunk is the evidence, and there is no browser-driving e2e harness in this
repo (`tests/e2e/` holds two OCCT kernel tests). Each of the five chunks the
page references was fetched from the running server and searched:

```
found "Mounted Socket Tray" in /_next/static/chunks/app/page.js
found "mountedSocketTray"   in /_next/static/chunks/app/page.js
found "mounted-socket-tray" in /_next/static/chunks/app/page.js
found "Plate Thickness"     in /_next/static/chunks/app/page.js
found "Slot Count"          in /_next/static/chunks/app/page.js
found "Tray Depth"          in /_next/static/chunks/app/page.js
```

Both trays coexist in the served bundle — "Socket Tray" 17 occurrences,
"Mounted Socket Tray" 7, alongside "OpenGrid Snap", "Multiconnect
Container" and the wrench rack presets.

**dev server left running: `next-server` pid 60927 on port 3000.**

## Open questions

1. **Print orientation is unresolved and unprinted.** The part is an L, so
   no build direction is parallel to both limbs. Laid tray-down (the whole
   bottom face is flat and 240 × 70mm) the pockets print axis-vertical with
   no unsupported wall, but the 60mm plate rises as a tall thin wall off
   that base. Laid mounting-face-down the plate is fully supported but each
   pocket becomes a horizontal bore with an unsupported upper half, 25mm
   across at the largest. Stated as geometry; no slicer was consulted.
2. **The junction has no fillet or gusset.** The OpenConnect Shelf
   deliberately has none, and that precedent was followed, but this tray
   carries a forward cantilevered load that the Shelf's own validation does
   not cover.
3. **Pocket depth is still the unvalidated 14mm** carried over from the flat
   coupon, which remains unprinted. This coupon inherits that uncertainty.
4. **`shape.depth` is kept in sync by the inspector**, not derived. The
   geometry reads the dedicated fields, so any drift (a hand-edited `.skf`,
   a field set elsewhere) would only mis-size the selection frame, not the
   part. A derived-on-read alternative was not built because it would change
   `makeShapeFromAsset`'s shared width/height/depth chain.
5. **Slot tolerance is pinned at 1.0** and not exposed. The validated racks
   use 1.0, but if the owner's connectors need the 0.925–1.075 range, that
   is a new parameter.
6. **No `test-prints/README.md` entry was added** for the new coupon. That
   file is under `test-prints/`, which is do-not-touch this pass. Without it
   the coupon is undocumented in that directory's own index.

## SCOPE CHECK — every file touched, mapped to the step that required it

| File | Action | Step |
|---|---|---|
| `apps/web/src/lib/mountedSocketTrayGeometry.ts` | **created** | 4 |
| `tests/unit/mountedSocketTrayGeometry.test.ts` | **created** | 5 |
| `tests/unit/mountedSocketTrayShapeRegistration.test.ts` | **created** | 6 |
| `scripts/generate-mounted-socket-tray-coupon.mjs` | **created** | 8 |
| `test-prints/mounted-socket-tray-coupon.stl` | **created** (new filename) | 8 |
| `reference/reports/mounted-socket-tray-build.md` | **created** (this report) | deliverable |
| `apps/web/src/types/sketchforge.ts` | edited (+kind, +pocket type, +7 fields) | 6 |
| `apps/web/src/lib/shapeCatalog.ts` | edited (+entry, +defaults, +mapping/geometry/error helpers, +insert defaults) | 6, 7 |
| `apps/web/src/components/WorkplaneViewport.tsx` | edited (+import, +signature fields, +case, +complexEdges kind) | 6 |
| `apps/web/src/components/SketchForgeEditor.tsx` | edited (+import, +case) | 6 |
| `apps/web/src/components/workplane/ShapeInspector.tsx` | edited (+imports, +unit labels, +property block, +card and mount) | 6 |
| `apps/web/src/lib/workplaneShapes.ts` | edited (+colour, +equality) | 6 |
| `apps/web/src/lib/skfProject.ts` | edited (+kind in whitelist) | 6 |
| `apps/web/src/lib/multiconnectContainerGeometry.ts` | **imported from, not edited** | 2, 4 |
| `apps/web/src/lib/socketTrayGeometry.ts` | **imported from, not edited** | 4 |
| `apps/web/src/lib/multiconnectSlotMesh.ts` | **imported from, not edited** (not on the do-not-touch list) | 4 |
| `tests/unit/socketTrayGeometry.test.ts`, `tests/unit/socketTrayShapeRegistration.test.ts` | **not touched**, re-run green | 10 |
| `test-prints/*.stl` (7 existing), `test-prints/README.md` | **not touched**, byte-identity verified | 8, 10 |
| `deploy/docker/*`, `.github/workflows/*`, `package*.json`, every config file | **not touched** | do-not-touch |
| `reference/` existing files | **not modified** | do-not-touch |
| scratchpad (outside the repo): `verify-stl.mjs`, `probe.test.ts`, `dev.log`, `index.html`, `chunks.txt` | temporary evidence | 5, 9, 11 |

No new dependencies. No config, build-script, or workflow change. No runtime
CSG. Nothing outside steps 1–12.

## Credential scan

All command output pasted above was scanned for `ghp_`, `ghs_`, `token`,
`secret`, `password`: no hits. Output contains only SHAs, paths, geometry
coordinates, counts and process ids.
