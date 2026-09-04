import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createMountedSocketTrayGeometryForShape,
  DEFAULT_MOUNTED_SOCKET_TRAY_SHAPE_POCKETS,
  makeShapeFromAsset,
  mountedSocketTrayLayoutError,
  mountedSocketTrayOptionsForShape,
  toolbarShapeAssetGroups,
  toolbarShapeAssets,
} from "@/lib/shapeCatalog";
import { createMountedSocketTrayGeometry, mountedSocketTrayPositions } from "@/lib/mountedSocketTrayGeometry";
import { exportMeshesToStl } from "@/lib/stlExport";
import { exportSkfProject, importSkfProject } from "@/lib/skfProject";
import { fallbackSolidColor, workplaneShapesEqual } from "@/lib/workplaneShapes";
import { DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import { analyzeTriangleSoup } from "@/lib/svgImport";
import type { WorkplaneShape } from "@/types/sketchforge";

const ASSET = toolbarShapeAssets.find((asset) => asset.kind === "mountedSocketTray")!;

function trayShape(overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return { ...makeShapeFromAsset(ASSET), id: "mounted-socket-tray-1", ...overrides };
}

// Vertical raycast along Y at (x, z), against the geometry the APP builds
// rather than the module's direct output: a sealed-shut pocket still passes
// every manifold check (CLAUDE-LESSONS.md).
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

// Reproduces the editor's module-private export arm
// (buildGeometryMeshForShape -> bufferGeometryToMeshData -> transformMesh ->
// exportMeshesToStl) on the app's own geometry helper, then calls the REAL
// exporter. For a default insert at x=0, z=0, elevation 0 with no rotation or
// mirror, transformMesh is the identity and the Y-rebase is a no-op.
function appExportStl(shape: WorkplaneShape) {
  const geometry = createMountedSocketTrayGeometryForShape(shape);
  const prepared = geometry.index ? geometry.toNonIndexed() : geometry;
  prepared.computeBoundingBox();
  expect(Math.abs(prepared.boundingBox?.min.y ?? 0)).toBeLessThanOrEqual(1e-6);
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

describe("mounted socket tray registration", () => {
  it("is registered in the OpenGrid category with its own kind and colour", () => {
    expect(ASSET).toBeDefined();
    expect(ASSET.name).toBe("Mounted Socket Tray");
    expect(ASSET.category).toBe("OpenGrid");
    const colors = toolbarShapeAssets.filter((asset) => asset.category === "OpenGrid").map((asset) => asset.color);
    expect(new Set(colors).size).toBe(colors.length); // no colour reuse in the category
    expect(fallbackSolidColor({ kind: "mountedSocketTray" } as WorkplaneShape)).toBe(ASSET.color);
    const openGrid = toolbarShapeAssetGroups.find((group) => group.category === "OpenGrid")!;
    expect(openGrid.shapes.map((shape) => shape.id)).toContain("mounted-socket-tray");
  });

  it("leaves the flat Socket Tray registration untouched", () => {
    const flat = toolbarShapeAssets.find((asset) => asset.kind === "socketTray")!;
    expect(flat.id).toBe("socket-tray");
    expect(flat.name).toBe("Socket Tray");
    expect(flat.color).toBe("#3b82f6");
    const placed = makeShapeFromAsset(flat);
    expect(placed).toMatchObject({ kind: "socketTray", width: 240, depth: 60, height: 18, socketTrayPocketDepth: 14 });
    expect(placed.socketTrayPockets).toHaveLength(6);
    // The mounted tray's own fields never leak onto the flat tray.
    expect(placed.mountedTrayPockets).toBeUndefined();
    expect(placed.mountedTrayPlateThickness).toBeUndefined();
  });

  it("inserts the 3-pocket coupon by default (plate 240 x 60 x 10, 8 slots at 28mm; tray 60 deep, 18 thick)", () => {
    const placed = makeShapeFromAsset(ASSET, { x: 0, z: 0 });
    expect(placed).toMatchObject({
      kind: "mountedSocketTray",
      name: "Mounted Socket Tray",
      width: 240, // plate width
      height: 60, // plate height (the Y-up dimension)
      depth: 70, // full Z extent: tray projection 60 + plate thickness 10
      mountedTrayPlateThickness: 10,
      mountedTraySlotSpacing: 28,
      mountedTraySlotCount: 8,
      mountedTrayProjection: 60,
      mountedTrayThickness: 18,
      mountedTrayPocketDepth: 14,
      mountedTrayPockets: [
        { diameter: 14, x: 30, z: 30 },
        { diameter: 19, x: 120, z: 30 },
        { diameter: 25, x: 210, z: 30 },
      ],
    });
    // Floor left under each pocket: tray thickness minus pocket depth.
    expect(placed.mountedTrayThickness! - placed.mountedTrayPocketDepth!).toBe(4);
    // The insert owns its own array rather than aliasing the shared constant.
    expect(placed.mountedTrayPockets).not.toBe(DEFAULT_MOUNTED_SOCKET_TRAY_SHAPE_POCKETS);
    expect(mountedSocketTrayLayoutError(placed)).toBeNull();
  });

  it("maps shape fields to geometry options (plate width -> X, plate height -> Y-up, dedicated fields for the rest)", () => {
    const shape = trayShape();
    expect(mountedSocketTrayOptionsForShape(shape)).toEqual({
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
    });
    expect(mountedSocketTrayOptionsForShape(trayShape({ mountedTrayPockets: [] })).pockets).toEqual([]);
  });

  it("shape.depth stays equal to the solid's Z extent for the default insert", () => {
    const geometry = createMountedSocketTrayGeometryForShape(trayShape());
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeCloseTo(trayShape().depth, 4);
  });

  it("the app's geometry is identical to the module's direct output for the same options", () => {
    const shape = trayShape();
    const viaApp = createMountedSocketTrayGeometryForShape(shape).getAttribute("position").array;
    const viaModule = createMountedSocketTrayGeometry(mountedSocketTrayOptionsForShape(shape)).getAttribute("position").array;
    expect(viaApp.length).toBe(viaModule.length);
    for (let i = 0; i < viaApp.length; i += 1) {
      expect(Object.is(viaApp[i], viaModule[i]), `float ${i} should match exactly`).toBe(true);
    }
  });

  it("round-trips through .skf with both the scalars and the pocket list preserved", async () => {
    const shape = trayShape();
    const bytes = await exportSkfProject({
      projectId: "mounted-socket-tray-registration-test",
      projectName: "Mounted socket tray registration",
      createdAt: 1_700_000_000_000,
      modifiedAt: 1_700_000_000_100,
      shapes: [shape],
      assets: [],
      workspace: DEFAULT_WORKPLANE_WORKSPACE,
      snapGrid: DEFAULT_SNAP_GRID,
      placementElevation: 0,
    });
    const restored = (await importSkfProject(bytes)).shapes[0];
    expect(restored.kind).toBe("mountedSocketTray");
    expect(restored.mountedTrayPlateThickness).toBe(10);
    expect(restored.mountedTraySlotSpacing).toBe(28);
    expect(restored.mountedTraySlotCount).toBe(8);
    expect(restored.mountedTrayProjection).toBe(60);
    expect(restored.mountedTrayThickness).toBe(18);
    expect(restored.mountedTrayPocketDepth).toBe(14);
    expect(restored.mountedTrayPockets).toEqual(shape.mountedTrayPockets);
    expect(workplaneShapesEqual({ ...restored, mountedTrayPockets: shape.mountedTrayPockets }, shape)).toBe(true);
    expect(mountedSocketTrayOptionsForShape(restored)).toEqual(mountedSocketTrayOptionsForShape(shape));
  });

  it("workplaneShapesEqual notices a change to any mounted-tray field", () => {
    const shape = trayShape();
    expect(workplaneShapesEqual(shape, { ...shape, mountedTraySlotCount: 7 })).toBe(false);
    expect(workplaneShapesEqual(shape, { ...shape, mountedTrayProjection: 70 })).toBe(false);
    expect(workplaneShapesEqual(shape, { ...shape, mountedTrayPockets: [] })).toBe(false);
  });

  it("exports through the real STL writer as one watertight solid", () => {
    const stl = appExportStl(trayShape());
    expect(stl.startsWith("solid sketchforge_design")).toBe(true);
    expect(stl.trimEnd().endsWith("endsolid sketchforge_design")).toBe(true);
    const geometry = createMountedSocketTrayGeometryForShape(trayShape());
    const positions = Array.from(geometry.getAttribute("position").array);
    expect(facetCount(stl)).toBe(positions.length / 9);
    const analysis = analyzeTriangleSoup(positions);
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  });

  it("the default insert's pockets are genuinely open blind pockets in the app's own geometry", () => {
    const geometry = createMountedSocketTrayGeometryForShape(trayShape());
    for (const pocket of DEFAULT_MOUNTED_SOCKET_TRAY_SHAPE_POCKETS) {
      const crossings = verticalCrossings(geometry, pocket.x, pocket.z);
      expect(crossings.length, `pocket d=${pocket.diameter}`).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 4); // tray bottom
      expect(crossings[1]).toBeCloseTo(4, 4); // pocket floor at 18 - 14
    }
  });

  it("falls back to a renderable solid on an invalid layout and reports it inline", () => {
    const overlapping = trayShape({
      mountedTrayPockets: [
        { diameter: 20, x: 100, z: 30 },
        { diameter: 20, x: 108, z: 30 },
      ],
    });
    expect(mountedSocketTrayLayoutError(overlapping)).toMatch(/overlap/i);
    expect(() => createMountedSocketTrayGeometryForShape(overlapping)).not.toThrow();

    const offEdge = trayShape({ mountedTrayPockets: [{ diameter: 20, x: 6, z: 30 }] });
    expect(mountedSocketTrayLayoutError(offEdge)).toMatch(/too close to the tray edge/i);

    const thinFloor = trayShape({ mountedTrayThickness: 15 });
    expect(mountedSocketTrayLayoutError(thinFloor)).toMatch(/minimum floor/i);

    const tooManySlots = trayShape({ mountedTraySlotCount: 9 });
    expect(mountedSocketTrayLayoutError(tooManySlots)).toMatch(/Too many slots/i);
    expect(() => createMountedSocketTrayGeometryForShape(tooManySlots)).not.toThrow();

    const fatTray = trayShape({ mountedTrayThickness: 60, mountedTrayPockets: [] });
    expect(mountedSocketTrayLayoutError(fatTray)).toMatch(/less than Plate Height/i);
    expect(() => createMountedSocketTrayGeometryForShape(fatTray)).not.toThrow();
  });

  it("a bare tray (no pockets) still builds and reports no error", () => {
    const bare = trayShape({ mountedTrayPockets: [] });
    expect(mountedSocketTrayLayoutError(bare)).toBeNull();
    const analysis = analyzeTriangleSoup(mountedSocketTrayPositions(mountedSocketTrayOptionsForShape(bare)));
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  });
});
