# Session State

Where things stand right now.

## Multiconnect system — complete and physically validated

- Plate/PegPlate generator: `multiconnectContainerGeometry.ts`.
- Slot terminator (baked mesh) includes a dimple and quick-release cut.
- Pegs are specified in as-mounted view space (see DECISIONS.md).
- 5° shear tilt on the slot cut.
- `plateThickness` minimum is 6.5mm.
- Default OpenGrid spacing is 28mm.

## Recent shipped work (all pushed to origin/main)

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

## Other validated primitives

- OpenGrid Board — full board only exposed in the UI.
- OpenConnect Container — Bin and Shelf variants.
- OpenGrid Snap — 4 variants.

## Test suite

227 unit tests passing.

## Printers

- Bambu X1C (256mm bed)
- Bambu H2D
