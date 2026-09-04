# Socket Tray UI registration — recon (read-only)

Read-only recon for adding the Socket Tray to the app UI (shape catalog
entry + inspector). No code, test, config, STL, or doc change was made; this
report is the only file written. Every claim cites a file path and line
range in the working tree at `21ccf00`.

## Step 1 — tree clean, HEAD matches origin

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
$ git fetch origin
$ git rev-parse HEAD origin/main
21ccf00385208be76073fb5ef490f8ec2af301fe
21ccf00385208be76073fb5ef490f8ec2af301fe
```

## Step 2 — the geometry module's parameter shape

Files read: `apps/web/src/lib/socketTrayGeometry.ts` (295 lines, full) and
`scripts/generate-socket-tray-sampler.mjs` (90 lines, full).

**Exported surface** (`socketTrayGeometry.ts`):

| Export | Lines | Kind |
|---|---|---|
| `DEFAULT_SOCKET_TRAY_WIDTH = 240`, `DEFAULT_SOCKET_TRAY_DEPTH = 60`, `DEFAULT_SOCKET_TRAY_THICKNESS = 18` | 36-38 | per-tray defaults |
| `SOCKET_TRAY_POCKET_SEGMENTS = 64` | 44 | circle resolution, not a parameter |
| `MIN_SOCKET_TRAY_FLOOR_THICKNESS = 2` | 52 | guard constant |
| `SOCKET_TRAY_POCKET_EDGE_CLEARANCE = 5` | 56 | guard constant |
| `SOCKET_TRAY_POCKET_GAP = 4` | 59 | guard constant |
| `type SocketTrayPocket = { diameter; depth; x; z }` | 61-69 | per-pocket record |
| `type SocketTrayOptions = { width?; depth?; thickness?; pockets? }` | 71-76 | the builder's input |
| `normalizeSocketTrayWidth/Depth/Thickness(value?)` | 82-98 | per-tray normalizers |
| `socketTrayDimensions(options = {})` → `{ width, depth, thickness }` | 100-106 | bounding-box helper |
| `socketTrayPositions(options = {}): number[]` | 213-288 | triangle soup |
| `createSocketTrayGeometry(options = {}): THREE.BufferGeometry` | 290-295 | the geometry entry point |

**Per-tray values:** `width`, `depth`, `thickness` (`:71-76`). Each falls
back to its default when undefined or non-finite (`finiteOr`, `:78-80`)
and throws when `<= 0` (`:84`, `:90`, `:96`). Frame: X = width
(left-right), Y = thickness (up, "matches this app's Y-up scene
convention"), Z = depth (front-back); top face at Y = thickness, bottom
face at Y = 0 (`:23-34`, `:247-248`). No as-mounted mirror (`:23-27`).

**Per-pocket values:** `diameter`, `depth`, `x`, `z`, all four required on
every pocket (`:61-69`). Pocket `depth` is per pocket, not shared
(`:64-65`, `:117`).

**Positions are supplied, not computed.** The module has no pitch or
margin parameter of any kind; `x`/`z` are explicit per pocket and the
module comment says so: "positions are explicit (no auto-layout), so a bad
layout is a caller bug and this throws" (`:110-113`). Pitch and margins
exist only in the generator script's comments and its literal `POCKETS`
array (`generate-socket-tray-sampler.mjs:34-49`).

**Validation guards** (`normalizedPockets`, `:114-146`, module-private):

| # | Guard | Limit | Lines |
|---|---|---|---|
| 1 | `diameter`, `depth`, `x`, `z` finite; `diameter > 0`; `depth > 0` | — | 118-120 |
| 2 | floor under pocket: `thickness - depth >= MIN_SOCKET_TRAY_FLOOR_THICKNESS` | 2mm | 121-125 |
| 3 | edge clearance: `x ± r` and `z ± r` at least `SOCKET_TRAY_POCKET_EDGE_CLEARANCE` from every tray edge | 5mm | 127-134 |
| 4 | pairwise gap: center distance `>= r_i + r_j + SOCKET_TRAY_POCKET_GAP` | 4mm | 137-143 |

There is no minimum diameter beyond `> 0`, no maximum diameter, no maximum
pocket count, and no maximum on width/depth/thickness. Every guard throws
an `Error`; nothing is clamped or dropped. `pockets` defaults to `[]`
(`:217`), which builds a plain uncut block (`:241-242`).

**Are per-pocket diameters caller-supplied or hardcoded?** Caller-supplied.
`socketTrayGeometry.ts` contains no diameter literal anywhere; the only
literal pocket lists in the repo are the generator script's `POCKETS`
(`generate-socket-tray-sampler.mjs:42-49`) and, per that script's own
comment, `SAMPLER_POCKETS` in `tests/unit/socketTrayGeometry.test.ts`
(`:25-26`).

## Step 3 — how the Multiconnect plate was registered (`10982d5`)

```
$ git show --stat 10982d5
10982d5 2026-08-24 feat(multiconnect): register the Multiconnect Container in the editor (phase 5)

 apps/web/src/components/SketchForgeEditor.tsx      |   8 +-
 apps/web/src/components/WorkplaneViewport.tsx      |  20 ++-
 .../src/components/workplane/ShapeInspector.tsx    | 167 +++++++++++++++++++-
 apps/web/src/lib/shapeCatalog.ts                   | 112 +++++++++++++-
 apps/web/src/lib/skfProject.ts                     |   2 +-
 apps/web/src/lib/workplaneShapes.ts                |  11 ++
 apps/web/src/types/sketchforge.ts                  |  27 +++-
 tests/unit/multiconnectShapeRegistration.test.ts   | 172 +++++++++++++++++++++
 8 files changed, 511 insertions(+), 8 deletions(-)
