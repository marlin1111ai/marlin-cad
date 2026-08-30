# Socket Tray sampler coupon — build report

Implements step 1 of the BUILD brief following the boundary-rep pattern and
file location settled in `reference/socket-tray-recon.md` (read first, not
re-derived here). New primitive module + a printable coupon generated from
it, committed locally only (no push yet, per the GIT gate in the brief).

**2026-08-30 UPDATE 1: pocket depth reduced from 20mm to 14mm, tray thickness
from 24mm to 18mm** (floor thickness unchanged at 4mm; width/depth/pocket
diameters unchanged at that point). `test-prints/socket-tray-sampler.stl`
was overwritten (not versioned separately); the 20mm/24mm STL no longer
exists on disk.

**2026-08-30 UPDATE 2: pocket diameters shifted from 15/18/22/25/28mm to
10/14/18/22/27mm** (depth 14mm, floor 4mm, tray 240 x 60 x 18mm all
unchanged from Update 1 — only the diameter list moved, pocket centers are
unchanged). This entire document has been updated in place to describe the
current 10-27mm/14mm-deep/18mm-thick coupon — every figure below reflects
the current state, not either superseded version.
`test-prints/socket-tray-sampler.stl` was overwritten again; the 15-28mm
STL no longer exists on disk.

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
| Tray depth (Z, front-back) | **60mm** | Sized for the original 15-28mm OD range with real edge margin on both sides; unchanged this pass. Now that the diameter range has shifted down to 10-27mm (see below), the largest pocket's rim sits 16.5mm from the front/back edges — if anything more comfortable than the 16mm it had at 28mm OD, still well past the 5mm minimum edge clearance the module enforces. 60mm was never the minimum possible depth; it stays a comfortable choice rather than a tight one. |
| Tray thickness (Y, up) | **18mm** | = pocket depth (14mm) + floor thickness (4mm). Not derived independently — see pocket depth and floor thickness below. Reduced from the first coupon's 24mm (20mm depth + 4mm floor) at the owner's request; floor thickness itself is unchanged. |
| Pocket depth (all 5, single value per the brief) | **14mm** | Reduced from the first coupon's 20mm estimate. Still an estimate for a 3/8"-drive standard (non-deep) socket's height, now toward the shallower end of the roughly 12-25mm range these sockets run across common metric/SAE sizes, rather than the middle. **Still the least-derived number in the whole coupon** — not checked against any real socket. Flagged again in Open Questions below. |
| Floor thickness (material kept under each pocket) | **4mm** | Comfortably above the 2mm `MIN_SOCKET_TRAY_FLOOR_THICKNESS` the module enforces (chosen per `CLAUDE-LESSONS.md`'s slicer-slit-fusion lesson: don't let a floor go arbitrarily thin just because the geometry permits it) — 4mm prints as several solid layers and should handle a socket being set down into the pocket without flexing. |

## The 5 pocket diameters and positions

**Diameters shifted this pass from 15/18/22/25/28mm to 10/14/18/22/27mm.**
Pocket centers are unchanged (same center-to-center pitch 45mm, centers at
z=30, the tray depth centerline) — only the diameter list moved, so every
pocket's footprint shrank in place rather than the layout being
re-derived:

| # (left→right) | Diameter (OD) | Depth | Center (x, z) | Edge/neighbor clearance |
|---|---|---|---|---|
| 1 | **10mm** | 14mm | (30, 30) | 25mm to left edge; 25mm to front/back edge |
| 2 | **14mm** | 14mm | (75, 30) | 33mm gap to pocket 1; 23mm to front/back edge |
| 3 | **18mm** | 14mm | (120, 30) | 29mm gap to pocket 2; 21mm to front/back edge |
| 4 | **22mm** | 14mm | (165, 30) | 25mm gap to pocket 3; 19mm to front/back edge |
| 5 | **27mm** | 14mm | (210, 30) | 20.5mm gap to pocket 4; 16.5mm to right edge; 16.5mm to front/back edge |

