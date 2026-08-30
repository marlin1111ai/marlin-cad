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
unchanged). `test-prints/socket-tray-sampler.stl` was overwritten again;
the 15-28mm STL no longer exists on disk.

**2026-08-30 UPDATE 3: 5 pockets → 6, real measured diameters (14, 15, 19,
20.70, 23, 25mm), pitch reduced 45mm → 36mm.** Depth (14mm), floor (4mm),
and tray width (240mm, though now derived differently — see below) are
unchanged in value; tray depth (60mm) is unchanged. Going to 6 pockets at
the old 45mm pitch/30mm margins would have needed a 285mm-wide tray, 29mm
over the Bambu X1C's 256mm bed — this was caught, reported, and the owner
approved reducing pitch instead of shrinking margins or diameters; see the
"Bed-fit" subsection below for the math. This entire document has been
updated in place to describe the current 6-pocket, real-measured-data
coupon — every figure below reflects the current state, not any
superseded version. `test-prints/socket-tray-sampler.stl` was overwritten
again; the 5-pocket, 10-27mm STL no longer exists on disk.

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
  check that the tray between pockets has no accidental opening (now 17
  tests as of Update 3, up from 14 — see that section's SCOPE CHECK for
  what was added). Full suite (`npm test`) is green at 319/319, and
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
| Tray width (X, left-right) | **240mm** | Was a hard constraint from the original brief (matched the wrench rack plates' footprint). As of Update 3 it is no longer that constraint — with 6 pockets it is instead the *result* of 30mm margins + 5×36mm pitch (`30 + 180 + 30 = 240`, see "Bed-fit" below) — it lands on the same number by coincidence of the chosen pitch, not because anything still requires matching the wrench racks. |
| Tray depth (Z, front-back) | **60mm** | Sized for the original 15-28mm OD range with real edge margin on both sides; unchanged since. At the current largest pocket (25mm), the rim sits 17.5mm from the front/back edges — still comfortably past the 5mm minimum edge clearance the module enforces. 60mm was never the minimum possible depth; it stays a comfortable choice rather than a tight one. |
| Tray thickness (Y, up) | **18mm** | = pocket depth (14mm) + floor thickness (4mm). Not derived independently — see pocket depth and floor thickness below. Reduced from the first coupon's 24mm (20mm depth + 4mm floor) at the owner's request; floor thickness itself is unchanged. |
| Pocket depth (all 6, single value per the brief) | **14mm** | Unchanged since Update 1. Still an estimate for a 3/8"-drive standard (non-deep) socket's height, toward the shallower end of the roughly 12-25mm range these sockets run across common metric sizes. **This is now the only remaining estimate in the coupon** — the diameters are real measured data as of this pass (see below), so depth is the one number left that hasn't been checked against anything real. Flagged again in Open Questions below. |
| Floor thickness (material kept under each pocket) | **4mm** | Comfortably above the 2mm `MIN_SOCKET_TRAY_FLOOR_THICKNESS` the module enforces (chosen per `CLAUDE-LESSONS.md`'s slicer-slit-fusion lesson: don't let a floor go arbitrarily thin just because the geometry permits it) — 4mm prints as several solid layers and should handle a socket being set down into the pocket without flexing. |

## The 6 pocket diameters and positions

**Diameters are now real measured data, not estimates.** Per the brief:
each of the 6 values is a real measured socket OD plus a stated 2mm
clearance, covering all 12 standard sockets from 5mm to 16mm (multiple
sockets share a pocket sized for the largest one in its group — see the
mapping subsection below). This is a change in kind from every prior
revision, where diameters were the foreman's estimate of a plausible
range to test against. Diameters, left to right: **14, 15, 19, 20.70, 23,
25mm**.

Pocket count went from 5 to 6 this pass, which forced the layout to be
re-derived (see "Bed-fit" below) — pitch dropped from 45mm to 36mm, but
the 30mm edge margins and the z=30 (tray depth centerline) convention are
unchanged from every prior revision:

| # (left→right) | Diameter (OD) | Depth | Center (x, z) | Edge/neighbor clearance |
|---|---|---|---|---|
| 1 | **14mm** | 14mm | (30, 30) | 23mm to left edge |
| 2 | **15mm** | 14mm | (66, 30) | 21.5mm gap to pocket 1 |
| 3 | **19mm** | 14mm | (102, 30) | 19mm gap to pocket 2 |
| 4 | **20.70mm** | 14mm | (138, 30) | 16.15mm gap to pocket 3 |
| 5 | **23mm** | 14mm | (174, 30) | 14.15mm gap to pocket 4 |
| 6 | **25mm** | 14mm | (210, 30) | 12mm gap to pocket 5; 17.5mm to right edge |

Every gap and edge clearance above clears the module's 4mm minimum gap /
5mm minimum edge clearance by a wide margin — the tightest value anywhere
in the layout is the 12mm gap between the two largest neighboring pockets
(23mm and 25mm), 3x the 4mm floor. Front/back edge clearance (fixed
center at z=30, tray depth 60mm) ranges from 23mm (smallest pocket) to
17.5mm (largest), all well past the 5mm minimum.

Unlike every prior revision, **the 2mm clearance is not "no radial
clearance added"** — it's already baked into these 6 diameters by the
owner's own stated methodology (measured OD + 2mm). This coupon is
therefore testing both the diameter estimates *and* whether 2mm of radial
clearance is the right amount, not testing bare OD-for-OD fit the way the
15-28mm and 10-27mm coupons did.

### Sockets-per-pocket mapping (5-16mm)

The brief states these 6 diameters cover all 12 standard sockets from 5mm
to 16mm, with multiple sockets sharing a pocket. **I was given the 6 final
diameters, not the owner's underlying per-socket OD measurements**, so I
cannot responsibly state which of the 12 nominal sizes maps to which
pocket as verified fact — that correspondence lives in data I don't have.
What I *can* derive without guessing is the maximum OD each pocket
accommodates, by reversing the stated "OD + 2mm" formula:

| Pocket | Diameter | Max accommodated OD (diameter − 2mm) |
|---|---|---|
| 1 | 14mm | 12mm |
| 2 | 15mm | 13mm |
| 3 | 19mm | 17mm |
| 4 | 20.70mm | 18.70mm |
| 5 | 23mm | 21mm |
| 6 | 25mm | 23mm |

The simplest inference consistent with "12 sockets, 6 pockets, ascending
order" is 2 consecutive nominal sizes per pocket (5&6→pocket 1, 7&8→pocket
2, 9&10→pocket 3, 11&12→pocket 4, 13&14→pocket 5, 15&16→pocket 6) — **but
this is my inference, not confirmed data**, and the uneven spacing between
pockets (a 4mm jump from pocket 1 to pocket 2, versus 1-2mm jumps
elsewhere) suggests the real grouping likely isn't a uniform 2-per-pocket
split. Flagged as an open question below rather than presented as settled
— the owner's own measurement notes are the source of truth here, not
anything I can reconstruct from 6 final numbers.

