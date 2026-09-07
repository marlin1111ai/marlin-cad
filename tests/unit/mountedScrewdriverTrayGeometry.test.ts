import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createMountedScrewdriverTrayGeometry,
  mountedScrewdriverTrayDimensions,
  mountedScrewdriverTrayPositions,
  mountedScrewdriverTraySlotCenters,
  normalizeMountedScrewdriverTrayPlateThickness,
  normalizeMountedScrewdriverTrayThickness,
  type MountedScrewdriverTrayHole,
  type MountedScrewdriverTrayOptions,
} from "@/lib/mountedScrewdriverTrayGeometry";
import { MULTICONNECT_BACK_THICKNESS, MULTICONNECT_SLOT_TOP_OFFSET } from "@/lib/multiconnectContainerGeometry";
import { MULTICONNECT_SLOT_CUT_DEPTH, MULTICONNECT_TERMINATOR_CLIP_Y } from "@/lib/multiconnectSlotMesh";
import { MIN_SCREWDRIVER_TRAY_THICKNESS } from "@/lib/screwdriverTrayGeometry";
import { analyzeTriangleSoup } from "@/lib/svgImport";

// The default insert this suite pins. Plate numbers are the validated
// wrench-rack recipe: 240 x 60 x 10mm at 28mm slot spacing, 8 slots. Tray 60mm
// deep, 18mm thick. Three THROUGH-bores at 8 / 10 / 12mm, 30mm end margins,
// 90mm pitch, on the z = 30 centreline. The diameters are deliberate GENERIC
// PLACEHOLDERS chosen by the owner, not measured shafts.
const PLATE_WIDTH = 240;
const PLATE_HEIGHT = 60;
const PLATE_THICKNESS = 10;
const SLOT_SPACING = 28;
const SLOT_COUNT = 8;
const TRAY_DEPTH = 60;
const TRAY_THICKNESS = 18;

const DEFAULT_HOLES: MountedScrewdriverTrayHole[] = [
  { diameter: 8, x: 30, z: 30 },
  { diameter: 10, x: 120, z: 30 },
  { diameter: 12, x: 210, z: 30 },
];
const COUPON: MountedScrewdriverTrayOptions = {
  plateWidth: PLATE_WIDTH,
  plateHeight: PLATE_HEIGHT,
  plateThickness: PLATE_THICKNESS,
  slotSpacing: SLOT_SPACING,
  slotCount: SLOT_COUNT,
  trayDepth: TRAY_DEPTH,
  trayThickness: TRAY_THICKNESS,
  holes: DEFAULT_HOLES,
};

// Bore x is specified in AS-MOUNTED VIEW SPACE and mirrored into geometry space
// by the module (normalizedHoles: x_geometry = plateWidth - x_viewed), the same
// convention the Multiconnect PegPlate and the Mounted Socket Tray use -- see
// the MOUNTED-VIEW X CONVENTION block in mountedScrewdriverTrayGeometry.ts.
// Every raycast below is aimed in GEOMETRY space, so it goes through this
// converter rather than using a bore's viewed x directly.
const geometryX = (viewedX: number) => PLATE_WIDTH - viewedX;

// A deliberately ASYMMETRIC layout. The default insert above cannot prove the
// mirror: 30 / 120 / 210 viewed maps onto 210 / 120 / 30 in geometry, the same
// SET of x positions, so a missing or a doubled mirror would look identical
// except for which diameter landed where. This layout has no such symmetry --
// no two bores share an x or a z, and no bore sits at another's mirror image --
// so the mirror is pinned positionally, not just by diameter. That matters
// because the Mounted Socket Tray shipped with exactly this bug and it was
// invisible to every geometry check (KNOWN-FIXES.md).
const ASYMMETRIC_HOLES: MountedScrewdriverTrayHole[] = [
  { diameter: 8, x: 40, z: 20 },
  { diameter: 10, x: 95, z: 30 },
  { diameter: 12, x: 160, z: 42 },
];
const ASYMMETRIC: MountedScrewdriverTrayOptions = { ...COUPON, holes: ASYMMETRIC_HOLES };

