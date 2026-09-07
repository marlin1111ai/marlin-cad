# Screwdriver Tray — read-only recon

**Date:** 2026-09-07 · **Pass:** read-only, zero code changes
**Goal (owner-approved, for a later build pass):** two NEW sibling shapes —
a flat **Screwdriver Tray** copied from the flat Socket Tray, and a
**Mounted Screwdriver Tray** copied from the Mounted Socket Tray. Same
controls as their socket counterparts, with **Pocket Depth removed
entirely**: the hole goes all the way THROUGH the tray. Purpose: the shaft
passes through, the handle rests on top.

**Frozen by owner decision:** `socketTrayGeometry.ts` and
`mountedSocketTrayGeometry.ts` and every one of their tests, coupons,
defaults and inspector rows are **untouched**. This is additive — new
sibling shapes, never a modification or a toggle. Precedent for exactly this
move already exists: `mountedSocketTrayGeometry.ts` was added as a sibling
that *imports from* `socketTrayGeometry.ts` (`:19-25`) and edits nothing
(DECISIONS.md, "The mounted tray is a separate shape and module").

Line references are to the files as of `447c977`.

---

## 1. How a blind pocket is built today, and what changes for a through-hole

### 1a. The flat tray — `apps/web/src/lib/socketTrayGeometry.ts`

A pocket is four pieces of surface, all boundary-rep, no CSG:

| Piece | Where | Line |
|---|---|---|
| **Rim ring** (the notch in the top face) | `pocketBuilds` → `rings[0]`, at `y = topY` | `:350-353` (r=0) / `:355-371` (r>0) |
| **Rim → top-face notch** | `pocketHoles` fed to `pushCap` as earcut holes on the top face | `:374`, `:390` (r=0), `:449` (r>0) |
| **Cylindrical wall** | quad band from `rings[rings.length-1]` down to `floorRing` | `:511-524` |
| **Floor cap** | earcut disc at `floorY`, normal `[0,1,0]` (up, into the cavity) | `:525-527` |

`floorY = topY - pocket.depth` (`:349`); `floorRing` is the same circle at
that Y (`:350`). The **bottom face is a plain uncut rectangle** at both
radii — `pushRectangleCap` at `:394` (r=0) and `:453` (r>0) — and the file
header states the guarantee explicitly: "a pocket only ever perforates the
top face by construction" (`:29-34`).

**What changes to make it a through-hole:**

1. `floorY` becomes `0` and `floorRing` becomes the **bottom ring** — the
   same circle at `y = 0`. Same construction call, same `POCKET_ANGLES`
   (`:312`), so the exact-stitch contract is preserved for free.
2. The **wall band `:511-524` is kept verbatim**; it simply now spans
   `wallTopRing → bottomRing` (top face to bottom face). No change to the
   inward-normal derivation at `:521-522`.
3. **The floor cap at `:527` is deleted.** That is the only triangle
   emission that disappears.
4. **The bottom face gains the notch the top face already has.** The two
   `pushRectangleCap` calls at `:394` and `:453` become `pushCap` calls with
   the pocket contours as earcut holes, exactly mirroring the branching the
   top face already does at `:387-391` / `:446-450` — including the
   zero-pocket fallback to `pushRectangleCap`. See §3.
5. `SocketTrayPocket.depth` (`:108-109`, declared at `:106-114`) is removed
   from the type; the through-hole depth *is* the tray thickness.

Nothing else in the module participates in the floor. The four side walls
(`:396-401`, `:455-461`), the outer-edge fillet bands (`:463-487`) and the
pocket rim fillet (`:498-510`) are untouched by the change.

### 1b. The mounted tray — `apps/web/src/lib/mountedSocketTrayGeometry.ts`

Structurally identical, with two differences that matter:

| Piece | Where | Line |
|---|---|---|
| **Rim ring** | `pocketBuilds` → `rings[0]`, at `y = trayTopY` | `:623-626` (r=0) / `:628-645` (r>0) |
| **Rim → tray-top notch** | `pocketHoles` fed to the tray-top `pushCap` | `:647`, `:705` (r=0), `:777` (r>0) |
| **Cylindrical wall** | quad band `rings[last] → floorRing` | `:882-892` |
| **Floor cap** | earcut disc at `floorY`, normal `[0,1,0]` | `:893-895` |

`floorY = trayTopY - pocketDepth` (`:622`), `floorRing` at `:623`.