```

Every file's full diff was read. Line numbers below are the current tree.

| File | What `10982d5` added | Role(s) |
|---|---|---|
| `apps/web/src/types/sketchforge.ts` | `"multiconnectContainer"` added to the `ShapeKind` union (`:24`); `MulticonnectShapeType` (`:141`) and `MulticonnectShapePeg = { diameter; x }` (`:148`) types; ten optional `multiconnect*` fields on `WorkplaneShape` (`:261-273`), with plate width/height/thickness living in the shared `width`/`height`/`depth` fields (`:261-263`) | shape type / schema definition |
| `apps/web/src/lib/shapeCatalog.ts` | one `toolbarShapeAssets` entry, kind `multiconnectContainer`, category `OpenGrid`, box icon stand-in, color `#9b3bd2` (`:63-67`); `DEFAULT_MULTICONNECT_SHAPE_*` insert constants (`:84-91`); `multiconnectPlateOptionsForShape(shape)` — the single shape→geometry-options mapping shared by render, export, and validation (`:93-116`); `createMulticonnectGeometryForShape(shape)` — calls the geometry module, falls back to `pegs: []` on throw (`:118-129`); `multiconnectPegLayoutError(shape)` — translates the module's thrown message into 1-based inspector text (`:131-152`); `makeShapeFromAsset` insert defaults (`:236-249`, `:302-311`) | shape catalog entry; default parameters; geometry dispatch (the mapping); other (validation-message translation) |
| `apps/web/src/components/WorkplaneViewport.tsx` | import of `createMulticonnectGeometryForShape` (`:36`); ten `multiconnect*` fields added to `shapeGeometrySignature`, which is `JSON.stringify` of the geometry-relevant fields and is the geometry cache key (`:920-973`, used at `:7139`); `case "multiconnectContainer"` in `createShapeObject` (`:7248-7254`); kind added to the `complexEdges` list in `addShapeEdgeDecorations` (`:7373`) | geometry dispatch (viewport render arm) |
| `apps/web/src/components/SketchForgeEditor.tsx` | import (`:97`); `case "multiconnectContainer"` in `buildGeometryMeshForShape` — the export arm, same shared-cache-then-clone pattern (`:2266-2271`) | geometry dispatch (export arm) |
| `apps/web/src/components/workplane/ShapeInspector.tsx` | imports of the module's `MIN_`/`MAX_`/normalize helpers and the catalog's error helper (`:59-75`); five labels plus `endsWith("Diameter")` / `startsWith("Position")` added to `propertyUsesLengthUnit` so those fields get mm unit handling (`:158-166`); `if (shape.kind === "multiconnectContainer")` block in `getShapeProperties` returning the property rows (`:347-396`); conditional mount of `MulticonnectPegCard` (`:764-766`); the `MulticonnectPegCard` component (`:795-881`) | inspector panel |
| `apps/web/src/lib/workplaneShapes.ts` | `fallbackSolidColor` branch (`:135`); ten `multiconnect*` comparisons in `workplaneShapesEqual`, the editor's dirty-tracking comparator, with `multiconnectPegs` reference-compared (`:233-242`) | other (color; change detection) |
| `apps/web/src/lib/skfProject.ts` | `"multiconnectContainer"` added to the `SHAPE_KINDS` whitelist (`:30-34`), checked by `validateShapeDefinition` (`:854`). Shape fields are otherwise serialized as a generic spread of `canonicalizeShape(shape)` (`:434-443`) and restored as a generic spread (`:1075`), so no per-field .skf work was needed | other (persistence kind whitelist) |
| `tests/unit/multiconnectShapeRegistration.test.ts` | new, 172 lines: catalog entry present in `OpenGrid` with a unique color in the category; default insert values; shape→options mapping; `.skf` round-trip; export byte-identity against the module's direct output plus a `minY === 0` check; invalid layouts fall back and produce friendly errors | test |

