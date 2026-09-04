# Docs refresh — socket tray sampler (2026-09-04)

Docs-only pass bringing the four `reference/` session docs current with the
socket-tray work through `cc4f3ff`. No code, test, config, STL, or Docker
change. Facts below come from git history, the test run in step 1, and
`reference/socket-tray-recon.md` / `reference/socket-tray-sampler-report.md`.

## Step 1 — ground truth (read-only)

```
$ git status
On branch main
Your branch is ahead of 'origin/main' by 5 commits.
  (use "git push" to publish your local commits)

nothing to commit, working tree clean

$ git log --oneline 998b03a~1..HEAD
cc4f3ff Replace unconfirmed sockets-per-pocket guess with real measured mapping
107af0b Expand Socket Tray sampler to 6 real-measured diameters, 36mm pitch
75d79d8 Shift Socket Tray sampler diameters to 10/14/18/22/27mm
a32a314 Reduce Socket Tray sampler pocket depth to 14mm (18mm total thickness)
88c37a1 Add Socket Tray primitive and unvalidated sampler coupon
998b03a Update reference docs — new dev box on /Apps

$ git log --oneline -3 -- reference/
cc4f3ff Replace unconfirmed sockets-per-pocket guess with real measured mapping
107af0b Expand Socket Tray sampler to 6 real-measured diameters, 36mm pitch
75d79d8 Shift Socket Tray sampler diameters to 10/14/18/22/27mm

$ git rev-parse HEAD origin/main        (before this pass)
cc4f3ff301d0cdba8d082e862ae54f06b82fc0ee
998b03a4cbd01c0b5a5f9792aba4ce59cffb43f4

$ git fetch origin && git rev-parse origin/main
998b03a4cbd01c0b5a5f9792aba4ce59cffb43f4      (remote had not moved)

$ npm test
> sketchforge@1.0.4 test
> vitest run --config tests/vitest.config.ts
 RUN  v4.1.8 /Apps/marlin-cad
 Test Files  46 passed (46)
      Tests  319 passed (319)
   Start at  08:26:38
   Duration  2.28s

$ npx vitest run --config tests/vitest.config.ts tests/unit/socketTrayGeometry.test.ts
 Test Files  1 passed (1)
      Tests  17 passed (17)

$ ls -l test-prints/socket-tray-sampler.stl ; grep -c 'facet normal' test-prints/socket-tray-sampler.stl
-rw-rw-r-- 1 marlinai marlinai 350661 Aug 30 18:09 test-prints/socket-tray-sampler.stl
1548
```

Finding at step 1: the working tree was clean, so editing proceeded, but
local `main` was 5 commits ahead of `origin/main`. The five socket commits
(`88c37a1`..`cc4f3ff`, all dated 2026-08-30) had never been pushed; the
sampler report itself says "committed locally only (no push yet, per the GIT
gate in the brief)". Step 6's push therefore carries those five commits to
the remote along with the doc commit. There is no way to push the doc
commit alone, since it sits on top of them. The brief's wording for
OPEN-ITEMS ("sampler coupon pushed") was taken as confirmation that this is
intended.

Per-commit file lists (`git log --stat 998b03a..HEAD`): `88c37a1` created
`socketTrayGeometry.ts`, its test file, the generator script, the coupon
STL, the recon and sampler-report docs, and appended to
`test-prints/README.md`; `a32a314` changed one line in
`socketTrayGeometry.ts` (default thickness 24 → 18) plus script/test/STL/
docs; `75d79d8` and `107af0b` touched script/test/STL/README/report only;
`cc4f3ff` touched the sampler report only. `multiconnectContainerGeometry.ts`
appears in none of them.

## Steps 2–5 — diff summary per file

```
$ git diff --stat        (before the report file was added)
 reference/DECISIONS.md     |  6 ++++++
 reference/OPEN-ITEMS.md    |  3 ++-
 reference/SESSION-STATE.md | 44 +++++++++++++++++++++++++++++++++++++++++++-
 3 files changed, 51 insertions(+), 2 deletions(-)
```

### reference/SESSION-STATE.md (step 2)

- New section "Socket Tray — active feature, sampler stage (physical gate
  pending)", placed after the Multiconnect section: module path, test path
  and count (17), generator script and its run command, coupon STL path and
  dimensions (240 × 60 × 18mm, ASCII, 1,548 triangles), pocket depth/floor/
  pitch/margins, the six diameters (14, 15, 19, 20.70, 23, 25mm), the
  confirmed sockets-per-pocket mapping, bed-fit numbers, no-back-plate
  status, unprinted status, and the physical gate in bold: print the
  6-pocket coupon on the X1C and test all 12 sockets before any production
  tray is built.
- "Recent shipped work" gained the five socket commits with SHAs.
- "Print status" gained one line: the socket coupon is not yet printed and
  is the gate for the socket work.
- "Test suite" changed from 227 to 319 across 46 files (with the date and
  command), noting 17 of them are the socket module's.
- Everything else left as-is.

### reference/OPEN-ITEMS.md (step 3)