// Derived planes, recomputed here from the same rules the module uses rather
// than copied as literals.
const MOUNTING_FACE_Z = TRAY_DEPTH + PLATE_THICKNESS; // 70
const BLIND_FLOOR_Z = MOUNTING_FACE_Z - MULTICONNECT_SLOT_CUT_DEPTH; // 65.85
const PLATE_FRONT_Z = TRAY_DEPTH; // 60
const SLOT_TOP_CENTER_Y = PLATE_HEIGHT - MULTICONNECT_SLOT_TOP_OFFSET; // 47
const CHANNEL_TOP_Y = SLOT_TOP_CENTER_Y + MULTICONNECT_TERMINATOR_CLIP_Y; // 45

// Converts a raw positions array to ASCII STL text (scene [x, y, z] -> file
// [x, -z, y], same convention as stlExport.ts) and parses that TEXT back into
// scene coordinates -- an actual STL round-trip, not a re-use of the in-memory
// geometry, per KNOWN-FIXES.md's "raycast the exported STL".
function toStlText(positions: readonly number[]): string {
  const lines = ["solid mounted_screwdriver_tray_test"];
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const toZUp = (x: number, y: number, z: number) => [x, -z, y] as const;
    const a = toZUp(positions[i], positions[i + 1], positions[i + 2]);
    const b = toZUp(positions[i + 3], positions[i + 4], positions[i + 5]);
    const c = toZUp(positions[i + 6], positions[i + 7], positions[i + 8]);
    lines.push("  facet normal 0 0 0", "    outer loop", `      vertex ${a[0]} ${a[1]} ${a[2]}`, `      vertex ${b[0]} ${b[1]} ${b[2]}`, `      vertex ${c[0]} ${c[1]} ${c[2]}`, "    endloop", "  endfacet");
  }
  lines.push("endsolid mounted_screwdriver_tray_test");
  return lines.join("\n");
}

function parseStlToScenePositions(stl: string): number[] {
  const positions: number[] = [];
  const vertexPattern = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = vertexPattern.exec(stl))) {
    positions.push(Number(match[1]), Number(match[3]), -Number(match[2]));
  }
  return positions;
}

// Ray along Y at fixed (x, z): the Y heights where material boundaries are
// crossed. A sealed-shut bore is still a perfectly valid closed solid
// (CLAUDE-LESSONS.md), so topology checks cannot see it; raycast instead.
function verticalCrossingsFromPositions(positions: readonly number[], x: number, z: number): number[] {
  const crossings: number[] = [];
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const p0: [number, number, number] = [positions[i], positions[i + 1], positions[i + 2]];
    const p1: [number, number, number] = [positions[i + 3], positions[i + 4], positions[i + 5]];
    const p2: [number, number, number] = [positions[i + 6], positions[i + 7], positions[i + 8]];
    const denom = (p1[2] - p2[2]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[2] - p2[2]);
    if (Math.abs(denom) < 1e-9) continue;
    const a = ((p1[2] - p2[2]) * (x - p2[0]) + (p2[0] - p1[0]) * (z - p2[2])) / denom;
    const b = ((p2[2] - p0[2]) * (x - p2[0]) + (p0[0] - p2[0]) * (z - p2[2])) / denom;
    const c = 1 - a - b;
    if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
    crossings.push(a * p0[1] + b * p1[1] + c * p2[1]);
  }
  crossings.sort((m, n) => m - n);
  const merged: number[] = [];
  for (const y of crossings) {
    if (merged.length === 0 || Math.abs(y - merged[merged.length - 1]) > 1e-6) merged.push(y);
  }
  return merged;
}

function verticalCrossings(geometry: THREE.BufferGeometry, x: number, z: number): number[] {
  const position = geometry.getAttribute("position");
  const positions: number[] = [];
  for (let i = 0; i < position.count; i += 1) positions.push(position.getX(i), position.getY(i), position.getZ(i));
  return verticalCrossingsFromPositions(positions, x, z);
}

// Ray along Z at fixed (x, y).
function depthCrossings(positions: readonly number[], x: number, y: number): number[] {
  const crossings: number[] = [];
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const p0 = [positions[i], positions[i + 1], positions[i + 2]];
    const p1 = [positions[i + 3], positions[i + 4], positions[i + 5]];
    const p2 = [positions[i + 6], positions[i + 7], positions[i + 8]];
    const denom = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
    if (Math.abs(denom) < 1e-12) continue;
    const a = ((p1[1] - p2[1]) * (x - p2[0]) + (p2[0] - p1[0]) * (y - p2[1])) / denom;
    const b = ((p2[1] - p0[1]) * (x - p2[0]) + (p0[0] - p2[0]) * (y - p2[1])) / denom;
    const c = 1 - a - b;
    if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
    crossings.push(a * p0[2] + b * p1[2] + c * p2[2]);
  }
  crossings.sort((m, n) => m - n);
  return crossings.filter((value, index) => index === 0 || value - crossings[index - 1] > 1e-6);
}

