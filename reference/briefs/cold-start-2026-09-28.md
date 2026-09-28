# marlin-cad — cold-start brief, 2026-09-28

Standalone. Assumes no chat history. Supersedes
`reference/briefs/cold-start-2026-09-27.md`. Everything here is also in the
notebook (`reference/SESSION-STATE.md`, `OPEN-ITEMS.md`, `DECISIONS.md`,
`KNOWN-FIXES.md`, and `CLAUDE-LESSONS.md` at the repo root). This brief is
the map; the notebook is the authority. Where they ever disagree, the
notebook wins and this brief is stale.

---

## 1. Repo and HEAD at handoff

- Repo: `/Apps/marlin-cad` on the Linux dev box. Remote is SSH:
  `git@github.com:marlin1111ai/marlin-cad.git`, branch `main`. It is a fork
  of `Formsmith746/SketchForge-3D`.
- **HEAD at handoff is the commit that adds this brief.** It sits on top of
  `344c50f`. `git log -1` shows the exact SHA.
- History of 2026-09-28, oldest first: `020c8f0` viewport mouse controls
  recon; `bf755c5` the viewport mouse controls change, with its notebook
  entries and build report; `d5c8af0` one line of the build report
  corrected; `0fc0b75` the owner's pass recorded; `c9a4c6d` version bumped
  to `1.3.4`; `c955a74` the deploy to Unraid recorded; `344c50f` the
  force-update process recorded; then the handoff commit, which closes the
  handoff audit's items and adds this brief.

## 2. How work runs here

- Foreman / builder, print-gated phases, and the geometry rules of the
  house are unchanged; see `CLAUDE.md` and `CLAUDE-LESSONS.md`.
- Every pass arrives as a brief pasted into Claude Code. The owner's
  personal `~/.claude/CLAUDE.md` on the dev box holds one rule, in the
  owner's words: a pasted brief is already approved and is run as written,
  including any commit and push, without asking for confirmation.
- The builder's reports are chat output and are not on disk unless a brief
  asks for a report file.
- A handoff pass audits everything since the last handoff and stops, without
  writing the brief, if any item is still open.

## 3. Dev environment

- Pop!_OS 24.04, user `marlinai`, host `pop-os`, `192.168.1.245`.
- Node 22.23.2 via nvm, npm 10.9.8. `npm run dev` serves on port 3000;
  `npm test` (vitest); `npm run typecheck`.
- To open the dev app from another machine, such as the owner's Mac, start
  it as `SKETCHFORGE_ALLOWED_DEV_ORIGINS=192.168.1.245 npm run dev` and open
  `http://192.168.1.245:3000`. Plain `npm run dev` answers that browser with
  403 for the app's scripts (`KNOWN-FIXES.md`).
- Google Chrome 154.0.8037.57 is installed at `/usr/bin/google-chrome`. A
  Claude Code shell on this box has no display set, so a pass runs Chrome
  headless.
- **Docker is installed on this box, and marlin-cad does not use it.**
  `docker.io` 29.1.3 has been installed since 2026-09-04 (package log), and
  it runs a container from another project, `marlin-cast-recon`, which was
  running at handoff. marlin-cad's images are built by GitHub Actions and
  the owner updates Unraid.
- Nothing holds port 3000 at handoff. No dev server, browser or driver
  started by a marlin-cad pass is running.
- The dev box has no route to Unraid.

## 4. Production — Unraid

- Container `marlin-cad` on Unraid (`192.168.1.250`), host port 3001 →
  container port 3000, host path `/mnt/user/appdata/marlin-cad/projects` →
  `/data/projects`.
- **Deployed build:** the image built from `0fc0b75`,
  `sha256:4a802164bba1562475b631c7afc94daf98d04d7db53c54a433416d5fb569cb54`,
  also tagged `sha-0fc0b75`, running under the `1.3.3` tag. It contains the
  viewport mouse controls change (`bf755c5`). The owner force-updated the
  `1.3.3` container to it on 2026-09-28 and checked the mouse controls in
  production: "all good".