The two differences:

- **The bottom face is shared with the back plate and already carries
  notches.** It is emitted once, inside `pushBottomAndMountingFaces`
  (`:656-687`), as a single `pushCap` (`:671`) whose *contour* already dives
  around one slot-channel cross-section per slot (`:662-670`). It is called
  at the same position in both radius branches (`:697`, `:771`) — see
  KNOWN-FIXES.md on why that emission order is load-bearing.
- **`pocketDepth` is a single shared value**, not per pocket: option at
  `:210-211`, read at `:553`, passed into `normalizedPockets` at `:582`.

**What changes:** the same five changes as the flat tray, with the bottom
face being the `pushCap` at `:671` — which already takes a `holes` argument
it currently doesn't use — and with `options.pocketDepth` (`:211`, `:553`)
and `DEFAULT_MOUNTED_SOCKET_TRAY_POCKET_DEPTH` (`:175`) removed rather than
a per-pocket `depth` field.

### 1c. Everywhere else the floor participates

**Tests — flat** (`tests/unit/socketTrayGeometry.test.ts`):
- `:315-320` per-pocket raycast: `crossings[0] ≈ 0` (tray bottom) and
  `crossings[1] ≈ floorY`. For a through-hole this becomes **zero crossings
  on the pocket axis** — the ray passes clean through.
- `:241-248` the same assertion against the **exported STL** at
  `cornerRadius = 3`.
- `:346`, `:359` off-center-inside-the-pocket raycasts — same inversion.
- `:251` between-pockets solid slab — **unchanged**, still valid and still
  required.
- `:370-371` the too-thin-floor guard test — deleted (see §2).
- `:79` the exact-stitch comment enumerating "pocket wall bottom ↔ floor
  cap" — that seam ceases to exist; the wall's bottom ring now stitches to
  the bottom face's notch instead.
- `:51` the header arithmetic "pocket depth 14mm + 4mm floor = 18mm".

**Tests — mounted** (`tests/unit/mountedSocketTrayGeometry.test.ts`):
- `:267-271`, `:284` per-pocket raycasts incl. the mirrored-x pocket.
- `:482-489` the exported-STL rounded raycast.
- `:490` between-pockets solid — unchanged.
- `:400-401` the floor guard test — deleted.
- `:321-344`, `:501-510` slot-channel raycasts — **unchanged and still
  required**; §5 confirms a through-hole cannot disturb them.

**Registration** (both shapes): `shapeCatalog.ts:203-204` and `:293` map the
module's `/floor/` error text to a friendly "Pocket Depth leaves less than
the 2mm minimum floor" message. Both have no analogue on a through-hole
shape and are simply absent from the new mappings.

---

## 2. Every validation guard that assumes a floor

