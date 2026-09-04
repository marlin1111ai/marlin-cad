# Mounted Socket Tray — banked (push + docs refresh)

Pushes the owner-tested Mounted Socket Tray commit (`c98cff5`) and brings the
four reference/ session docs current with it. Push + docs only: no code, test,
config, STL, or Docker change. Facts come from
`reference/reports/socket-tray-mounted-recon.md`,
`reference/reports/mounted-socket-tray-build.md`, and git history only.

## Step 1 — clean tree, HEAD is c98cff5

```
$ git status
On branch main
Your branch is ahead of 'origin/main' by 1 commit.
  (use "git push" to publish your local commits)

nothing to commit, working tree clean
$ git log --oneline -1
c98cff5 Add the Mounted Socket Tray: slotted Multiconnect plate + forward tray, one solid
```

## Step 2 — push c98cff5, verify against origin

```
$ git push origin main
To github.com:marlin1111ai/marlin-cad.git
   4eecc37..c98cff5  main -> main
push exit=0
$ git fetch origin
$ git rev-parse HEAD origin/main
c98cff525dd0265b097d1f8c4b9ea2fabd0f8415
c98cff525dd0265b097d1f8c4b9ea2fabd0f8415
```

Both SHAs read `c98cff5`. No STOP.

## Step 3 — per-file diff summary

```
$ git diff --numstat
4	1	reference/DECISIONS.md
1	0	reference/KNOWN-FIXES.md
5	0	reference/OPEN-ITEMS.md
75	5	reference/SESSION-STATE.md
```

### `reference/SESSION-STATE.md` (+75 / −5)

**New section "Mounted Socket Tray — active feature, coupon stage (physical
gate pending)"**, placed after the flat tray's section. It records: the module
path `apps/web/src/lib/mountedSocketTrayGeometry.ts`; that it is ONE
boundary-rep solid with no CSG, no boolean and no concatenated meshes; that
the plate and tray are a single L-profile prism whose outline is built once
as one six-point array read by both the side faces and the end caps, so there
is no seam to stitch; that slot features come from the same baked source the
wrench racks use; the wrench-rack plate defaults (240 × 60 × 10mm, 28mm
spacing, 8 slots at x = 22 … 218); the coupon
`test-prints/mounted-socket-tray-coupon.stl` at **240 × 70 × 60mm** with 3,524
triangles and three pockets at **14, 19, 25mm**; the generator script; the 40
+ 12 tests; the exported-STL raycast result; the editor registration with its
eight inspector rows and the axis mapping; and that it is owner-tested but
**unprinted**. Source: build report steps 4, 6, 7, 8, 9.

**New section "Physical gate — both coupons are unprinted"**, stating that
neither `socket-tray-sampler.stl` nor `mounted-socket-tray-coupon.stl` has
been printed and no production tray is built until both are.

**Flat tray section, one line amended.** The line reading "No back plate yet:
the coupon is a standalone block. The OpenGrid Snap back-plate mount for the
tray is not built" was made wrong by HEAD on both halves — a back plate now
exists, and it is Multiconnect rather than the Snap. Rewritten to record that
THIS coupon is deliberately a standalone block, with a pointer to the new
section and to the corrected DECISIONS entry. Nothing else in that section
changed; the flat coupon's own numbers, tests, registration and gate line are
untouched.

**Shipped-work list**, two lines added at the top: `c98cff5` (the mounted tray
module, 52 tests, generator, coupon and registration) and `4eecc37` (the
read-only recon that established the wrench racks hang on Multiconnect slots
rather than the OpenGrid Snap).

**Test suite** updated from `326 … across 47 files` to **`378 … across 49
files`**, broken down as 17 + 7 + 40 + 12. Re-verified against the build
report's own run rather than inherited:

```
reference/reports/mounted-socket-tray-build.md:401: Test Files  49 passed (49)
reference/reports/mounted-socket-tray-build.md:402:      Tests  378 passed (378)
```

**Print status**, one line added for the mounted coupon alongside the flat one.

### `reference/OPEN-ITEMS.md` (+5 / −0)

Five lines added, all from the build report's open questions:

- Mounted coupon unprinted; physical gate pending alongside the flat sampler.
- Print orientation undecided — tray-down gives clean vertical pockets but a
  tall thin plate; plate-down supports the plate but makes each pocket a
  sideways bore with an unsupported upper half, 25mm across at the largest.
  Recorded as geometry only; no slicer consulted, and no recommendation made.
- Junction has no fillet or gusset; follows the Shelf precedent but carries a
  forward cantilevered load that the Shelf's validation never covered.
- Pocket depth 14mm is inherited from the unprinted flat coupon and unproven.
- `test-prints/README.md` has no entry for the new coupon because that
  directory was do-not-touch on the build pass.

### `reference/DECISIONS.md` (+4 / −1)

**The superseded back-plate entry was corrected.** It previously read:

> The Socket Tray back plate is the existing OpenGrid Snap primitive.

