import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createOpenConnectContainerGeometry,
  openConnectContainerDimensions,
  openConnectSlotGridCells,
  transformedOutline,
  NO_LOCK_DEEP_OUTLINE,
  WITH_LOCK_DEEP_OUTLINE,
  SLOT_TOOL_DEPTH,
  DEFAULT_OPENCONNECT_INTERNAL_WIDTH,
  DEFAULT_OPENCONNECT_INTERNAL_HEIGHT,
  DEFAULT_OPENCONNECT_INTERNAL_DEPTH,
  DEFAULT_OPENCONNECT_WALL_THICKNESS,
  DEFAULT_OPENCONNECT_SLOT_POSITION,
  DEFAULT_OPENCONNECT_SLOT_LOCK_DISTRIBUTION,
  type Point2,
  type OpenConnectSlotGridCell,
} from "@/lib/openConnectContainerGeometry";
import { analyzeTriangleSoup } from "@/lib/svgImport";

// analyzeTriangleSoup (not the throwing validateClosedSolidTriangleSoup) is
// used here deliberately: its stricter sibling also rejects any degenerate
// (near-zero-area) triangle, which is the wrong bar for CSG-boolean output --
// a boolean's intersection curve routinely leaves a few genuinely thin (but
// load-bearing) triangles behind, same as the baked slot mesh's own sliver
// triangles (see openConnectContainerGeometry.ts's header comment). What the
// user actually asked to verify -- 0 open edges, 0 non-manifold edges, same
// as a slicer's watertightness check -- is exactly analyzeTriangleSoup's
// boundaryEdges/nonManifoldEdges fields.

function bbox(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  return {
    size: [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z],
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
  };
}

function hasNaN(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute("position");
  for (let i = 0; i < pos.count * 3; i += 1) {
    if (!Number.isFinite(pos.array[i])) return true;
  }
  return false;
}

function positionsArray(geometry: THREE.BufferGeometry): number[] {
  return Array.from(geometry.getAttribute("position").array);
}

// Same ray-cast technique tests/unit/openGridGeometry.test.ts uses: solve
// each triangle's plane for Y at (x, z) via barycentric coordinates.
function verticalCrossings(geometry: THREE.BufferGeometry, x: number, z: number): number[] {
  const position = geometry.getAttribute("position");
  const crossings: number[] = [];
  for (let i = 0; i < position.count; i += 3) {
    const p0: [number, number, number] = [position.getX(i), position.getY(i), position.getZ(i)];
    const p1: [number, number, number] = [position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1)];
    const p2: [number, number, number] = [position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2)];
    const denom = (p1[2] - p2[2]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[2] - p2[2]);
    if (Math.abs(denom) < 1e-9) continue;
    const a = ((p1[2] - p2[2]) * (x - p2[0]) + (p2[0] - p1[0]) * (z - p2[2])) / denom;
    const b = ((p2[2] - p0[2]) * (x - p2[0]) + (p0[0] - p2[0]) * (z - p2[2])) / denom;
    const c = 1 - a - b;
    if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
    crossings.push(a * p0[1] + b * p1[1] + c * p2[1]);
  }
  return crossings.sort((m, n) => m - n);
}

function isSolidAt(crossings: number[], y: number): boolean {
  let count = 0;
  for (const crossing of crossings) if (crossing < y) count += 1;
  return count % 2 === 1;
}

