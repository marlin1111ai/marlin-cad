import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createMountedSocketTrayGeometry,
  mountedSocketTrayDimensions,
  mountedSocketTrayPositions,
  mountedSocketTraySlotCenters,
  normalizeMountedSocketTrayPlateThickness,
  type MountedSocketTrayOptions,
  type MountedSocketTrayPocket,
} from "@/lib/mountedSocketTrayGeometry";
import { MULTICONNECT_BACK_THICKNESS, MULTICONNECT_SLOT_TOP_OFFSET } from "@/lib/multiconnectContainerGeometry";
import { MULTICONNECT_SLOT_CUT_DEPTH, MULTICONNECT_TERMINATOR_CLIP_Y } from "@/lib/multiconnectSlotMesh";
import { analyzeTriangleSoup } from "@/lib/svgImport";

// The coupon this suite pins is the default insert and the STL written to
// test-prints/mounted-socket-tray-coupon.stl. Plate numbers are the validated
// wrench-rack recipe (multiconnectPresets.ts:29-42): 240 x 60 x 10mm at 28mm
// slot spacing, 8 slots. Tray 60mm deep, 18mm thick, pockets 14mm deep over a
// 4mm floor. Three pockets at 14/19/25mm, 30mm end margins, 90mm pitch.
// See reference/reports/mounted-socket-tray-build.md for the arithmetic.
const PLATE_WIDTH = 240;
const PLATE_HEIGHT = 60;
const PLATE_THICKNESS = 10;
const SLOT_SPACING = 28;
const SLOT_COUNT = 8;
const TRAY_DEPTH = 60;
const TRAY_THICKNESS = 18;
const POCKET_DEPTH = 14;

const COUPON_POCKETS: MountedSocketTrayPocket[] = [
  { diameter: 14, x: 30, z: 30 },
  { diameter: 19, x: 120, z: 30 },
  { diameter: 25, x: 210, z: 30 },
];
const COUPON: MountedSocketTrayOptions = {
  plateWidth: PLATE_WIDTH,
  plateHeight: PLATE_HEIGHT,
  plateThickness: PLATE_THICKNESS,
  slotSpacing: SLOT_SPACING,
  slotCount: SLOT_COUNT,
  trayDepth: TRAY_DEPTH,
  trayThickness: TRAY_THICKNESS,
  pocketDepth: POCKET_DEPTH,
  pockets: COUPON_POCKETS,
};

// Derived planes, recomputed here from the same rules the module uses rather
// than copied as literals.
const MOUNTING_FACE_Z = TRAY_DEPTH + PLATE_THICKNESS; // 70
const BLIND_FLOOR_Z = MOUNTING_FACE_Z - MULTICONNECT_SLOT_CUT_DEPTH; // 65.85
const PLATE_FRONT_Z = TRAY_DEPTH; // 60
const SLOT_TOP_CENTER_Y = PLATE_HEIGHT - MULTICONNECT_SLOT_TOP_OFFSET; // 47
const CHANNEL_TOP_Y = SLOT_TOP_CENTER_Y + MULTICONNECT_TERMINATOR_CLIP_Y; // 45
const POCKET_FLOOR_Y = TRAY_THICKNESS - POCKET_DEPTH; // 4

// Converts a raw positions array to ASCII STL text (scene [x, y, z] -> file
// [x, -z, y], same convention as stlExport.ts / scripts/generate-mounted-
// socket-tray-coupon.mjs) and parses that TEXT back into scene coordinates --
// an actual STL round-trip, not a re-use of the in-memory geometry, per
// KNOWN-FIXES.md's "raycast the exported STL, don't trust mesh checks alone."
function toStlText(positions: readonly number[]): string {
  const lines = ["solid mounted_socket_tray_rounding_test"];
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const toZUp = (x: number, y: number, z: number) => [x, -z, y] as const;
    const a = toZUp(positions[i], positions[i + 1], positions[i + 2]);
    const b = toZUp(positions[i + 3], positions[i + 4], positions[i + 5]);
    const c = toZUp(positions[i + 6], positions[i + 7], positions[i + 8]);
    lines.push("  facet normal 0 0 0", "    outer loop", `      vertex ${a[0]} ${a[1]} ${a[2]}`, `      vertex ${b[0]} ${b[1]} ${b[2]}`, `      vertex ${c[0]} ${c[1]} ${c[2]}`, "    endloop", "  endfacet");
  }
  lines.push("endsolid mounted_socket_tray_rounding_test");
  return lines.join("\n");
}