Every clearance figure above is now larger than the equivalent figure was
at 15-28mm OD (e.g. pocket 1's edge clearance grew from 22.5mm to 25mm,
the smallest adjacent gap grew from 18.6mm to 20.5mm) — smaller sockets
at the same fixed centers simply leave more surrounding material, well
clear of the module's 5mm edge / 4mm gap minimums either way. All
diameters and the depth remain round-number **estimates** — not
measurements against real sockets. No radial clearance/tolerance was
added on top of the stated diameters: since the whole point of this
coupon is to compare it against real sockets and report back what fits,
adding an unstated fudge factor now would only make that comparison
harder to interpret. The next pass should size pockets off the owner's
actual caliper measurements plus a deliberate, stated clearance, informed
by this coupon's print.

## STL export

- File: `test-prints/socket-tray-sampler.stl` (overwritten in place; supersedes the 15-28mm-diameter version)
- Format: ASCII STL, `solid socket_tray_sampler` / `endsolid socket_tray_sampler`
- File size: 291,761 bytes
- Triangle count: **1,292** (unchanged from the prior coupon — same topology, only radii changed; confirmed by counting `facet normal` lines and cross-checked against 3,876 `vertex` lines = 1,292 × 3)
- Bounding box, read back from the regenerated file's own vertex coordinates (not assumed from the script's inputs): scene-space (after mapping the STL's Z-up axes back through the inverse of `sketchForgeToZUp`) X 0→**240mm**, Y (thickness) 0→**18mm**, Z (depth) 0→**60mm** — i.e. exactly 240 × 60 × 18mm, unchanged from Update 1, confirming this pass touched only the pockets.
- **Per-pocket diameter, verified directly against the regenerated file** (not just assumed from the generator script's inputs): each pocket's floor-ring vertices — all lying exactly on the tray's Y=4mm (floor) plane by construction — were clustered by nearest known pocket center and their distance from that center measured. Every floor ring is a perfect circle (378 vertices each, consistent with `SOCKET_TRAY_POCKET_SEGMENTS = 64` segments × 6 triangles' worth of index reuse) at exactly the expected radius, min and max radius identical to 4 decimal places:

  | Center (x, z) | Expected diameter | Measured diameter (min↔max) |
  |---|---|---|
  | (30, 30) | 10mm | 10.0000mm |
  | (75, 30) | 14mm | 14.0000mm |
  | (120, 30) | 18mm | 18.0000mm |
  | (165, 30) | 22mm | 22.0000mm |
  | (210, 30) | 27mm | 27.0000mm |

  All 5 diameters landed in the exported file exactly as specified.

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

### 2026-08-30 UPDATE 2 pass (diameters 10/14/18/22/27mm)

| File | Action | Task step |
|---|---|---|
| `scripts/generate-socket-tray-sampler.mjs` | edited — `POCKETS` array diameters 15/18/22/25/28 → 10/14/18/22/27; centers (x, z) and depths untouched | 1, 2 |
| `tests/unit/socketTrayGeometry.test.ts` | edited — `SAMPLER_POCKETS` diameters updated to match; renamed the "largest pocket" test's title from 28mm to 27mm; added a new explicit off-center raycast test for the smallest (10mm) pocket, mirroring the existing largest-pocket test, per the brief's specific concern about a minimum-size edge case | 3 |
| `test-prints/socket-tray-sampler.stl` | overwritten via the regenerated script, superseding the 15-28mm file | 2 |
| `reference/socket-tray-sampler-report.md` | edited throughout (this document) | 4 |
| `apps/web/src/lib/socketTrayGeometry.ts` | **not touched this pass** — diameters are always caller-supplied per pocket (`SocketTrayPocket.diameter`), there is no in-module diameter default or constant to update, unlike the thickness default touched in Update 1 | — |
| `test-prints/README.md` | edited — diameter list in the "Unvalidated samplers" entry updated from 15/18/22/25/28mm to 10/14/18/22/27mm (it had been left un-edited in the prior depth-only pass since it didn't mention depth/thickness figures at all, but it does list diameters, so this pass required the edit that pass didn't) | not explicitly listed in this brief's deliverables, but required to avoid leaving stale diameters as the described current state |
| `multiconnectContainerGeometry.ts` | not touched | do-not-touch |
| `test-prints/[Metric\|SAE]*.stl` (6 files) | not touched, not opened | do-not-touch |
| `openGridSnapGeometry.ts` / `openGridSnapMesh.ts` | not touched | do-not-touch |
| `deploy/docker/*`, Unraid/GHCR files | not touched | do-not-touch |

No STOP-AND-REPORT condition was hit this pass: the 10mm pocket (the
smallest this module has been exercised against, versus 15mm previously)
did not expose any minimum-size failure. All 15 tests in
`tests/unit/socketTrayGeometry.test.ts` pass (14 existing + 1 new
smallest-pocket probe), the full suite is green at 317/317, and
`npx tsc -p apps/web/tsconfig.json --noEmit` is clean. See "Verification
at the smaller diameter" below for what was specifically checked.

## Verification at the smaller diameter

The brief singled out the 10mm pocket as the one most likely to expose a
minimum-size edge case in the boundary-rep construction (rim-to-floor
stitching, earcut triangulation of the top face's hole, or the pocket wall
loop). Beyond the existing manifold/exact-edge/raycast-at-center tests
(which all still pass), this pass added a dedicated check —
`off-center inside the smallest pocket (10mm), still open top-to-floor` —
that raycasts 2mm off the 10mm pocket's own center (3mm in from its 5mm
rim) rather than only at the exact axis, since a construction bug at small
radius seemed more likely to show up away from the center than exactly on
it. It passed identically to the equivalent largest-pocket check. Nothing
in the construction itself (see `reference/socket-tray-recon.md`) scales
with diameter in a way that would predict a small-diameter failure mode —
`SOCKET_TRAY_POCKET_SEGMENTS` is a fixed 64-segment circle regardless of
radius, so a 10mm pocket is triangulated exactly as finely as a 27mm one,
just physically smaller — and the observed results bore that out.

