// One-off generator for test-prints/gridfinity-foot-test-piece.stl -- the
// Gridfinity foot test piece: 2 x 1 Gridfinity squares, two feet joined by a
// plain flat 3mm plate, no holes and no labels. It exists to be printed and
// checked in the owner's baseplate before the Gridfinity labeled socket tray
// is built on this foot (reference/DECISIONS.md, 2026-09-27). Run with:
//
//   node --experimental-strip-types scripts/generate-gridfinity-foot-test-piece.mjs
//
// Optional arg: [outputPath]. With no args this reproduces the exact
// committed file.
//
// Pulls geometry from the real primitive module
// (apps/web/src/lib/gridfinityFootGeometry.ts) rather than reimplementing
// it, so the exported STL is exactly what the primitive produces -- same
// pattern as generate-socket-tray-sampler.mjs. The grid size and the plate
// thickness come from that module's gridfinityFootTestPieceOptions(), which
// the unit tests (tests/unit/gridfinityFootGeometry.test.ts) read too, so
// there is no second copy of the numbers here to keep in sync. The STL
// coordinate convention (Y-up scene -> Z-up file) matches
// apps/web/src/lib/stlExport.ts exactly; duplicated here in a few lines
// rather than importing that file, since it pulls in the
// "@/lib/meshCoordinates" path alias this plain script (run directly via
// node, no bundler) doesn't resolve.
//
// This writes a NEW file. It does not touch either socket coupon, the label
// test piece or any of the six byte-identical wrench-rack STLs.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { gridfinityFootDimensions, gridfinityFootPositions, gridfinityFootTestPieceOptions } from "../apps/web/src/lib/gridfinityFootGeometry.ts";

const OUT_PATH = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test-prints", "gridfinity-foot-test-piece.stl");

// 83.5 x 41.5mm in plan and 7.75mm tall (4.75mm of foot under a 3mm plate)
// -- far inside the Bambu X1C's 256mm bed. It sits on the bed on its feet.
const OPTIONS = gridfinityFootTestPieceOptions();

const dimensions = gridfinityFootDimensions(OPTIONS);
const positions = gridfinityFootPositions(OPTIONS);

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

const lines = ["solid gridfinity_foot_test_piece"];
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
lines.push("endsolid gridfinity_foot_test_piece");

writeFileSync(OUT_PATH, lines.join("\n") + "\n");
console.log(
  `Wrote ${OUT_PATH}: ${triangleCount} triangles, ${dimensions.squaresX} x ${dimensions.squaresZ} squares, ${dimensions.width} x ${dimensions.depth} x ${dimensions.height}mm, plate ${dimensions.plateThickness}mm`,
);