function parseStlToScenePositions(stl: string): number[] {
  const positions: number[] = [];
  const vertexPattern = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = vertexPattern.exec(stl))) {
    const fx = Number(match[1]);
    const fy = Number(match[2]);
    const fz = Number(match[3]);
    positions.push(fx, fz, -fy);
  }
  return positions;
}

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

describe("mountedSocketTrayPositions: coupon topology", () => {
  it("is watertight and manifold (0 boundary edges, 0 non-manifold edges)", () => {
    const positions = mountedSocketTrayPositions(COUPON);
    expect(positions.every(Number.isFinite)).toBe(true);
    const analysis = analyzeTriangleSoup(positions);
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  });

  // Stricter than the spatially-quantized check above: every directed edge
  // must appear exactly once with its reverse exactly once, on raw doubles.
  // This is the exact-stitch contract from CLAUDE-LESSONS.md, and the reason
  // the plate and tray are built as one extruded L outline rather than two
  // bodies joined at a seam.
  it("exact directed-edge manifold (bit-identical seams, consistent winding)", () => {
    const positions = mountedSocketTrayPositions(COUPON);
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
  });

  // The junction the recon flagged as the primary risk, isolated. Every edge
  // lying ON the inner-corner line (where the plate's front face meets the
  // tray's top face, outline point E) must pair exactly -- if the plate side
  // and the tray side of that corner were computed by two different paths and
  // disagreed by a ULP, these would not pair even while the rest of the mesh
  // looked fine.
  it("plate-to-tray inner-corner line pairs exactly (the seam the L-prism designs out)", () => {
    const positions = mountedSocketTrayPositions(COUPON);
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
    // The corner line is real geometry, not an empty filter.
    expect(seen).toBeGreaterThan(0);
    for (const [key, count] of directed) {
      expect(count, `corner-line edge ${key} should appear exactly once`).toBe(1);
      const [a, b] = key.split("|");
      expect(directed.get(`${b}|${a}`), `reverse of corner-line edge ${key} should appear exactly once`).toBe(1);
    }
  });

  it("bounding box spans the plate in X/Y and tray depth + plate thickness in Z", () => {
    const geometry = createMountedSocketTrayGeometry(COUPON);
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
    const dims = mountedSocketTrayDimensions(COUPON);
    expect(dims).toEqual({ width: PLATE_WIDTH, height: PLATE_HEIGHT, depth: MOUNTING_FACE_Z });
  });

  // 8 slots at 28mm centered on 240mm reproduces the wrench-rack layout: first
  // center 22mm, last 218mm.
  it("slot centers reproduce the validated wrench-rack layout", () => {
    const centers = mountedSocketTraySlotCenters(PLATE_WIDTH, SLOT_SPACING, SLOT_COUNT);
    expect(centers).toHaveLength(8);
    expect(centers[0]).toBeCloseTo(22, 9);
    expect(centers[7]).toBeCloseTo(218, 9);
    for (let i = 1; i < centers.length; i += 1) expect(centers[i] - centers[i - 1]).toBeCloseTo(SLOT_SPACING, 9);
  });
});

// ===== raycasts =====
//
// A sealed-shut pocket is still a perfectly valid closed solid (CLAUDE-LESSONS
// .md), so topology checks cannot see it. Raycast instead.