function isSolidAt(crossings: number[], at: number): boolean {
  let count = 0;
  for (const crossing of crossings) if (crossing < at) count += 1;
  return count % 2 === 1;
}

function expectExactDirectedEdges(positions: readonly number[]) {
  const directed = new Map<string, number>();
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const keys = [0, 3, 6].map((offset) => `${positions[i + offset]},${positions[i + offset + 1]},${positions[i + offset + 2]}`);
    for (let edge = 0; edge < 3; edge += 1) {
      const key = `${keys[edge]}|${keys[(edge + 1) % 3]}`;
      directed.set(key, (directed.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of directed) {
    expect(count, `directed edge ${key} should appear exactly once`).toBe(1);
    const [a, b] = key.split("|");
    expect(directed.get(`${b}|${a}`), `reverse of ${key} should appear exactly once`).toBe(1);
  }
}

describe("mountedScrewdriverTrayPositions: topology", () => {
  it("is watertight and manifold (0 boundary edges, 0 non-manifold edges)", () => {
    const positions = mountedScrewdriverTrayPositions(COUPON);
    expect(positions.every(Number.isFinite)).toBe(true);
    const analysis = analyzeTriangleSoup(positions);
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  });

  // Stricter than the spatially-quantized check above: every directed edge must
  // appear exactly once with its reverse exactly once, on raw doubles. This is
  // the exact-stitch contract from CLAUDE-LESSONS.md, and it now covers a seam
  // the Mounted Socket Tray does not have -- the bore wall's BOTTOM ring
  // meeting the bottom face's notch, alongside the slot-channel notches on that
  // same earcut cap.
  it("exact directed-edge manifold (bit-identical seams, consistent winding)", () => {
    expectExactDirectedEdges(mountedScrewdriverTrayPositions(COUPON));
  });

  // The junction the mounted recon flagged as the primary risk, isolated. Every
  // edge lying ON the inner-corner line (where the plate's front face meets the
  // tray's top face, outline point E) must pair exactly -- if the plate side and
  // the tray side of that corner were computed by two different paths and
  // disagreed by a ULP, these would not pair even while the rest of the mesh
  // looked fine.
  it("plate-to-tray inner-corner line pairs exactly (the seam the L-prism designs out)", () => {
    const positions = mountedScrewdriverTrayPositions(COUPON);
    const onCorner = (y: number, z: number) => y === TRAY_THICKNESS && z === PLATE_FRONT_Z;
    const directed = new Map<string, number>();
    let seen = 0;
    for (let i = 0; i + 8 < positions.length; i += 9) {
      const v = [0, 3, 6].map((o) => [positions[i + o], positions[i + o + 1], positions[i + o + 2]] as const);
      for (let edge = 0; edge < 3; edge += 1) {
        const a = v[edge];
        const b = v[(edge + 1) % 3];
        if (!onCorner(a[1], a[2]) || !onCorner(b[1], b[2])) continue;
        seen += 1;
        const key = `${a[0]},${a[1]},${a[2]}|${b[0]},${b[1]},${b[2]}`;
        directed.set(key, (directed.get(key) ?? 0) + 1);
      }
    }
    expect(seen).toBeGreaterThan(0); // the corner line is real geometry, not an empty filter
    for (const [key, count] of directed) {
      expect(count, `corner-line edge ${key} should appear exactly once`).toBe(1);
      const [a, b] = key.split("|");
      expect(directed.get(`${b}|${a}`), `reverse of corner-line edge ${key} should appear exactly once`).toBe(1);
    }
  });

  it("bounding box spans the plate in X/Y and tray depth + plate thickness in Z", () => {
    const geometry = createMountedScrewdriverTrayGeometry(COUPON);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(0, 4);
    expect(box.max.x).toBeCloseTo(PLATE_WIDTH, 4);
    expect(box.min.y).toBeCloseTo(0, 4);
    expect(box.max.y).toBeCloseTo(PLATE_HEIGHT, 4);
    expect(box.min.z).toBeCloseTo(0, 4);
    expect(box.max.z).toBeCloseTo(MOUNTING_FACE_Z, 4);
  });

  it("dimensions helper reports the same box", () => {
    expect(mountedScrewdriverTrayDimensions(COUPON)).toEqual({ width: PLATE_WIDTH, height: PLATE_HEIGHT, depth: MOUNTING_FACE_Z });
  });

  it("slot centers reproduce the validated wrench-rack layout", () => {
    const centers = mountedScrewdriverTraySlotCenters(PLATE_WIDTH, SLOT_SPACING, SLOT_COUNT);
    expect(centers).toHaveLength(8);
    expect(centers[0]).toBeCloseTo(22, 9);
    expect(centers[7]).toBeCloseTo(218, 9);
    for (let i = 1; i < centers.length; i += 1) expect(centers[i] - centers[i - 1]).toBeCloseTo(SLOT_SPACING, 9);
  });

  it("a tray with no bores at all is still manifold", () => {
    const positions = mountedScrewdriverTrayPositions({ ...COUPON, holes: [] });
    const analysis = analyzeTriangleSoup(positions);
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
    expectExactDirectedEdges(positions);
  });
});

describe("mountedScrewdriverTrayPositions: bores go all the way THROUGH the shelf", () => {
  const geometry = createMountedScrewdriverTrayGeometry(COUPON);

  // The defining difference from the Mounted Socket Tray. There, a vertical ray
  // down a pocket's axis crosses the pocket floor and then the tray bottom (two
  // crossings). Here it must cross NOTHING.
  it.each(DEFAULT_HOLES)("bore d=$diameter (viewed x=$x): zero solid crossings on its axis, at its MIRRORED geometry center", (hole) => {
    expect(verticalCrossings(geometry, geometryX(hole.x), hole.z)).toEqual([]);
  });

  it("off-centre but still inside the largest bore (12mm), still open through", () => {
    // Viewed x = 210 -> geometry x = 30, radius 6; sample 4mm off-axis.
    expect(verticalCrossings(geometry, geometryX(210) + 4, 30)).toEqual([]);
    expect(verticalCrossings(geometry, geometryX(210), 34)).toEqual([]);
  });

  it("between bores the shelf is a solid slab top to bottom", () => {
    const centers = DEFAULT_HOLES.map((hole) => geometryX(hole.x)).sort((a, b) => a - b);
    const midpoints = centers.slice(1).map((center, index) => (centers[index] + center) / 2);
    for (const x of midpoints) {
      const crossings = verticalCrossings(geometry, x, 30);
      expect(crossings.length, `x=${x}`).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 4);
      expect(crossings[1]).toBeCloseTo(TRAY_THICKNESS, 4);
    }
  });

  it("the shelf is solid front-to-back away from the bores", () => {
    for (const z of [8, 52]) {
      const crossings = verticalCrossings(geometry, geometryX(120), z);
      expect(crossings.length, `z=${z}`).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 4);
      expect(crossings[1]).toBeCloseTo(TRAY_THICKNESS, 4);
    }
  });

  it("just outside a bore's rim the shelf is solid again", () => {
    // Viewed x = 120 -> geometry 120, radius 5; sample 0.5mm outside.
    const crossings = verticalCrossings(geometry, 125.5, 30);
    expect(crossings.length).toBe(2);
    expect(crossings[0]).toBeCloseTo(0, 4);
    expect(crossings[1]).toBeCloseTo(TRAY_THICKNESS, 4);
  });

  // Diameter-based mirror proof on the default insert: the bore typed at
  // viewed x = 30 is the 8mm one, so at geometry x = 210 the opening must be
  // 8mm across, not 12mm. If the mirror were missing, geometry x = 210 would
  // carry the 12mm bore instead.
  it("the bore typed at viewed x=30 measures 8mm across at geometry x=210 (not 12mm)", () => {
    const openAt = (x: number) => verticalCrossings(geometry, x, 30).length === 0;
    expect(openAt(210)).toBe(true);
    expect(openAt(210 + 3.9)).toBe(true); // inside a 4mm radius
    expect(openAt(210 + 4.2)).toBe(false); // outside it -- so the bore here is 8mm, not 12mm
    // And the 12mm bore (typed at viewed x = 210) sits at geometry x = 30.
    expect(openAt(30 + 5.9)).toBe(true);
    expect(openAt(30 + 6.2)).toBe(false);
  });
});

