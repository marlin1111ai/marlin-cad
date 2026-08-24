// Bakes the Multiconnect slot "terminator" meshes into
// apps/web/src/lib/multiconnectSlotMesh.ts. Run with:
//
//   node scripts/bake-multiconnect-slot.mjs
//
// Geometry source: reference/multiconnect.scad (its multiconnectBack ->
// slotTool module), built here with the already-shipped manifold-3d wasm
// kernel instead of an OpenSCAD render -- the tool uses only plain
// revolve/extrude/cone primitives (no BOSL2), and Manifold's boolean output
// is manifold by construction, so no STL round-trip or Docker pipeline is
// needed (unlike reference/openconnect/README.md's bake).
//
// TODO(attribution): reference/multiconnect.scad was provided without a
// license header. Identify the upstream Multiconnect project + license and
// credit it here and in the generated file (repo practice: CC-BY credit
// headers, see openConnectSlotMesh.ts) before this feature ships.
//
// What is baked -- the "terminator": the fixed-shape TOP of the slot tool
// (revolved keyhole pocket + its 45-degree taper + the lock dimple), clipped
// so every continuous parameter stays out of the baked data:
//
// - Baked local frame (matches openConnectSlotMesh.ts conventions):
//   X = across the wall, Y = slide axis (+Y toward the dome / round top; the
//   channel continues toward -Y), Z = through-wall depth from the BLIND
//   FLOOR (0) toward the mounting face. The SCAD pins the blind floor
//   2.35mm from the container-side face of the fixed 6.5mm back
//   (slotDepthMicroadjustment pinned at 0 per owner decision), so the cut
//   spans depth 0..4.15 and the mesh is pre-trimmed at depth 4.15 -- the
//   flat face at Z=4.15 is the mouth cap phase 2 discards when holing the
//   mounting-face cap.
// - Clip plane at slide Y = -2 (MULTICONNECT_TERMINATOR_CLIP_Y): the dimple
//   cone straddles the round-top center (plan radius 1.5 about Y=0), so
//   clipping at Y=0 would leave a half-crater in the clip cross-section.
//   -2 sits below the dimple's reach, where BOTH variants' cross-section is
//   exactly the depth-capped keyhole outline (MULTICONNECT_CHANNEL_OUTLINE)
//   -- the stitch outline phase 2's straight channel extrusion continues
//   from with shared vertex coordinates.
// - Two variants: WITH_DIMPLE (default; the dimple cone is subtracted from
//   the tool, so the printed part keeps a lock bump on the blind floor) and
//   NO_DIMPLE (the SCAD's slotQuickRelease=true). dimpleScale pinned at 1.0,
//   slotTolerance applied at runtime (uniform scale), not baked.
//
// Robustness notes (lessons from the openGrid Snap bake, see
// openGridSnapMesh.ts):
// - The dimple cutter gets a 0.5mm cylindrical skirt below the blind floor
//   so its own base cap is not coplanar with the tool's deep face (the
//   subtraction crosses the face with side-wall surface instead of a
//   flush cap).
// - Output vertices are Float32Array (~1e-6 noise); quantizing to 1e-4
//   doubles as the weld pass -- vertices are welded by rounded position,
//   degenerate triangles dropped, and the result is verified (watertight
//   edge counts, exact clip-plane cross-section) before the file is
//   written. The bake fails loudly instead of emitting bad data.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import manifoldModule from "manifold-3d";

const OUT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "apps", "web", "src", "lib", "multiconnectSlotMesh.ts");

const FN = 50; // matches the SCAD's $fn=50 for both rotate_extrudes

// reference/multiconnect.scad slotProfile, as (radius, depth-from-blind-floor):
// head recess r=10.15 for the deepest 1.2121mm, 45-degree taper to the
// r=7.65 neck, neck out to depth 5 (the tool overshoots the mounting face).
const SLOT_PROFILE = [[0, 0], [10.15, 0], [10.15, 1.2121], [7.65, 3.712], [7.65, 5], [0, 5]];
const HEAD_RADIUS = 10.15;
const NECK_RADIUS = 7.65;
// Back is a fixed 6.5mm thick; blind floor sits 2.35mm from the
// container-side face => the cut reaches 6.5 - 2.35 = 4.15mm deep.
const CUT_DEPTH = 4.15;
const CLIP_Y = -2;
const DIMPLE_RADIUS = 1.5;
const DIMPLE_HEIGHT = 1.5;
const QUANTUM = 1e-4;