- The single line "Future preset families — sockets, screwdrivers, pliers;
  not started" was replaced by two lines: (a) Sockets — sampler coupon
  pushed, physical gate pending (print on X1C, test all 12 sockets);
  production tray layout (12 pockets in 240mm) undecided, owner picks after
  the coupon passes; (b) Future preset families — screwdrivers, pliers; not
  started.
- Every other line untouched.

### reference/DECISIONS.md (step 4)

Six socket decisions appended at the end, each with its reason:

1. Flat tray with round blind pockets the sockets sit in, not posts; solid
   floor. Reason from the sampler report: round blind pocket is a strict
   simplification of the keyhole slot, seam bit-identical by construction,
   4mm floor above the 2mm minimum per the slicer-slit-fusion lesson.
2. Back plate is the existing OpenGrid Snap primitive; not yet built; coupon
   is tray-only. Reason from the recon: no runtime attach function exists,
   Snap/slot are independently baked meshes sharing a SCAD profile.
3. Standard-length sockets only; depth 14mm; diameter = measured OD + 2mm.
   Reason from the sampler report: 3/8"-drive standard (non-deep) height
   estimate; diameters are caliper-measured ODs plus stated clearance, so
   the coupon tests both.
4. Production tray has one pocket per socket (12), even where widths
   repeat. Contrasted with the coupon's 2/3/3/1/1/2 grouping.
5. Tray width matches the wrench racks; coupon targets the X1C bed only.
   Reason from the sampler report's bed-fit section (285mm at 45mm pitch,
   owner approved 36mm, 16mm spare under 256mm).
6. Additive-only in `socketTrayGeometry.ts`; zero edits to
   `multiconnectContainerGeometry.ts`. Reason from the recon §3/§4;
   confirmed against the per-commit file lists above.

### reference/KNOWN-FIXES.md (step 5)

Untouched. Reviewed against CLAUDE-LESSONS.md (latest entry 2026-08-24,
nothing from the socket cycle) and both socket docs. The socket docs record
no symptom → fix pair: the only "caught" item is the 285mm bed-overflow,
which was found by arithmetic before any file was generated and resolved by
an owner layout decision, not a fix. Nothing qualified.

## Step 6 — commit and push

```
$ git commit ...
26d127b Bring reference/ session docs current with the socket tray sampler

$ git push origin main
To github.com:marlin1111ai/marlin-cad.git
   998b03a..26d127b  main -> main

$ git fetch origin
$ git rev-parse HEAD origin/main
26d127b203254f07eb3936e80c2a4866b73c638d
26d127b203254f07eb3936e80c2a4866b73c638d

$ git status -sb | head -1
## main...origin/main
```

HEAD and origin/main match at `26d127b`. The push moved the remote from
`998b03a` to `26d127b`, carrying the five socket commits plus the doc
commit. This verification block was added to the report in a follow-up
docs-only commit on top of `26d127b`, since a report cannot contain its own
commit's push result.

## Open questions

- The five socket commits were unpushed at the start of this pass and go to
  `origin/main` with this doc commit. If the earlier "no push yet" GIT gate
  was meant to still hold, that gate and this brief's step 6 conflict; this
  pass followed step 6.
- Two phrases in the DECISIONS entries come from this brief's wording rather
  than either socket doc: "not posts" (decision 1) and "even where widths
  repeat" (decision 4). The socket docs say "blind pockets" and "a future
  12-pocket production tray" but do not state those two clauses; they are
  recorded here as the owner's decisions per the brief.
- Decision 5's first clause ("tray width matches the wrench racks") is
  stated as the production-tray rule per the brief. The sampler report says
  that for the coupon specifically, 240mm is now the result of the bed-fit
  arithmetic rather than a wrench-rack constraint; the entry says both.

## SCOPE CHECK — every file touched, mapped to the step that required it

| File | Action | Step |
|---|---|---|
| `reference/SESSION-STATE.md` | edited (socket section, shipped-work list, print status, test count) | 2 |
| `reference/OPEN-ITEMS.md` | edited (one line replaced by two) | 3 |
| `reference/DECISIONS.md` | edited (six entries appended) | 4 |
| `reference/KNOWN-FIXES.md` | reviewed, **not edited** | 5 |
| `reference/reports/docs-refresh-socket-sampler.md` | created (the one permitted new file; `reference/reports/` created for it) | deliverable |
| `reference/socket-tray-recon.md`, `reference/socket-tray-sampler-report.md` | read only | do-not-touch |
| `apps/web/src/lib/socketTrayGeometry.ts` | read only (`grep '^export'` for names) | do-not-touch |
| `apps/web/src/lib/multiconnectContainerGeometry.ts` | not opened | do-not-touch |
| `test-prints/socket-tray-sampler.stl` | read only (`ls -l`, `grep -c`) | do-not-touch |
| `test-prints/*` (all other), `deploy/docker/*`, `.github/workflows/*`, `package*.json`, configs, `reference/*.scad`, `reference/10x10_Grid.stl` | not touched, not opened | do-not-touch |

Credential scan: the edited docs and this report were grepped for
`ghp_`, `ghs_`, `token`, `secret`, `password`; the only hit is the
pre-existing OPEN-ITEMS line about rotating the GHCR token, which names no
token value.