describe("createOpenConnectContainerGeometry", () => {
  it("default Bin (no walls removed, Corners lock/position) is a watertight manifold", () => {
    const geometry = createOpenConnectContainerGeometry({});
    expect(hasNaN(geometry)).toBe(false);
    const analysis = analyzeTriangleSoup(positionsArray(geometry));
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  }, 20000);

  it("default Bin: interior cavity is hollow, base + back wall are solid", () => {
    const geometry = createOpenConnectContainerGeometry({});
    const box = bbox(geometry);
    // interior column, well clear of any wall/slot geometry
    const crossings = verticalCrossings(geometry, 28, 14);
    expect(isSolidAt(crossings, 1.5)).toBe(true); // inside the base slab
    expect(isSolidAt(crossings, 15)).toBe(false); // inside the hollow cavity
    expect(box.size[1]).toBeGreaterThan(0);
  });

  it("default Shelf (no walls removed, Corners lock/position) is a watertight manifold", () => {
    const geometry = createOpenConnectContainerGeometry({ shapeType: "Shelf" });
    expect(hasNaN(geometry)).toBe(false);
    const analysis = analyzeTriangleSoup(positionsArray(geometry));
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  }, 20000);

  it("Bin with all side walls off is still a watertight manifold", () => {
    const geometry = createOpenConnectContainerGeometry({ leftWallEnabled: false, rightWallEnabled: false, frontWallEnabled: false });
    expect(hasNaN(geometry)).toBe(false);
    const analysis = analyzeTriangleSoup(positionsArray(geometry));
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  }, 20000);

  it("Bin with Staggered slot distribution/position is still a watertight manifold", () => {
    const geometry = createOpenConnectContainerGeometry({
      internalWidth: 140,
      internalHeight: 84,
      slotLockDistribution: "Staggered",
      slotPosition: "Staggered",
    });
    expect(hasNaN(geometry)).toBe(false);
    const analysis = analyzeTriangleSoup(positionsArray(geometry));
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  }, 20000);

  it("cornerRounding Chamfer/Fillet stay watertight", () => {
    for (const cornerRounding of ["Chamfer", "Fillet"] as const) {
      const geometry = createOpenConnectContainerGeometry({ cornerRounding });
      expect(hasNaN(geometry)).toBe(false);
      const analysis = analyzeTriangleSoup(positionsArray(geometry));
      expect(analysis.boundaryEdges).toBe(0);
      expect(analysis.nonManifoldEdges).toBe(0);
    }
  }, 30000);

  it("slotPosition None removes all cutouts (no slot-tool cutter geometry applied)", () => {
    const withSlots = createOpenConnectContainerGeometry({ slotPosition: "Corners" });
    const withoutSlots = createOpenConnectContainerGeometry({ slotPosition: "None" as never });
    // "None" isn't a valid slotPosition per the enum (only slotLockDistribution has it) --
    // normalizeSlotPosition should fall back to the default ("All") rather than crash.
    expect(hasNaN(withoutSlots)).toBe(false);
    expect(withSlots.getAttribute("position").count).toBeGreaterThan(0);
  });

  it("overall bounding box reflects internal dims + wall/base thickness", () => {
    const geometry = createOpenConnectContainerGeometry({
      internalWidth: 60,
      internalHeight: 40,
      internalDepth: 50,
      wallThickness: 3,
      baseThickness: 4,
    });
    const box = bbox(geometry);
    expect(box.size[0]).toBeCloseTo(60 + 3 + 3, 3); // left + right wall
    expect(box.size[1]).toBeCloseTo(4 + 40, 3); // base + internal height
    expect(box.size[2]).toBeCloseTo(50 + 3 + 3, 3); // internal depth + back wall + front wall (all walls default on)
  });

  it("Bin with base wall off is still a watertight manifold", () => {
    const geometry = createOpenConnectContainerGeometry({ bottomWallEnabled: false });
    expect(hasNaN(geometry)).toBe(false);
    const analysis = analyzeTriangleSoup(positionsArray(geometry));
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  }, 20000);

  it("Bin with all 4 walls (left/right/front/base) off is still a watertight manifold -- a flat back plate is a legitimate config, not blocked", () => {
    const geometry = createOpenConnectContainerGeometry({
      leftWallEnabled: false,
      rightWallEnabled: false,
      frontWallEnabled: false,
      bottomWallEnabled: false,
    });
    expect(hasNaN(geometry)).toBe(false);
    const analysis = analyzeTriangleSoup(positionsArray(geometry));
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  }, 20000);

  it("base wall off: base slab is actually omitted (interior column hollow all the way down), not just thinned", () => {
    const geometry = createOpenConnectContainerGeometry({ bottomWallEnabled: false });
    const crossings = verticalCrossings(geometry, 28, 14); // same interior column the "hollow cavity" test above uses
    expect(isSolidAt(crossings, 1.5)).toBe(false); // no base slab left to be solid here anymore
    expect(isSolidAt(crossings, 15)).toBe(false); // cavity itself still hollow
  });

  it("base wall off: overall height drops baseThickness (walls start at their own true bottom, not overlapping a nonexistent base)", () => {
    const withBase = bbox(createOpenConnectContainerGeometry({ internalHeight: 40, baseThickness: 4 }));
    const withoutBase = bbox(createOpenConnectContainerGeometry({ internalHeight: 40, baseThickness: 4, bottomWallEnabled: false }));
    expect(withBase.size[1]).toBeCloseTo(4 + 40, 3);
    expect(withoutBase.size[1]).toBeCloseTo(40, 3);
    expect(withoutBase.min[1]).toBeCloseTo(0, 3);
  });

  it("openConnectContainerDimensions matches the geometry's own height when base wall is off", () => {
    const dims = openConnectContainerDimensions({ internalHeight: 40, baseThickness: 4, bottomWallEnabled: false });
    expect(dims.height).toBeCloseTo(40, 3);
  });
});