Repo-wide confirmation: `grep -rn '"multiconnectContainer"' apps/web/src tests/`
hits only the files above (`shapeCatalog.ts`, `types/sketchforge.ts`,
`workplaneShapes.ts`, `skfProject.ts`, `ShapeInspector.tsx`,
`WorkplaneViewport.tsx`, `SketchForgeEditor.tsx`, and the two test files
`multiconnectShapeRegistration.test.ts` / `multiconnectPresets.test.ts`).
A second sweep on `"openGridSnap"` as the kind literal hits the same
seven source files and no others. `apps/web/src/lib/projectShapePersistence.ts`
(IndexedDB compaction) spreads the whole shape (`:46-48`, `:63-67`) and
enumerates no per-kind fields. `canonicalizeShape` spreads the shape
(`workplaneShapes.ts:157-166`). The `ShapeInspector` main render calls
`getShapeProperties` once and renders whatever it returns (`:577-581`);
only `gear` has extra per-kind filtering there.

**How the Wrench Racks presets hook into the insert menu (`f4e3248`):**

```
$ git show --stat f4e3248
f4e3248 2026-08-24 feat(multiconnect): built-in wrench rack presets in the insert panel

 apps/web/src/components/SketchForgeEditor.tsx |  5 +-
 apps/web/src/lib/multiconnectPresets.ts       | 62 ++++++++++++++++++++
 apps/web/src/lib/shapeCatalog.ts              | 22 ++++++-
 apps/web/src/types/sketchforge.ts             |  5 ++
 tests/unit/multiconnectPresets.test.ts        | 84 +++++++++++++++++++++++++++
 5 files changed, 176 insertions(+), 2 deletions(-)
```

- `apps/web/src/lib/multiconnectPresets.ts` (new): `MulticonnectPreset = { id; name; group; shape: Partial<WorkplaneShape> }` (`:19-27`), the six `WRENCH_RACK_BASE`-derived entries (`:29-58`), `multiconnectPresetById` (`:60-62`).
- `apps/web/src/lib/shapeCatalog.ts:68-81`: each preset is spread into `toolbarShapeAssets` as an ordinary `multiconnectContainer` asset whose `category` is `preset.group` ("Wrench Racks") and which carries `presetId`. `makeShapeFromAsset` overlays `preset.shape` on the blank insert (`:315-319`); the lookup is hardwired to `multiconnectPresetById` (`:318`).
- `apps/web/src/types/sketchforge.ts:33-37`: optional `presetId` on `ShapeAsset`.
- `apps/web/src/components/SketchForgeEditor.tsx:9290-9294`: `openGridShapeGroups` is every group whose category is not "Basic Shapes", so any new category that appears in `toolbarShapeAssets` renders as its own titled section in the "Open Grid" menu (`:9327-9330` renders `group.category` as the section title) with no editor edit. `toolbarShapeAssetGroups` (`shapeCatalog.ts:156-168`) orders sections by first appearance in `toolbarShapeAssets`, so the Multiconnect entry (`:67`) sits in the `OpenGrid` section and the presets (`:72-81`) follow it as the "Wrench Racks" section. Inserting from either goes through `addShape` → `makeShapeFromAsset` (`:6831-6841`) with nothing kind-specific.

## Step 4 — file list for the build

Classification: (a) new file, (b) additive edit to an existing shared
file, (c) touches a do-not-touch path.