describe("mountedScrewdriverTrayPositions: asymmetric layout pins the as-mounted x mirror", () => {
  const positions = mountedScrewdriverTrayPositions(ASYMMETRIC);
  const geometry = createMountedScrewdriverTrayGeometry(ASYMMETRIC);

  it("is watertight, manifold and exactly stitched", () => {
    const analysis = analyzeTriangleSoup(positions);
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
    expectExactDirectedEdges(positions);
  });

  it.each(ASYMMETRIC_HOLES)("bore d=$diameter (viewed x=$x, z=$z) opens at geometry x = plateWidth - $x", (hole) => {
    expect(verticalCrossings(geometry, geometryX(hole.x), hole.z)).toEqual([]);
  });

  // THE MIRROR TRAP. Each bore's image about the width centreline must be
  // SOLID. A MISSING mirror would open these three and close the three above;
  // a DOUBLED mirror would do the same. Only exactly one mirror passes both.
  it.each([
    { label: "unmirrored position of the d=8 bore", x: 40, z: 20 },
    { label: "unmirrored position of the d=10 bore", x: 95, z: 30 },
    { label: "unmirrored position of the d=12 bore", x: 160, z: 42 },
  ])("$label (geometry x=$x, z=$z) is SOLID, so the mirror is applied exactly once", ({ x, z }) => {
    const crossings = verticalCrossings(geometry, x, z);
    expect(crossings.length).toBe(2);
    expect(crossings[0]).toBeCloseTo(0, 4);
    expect(crossings[1]).toBeCloseTo(TRAY_THICKNESS, 4);
  });

  // z must NOT be mirrored: it runs front-to-back, which a left/right mirror
  // does not touch.
  it.each([
    { label: "z image of the d=8 bore", x: geometryX(40), z: TRAY_DEPTH - 20 },
    { label: "z image of the d=12 bore", x: geometryX(160), z: TRAY_DEPTH - 42 },
  ])("$label (x=$x, z=$z) is solid, so z is not mirrored", ({ x, z }) => {
    const crossings = verticalCrossings(geometry, x, z);
    expect(crossings.length).toBe(2);
    expect(crossings[0]).toBeCloseTo(0, 4);
    expect(crossings[1]).toBeCloseTo(TRAY_THICKNESS, 4);
  });
});

