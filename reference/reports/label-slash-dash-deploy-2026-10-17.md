# Label "/" and "-" — deploy to Unraid, 2026-10-17

Recorded 2026-10-17 on the owner's word. The update on Unraid was done by
the owner by hand; the dev box has no route to Unraid (DECISIONS.md), so
nothing on Unraid was observed from the dev box. The image digests below
were read from the public registry.

## What this deploys

`5132034` ("Let labels use "-" and "/" for inch sizes like 3/16"): label
text on the Gridfinity Socket Tray accepts "-" and "/", the "/" being the
label module's own bold slash (DECISIONS.md, 2026-10-17). It also adds the
unprinted fraction label test piece, `test-prints/label-fraction-test-piece.stl`.

## Checks before the update

- The owner checked the change in the dev app (http://192.168.1.245:3000):
  "all good".
- GitHub Actions on `5132034`: CI succeeded; "Build and Push Docker Images"
  succeeded.
- Registry, read after the build: `1.3.4` and `sha-5132034` both resolve to
  `sha256:792f027b17a28e9b9a4ed66fe6e4a07fe4d7f1ea1483fd301d2af13f29bb791c`.

## Update

The owner force-updated the container on its `1.3.4` tag and reported
"all good works". No pre-deploy backup was recorded for this update.

## Rollback

`ghcr.io/marlin1111ai/marlin-cad:sha-d80e102`
(`sha256:f7d1836999c4d7ae1fce3e767d1017970463d629163c9ec7f81704f01f6e182b`),
the build the container ran from 2026-09-29 until this update. In the chat
the builder first named `sha-c4f71ac` as the rollback tag; that is a later
notes-only build (`sha256:ee2f389870b3cd9d5141ab0ed278987c97ac92a560003644a93b62fff5f1dcde`)
that was never recorded as deployed, so `sha-d80e102` is the one recorded here.

## Still open

The fraction label test piece is unprinted (OPEN-ITEMS.md).