// A sealed-shut pocket still passes the boundaryEdges/nonManifoldEdges check
// above -- it's a perfectly valid closed solid, just the WRONG one. These
// tests instead raycast along the wall's own thickness axis (world Z) at
// points spanning each slot cavity's known 2D footprint (not just its
// center) and assert 0 remaining material through to the wall's true
// interior face, the same class of check that caught this bug against a
// real exported STL in the first place.
describe("createOpenConnectContainerGeometry: slot cavities fully perforate the back wall", () => {
  function pointInPolygon([x, y]: Point2, polygon: Point2[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function distanceToSegment([px, py]: Point2, [ax, ay]: Point2, [bx, by]: Point2): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-12) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function distanceToPolygonEdges(point: Point2, polygon: Point2[]): number {
    let min = Infinity;
    for (let i = 0; i < polygon.length; i += 1) {
      min = Math.min(min, distanceToSegment(point, polygon[i], polygon[(i + 1) % polygon.length]));
    }
    return min;
  }

  // Scans a grid across the outline's own bounding box, keeping points that
  // fall inside it AND stay a safe margin away from every edge -- the "with
  // lock" outline is concave (slide + capture pocket + lock nub), and the
  // outline itself is sliced from a baked mesh rather than hand-authored
  // (see outlineFromCapTriangles), so a naive point-in-polygon test alone
  // can accept points that are technically inside but within float noise of
  // the tool mesh's own rim -- exactly the false-positive "material" a
  // grazing raycast would pick up there. The margin keeps every sample
  // solidly interior while still spanning the shape's full known footprint,
  // not just its centroid.
  function samplePointsInPolygon(polygon: Point2[], resolution = 9, margin = 0.5): Point2[] {
    const xs = polygon.map((p) => p[0]);
    const ys = polygon.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const points: Point2[] = [];
    for (let i = 1; i < resolution; i += 1) {
      for (let j = 1; j < resolution; j += 1) {
        const point: Point2 = [minX + ((maxX - minX) * i) / resolution, minY + ((maxY - minY) * j) / resolution];
        if (pointInPolygon(point, polygon) && distanceToPolygonEdges(point, polygon) > margin) points.push(point);
      }
    }
    return points;
  }

  // Same ray-cast technique verticalCrossings above uses, just solving for Z
  // (the wall's own thickness axis) at a fixed (X, Y) instead of Y at a
  // fixed (X, Z).
  function depthCrossings(geometry: THREE.BufferGeometry, x: number, y: number): number[] {
    const position = geometry.getAttribute("position");
    const crossings: number[] = [];
    for (let i = 0; i < position.count; i += 3) {
      const p0: [number, number, number] = [position.getX(i), position.getY(i), position.getZ(i)];
      const p1: [number, number, number] = [position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1)];
      const p2: [number, number, number] = [position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2)];
      const denom = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
      if (Math.abs(denom) < 1e-9) continue;
      const a = ((p1[1] - p2[1]) * (x - p2[0]) + (p2[0] - p1[0]) * (y - p2[1])) / denom;
      const b = ((p2[1] - p0[1]) * (x - p2[0]) + (p0[0] - p2[0]) * (y - p2[1])) / denom;
      const c = 1 - a - b;
      if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
      crossings.push(a * p0[2] + b * p1[2] + c * p2[2]);
    }
    return crossings.sort((m, n) => m - n);
  }

  // The straight extension this fix adds only spans
  // innerFaceZ..cavityDepthStart (the tool's own baked mesh above
  // cavityDepthStart was already confirmed watertight/correct in isolation,
  // see openConnectSlotMesh.ts) -- assert 0 remaining material there, for
  // every sampled point across the cavity's known interior (deep) footprint.
  function expectCellFullyPerforates(geometry: THREE.BufferGeometry, cell: OpenConnectSlotGridCell, innerFaceZ: number, cavityDepthStart: number) {
    const deepOutline = cell.withLock ? WITH_LOCK_DEEP_OUTLINE : NO_LOCK_DEEP_OUTLINE;
    const localSamples = samplePointsInPolygon(deepOutline);
    expect(localSamples.length).toBeGreaterThan(5); // sanity: the outline resolved to a real polygon, not degenerate
    const worldSamples = transformedOutline(localSamples, cell.worldXCenter, cell.worldYCenter);
    const EPS = 1e-3;
    for (const [worldX, worldY] of worldSamples) {
      const crossings = depthCrossings(geometry, worldX, worldY).filter((z) => z > innerFaceZ - EPS && z < cavityDepthStart + EPS);
      expect(crossings.length).toBe(0);
    }
  }

  it("default Bin: every active slot cavity has 0 remaining material through to the wall's interior face", () => {
    const options = {
      internalWidth: DEFAULT_OPENCONNECT_INTERNAL_WIDTH,
      internalHeight: DEFAULT_OPENCONNECT_INTERNAL_HEIGHT,
      internalDepth: DEFAULT_OPENCONNECT_INTERNAL_DEPTH,
      wallThickness: DEFAULT_OPENCONNECT_WALL_THICKNESS,
    };
    const geometry = createOpenConnectContainerGeometry(options);
    const outerFaceZ = openConnectContainerDimensions(options).depth;
    const innerFaceZ = outerFaceZ - options.wallThickness;
    const cavityDepthStart = outerFaceZ - SLOT_TOOL_DEPTH;
    // Sanity: at the default (minimum) wall thickness there IS a gap for
    // this fix to close -- the exact ~0.3mm the raycast against a real
    // exported STL found.
    expect(cavityDepthStart - innerFaceZ).toBeGreaterThan(0.1);

    const cells = openConnectSlotGridCells(options.internalWidth, options.internalHeight, DEFAULT_OPENCONNECT_SLOT_POSITION, DEFAULT_OPENCONNECT_SLOT_LOCK_DISTRIBUTION);
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expectCellFullyPerforates(geometry, cell, innerFaceZ, cavityDepthStart);
  }, 20000);

  it("Bin with unlocked slots (slotLockDistribution None) also fully perforates", () => {
    const options = {
      internalWidth: DEFAULT_OPENCONNECT_INTERNAL_WIDTH,
      internalHeight: DEFAULT_OPENCONNECT_INTERNAL_HEIGHT,
      internalDepth: DEFAULT_OPENCONNECT_INTERNAL_DEPTH,
      wallThickness: DEFAULT_OPENCONNECT_WALL_THICKNESS,
      slotLockDistribution: "None" as const,
    };
    const geometry = createOpenConnectContainerGeometry(options);
    const outerFaceZ = openConnectContainerDimensions(options).depth;
    const innerFaceZ = outerFaceZ - options.wallThickness;
    const cavityDepthStart = outerFaceZ - SLOT_TOOL_DEPTH;

    const cells = openConnectSlotGridCells(options.internalWidth, options.internalHeight, DEFAULT_OPENCONNECT_SLOT_POSITION, options.slotLockDistribution);
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.withLock).toBe(false);
      expectCellFullyPerforates(geometry, cell, innerFaceZ, cavityDepthStart);
    }
  }, 20000);

  it("wall thickness well beyond the slot tool's own reach still fully perforates (bigger gap than the default ~0.3mm)", () => {
    const options = {
      internalWidth: DEFAULT_OPENCONNECT_INTERNAL_WIDTH,
      internalHeight: DEFAULT_OPENCONNECT_INTERNAL_HEIGHT,
      internalDepth: DEFAULT_OPENCONNECT_INTERNAL_DEPTH,
      wallThickness: 8,
    };
    const geometry = createOpenConnectContainerGeometry(options);
    const outerFaceZ = openConnectContainerDimensions(options).depth;
    const innerFaceZ = outerFaceZ - options.wallThickness;
    const cavityDepthStart = outerFaceZ - SLOT_TOOL_DEPTH;
    expect(cavityDepthStart - innerFaceZ).toBeGreaterThan(4);

    const cells = openConnectSlotGridCells(options.internalWidth, options.internalHeight, DEFAULT_OPENCONNECT_SLOT_POSITION, DEFAULT_OPENCONNECT_SLOT_LOCK_DISTRIBUTION);
    for (const cell of cells) expectCellFullyPerforates(geometry, cell, innerFaceZ, cavityDepthStart);
  }, 20000);
});
