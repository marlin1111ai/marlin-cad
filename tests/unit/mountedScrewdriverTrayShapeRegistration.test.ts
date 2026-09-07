import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createMountedScrewdriverTrayGeometryForShape,
  DEFAULT_MOUNTED_SCREWDRIVER_TRAY_SHAPE_HOLES,
  makeShapeFromAsset,
  mountedScrewdriverTrayLayoutError,
  mountedScrewdriverTrayOptionsForShape,
  toolbarShapeAssetGroups,
  toolbarShapeAssets,
} from "@/lib/shapeCatalog";
import { createMountedScrewdriverTrayGeometry, mountedScrewdriverTrayPositions, mountedScrewdriverTraySlotCenters } from "@/lib/mountedScrewdriverTrayGeometry";
import { exportMeshesToStl } from "@/lib/stlExport";
import { exportSkfProject, importSkfProject } from "@/lib/skfProject";
import { fallbackSolidColor, shapeWidth, workplaneShapesEqual } from "@/lib/workplaneShapes";
import { DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import { analyzeTriangleSoup } from "@/lib/svgImport";
import type { WorkplaneShape } from "@/types/sketchforge";

const ASSET = toolbarShapeAssets.find((asset) => asset.kind === "mountedScrewdriverTray")!;

const PLATE_WIDTH = 240;
const TRAY_THICKNESS = 18;
const MOUNTING_FACE_Z = 70; // tray depth 60 + plate thickness 10

function trayShape(overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return { ...makeShapeFromAsset(ASSET), id: "mounted-screwdriver-tray-1", ...overrides };
}

// Vertical raycast along Y at (x, z), against the geometry the APP builds
// rather than the module's direct output: a sealed-shut bore still passes every
// manifold check (CLAUDE-LESSONS.md).
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

// Reproduces the editor's module-private export arm (buildGeometryMeshForShape
// -> bufferGeometryToMeshData -> transformMesh -> exportMeshesToStl) on the
// app's own geometry helper, then calls the REAL exporter. For a default insert
// at x=0, z=0, elevation 0 with no rotation or mirror, transformMesh is the
// identity and the Y-rebase is a no-op.
function appExportStl(shape: WorkplaneShape) {
  const geometry = createMountedScrewdriverTrayGeometryForShape(shape);
  const prepared = geometry.index ? geometry.toNonIndexed() : geometry;
  prepared.computeBoundingBox();
  expect(Math.abs(prepared.boundingBox?.min.y ?? 0)).toBeLessThanOrEqual(0.000001);
  expect(shape.x).toBe(0);
  expect(shape.z).toBe(0);
  expect(shape.elevation ?? 0).toBe(0);
  const position = prepared.getAttribute("position");
  const vertices: [number, number, number][] = [];
  const faces: [number, number, number][] = [];
  for (let i = 0; i < position.count; i += 1) vertices.push([position.getX(i), position.getY(i), position.getZ(i)]);
  for (let i = 0; i + 2 < position.count; i += 3) faces.push([i, i + 1, i + 2]);
  return exportMeshesToStl([{ vertices, faces }]);
}

function facetCount(text: string) {
  return (text.match(/^\s*facet normal /gm) ?? []).length;
}

describe("mounted screwdriver tray registration", () => {
  it("is registered in the OpenGrid category with its own kind and color", () => {
    expect(ASSET).toBeDefined();
    expect(ASSET.name).toBe("Mounted Screwdriver Tray");
    expect(ASSET.category).toBe("OpenGrid");
    const colors = toolbarShapeAssets.filter((asset) => asset.category === "OpenGrid").map((asset) => asset.color);
    expect(new Set(colors).size).toBe(colors.length); // no color reuse in the category
    expect(fallbackSolidColor({ kind: "mountedScrewdriverTray" } as WorkplaneShape)).toBe(ASSET.color);
    const openGrid = toolbarShapeAssetGroups.find((group) => group.category === "OpenGrid")!;
    expect(openGrid.shapes.map((shape) => shape.id)).toContain("mounted-screwdriver-tray");
  });

  it("inserts the wrench-rack plate with three through-bores by default", () => {
    const placed = makeShapeFromAsset(ASSET, { x: 0, z: 0 });
    expect(placed).toMatchObject({
      kind: "mountedScrewdriverTray",
      name: "Mounted Screwdriver Tray",
      width: PLATE_WIDTH,
      height: 60,
      depth: MOUNTING_FACE_Z,
      mountedScrewdriverTrayPlateThickness: 10,
      mountedScrewdriverTraySlotSpacing: 28,
      mountedScrewdriverTraySlotCount: 8,
      mountedScrewdriverTrayProjection: 60,
      mountedScrewdriverTrayThickness: TRAY_THICKNESS,
      mountedScrewdriverTrayCornerRadius: 0,
      mountedScrewdriverTrayHoles: [
        { diameter: 8, x: 30, z: 30 },
        { diameter: 10, x: 120, z: 30 },
        { diameter: 12, x: 210, z: 30 },
      ],
    });
    // The insert owns its own hole array, not the shared default constant.
    expect(placed.mountedScrewdriverTrayHoles).not.toBe(DEFAULT_MOUNTED_SCREWDRIVER_TRAY_SHAPE_HOLES);
    // No pocket-depth field exists on this shape, shared or per row.
    expect("mountedScrewdriverTrayPocketDepth" in placed).toBe(false);
    expect(placed.mountedScrewdriverTrayHoles!.every((hole) => !("depth" in hole))).toBe(true);
    expect(() => mountedScrewdriverTrayPositions(mountedScrewdriverTrayOptionsForShape(placed))).not.toThrow();
    expect(mountedScrewdriverTrayLayoutError(placed)).toBeNull();
  });

  it("maps shape fields to the module's options (no depth anywhere; hole x stays in view space)", () => {
    const options = mountedScrewdriverTrayOptionsForShape(
      trayShape({
        width: 200,
        height: 50,
        mountedScrewdriverTrayPlateThickness: 8,
        mountedScrewdriverTraySlotSpacing: 30,
        mountedScrewdriverTraySlotCount: 5,
        mountedScrewdriverTrayProjection: 55,
        mountedScrewdriverTrayThickness: 14,
        mountedScrewdriverTrayCornerRadius: 3,
        mountedScrewdriverTrayHoles: [{ diameter: 6, x: 40, z: 25 }],
      }),
    );
    expect(options).toEqual({
      plateWidth: 200,
      plateHeight: 50,
      plateThickness: 8,
      slotSpacing: 30,
      slotCount: 5,
      trayDepth: 55,
      trayThickness: 14,
      cornerRadius: 3,
      // View space, unmirrored -- the geometry module owns the mirror.
      holes: [{ diameter: 6, x: 40, z: 25 }],
    });
  });

  it("round-trips through .skf persistence with every field intact", async () => {
    const original = trayShape({ mountedScrewdriverTrayCornerRadius: 3, mountedScrewdriverTrayHoles: [{ diameter: 6, x: 40, z: 25 }, { diameter: 9.5, x: 100, z: 35 }] });
    const bytes = await exportSkfProject({
      projectId: "mounted-screwdriver-tray-registration-test",
      projectName: "Mounted screwdriver tray registration",
      createdAt: 1_700_000_000_000,
      modifiedAt: 1_700_000_000_100,
      shapes: [original],
      assets: [],
      workspace: DEFAULT_WORKPLANE_WORKSPACE,
      snapGrid: DEFAULT_SNAP_GRID,
      placementElevation: 0,
    });
    const restored = (await importSkfProject(bytes)).shapes[0];
    expect(restored.kind).toBe("mountedScrewdriverTray");
    expect(restored.mountedScrewdriverTrayPlateThickness).toBe(10);
    expect(restored.mountedScrewdriverTraySlotCount).toBe(8);
    expect(restored.mountedScrewdriverTrayThickness).toBe(TRAY_THICKNESS);
    expect(restored.mountedScrewdriverTrayCornerRadius).toBe(3);
    expect(restored.mountedScrewdriverTrayHoles).toEqual(original.mountedScrewdriverTrayHoles);
    expect(workplaneShapesEqual({ ...restored, mountedScrewdriverTrayHoles: original.mountedScrewdriverTrayHoles }, original)).toBe(true);
    expect(mountedScrewdriverTrayOptionsForShape(restored)).toEqual(mountedScrewdriverTrayOptionsForShape(original));
  });

  it("workplaneShapesEqual notices a change to any mounted-screwdriver-tray field", () => {
    const shape = trayShape();
    expect(workplaneShapesEqual(shape, { ...shape, mountedScrewdriverTraySlotCount: 7 })).toBe(false);
    expect(workplaneShapesEqual(shape, { ...shape, mountedScrewdriverTrayProjection: 70 })).toBe(false);
    expect(workplaneShapesEqual(shape, { ...shape, mountedScrewdriverTrayThickness: 20 })).toBe(false);
    expect(workplaneShapesEqual(shape, { ...shape, mountedScrewdriverTrayHoles: [] })).toBe(false);
    expect(workplaneShapesEqual(shape, { ...shape, mountedScrewdriverTrayCornerRadius: 2 })).toBe(false);
  });

  it("render/export helper: the app's geometry for a default insert is byte-identical to the module's direct output", () => {
    const appPositions = createMountedScrewdriverTrayGeometryForShape(makeShapeFromAsset(ASSET)).getAttribute("position").array as Float32Array;
    const directPositions = createMountedScrewdriverTrayGeometry({
      plateWidth: PLATE_WIDTH,
      plateHeight: 60,
      plateThickness: 10,
      slotSpacing: 28,
      slotCount: 8,
      trayDepth: 60,
      trayThickness: TRAY_THICKNESS,
      cornerRadius: 0,
      holes: [
        { diameter: 8, x: 30, z: 30 },
        { diameter: 10, x: 120, z: 30 },
        { diameter: 12, x: 210, z: 30 },
      ],
    }).getAttribute("position").array as Float32Array;
    expect(appPositions.length).toBe(directPositions.length);
    expect(appPositions.every((value, index) => Object.is(value, directPositions[index]))).toBe(true);
    let minY = Infinity;
    for (let i = 1; i < appPositions.length; i += 3) minY = Math.min(minY, appPositions[i]);
    expect(minY).toBe(0);
  });

  it("exports through the real STL writer as one watertight solid", () => {
    const stl = appExportStl(trayShape());
    expect(stl.startsWith("solid sketchforge_design")).toBe(true);
    expect(stl.trimEnd().endsWith("endsolid sketchforge_design")).toBe(true);
    const positions = Array.from(createMountedScrewdriverTrayGeometryForShape(trayShape()).getAttribute("position").array);
    expect(facetCount(stl)).toBe(positions.length / 9);
    const analysis = analyzeTriangleSoup(positions);
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  });

  // Hole x is in as-mounted view space and the module mirrors it into geometry
  // space (x_geometry = plateWidth - x_viewed), so a raycast aimed in geometry
  // space must mirror too -- see the MOUNTED-VIEW X CONVENTION block in
  // mountedScrewdriverTrayGeometry.ts.
  it("the default insert's bores are open all the way through in the app's own geometry, at their MIRRORED positions", () => {
    const geometry = createMountedScrewdriverTrayGeometryForShape(trayShape());
    const plateWidth = shapeWidth(trayShape());
    for (const hole of DEFAULT_MOUNTED_SCREWDRIVER_TRAY_SHAPE_HOLES) {
      expect(verticalCrossings(geometry, plateWidth - hole.x, hole.z), `bore d=${hole.diameter}`).toEqual([]);
    }
    // Between bores the shelf is a solid slab.
    for (const x of [75, 165]) {
      const crossings = verticalCrossings(geometry, x, 30);
      expect(crossings.length, `x=${x}`).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 4);
      expect(crossings[1]).toBeCloseTo(TRAY_THICKNESS, 4);
    }
  });

  // The mirror, proved through the APP's own path with an asymmetric layout the
  // default insert cannot supply (30/120/210 viewed maps onto the same set in
  // geometry).
  it("a hole typed at viewed x=40 opens at geometry x=200 and leaves x=40 solid", () => {
    const shape = trayShape({ mountedScrewdriverTrayHoles: [{ diameter: 10, x: 40, z: 30 }] });
    const geometry = createMountedScrewdriverTrayGeometryForShape(shape);
    expect(verticalCrossings(geometry, PLATE_WIDTH - 40, 30)).toEqual([]);
    const unmirrored = verticalCrossings(geometry, 40, 30);
    expect(unmirrored.length).toBe(2);
    expect(unmirrored[0]).toBeCloseTo(0, 4);
    expect(unmirrored[1]).toBeCloseTo(TRAY_THICKNESS, 4);
  });

  it("falls back to a renderable solid on an invalid layout and reports it inline", () => {
    const overlapping = trayShape({ mountedScrewdriverTrayHoles: [{ diameter: 20, x: 100, z: 30 }, { diameter: 20, x: 108, z: 30 }] });
    expect(mountedScrewdriverTrayLayoutError(overlapping)).toMatch(/overlap/i);
    expect(() => createMountedScrewdriverTrayGeometryForShape(overlapping)).not.toThrow();

    const offEdge = trayShape({ mountedScrewdriverTrayHoles: [{ diameter: 20, x: 6, z: 30 }] });
    expect(mountedScrewdriverTrayLayoutError(offEdge)).toMatch(/too close to the tray edge/i);

    // The guard that replaces the socket trays' minimum-floor guard.
    const thinTray = trayShape({ mountedScrewdriverTrayThickness: 8 });
    expect(mountedScrewdriverTrayLayoutError(thinTray)).toMatch(/Tray Thickness must be at least 10mm/i);
    expect(() => createMountedScrewdriverTrayGeometryForShape(thinTray)).not.toThrow();

    const tooManySlots = trayShape({ mountedScrewdriverTraySlotCount: 9 });
    expect(mountedScrewdriverTrayLayoutError(tooManySlots)).toMatch(/Too many slots/i);
    expect(() => createMountedScrewdriverTrayGeometryForShape(tooManySlots)).not.toThrow();

    const fatTray = trayShape({ mountedScrewdriverTrayThickness: 60, mountedScrewdriverTrayHoles: [] });
    expect(mountedScrewdriverTrayLayoutError(fatTray)).toMatch(/less than Plate Height/i);
    expect(() => createMountedScrewdriverTrayGeometryForShape(fatTray)).not.toThrow();

    expect(mountedScrewdriverTrayLayoutError(trayShape())).toBeNull();
  });

  it("a bare tray (no bores) still builds and reports no error", () => {
    const bare = trayShape({ mountedScrewdriverTrayHoles: [] });
    expect(mountedScrewdriverTrayLayoutError(bare)).toBeNull();
    const analysis = analyzeTriangleSoup(mountedScrewdriverTrayPositions(mountedScrewdriverTrayOptionsForShape(bare)));
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  });

  it("slot centers on the default insert are the validated wrench-rack layout", () => {
    const shape = trayShape();
    const centers = mountedScrewdriverTraySlotCenters(shapeWidth(shape), shape.mountedScrewdriverTraySlotSpacing!, shape.mountedScrewdriverTraySlotCount!);
    expect(centers[0]).toBeCloseTo(22, 9);
    expect(centers[centers.length - 1]).toBeCloseTo(218, 9);
  });

  it("leaves the three existing trays' registration untouched", () => {
    const socket = toolbarShapeAssets.find((asset) => asset.kind === "socketTray")!;
    const mountedSocket = toolbarShapeAssets.find((asset) => asset.kind === "mountedSocketTray")!;
    const flatScrewdriver = toolbarShapeAssets.find((asset) => asset.kind === "screwdriverTray")!;
    expect(socket.color).toBe("#3b82f6");
    expect(mountedSocket.color).toBe("#0ea5a4");
    expect(flatScrewdriver.color).toBe("#db2777");
    expect(makeShapeFromAsset(socket)).toMatchObject({ kind: "socketTray", socketTrayPocketDepth: 14 });
    expect(makeShapeFromAsset(mountedSocket)).toMatchObject({ kind: "mountedSocketTray", mountedTrayPocketDepth: 14, mountedTrayThickness: 18 });
    expect(makeShapeFromAsset(flatScrewdriver)).toMatchObject({ kind: "screwdriverTray", width: 240, depth: 60, height: 18 });
    // And the new shape carries none of their fields.
    const placed = makeShapeFromAsset(ASSET);
    expect(placed.socketTrayPockets).toBeUndefined();
    expect(placed.mountedTrayPockets).toBeUndefined();
    expect(placed.mountedTrayPocketDepth).toBeUndefined();
    expect(placed.screwdriverTrayHoles).toBeUndefined();
  });
});