| File | Equivalent Socket Tray change | Class |
|---|---|---|
| `apps/web/src/types/sketchforge.ts` | a new `ShapeKind` member; a per-pocket record type parallel to `MulticonnectShapePeg` (`:148`); optional socket-tray fields on `WorkplaneShape` next to `:261-273` | (b) |
| `apps/web/src/lib/shapeCatalog.ts` | a `toolbarShapeAssets` entry next to `:67`; insert defaults (parallel to `:84-91`, `:236-249`, `:302-311`); a shape→`SocketTrayOptions` mapping and a geometry helper parallel to `:93-129`; an error-translation helper parallel to `:131-152`, keyed on the module's message text at `socketTrayGeometry.ts:119`, `:123`, `:133`, `:141`. Imports from `socketTrayGeometry.ts` (reading its exports; not an edit to it) | (b) |
| `apps/web/src/components/WorkplaneViewport.tsx` | socket-tray fields in `shapeGeometrySignature` (`:920-973`); a `case` in `createShapeObject` next to `:7248-7254`; the kind in the `complexEdges` list (`:7373`) | (b) |
| `apps/web/src/components/SketchForgeEditor.tsx` | import (`:97`) and a `case` in `buildGeometryMeshForShape` next to `:2266-2271`. No insert-menu change: see step 3 (`:9290-9294`) | (b) |
| `apps/web/src/components/workplane/ShapeInspector.tsx` | imports; a `getShapeProperties` block next to `:347-396`; label additions to `propertyUsesLengthUnit` (`:158-166`) for any new mm label not already covered; a list-card mount next to `:764-766` and a list-card component parallel to `:795-881` | (b) |
| `apps/web/src/lib/workplaneShapes.ts` | `fallbackSolidColor` branch (`:135`); comparisons in `workplaneShapesEqual` (`:233-242`) | (b) |
| `apps/web/src/lib/skfProject.ts` | the kind string in `SHAPE_KINDS` (`:30-34`) | (b) |
| `tests/unit/socketTrayShapeRegistration.test.ts` (name by analogy) | registration test parallel to `multiconnectShapeRegistration.test.ts` | (a) |
| `apps/web/src/lib/socketTrayGeometry.ts` | **no change required.** Everything the Multiconnect registration imports from its geometry module has a Socket Tray counterpart already exported: defaults (`:36-38`), guard constants (`:52-59`), option/pocket types (`:61-76`), per-tray normalizers (`:82-98`), `socketTrayDimensions` (`:100-106`), `socketTrayPositions` (`:213`), `createSocketTrayGeometry` (`:290`). The one asymmetry: Multiconnect also exports `MIN_`/`MAX_` bounds and per-field normalizers that the inspector uses for slider limits (`ShapeInspector.tsx:59-75`, `:377-392`), while the Socket Tray exports no maxima and no per-pocket normalizer. The Multiconnect inspector's maxima are literals in the inspector itself (`:377-392`: 320, 20, 100, 5, 45), not module exports | not touched |
| `apps/web/src/lib/multiconnectContainerGeometry.ts` | not touched; nothing in the registration imports a reusable helper from it (all helpers are unexported, per `reference/socket-tray-recon.md` §3) | not touched |

**No (c) item.** Every file the build touches is either new or an additive
edit to a shared file that `10982d5`/`f4e3248` already edited the same way.
No do-not-touch path is required. An icon asset is not required either:
every OpenGrid entry reuses `assets/sketchforge/shape-icons-gray/box.png`
(`shapeCatalog.ts:50-67`).

## Step 5 — the existing per-item list pattern (Multiconnect pegs)

`MulticonnectPegCard`, `apps/web/src/components/workplane/ShapeInspector.tsx:795-881`,
mounted only when the shape is a `PegPlate` (`:764-766`).

- **State:** the list is `shape.multiconnectPegs`, an array of `{ diameter, x }` (`types/sketchforge.ts:148`, `:273`); the card reads it with `?? []` (`:817`) and writes it whole through `onUpdate({ multiconnectPegs: next })` (`:820`). Shared per-list values (peg length, row z) are separate scalar fields edited in the main property block (`:389-392`), not per item.
- **Add:** appends `{ diameter: 6, x }` where `x` is the last peg's `x + 30` clamped to `plateWidth - 10`, or `plateWidth / 2` for the first peg (`:821-825`); "Add Peg" button at `:874-876`.
- **Remove:** per-row "Remove Peg N" button filters the array by index (`:864-866`).
- **Per-item numeric edit:** two `RangeProperty` controls per row, each with its own `min`/`max`/`step` (`:842-863`); `onChange` maps the array, replacing only that index (`:850`, `:861`). Rows are keyed by index (`:841`).
- **Validation display:** `multiconnectPegLayoutError(shape)` (`shapeCatalog.ts:134-152`) runs the geometry module on every render; a non-null message renders as a `role="alert"` paragraph inside the card (`:869-873`). The viewport meanwhile renders the fallback plate (`shapeCatalog.ts:122-129`).
- **Change detection:** each edit creates a new array, which is what `workplaneShapesEqual`'s reference compare (`workplaneShapes.ts:242`) and the `JSON.stringify` cache key (`WorkplaneViewport.tsx:969`) key off.
- **Collapsible card:** local `useState(true)` (`:816`), header button (`:828-837`), `property-card` / `property-list` / `inspector-action-button` class names shared with the gear cards (`:740-785`).

