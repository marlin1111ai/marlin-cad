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
- No back plate on THIS coupon: it is deliberately a standalone block, the
  flat test piece. The wall-mounted version is a separate shape and module —
  see the Mounted Socket Tray section below — and its back is a Multiconnect
  slotted plate, not the OpenGrid Snap the earlier plan assumed (see
  DECISIONS.md).
- Registered in the editor (`fe3e829`): a catalog entry in the OpenGrid
  section of the insert menu, and an inspector with Width / Depth /
  Thickness / Pocket Depth rows plus a per-pocket Diameter / X / Z list
  (add / remove, inline module error). Follows the Multiconnect
  registration pattern across the same eight files; neither geometry
  module was edited. Owner-tested in the dev app and approved.
- The default insert is the six-pocket coupon; exported through the real
  STL writer it reproduces `test-prints/socket-tray-sampler.stl` triangle
  for triangle (1,548 facets, identical bounding box, every vertex within
  7.4e-6mm on the float32 path; only the solid name differs).
- Registration tests: `tests/unit/socketTrayShapeRegistration.test.ts` —
  7 tests (catalog entry, default insert, shape → options mapping, `.skf`
  round-trip, geometry identity with the module, export reproduces the
  coupon, invalid layouts give the friendly messages).
- Status: unvalidated — the coupon has not been printed.
- **Physical gate: print the 6-pocket coupon on the X1C and test all 12
  sockets (5–16mm) in it before any production tray is built.**
- Full detail: `reference/socket-tray-recon.md`,
  `reference/socket-tray-sampler-report.md`,
  `reference/reports/socket-tray-ui-recon.md`,
  `reference/reports/socket-tray-ui-build.md`.

## Mounted Socket Tray — active feature, coupon stage (physical gate pending)

The wall-hanging sibling of the flat tray: a Multiconnect slotted back plate
with NO pegs, and a shelf-like tray projecting forward from its bottom
carrying round blind pockets. The flat Socket Tray is unchanged by this work
and remains the test piece.

- Module: `apps/web/src/lib/mountedSocketTrayGeometry.ts` — new sibling
  primitive, additive only. Neither `socketTrayGeometry.ts` nor
  `multiconnectContainerGeometry.ts` was edited; both are imported from.
- ONE solid, boundary representation only — no CSG, no boolean union, no
  concatenated meshes. The plate and the tray are not two bodies joined at a
  seam: together they are a single prism whose cross-section in the (Y, Z)
  plane is an L, extruded along the width. The L outline is built once as one
  six-point array, and both the extruded side faces and the two end caps read
  their corners out of that same array, so the junction vertices are
  bit-identical because they ARE the same doubles. There is no seam to stitch.
- Slot features come from the same baked source the validated wrench racks
  use (`multiconnectSlotMesh.ts`); the pocket guards are the flat tray's own
  exported constants, so "the same rule" is the same constant, not a copy.
- Plate defaults are the validated wrench-rack recipe: 240 × 60mm, 10mm
  thick, 28mm slot spacing, 8 slots at x = 22 … 218.
- Coupon: `test-prints/mounted-socket-tray-coupon.stl` — footprint
  **240 × 70 × 60mm** (240 wide, 70 deep = tray 60 + plate 10, 60 tall),
  ASCII STL, 3,524 triangles. Tray 60mm deep and 18mm thick; three round
  blind pockets 14mm deep over a 4mm floor, diameters **14, 19, 25mm** at
  x = 30 / 120 / 210 on the z = 30 centreline (30mm end margins, 90mm pitch).
  240mm leaves 16mm spare under the X1C's 256mm bed.
- Generator: `scripts/generate-mounted-socket-tray-coupon.mjs`.
- Tests: `tests/unit/mountedSocketTrayGeometry.test.ts` — 40 tests, and
  `tests/unit/mountedSocketTrayShapeRegistration.test.ts` — 12 tests.
  Coverage includes the exact directed-edge check over the whole mesh, a
  dedicated inner-corner test isolating the plate-to-tray junction line,
  per-pocket raycasts, and a check that the slot channel is unobstructed
  along its full run at all 8 slots.
- Raycast of the EXPORTED STL (not just the in-memory mesh): every pocket
  open from the tray top down to its 4mm floor and solid below it; the
  channel open along its full run at all 8 slots with the blind floor
  intact; 0 boundary and 0 non-manifold edges.
- Registered in the editor (`c98cff5`): a catalog entry in the OpenGrid
  section, and an inspector with Plate Width / Plate Height / Plate Thickness
  / Slot Spacing / Slot Count / Tray Depth / Tray Thickness / Pocket Depth
  rows plus a per-pocket Diameter / X / Z list (add / remove, inline module
  error). Same eight-file registration pattern as the flat tray. Plate width
  maps to the app's X, plate height to its Y-up height, and `shape.depth`
  holds the solid's full Z extent so the selection frame matches the mesh.
  Owner-tested in the dev app and approved.
- Status: **unvalidated — the coupon has not been printed.**
- Full detail: `reference/reports/socket-tray-mounted-recon.md`,
  `reference/reports/mounted-socket-tray-build.md`.

## Physical gate — both coupons are unprinted

