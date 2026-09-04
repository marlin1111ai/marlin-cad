# Session State

Where things stand right now.

## Multiconnect system — complete and physically validated

- Plate/PegPlate generator: `multiconnectContainerGeometry.ts`.
- Slot terminator (baked mesh) includes a dimple and quick-release cut.
- Pegs are specified in as-mounted view space (see DECISIONS.md).
- 5° shear tilt on the slot cut.
- `plateThickness` minimum is 6.5mm.
- Default OpenGrid spacing is 28mm.

## Socket Tray — active feature, sampler stage (physical gate pending)

- Module: `apps/web/src/lib/socketTrayGeometry.ts` — new sibling primitive,
  additive only; `multiconnectContainerGeometry.ts` was not edited.
  Boundary-rep only, no CSG, no baked mesh (a round pocket's rim is a plain
  parametrized circle).
- Tests: `tests/unit/socketTrayGeometry.test.ts` — 17 tests (manifold check,
  exact directed-edge check, bounding box, validation guards, per-pocket
  raycasts asserting open top-to-floor and solid floor-to-bottom, a
  between-pockets solid check, and a dedicated tightest-gap check).
- Generator: `scripts/generate-socket-tray-sampler.mjs`
  (`node --experimental-strip-types scripts/generate-socket-tray-sampler.mjs`).
- Coupon: `test-prints/socket-tray-sampler.stl` — 240 × 60 × 18mm
  (width × depth × thickness), ASCII STL, 1,548 triangles. Six round blind
  pockets, 14mm deep over a 4mm floor, 36mm pitch, 30mm end margins, all
  centered at z=30. Diameters left to right: 14, 15, 19, 20.70, 23, 25mm
  (measured socket OD + 2mm clearance). Confirmed mapping: 14mm→5,6;
  15mm→7,8,9; 19mm→10,11,12; 20.70mm→13; 23mm→14; 25mm→15,16 — all 12
  standard sockets 5–16mm across 6 pockets.
- Bed fit: 240mm leaves 16mm spare under the X1C's 256mm bed. Six pockets
  at the earlier 45mm pitch would have needed 285mm; the owner approved the
  36mm pitch instead.
- No back plate yet: the coupon is a standalone block. The OpenGrid Snap
  back-plate mount for the tray is not built.
- Status: unvalidated — the coupon has not been printed.
- **Physical gate: print the 6-pocket coupon on the X1C and test all 12
  sockets (5–16mm) in it before any production tray is built.**
- Full detail: `reference/socket-tray-recon.md`,
  `reference/socket-tray-sampler-report.md`.

## Recent shipped work (all pushed to origin/main)

- Socket Tray primitive, unit tests, generator script, and unvalidated
  sampler coupon added (`88c37a1`).
- Socket Tray sampler pocket depth reduced to 14mm, tray thickness to 18mm
  (`a32a314`).
- Socket Tray sampler diameters shifted to 10/14/18/22/27mm (`75d79d8`).
- Socket Tray sampler expanded to 6 real-measured diameters at 36mm pitch
  (`107af0b`).
- Sockets-per-pocket mapping replaced with the owner's real measured
  mapping, docs only (`cc4f3ff`).
- Multiconnect UI registered in the editor (`10982d5`).
- Wrench Racks presets added to the OpenGrid insert menu (`f4e3248`).
- Six validated reference STLs committed to `test-prints/` (`c851e06`).
- reference/ session-orientation docs (SESSION-STATE, OPEN-ITEMS, DECISIONS, KNOWN-FIXES) added (`640ebe3`).
- Docker deployment consolidated on `deploy/docker/Dockerfile`; root Dockerfile removed (`edb8101`).

## Dev environment

- Fresh Pop!_OS 24.04 install. User `marlinai`, host `pop-os`, `192.168.1.245`.
- The repo lives at `/Apps/marlin-cad` — `/Apps` is a separate drive, not the
  home folder. See DECISIONS.md for why.
- Node 22.23.2 LTS via nvm, not apt. npm 10.9.8.
- Claude Code 2.1.251, native installer, at `~/.local/bin`.
- Rebuild verified end to end on this box: clone, `npm install`,
  `npm run dev` on port 3000, Wrench Rack Metric 2 preset loads and renders,
  STL export confirmed working.
- **Docker is not installed here.** The `docker:*` npm scripts do not run on
  this box; Unraid pulls the production image from GHCR instead.

## Production deployment

- marlin-cad runs as a Docker container on Unraid, pulled from
  `ghcr.io/marlin1111ai/marlin-cad:1.0.0`.
- Host port 3001 → container port 3000.
- Host path `/mnt/user/appdata/marlin-cad/projects` → `/data/projects`.
  `SKETCHFORGE_SHARED_PROJECTS_DIR=/data/projects` is baked into the image, so
  only the path mapping is needed; without it, projects live inside the
  container and are lost on update.
- Verified working in the browser. Noticeably faster than dev mode — it is a
  production build, not a dev compile.
- Dev on the Linux box is unchanged: `npm run dev`, port 3000. The container
  never binds 3000 on the host.
- Image built from `deploy/docker/Dockerfile`; the root Dockerfile was removed
  in `edb8101`.

## Print status

- Metric 1: printed and validated on the board.
- Metric 2, Metric 3, SAE 1, SAE 2, SAE 3: queued to print.
- Socket Tray sampler coupon (`test-prints/socket-tray-sampler.stl`): not
  yet printed; it is the physical gate for the socket work.

## Other validated primitives

- OpenGrid Board — full board only exposed in the UI.
- OpenConnect Container — Bin and Shelf variants.
- OpenGrid Snap — 4 variants.

## Test suite

319 unit tests passing across 46 files (`npm test`, 2026-09-04), of which
17 are in `tests/unit/socketTrayGeometry.test.ts`.

## Printers

- Bambu X1C (256mm bed)
- Bambu H2D