## Open questions

- **Pocket depth (14mm) is still the single most estimate-y number here.**
  Unchanged this pass, but the underlying uncertainty is unchanged too —
  real 3/8"-drive standard sockets vary more by size than a single flat
  depth suggests (a 10mm socket and a 27mm socket are not usually the same
  height), and 14mm hasn't been checked against a real socket at any point
  across either revision. Worth explicitly measuring a few real sockets'
  heights before the next pass rather than continuing to guess at one
  number for every diameter.
- **The diameter range shifted down twice now (28→27mm top end, 15→10mm
  bottom end) without an explanation recorded anywhere in this brief.**
  Not a problem to fix, just worth flagging: if the shift reflects the
  owner having measured or reconsidered actual socket sizes, that
  reasoning would be worth capturing here for the next revision instead of
  the report only tracking the "what changed" and not the "why."
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

The coupon is still a **240 x 60 x 18mm** block, five round blind pockets
in a row, 14mm deep, 4mm floor — none of that changed this pass. What
changed is the diameters: **10, 14, 18, 22, and 27mm** going left to right
(down from 15/18/22/25/28mm), same center positions as before, just
smaller circles cut at each one. Verified directly against the
regenerated STL's own vertex coordinates (not just the script's inputs)
that all five diameters landed exactly right, to the ten-thousandth of a
millimeter. Nothing looked riskier at the smaller end: the smallest
pocket (10mm, the smallest this module has ever been asked to cut) passed
every manifold, seam, and raycast check the same as every other pocket,
including a new check specifically probing off-center inside it rather
than just at its exact middle — there was no minimum-size construction
failure to report.