- **Rollback tag:** `ghcr.io/marlin1111ai/marlin-cad:sha-586033e`,
  `sha256:d1c2c036e0eb6e29dd7d53dbe258b5bf24fa7f721f65c9bb9d6c9d5af146ae4d`,
  the build that ran in production from 2026-09-27 to 2026-09-28. No
  rollback has been run.
- The `1.3.3` tag resolves to the deployed image and no longer moves: the
  version in `package.json` is `1.3.4`, and GitHub Actions re-points the
  current version tag on every push to `main`.
- **`1.3.4` is published and not deployed.** It was first built from
  `c9a4c6d`
  (`sha256:e3906a1e266949facd9fd88a6db9da48d4f585907722cee2feb2b3a95ad4f9fd`,
  also tagged `sha-c9a4c6d`). The `1.3.4` tag has moved with every push
  since, as expected.
- **The update process is force update** (DECISIONS.md, 2026-09-28):
  Claude Code pushes to `main`; GitHub Actions publishes the image and
  re-points the `1.3.4` tag and `sha-<short>`; the owner force-updates the
  container. The builder no longer bumps the version for releases.
- **The one-time switch from `1.3.3` to `1.3.4` is pending at the next
  update.** The container still names `1.3.3`, and a force update of that
  tag picks up nothing new. At the next update the owner changes the
  container's tag to `1.3.4` once; after that he force-updates it.
- Each update names the running build as its rollback before it is applied,
  read from the owner's pre-update backup check in Unraid's terminal.
- **Backups** are run by the owner by hand in Unraid's web terminal, with
  the output checked by the foreman. Before the 2026-09-28 update the owner
  copied the projects folder to
  `/mnt/user/appdata/marlin-cad/projects-backup-2026-09-28`; source and
  backup both held 0 files and 0 bytes.
- Report: `reference/reports/viewport-mouse-controls-deploy-2026-09-28.md`.

## 5. The shapes

Five trays, each a separate module under `apps/web/src/lib/`, each
registered in the editor. Later shapes import earlier shapes' constants and
edit none of them. No shape, geometry module, test or file in `test-prints/`
changed on 2026-09-28.

| Shape | Module | Tests (geometry + registration) | File in `test-prints/` | Printed? |
|---|---|---|---|---|
| Socket Tray (flat) | `socketTrayGeometry.ts` | 36 + 8 | `socket-tray-sampler.stl`, and a rounded demo | No |
| Mounted Socket Tray | `mountedSocketTrayGeometry.ts` | 57 + 13 | `mounted-socket-tray-coupon.stl`, and a rounded demo | No |
| Screwdriver Tray (flat) | `screwdriverTrayGeometry.ts` | 50 + 9 | none | No |
| Mounted Screwdriver Tray | `mountedScrewdriverTrayGeometry.ts` | 59 + 13 | none | No |
| Gridfinity Socket Tray | `gridfinitySocketTrayGeometry.ts` | 64 + 12 | none | Yes, 2026-09-27: "it prints and works" |

- The first four sit in the OpenGrid section of the insert menu; the
  Gridfinity Socket Tray sits in its own Gridfinity section.
- Gridfinity Socket Tray: sized in whole squares (at most 6 per axis), top
  face 22.75mm above the bed, 14mm holes over a 4mm floor, a label in front
  of each hole, one raised / recessed setting (default raised), Corner
  Radius below 3.75mm. Hole Z is measured from the edge nearest the viewer,
  which differs from the flat trays' Z = 0 edge. Default insert: 3 × 2
  squares, 125.5 × 83.5 × 23.55mm, holes of 15 / 19 / 19mm labelled "8mm" /
  "10mm" / "12mm".
- Two supporting modules, not registered in the editor on their own:
  `labelSlabGeometry.ts` (49 tests) and `gridfinityFootGeometry.ts`
  (39 tests). Their test pieces, `test-prints/label-test-piece.stl` and
  `test-prints/gridfinity-foot-test-piece.stl`, were both printed and passed
  on 2026-09-27.
- Other primitives are unchanged: Multiconnect Plate / PegPlate and the six
  Wrench Racks presets, OpenGrid Board, OpenConnect Container, OpenGrid
  Snap.