// Ray along Y at fixed (x, z): returns the Y heights where material boundaries
// are crossed.
function verticalCrossings(geometry: THREE.BufferGeometry, x: number, z: number): number[] {
  const position = geometry.getAttribute("position");
  const crossings: number[] = [];
  for (let i = 0; i < position.count; i += 3) {
    const p0 = [position.getX(i), position.getY(i), position.getZ(i)];
    const p1 = [position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1)];
    const p2 = [position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2)];
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

// Ray along Z at fixed (x, y): returns the Z depths where material boundaries
// are crossed. Parity below a given Z says whether material is present there.
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

describe("mountedSocketTrayPositions: pockets are open blind pockets, not sealed or through-holes", () => {
  const geometry = createMountedSocketTrayGeometry(COUPON);

  it.each(COUPON_POCKETS)("pocket d=$diameter: open top-to-floor, solid floor-to-bottom, at its exact center", (pocket) => {
    const crossings = verticalCrossings(geometry, pocket.x, pocket.z);
    expect(crossings.length).toBe(2);
    expect(crossings[0]).toBeCloseTo(0, 4); // tray bottom face
    expect(crossings[1]).toBeCloseTo(POCKET_FLOOR_Y, 4); // pocket floor, NOT the tray top
  });

  it.each(COUPON_POCKETS)("pocket d=$diameter: still open off-centre, 3mm in from the rim", (pocket) => {
    const offset = pocket.diameter / 2 - 3;
    const crossings = verticalCrossings(geometry, pocket.x + offset, pocket.z);
    expect(crossings.length).toBe(2);
    expect(crossings[0]).toBeCloseTo(0, 4);
    expect(crossings[1]).toBeCloseTo(POCKET_FLOOR_Y, 4);
  });

  it("between pockets, the tray is a solid slab (no accidental opening)", () => {
    const midpoints = [(30 + 120) / 2, (120 + 210) / 2];
    for (const x of midpoints) {
      const crossings = verticalCrossings(geometry, x, 30);
      expect(crossings.length).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 4);
      expect(crossings[1]).toBeCloseTo(TRAY_THICKNESS, 4);
    }
  });

  it("the tray is solid front-to-back away from the pockets", () => {
    for (const z of [8, 52]) {
      const crossings = verticalCrossings(geometry, 120, z);
      expect(crossings.length).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 4);
      expect(crossings[1]).toBeCloseTo(TRAY_THICKNESS, 4);
    }
  });
});

