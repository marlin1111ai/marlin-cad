// One-off generator for test-prints/label-fraction-test-piece.stl -- the
// fraction label test piece: a plain 3mm slab, no pockets, carrying six
// inch socket-size labels ("3/16" .. "1-1/16") twice, once RAISED 0.8mm and
// once RECESSED 0.8mm, in Helvetiker bold with digits 5mm tall and the
// module's own bold slash. It exists to be printed and checked for
// legibility before "/" and "-" are used on a Gridfinity tray
// (reference/DECISIONS.md, 2026-10-17). Run with:
//
//   node --experimental-strip-types scripts/generate-label-fraction-test-piece.mjs
//
// Optional arg: [outputPath]. With no args this reproduces the exact
// committed file.
//
// Same pattern as scripts/generate-label-test-piece.mjs: geometry, labels
// and slab size all come from apps/web/src/lib/labelSlabGeometry.ts
// (labelFractionTestPieceOptions(), which the unit tests read too). The STL
// coordinate convention (Y-up scene -> Z-up file) matches
// apps/web/src/lib/stlExport.ts exactly.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { labelFractionTestPieceOptions, labelSlabLayout, labelSlabPositions } from "../apps/web/src/lib/labelSlabGeometry.ts";

const OUT_PATH = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test-prints", "label-fraction-test-piece.stl");

// Layout, as read looking down at the bed (three rows of four):
//
//    3/16 raised |  3/16 recessed | 11/32 raised | 11/32 recessed
//     1/4 raised |   1/4 recessed |  9/16 raised |  9/16 recessed
//    5/16 raised |  5/16 recessed | 1-1/16 raised | 1-1/16 recessed
const OPTIONS = labelFractionTestPieceOptions();

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
