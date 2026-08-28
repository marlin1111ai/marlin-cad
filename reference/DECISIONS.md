# Decisions

Design decisions and the reason for each.

- **Foreman/builder workflow, print-gated phases.** Claude (chat) is the foreman — plans, writes specs, reviews reports. Claude Code is the builder — implements on the Linux box. Phases are print-gated: a coupon or sampler is printed and hand-verified before the next phase builds on it.
- **Boundary-rep/earcut over runtime CSG.** Runtime CSG subtraction is unreliable for cuts that reach a surface and is slower; boundary construction is dependable and dramatically faster. See CLAUDE-LESSONS.md.
- **UI scoping over code deletion.** Board Type is restricted to "full" and Heavy is hidden in the UI rather than removing the underlying code, since the variants aren't validated yet.
- **Wrench Racks presets must stay byte-identical to test-prints/ reference STLs.** Those STLs are the physically validated exports; any geometry change that alters them requires a new print verification pass before merging.
- **Multiconnect slots are blind keyhole cuts, 4.15mm deep.** The front face stays solid by construction.
- **plateThickness extra material goes frontward.** Slots are always measured from the mounting face, so added thickness doesn't change slot depth.
- **Peg x is "from the left edge as mounted."** User-facing peg positions are specified in as-mounted view space; geometry mirrors internally at exactly one marked spot (`normalizedPegs`), since the front face is X-mirrored relative to geometry space.
- **Shelf variant intentionally has no truss/gusset.**
- **MIN_OPENCONNECT_DIMENSION lowered to 0.1** (`97a97a3`).
- **Deployment to Unraid is a separate, human-gated step.** Dev runs as a local process on port 3000.
- **`deploy/docker/Dockerfile` is canonical; the root Dockerfile was removed.** Every build path already targeted it — `npm run docker:build`, `deploy/docker/compose.yaml`, and `.github/workflows/docker.yml` all pass `file: deploy/docker/Dockerfile` with the repo root as context — so a second root Dockerfile was pure drift risk (`edb8101`). The root `.dockerignore` went with it: BuildKit reads the ignore file sitting next to the Dockerfile, so `deploy/docker/Dockerfile.dockerignore` is what applies and the root file never did.
- **Production images publish to GHCR; Unraid pulls from there.** Matches the pattern already used by the other Marlin apps, and keeps the NAS out of the build business.
- **Unraid pins a version tag (`1.0.0`), never `:latest`.** Production moves only when the tag is changed deliberately; Unraid's update check cannot pull a new build out from under a working deployment.
- **The GHCR package is public.** The image contains only the open-source app and its built-in presets, so there is nothing to gate — and public means Unraid does not need to hold GHCR credentials to pull.
- **marlin-cad is Linux-only.** Developed on Pop!_OS, deployed as a Linux container on Unraid. The Mac is browser and slicer only. Cross-platform moves (Mac/Windows/Linux) caused persistent problems on other projects; this one never left Linux and never had them.
- **Projects live on the `/Apps` drive, not in the home folder.** Runtimes (Node via nvm) and tooling stay in the home folder; project files and `node_modules` stay under `/Apps/<project>`.