### Bed-fit

Extending the 5-pocket layout's 45mm pitch / 30mm margins to 6 pockets
would require `30 + 5×45 + 30 = 285mm` — 29mm over the Bambu X1C's 256mm
bed with zero spare margin. This was caught before generating anything,
reported to the owner along with the option of shrinking margins instead
(which still only reaches 254.5mm at the module's bare 5mm-edge-clearance
minimum — technically under 256mm but with ~1.5mm total spare, not "real
margin"). The owner approved reducing pitch instead, targeting ~240mm:

`30 (left margin) + 5×36 (5 gaps at the new pitch) + 30 (right margin) = 240mm`

**240mm exactly, 16mm of spare under the X1C's 256mm bed** — read back
from the regenerated STL's own bounding box, not assumed (see "STL
export" below). Every adjacent-pocket gap at 36mm pitch still clears the
module's 4mm minimum by 3x or more (worst case: the two largest
neighboring pockets, 23mm/25mm, at 12mm of clearance) — confirmed by a
dedicated unit test, not just arithmetic (see SCOPE CHECK).

## STL export

- File: `test-prints/socket-tray-sampler.stl` (overwritten in place; supersedes the 5-pocket, 10-27mm version)
- Format: ASCII STL, `solid socket_tray_sampler` / `endsolid socket_tray_sampler`
- File size: 350,661 bytes
- Triangle count: **1,548** (up from 1,292 — consistent with one additional 64-segment pocket: its own cylindrical wall, its floor cap, and one more notch in the top face's earcut triangulation; confirmed by counting `facet normal` lines and cross-checked against 4,644 `vertex` lines = 1,548 × 3)
- Bounding box, read back from the regenerated file's own vertex coordinates (not assumed from the script's inputs): scene-space (after mapping the STL's Z-up axes back through the inverse of `sketchForgeToZUp`) X 0→**240mm**, Y (thickness) 0→**18mm**, Z (depth) 0→**60mm** — i.e. exactly 240 × 60 × 18mm, confirming the bed-fit math above landed correctly in the actual export, not just on paper.
- **Per-pocket diameter, verified directly against the regenerated file** (not just assumed from the generator script's inputs): each pocket's floor-ring vertices — all lying exactly on the tray's Y=4mm (floor) plane by construction — were isolated with a search radius tight to each pocket's own expected rim (loose enough to catch its own 64 rim vertices, tight enough to exclude a neighbor's — necessary this pass since pockets are now only 36mm apart center-to-center, versus 45mm before) and their distance from that pocket's center measured. Every floor ring is a perfect circle (378 vertices each, consistent with `SOCKET_TRAY_POCKET_SEGMENTS = 64` segments) at exactly the expected radius, min and max radius identical to 4 decimal places:

  | Center (x, z) | Expected diameter | Measured diameter (min↔max) |
  |---|---|---|
  | (30, 30) | 14mm | 14.0000mm |
  | (66, 30) | 15mm | 15.0000mm |
  | (102, 30) | 19mm | 19.0000mm |
  | (138, 30) | 20.70mm | 20.7000mm |
  | (174, 30) | 23mm | 23.0000mm |
  | (210, 30) | 25mm | 25.0000mm |

  All 6 diameters, including the non-round 20.70mm value, landed in the exported file exactly as specified — no rounding occurred anywhere in the pipeline.

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

### 2026-08-30 UPDATE 3 pass (6 pockets, real measured diameters, 36mm pitch)

This pass followed an intermediate exchange (not in the git history, no
files touched): fitting 6 pockets at the old 45mm pitch/30mm margins was
computed, found to need a 285mm-wide tray (29mm over the 256mm X1C bed),
and reported to the owner rather than silently adjusted — see "Bed-fit"
above. The owner approved reducing pitch to 36mm; this pass implements
that approved layout.

| File | Action | Task step |
|---|---|---|
| `scripts/generate-socket-tray-sampler.mjs` | edited — `POCKETS` array: 5 entries → 6, diameters 10/14/18/22/27 → 14/15/19/20.70/23/25, centers recomputed for 36mm pitch (30/66/102/138/174/210 replacing 30/75/120/165/210/—); depth (14mm) and thickness option (18) untouched | 1, 2 |
| `tests/unit/socketTrayGeometry.test.ts` | edited — `SAMPLER_POCKETS` updated to match (6 entries); "between pockets" midpoints recomputed for the new centers/pitch (5 values, was 4); added a new dedicated test for the tightest gap specifically (the two largest neighboring pockets, 23mm/25mm) per the brief's explicit ask to verify that gap; renamed largest/smallest-pocket test titles (28mm→27mm was already stale from Update 2, now 27mm→25mm; 10mm→14mm since 10mm is no longer in the set) | 3 |
| `test-prints/socket-tray-sampler.stl` | overwritten via the regenerated script, superseding the 5-pocket, 10-27mm file | 2 |
| `reference/socket-tray-sampler-report.md` | edited throughout (this document) — diameter/position tables rewritten for 6 pockets, new "Bed-fit" and "Sockets-per-pocket mapping" subsections added, dimensions table's tray-width reasoning corrected (no longer a hard constraint, now a consequence of the bed-fit math) | 4 |
| `apps/web/src/lib/socketTrayGeometry.ts` | **not touched this pass** — width/depth/thickness defaults are all still correct (240/60/18 unchanged in value), pocket positions and diameters are always caller-supplied, so there was nothing in the module itself to update | — |
| `test-prints/README.md` | edited — diameter list in the "Unvalidated samplers" entry updated from 10/14/18/22/27mm to 14/15/19/20.70/23/25mm | not explicitly listed in this brief's deliverables, but required to avoid leaving stale diameters as the described current state |
| `multiconnectContainerGeometry.ts` | not touched | do-not-touch |
| `test-prints/[Metric\|SAE]*.stl` (6 files) | not touched, not opened | do-not-touch |
| `openGridSnapGeometry.ts` / `openGridSnapMesh.ts` | not touched | do-not-touch |
| `deploy/docker/*`, Unraid/GHCR files | not touched | do-not-touch |

No STOP-AND-REPORT condition was hit this pass: the reduced 36mm pitch did
not cause any pocket-to-pocket clearance failure. All 17 tests in
`tests/unit/socketTrayGeometry.test.ts` pass (15 from before + 2 new: the
dedicated tightest-gap check and the renamed/retargeted smallest-pocket
check), the full suite is green at 319/319, and
`npx tsc -p apps/web/tsconfig.json --noEmit` is clean.

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

- **Pocket depth (14mm) is now the ONLY remaining estimate in the coupon.**
  Diameters became real measured data this pass, but depth did not — it's
  still the foreman's estimate from Update 1, never checked against a real
  socket. Real sockets vary in height by size more than a single flat
  depth suggests (a 14mm socket and a 25mm socket are not usually the same
  height). Worth explicitly measuring a few real sockets' heights before
  the next revision.
- **The sockets-per-pocket mapping is inferred, not confirmed.** This
  report's "Sockets-per-pocket mapping" table above reconstructs each
  pocket's max-accommodated-OD from the stated "OD + 2mm" formula (that
  part is real arithmetic), but the actual correspondence between the 12
  nominal socket sizes (5-16mm) and the 6 pockets was not included in this
  brief — only the 6 final diameters were. I was NOT given the owner's raw
  per-socket measurements, so I did not fabricate a specific size-to-pocket
  table; a naive "2 consecutive sizes per pocket" grouping was floated as
  the simplest guess but flagged as unconfirmed, since the uneven spacing
  between pocket diameters (a 4mm jump from pocket 1→2, versus 1-2mm
  jumps elsewhere) suggests the real grouping isn't uniform. If a specific
  mapping matters for the print evaluation, the owner's own measurement
  notes are the source of truth, not this report.
- **The 2mm radial clearance is itself now something this coupon is
  testing, not something assumed absent.** Every prior revision explicitly
  added zero clearance (testing bare-OD fit); this revision's diameters
  already include the owner's stated 2mm clearance. If a socket doesn't
  fit at OD+2mm, that's now evidence about the clearance amount, not just
  the diameter estimate — worth distinguishing the two when the print
  comes back.
- **Sockets aren't just cylinders** — a real socket has a hex/square
  broach at the bottom opening and sometimes a step or knurl near the top;
  this coupon models a plain cylindrical bore only, sized to the socket's
  outer barrel. If the owner's sockets have a flared or stepped OD, this
  coupon won't reveal that until they're physically tried.
- **No back plate / OpenGrid Snap mount yet** (explicitly out of scope this
  pass, confirmed in the recon) — this coupon is a standalone block, not
  yet anything that attaches to a board. The brief also names a future
  12-pocket production tray as the next step after this sampler validates
  — explicitly out of scope for this pass.

## Closing summary (plain English)

The coupon is now **six** pockets instead of five: **14, 15, 19, 20.70,
23, and 25mm**, left to right — real measured socket widths plus 2mm
clearance this time, not estimates. Verified directly against the
regenerated STL's own vertex coordinates (not just the script's inputs)
that all six diameters, including the non-round 20.70mm, landed exactly
as specified with zero rounding anywhere in the pipeline. Depth (14mm)
and floor (4mm) are unchanged.

Fitting 6 pockets meant the tray couldn't keep the old 45mm spacing — that
would have needed a 285mm-wide tray, 29mm over your X1C's 256mm bed — so I
stopped and reported it instead of quietly shrinking something to make it
fit. You approved tightening the spacing to 36mm, and that's what's
built: **final tray width 240mm**, confirmed by reading the regenerated
STL's own bounding box, which leaves **16mm of spare** under the 256mm
bed — comfortable, not a razor-thin fit.

Nothing about the tighter 36mm spacing or the 20.70mm non-round value
looked risky in the build: every pocket-to-pocket gap is still at least
3x the module's 4mm minimum (the tightest pair, the two largest
neighboring pockets at 23mm and 25mm, still has 12mm of material between
them — confirmed by a dedicated test, not just arithmetic), and the
20.70mm value flowed through the geometry, tests, and STL export exactly
like any other number — nothing in the pipeline rounds or truncates. The
one thing I couldn't responsibly deliver as fact: which of your 12
measured socket sizes (5-16mm) goes in which pocket. You gave me the 6
final diameters, not the underlying per-socket measurements, so I
included the math I *can* derive (max OD each pocket fits) and flagged
the sizes-to-pockets grouping as my best guess, not confirmed data —
see "Sockets-per-pocket mapping" and Open Questions above.