| # | Guard | File:line | Becomes |
|---|---|---|---|
| 1 | `thickness - pocketDepth < MIN_SOCKET_TRAY_FLOOR_THICKNESS` → throw | `socketTrayGeometry.ts:178-182` | **Deleted.** There is no floor. |
| 2 | `pocketDepth` must be finite and `> 0` (part of the `[diameter, pocketDepth, x, z]` check) | `socketTrayGeometry.ts:175-177` | **Narrowed** to `[diameter, x, z]` / `diameter > 0`. |
| 3 | `cornerRadius >= pocket.depth` → "no straight wall below it in pocket N" | `socketTrayGeometry.ts:218-221` | **Replaced.** With a through-hole the pocket's wall length *is* the tray thickness, so this collapses into the guard that already exists one block up: `cornerRadius >= thickness` (`:215-217`). If the bottom rim is also rounded (§4 option 2) it must become `2 * cornerRadius >= thickness`. |
| 4 | `trayThickness - pocketDepth < MIN_SOCKET_TRAY_FLOOR_THICKNESS` → throw | `mountedSocketTrayGeometry.ts:309-313` | **Deleted.** |
| 5 | `pocketDepth` finite and `> 0` | `mountedSocketTrayGeometry.ts:306-308` | **Deleted** — the field goes away. |
| 6 | `cornerRadius >= pocketDepth` | `mountedSocketTrayGeometry.ts:516-519` | **Replaced** by a check against `trayThickness` (which the mounted module does *not* currently have — the flat tray's `:215-217` has no mounted twin, because `cornerFRoom = min(trayDepth, trayThickness)` at `:512-515` already covers it. `cornerRadius < trayThickness` therefore already holds; if the bottom rim rounds too, it must tighten to `2 * cornerRadius < trayThickness`.) |
| 7 | Inspector `Thickness` row minimum = `MIN_SOCKET_TRAY_FLOOR_THICKNESS` (2) | `ShapeInspector.tsx:426` | Needs **a new minimum with no established value** — a floorless tray has no floor to protect, but a screwdriver hole still needs enough bore length to hold a shaft upright. See §8. |
| 8 | Inspector `Tray Thickness` row minimum = `MIN_SOCKET_TRAY_FLOOR_THICKNESS` | `ShapeInspector.tsx:450` | Same as #7. |
| 9 | Error-text mapping for `/floor/` | `shapeCatalog.ts:203-204`, `:293` | **Absent** from the new shapes' mappings. |

**Guards that do NOT change and must be carried over verbatim:**
`SOCKET_TRAY_POCKET_EDGE_CLEARANCE` = 5 (`socketTrayGeometry.ts:101`, used
`:184-191` / mounted `:327-334`), `SOCKET_TRAY_POCKET_GAP` = 4 (`:104`, used
`:194-201` / mounted `:337-344`), the widened-footprint re-checks at
`:228-247` / mounted `:520-540`, and the mounted tray's `trayThickness >=
plateHeight` self-intersection guard (`:559-561`) and slot-fit guards
(`:564-580`).

`MIN_SOCKET_TRAY_FLOOR_THICKNESS` itself (`socketTrayGeometry.ts:97`) is
**not deleted** — it stays exactly where it is, still used by the two frozen
socket trays. The new modules simply do not import it.

---

## 3. The bottom face — answered

**Yes. The bottom face needs the same hole notched into it that the top face
has, and the existing code can already express that, in the same helper, with
no new machinery.**

- **Flat tray.** The top face is notched by `pushCap(positions, contour,
  to3D, [0,1,0], pocketHoles)` at `:390` (r=0) and `:449` (r>0). `pushCap`'s
  signature already takes `holes: Point2[][] = []` (`:277`) and forwards them
  to `THREE.ShapeUtils.triangulateShape` (`:278-281`). The bottom face is
  currently a `pushRectangleCap` (`:394`, `:453`) purely because it has never
  needed a hole. Changing those two calls to `pushCap(..., [0,-1,0],
  bottomHoles)` — with the existing `pocketHoles.length === 0` fallback to
  `pushRectangleCap`, matching `:387-391` — is the whole change.
- **Mounted tray.** The bottom face is already a `pushCap` (`:671`) with a
  notched contour for the slot channels. It takes the `holes` parameter today
  and passes nothing. Adding `pocketHoles` as the fourth argument is a
  one-argument change. Note the contour is built in `(x, z)` (`:663-670`) and
  `pocketHoles` is likewise `(x, z)` (`:647`), so no re-projection is needed.

Two mechanical notes for the builder:

- `pushCap` resolves winding from the dot product of the first
  non-degenerate triangle against `desiredNormal` (`:288-295` flat, `:454-461`
  mounted), so the bottom cap can reuse the **same contour point order** as
  the top and still come out wound downward. The existing bottom rectangle's
  hand-reversed corner order (`:394`) exists only because
  `pushRectangleCap` is the simpler helper.
- The bottom ring fed to the bottom cap's hole must be **the same `Point3`
  objects** the wall's bottom ring uses — the same rule `pocketHoles` at
  `:374` / `:647` already follows for the top. That is the exact-stitch
  contract (CLAUDE-LESSONS.md) and it is satisfied by construction if
  `floorRing` is simply relocated to `y = 0` and reused.

Consequence to expect (not a defect): the bottom face stops being 2
triangles and becomes an earcut cap, so triangle counts for the new shapes
will not resemble the socket trays'. No frozen file is affected — the
socket coupons are produced by the untouched modules.

---

## 4. Corner Radius and the bottom rim — options, not a choice

### How Corner Radius interacts with pocket rims today

One owner-typed field, default 0, provably byte-identical at 0
(DECISIONS.md; `socketTrayGeometry.ts:78`, `:40-77`). At the **top rim** it
is a **concave** mitered quarter-arc fillet that widens the opening: ring
`k=0` sits at the top face with radius `pocket.radius + cornerRadius`, ring
`k=K` sits one `cornerRadius` below with the nominal radius, and the ordinary
straight wall continues from there (`:356-371`, mounted `:629-644`). Arc
endpoints are hand-written literals; only interior points come from
`filletTheta` (`:321-323`, mounted `:487-489`) — per the exact-stitch
lesson. The widened opening is what gets notched into the top face
(`pocketHoles`, `:374` / `:647`) and what the widened-footprint guards at
`:228-247` / `:520-540` re-check.

The **bottom rim does not exist today** — the pocket ends in a floor cap.
So for a through-hole the bottom rim's behaviour is genuinely undefined and
is an owner decision. What the existing code makes available:

**Option A — bottom rim stays sharp.** The bottom face is notched with the
**nominal** radius contour; the wall runs from `rings[K]` straight to the
bottom ring at `y = 0`. No new fillet code. The `cornerRadius >= pocket.depth`
guard collapses to the existing `cornerRadius >= thickness` (`:215-217`),
which is already written. *Existing precedent in the codebase:* both trays
already leave their **own** bottom edges sharp deliberately — the flat tray's
bottom face is a full uncut rectangle at any radius (`:453`), and the mounted
tray's corners A and B are explicitly excluded from rounding
(`mountedSocketTrayGeometry.ts:156-157`).

**Option B — bottom rim rounded, same technique mirrored in Y.** A second
ring family: `k=0` at `y = 0` with radius `pocket.radius + cornerRadius`,
`k=K` at `y = cornerRadius` with the nominal radius, using the same
`filletTheta` and the same hand-written endpoint literals; the bottom face is
then notched with the **widened** bottom ring. Cost: one more ring loop and
one more band loop per pocket in each module (a near-copy of `:498-510` /
`:869-881` with the Y sense flipped), plus **one guard change**:
`cornerRadius >= thickness` must tighten to `2 * cornerRadius >= thickness`,
because the top and bottom fillets each consume `cornerRadius` of straight
wall. The existing widened-footprint edge-clearance and pairwise-gap
re-checks (`:228-247` / `:520-540`) need **no** change — the widened radius
is the same value at both ends.

**Option C — a separate field for the bottom rim.** The existing code offers
no precedent: every rounding in both trays is driven by the single
owner-typed Corner Radius (DECISIONS.md, "a user-typed Corner Radius field,
not a fixed constant"). This would be the first second-radius field on these
shapes.

Facts bearing on the choice, stated neutrally and **not** as a
recommendation: on a flat tray printed tray-down, the bottom rim is the first
layer, where a concave fillet becomes an overhang; every physically validated
part in this repo has sharp bottom edges. On the mounted tray, the bottom face
is shared with the plate and its print orientation is itself undecided
(OPEN-ITEMS.md, "Mounted tray print orientation undecided").

---

## 5. The mounted variant — confirmed clear

**A through-hole in the shelf exits the bottom of the shelf cleanly and
cannot intersect the back plate, the slot channel, or the L-junction at any
hole position the guards allow.** This is a construction guarantee, not a
placement rule, and it holds for every plate thickness the module accepts.

**The chain, from source:**

- Pocket footprint in Z is bounded by the edge-clearance guard:
  `z + radius <= trayDepth - SOCKET_TRAY_POCKET_EDGE_CLEARANCE`
  (`mountedSocketTrayGeometry.ts:331`), i.e. **max pocket Z = `trayDepth - 5`**.
- The plate's front face is at `plateFrontZ = trayDepth`
  (`:592`; outline points D and E, `:601-602`). So a pocket is at least
  **5mm forward of the plate front plane** — it never reaches the plate, and
  the L-junction line at `(y = trayThickness, z = trayDepth)` is likewise
  5mm behind the nearest possible hole wall. The L-junction is a lengthwise
  edge at `y = trayThickness`; a through-hole descends from that same Y to
  `y = 0` but only within `z <= trayDepth - 5`, so it shares no point with it.
- The slot channel occupies `worldZ(depth) = blindFloorZ + depth` (`:611`)
  with `depth ∈ [0, 4.15]` — `MULTICONNECT_CHANNEL_OUTLINE`'s full depth range
  (`multiconnectSlotMesh.ts:39-48`) capped at `MULTICONNECT_SLOT_CUT_DEPTH`
  = 4.15 (`:30`). With `blindFloorZ = mountingFaceZ - 4.15` and
  `mountingFaceZ = trayDepth + plateThickness` (`mountedSocketTrayGeometry.ts:590-591`),
  the channel lives in **Z ∈ [trayDepth + plateThickness − 4.15, trayDepth + plateThickness]**.
- `plateThickness` is floored at `MULTICONNECT_BACK_THICKNESS` = 6.5
  (`:240-242`; `multiconnectContainerGeometry.ts:83`), so the channel's
  nearest point is at worst **`trayDepth + 2.35`**.
- Worst-case gap between the furthest-back allowed hole wall and the nearest
  channel surface: `(trayDepth + 2.35) − (trayDepth − 5)` = **7.35mm, in Z,
  independent of plate thickness, tray depth, tray thickness, hole diameter,
  slot count and slot spacing.** Extra plate thickness moves the channel
  *further* back (DECISIONS.md, "the mounted tray's slot channel is clear by
  construction"), never toward the hole.

**No condition exists under which it can intersect** while the module's own
guards are respected — the guards are all that stand between the two, and
they are the guards being carried over unchanged (§2).

**What the builder must still handle:** the bottom face `pushCap` at `:671`
will now carry **both** the slot-channel notches (contour indentations,
`:662-670`) and the pocket holes (earcut holes). Those are disjoint in Z by
the ≥7.35mm shown above, so `triangulateShape` sees a well-separated
contour-plus-holes problem. Also note the channel prism walls already run
down to `y = 0` and terminate on that same bottom cap (`:838-859`) — a second
family of features on one face, which is exactly why the slot-channel
raycast tests at `:321-344` and `:501-510` must be re-run, not merely
copied, on the new shape.

---

## 6. Full file set a build pass would touch

The socket trays used an **eight-file registration pattern** — the seven
shared files below plus the shape's own geometry module (`fe3e829` for the
flat tray, `c98cff5` for the mounted one, both commit messages say "the same
eight files"). For **two** new shapes:

**New geometry modules (2 new files):**
1. `apps/web/src/lib/screwdriverTrayGeometry.ts` — new
2. `apps/web/src/lib/mountedScrewdriverTrayGeometry.ts` — new

**The seven shared registration files (edited, once per shape):**
3. `apps/web/src/types/sketchforge.ts` — two new `ShapeKind` members
   (`:25-26` is the current list), two pocket-row types (cf. `:157`, `:165`),
   and the `WorkplaneShape` fields (cf. `:291-309`). **No `...PocketDepth`
   field for either new shape.**
4. `apps/web/src/lib/shapeCatalog.ts` — two catalog entries in
   `OPENGRID_CATEGORY` (cf. `:96`, `:102`), default hole lists (cf. `:134`,
   `:219`), `...OptionsForShape` mappers (cf. `:149-157`, `:234`),
   `create...GeometryForShape` with the bare-tray fallback (cf. `:164-176`,
   `:253`), `...LayoutError` message mapping minus the `/floor/` arm (cf.
   `:184-205`, `:275-295`), and the `makeShapeFromAsset` height/width/depth
   chains and field defaults (cf. `:457-465`, `:528-538`).
5. `apps/web/src/components/workplane/ShapeInspector.tsx` — two
   property-row blocks (cf. `:415-430`, `:432-454`) **without the Pocket
   Depth row**, and two pocket-card components (cf. `SocketTrayPocketCard`
   `:954-1043`, `MountedSocketTrayPocketCard` `:1052-`), plus the two render
   hooks at `:825-830`. *No change needed to `propertyUsesLengthUnit`
   (`:174`)* — every label the new shapes use is already in that list, and
   the one label being dropped (`Pocket Depth`) is still needed by the socket
   trays.
6. `apps/web/src/lib/workplaneShapes.ts` — two colour entries (cf. `:136-137`)
   and the shape-equality field comparisons (cf. `:245-256`).
7. `apps/web/src/lib/skfProject.ts` — two entries in the `SHAPE_KINDS`
   whitelist (`:30-34`).
8. `apps/web/src/components/WorkplaneViewport.tsx` — two `case` arms in the
   mesh builder (cf. `:7267-7277`), the new fields in
   `shapeGeometrySignature` (cf. `:971-981`), and the two kinds added to the
   parametric-shape list at `:7396`.
9. `apps/web/src/components/SketchForgeEditor.tsx` — two `case` arms in the
   export geometry builder (cf. `:2272-2281`) and the imports at `:97`.

**Tests (4 new files, following the socket trays' split):**
10. `tests/unit/screwdriverTrayGeometry.test.ts` — new
11. `tests/unit/screwdriverTrayShapeRegistration.test.ts` — new
12. `tests/unit/mountedScrewdriverTrayGeometry.test.ts` — new
13. `tests/unit/mountedScrewdriverTrayShapeRegistration.test.ts` — new

**Reference docs (updated at the end of each pass, as every prior pass did):**
14. `reference/SESSION-STATE.md`
15. `reference/DECISIONS.md`
16. `reference/OPEN-ITEMS.md`
17. `reference/reports/<pass>-build.md` — new per pass

**Optional, and only on owner instruction (see §8):**
18. `scripts/generate-screwdriver-tray-coupon.mjs` — new
19. `scripts/generate-mounted-screwdriver-tray-coupon.mjs` — new
20. `test-prints/*.stl` — **do-not-touch on this pass**; a build pass writing
    coupons needs explicit owner approval.

**Files that must NOT be touched by any of this:**
`apps/web/src/lib/socketTrayGeometry.ts`,
`apps/web/src/lib/mountedSocketTrayGeometry.ts`,
`apps/web/src/lib/multiconnectContainerGeometry.ts`,
`apps/web/src/lib/multiconnectSlotMesh.ts`, all four socket-tray test files,
`test-prints/*`, `deploy/docker/*`, `.github/workflows/*`, `package.json`,
`package-lock.json`.

**How the new modules get the shared constants without editing anything:**
`SOCKET_TRAY_POCKET_EDGE_CLEARANCE`, `SOCKET_TRAY_POCKET_GAP`,
`SOCKET_TRAY_POCKET_SEGMENTS`, `SOCKET_TRAY_FILLET_SEGMENTS` are already
exported from `socketTrayGeometry.ts` (`:83`, `:89`, `:101`, `:104`) and are
already imported read-only by `mountedSocketTrayGeometry.ts:19-25`. The
mounted screwdriver module additionally needs `MULTICONNECT_BACK_THICKNESS`,
`MULTICONNECT_SLOT_TOP_OFFSET`, the plate dimension/spacing bounds
(`multiconnectContainerGeometry.ts`) and the baked slot data
(`multiconnectSlotMesh.ts`) — the same import list at
`mountedSocketTrayGeometry.ts:2-18` — plus, if reused,
`MOUNTED_SOCKET_TRAY_SLOT_EDGE_CLEARANCE` (`:183`) and
`mountedSocketTraySlotCenters` (`:275`), both already exported.

**One known cost:** `buildTerminatorData` — the baked-terminator split — is
local and unexported in `multiconnectContainerGeometry.ts`, and
`mountedSocketTrayGeometry.ts:365-415` already restates it for exactly that
reason (`:348-353`). The mounted screwdriver module will restate it a third
time, or import it if the owner permits adding an export to
`mountedSocketTrayGeometry.ts` (which would be an edit to a frozen file —
so: restate it).

---

## 7. Batching plan

**Are the two shapes independent?** At the code level, **yes.** Everything
the mounted screwdriver module needs is already exported from files that
predate both new shapes — `socketTrayGeometry.ts` for the pocket-guard
constants, `multiconnectSlotMesh.ts` / `multiconnectContainerGeometry.ts`
for the plate and slot. It would have **no import from the flat screwdriver
module**, exactly as `mountedSocketTrayGeometry.ts:19-25` imports from
`socketTrayGeometry.ts` and not the reverse. Neither shape blocks the other.

They are **coupled only in the seven shared registration files** (§6, items
3–9), which both must edit. Doing them in two passes means touching those
seven files twice — sequential, not conflicting.

**Recommended split — two build passes, each one commit under the agreed
gate, matching the repo's own precedent (one shape per commit: `fe3e829`,
`c98cff5`):**

- **Pass A — flat Screwdriver Tray.** New module + unit tests + all seven
  registration files + registration tests, in **one sweep**. This is the
  simpler of the two by a wide margin: a through-hole in a plain rectangular
  slab, with the bottom face going from a 2-triangle rectangle to an earcut
  cap and one floor cap deleted. Every raycast inversion is mechanical.
- **Pass B — mounted Screwdriver Tray.** New module + unit tests + the same
  seven registration files + registration tests, in **one sweep**, but as its
  **own standalone pass**. Reasons it stands alone rather than riding along
  with A: (i) its bottom face must carry pocket holes *and* slot-channel
  notches on one earcut cap (§5), the only genuinely new geometry problem in
  this work; (ii) the slot-channel raycasts (`:321-344`, `:501-510`) and the
  exact-directed-edge check must be re-run against a much larger mesh, and a
  failure there should not hold up the simple shape; (iii) it restates
  `buildTerminatorData` (§6), which is bulk that deserves its own review.

**What must stand alone regardless:** any coupon STL, generator script, or
print gate. `test-prints/` is print-gated per CLAUDE.md and already holds two
**unprinted** socket coupons (SESSION-STATE.md, "Physical gate — both coupons
are unprinted"). Adding two more unprinted coupons is an owner call, not a
builder call.

---

## 8. REAL BLOCKERS — owner decisions needed before a build prompt can be written

Only genuine blockers are listed. No suggestions, no improvements.

1. **Corner Radius on the bottom rim: sharp, rounded, or a separate field?**
   (§4, options A / B / C.) The module cannot be written without it — the
   answer determines the pocket ring construction, what contour the bottom
   face is notched with, and whether the straight-wall guard is
   `cornerRadius < thickness` or `2 * cornerRadius < thickness`. Reporting
   the options was this pass's scope; picking one is the owner's.

2. **What replaces `MIN_SOCKET_TRAY_FLOOR_THICKNESS` as the minimum tray
   thickness?** It is the current inspector minimum for both trays'
   thickness rows (`ShapeInspector.tsx:426`, `:450`) and it is a *floor*
   constant — meaningless on a floorless tray. A screwdriver tray still needs
   some minimum bore length to hold a shaft upright, and no existing constant
   in this repo answers that question. The build cannot invent a physical
   minimum; DECISIONS.md's precedent is that these numbers are the owner's
   ("pocket diameters are typed by the owner as the finished hole size").

3. **Default hole diameters and default tray dimensions for each new
   shape's default insert.** Both socket trays' registrations required a
   default insert (`DEFAULT_SOCKET_TRAY_SHAPE_POCKETS`,
   `shapeCatalog.ts:134`; `DEFAULT_MOUNTED_SOCKET_TRAY_SHAPE_POCKETS`,
   `:219`), and the shape-registration tests assert those exact values
   (`socketTrayShapeRegistration.test.ts:129`,
   `mountedSocketTrayShapeRegistration.test.ts:115`). The socket defaults are
   caliper-measured socket ODs + 2mm clearance and would be nonsense for
   screwdriver shafts. Per DECISIONS.md the owner types the finished hole
   size; the builder cannot guess screwdriver shaft diameters, hole count,
   pitch, tray width/depth or thickness.

---

## Open questions (not blockers)

- **Shape names, catalog ids, kinds and colours.** Defaults would be
  "Screwdriver Tray" / `screwdriver-tray` / `screwdriverTray` and "Mounted
  Screwdriver Tray" / `mounted-screwdriver-tray` / `mountedScrewdriverTray`,
  with two unused colours, in `OPENGRID_CATEGORY` alongside the socket trays
  (`shapeCatalog.ts:96`, `:102`). Icon would be the same `box.png` stand-in
  every OpenGrid shape uses.
- **Coupon / generator scripts and the print gate.** Whether a build pass
  writes coupon STLs into `test-prints/` at all, given two socket coupons are
  already queued unprinted. `test-prints/*` was do-not-touch on this pass.
- **Add-hole default placement** inherits the existing `last.x + 36` quirk
  (`ShapeInspector.tsx:973-976`), already logged in OPEN-ITEMS.md.
- **Mounted print orientation** is undecided for the socket variant
  (OPEN-ITEMS.md) and the screwdriver variant inherits that question, with
  the added wrinkle that its holes are open at both ends.
- **`shapeCatalog.ts` size.** It is already 547 lines carrying five
  primitives; two more shapes add roughly another 120. No decision needed,
  noted for the builder's expectations.
- OPEN-ITEMS.md already carries "**Future preset families** — screwdrivers,
  pliers; not started." This work is that item's screwdriver half.

---

## SCOPE CHECK

Zero files modified other than this report. No code changed, no new source
or test files created, nothing under `apps/`, `tests/`, `scripts/`,
`test-prints/`, `deploy/`, `.github/`, `package.json` or `package-lock.json`
touched. `socketTrayGeometry.ts` and `mountedSocketTrayGeometry.ts` were read
only. Verified by `git status` before commit.
