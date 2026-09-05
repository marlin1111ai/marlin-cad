# Open Items

Unfinished threads, one line of status each.

- **multiconnect.scad attribution** — upstream license/source unknown; owner to locate the source page. Attribution TODO in `reference/multiconnect.scad`.
- **Heavy board variant** — groove geometry is a flat-slab placeholder; Heavy is disabled in the UI until real geometry exists.
- **OpenGrid loft follow-up** — loft-based fix for cosmetic non-manifold double-layer surfaces on connector holes/screw mounts; deferred, not started.
- **Multiconnect Bin variant and on-ramps** — deferred.
- **Sockets** — Socket Tray UI registered and owner-tested (`fe3e829`); sampler coupon (`test-prints/socket-tray-sampler.stl`, 6 pockets) still unprinted; physical gate pending: print on the X1C and test all 12 sockets. Production tray layout (12 pockets in 240mm) undecided; owner picks after the coupon passes.
- **Add Pocket default placement** — a new pocket lands at last x + 36, which exceeds the tray edge on the default 240mm tray (x = 246) and shows the validation error until moved; owner to decide whether the default changes.
- **Socket Tray selection frame** — centered on the anchor while the mesh spans anchor to +width/+depth, matching Multiconnect; cosmetic, living with it.
- **Mounted Socket Tray coupon unprinted** — `test-prints/mounted-socket-tray-coupon.stl` (240 × 70 × 60mm, 3 pockets) is built and owner-tested in the app but never printed; physical gate pending alongside the flat sampler.
- **Mounted tray print orientation undecided** — the part is an L, so no build direction is parallel to both limbs. Tray-down gives clean vertical pockets but stands the 60mm plate up as a tall thin wall; plate-down supports the plate but turns each pocket into a sideways bore with an unsupported upper half, 25mm across at the largest. Stated from geometry only; no slicer was consulted.
- **Mounted tray junction has no fillet or gusset** — follows the OpenConnect Shelf precedent, but this tray carries a forward cantilevered load that the Shelf's own validation never covered.
- **Mounted tray pocket depth is inherited and unproven** — 14mm, carried over from the flat coupon, which is itself unprinted; the mounted coupon inherits that uncertainty.
- **Corner Radius chosen value** — the two new demo STLs (`test-prints/socket-tray-sampler-rounded-demo.stl`, `test-prints/mounted-socket-tray-coupon-rounded-demo.stl`) use a 3mm Corner Radius chosen only for demonstration (comfortable headroom against every validation guard, per `reference/reports/socket-tray-rounding-build.md`); no radius has been print-validated. Owner picks a working radius after printing.
- **Corner Radius visual confirmation** — the build report could not visually verify the rounding in the 3D viewport (no browser tool in that session). The owner has since confirmed it visually. Resolved.
- **`test-prints/README.md` has no entry for the mounted coupon** — that directory was do-not-touch on the build pass, so the new coupon is undocumented in the folder's own index.
- **Future preset families** — screwdrivers, pliers; not started.
- **Untracked sampler STLs in test-prints/** — four multiconnect peg/plate sampler STLs are throwaway; decide whether to delete or gitignore them.
- **Rotate the GHCR personal access token** — it rendered in plaintext during a session (Docker stores it base64-encoded, not encrypted, in `~/.docker/config.json`). Scope the replacement to `write:packages` only; the current one is a classic `ghp_` token with far broader reach.
- **brepjs wants Node >=24, we run Node 22 LTS** — `brepjs@18.118.0` declares `node: >=24`; npm warns EBADENGINE on install. App renders and STL export verified working, so not blocking — but this is the first suspect if odd geometry or worker failures appear.
- **5 high-severity npm audit findings in transitive deps** — `npm audit fix` not run: it rewrites the lockfile, which could alter the byte-identical preset exports (see DECISIONS.md).
- **Version tag re-pushed on every push to `main`** — the pinned tag's contents can change without a version bump; owner to decide whether that matters.
- **Docker icon fix is RAM-only** — permanent fix is a web-hosted Icon URL.
