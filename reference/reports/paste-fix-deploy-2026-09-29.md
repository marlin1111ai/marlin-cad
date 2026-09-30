# Paste fix — deploy to Unraid, 2026-09-29

Recorded 2026-09-29 on the owner's word. Every step on Unraid was done by
the owner by hand; the dev box has no route to Unraid (DECISIONS.md), so
nothing on Unraid was observed from the dev box. The only things read from
the dev box are the image digests, from the public registry, and the repo's
own history.

## What this deploys

The paste fix: `877951f` ("Keep a shape's own fields when it is pasted")
and its notebook entry, `d80e102`. Before it, a pasted shape lost every
field `sceneShape` does not keep, so a pasted Gridfinity Socket Tray came
out bare; see `reference/KNOWN-FIXES.md`. The deployed build is the build
of `d80e102`, which contains `877951f`.

## Pre-deploy backup

Run by the owner in Unraid's web terminal before the update.

| | Path | Files | Bytes |
|---|---|---|---|
| Source | `/mnt/user/appdata/marlin-cad/projects` | 0 | 0 |
| Copy | `/mnt/user/appdata/marlin-cad/projects-backup-2026-09-29` | 0 | 0 |
| Thumbnails | copied out of the container from `/app/apps/web/.codex/project-thumbnails` to `/mnt/user/appdata/marlin-cad/thumbnails-backup-2026-09-29` | 3 | 3338663 |

3 files were counted in the container. The thumbnails' sha256:

```
6037949e3fa6972de65cf07744f76b64157e46224cc0cd676cb4416d090c89f4  ./project-mukkjwoq-1-p48we9zz.png
761a9773f0571c31e3cf746b511ec1c44c29e5f23892a5a8ed500e69ae10e94d  ./project-muluxs9z-1-n1vdzees.png
4a274568019855df4793b72e89c94bfc09a7b6daa3dc44f6833ed102dc0e817f  ./project-mum3cu5w-4-rjbumtnl.png
```

## Running before the update

`ghcr.io/marlin1111ai/marlin-cad:1.3.3`

- Image id: `sha256:a77bf51ea41640908595bca027475d7d1e8c3d9aa0e57016202673407c366084`
- Repo digest: `sha256:4a802164bba1562475b631c7afc94daf98d04d7db53c54a433416d5fb569cb54`

## Rollback tag

Named before the update: `ghcr.io/marlin1111ai/marlin-cad:sha-0fc0b75`.

## Update

The one-time tag switch. The owner changed the container's Repository from
`1.3.3` to `1.3.4` in the Unraid Docker tab and applied. Unraid pulled
`1.3.4` ("Downloaded newer image", 46 MB), stopped and removed the
container, and recreated it:

```
-p '3001:3000/tcp'
-v '/mnt/user/appdata/marlin-cad/projects':'/data/projects':'rw'
'ghcr.io/marlin1111ai/marlin-cad:1.3.4'
```

Unraid: "The command finished successfully!".

## Running after the update

`ghcr.io/marlin1111ai/marlin-cad:1.3.4`

- Image id: `sha256:2ec979a2c8b1d64b7667b99ccf3db6369362c0a3ed93b1c63274606ce4e201bf`
- Repo digest: `sha256:f7d1836999c4d7ae1fce3e767d1017970463d629163c9ec7f81704f01f6e182b`

## Production check

- Projects still listed: "i have all my stuff".
- The paste fix: "all good copy paste all the same".
- **Added 2026-09-29:** the project cards still show their pictures after
  the update: "thet good".

## Read from the dev box, 2026-09-29

Read from the public registry (`ghcr.io`) with an anonymous pull token.
Each value is the `docker-content-digest` of the tag's image index, and
hashing the returned index body gives the same value. All 51 tags in the
repository were read.

| Tag | Digest |
|---|---|
| `sha-d80e102` | `sha256:f7d1836999c4d7ae1fce3e767d1017970463d629163c9ec7f81704f01f6e182b` |
| `1.3.4` | `sha256:f7d1836999c4d7ae1fce3e767d1017970463d629163c9ec7f81704f01f6e182b` |
| `latest` | `sha256:f7d1836999c4d7ae1fce3e767d1017970463d629163c9ec7f81704f01f6e182b` |
| `main` | `sha256:f7d1836999c4d7ae1fce3e767d1017970463d629163c9ec7f81704f01f6e182b` |
| `sha-0fc0b75` | `sha256:4a802164bba1562475b631c7afc94daf98d04d7db53c54a433416d5fb569cb54` |
| `1.3.3` | `sha256:4a802164bba1562475b631c7afc94daf98d04d7db53c54a433416d5fb569cb54` |

- `sha-d80e102` is the only `sha-<short>` tag that resolves to the digest
  the owner's container reports after the update. The deployed build is
  the build of `d80e102`.
- `877951f` is an ancestor of `d80e102` (`git merge-base --is-ancestor`),
  so the deployed build contains the paste fix.
- `sha-0fc0b75` resolves to the digest the container ran before the
  update, so the rollback tag is the image that was running.
- Between `0fc0b75` and `d80e102` the only changes outside `reference/`
  are `877951f` (one line in
  `apps/web/src/components/SketchForgeEditor.tsx`) and the version bump to
  `1.3.4` in `c9a4c6d` (`package.json`, `package-lock.json`).

## Builder's notes, 2026-09-29

- **The `1.3.4` tag will not stay at the digest above.** The push that
  carries this report is a push to `main` at version `1.3.4`, so it
  re-points `1.3.4`, `latest` and `main` to its own build.
  `sha-d80e102` keeps the digest above. That later build differs from the
  deployed one only in `reference/`.