The registration test exercises this list through the shape fields only
(`multiconnectShapeRegistration.test.ts:21-35`, `:150-171`); there is no
DOM test of the card.

## Step 6 — decimal numeric input in existing inspectors

All numeric rows go through `RangeProperty`
(`ShapeInspector.tsx:947-1037`), configured by `RangePropertyConfig =
{ label; value; min; max; step?; disabled?; onChange }` (`:119-128`).

Existing mm fields and their settings:

| Field | min | max | step | Lines |
|---|---|---|---|---|
| Plate Thickness | `MULTICONNECT_BACK_THICKNESS` | 20 | 0.1 | `:379` |
| Corner Radius | 0 | `maxCornerRadius` (computed) | 0.5 | `:380` |
| Slot Tolerance | `MIN_MULTICONNECT_SLOT_TOLERANCE` | `MAX_…` | 0.005 | `:385` |
| Peg N Diameter (list row) | 2 | 20 | 0.5 | `:842-852` |
| Position (from left, as mounted) | 0 | `plateWidth` | 0.5 | `:853-863` |
| Width / Height | `MIN_MULTICONNECT_PLATE_DIMENSION` | 320 | default | `:377-378` |

Mechanics:

- **Default step** is 0.01 when a row omits it (`:952`).
- **Two controls per row.** A text box (`type="text"`, `inputMode="decimal"`, `:995-999`) and a slider (`type="range"` with `min`/`max`/`step`, `:1020-1033`).
- **Text entry** keeps a draft while focused (`:968-969`, `:1000-1005`) and commits on blur or Enter (`:1006-1009`); Escape discards (`:1010-1013`). Commit parses with `parseMeasurementInput` (`measurementUnits.ts:78-96`), which accepts either `,` or `.` as the decimal separator and strips whitespace; non-finite input reverts to the current value (`:978-979`). The committed value is clamped to `[min, max]` unless the label is exactly "Length", "Width", or "Height", which may exceed the slider max (`:958`, `:981`). **The text path does not snap to `step`**: a typed `20.70` is stored as `20.7` (`:977-984`).
- **Slider entry** clamps to the control range and stores the slider's value (`:985-989`); the browser's own `step` attribute quantizes the slider.
- **Display precision** is `formatPropertyNumber` (`:153-156`): if `step >= 1` the value shows as an integer; otherwise `formatMeasurementNumber(value, workspace.accuracy)` (`measurementUnits.ts:98-105`) prints `toFixed(accuracy)`, where `accuracy` is the workspace's `MeasurementAccuracy` of 1, 2, or 3 decimals (`types/sketchforge.ts:53`), extended only for values smaller than half a unit in the last place. The `step` argument is unused for precision (`_step`, `:98`). So `20.7` displays as `20.7` at accuracy 1 and `20.70` at accuracy 2; the stored number is unaffected.
- **Unit conversion** applies only to labels matched by `propertyUsesLengthUnit` (`:158-166`): those are converted mm ↔ display units for the control and back on commit (`:959-965`, `:976`) and get a unit suffix (`:970`, `:1016`). Labels ending in "Diameter" or starting with "Position" already match (`:164-165`); "Thickness", "Width", "Height", "Length", "Radius" match by exact label (`:160`). The bare word "Depth" is not in the list; "Internal Depth" is.

## Open questions