The editor's 3D viewport, changed on 2026-09-28 in
`apps/web/src/components/WorkplaneViewport.tsx`, the only code file changed
that day:

| Input | What it does |
|---|---|
| Left-drag on empty space | Spins the view; the selection is unchanged |
| Right-drag, or middle-drag | Slides the view |
| Wheel | Zooms toward the pointer; rolling toward you zooms out |
| Shift + left-drag on empty space | Draws the selection box; adds to the selection |
| Left-click on empty space | Clears the selection |
| Left-drag on a part | Selects and moves it; only a direct hit counts |
| Shift + click on a part | Adds it to the selection or removes it |
| Ctrl / Cmd + left-drag, Shift + right-drag, Shift + middle-drag | Spin the view, from anywhere |

- Align and Mirror follow the left-drag above. Chamfer / Fillet, Ruler and
  Place workplane keep the left button for the tool.
- The 2D sketch view and touch input are unchanged. Touch keeps the
  near-a-part grab and the plain-drag box.
- Passed by the owner on his Mac ("bank it") and checked by him in
  production ("all good"), both on 2026-09-28.

## 6. Print status

Unchanged on 2026-09-28.

- Printed and passed: wrench rack Metric 1; the label test piece; the
  Gridfinity foot test piece; the Gridfinity Socket Tray default insert.
- Not printed: the Socket Tray sampler coupon and the Mounted Socket Tray
  coupon (the physical gate for the socket work); both Screwdriver Trays
  (no candidate file); wrench racks Metric 2 / 3 and SAE 1 / 2 / 3 (queued).

## 7. Test suite

739 tests passing across 58 files (`npm test`, 2026-09-28, on `344c50f`
with the handoff commit's notebook edits in the working tree; no code file
differs from `344c50f`). Counted from the runner's per-test lines, tallied
per file. Typecheck clean on the same tree. CI was green on `344c50f` (run
`36497565656`). CI for the handoff commit runs after this brief is pushed
and is not recorded here.

No test pins a mouse binding; the viewport change was checked live, before
and after, in `reference/reports/viewport-mouse-controls-build.md`.

## 8. This session's decisions

All in `reference/DECISIONS.md`, dated 2026-09-28:

- The 3D viewport takes Bambu Studio's movement (owner's answer 1a).
- Only a direct hit on a part selects or grabs it; the near-a-part fallback
  is removed (owner's answer 2a), with a note that touch stays as it was.
- The new viewport mouse controls passed the owner's hands-on test.
- Unraid is updated by force update (owner's answer "a").
- Dated notes appended to two older entries: "Unraid pins a version tag",
  and the entry saying the dev box never runs Docker.

One entry was added to `reference/KNOWN-FIXES.md` on 2026-09-28: the dev app
loading broken in a browser on another machine. No lesson was added to
`CLAUDE-LESSONS.md`.

## 9. Open items

`reference/OPEN-ITEMS.md` holds 57 lines, 8 of them closed or resolved. It
is the list to update. On 2026-09-28 one item was closed (the version tag
re-pushed on every push) and two were corrected in place (the rollback tag,
and the `.skf` version line).

## 10. The last reports this handoff checked

- `reference/reports/viewport-mouse-controls-recon.md`: the recon, its
  answers, its correction and its notes.
- `reference/reports/viewport-mouse-controls-build.md`: the build, with the
  live before and after of every input, and its answers.
- `reference/reports/viewport-mouse-controls-deploy-2026-09-28.md`: the
  deploy, recorded on the owner's word, and its answers.
- This pass: the handoff audit of everything since `88e16ac`. It first
  stopped with nine items open; this pass recorded or corrected each one,
  re-ran the audit with none open, and wrote this brief. The audit itself is
  chat output; its closures are in the three reports above and in
  `SESSION-STATE.md`, `DECISIONS.md`, `OPEN-ITEMS.md` and `KNOWN-FIXES.md`.

## 11. Open questions

None. Every open item is in `reference/OPEN-ITEMS.md`.
