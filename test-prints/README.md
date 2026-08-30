# test-prints/

Physically-printed and hand-verified STL exports, banked as references per
the print-gating workflow in `CLAUDE.md`.

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
