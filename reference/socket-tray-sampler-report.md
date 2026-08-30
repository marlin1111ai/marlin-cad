# Socket Tray sampler coupon — build report

Implements step 1 of the BUILD brief following the boundary-rep pattern and
file location settled in `reference/socket-tray-recon.md` (read first, not
re-derived here). New primitive module + a printable coupon generated from
it, committed locally only (no push yet, per the GIT gate in the brief).

**2026-08-30 UPDATE: pocket depth reduced from 20mm to 14mm, tray thickness
from 24mm to 18mm** (floor thickness unchanged at 4mm; width/depth/pocket
diameters unchanged). This entire document has been updated in place to
describe the current 14mm/18mm coupon — every figure below reflects the
current state, not the superseded 20mm/24mm one. `test-prints/socket-tray-sampler.stl`
was overwritten (not versioned separately); the 20mm/24mm STL no longer
exists on disk.

## What was built

- `apps/web/src/lib/socketTrayGeometry.ts` — new sibling primitive module
  (not an edit to `multiconnectContainerGeometry.ts`). Implements
  `socketTrayPositions()` / `createSocketTrayGeometry()`: a flat rectangular
  tray with any number of round BLIND pockets cut into its top face.
  Boundary-rep only, same family as Multiconnect's slots: each pocket's rim
  circle is notched directly into the top face's outline (via
  `THREE.ShapeUtils.triangulateShape` with the rim as a hole contour,
  exactly like Multiconnect's peg-hole front cap), and the pocket's own
  interior (cylindrical wall + flat floor cap) is built from separate
  triangles that reuse the SAME rim/floor-ring point objects the notch
  meets — bit-identical seam by construction, no CSG anywhere. No baked
  mesh is needed (unlike Multiconnect's keyhole terminator) since a round
  pocket's rim is a plain parametrized circle.
- `tests/unit/socketTrayGeometry.test.ts` — watertight/manifold check, an
  exact directed-edge check (the same "every edge and its reverse appear
  exactly once" contract Multiconnect's test uses), a bounding-box check,
  validation-guard checks, and — per the KNOWN-FIXES lesson that a sealed
  pocket still passes a plain watertightness check — an explicit vertical
  raycast per pocket confirming it is genuinely OPEN from the top face down
  to its floor and SOLID from the floor down to the tray's bottom, plus a
  check that the tray between pockets has no accidental opening. All 14
  tests pass; full suite (`npm test`) is green at 316/316, and
  `npx tsc -p apps/web/tsconfig.json --noEmit` is clean.
- `scripts/generate-socket-tray-sampler.mjs` — one-off generator (pattern
  matches `bake-multiconnect-slot.mjs`: a script in `scripts/`, not part of
  the app runtime) that calls the real `socketTrayPositions()` and writes
  `test-prints/socket-tray-sampler.stl`. Kept so the coupon can be
  regenerated if the pocket list changes. Run with:
  `node --experimental-strip-types scripts/generate-socket-tray-sampler.mjs`
- `test-prints/socket-tray-sampler.stl` — the coupon.
- `test-prints/README.md` — new "Unvalidated samplers" section documenting
  the coupon's status.

## Dimensions chosen, and why

| Parameter | Value | Reasoning |
|---|---|---|
| Tray width (X, left-right) | **240mm** | Hard constraint from the brief — matches the wrench rack plates' footprint (`multiconnectPresets.ts` positions its pegs from x=20 to x=220, implying a 240mm plate width). |
| Tray depth (Z, front-back) | **60mm** | Needs to comfortably hold a single row of round pockets up to 28mm OD with real edge margin on both sides. At the chosen layout (all pocket centers at z=30, i.e. centered), the largest (28mm) pocket's rim sits 16mm from the front and back edges — well past the 5mm minimum edge clearance the module enforces, leaving real structural wall there. 60mm is not the minimum possible; it's chosen so the coupon isn't fighting its own edge-clearance rule and is comfortable to handle and print. |
| Tray thickness (Y, up) | **18mm** | = pocket depth (14mm) + floor thickness (4mm). Not derived independently — see pocket depth and floor thickness below. Reduced from the first coupon's 24mm (20mm depth + 4mm floor) at the owner's request; floor thickness itself is unchanged. |
| Pocket depth (all 5, single value per the brief) | **14mm** | Reduced from the first coupon's 20mm estimate. Still an estimate for a 3/8"-drive standard (non-deep) socket's height, now toward the shallower end of the roughly 12-25mm range these sockets run across common metric/SAE sizes, rather than the middle. **Still the least-derived number in the whole coupon** — not checked against any real socket. Flagged again in Open Questions below. |
| Floor thickness (material kept under each pocket) | **4mm** | Comfortably above the 2mm `MIN_SOCKET_TRAY_FLOOR_THICKNESS` the module enforces (chosen per `CLAUDE-LESSONS.md`'s slicer-slit-fusion lesson: don't let a floor go arbitrarily thin just because the geometry permits it) — 4mm prints as several solid layers and should handle a socket being set down into the pocket without flexing. |

## The 5 pocket diameters and positions

Evenly spaced (arithmetic-ish, step ~3-4mm) across the foreman's estimated
15-28mm OD range, left to right in ascending size, center-to-center pitch
45mm, centers at z=30 (tray depth centerline):

| # (left→right) | Diameter (OD) | Depth | Center (x, z) | Edge/neighbor clearance |
|---|---|---|---|---|
| 1 | **15mm** | 14mm | (30, 30) | 22.5mm to left edge |
| 2 | **18mm** | 14mm | (75, 30) | 28.4mm gap to pocket 1 |
| 3 | **22mm** | 14mm | (120, 30) | 25.9mm gap to pocket 2 |
| 4 | **25mm** | 14mm | (165, 30) | 21.6mm gap to pocket 3 |
| 5 | **28mm** | 14mm | (210, 30) | 18.6mm gap to pocket 4; 16mm to right edge |

Diameters, positions, and edge/neighbor clearances are unchanged from the
first coupon — this update only reduced pocket depth (and therefore tray
thickness); the plan-view layout is identical.

All diameters and the depth are round-number **estimates**, per the brief's
own note — not measurements against real sockets. No radial clearance/
tolerance was added on top of the stated diameters: since the whole point
of this coupon is to compare it against real sockets and report back what
fits, adding an unstated fudge factor now would only make that comparison
harder to interpret. The next pass should size pockets off the owner's
actual caliper measurements plus a deliberate, stated clearance, informed
by this coupon's print.

## STL export

- File: `test-prints/socket-tray-sampler.stl` (overwritten in place; supersedes the 20mm-depth/24mm-thickness version)
- Format: ASCII STL, `solid socket_tray_sampler` / `endsolid socket_tray_sampler`
- File size: 292,047 bytes
- Triangle count: **1,292** (unchanged from the first coupon — same topology, only the Y coordinate of the pocket floors and every face above them shifted; confirmed by counting `facet normal` lines and cross-checked against 3,876 `vertex` lines = 1,292 × 3)
- Bounding box, read back from the regenerated file's own vertex coordinates (not assumed from the script's inputs): X 0→240mm, Y −60→0mm, Z 0→**18mm** — i.e. exactly 240 × 60 × 18mm once the STL's Z-up axes are mapped back through `sketchForgeToZUp` to the tray's own (width, depth, thickness). Confirms the export matches the new intended dimensions, not just the in-memory geometry.

## SCOPE CHECK

### Original build pass

| File | Action | Task step |
|---|---|---|
| `apps/web/src/lib/socketTrayGeometry.ts` | created | 1 |
| `tests/unit/socketTrayGeometry.test.ts` | created | 1 (verification, not requested explicitly but matches CLAUDE.md's "unit-tested in tests/unit" convention for every geometry primitive) |
| `scripts/generate-socket-tray-sampler.mjs` | created | 3, 4 |
| `test-prints/socket-tray-sampler.stl` | created (via the generator script) | 4 |
| `test-prints/README.md` | edited (appended section only) | 5 |
| `reference/socket-tray-sampler-report.md` | created | deliverable |
| `multiconnectContainerGeometry.ts` | read only, never imported or edited | reference per brief |
| `test-prints/wrench-rack-*.stl` (6 files) | not touched, not opened | do-not-touch |
| `openGridSnapGeometry.ts` / `openGridSnapMesh.ts` | not touched | out of scope, no back plate this pass |
| `deploy/docker/*`, Unraid/GHCR files | not touched | out of scope |

No STOP-AND-REPORT condition was hit: nothing about a round blind pocket in
a flat tray required touching `multiconnectContainerGeometry.ts` — the
pattern (notch a rim contour into the host face, build the pocket's own
walls/floor as separate triangles sharing that contour's exact points) is
generic enough that a round pocket is a strict simplification of the
keyhole case (no taper, no dimple, no baked mesh needed at all), exactly as
predicted in the recon.

### 2026-08-30 UPDATE pass (14mm depth / 18mm thickness)

| File | Action | Task step |
|---|---|---|
| `apps/web/src/lib/socketTrayGeometry.ts` | edited — `DEFAULT_SOCKET_TRAY_THICKNESS` constant 24 → 18 (the only tray-level default this module hardcodes; pocket depth itself is always caller-supplied per pocket, so there was no other in-module default to change) | 1 |
| `scripts/generate-socket-tray-sampler.mjs` | edited — `POCKETS` array depths 20 → 14, `thickness` option 24 → 18 | 1, 2 |
| `tests/unit/socketTrayGeometry.test.ts` | edited — `SAMPLER_POCKETS` depths, `SAMPLER_OPTIONS.thickness`, `topY`, and the bounding-box/default-thickness assertions updated from 20/24 to 14/18 | 3 |
| `test-prints/socket-tray-sampler.stl` | overwritten via the regenerated script, superseding the 20mm/24mm file | 2 |
| `reference/socket-tray-sampler-report.md` | edited throughout (this document) | 4 |
| `test-prints/README.md` | not touched this pass — its existing description already describes the coupon generically enough (points to this report for exact numbers) that it did not need editing; confirmed by rereading it | not in scope this pass |
| `multiconnectContainerGeometry.ts` | not touched | do-not-touch |
| `test-prints/[Metric\|SAE]*.stl` (6 files) | not touched, not opened | do-not-touch |
| `openGridSnapGeometry.ts` / `openGridSnapMesh.ts` | not touched | do-not-touch |
| `deploy/docker/*`, Unraid/GHCR files | not touched | do-not-touch |

No STOP-AND-REPORT condition was hit this pass either: dropping to 14mm
pocket depth (4mm floor unchanged, so the floor-thickness margin above the
2mm minimum is untouched) did not break the manifold, exact-directed-edge,
or per-pocket raycast checks — all 14 tests in
`tests/unit/socketTrayGeometry.test.ts` still pass, and the full suite is
green at 316/316.

## Open questions

- **Pocket depth (now 14mm) is still the single most estimate-y number
  here.** Lowered from 20mm this pass at the owner's direction, but that
  doesn't resolve the underlying uncertainty — real 3/8"-drive standard
  sockets vary more by size than a single flat depth suggests (a 15mm
  socket and a 28mm socket are not usually the same height), and 14mm
  wasn't checked against a real socket any more than 20mm was. Worth
  explicitly measuring a few real sockets' heights before the next pass
  rather than continuing to guess at one number for every diameter.
- **No radial clearance was added.** If the pockets print at exactly
  nominal diameter, FDM shrinkage/tolerance may make sockets a tight press
  fit or not fit at all — that's exactly what this coupon is for, but it
  means "doesn't fit" on the first print isn't necessarily evidence the
  diameter estimate itself is wrong.
- **Sockets aren't just cylinders** — a real 3/8" drive socket has a
  hex/square broach at the bottom opening and sometimes a step or knurl
  near the top; this coupon models a plain cylindrical bore only, sized to
  the socket's outer barrel. If the owner's sockets have a flared or
  stepped OD, this coupon won't reveal that until they're physically tried.
- **No back plate / OpenGrid Snap mount yet** (explicitly out of scope this
  pass, confirmed in the recon) — this coupon is a standalone block, not
  yet anything that attaches to a board.

## Closing summary (plain English)

The coupon is now a **240 x 60 x 18mm** block (down from 240 x 60 x 24mm)
with the same five round blind pockets in a row — diameters 15, 18, 22, 25,
and 28mm going left to right, unchanged — now **14mm deep** (down from
20mm), floor still 4mm. Same open questions as before, just at the new
depth: the single pocket depth applied to every diameter is still the
number I'm least sure is right, and going shallower doesn't change that
uncertainty either way. Nothing about the thinner floor/pocket looked
riskier geometrically — the floor margin above the module's 2mm minimum
didn't change (still 4mm), and every manifold/raycast test that would have
caught a floor or seam problem at 14mm still passes cleanly.
