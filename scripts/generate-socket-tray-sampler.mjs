// One-off generator for test-prints/socket-tray-sampler.stl -- the Socket
// Tray sampler coupon (6 round blind pockets at real measured diameters).
// See reference/socket-tray-sampler-report.md for why these specific
// numbers were chosen. Run with:
//
//   node --experimental-strip-types scripts/generate-socket-tray-sampler.mjs
//
// Pulls geometry from the real primitive module
// (apps/web/src/lib/socketTrayGeometry.ts) rather than reimplementing it, so
// the exported STL is exactly what the primitive produces -- same pattern as
// bake-multiconnect-slot.mjs producing data other code then reads. The STL
// coordinate convention (Y-up scene -> Z-up file) matches
// apps/web/src/lib/stlExport.ts's exportMeshesToStl exactly; duplicated here
// in a few lines rather than importing that file, since it pulls in the
// "@/lib/meshCoordinates" path alias this plain script (run directly via
// node, no bundler) doesn't resolve.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { socketTrayPositions } from "../apps/web/src/lib/socketTrayGeometry.ts";

const OUT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test-prints", "socket-tray-sampler.stl");

// Same 6 pockets as SAMPLER_POCKETS in tests/unit/socketTrayGeometry.test.ts
// -- keep both in sync if these numbers change. Pocket depth 14mm + 4mm
// floor = 18mm tray thickness (unchanged this pass -- see
// reference/socket-tray-sampler-report.md).
//
// Diameters are real measured socket ODs + 2mm clearance (not estimates),
// covering all 12 standard sockets 5-16mm via the sockets-per-pocket
// mapping in the report -- 14, 15, 19, 20.70, 23, 25mm, left to right.
//
// Going from 5 to 6 pockets at the previous 45mm pitch/30mm-margin layout
// would have needed a 285mm-wide tray (30 + 5*45 + 30), 29mm over the
// Bambu X1C's 256mm bed with zero spare margin. Pitch reduced to 36mm
// (margins unchanged at 30mm each side) instead: width = 30 + 5*36 + 30 =
// 240mm exactly, 16mm of spare under the 256mm bed. Every adjacent-pocket
// gap at 36mm pitch still clears the module's 4mm SOCKET_TRAY_POCKET_GAP
// minimum by a wide margin -- the tightest pair (23mm/25mm, the two
// largest) still has a 12mm gap.
const POCKETS = [
  { diameter: 14, depth: 14, x: 30, z: 30 },
  { diameter: 15, depth: 14, x: 66, z: 30 },
  { diameter: 19, depth: 14, x: 102, z: 30 },
  { diameter: 20.7, depth: 14, x: 138, z: 30 },
  { diameter: 23, depth: 14, x: 174, z: 30 },
  { diameter: 25, depth: 14, x: 210, z: 30 },
];

const positions = socketTrayPositions({ width: 240, depth: 60, thickness: 18, pockets: POCKETS });

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

const lines = ["solid socket_tray_sampler"];
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
lines.push("endsolid socket_tray_sampler");

writeFileSync(OUT_PATH, lines.join("\n") + "\n");
console.log(`Wrote ${OUT_PATH}: ${triangleCount} triangles`);
