# Socket Tray UI registration — build report

Registers the Socket Tray in the app UI (shape catalog entry + inspector)
following the Multiconnect registration pattern from `10982d5`, per the
build map in `reference/reports/socket-tray-ui-recon.md`. Committed
locally only; NOT pushed (owner tests first). Neither geometry module was
edited. Line numbers cite the working tree after these edits unless marked
"at 1827a84".

## Step 1 — clean tree, HEAD == origin/main

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
$ git fetch origin
$ git rev-parse HEAD origin/main
1827a8446dc1caab164f8eace8640b3ba864c7b0
1827a8446dc1caab164f8eace8640b3ba864c7b0
```

## Step 2 — shape type and fields (`apps/web/src/types/sketchforge.ts`)

- `"socketTray"` added to the `ShapeKind` union (`:25`).
- `SocketTrayShapePocket = { diameter; x; z }` (`:150-156`): the per-pocket
  list record. No per-pocket depth, per the brief.
- `WorkplaneShape` gains `socketTrayPocketDepth?: number` and
  `socketTrayPockets?: SocketTrayShapePocket[]` (`:282-286`). Tray width /
  depth / thickness live in the shared `width` / `depth` / `height` fields
  (see the axis mapping below), the same way the Multiconnect plate keeps
  its width / height / thickness in `width` / `height` / `depth`.

## Step 3 — shape catalog entry and defaults (`apps/web/src/lib/shapeCatalog.ts`)

- Entry `{ id: "socket-tray", name: "Socket Tray", kind: "socketTray",
  color: "#3b82f6", category: OPENGRID_CATEGORY }` placed directly after the
  Multiconnect Container entry (`:77-80`), so it lands in the same
  "OpenGrid" section of the insert menu. Box icon stand-in, like every other
  OpenGrid entry. The color is unique within the category (asserted by the
  registration test).
- Defaults (`:104-119`): `DEFAULT_SOCKET_TRAY_SHAPE_POCKET_DEPTH = 14` and
  `DEFAULT_SOCKET_TRAY_SHAPE_POCKETS` = the six coupon pockets, diameters
  14 / 15 / 19 / 20.7 / 23 / 25 at x = 30 / 66 / 102 / 138 / 174 / 210, z =
  30. Width / depth / thickness come from the module's own defaults through
  `socketTrayDimensions({})` (`:328`), which are 240 / 60 / 18
  (`socketTrayGeometry.ts:36-38`).
- **The brief's values and the sampler report's values agree.** Checked
  against `reference/socket-tray-sampler-report.md` (dimensions table and
  the "6 pocket diameters and positions" table) and against
  `scripts/generate-socket-tray-sampler.mjs:42-51`: 240 × 60 × 18, depth 14,
  the same six diameters and centers. Nothing differed.
- `makeShapeFromAsset` (`:328-332`, `:395-396`): height/width/depth chains
  extended with the tray defaults; `socketTrayPocketDepth` and a fresh copy
  of the pocket list set only for this kind. The insert owns its own array
  (the test asserts it is not the shared constant).

## Step 4 — render arm, export arm, and the axis mapping

**Mapping helper** (`shapeCatalog.ts:121-147`):
`socketTrayOptionsForShape(shape)` builds the module's `SocketTrayOptions`
as `{ width: shapeWidth(shape), depth: shapeDepth(shape), thickness:
shape.height, pockets: socketTrayPockets.map(p => ({ ...p, depth:
socketTrayPocketDepth })) }`. `createSocketTrayGeometryForShape` calls
`createSocketTrayGeometry` and, if the module throws, rebuilds with
`pockets: []` (the bare tray) so render and export never crash.

**Axis mapping chosen:**

| User-facing | `WorkplaneShape` field | Module option | Axis |
|---|---|---|---|
| Width | `width` | `width` | X |
| Depth | `depth` | `depth` | Z |
| Thickness | `height` | `thickness` | Y (up) |

Justification:
- The module's frame is "X = width [0, width] (left-right), Y = thickness
  [0, thickness] (up, matches this app's Y-up scene convention), Z = depth
  [0, depth] (front-back)" (`apps/web/src/lib/socketTrayGeometry.ts:27-29`).
- The app's own box mesh confirms `height` is the Y-up dimension: its
  vertices run `y` from `0` to `height` with `x = ±width/2`, `z = ±depth/2`
  (`apps/web/src/components/SketchForgeEditor.tsx:1786-1802`); the viewport
  places every shape's group at `y = elevation + height/2` and `addMesh`
  subtracts `height/2` (`WorkplaneViewport.tsx:7097`, `:7358`); the
  export's `transformMesh` uses `centerY = height/2` (`SketchForgeEditor.tsx:1763`).
- Precedent: the Multiconnect plate maps its `plateThickness` to
  `shape.depth` because its thickness runs along Z; here thickness runs
  along Y, so it maps to `shape.height`.

**Viewport render arm** (`WorkplaneViewport.tsx`): import (`:36`); the two
new fields in `shapeGeometrySignature`, the geometry cache key (`:970-971`);
`case "socketTray"` in `createShapeObject` (`:7257-7262`), passing the
helper's geometry straight to `addMesh` with no offset, exactly as the
Multiconnect case does; kind added to the `complexEdges` list (`:7381`).

**Editor export arm** (`SketchForgeEditor.tsx`): import (`:97`);
`case "socketTray"` in `buildGeometryMeshForShape` (`:2272-2276`), same
shared-cache-then-clone pattern.

**Frame observation (no change made).** Measured with the real modules
(node, scratchpad-only alias loader):

```
BBOX multiconnect plate 240x60x10 min [0, 0, 0] max [240, 60, 10]
opengrid board (defaults)          min [-56, 0, -56] max [56, 6.8, 56]
opengrid snap                      min [-12.795, 0, -13.195] max [12.795, 9.4, 12.795]
socket tray (defaults, no pockets) min [0, 0, 0] max [240, 18, 60]
```

The Multiconnect plate is not X/Z-centered and is passed through unchanged,
so the tray follows the identical path. The viewport rebases only Y
(`putGeometryOnBase`, `WorkplaneViewport.tsx:7520-7526`) and the selection
frame is built from `shapeCenter` + `shapeLocalExtents` (`:1593-1594`), not
from the mesh. So for both the plate and the tray the mesh's X/Z corner
sits at the shape's anchor while the selection frame is centered on it.
This matches the validated Multiconnect behavior and was left alone;
listed under open questions.

## Step 5 — inspector (`apps/web/src/components/workplane/ShapeInspector.tsx`)

- Imports (`:75-76`).
- Property rows (`:402-416`), all through the existing `RangeProperty`
  control via the shared `ShapePropertyConfig` path:

| Label | value | min | max | step | writes |
|---|---|---|---|---|---|
| Width | `width` | 10 (= 2 × edge clearance) | 320 | 0.5 | `setWidth` (existing helper) |
| Depth | `depth` | 10 | 320 | 0.5 | `setDepth` (existing helper) |
| Thickness | `shape.height` | `MIN_SOCKET_TRAY_FLOOR_THICKNESS` (2) | 60 | 0.5 | `setHeight` (existing helper) |
| Pocket Depth | `socketTrayPocketDepth` | 0.5 | 60 | 0.5 | `onUpdate({ socketTrayPocketDepth })` |

- Unit handling: "Depth" and "Pocket Depth" added to the mm-label list and
  `/^Pocket \d+ [XZ]$/` added as a pattern (`:161-168`), so every tray
  field converts and shows a unit like the existing mm fields; "Pocket N
  Diameter" was already covered by the `endsWith("Diameter")` rule. No
  other shape uses a bare "Depth" label (they use "Length"), so nothing
  else changes.
- Pocket card `SocketTrayPocketCard` (`:904-990`), a line-for-line copy of
  `MulticonnectPegCard`: mounted for the kind (`:787-789`); rows are
  `Pocket N Diameter` (min 2, max 60, step 0.1), `Pocket N X` (0..width,
  step 0.5), `Pocket N Z` (0..depth, step 0.5), each editing its index in
  the array; "Remove Pocket N" filters by index; "Add Pocket" appends
  `{ diameter: 20, x: last ? last.x + 36 : 30, z: depth / 2 }` exactly as
  specified; `socketTrayLayoutError(shape)` runs the geometry module on
  every render and shows the translated message as a `role="alert"`
  paragraph while the viewport falls back to the bare tray.
- Message translation (`shapeCatalog.ts:149-172`) covers the module's four
  rejections (`socketTrayGeometry.ts:119`, `:123`, `:133`, `:141`): overlap /
  too-thin wall, edge clearance, minimum floor, invalid values; anything
  else passes through verbatim. Limits in the messages are the module's
  exported constants, not literals.

## Step 6 — color, equality, .skf whitelist

- `fallbackSolidColor`: `"#3b82f6"` for the kind (`workplaneShapes.ts:136`).
- `workplaneShapesEqual`: both new fields compared, the pocket list by
  reference like `multiconnectPegs` (`:244-245`).
- `SHAPE_KINDS` gains `"socketTray"` (`skfProject.ts:33`). Serialization is
  otherwise a generic spread, so the two fields round-trip with no further
  change (asserted by the test).

## Step 7 — coordinate convention check (read-only finding)

**Pocket x is NOT mirrored. No STOP.** Evidence:

- The module states its x is plain left-to-right geometry space with no
  as-mounted mirror, because the tray lies flat (`socketTrayGeometry.ts:23-27`).
- The home camera is at `(118, 96, 118)` looking at the origin with Y up
  (`WorkplaneViewport.tsx:80-81`, `:5178`). Screen-right for that camera is
  the direction `(+X, −Z)/√2`, so increasing geometry x moves right on
  screen. The Multiconnect mirror exists because its front face is viewed
  from the wall side; nothing like that applies here.
- No mirror is applied anywhere in the tray's path: the viewport case
  passes geometry through unchanged (`:7257-7262`); the export's
  `transformMesh` multiplies by `mirrorSign(shape.mirrorX)`, which is `+1`
  when the flag is unset (`SketchForgeEditor.tsx:1772-1779`,
  `workplaneShapes.ts:149-151`); the STL writer maps `[x, y, z] → [x, −z, y]`
  and keeps x (`meshCoordinates.ts:9-11`).
- The exported coupon's pockets land at file-x = 30 … 210 in order, the
  same as the printed coupon (step 9 below).

Side observation, no change: the module names Z = 0 "front" and Z = depth
"back" (`socketTrayGeometry.ts:252-253`); from the home camera, +Z is toward
the viewer, so the module's "back" face is the nearer one. The default
pockets sit on the z = 30 centerline of a 60mm tray, so this has no visible
effect on the coupon. Only x was asked about.

## Step 8 — registration test (`tests/unit/socketTrayShapeRegistration.test.ts`, new)

Seven tests, mirroring `multiconnectShapeRegistration.test.ts`:

1. catalog entry in "OpenGrid", unique color in the category,
   `fallbackSolidColor` matches, entry present in the OpenGrid menu group;
2. default insert is 240 × 60 × 18, pocket depth 14, the six coupon
   pockets; the module accepts it and the layout error is null;
3. shape → options mapping (width/depth pass through, `height` →
   `thickness`, shared depth on every pocket, empty list → `[]`);
4. `.skf` round-trip preserves both fields and satisfies
   `workplaneShapesEqual`;
5. the app's geometry for a default insert is byte-identical
   (`Object.is` per float) to the module's direct output for the coupon
   options, with `minY === 0` so neither arm's Y-rebase moves it;
6. the export path reproduces the coupon STL (step 9);
7. invalid layouts (overlap, edge, thin floor) give the friendly messages
   and the fallback geometry is the six-rectangle bare tray.

```
$ npx vitest run --config tests/vitest.config.ts tests/unit/socketTrayShapeRegistration.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
$ npx tsc -p apps/web/tsconfig.json --noEmit
tsc exit=0
```

The `case "socketTray"` lines inside the viewport and editor components
are exercised by the typecheck and by the served bundle (step 11), not by
a unit test: both components are module-private, browser-only files, the
same limitation the Multiconnect test has.

## Step 9 — export proof against `test-prints/socket-tray-sampler.stl`

**Method.** The app's export chain is `buildGeometryMeshForShape` →
`bufferGeometryToMeshData` → `transformMesh` → `exportMeshesToStl`
(`SketchForgeEditor.tsx:2153-2293`, `:1882-1907`, `:1762-1784`;
`stlExport.ts:22-41`). The first three live inside the editor component and
cannot be imported headlessly, so the proof reproduces their three
operations on the app's own geometry helper and then calls the real
exporter: (1) non-indexed positions, (2) rebase to Y = 0 only when
|minY| > 1e-6 (asserted to be a no-op), (3) `transformMesh` for a default
insert at x = 0, z = 0, elevation 0, no rotation, no mirror, which is the
identity. Done twice: inside the registration test (in-suite, using the
existing vitest harness) and once more as a scratchpad node run to produce
a file for `sha256sum` / `cmp`.

**Format is the same (ASCII STL), so byte-identity was checked first and
does not hold, for two structural reasons:**

```
$ sha256sum
25a4455415d8b37688505433a464dc65ddd1b92067f44510ec4accbc93ca1abb  test-prints/socket-tray-sampler.stl
d3aa33e0297afc143e6446bf003d776dd2f2dbc7721646195741a22492bd069f  app-export.stl
$ cmp
test-prints/socket-tray-sampler.stl app-export.stl differ: byte 8, line 1
$ head -1 of each
solid socket_tray_sampler
solid sketchforge_design
```

1. The solid name: the coupon generator names its solid, the app names
   every export `sketchforge_design` (`stlExport.ts:23`).
2. Precision: the coupon was written from the module's doubles
   (`generate-socket-tray-sampler.mjs:51-82`); the app path reads the
   module's `Float32BufferAttribute` (`socketTrayGeometry.ts:292`), so
   coordinates agree to float32 precision. Example, line 5 of each:

```
coupon : vertex 197.56019091659755 -31.22521425411951 18
export : vertex 197.56019592285156 -31.2252140045166  18
```

**So the structural comparison was done, and passes:**

```
$ facet counts
app-export.stl:1548
test-prints/socket-tray-sampler.stl:1548
$ vertex-by-vertex: count 4644 vs 4644
max |delta| over all 13932 coordinates = 7.3423657056537195e-06
coupon bbox (STL Z-up) min/max [0.0, -60.0, 0.0, 240.0, 0.0, 18.0]
export bbox (STL Z-up) min/max [0.0, -60.0, 0.0, 240.0, 0.0, 18.0]
```

- Triangle count identical (1,548), in the same order.
- Every one of the 4,644 vertices matches its counterpart within 7.4e-6 mm
  (float32 resolution at 240 mm is about 1.5e-5).
- Bounding box identical: X 0..240, file-Y −60..0, file-Z 0..18.
- Raycasts (in the registration test, on the geometry the app builds):
  each of the six pocket centers is open from the top face (Y = 18) down to
  its floor (Y = 4) and solid from the floor to the bottom (Y = 0); the five
  midpoints between pockets are solid top to bottom. Same checks as
  `tests/unit/socketTrayGeometry.test.ts:85-136`.

## Step 10 — full unit suite and test-prints check

```
$ npm test
 Test Files  47 passed (47)
      Tests  326 passed (326)
   Start at  09:04:10
   Duration  2.13s

