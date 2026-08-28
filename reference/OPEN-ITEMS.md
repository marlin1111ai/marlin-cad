# Open Items

Unfinished threads, one line of status each.

- **multiconnect.scad attribution** — upstream license/source unknown; owner to locate the source page. Attribution TODO in `reference/multiconnect.scad`.
- **Heavy board variant** — groove geometry is a flat-slab placeholder; Heavy is disabled in the UI until real geometry exists.
- **OpenGrid loft follow-up** — loft-based fix for cosmetic non-manifold double-layer surfaces on connector holes/screw mounts; deferred, not started.
- **Multiconnect Bin variant and on-ramps** — deferred.
- **Future preset families** — sockets, screwdrivers, pliers; not started.
- **Untracked sampler STLs in test-prints/** — four multiconnect peg/plate sampler STLs are throwaway; decide whether to delete or gitignore them.
- **Rotate the GHCR personal access token** — it rendered in plaintext during a session (Docker stores it base64-encoded, not encrypted, in `~/.docker/config.json`). Scope the replacement to `write:packages` only; the current one is a classic `ghp_` token with far broader reach.
- **brepjs wants Node >=24, we run Node 22 LTS** — `brepjs@18.118.0` declares `node: >=24`; npm warns EBADENGINE on install. App renders and STL export verified working, so not blocking — but this is the first suspect if odd geometry or worker failures appear.
- **5 high-severity npm audit findings in transitive deps** — `npm audit fix` not run: it rewrites the lockfile, which could alter the byte-identical preset exports (see DECISIONS.md).
