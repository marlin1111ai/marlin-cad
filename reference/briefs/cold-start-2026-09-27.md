# marlin-cad — cold-start brief, 2026-09-27

Standalone. Assumes no chat history. Supersedes
`reference/briefs/cold-start-2026-09-26.md`. Everything here is also in the
notebook (`reference/SESSION-STATE.md`, `OPEN-ITEMS.md`, `DECISIONS.md`,
`KNOWN-FIXES.md`, and `CLAUDE-LESSONS.md` at the repo root). This brief is
the map; the notebook is the authority. Where they ever disagree, the
notebook wins and this brief is stale.

---

## 1. Repo and HEAD at handoff

- Repo: `/Apps/marlin-cad` on the Linux dev box. Remote is SSH:
  `git@github.com:marlin1111ai/marlin-cad.git`, branch `main`. It is a fork
  of `Formsmith746/SketchForge-3D`.
- **HEAD at handoff is the commit after `6ab706f`.** `6ab706f` added this
  brief on top of `0803ac0`; the commit after it corrects one line of the
  audit report and this paragraph. `git log -1` shows the exact SHA; local
  `main` and `origin/main` were equal when it was pushed.
- History of 2026-09-27, oldest first: `742dcb1` label test piece;
  `e40575f` label rulings and two lessons; `6f8813f` CI timeout fix;
  `6765ec8` label print result; `b1cbb5f` Gridfinity foot test piece;
  `586033e` Gridfinity Socket Tray; `9afa443` deploy record and backup rule;
  `0803ac0` print result; `6ab706f` notebook brought current and this brief
  added; then the handoff commit.

## 2. How work runs here

- Foreman / builder, print-gated phases, and the geometry rules of the
  house are unchanged; see `CLAUDE.md` and `CLAUDE-LESSONS.md`.
- Every pass arrives as a brief pasted into Claude Code. The owner's
  personal `~/.claude/CLAUDE.md` on the dev box holds one rule, in the
  owner's words: a pasted brief is already approved and is run as written,
  including any commit and push, without asking for confirmation.
- The builder's reports are chat output and are not on disk unless a brief
  asks for a report file.

## 3. Dev environment

- Pop!_OS 24.04, user `marlinai`, host `pop-os`, `192.168.1.245`.
- Node 22.23.2 via nvm. `npm run dev` serves on port 3000; `npm test`
  (vitest); `npm run typecheck`.
- Google Chrome is installed at `/usr/bin/google-chrome`. Docker is not
  installed on this box.
- Nothing holds port 3000 at handoff.
- The dev box has no route to Unraid.

## 4. Production — Unraid

- Container `marlin-cad` on Unraid (`192.168.1.250`), host port 3001 →
  container port 3000, host path `/mnt/user/appdata/marlin-cad/projects` →
  `/data/projects`.
- **Deployed build:** the image built from `586033e`,
  `sha256:d1c2c036e0eb6e29dd7d53dbe258b5bf24fa7f721f65c9bb9d6c9d5af146ae4d`,
  also tagged `sha-586033e`. The owner force-updated the `1.3.3` container
  to it on 2026-09-27 and checked the Gridfinity Socket Tray in production:
  "all good updated and checked".
- **Rollback tag:** `ghcr.io/marlin1111ai/marlin-cad:sha-9e926bf`.
- The `1.3.3` tag is re-pointed on every push to `main`, so it no longer
  resolves to the deployed image.
- **Backups** are run by the owner by hand in Unraid's web terminal, with
  the output checked by the foreman. Before the deploy the owner copied the
  projects folder to `/mnt/user/appdata/marlin-cad/projects-backup-2026-09-27`;
  the source held 0 files and 0 bytes.
- Report: `reference/reports/gridfinity-socket-tray-deploy-2026-09-27.md`.
- The release process is unchanged; see SESSION-STATE.md.

## 5. The shapes

Five trays, each a separate module under `apps/web/src/lib/`, each
registered in the editor. Later shapes import earlier shapes' constants and
edit none of them.

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

## 6. Print status

- Printed and passed: wrench rack Metric 1; the label test piece; the
  Gridfinity foot test piece; the Gridfinity Socket Tray default insert.
- Not printed: the Socket Tray sampler coupon and the Mounted Socket Tray
  coupon (the physical gate for the socket work); both Screwdriver Trays
  (no candidate file); wrench racks Metric 2 / 3 and SAE 1 / 2 / 3 (queued).

## 7. Test suite

739 tests passing across 58 files (`npm test`, 2026-09-27, on `0803ac0`);
typecheck clean, re-run on `6ab706f` with the same result. CI was green on
`6ab706f` (run `36367776733`).

## 8. This session's decisions

All in `reference/DECISIONS.md`, dated 2026-09-27:

- Gridfinity labeled socket tray: no auto-layout.
- A label test piece is built and printed first, with the owner's label
  choices; its digit height; it prints as-is; its margin and gap.
- The label test piece printed and passed.
- The raised / recessed label setting; the default is raised.
- Gridfinity labeled socket tray: the owner's answers.
- The Gridfinity foot test piece printed and passed.
- Gridfinity Socket Tray: the build answers, with a builder's note on the
  front edge.
- Unraid backups are run by the owner by hand.
- The Gridfinity Socket Tray printed and works.
- Gridfinity Socket Tray Z is measured from the edge nearest the viewer.
- The Gridfinity Socket Tray's Corner Radius limit is below 3.75mm.

Three lessons were banked in `CLAUDE-LESSONS.md` on 2026-09-27: earcut and
contour points lying on a triangle edge; a floating-point guard on its
limit; the CI runner is slower than the dev box.

## 9. Open items

`reference/OPEN-ITEMS.md` holds 57 lines, 7 of them closed or resolved. It
is the list to update.

## 10. The last report this handoff checked

`reference/reports/audit-2026-09-27.md`: the audit made at `0803ac0`, and
the follow-up pass that recorded, corrected or closed its items 26 to 75
and deleted its leftovers 1 to 9. That follow-up pass is `6ab706f` and the
commit after it.

## 11. Open questions

None. Every open item is in `reference/OPEN-ITEMS.md`.
