// One-off generator for test-prints/label-test-piece.stl -- the label test
// piece: a plain 3mm slab, no pockets, carrying every socket-size label
// ("5mm" .. "16mm") twice, once RAISED 0.8mm and once RECESSED 0.8mm, in
// Helvetiker bold with digits 5mm tall. It exists to be printed and checked
// for legibility before any Gridfinity tray is built on labels
// (reference/DECISIONS.md, 2026-09-27). Run with:
//
//   node --experimental-strip-types scripts/generate-label-test-piece.mjs
//
// Optional arg: [outputPath]. With no args this reproduces the exact
// committed file.
//
// Pulls geometry from the real primitive module
// (apps/web/src/lib/labelSlabGeometry.ts) rather than reimplementing it, so
// the exported STL is exactly what the primitive produces -- same pattern as
// generate-socket-tray-sampler.mjs. The labels, their order and the slab's
// size all come from that module's labelTestPieceOptions(), which the unit
// tests (tests/unit/labelSlabGeometry.test.ts) read too, so there is no
// second copy of the numbers here to keep in sync. The STL coordinate
// convention (Y-up scene -> Z-up file) matches apps/web/src/lib/stlExport.ts
// exactly; duplicated here in a few lines rather than importing that file,
// since it pulls in the "@/lib/meshCoordinates" path alias this plain script
// (run directly via node, no bundler) doesn't resolve.
//
// This writes a NEW file. It does not touch either socket coupon or any of
// the six byte-identical wrench-rack STLs.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { labelSlabLayout, labelSlabPositions, labelTestPieceOptions } from "../apps/web/src/lib/labelSlabGeometry.ts";

const OUT_PATH = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test-prints", "label-test-piece.stl");

// Layout, as read looking down at the bed (six rows of four):
//
//    5mm raised |  5mm recessed | 11mm raised | 11mm recessed
//    6mm raised |  6mm recessed | 12mm raised | 12mm recessed
//    ...
//   10mm raised | 10mm recessed | 16mm raised | 16mm recessed
//
// 3mm margin to the slab's edge and 3mm between neighbouring labels. The
// slab is sized from the labels: 87.44 x 51mm, 3mm thick, 3.8mm to the top
// of the raised labels -- far inside the Bambu X1C's 256mm bed.
const OPTIONS = labelTestPieceOptions();

const layout = labelSlabLayout(OPTIONS);
const positions = labelSlabPositions(OPTIONS);

function sketchForgeToZUp([x, y, z]) {
  return [x, -z, y];
}

function normalFor(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

const lines = ["solid label_test_piece"];
let triangleCount = 0;
for (let i = 0; i + 8 < positions.length; i += 9) {
  const a = sketchForgeToZUp([positions[i], positions[i + 1], positions[i + 2]]);
  const b = sketchForgeToZUp([positions[i + 3], positions[i + 4], positions[i + 5]]);
  const c = sketchForgeToZUp([positions[i + 6], positions[i + 7], positions[i + 8]]);
  const n = normalFor(a, b, c);
  lines.push(`  facet normal ${n[0]} ${n[1]} ${n[2]}`);
  lines.push("    outer loop");
  lines.push(`      vertex ${a[0]} ${a[1]} ${a[2]}`);
  lines.push(`      vertex ${b[0]} ${b[1]} ${b[2]}`);
  lines.push(`      vertex ${c[0]} ${c[1]} ${c[2]}`);
  lines.push("    endloop");
  lines.push("  endfacet");
  triangleCount += 1;
}
lines.push("endsolid label_test_piece");

writeFileSync(OUT_PATH, lines.join("\n") + "\n");
console.log(`Wrote ${OUT_PATH}: ${triangleCount} triangles, ${layout.labels.length} labels, slab ${layout.width} x ${layout.depth} x ${layout.thickness}mm`);
