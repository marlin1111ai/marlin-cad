# test-prints/

STL exports kept for the print-gating workflow in `CLAUDE.md`. Each file's
status is stated in its own section below: the validated reference files
and the printed test pieces have been physically printed and hand-verified;
the unvalidated samplers have not been printed.

## Validated reference files

The following six STLs are the physically validated exports for the
Multiconnect Wrench Racks presets (Metric 1-3, SAE 1-3). The Wrench Racks
presets in the insert panel must stay byte-identical to these exports —
any change to preset geometry that alters these outputs requires a new
print verification pass before merging.

- `wrench-rack-metric-1.stl`
- `wrench-rack-metric-2.stl`
- `wrench-rack-metric-3.stl`
- `wrench-rack-sae-1.stl`
- `wrench-rack-sae-2.stl`
- `wrench-rack-sae-3.stl`

## Printed test pieces

Printed and passed by the owner on 2026-09-27 (`reference/DECISIONS.md`).
Unit tests match each file byte for byte against its module's output.

- `label-test-piece.stl` — label test piece
  (`apps/web/src/lib/labelSlabGeometry.ts`, generator
  `scripts/generate-label-test-piece.mjs`), a plain slab, 87.44 x 51 x 3mm
  (3.8mm over the raised labels), carrying the labels "5mm" to "16mm" in
  Helvetiker bold, each once raised 0.8mm and once recessed 0.8mm; 24
  labels, 40,864 triangles. The owner reported "they all good".
- `gridfinity-foot-test-piece.stl` — Gridfinity foot test piece
  (`apps/web/src/lib/gridfinityFootGeometry.ts`, generator
  `scripts/generate-gridfinity-foot-test-piece.mjs`), 2 x 1 Gridfinity
  squares: two feet joined by a plain 3mm plate, 83.5 x 41.5 x 7.75mm,
  1,250 triangles, no holes and no labels. The owner checked it in his
  Gridfinity baseplate and reported "looks good".

## Unvalidated samplers

The following are NOT part of the byte-identical wrench-preset set above and
carry no such stability guarantee — they may be regenerated or replaced
freely as their primitives develop.

- `socket-tray-sampler.stl` — Socket Tray coupon
  (`apps/web/src/lib/socketTrayGeometry.ts`), 240 x 60 x 18mm, one row of 6
  round blind pockets at real measured diameters (14, 15, 19, 20.70, 23,
  25mm OD, all 14mm deep, 4mm floor), left to right in ascending size.
  **Partially unvalidated**: the diameters are real measured socket ODs
  plus a stated 2mm clearance (not estimates), but the 14mm pocket depth
  is still the foreman's estimate, not a measurement — the coupon exists
  to be printed and checked against real sockets, not to be trusted as
  correct. See `reference/socket-tray-sampler-report.md` for the full
  reasoning and open questions before treating any of these numbers as
  final.
- `mounted-socket-tray-coupon.stl` — Mounted Socket Tray coupon
  (`apps/web/src/lib/mountedSocketTrayGeometry.ts`, generator
  `scripts/generate-mounted-socket-tray-coupon.mjs`), 240 x 70 x 60mm: a
  Multiconnect slotted plate (240 x 60 x 10mm, 8 slots at 28mm spacing)
  with a tray 60mm deep and 18mm thick projecting from its bottom, carrying
  three round blind pockets 14mm deep over a 4mm floor; 3,524 triangles.
  Regenerated on 2026-09-06 with the pocket-X mirror fix, so as mounted the
  pockets read 14 / 19 / 25mm left to right. **Unprinted.**
- `socket-tray-sampler-rounded-demo.stl` — the Socket Tray coupon above at
  Corner Radius 3mm; 6,204 triangles. The radius was chosen for
  demonstration only; no radius has been print-validated. **Unprinted.**
- `mounted-socket-tray-coupon-rounded-demo.stl` — the Mounted Socket Tray
  coupon above at Corner Radius 3mm; 5,876 triangles. Regenerated on
  2026-09-06 with the pocket-X mirror fix. **Unprinted.**
