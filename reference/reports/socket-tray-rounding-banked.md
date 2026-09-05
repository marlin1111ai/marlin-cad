# Socket Tray edge rounding — banked

Pushes the owner-approved Corner Radius commit (`4be03de`) and brings
`reference/` docs current with it. Push + docs only — no code, test,
config, or STL changes. Facts below come from
`reference/reports/socket-tray-rounding-recon.md`,
`reference/reports/socket-tray-rounding-build.md`, and git history only.

## Step 1 — clean tree, HEAD == 4be03de

```
$ git status
On branch main
Your branch is ahead of 'origin/main' by 1 commit.
  (use "git push" to publish your local commits)

nothing to commit, working tree clean
$ git log --oneline -1
4be03de Add owner-typed Corner Radius fillet to both Socket Trays
```

## Step 2 — push `4be03de`, verify

```
$ git push origin main
To github.com:marlin1111ai/marlin-cad.git
   ea0464a..4be03de  main -> main

$ git fetch origin
$ git rev-parse HEAD
4be03de8927bda99ad8567699f0d76bbe4305de6
$ git rev-parse origin/main
4be03de8927bda99ad8567699f0d76bbe4305de6
```

Both SHAs match. No STOP condition.

## Step 3 — docs updated

Every fact below is sourced from the build report (test totals, demo
filenames, demo radius value, the L-junction exclusion, the triangle-order
bug) or the recon report (technique description), never estimated.

### `reference/SESSION-STATE.md`

- Socket Tray section: registration-test count corrected 7 → 8 (per the
  build report's step 6: "17 → 36" for the geometry test file and the
  registration test file gaining one new test). Added a new bullet stating
  the Corner Radius field (default 0, byte-identical to prior output,
  verified against `test-prints/socket-tray-sampler.stl`), the mitered
  quarter-arc technique matching the Multiconnect peg fillet, and the new
  `test-prints/socket-tray-sampler-rounded-demo.stl` demo file (new file,
  not a replacement).
- Mounted Socket Tray section: added the equivalent bullet, explicitly
  stating the plate-to-tray L-junction is deliberately excluded and stays
  sharp, that radius 0 is byte-identical to
  `test-prints/mounted-socket-tray-coupon.stl`, that this check caught the
  triangle-order bug (cross-referenced to KNOWN-FIXES.md), and the new
  `test-prints/mounted-socket-tray-coupon-rounded-demo.stl` demo file.
- "Physical gate" section: added that both coupon files stay frozen at
  Corner Radius 0, and that any future production/demo print at a chosen
  radius is a NEW coupon, never a comparison against the frozen files
  (verbatim from the brief's instruction, itself drawn from the build
  report's own framing).
- "Recent shipped work": added `4be03de` as the newest entry, one line
  summarizing the feature, the technique, the radius-0 guarantee, the
  L-junction exclusion, and the two new demo files.
- "Test suite" section: 378 → 415 total tests; per-file counts updated to
  36 / 8 / 56 / 13 (from 17 / 7 / 40 / 12) — all four numbers taken directly
  from the build report's step 6 and step 10 ("17 → 36", "40 → 56", and the
  registration files each gaining exactly one test per step 8's table).

### `reference/OPEN-ITEMS.md`

Two new lines added; every other line left exactly as-is, per the brief.

- **"Corner Radius chosen value"** — states the two demo STLs use a 3mm
  Corner Radius (the build report's step 9 value, chosen for validation
  headroom, not for print-worthiness) and that no radius has been
  print-validated; owner picks a working radius after printing.
- **"Corner Radius visual confirmation"** — records that the build report
  could not visually verify the rounding in the viewport (no browser tool in
  that build session), and that the owner has since confirmed it visually.
  Written as resolved, per the brief's explicit instruction, not as a
  still-open item.

### `reference/DECISIONS.md`

Three new decisions appended, each tagged `4be03de`:

1. Corner Radius is a user-typed field, not a fixed constant; 0 is default
   and provably identical to pre-rounding output. Reason given: matches the
   existing pocket-diameter pattern and preserves the byte-identical
   regression path at radius 0.
2. The rounding technique is a mitered quarter-arc matching the Multiconnect
   peg fillet, not a fully blended 3D fillet and not the app's separate
   runtime OCCT fillet tool. Reason given: keeps the shape boundary-rep and
   testable the same way as every other socket-tray feature.
3. The Mounted Socket Tray's plate-to-tray L-junction is excluded from
   rounding. Reason given: owner's decision; that seam is structurally
   different from a simple edge.

### `reference/KNOWN-FIXES.md`

One new entry added — checked against the existing list first and confirmed
this symptom isn't already covered (the closest existing entries are about
vertex-level ULP mismatches and sealed pockets, not triangle **emission
order**). New entry: an in-suite `toEqual`/manifold/exact-directed-edge pass
does not prove a "should match the old output" code path actually reproduces
a frozen, already-committed reference file byte-for-byte — regenerate the
frozen file and diff it. Cites the specific bug from the build report step 5
(the two `pushCap` calls moved after the branch, reordering triangles with
identical topology) and points at
`reference/reports/socket-tray-rounding-build.md` step 5 for detail. No
CLAUDE-LESSONS.md heading exists for this yet and CLAUDE-LESSONS.md is
outside this pass's editable file set, so the entry cites the build report
directly instead, matching the handful of existing KNOWN-FIXES.md entries
that don't cite a CLAUDE-LESSONS.md heading either (e.g. the `git push`,
Unraid pull, and Docker-build entries).