// Full keyhole cross-section (profile + X mirror) in (across, depth), CCW.
// Depth-capped at CUT_DEPTH -- this is the exact cross-section at the clip
// plane and the outline phase 2 stitches the straight channel from.
const CHANNEL_OUTLINE = [
  [HEAD_RADIUS, 0],
  [HEAD_RADIUS, 1.2121],
  [NECK_RADIUS, 3.712],
  [NECK_RADIUS, CUT_DEPTH],
  [-NECK_RADIUS, CUT_DEPTH],
  [-NECK_RADIUS, 3.712],
  [-HEAD_RADIUS, 1.2121],
  [-HEAD_RADIUS, 0],
];

const runtime = await manifoldModule();
runtime.setup();
const { Manifold, CrossSection } = runtime;

function buildTerminator(withDimple) {
  const disposables = [];
  const track = (value) => {
    disposables.push(value);
    return value;
  };
  try {
    // Revolved keyhole pocket: profile (x=radius, y=depth) spun about the
    // profile's Y axis; the solid's Z is the through-wall depth, its XY
    // plane is (across, slide) -- already the baked frame.
    const pocket = track(Manifold.revolve([SLOT_PROFILE], FN));

    // Slide channel top: the keyhole cross-section (across, depth-to-5,
    // untrimmed -- the clip box below applies the 4.15 cap) extruded 6mm,
    // then rotated +90deg about X so the extrusion runs down -Y (slide) and
    // the polygon's depth coordinate becomes +Z. The revolve's own lower
    // half is a strict subset of this prism (the profile's depth extent
    // shrinks as radius grows), so the union seam is only the Y=0 plane.
    const channelSection = [
      [HEAD_RADIUS, 0],
      [HEAD_RADIUS, 1.2121],
      [NECK_RADIUS, 3.712],
      [NECK_RADIUS, 5],
      [-NECK_RADIUS, 5],
      [-NECK_RADIUS, 3.712],
      [-HEAD_RADIUS, 1.2121],
      [-HEAD_RADIUS, 0],
    ];
    const channel = track(track(Manifold.extrude([channelSection], 6)).rotate([90, 0, 0]));

    const union = track(Manifold.union(pocket, channel));

    // One box applies both trims: slide >= CLIP_Y and depth <= CUT_DEPTH.
    // The box's other faces sit strictly outside the tool (no coincident
    // surfaces).
    const clipBox = track(track(Manifold.cube([24, 14.5, CUT_DEPTH + 1])).translate([-12, CLIP_Y, -1]));
    const clipped = track(union.intersect(clipBox));

    if (!withDimple) return clipped.getMesh();

    // Lock dimple cutter: 45-degree cone (r/h 1.5) on the blind floor at the
    // round-top center, with a 0.5mm skirt below depth 0 so the subtraction
    // never runs a cutter cap coplanar with the tool's own deep face.
    const dimple = track(Manifold.revolve([[[0, -0.5], [DIMPLE_RADIUS, -0.5], [DIMPLE_RADIUS, 0], [0, DIMPLE_HEIGHT]]], FN));
    return track(clipped.subtract(dimple)).getMesh();
  } finally {
    disposables.reverse().forEach((value) => value.delete?.());
  }
}

function quantize(value) {
  const rounded = Math.round(value / QUANTUM) * QUANTUM;
  return rounded === 0 ? 0 : Number(rounded.toFixed(4));
}