It now opens `**CORRECTED 2026-09-04 — the mounted tray's back is a
Multiconnect slotted plate with no pegs, NOT the OpenGrid Snap.**`, quotes the
old wording so the change is auditable, and records why it was wrong: the
recon (`4eecc37`) established that the validated wrench racks hang on
Multiconnect keyhole slots at 28mm spacing, while the Snap this app bakes
carries an openConnect head — a different profile with different clearances —
and no multiConnect-head variant is baked here. It then records the owner's
decision: the mounted tray's back is the same Multiconnect slotted plate the
wrench racks use, carrying no pegs. The still-true parts of the original entry
are kept: the flat sampler coupon is deliberately tray-only, and the Snap has
no runtime attach function.

Three entries added, each with its reason:

1. **The mounted tray is one L-profile prism, not a plate joined to a tray.**
   Reason: the outline is built once and both faces and end caps read the same
   points, so junction vertices are the same doubles and there is no seam to
   stitch; the recon had named that junction the primary ULP risk and this
   designs it out. Cites the build report step 4.
2. **The mounted tray's slot channel is clear by construction.** Reason: the
   channel occupies only the rear 4.15mm measured from the mounting face and
   thickening the plate moves the blind floor further back, guaranteed by the
   6.5mm minimum plate thickness (4.15 cut + 2.35 skin). Cites step 2.
3. **The mounted tray is a separate shape and module; the flat Socket Tray is
   unchanged and remains the test piece.** Reason: owner's requirement; the
   new module imports from both protected modules but edits neither.

### `reference/KNOWN-FIXES.md` (+1 / −0) — one pair added

The build report does record a symptom → fix pair not already present, so this
file was **not** left untouched. Added:

> **A raycast test fails at exactly one sample coordinate, and that coordinate
> is a face plane** → the ray is grazing that face's own boundary edge, which
> reports an extra crossing and breaks parity counting; the geometry either
> side of the plane is correct. Bracket the plane rather than sitting on it,
> and do not loosen the assertion.

Checked against the existing entries first: the file's one existing raycast
line is about a cavity that is sealed shut despite passing watertightness
checks, which is a different symptom with a different fix. Source: build
report step 5, which records the failing probe at `y = 18` and the three-vs-two
crossing counts either side of it.

No other pair in the build report was new. Its remaining findings are either
already covered (boundary-rep over CSG, the exact-stitch contract, the
sealed-pocket raycast, the EPS tolerance rule) or are open questions rather
than fixes.

## Step 4 — docs commit and push

The docs commit's SHA and its `git rev-parse HEAD origin/main` output are
recorded in the session's closing summary, since this report is part of that
commit and cannot contain its own SHA.

## Open questions

1. **The flat tray section's amended line was a judgment call.** The brief
   listed SESSION-STATE changes as additive, but that one line asserted both
   that no back plate existed and that the Snap was the plan, and HEAD makes
   both false. It was rewritten rather than left standing. Everything else in
   that section is untouched.
2. **`KNOWN-FIXES.md` was edited**, on the brief's own condition that a new
   symptom → fix pair exists. Judging the grazing-ray diagnosis to be new
   rather than a variant of the existing raycast entry is my call; the two are
   listed adjacently so a reader can compare them.
3. **The corrected DECISIONS entry quotes and replaces the old wording rather
   than appending a dated correction below it.** `CLAUDE-LESSONS.md` mandates
   append-only corrections, but that rule is written for that file; DECISIONS
   states no such rule and the brief said to rewrite the entry. The superseded
   sentence is preserved inside the new entry either way.

## Credential scan

The diff of the four edited docs was grepped for `ghp_`, `ghs_`, `token`,
`secret`, `password`: no hits. All pasted git output shows only SHAs, refs and
file paths.

## SCOPE CHECK — every file touched, mapped to the step that required it

| File | Action | Step |
|---|---|---|
| `reference/SESSION-STATE.md` | edited | 3 |
| `reference/OPEN-ITEMS.md` | edited | 3 |
| `reference/DECISIONS.md` | edited (one entry corrected, three added) | 3 |
| `reference/KNOWN-FIXES.md` | edited (one new symptom → fix pair) | 3 |
| `reference/reports/mounted-socket-tray-banked.md` | created (this report) | deliverable |
| `reference/reports/socket-tray-mounted-recon.md`, `reference/reports/mounted-socket-tray-build.md` | read only | source of facts |
| `CLAUDE.md`, `CLAUDE-LESSONS.md` | read only | orientation |
| `apps/web/src/lib/mountedSocketTrayGeometry.ts`, `apps/web/src/lib/socketTrayGeometry.ts`, `apps/web/src/lib/multiconnectContainerGeometry.ts` | not touched | do-not-touch |
| `test-prints/*`, `deploy/docker/*`, `.github/workflows/*`, `package*.json`, config files, every other app source file | not touched | do-not-touch |

No code, test, config, STL, or Docker change. No new dependencies. No
proposals or future-work suggestions were added to any doc; the print
orientation and fillet questions are recorded as open and left unresolved.
