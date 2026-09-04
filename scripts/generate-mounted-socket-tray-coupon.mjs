// One-off generator for test-prints/mounted-socket-tray-coupon.stl -- the
// Mounted Socket Tray coupon: a Multiconnect slotted back plate (no pegs) with
// a 3-pocket tray projecting forward, as ONE solid. Run with:
//
//   node --experimental-strip-types scripts/generate-mounted-socket-tray-coupon.mjs
//
// Pulls geometry from the real primitive module
// (apps/web/src/lib/mountedSocketTrayGeometry.ts) rather than reimplementing
// it, so the exported STL is exactly what the primitive produces -- same
// pattern as generate-socket-tray-sampler.mjs. The STL coordinate convention
// (Y-up scene -> Z-up file) matches apps/web/src/lib/stlExport.ts exactly;
// duplicated here in a few lines rather than importing that file, since it
// pulls in the "@/lib/meshCoordinates" path alias this plain script (run
// directly via node, no bundler) doesn't resolve.
//
// This writes a NEW file. It does not touch socket-tray-sampler.stl or any of
// the six byte-identical wrench-rack STLs.

import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { register } from "node:module";

// Unlike socketTrayGeometry.ts, this primitive imports its shared constants
// and baked slot data through the app's "@/..." path alias (that is how it
// reuses the Multiconnect slot mesh instead of copy-pasting it). Plain node
// has no bundler to resolve that alias, so register a five-line resolve hook
// that maps "@/x" to apps/web/src/x. Inline as a data: URL rather than a
// second file on disk, and no dependency is added.
const SRC_ROOT = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "apps", "web", "src") + path.sep).href;
register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(specifier, context, nextResolve) {
        if (specifier.startsWith("@/")) {
          return nextResolve(${JSON.stringify(SRC_ROOT)} + specifier.slice(2) + ".ts", context);
        }
        return nextResolve(specifier, context);
      }
    `),
  import.meta.url,
);

const { mountedSocketTrayPositions } = await import("../apps/web/src/lib/mountedSocketTrayGeometry.ts");

const OUT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test-prints", "mounted-socket-tray-coupon.stl");

// Plate numbers are the physically validated wrench-rack recipe
// (apps/web/src/lib/multiconnectPresets.ts:29-42): 240 x 60mm, 10mm thick,
// 28mm slot spacing. 8 slots is floor(240 / 28), which centers the run at
// x = 22 .. 218 -- the same layout those printed plates use.
//
// Tray: 60mm of forward projection, 18mm thick, pockets 14mm deep over a 4mm
// floor (18 - 14 = 4, comfortably above the module's 2mm minimum).
//
// Three pockets only -- this is a coupon to check that the plate hangs, that
// the junction prints, and that a socket seats; it is NOT the production tray.
// Diameters 14 / 19 / 25mm are the smallest, a middle, and the largest from
// the flat sampler's measured set. End margins are 30mm, the same convention
// the flat coupon uses, so the pitch is (240 - 30 - 30) / 2 = 90mm and the
// centers land at 30 / 120 / 210. All three sit on the z = 30 tray centerline
// (tray depth 60 / 2).
//
// Footprint: 240mm in X by 70mm in Z (tray 60 + plate 10), 60mm tall. The
// 240mm span leaves 16mm spare under the Bambu X1C's 256mm bed.
//
// Keep these numbers in sync with COUPON in
// tests/unit/mountedSocketTrayGeometry.test.ts and
// DEFAULT_MOUNTED_SOCKET_TRAY_SHAPE_POCKETS in apps/web/src/lib/shapeCatalog.ts.
const OPTIONS = {
  plateWidth: 240,
  plateHeight: 60,
  plateThickness: 10,
  slotSpacing: 28,
  slotCount: 8,
  trayDepth: 60,
  trayThickness: 18,
  pocketDepth: 14,
  pockets: [
    { diameter: 14, x: 30, z: 30 },
    { diameter: 19, x: 120, z: 30 },
    { diameter: 25, x: 210, z: 30 },
  ],
};

const positions = mountedSocketTrayPositions(OPTIONS);

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

const lines = ["solid mounted_socket_tray_coupon"];
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
lines.push("endsolid mounted_socket_tray_coupon");

writeFileSync(OUT_PATH, lines.join("\n") + "\n");
console.log(`Wrote ${OUT_PATH}: ${triangleCount} triangles`);