// Weld by quantized position (the float32 noise floor is ~1e-6, real
// feature spacing >= ~0.19mm -- the dimple's 50-gon rim), then drop any
// triangle the weld degenerated.
function weldAndClean(mesh, label) {
  const byKey = new Map();
  const vertexRemap = new Array(mesh.vertProperties.length / 3);
  const positions = [];
  for (let i = 0; i * 3 < mesh.vertProperties.length; i += 1) {
    const x = quantize(mesh.vertProperties[i * 3]);
    const y = quantize(mesh.vertProperties[i * 3 + 1]);
    const z = quantize(mesh.vertProperties[i * 3 + 2]);
    const key = `${x},${y},${z}`;
    let index = byKey.get(key);
    if (index === undefined) {
      index = positions.length / 3;
      byKey.set(key, index);
      positions.push(x, y, z);
    }
    vertexRemap[i] = index;
  }
  const welds = mesh.vertProperties.length / 3 - positions.length / 3;

  const indices = [];
  let degenerate = 0;
  for (let i = 0; i + 2 < mesh.triVerts.length; i += 3) {
    const a = vertexRemap[mesh.triVerts[i]];
    const b = vertexRemap[mesh.triVerts[i + 1]];
    const c = vertexRemap[mesh.triVerts[i + 2]];
    if (a === b || b === c || a === c) {
      degenerate += 1;
      continue;
    }
    indices.push(a, b, c);
  }
  console.log(`${label}: ${positions.length / 3} vertices (${welds} welded), ${indices.length / 3} triangles (${degenerate} degenerate dropped)`);
  return { positions, indices };
}

function assertWatertight({ positions, indices }, label) {
  const directed = new Map();
  for (let i = 0; i + 2 < indices.length; i += 3) {
    for (const [a, b] of [[indices[i], indices[i + 1]], [indices[i + 1], indices[i + 2]], [indices[i + 2], indices[i]]]) {
      directed.set(`${a}>${b}`, (directed.get(`${a}>${b}`) ?? 0) + 1);
    }
  }
  let boundary = 0;
  let nonManifold = 0;
  for (const [key, count] of directed) {
    const [a, b] = key.split(">");
    const opposite = directed.get(`${b}>${a}`) ?? 0;
    if (count !== 1) nonManifold += 1;
    else if (opposite !== 1) boundary += 1;
  }
  if (boundary !== 0 || nonManifold !== 0) {
    throw new Error(`${label}: not watertight after weld (${boundary} boundary, ${nonManifold} non-manifold directed edges)`);
  }
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      box[axis] = Math.min(box[axis], positions[i + axis]);
      box[axis + 3] = Math.max(box[axis + 3], positions[i + axis]);
    }
  }
  console.log(`${label}: watertight; bbox x[${box[0]}, ${box[3]}] y[${box[1]}, ${box[4]}] z[${box[2]}, ${box[5]}]`);
}

function assertClipCrossSection({ positions }, label) {
  const found = new Set();
  for (let i = 0; i + 2 < positions.length; i += 3) {
    if (positions[i + 1] === CLIP_Y) found.add(`${positions[i]},${positions[i + 2]}`);
  }
  const expected = new Set(CHANNEL_OUTLINE.map(([across, depth]) => `${across},${depth}`));
  const extra = [...found].filter((key) => !expected.has(key));
  const missing = [...expected].filter((key) => !found.has(key));
  if (extra.length > 0 || missing.length > 0) {
    throw new Error(`${label}: clip-plane cross-section mismatch (missing: ${missing.join(" ")} extra: ${extra.join(" ")})`);
  }
  console.log(`${label}: clip plane carries exactly the ${CHANNEL_OUTLINE.length} channel-outline vertices`);
}

function sliverReport({ positions, indices }, label) {
  let minArea = Infinity;
  let slivers = 0;
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const p = (index, axis) => positions[indices[i + index] * 3 + axis];
    const ux = p(1, 0) - p(0, 0);
    const uy = p(1, 1) - p(0, 1);
    const uz = p(1, 2) - p(0, 2);
    const vx = p(2, 0) - p(0, 0);
    const vy = p(2, 1) - p(0, 1);
    const vz = p(2, 2) - p(0, 2);
    const area = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    minArea = Math.min(minArea, area);
    if (area < 1e-3) slivers += 1;
  }
  console.log(`${label}: min triangle area ${minArea.toExponential(3)} mm^2, ${slivers} triangles under 1e-3 mm^2`);
}

function formatNumbers(values, perLine) {
  const lines = [];
  for (let i = 0; i < values.length; i += perLine) {
    lines.push(`  ${values.slice(i, i + perLine).join(", ")},`);
  }
  return lines.join("\n");
}