1. **Frame mapping is unspecified.** Multiconnect maps plate width → `shape.width`, plate height → `shape.height`, plate thickness → `shape.depth` (`shapeCatalog.ts:105-107`). The Socket Tray's frame is X = width, Y = thickness (up), Z = depth (`socketTrayGeometry.ts:27-29`), and the app's `height` is the Y-up dimension. Which tray value lands in `shape.height` versus `shape.depth` is not settled anywhere read.
2. **Which per-pocket values the list edits is unspecified.** The module requires `diameter`, `depth`, `x`, `z` on every pocket (`socketTrayGeometry.ts:61-69`). The Multiconnect list edits two per-item values and shares the rest as scalars (`ShapeInspector.tsx:389-392`, `shapeCatalog.ts:99-102`); the coupon uses one depth and one z for all six pockets (`generate-socket-tray-sampler.mjs:42-49`). Whether the tray's list is per-item on all four, or shares depth/z like the pegs share length/row z, is a build decision not covered by the brief.
3. **Pocket x is explicit in the module; no auto-layout exists** (`socketTrayGeometry.ts:110-113`). The brief's step 2 asked whether positions come from pitch/margins; they do not. How the inspector supplies `x` (and `z`) per pocket is unspecified.
4. **Invalid-layout behavior is unspecified.** The module throws on any guard failure (`:118-143`); with `pockets: []` it builds a plain block (`:241-242`). Multiconnect's render/export arms catch and fall back to the bare plate (`shapeCatalog.ts:122-129`). What the tray's arms do on a throw is not stated.
5. **`presetId` resolution is hardwired to Multiconnect.** `makeShapeFromAsset` resolves any `presetId` through `multiconnectPresetById` (`shapeCatalog.ts:318`). The brief asks for a catalog entry and inspector only, not presets; if a Socket Tray preset is ever wanted, that lookup is Multiconnect-specific today.
6. **Slider maxima have no module source.** The Multiconnect inspector's maxima are literals in the inspector (`ShapeInspector.tsx:377-392`), and `socketTrayGeometry.ts` exports minima/guards only (`:52-59`). What maxima the tray's rows use is unspecified.

## Credential scan

Every command output pasted above was scanned for `ghp_`, `ghs_`,
`token`, `secret`, `password`: no hits. The report contains no
credentials.

## SCOPE CHECK

Files read (all read-only): `CLAUDE.md`, `CLAUDE-LESSONS.md`,
`reference/SESSION-STATE.md`, `reference/OPEN-ITEMS.md`,
`reference/DECISIONS.md`, `reference/KNOWN-FIXES.md`,
`reference/socket-tray-recon.md`, `reference/socket-tray-sampler-report.md`,
`apps/web/src/lib/socketTrayGeometry.ts`,
`scripts/generate-socket-tray-sampler.mjs`,
`apps/web/src/lib/shapeCatalog.ts`, `apps/web/src/lib/multiconnectPresets.ts`
(via `git show`), `apps/web/src/lib/skfProject.ts` (`:20-60`, `:427-545`,
`:845-900`, `:1061-1135`), `apps/web/src/lib/workplaneShapes.ts`
(`:110-150`, `:157-255`), `apps/web/src/lib/measurementUnits.ts`,
`apps/web/src/lib/projectShapePersistence.ts` (grep only),
`apps/web/src/types/sketchforge.ts` (`:1-60`, `:230-319`),
`apps/web/src/components/workplane/ShapeInspector.tsx` (`:95-175`,
`:340-400`, `:570-600`, `:755-1097`),
`apps/web/src/components/WorkplaneViewport.tsx` (`:915-975`,
`:7240-7256`, `:7368-7376`), `apps/web/src/components/SketchForgeEditor.tsx`
(`:2255-2275`, `:6827-6841`, `:9286-9362`, `:9522-9547`, `:9670-9700`),
`tests/unit/shapeCatalog.test.ts`, `tests/unit/multiconnectShapeRegistration.test.ts`
and `tests/unit/multiconnectPresets.test.ts` (via `git show`), plus the full
diffs of `10982d5` and `f4e3248`.

Do-not-touch paths: `multiconnectContainerGeometry.ts` was not opened this
pass (its role is covered by `reference/socket-tray-recon.md`);
`socketTrayGeometry.ts` was read only; `test-prints/`, `deploy/docker/`,
`.github/workflows/`, `package*.json`, config files, and every existing
`reference/` file were neither modified nor, except the six reference docs
named above, opened.

Files created: `reference/reports/socket-tray-ui-recon.md` (this file).
Files modified: none.

```
$ git status --short        (after writing this report, before commit)
?? reference/reports/socket-tray-ui-recon.md
```
