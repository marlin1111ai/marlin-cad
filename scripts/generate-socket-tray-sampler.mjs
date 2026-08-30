// One-off generator for test-prints/socket-tray-sampler.stl -- the Socket
// Tray sampler coupon (5 round blind pockets at stepped diameters). See
// reference/socket-tray-sampler-report.md for why these specific numbers
// were chosen. Run with:
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

// Same 5 pockets as SAMPLER_POCKETS in tests/unit/socketTrayGeometry.test.ts
// -- keep both in sync if these numbers change.
const POCKETS = [
  { diameter: 15, depth: 20, x: 30, z: 30 },
  { diameter: 18, depth: 20, x: 75, z: 30 },
  { diameter: 22, depth: 20, x: 120, z: 30 },
  { diameter: 25, depth: 20, x: 165, z: 30 },
  { diameter: 28, depth: 20, x: 210, z: 30 },
];

const positions = socketTrayPositions({ width: 240, depth: 60, thickness: 24, pockets: POCKETS });

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