const withDimple = weldAndClean(buildTerminator(true), "WITH_DIMPLE");
const noDimple = weldAndClean(buildTerminator(false), "NO_DIMPLE");
for (const [mesh, label] of [[withDimple, "WITH_DIMPLE"], [noDimple, "NO_DIMPLE"]]) {
  assertWatertight(mesh, label);
  assertClipCrossSection(mesh, label);
  sliverReport(mesh, label);
}

const file = `// Generated data -- run \`node scripts/bake-multiconnect-slot.mjs\` to
// regenerate; see that script's header for the full geometry derivation.
// Source geometry: reference/multiconnect.scad's slotTool module.
//
// TODO(attribution): reference/multiconnect.scad was provided without a
// license header. Identify the upstream Multiconnect project + license and
// credit it here (repo practice: CC-BY credit headers, see
// openConnectSlotMesh.ts) before this feature ships.
//
// Multiconnect slot "terminator": the fixed-shape top of the slot cutout
// tool (revolved keyhole pocket + 45-degree taper + lock dimple crater),
// clipped at slide Y = MULTICONNECT_TERMINATOR_CLIP_Y where both variants'
// cross-section is exactly MULTICONNECT_CHANNEL_OUTLINE -- the stitch
// outline the straight slide-channel extrusion continues from. Local frame:
// X = across the wall, Y = slide axis (+Y toward the round top; the channel
// continues toward -Y), Z = through-wall depth from the blind floor (0)
// toward the mounting face (pre-trimmed at MULTICONNECT_SLOT_CUT_DEPTH; the
// flat cap there is the mouth phase-2 opens through the mounting face).
// This is a BLIND cutter: the printed part must keep solid material behind
// the Z=0 face (the opposite requirement from the openConnect slot).
// WITH_DIMPLE is the default (the crater in the Z=0 face leaves a lock bump
// on the printed blind floor); NO_DIMPLE is the SCAD's slotQuickRelease.
// Both confirmed watertight/manifold in isolation at bake time and again in
// tests/unit/multiconnectSlotMesh.test.ts.

export const MULTICONNECT_HEAD_RADIUS = ${HEAD_RADIUS};
export const MULTICONNECT_NECK_RADIUS = ${NECK_RADIUS};
// Depth of the blind cut: the fixed 6.5mm back minus the 2.35mm kept
// between the blind floor and the container-side face.
export const MULTICONNECT_SLOT_CUT_DEPTH = ${CUT_DEPTH};
export const MULTICONNECT_TERMINATOR_CLIP_Y = ${CLIP_Y};
export const MULTICONNECT_DIMPLE_RADIUS = ${DIMPLE_RADIUS};
export const MULTICONNECT_DIMPLE_HEIGHT = ${DIMPLE_HEIGHT};

// Slide-channel cross-section in (across, depth), CCW: the SCAD keyhole
// profile mirrored about X and depth-capped at MULTICONNECT_SLOT_CUT_DEPTH.
// These exact values appear verbatim as baked vertex coordinates on the
// clip plane -- phase 2 must reuse them unmodified as stitch points.
export const MULTICONNECT_CHANNEL_OUTLINE: readonly (readonly [number, number])[] = [
${CHANNEL_OUTLINE.map(([across, depth]) => `  [${across}, ${depth}],`).join("\n")}
];

export const MULTICONNECT_TERMINATOR_WITH_DIMPLE_POSITIONS: number[] = [
${formatNumbers(withDimple.positions, 3)}
];

export const MULTICONNECT_TERMINATOR_WITH_DIMPLE_INDICES: number[] = [
${formatNumbers(withDimple.indices, 3)}
];

export const MULTICONNECT_TERMINATOR_NO_DIMPLE_POSITIONS: number[] = [
${formatNumbers(noDimple.positions, 3)}
];

export const MULTICONNECT_TERMINATOR_NO_DIMPLE_INDICES: number[] = [
${formatNumbers(noDimple.indices, 3)}
];
`;

writeFileSync(OUT_PATH, file, "utf8");
console.log(`wrote ${OUT_PATH} (${file.length} bytes)`);