## Per-file diff summary

```
$ git diff --stat reference/SESSION-STATE.md reference/OPEN-ITEMS.md reference/DECISIONS.md reference/KNOWN-FIXES.md
 reference/DECISIONS.md     |  3 +++
 reference/KNOWN-FIXES.md   |  1 +
 reference/OPEN-ITEMS.md    |  2 ++
 reference/SESSION-STATE.md | 49 ++++++++++++++++++++++++++++++++++++++++------
 4 files changed, 49 insertions(+), 6 deletions(-)
```

All four changes are additive (insertions plus small count corrections in
SESSION-STATE.md's test-suite section); no existing prose was rewritten or
removed beyond the two count updates (7→8 registration tests in the Socket
Tray section, and the "Test suite" totals block).

## Open questions

None generated by this pass — it is a push-and-docs-transcription task with
no design decisions of its own. The three open questions the build report
itself raised (mitered-vs-fully-rounded corners, the demo radius not being
print-validated, and — now resolved per this task's own instruction — the
lack of in-session visual confirmation) are carried into OPEN-ITEMS.md
above, not re-litigated here.

## Credential scan

Every command output pasted in this report, and the diffs to all four docs,
were scanned for `ghp_`, `ghs_`, `token`, `secret`, `password`: no hits.

## SCOPE CHECK

```
$ git status --short          (before this commit)
 M reference/DECISIONS.md
 M reference/KNOWN-FIXES.md
 M reference/OPEN-ITEMS.md
 M reference/SESSION-STATE.md
?? reference/reports/socket-tray-rounding-banked.md
```

Only the four named docs and this new report were touched. Confirmed
untouched: `apps/web/src/lib/multiconnectContainerGeometry.ts`, every file
under `test-prints/`, `deploy/docker/`, `.github/workflows/`,
`package.json`, `package-lock.json`, every other config file, and every app
source file (this pass is push + docs only, per the brief).

## Closing summary (plain English)

Both commits are now on `origin/main`:
- `4be03de` (the Corner Radius feature itself) — pushed this pass, SHA
  `4be03de8927bda99ad8567699f0d76bbe4305de6`, confirmed matching on both
  `HEAD` and `origin/main`.
- The docs commit that includes this report — committed and pushed
  immediately after this file was written; its SHA is reported in the
  session's final summary alongside this one, both confirmed matching
  `HEAD` and `origin/main` via `git fetch` + `git rev-parse`.

**What changed in each doc:**
- `SESSION-STATE.md`: both tray sections now describe the Corner Radius
  field, its radius-0 guarantee, the L-junction exclusion, and the two new
  demo STL filenames; the physical-gate note now says a future rounded
  print is a new coupon, not a comparison to the frozen files; the shipped-
  work list and test-suite totals (415, with per-file counts) are current.
- `OPEN-ITEMS.md`: two new lines — the demo radius (3mm, demonstration
  only, not print-validated) and the visual-confirmation item, recorded as
  resolved now that the owner has confirmed it. Every other line
  untouched.
- `DECISIONS.md`: three new decisions — Corner Radius is user-typed with a
  provably-identical zero default, the technique is the mitered quarter-arc
  (not a full 3D fillet, not the runtime OCCT tool), and the L-junction is
  excluded by owner's decision.
- `KNOWN-FIXES.md`: one new entry, recording that an in-suite pass isn't
  proof of byte-fidelity to a frozen file — the actual bug this build hit.

**The three things I am least certain about:** (1) whether the SESSION-STATE
test-suite date (`2026-09-04`, left unchanged since that's what the file
already carried and this pass doesn't touch dates outside what's cited) is
still accurate for when this docs pass itself runs, since I was told to work
from the two reports and git history only, not to re-derive today's date;
(2) whether "Recent shipped work" is meant to be read strictly newest-first
and I placed the new entry correctly at the top consistent with that
ordering — the list's own ordering convention isn't stated anywhere, only
inferred from the dates already in it; (3) whether the KNOWN-FIXES.md entry
I added is specific enough to be useful without also adding a matching
CLAUDE-LESSONS.md heading — that file is outside this pass's editable set,
so the entry point at the build report itself instead of a lessons-file
heading, unlike most of KNOWN-FIXES.md's other geometry-related entries.