// Re-run for THIS shape, not assumed from the Mounted Socket Tray: the bottom
// face now carries the bore holes as well as the channel notches, so the
// channel's own integrity has to be re-established on the new mesh.
describe("mountedScrewdriverTrayPositions: the slot channel is unobstructed along its full run", () => {
  const positions = mountedScrewdriverTrayPositions(COUPON);
  const centers = mountedScrewdriverTraySlotCenters(PLATE_WIDTH, SLOT_SPACING, SLOT_COUNT);
  // Sample points are deliberately never ON a face plane: a ray taken exactly
  // at y = TRAY_THICKNESS grazes the tray-top face's own boundary edge at the
  // inner corner and reports an extra crossing, which breaks parity counting
  // without meaning anything about the channel (KNOWN-FIXES.md). Bracket that
  // plane instead of sitting on it. y = 0 is likewise avoided -- that is now
  // the plane the bores open through.
  const runYs = [0.25, 2, 6, 12, TRAY_THICKNESS - 0.5, TRAY_THICKNESS + 0.5, 24, 34, CHANNEL_TOP_Y - 0.5];

  it.each(centers.map((cx, index) => ({ index, cx })))("slot $index at x=$cx: void at the mounting face, solid at the blind floor, all the way up", ({ cx }) => {
    for (const y of runYs) {
      const crossings = depthCrossings(positions, cx, y);
      expect(isSolidAt(crossings, MOUNTING_FACE_Z - 0.1), `channel should be open at y=${y}`).toBe(false);
      expect(isSolidAt(crossings, BLIND_FLOOR_Z - 0.1), `blind floor should be solid at y=${y}`).toBe(true);
    }
  });

  it("between slots the mounting face is solid (no stray channel)", () => {
    for (let i = 1; i < centers.length; i += 1) {
      const midX = (centers[i - 1] + centers[i]) / 2;
      expect(isSolidAt(depthCrossings(positions, midX, 20), MOUNTING_FACE_Z - 0.1)).toBe(true);
    }
  });

  it("the tray is fused to the plate: material is continuous across the junction", () => {
    // The slot X is chosen clear of every bore: this ray runs at
    // y = TRAY_THICKNESS / 2, which on THIS shape is inside a through-bore's
    // full run, so a slot sitting under a bore would read (correctly) as void
    // there and say nothing about the junction. Sample the fusion, not a bore.
    const clearOfBores = (x: number) => DEFAULT_HOLES.every((hole) => Math.abs(x - geometryX(hole.x)) > hole.diameter / 2 + 1);
    const junctionX = centers.find(clearOfBores);
    expect(junctionX, "expected at least one slot center clear of every bore").toBeDefined();
    const crossings = depthCrossings(positions, junctionX!, TRAY_THICKNESS / 2);
    for (const z of [1, TRAY_DEPTH / 2, PLATE_FRONT_Z - 0.1, PLATE_FRONT_Z + 0.1, BLIND_FLOOR_Z - 0.1]) {
      expect(isSolidAt(crossings, z), `should be solid at z=${z}`).toBe(true);
    }
    expect(isSolidAt(crossings, MOUNTING_FACE_Z - 0.1)).toBe(false);
  });

  it("above the tray the plate stands alone (void in front of the plate's front face)", () => {
    const crossings = depthCrossings(positions, centers[0], TRAY_THICKNESS + 10);
    expect(isSolidAt(crossings, TRAY_DEPTH / 2)).toBe(false);
    expect(isSolidAt(crossings, PLATE_FRONT_Z + 0.1)).toBe(true);
    expect(isSolidAt(crossings, BLIND_FLOOR_Z - 0.1)).toBe(true);
    expect(isSolidAt(crossings, MOUNTING_FACE_Z - 0.1)).toBe(false);
  });

  // The clearance the recon proved: the furthest-back allowed bore wall and the
  // nearest channel surface can never meet, whatever the plate thickness.
  it("the furthest-back allowed bore stays clear of the channel's Z band", () => {
    for (const plateThickness of [MULTICONNECT_BACK_THICKNESS, 10, 20]) {
      const nearestChannelZ = TRAY_DEPTH + plateThickness - MULTICONNECT_SLOT_CUT_DEPTH;
      const furthestBoreZ = TRAY_DEPTH - 5; // the edge-clearance guard's bound
      expect(nearestChannelZ - furthestBoreZ, `plateThickness=${plateThickness}`).toBeGreaterThanOrEqual(7.35);
    }
  });
});

