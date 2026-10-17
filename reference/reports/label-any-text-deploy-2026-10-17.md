# Labels take any keyboard text — deploy to Unraid, 2026-10-17

Recorded 2026-10-17 on the owner's word. The owner did the update on
Unraid by hand. The dev box has no route to Unraid (DECISIONS.md), so it
observed nothing there. The image digests below were read from the public
registry.

## What this deploys

`4648fe0` ("Let labels be whatever is typed on the keyboard"): a Gridfinity
Socket Tray hole's label is whatever is typed, with capitals, spaces and
punctuation kept. Characters off the keyboard (emoji, accented letters) are
dropped. Letters that reach outside the digit band widen that label's box
(DECISIONS.md, 2026-10-17).

## Checks before the update

- GitHub Actions on `4648fe0`: CI succeeded; "Build and Push Docker Images"
  succeeded.
- Registry, read after the owner's report: `1.3.4` and `sha-4648fe0` both
  resolve to
  `sha256:19dfb03dee370b3f7977d8577771c3b7b76d4b8d85835b554cf8af8fd71b7990`.
- The owner did not check the change in the dev app first.

## Update

The owner force-updated the container on its `1.3.4` tag and reported
"docker updated and working". No pre-deploy backup was recorded for this
update.

## Rollback

`ghcr.io/marlin1111ai/marlin-cad:sha-5132034`
(`sha256:792f027b17a28e9b9a4ed66fe6e4a07fe4d7f1ea1483fd301d2af13f29bb791c`),
the build the container ran earlier on 2026-10-17 until this update. The
`b9e47d3` build in between was notes only and was never deployed.

## Still open

No label with letters or punctuation has been printed, and the fraction
label test piece is unprinted (OPEN-ITEMS.md).