Neither `test-prints/socket-tray-sampler.stl` (flat, 6 pockets) nor
`test-prints/mounted-socket-tray-coupon.stl` (mounted, 3 pockets) has been
printed. **No production tray is built until both are printed and
hand-verified.**

## Recent shipped work (all pushed to origin/main)

- Docker workflow tags images with the `package.json` version on every push
  to `main`, in addition to `main` / `sha` / `latest`; version bumped to
  `1.1.0` (`2c3767d`).
- Release investigation and Actions-enablement reports
  (`2e19746`, `2bde431`, `23571b9`).
- Mounted Socket Tray added: new geometry module, 52 tests, generator
  script, coupon STL, and editor registration (`c98cff5`).
- Read-only recon for a wall-mounted Socket Tray, which established that the
  wrench racks hang on Multiconnect slots rather than the OpenGrid Snap
  (`4eecc37`).
- Socket Tray registered in the editor: catalog entry, inspector, pocket
  card, registration tests (`fe3e829`).
- Read-only recon report for the Socket Tray UI registration (`1827a84`).
- reference/ session docs brought current with the socket tray sampler
  (`26d127b`, push verification recorded in `21ccf00`).
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
- **Docker is deliberately not installed here.** The owner's process is
  Claude Code publishes to GitHub, the owner pulls on Unraid; Docker runs
  on Unraid only. The `docker:*` npm scripts do not run on this box.

## Production deployment

- marlin-cad runs as a Docker container on Unraid (`192.168.1.250`), pulled
  from `ghcr.io/marlin1111ai/marlin-cad:1.1.0`. Docker runs on Unraid only —
  not on the Linux dev box, and the owner does not want it there.
- Host port 3001 → container port 3000.
- Host path `/mnt/user/appdata/marlin-cad/projects` → `/data/projects`.
  `SKETCHFORGE_SHARED_PROJECTS_DIR=/data/projects` is baked into the image, so
  only the path mapping is needed; without it, projects live inside the
  container and are lost on update.
- The `1.0.0` image was built and pushed from Unraid by hand, before GitHub
  Actions was enabled on this fork. `1.1.0` is the first image GitHub
  Actions built and published; see the Release process subsection below.
- The prior `marlin-cad` container was found absent from the Unraid box
  (cause not recorded) and was recreated fresh from the `1.1.0` tag with the
  settings above. Verified working in the browser.
- Blinking Docker Manager icon fix re-applied on Unraid:
  `cp /mnt/user/appdata/marlin-cad/freecad.png /usr/local/emhttp/plugins/dynamix.docker.manager/images/question.png`
  — RAM-only, lost on reboot.
- Dev on the Linux box is unchanged: `npm run dev`, port 3000. The container
  never binds 3000 on the host.
- Image built from `deploy/docker/Dockerfile`; the root Dockerfile was removed
  in `edb8101`.

### Release process

1. Claude Code bumps the version in the root `package.json` and pushes to
   `main`.
2. GitHub Actions (`.github/workflows/docker.yml`) builds the image and
   publishes it to `ghcr.io/marlin1111ai/marlin-cad:<version>` (alongside
   `main`, `sha-<short>`, and `latest`).
3. The owner changes the tag in the Unraid container's image field to the
   new version and applies the update.

Actions had never run on this repo because it is a fork of
`Formsmith746/SketchForge-3D` — GitHub disables workflows by default on a
fork that already contained workflow files. The owner enabled it manually
from the Actions tab and ran "Build and Push Docker Images" once
(run #1, on `23571b9`). That run failed at the push step with
`denied: permission_denied: write_package`; fixed by (a) Settings → Actions
→ General → Workflow permissions → "Read and write permissions", and
(b) the package's own settings at
`github.com/users/marlin1111ai/packages/container/marlin-cad/settings` →
Manage Actions access → Add Repository `marlin-cad` → role Write. The re-run
succeeded and published `1.1.0`. Full detail:
`reference/reports/release-1.1.0.md`,
`reference/reports/release-1.1.0-actions.md`,
`reference/reports/release-1.1.0-publish.md`,
`reference/reports/release-1.1.0-banked.md`.

## Print status

- Metric 1: printed and validated on the board.
- Metric 2, Metric 3, SAE 1, SAE 2, SAE 3: queued to print.
- Socket Tray sampler coupon (`test-prints/socket-tray-sampler.stl`): not
  yet printed; it is the physical gate for the socket work.
- Mounted Socket Tray coupon (`test-prints/mounted-socket-tray-coupon.stl`):
  not yet printed; the second half of that gate.

## Other validated primitives

- OpenGrid Board — full board only exposed in the UI.
- OpenConnect Container — Bin and Shelf variants.
- OpenGrid Snap — 4 variants.

## Test suite

378 unit tests passing across 49 files (`npm test`, 2026-09-04), of which
17 are in `tests/unit/socketTrayGeometry.test.ts`, 7 in
`tests/unit/socketTrayShapeRegistration.test.ts`, 40 in
`tests/unit/mountedSocketTrayGeometry.test.ts` and 12 in
`tests/unit/mountedSocketTrayShapeRegistration.test.ts`.

## Printers

- Bambu X1C (256mm bed)
- Bambu H2D