$ git status --short test-prints/
(exit 0)                      <- nothing listed: no file under test-prints/ modified
$ git status --short
 M apps/web/src/components/SketchForgeEditor.tsx
 M apps/web/src/components/WorkplaneViewport.tsx
 M apps/web/src/components/workplane/ShapeInspector.tsx
 M apps/web/src/lib/shapeCatalog.ts
 M apps/web/src/lib/skfProject.ts
 M apps/web/src/lib/workplaneShapes.ts
 M apps/web/src/types/sketchforge.ts
?? tests/unit/socketTrayShapeRegistration.test.ts
```

326 = the 319 that passed before this task plus the 7 new tests.

## Step 11 — dev server

Started with `npm run dev` (`next dev apps/web`, port 3000, nothing else was
listening) via `setsid nohup … &` so it outlives this session.

```
$ curl --retry 60 --retry-delay 3 --retry-all-errors -s -o index.html -w '%{http_code}' http://localhost:3000/
HTTP 200, 12040 bytes at 09:04:53
$ ss -ltnp | grep ':3000 '
LISTEN 0 511 *:3000 *:* users:(("next-server (v1",pid=55195,fd=22))
$ tail dev.log
 ✓ Ready in 999ms
 ✓ Compiled / in 2.6s (1158 modules)
 GET / 200 in 2992ms
