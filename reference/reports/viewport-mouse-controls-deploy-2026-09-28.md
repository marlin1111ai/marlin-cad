# Viewport mouse controls — deploy to Unraid, 2026-09-28

Recorded 2026-09-28 on the owner's word and his pasted Unraid terminal
output. Every step on Unraid was done by the owner by hand; the dev box has
no route to Unraid (DECISIONS.md), so nothing on Unraid was observed from
the dev box. The only things read from the dev box are the image digests,
from the public registry, and the repo's own history.

## Pre-deploy backup

The owner copied `/mnt/user/appdata/marlin-cad/projects` to
`/mnt/user/appdata/marlin-cad/projects-backup-2026-09-28`.

| | Files | Bytes |
|---|---|---|
| Source | 0 | 0 |
| Backup | 0 | 0 |

Checksums match (0 files).

Before the update the container ran
`ghcr.io/marlin1111ai/marlin-cad:1.3.3` at
`sha256:d1c2c036e0eb6e29dd7d53dbe258b5bf24fa7f721f65c9bb9d6c9d5af146ae4d`,
the `sha-586033e` build.

## Rollback tag

`ghcr.io/marlin1111ai/marlin-cad:sha-586033e`

## Release

`1.3.4` was built and published from `c9a4c6d`
(`sha256:e3906a1e266949facd9fd88a6db9da48d4f585907722cee2feb2b3a95ad4f9fd`;
Docker run `36495492035`, CI run `36495492106`). It was not deployed.

## Deploy

The owner force-updated the `1.3.3` container instead of switching to
`1.3.4`. His words: "why dont i just use force update like all the other
times".

After the update the container runs
`ghcr.io/marlin1111ai/marlin-cad:1.3.3` at
`sha256:4a802164bba1562475b631c7afc94daf98d04d7db53c54a433416d5fb569cb54`,
the build of `0fc0b75`, which contains `bf755c5`.

## Production check

The owner checked the mouse controls in production: "all good".

## Read from the dev box, 2026-09-28

Read from the public registry with an anonymous pull token, the way the
`1.3.4` release pass read it. Each value is the digest of the tag's image
index.

| Tag | Digest |
|---|---|
| `sha-0fc0b75` | `sha256:4a802164bba1562475b631c7afc94daf98d04d7db53c54a433416d5fb569cb54` |
| `1.3.3` | `sha256:4a802164bba1562475b631c7afc94daf98d04d7db53c54a433416d5fb569cb54` |
| `sha-586033e` | `sha256:d1c2c036e0eb6e29dd7d53dbe258b5bf24fa7f721f65c9bb9d6c9d5af146ae4d` |
| `sha-c9a4c6d` | `sha256:e3906a1e266949facd9fd88a6db9da48d4f585907722cee2feb2b3a95ad4f9fd` |
| `1.3.4` | `sha256:e3906a1e266949facd9fd88a6db9da48d4f585907722cee2feb2b3a95ad4f9fd` |

- `sha-0fc0b75` and `1.3.3` resolve to the same digest, and it is the digest
  the owner's container reports after the update.
- `bf755c5` is an ancestor of `0fc0b75` (`git merge-base --is-ancestor`), so
  the deployed build contains the viewport mouse controls change.
- `sha-586033e` still resolves to the digest the container ran before the
  update, so the rollback tag is the image that was running.

## Builder's notes, 2026-09-28

- **The `1.3.3` tag now stays where it is.** The Docker workflow re-points
  the tag named by `package.json` on every push to `main`. That version has
  been `1.3.4` since `c9a4c6d`, so later pushes move `1.3.4`, `latest` and
  `main`, and no longer move `1.3.3`. `0fc0b75` was the last push made at
  `1.3.3`.
- **The `1.3.4` tag will not stay at the digest above.** The push that
  carries this report is a push to `main` at version `1.3.4`, so it
  re-points `1.3.4` to its own build. `sha-c9a4c6d` keeps the digest in the
  Release section.