describe("mountedScrewdriverTrayPositions: validation guards", () => {
  it("throws when a bore footprint is too close to a tray edge", () => {
    expect(() => mountedScrewdriverTrayPositions({ ...COUPON, holes: [{ diameter: 20, x: 8, z: 30 }] })).toThrow(/edge/);
    expect(() => mountedScrewdriverTrayPositions({ ...COUPON, holes: [{ diameter: 20, x: 120, z: 8 }] })).toThrow(/edge/);
  });

  it("throws when two bores overlap or leave too thin a dividing wall", () => {
    expect(() => mountedScrewdriverTrayPositions({ ...COUPON, holes: [{ diameter: 20, x: 100, z: 30 }, { diameter: 20, x: 110, z: 30 }] })).toThrow(/overlap/);
  });

  it("rejects a tray thinner than the 10mm minimum, the same constant the flat Screwdriver Tray uses", () => {
    expect(MIN_SCREWDRIVER_TRAY_THICKNESS).toBe(10);
    expect(() => mountedScrewdriverTrayPositions({ ...COUPON, trayThickness: 9.5 })).toThrow(/below the 10mm minimum/);
    expect(() => normalizeMountedScrewdriverTrayThickness(2)).toThrow(/below the 10mm minimum/);
    expect(normalizeMountedScrewdriverTrayThickness(10)).toBe(10);
  });

  it("accepts exactly the 10mm minimum and the bores still run through it", () => {
    const options = { ...COUPON, trayThickness: 10 };
    const analysis = analyzeTriangleSoup(mountedScrewdriverTrayPositions(options));
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
    const geometry = createMountedScrewdriverTrayGeometry(options);
    expect(verticalCrossings(geometry, geometryX(120), 30)).toEqual([]);
  });

  it("throws when the tray is not shorter than the plate (the L would self-intersect)", () => {
    expect(() => mountedScrewdriverTrayPositions({ ...COUPON, trayThickness: 60 })).toThrow(/tray thickness/);
  });

  it("throws when the slots do not fit the plate width", () => {
    expect(() => mountedScrewdriverTrayPositions({ ...COUPON, plateWidth: 60, slotCount: 8, holes: [] })).toThrow(/do not fit/);
  });

  // This is the slot-channel clearance guarantee: the plate can never be thin
  // enough for the channel's blind floor to reach the tray, so the bores can
  // never sit in the channel's Z band. See the module header.
  it("floors the plate thickness at the Multiconnect back thickness, keeping the channel clear of the tray", () => {
    expect(normalizeMountedScrewdriverTrayPlateThickness(1)).toBe(MULTICONNECT_BACK_THICKNESS);
    expect(normalizeMountedScrewdriverTrayPlateThickness(12)).toBe(12);
  });

  it("rejects a bore with a non-finite or non-positive diameter", () => {
    expect(() => mountedScrewdriverTrayPositions({ ...COUPON, holes: [{ diameter: 0, x: 120, z: 30 }] })).toThrow(/diameter\/x\/z must be finite/);
    expect(() => mountedScrewdriverTrayPositions({ ...COUPON, holes: [{ diameter: 10, x: Number.NaN, z: 30 }] })).toThrow(/diameter\/x\/z must be finite/);
  });

  it("rejects a negative corner radius but accepts zero", () => {
    expect(() => mountedScrewdriverTrayPositions({ ...COUPON, cornerRadius: -1 })).toThrow(/zero or positive/);
    expect(() => mountedScrewdriverTrayPositions({ ...COUPON, cornerRadius: 0 })).not.toThrow();
  });

  it("rejects a corner radius too large for the plate's or the tray's own top edge", () => {
    expect(() => mountedScrewdriverTrayPositions({ ...COUPON, cornerRadius: 12 })).toThrow(/plate's own top edge/);
    expect(() => mountedScrewdriverTrayPositions({ ...COUPON, plateThickness: 20, trayThickness: 10, cornerRadius: 11, holes: [] })).toThrow(/tray's own top edge/);
  });

  it("rejects a corner radius that widens a bore to the edge or into a neighbour", () => {
    expect(() => mountedScrewdriverTrayPositions({ ...COUPON, cornerRadius: 8, holes: [{ diameter: 12, x: 15, z: 30 }] })).toThrow(/widens hole 0 .* to within 5mm of the tray edge/);
    expect(() =>
      mountedScrewdriverTrayPositions({ ...COUPON, cornerRadius: 3, holes: [{ diameter: 12, x: 100, z: 30 }, { diameter: 12, x: 116.1, z: 30 }] }),
    ).toThrow(/widens hole 0 .* too close to hole 1/);
  });
});

describe("mountedScrewdriverTrayPositions: corner radius (fillet)", () => {
  it("radius 0 is identical to omitting cornerRadius entirely", () => {
    expect(mountedScrewdriverTrayPositions({ ...COUPON, cornerRadius: 0 })).toEqual(mountedScrewdriverTrayPositions(COUPON));
  });

  describe("valid nonzero radius", () => {
    const ROUNDED: MountedScrewdriverTrayOptions = { ...ASYMMETRIC, cornerRadius: 3 };
    const positions = mountedScrewdriverTrayPositions(ROUNDED);

    it("is watertight and manifold", () => {
      expect(positions.every(Number.isFinite)).toBe(true);
      const analysis = analyzeTriangleSoup(positions);
      expect(analysis.boundaryEdges).toBe(0);
      expect(analysis.nonManifoldEdges).toBe(0);
    });

    it("exact directed-edge manifold", () => {
      expectExactDirectedEdges(positions);
    });

    it("bounding box is unchanged by the fillet (it recedes inward, never grows outward)", () => {
      const geometry = createMountedScrewdriverTrayGeometry(ROUNDED);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      expect(box.min.x).toBeCloseTo(0, 4);
      expect(box.max.x).toBeCloseTo(PLATE_WIDTH, 4);
      expect(box.min.y).toBeCloseTo(0, 4);
      expect(box.max.y).toBeCloseTo(PLATE_HEIGHT, 4);
      expect(box.min.z).toBeCloseTo(0, 4);
      expect(box.max.z).toBeCloseTo(MOUNTING_FACE_Z, 4);
    });

    it.each(ASYMMETRIC_HOLES)("bore d=$diameter, rounded: still open through on the EXPORTED STL", (hole) => {
      const exported = parseStlToScenePositions(toStlText(positions));
      expect(verticalCrossingsFromPositions(exported, geometryX(hole.x), hole.z)).toEqual([]);
    });

    it("the slot channel is still unobstructed on the exported STL after rounding corners D and F", () => {
      const exported = parseStlToScenePositions(toStlText(positions));
      const centers = mountedScrewdriverTraySlotCenters(PLATE_WIDTH, SLOT_SPACING, SLOT_COUNT);
      for (const cx of centers) {
        for (const y of [0.25, 6, TRAY_THICKNESS + 0.5, 34]) {
          const crossings = depthCrossings(exported, cx, y);
          expect(isSolidAt(crossings, MOUNTING_FACE_Z - 0.1), `channel should be open at x=${cx}, y=${y}`).toBe(false);
          expect(isSolidAt(crossings, BLIND_FLOOR_Z - 0.1), `blind floor should be solid at x=${cx}, y=${y}`).toBe(true);
        }
      }
    });

    // THE BOTTOM RIM IS SHARP (owner's decision), matching the flat Screwdriver
    // Tray. Sample inside the fillet's widened band: 1.5mm outside the 10mm
    // bore's 5mm nominal radius. The shelf top is open there, so the ray enters
    // material only at the fillet surface -- but it must still exit at Y = 0,
    // proving material runs all the way down to a SHARP bottom rim.
    it("the bottom rim is sharp: material reaches Y=0 at a radius the top rim has opened up", () => {
      const geometry = createMountedScrewdriverTrayGeometry(ROUNDED);
      const crossings = verticalCrossings(geometry, geometryX(95) + 6.5, 30);
      expect(crossings.length).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 4); // sharp bottom rim: solid down to the bottom face
      expect(crossings[1]).toBeGreaterThan(TRAY_THICKNESS - 3);
      expect(crossings[1]).toBeLessThan(TRAY_THICKNESS);
    });

    it("the bottom face's notch is the NOMINAL radius, not the widened one", () => {
      const geometry = createMountedScrewdriverTrayGeometry(ROUNDED);
      expect(verticalCrossings(geometry, geometryX(95) + 5.5, 30)[0]).toBeCloseTo(0, 4);
      expect(verticalCrossings(geometry, geometryX(95) + 4.5, 30)).toEqual([]);
    });
  });
});

describe("mountedScrewdriverTrayPositions: there is no pocket-depth concept", () => {
  it("ignores a stray depth field on a bore and a stray pocketDepth option", () => {
    const strayHoleDepth = mountedScrewdriverTrayPositions({
      ...COUPON,
      holes: DEFAULT_HOLES.map((hole) => ({ ...hole, depth: 6 }) as MountedScrewdriverTrayHole),
    });
    expect(strayHoleDepth).toEqual(mountedScrewdriverTrayPositions(COUPON));
    const strayOption = mountedScrewdriverTrayPositions({ ...COUPON, pocketDepth: 14 } as MountedScrewdriverTrayOptions);
    expect(strayOption).toEqual(mountedScrewdriverTrayPositions(COUPON));
  });

  it("emits no floor cap: a bore's footprint contains no triangle at any height", () => {
    const positions = mountedScrewdriverTrayPositions(COUPON);
    // Sample a grid across the 12mm bore (viewed x = 210 -> geometry x = 30).
    for (let dx = -4; dx <= 4; dx += 2) {
      for (let dz = -4; dz <= 4; dz += 2) {
        if (Math.hypot(dx, dz) > 4.5) continue;
        expect(verticalCrossingsFromPositions(positions, geometryX(210) + dx, 30 + dz), `dx=${dx} dz=${dz}`).toEqual([]);
      }
    }
  });
});