describe("mountedSocketTrayPositions: the slot channel is unobstructed along its full run", () => {
  const positions = mountedSocketTrayPositions(COUPON);
  const centers = mountedSocketTraySlotCenters(PLATE_WIDTH, SLOT_SPACING, SLOT_COUNT);
  // Sample the whole run: the bottom-edge entry, through the band where the
  // tray is fused on the far side of the plate, up to just under the
  // terminator's clip plane.
  // Sample points are deliberately never ON a face plane. A ray taken exactly
  // at y = TRAY_THICKNESS grazes the tray-top face's own boundary edge at the
  // inner corner and reports an extra crossing there, which breaks parity
  // counting without meaning anything about the channel; bracket that plane
  // instead of sitting on it.
  const runYs = [0.25, 2, 6, 12, TRAY_THICKNESS - 0.5, TRAY_THICKNESS + 0.5, 24, 34, CHANNEL_TOP_Y - 0.5];

  it.each(centers.map((cx, index) => ({ index, cx })))("slot $index at x=$cx: void at the mounting face, solid at the blind floor, all the way up", ({ cx }) => {
    for (const y of runYs) {
      const crossings = depthCrossings(positions, cx, y);
      // Just inside the mounting face: this is the channel, it must be void.
      expect(isSolidAt(crossings, MOUNTING_FACE_Z - 0.1), `channel should be open at y=${y}`).toBe(false);
      // Just in front of the blind floor: material must be present, i.e. the
      // cut is blind and has not perforated toward the tray.
      expect(isSolidAt(crossings, BLIND_FLOOR_Z - 0.1), `blind floor should be solid at y=${y}`).toBe(true);
    }
  });

  it("between slots the mounting face is solid (no stray channel)", () => {
    for (let i = 1; i < centers.length; i += 1) {
      const midX = (centers[i - 1] + centers[i]) / 2;
      const crossings = depthCrossings(positions, midX, 20);
      expect(isSolidAt(crossings, MOUNTING_FACE_Z - 0.1)).toBe(true);
    }
  });

  it("the tray is fused to the plate: material is continuous across the junction", () => {
    // Below the tray's top face, at a slot's own X, the ray along Z must be
    // solid through the tray, through the junction, and on into the plate up
    // to the channel's blind floor -- one unbroken run, i.e. one solid.
    const crossings = depthCrossings(positions, centers[0], TRAY_THICKNESS / 2);
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
});

describe("mountedSocketTrayPositions: validation guards", () => {
  it("throws when a pocket footprint is too close to a tray edge", () => {
    expect(() => mountedSocketTrayPositions({ ...COUPON, pockets: [{ diameter: 20, x: 8, z: 30 }] })).toThrow(/edge/);
    expect(() => mountedSocketTrayPositions({ ...COUPON, pockets: [{ diameter: 20, x: 120, z: 8 }] })).toThrow(/edge/);
  });

  it("throws when two pockets overlap or leave too thin a dividing wall", () => {
    expect(() =>
      mountedSocketTrayPositions({
        ...COUPON,
        pockets: [
          { diameter: 20, x: 100, z: 30 },
          { diameter: 20, x: 110, z: 30 },
        ],
      }),
    ).toThrow(/overlap/);
  });

  it("throws when the pocket depth leaves too thin a floor", () => {
    expect(() => mountedSocketTrayPositions({ ...COUPON, trayThickness: 15, pocketDepth: 14 })).toThrow(/floor/);
  });

  it("throws on a non-positive pocket depth", () => {
    expect(() => mountedSocketTrayPositions({ ...COUPON, pocketDepth: 0 })).toThrow(/pocket depth/);
  });

  it("throws when the tray is as thick as the plate is tall", () => {
    expect(() => mountedSocketTrayPositions({ ...COUPON, trayThickness: 60, pockets: [] })).toThrow(/tray thickness/);
  });

  it("throws when the slot run does not fit the plate width", () => {
    expect(() => mountedSocketTrayPositions({ ...COUPON, slotCount: 9 })).toThrow(/do not fit/);
  });

  it("throws on a non-positive tray depth or thickness", () => {
    expect(() => mountedSocketTrayPositions({ ...COUPON, trayDepth: 0 })).toThrow(/depth must be positive/);
    expect(() => mountedSocketTrayPositions({ ...COUPON, trayThickness: -1 })).toThrow(/thickness must be positive/);
  });

  // This is the slot-channel clearance guarantee: the plate can never be thin
  // enough for the 4.15mm cut to reach its front face, so a forward tray can
  // never sit in the channel's Z band. See the module header.
  it("floors the plate thickness at the Multiconnect back thickness, keeping the channel clear of the tray", () => {
    expect(normalizeMountedSocketTrayPlateThickness(1)).toBe(MULTICONNECT_BACK_THICKNESS);
    expect(normalizeMountedSocketTrayPlateThickness(undefined)).toBe(PLATE_THICKNESS);
    const thin = mountedSocketTrayPositions({ ...COUPON, plateThickness: 1 });
    const analysis = analyzeTriangleSoup(thin);
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
    // Skin left between the channel's blind floor and the plate's front face.
    expect(MULTICONNECT_BACK_THICKNESS - MULTICONNECT_SLOT_CUT_DEPTH).toBeGreaterThan(0);
  });

  it("builds a bare tray (no pockets) and stays manifold", () => {
    const analysis = analyzeTriangleSoup(mountedSocketTrayPositions({ ...COUPON, pockets: [] }));
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  });
});

describe("mountedSocketTrayPositions: corner radius (fillet)", () => {
  // Regression anchor, same guarantee as the flat tray's own test: radius 0
  // (or omitted) must be byte-identical to the pre-rounding module.
  it("radius 0 is identical to omitting cornerRadius entirely", () => {
    const withZero = mountedSocketTrayPositions({ ...COUPON, cornerRadius: 0 });
    const omitted = mountedSocketTrayPositions(COUPON);
    expect(withZero).toEqual(omitted);
  });

  describe("valid nonzero radius", () => {
    const ROUNDED: MountedSocketTrayOptions = { ...COUPON, cornerRadius: 3 };
    const positions = mountedSocketTrayPositions(ROUNDED);

    it("is watertight and manifold (0 boundary edges, 0 non-manifold edges)", () => {
      expect(positions.every(Number.isFinite)).toBe(true);
      const analysis = analyzeTriangleSoup(positions);
      expect(analysis.boundaryEdges).toBe(0);
      expect(analysis.nonManifoldEdges).toBe(0);
    });

    it("exact directed-edge manifold (bit-identical seams, consistent winding)", () => {
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
    });

    // Per the recon's flagged risk: raycast the actual EXPORTED STL (an
    // ASCII round-trip, not the in-memory geometry) at every pocket center,
    // which always sits inside the narrowest (nominal-radius) part of the
    // bore regardless of how much the fillet widens the very top.
    it.each(COUPON_POCKETS)("pocket d=$diameter, rounded (cornerRadius=3): open top-to-floor, solid floor-to-bottom, at its exact center, on the EXPORTED STL", (pocket) => {
      const exported = parseStlToScenePositions(toStlText(positions));
      const crossings = verticalCrossingsFromPositions(exported, pocket.x, pocket.z);
      expect(crossings.length).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 3);
      expect(crossings[1]).toBeCloseTo(POCKET_FLOOR_Y, 3);
    });

    it("between pockets, the exported STL is still a solid slab top to bottom", () => {
      const exported = parseStlToScenePositions(toStlText(positions));
      for (const x of [75, 165]) {
        const crossings = verticalCrossingsFromPositions(exported, x, 30);
        expect(crossings.length).toBe(2);
        expect(crossings[0]).toBeCloseTo(0, 3);
        expect(crossings[1]).toBeCloseTo(TRAY_THICKNESS, 3);
      }
    });

    it("the slot channel is still unobstructed on the exported STL after rounding corners D and F", () => {
      const exported = parseStlToScenePositions(toStlText(positions));
      const centers = mountedSocketTraySlotCenters(PLATE_WIDTH, SLOT_SPACING, SLOT_COUNT);
      const runYs = [0.25, 2, 6, 12, TRAY_THICKNESS - 0.5, TRAY_THICKNESS + 0.5, 24, 34, CHANNEL_TOP_Y - 0.5];
      for (const cx of centers) {
        for (const y of runYs) {
          const crossings = depthCrossings(exported, cx, y);
          expect(isSolidAt(crossings, MOUNTING_FACE_Z - 0.1), `channel should be open at y=${y}`).toBe(false);
          expect(isSolidAt(crossings, BLIND_FLOOR_Z - 0.1), `blind floor should be solid at y=${y}`).toBe(true);
        }
      }
    });

    it("near the plate's own outer top edge (corner D), material recedes but is never sealed shut", () => {
      // 1mm in front of the plate's front face at the very top -- inside the
      // corner-D fillet's Z range (plateFrontZ..plateFrontZ+cornerRadius).
      const crossings = verticalCrossingsFromPositions(positions, 36, PLATE_FRONT_Z + 1);
      expect(crossings.length).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 3);
      expect(crossings[1]).toBeLessThan(PLATE_HEIGHT);
      expect(crossings[1]).toBeGreaterThan(PLATE_HEIGHT - 3);
    });

    it("near the tray's own outer top edge (corner F), material recedes but is never sealed shut", () => {
      const crossings = verticalCrossingsFromPositions(positions, 120, 0.5);
      expect(crossings.length).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 3);
      expect(crossings[1]).toBeLessThan(TRAY_THICKNESS);
      expect(crossings[1]).toBeGreaterThan(TRAY_THICKNESS - 3);
    });

    it("the L-junction (corner E) and corners A, B, C stay exactly sharp -- unaffected by the fillet", () => {
      // Full plate height well inside the mounting-face region (away from D).
      const plateSlab = verticalCrossingsFromPositions(positions, 36, MOUNTING_FACE_Z - 5);
      expect(plateSlab).toEqual([0, PLATE_HEIGHT]);
      // Full tray thickness just below the junction on the tray side.
      const traySlab = verticalCrossingsFromPositions(positions, 36, PLATE_FRONT_Z - 1);
      expect(traySlab).toEqual([0, TRAY_THICKNESS]);
    });
  });

  describe("validation", () => {
    it("throws when the corner radius is too large for the plate's own top edge", () => {
      expect(() => mountedSocketTrayPositions({ ...COUPON, cornerRadius: 10 })).toThrow(/plate's own top edge/);
    });

    it("throws when the corner radius is too large for the tray's own top edge", () => {
      expect(() => mountedSocketTrayPositions({ ...COUPON, plateThickness: 30, cornerRadius: 19 })).toThrow(/tray's own top edge/);
    });

    it("throws when the corner radius leaves no straight wall below it in a pocket (too large relative to pocket depth)", () => {
      expect(() => mountedSocketTrayPositions({ ...COUPON, plateThickness: 30, cornerRadius: 5, pocketDepth: 4 })).toThrow(/straight wall/);
    });

    it("throws when the corner radius widens a pocket (too large relative to the pocket's diameter) into the tray edge", () => {
      expect(() => mountedSocketTrayPositions({ ...COUPON, plateThickness: 30, cornerRadius: 4, pockets: [{ diameter: 20, x: 15, z: 30 }] })).toThrow(/edge/);
    });

    it("throws on a negative corner radius", () => {
      expect(() => mountedSocketTrayPositions({ ...COUPON, cornerRadius: -1 })).toThrow(/zero or positive/);
    });
  });
});

describe("mountedSocketTrayPositions: other configurations stay manifold", () => {
  const CONFIGS: Array<{ label: string; options: MountedSocketTrayOptions }> = [
    { label: "single slot, minimum plate", options: { ...COUPON, plateWidth: 60, slotCount: 1, pockets: [{ diameter: 25, x: 30, z: 30 }] } },
    { label: "minimum plate thickness 6.5", options: { ...COUPON, plateThickness: MULTICONNECT_BACK_THICKNESS } },
    { label: "thick plate 20mm", options: { ...COUPON, plateThickness: 20 } },
    { label: "tall plate 112mm", options: { ...COUPON, plateHeight: 112 } },
    { label: "shallow tray 30mm deep", options: { ...COUPON, trayDepth: 30, pockets: [{ diameter: 14, x: 120, z: 15 }] } },
    { label: "two rows of pockets", options: { ...COUPON, trayDepth: 90, pockets: [
      { diameter: 14, x: 40, z: 25 }, { diameter: 14, x: 40, z: 65 },
      { diameter: 19, x: 120, z: 25 }, { diameter: 19, x: 120, z: 65 },
    ] } },
  ];

  it.each(CONFIGS)("$label: watertight, manifold, exact directed edges", ({ options }) => {
    const positions = mountedSocketTrayPositions(options);
    const analysis = analyzeTriangleSoup(positions);
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
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
  });
});
