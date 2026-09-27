# marlin-cad — cold-start brief, 2026-09-26

Standalone. Assumes no chat history. Everything here is also in the
notebook (`reference/SESSION-STATE.md`, `OPEN-ITEMS.md`, `DECISIONS.md`,
`KNOWN-FIXES.md`, and `CLAUDE-LESSONS.md` at the repo root). This brief is
the map; the notebook is the authority. Where they ever disagree, the
notebook wins and this brief is stale.

---

## 1. Repo and HEAD at handoff

- Repo: `/Apps/marlin-cad` on the Linux dev box (`/Apps` is its own drive,
  not the home folder). Remote is SSH:
  `git@github.com:marlin1111ai/marlin-cad.git`, branch `main`. It is a fork
  of `Formsmith746/SketchForge-3D`.
- **HEAD at handoff is the commit that adds this brief** (subject "Record
  owner answers, delete stale build output, add the cold-start brief"),
  whose parent is `9b0cef7`. `git log -1` shows the exact SHA; local `main`
  and `origin/main` were equal when it was pushed.
- Recent history, newest first: this handoff commit; `9b0cef7` notebook
  brought current; `ea3c88f` Gridfinity labeled tray recon; `b0db792`
  projects-storage recon; `9e926bf` thumbnail guard reads the Host header
  (`1.3.3`); `6ae02f7` private-LAN thumbnail hosts (`1.3.2`, never
  deployed); `b4541de` snapshot recon; `6072323` / `2c35f4c` / `80df302` /
  `7b86e6d` the `1.3.1` release and the two Screwdriver Trays.
- The app is SketchForge: a browser-based parametric CAD editor
  (Next.js + three.js, `apps/web`). Its flagship features are printable
  mounting-system primitives built as synchronous boundary-rep geometry
  builders in `apps/web/src/lib`, unit-tested in `tests/unit`.

## 2. How work runs here

- **Foreman / builder.** The owner (Marlin) makes design decisions and rules
  on scope; a Claude chat session acts as foreman (plans, writes briefs,
  reviews reports); Claude Code builds on the Linux box in small numbered
  passes, each committed and pushed under an agreed gate.
- **Every pass arrives as a brief** with a read-first list, a DO-NOT-TOUCH
  list of full paths (stop and report if pulled toward one), a scope lock,
  a VERIFY list to run for real, and a REPORT format. Anything outside scope
  goes into the report as a question, never into the tree.
- **Print-gated phases.** Anything that produces physical geometry is
  printed and hand-verified before the next phase builds on it. Findings
  from prints are banked as dated lessons in `CLAUDE-LESSONS.md`
  (append-only; a wrong lesson gets a dated correction, never a rewrite).
  The same habit is used in reports: a wrong or superseded statement gets a
  dated CORRECTED / RESOLVED / CLOSED note in place, original kept.
- **Geometry rules of the house:** boundary representation over runtime CSG;
  shared seams must be bit-identical doubles (pinned by an exact
  directed-edge test); raycast the EXPORTED STL for "open where open" and
  "solid where solid"; front-face x on anything wall-mounted is specified in
  as-mounted view space and mirrored at exactly one marked spot. All in
  `CLAUDE-LESSONS.md`.
- **Frozen files:** the six wrench-rack STLs and both socket coupons in
  `test-prints/` are byte-identity references. The four tray modules were
  last hashed at baseline `8957883f` (socket), `800816cc` (mounted socket),
  `5ffa22d5` (screwdriver), `d8f3de85` (mounted screwdriver) via
  `git hash-object`.

## 3. Dev environment

- Pop!_OS 24.04, user `marlinai`, host `pop-os`, `192.168.1.245`.
- Node 22.23.2 LTS via nvm, npm 10.9.8. Claude Code native install at
  `~/.local/bin`.
- `npm run dev` serves on port 3000 (dev `distDir` is `.next-dev`).
  `npm test` (vitest), `npm run typecheck` (tsc, `apps/web/tsconfig.json`).
- **Docker is deliberately not installed on this box** and the owner does
  not want it there. Docker runs on Unraid only.
- Nothing holds port 3000 at handoff. `apps/web/.next/` (production build
  output) was deleted in this handoff; any future `npm run build`
  recreates it and also rewrites `apps/web/next-env.d.ts` — revert that
  file before committing (KNOWN-FIXES).

## 4. Production — `1.3.3` on Unraid

- Container `marlin-cad` on Unraid (`192.168.1.250`), image
  `ghcr.io/marlin1111ai/marlin-cad:1.3.3`, pinned by tag, never `:latest`.
  Host port **3001** → container port 3000. Host path
  `/mnt/user/appdata/marlin-cad/projects` → `/data/projects`
  (`SKETCHFORGE_SHARED_PROJECTS_DIR=/data/projects` is baked into the image).
- `1.3.3` supersedes `1.3.1`. `1.3.2` was built and pushed (`6ae02f7`) but
  never deployed, because it was a no-op on Unraid.
- **The Host-header thumbnail fix (`9e926bf`, shipped in `1.3.3`).** The
  project-thumbnail route's origin guard derives host and port from the
  `Host` header instead of `request.url`, because in the container
  `request.url` always carries the bind address (`0.0.0.0`) and the
  internal port (3000), never what the browser used
  (`192.168.1.250:3001`). It accepts literal private-LAN IPv4 (10/8,
  172.16/12, 192.168/16) plus localhost; the Origin must match the Host
  exactly. Tradeoff accepted: Host is client-asserted, but this endpoint's
  blast radius is a PNG thumbnail cache. `/api/local-download` (a 512MB
  arbitrary-path writer) and `codex-screenshot` deliberately stay
  localhost-only. Full entry in DECISIONS.md; 28 tests in
  `tests/unit/projectThumbnailOrigin.test.ts`.
- **Thumbnails are confirmed working on the running `1.3.3` container** —
  the owner has seen them on the project cards. Confirmed by sight, not by
  inspecting the image.
- The container has vanished from the Unraid Docker tab **twice** and was
  recreated by hand from the recorded settings each time (see Decided and
  closed).
- Docker Manager icon fix on Unraid is RAM-only:
  `cp /mnt/user/appdata/marlin-cad/freecad.png /usr/local/emhttp/plugins/dynamix.docker.manager/images/question.png`.

## 5. Release process

1. Claude Code bumps the version in the root `package.json` and
   `package-lock.json` and pushes to `main`. **Edit only the top-level
   `version` and the root package entry, by position** — the old version
   string also appears on transitive dependencies. A correct bump is
   exactly 3 changed lines. Never `npm install` / `npm audit fix` to do it.
2. GitHub Actions (`.github/workflows/docker.yml`) builds and publishes
   `ghcr.io/marlin1111ai/marlin-cad:<version>` plus `main`, `sha-<short>`,
   `latest`. It runs unattended on every push to `main`.
3. The owner changes the tag in the Unraid container's image field and
   applies the update. This step is human-gated.

The GHCR package is public, so Unraid needs no credentials to pull.

## 6. Where projects and snapshots actually live

- **Local projects live only in the browser that created them** —
  IndexedDB database `sketchForge.projectShapes` (the geometry, as `.skf`
  packages) plus localStorage key `sketchForge.projects` (the list). They
  are never sent to the server and are not on Unraid in any form. Each
  browser profile has its own separate set.
- **Warning: clearing site data (or browser data, or the profile) for the
  app's origin destroys every local project in that browser.** The four
  projects that prompted the storage recon are backed up in the owner's
  slicer projects, so no rescue was needed.
- **The mapped `/data/projects` volume is written only by Export → SKF →
  Save to shared.** An empty appdata folder means nobody has pressed that
  button; it is not data loss.
- **Snapshots (project-card thumbnails) live in the container's disposable
  layer**, at `/app/apps/web/.codex/project-thumbnails/<projectId>.png` —
  NOT on the mapped volume, no env var. Every container recreate discards
  them. Capture is automatic, ~850ms after a model change; there is no UI
  control.
- Reports: `reference/reports/projects-storage-recon.md`,
  `reference/reports/snapshot-recon.md`.

## 7. The four tray shapes

All four are built, registered in the editor's OpenGrid insert menu
(the same eight-file registration pattern), shipped, and **unprinted**. Each
is a separate module; later shapes import earlier shapes' constants but
edit none of them.

| Shape | Module (`apps/web/src/lib/`) | Tests (geometry + registration) | Candidate print file | Printed? |
|---|---|---|---|---|
| Socket Tray (flat) | `socketTrayGeometry.ts` | 36 + 8 | `test-prints/socket-tray-sampler.stl` — 240 × 60 × 18mm, 6 blind pockets 14 / 15 / 19 / 20.70 / 23 / 25mm, 14mm deep over 4mm floor | No |
| Mounted Socket Tray | `mountedSocketTrayGeometry.ts` | 57 + 13 | `test-prints/mounted-socket-tray-coupon.stl` — 240 × 70 × 60mm, Multiconnect slotted plate + shelf, 3 pockets 14 / 19 / 25mm | No |
| Screwdriver Tray (flat) | `screwdriverTrayGeometry.ts` | 50 + 9 | none — no coupon or generator approved | No |
| Mounted Screwdriver Tray | `mountedScrewdriverTrayGeometry.ts` | 59 + 13 | none — no coupon or generator approved | No |

- Socket pockets are blind; screwdriver holes go all the way through (no
  floor, no Pocket Depth, 10mm minimum thickness, bottom rim sharp).
- The two mounted shapes are one L-profile prism each (no seam), hang on
  the same Multiconnect slots as the validated wrench racks, and **mirror
  pocket/hole x into geometry space** (`x_geometry = plateWidth -
  x_viewed`). The flat trays do not mirror, correctly.
- All four have an owner-typed Corner Radius (default 0, byte-identical to
  unrounded output at 0); mounted plate-to-tray junction stays sharp.
  Rounded demo STLs at 3mm sit beside both socket coupons.
- Socket pocket diameter = caliper-measured socket OD + 2mm; mapping
  14→5,6; 15→7,8,9; 19→10,11,12; 20.70→13; 23→14; 25→15,16.

## 8. The physical gate — unchanged

Neither `test-prints/socket-tray-sampler.stl` (flat, 6 pockets) nor
`test-prints/mounted-socket-tray-coupon.stl` (mounted, 3 pockets) has been
printed. **No production tray is built until both are printed and
hand-verified.** Both stay frozen at Corner Radius 0; any print at a chosen
radius is a new coupon judged on its own terms. Wrench rack Metric 1 is
printed and validated; Metric 2 / 3 and SAE 1 / 2 / 3 are recorded as
queued. Printers: Bambu X1C (256mm bed — the 240mm coupons leave 16mm) and
Bambu H2D.

## 9. Gridfinity labeled socket tray — recon only

- A proposed fifth tray: Gridfinity footprint, round blind pockets, a
  printed number label beside each pocket, owner-typed diameters, no
  magnets. **Read-only recon done (`ea3c88f`,
  `reference/reports/gridfinity-labeled-tray-recon.md`); nothing built.**
- Recon findings: labels are buildable boundary-rep with what is already
  installed (`three`'s `Font.generateShapes` gives vector outlines that feed
  the trays' existing earcut path; no new dependency); the Gridfinity foot
  is a banded rounded-rect sweep, new but small. Biggest risk: font glyphs
  are not CAD contours, so every digit must pass the manifold +
  exact-directed-edge contract. The reference's 19.55mm height is the
  18.75mm tray plus 0.8mm raised labels (resolved 2026-09-26).
- **The owner is print-testing a reference Gridfinity STL first.**
- **Owner decision outstanding: auto-layout.** Whether this shape derives
  tray size from hole count and auto-spaces holes across rows. That would
  be a deliberate exception to the settled rule that the owner types every
  pocket position (DECISIONS.md, no auto-layout). Nothing is specified until
  this is ruled on.
- **The reference STLs are a layout reference only, not a size
  reference.** Their generic hole diameters (17.60mm for a 6mm socket)
  disagree with the owner's own caliper-measured set (14mm for 5–6mm
  sockets). Hole sizes come from the owner's measurements.
- Label legibility at 5mm height / 0.8mm depth is unproven and needs its own
  print before a tray is built on it.

## 10. Test suite

575 tests passing across 54 files (`npm test`, 2026-09-26); typecheck
clean. Per-file tray counts are in the table above; the thumbnail guard
has 28.

## 11. Open items

Every open item, grouped. `reference/OPEN-ITEMS.md` holds the full wording
and is the list to update.

**Physical / print-gated**
1. Socket Tray sampler unprinted; print on the X1C and test all 12
   sockets. Production layout (12 pockets in 240mm) undecided until it
   passes.
2. Mounted Socket Tray coupon unprinted; second half of the gate.
3. Mounted tray print orientation undecided (tray-down vs plate-down; no
   slicer consulted).
4. Mounted tray junction has no fillet or gusset under a cantilevered load.
5. Pocket depth 14mm is an estimate, inherited by the mounted coupon.
6. Corner Radius working value not chosen; the 3mm demos are demos. Owner
   picks after printing.
7. Corner rounding is mitered at vertical corners, not blended; whether to
   build fully blended corners is the owner's call.
8. Gridfinity label legibility at 5mm / 0.8mm needs a print.

**Gridfinity**
9. Auto-layout decision outstanding (exception to no-auto-layout); owner
   print-testing a reference STL first.
10. Reference Gridfinity STLs are a layout reference, not a size reference.

**Editor / shapes**
11. Add Pocket lands at last x + 36 (off the default tray); owner to decide
    whether the default changes.
12. Socket Tray selection frame centered on the anchor while the mesh spans
    anchor to +width/+depth; cosmetic, living with it.
13. `test-prints/README.md` has no entry for the mounted coupon.
14. Future preset families: screwdriver half built; pliers not started.
15. Heavy board variant is a placeholder, hidden in the UI.
16. OpenGrid loft follow-up (cosmetic double-layer surfaces) deferred.
17. Multiconnect Bin variant and on-ramps deferred.
18. `multiconnect.scad` attribution unknown; the `TODO(attribution)`
    markers are in `scripts/bake-multiconnect-slot.mjs`,
    `multiconnectContainerGeometry.ts` and `multiconnectSlotMesh.ts`.
19. `.skf` files stamp `SKF_CREATED_WITH_VERSION = "1.0.4"`
    (`skfProject.ts:15`) while the app is `1.3.3`.

**Projects and snapshots**
20. Snapshots have no UI control; capture is automatic ~850ms after a
    model change.
21. Snapshots are not on the mapped volume and are lost on every container
    recreate.
22. Local projects live only in browser storage; clearing site data
    destroys them. `/data/projects` is only for Save to shared.

**Infrastructure and security**
23. Rotate the GHCR personal access token (it rendered in plaintext once);
    scope the replacement to `write:packages`.
24. `brepjs` wants Node ≥24; we run Node 22 LTS. Not blocking.
25. 5 high-severity `npm audit` findings in transitive deps; `npm audit fix`
    not run because it rewrites the lockfile.
26. The version tag is re-pushed on every push to `main`; owner to decide
    whether that matters.
27. Docker Manager icon fix is RAM-only; permanent fix is a web-hosted Icon
    URL.

## 12. Decided and closed

Carried forward:

- **Inspector-row pocket highlighting — dropped.** Owner's decision,
  carried forward from the previous brief. The repo holds no other record
  of it, so no detail beyond the decision is given here; do not revive it
  without the owner.
- **The disappearing Unraid container — logged, not investigated.** It has
  gone missing from the Docker tab twice (before `1.1.0`, and on
  2026-09-07 during the `1.3.1` update). Cause unrecorded both times.
  Recreating it by hand from the settings in SESSION-STATE restored it both
  times, with no project data lost. KNOWN-FIXES carries the recovery.

Closed since the previous brief:

- **Four-project rescue — not needed.** The projects are backed up in the
  owner's slicer projects.
- **Thumbnails on Unraid — working** on `1.3.3`, confirmed by owner
  observation. That also settles whether the container's `node` user can
  create `.codex/project-thumbnails`: it can.
- **Thumbnail guard design — decided:** Host header, private-LAN IPv4 plus
  localhost (DECISIONS.md).
- **`1.3.2` — deliberately never deployed** (no-op on Unraid); superseded
  by `1.3.3`.
- **Gridfinity 0.8mm height gap — resolved:** raised label depth above the
  18.75mm tray top.
- **Stale next-server on port 3000 (pid 98055) — gone** since the
  2026-09-10 reboot; nothing listens on 3000.
- **Untracked multiconnect sampler STLs in `test-prints/` — gone** from
  the working tree.
- **Corner Radius visual confirmation — done** by the owner.
- **Stale per-shape test counts in SESSION-STATE — corrected** to the
  re-counted figures above.
- **Stale Sep 9 build output (`apps/web/.next/`) and empty thumbnail test
  folders — deleted.**

## 13. Open questions

None. Every open item is in `reference/OPEN-ITEMS.md` and listed in
section 11.
