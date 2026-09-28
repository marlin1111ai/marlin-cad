# Gridfinity Socket Tray — deploy to Unraid, 2026-09-27

Recorded 2026-09-27 on the owner's word. Every step on Unraid was done by
the owner by hand; the dev box has no route to Unraid (DECISIONS.md), so
nothing below was observed from the dev box except the image digest, which
was read from the public registry.

## Pre-deploy backup

The owner copied `/mnt/user/appdata/marlin-cad/projects` to
`/mnt/user/appdata/marlin-cad/projects-backup-2026-09-27`. The source held
0 files and 0 bytes, so there was nothing to lose.

## Rollback tag

`ghcr.io/marlin1111ai/marlin-cad:sha-9e926bf`

## Deploy

The owner force-updated Unraid's `1.3.3` container to the image built from
`586033e`
(`sha256:d1c2c036e0eb6e29dd7d53dbe258b5bf24fa7f721f65c9bb9d6c9d5af146ae4d`),
then checked the Gridfinity Socket Tray in production: "all good updated
and checked".

## Print status

The tray is still unprinted.

**CORRECTED 2026-09-27:** later the same day the owner printed the
Gridfinity Socket Tray, the default insert, and reported "it prints and
works" (`reference/DECISIONS.md`).