```

Menu check: the served page references five script chunks; the label
"Socket Tray" is present in `/_next/static/chunks/app/page.js` as served
by the running server (and in `apps/web/.next-dev/static/chunks/app/page.js`
on disk). The insert menu is client-rendered and only populates when
opened, so the label is not in the SSR HTML; the served chunk is the
evidence. There is no browser-driving e2e harness in the repo
(`tests/e2e/` holds two OCCT kernel tests), so no click was automated.

- `next-server` pid **55195** (listener on :3000); launcher `npm run dev`
  pid 55113. Log: the session scratchpad `dev.log`.

## Step 12 — local commit (NOT pushed)

Filled in by the closing summary: see `git log --oneline -1` and
`git status` there. This report is part of the commit.

## Open questions

1. **Mesh corner vs. selection center (shared with Multiconnect).** The
   tray mesh, like the plate mesh, spans from the shape's anchor to
   +width/+depth, while the selection frame is centered on the anchor
   (`WorkplaneViewport.tsx:1593-1594`, `:7097`). Centering the tray in the
   mapping helper would fix the tray alone and change its export frame;
   this pass followed the validated Multiconnect path instead.
2. **"Add Pocket" on the default tray lands off the tray.** Per the brief,
   a new pocket goes at `last.x + 36` with no clamp; on the 240mm default
   that is x = 246, so the card shows the edge-clearance error and the
   viewport shows the bare tray until the pocket is moved. Multiconnect's
   peg card clamps to `width − 10`; the brief's rule was followed as
   written.
3. **Thickness below Pocket Depth + 2mm is reported, not clamped.** The
   Thickness slider's minimum is the module's 2mm floor constant, so
   dragging Thickness under Pocket Depth + 2 shows the floor message and
   the bare-tray fallback. Clamping it would need a dynamic minimum the
   brief did not ask for.
4. **Step 9 cannot be byte-identical by construction** (solid name, float32
   path). If byte identity is wanted, the exporter's fixed solid name and
   the float32 attribute are the two things in the way; both are outside
   this task.
5. **Z naming.** The module's "front" face (Z = 0) is the far side from the
   home camera. Cosmetic; noted only.

## Credential scan

All command output above was scanned for `ghp_`, `ghs_`, `token`,
`secret`, `password`: no hits. Process listings show only pids and
process names.

## SCOPE CHECK — every file touched, mapped to the step that required it

| File | Action | Step |
|---|---|---|
| `apps/web/src/types/sketchforge.ts` | edited (+kind, +pocket type, +2 fields) | 2 |
| `apps/web/src/lib/shapeCatalog.ts` | edited (+entry, +defaults, +mapping/geometry/error helpers, insert defaults) | 3, 4, 5 |
| `apps/web/src/components/WorkplaneViewport.tsx` | edited (+import, +signature fields, +case, +complexEdges kind) | 4 |
| `apps/web/src/components/SketchForgeEditor.tsx` | edited (+import, +case) | 4 |
| `apps/web/src/components/workplane/ShapeInspector.tsx` | edited (+imports, +unit labels, +property block, +card mount, +`SocketTrayPocketCard`) | 5 |
| `apps/web/src/lib/workplaneShapes.ts` | edited (+color, +equality) | 6 |
| `apps/web/src/lib/skfProject.ts` | edited (+kind in whitelist) | 6 |
| `tests/unit/socketTrayShapeRegistration.test.ts` | created | 8, 9 |
| `reference/reports/socket-tray-ui-build.md` | created (this report) | deliverable |
| `apps/web/src/lib/socketTrayGeometry.ts` | read and called only, not edited | read-only reference |
| `apps/web/src/lib/multiconnectContainerGeometry.ts` | read (header + bbox measurement), not edited | read-only reference |
| `scripts/generate-socket-tray-sampler.mjs`, `tests/unit/socketTrayGeometry.test.ts` | read only | read-only reference |
| `test-prints/socket-tray-sampler.stl` | read only (`sha256sum`, `cmp`, parsed); `git status` clean under `test-prints/` | step 9, 10 |
| `test-prints/wrench-rack-*.stl`, `deploy/docker/*`, `.github/workflows/*`, `package*.json`, config files, existing `reference/*` | not touched | do-not-touch |
| scratchpad (outside the repo): `alias-register.mjs`, `alias-resolver.mjs`, `app-export.stl`, `index.html`, `chunks.txt`, `dev.log` | temporary evidence files | 4, 9, 11 |

No new dependencies. No config, build-script, STL, or Docker change. The
dev server's `.next-dev/` build output is gitignored and does not appear in
`git status`.
