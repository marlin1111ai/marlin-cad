import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createGridfinitySocketTrayGeometryForShape,
  DEFAULT_GRIDFINITY_SOCKET_TRAY_SHAPE_HOLES,
  gridfinitySocketTrayLayoutError,
  gridfinitySocketTrayOptionsForShape,
  gridfinitySocketTrayShapeSize,
  makeShapeFromAsset,
  nextGridfinitySocketTrayHole,
  toolbarShapeAssetGroups,
  toolbarShapeAssets,
} from "@/lib/shapeCatalog";
import { createGridfinitySocketTrayGeometry, gridfinitySocketTrayPositions } from "@/lib/gridfinitySocketTrayGeometry";
import { analyzeTriangleSoup } from "@/lib/svgImport";
import { exportMeshesToStl } from "@/lib/stlExport";
import { exportSkfProject, importSkfProject } from "@/lib/skfProject";
import { fallbackSolidColor, workplaneShapesEqual } from "@/lib/workplaneShapes";
import { DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import type { WorkplaneShape } from "@/types/sketchforge";

const ASSET = toolbarShapeAssets.find((asset) => asset.kind === "gridfinitySocketTray")!;

// What the default insert must reproduce (reference/DECISIONS.md,
// 2026-09-27): 3 x 2 squares, three holes labelled "8mm", "10mm" and "12mm"
// at the recorded finished pocket diameters for those sockets, Corner Radius
// 0, raised labels.
const DEFAULT_TRAY_OPTIONS = {
  squaresX: 3,
  squaresZ: 2,
  cornerRadius: 0,
  labelStyle: "raised" as const,
  holes: [
    { diameter: 15, x: 20.75, z: 41.75, label: "8mm" },
    { diameter: 19, x: 62.75, z: 41.75, label: "10mm" },
    { diameter: 19, x: 104.75, z: 41.75, label: "12mm" },
  ],
};
const WIDTH = 125.5;
const DEPTH = 83.5;
const TOP_Y = 22.75;
const FLOOR_Y = 8.75;

// The four existing trays' catalog entries, fallback colors and default
// inserts (every defined field except the random id), captured from the
// commit this shape was added on top of (b1cbb5f) by running
// makeShapeFromAsset there. Registering this shape must change none of it.
const EXISTING_TRAYS: Record<string, { asset: Record<string, unknown>; fallbackColor: string; insert: Record<string, unknown> }> = {
  "socketTray": {
    "asset": {
      "id": "socket-tray",
      "name": "Socket Tray",
      "src": "assets/sketchforge/shape-icons-gray/box.png",
      "menuIcon": "assets/sketchforge/shape-icons-gray/box.png",
      "kind": "socketTray",
      "color": "#3b82f6",
      "category": "OpenGrid"
    },
    "fallbackColor": "#3b82f6",
    "insert": {
      "name": "Socket Tray",
      "kind": "socketTray",
      "color": "#3b82f6",
      "x": 0,
      "z": 0,
      "elevation": 0,
      "size": 20,
      "width": 240,
      "depth": 60,
      "height": 18,
      "rotation": 0,
      "rotationX": 0,
      "rotationZ": 0,
      "socketTrayPocketDepth": 14,
      "socketTrayPockets": [
        {
          "diameter": 14,
          "x": 30,
          "z": 30
        },
        {
          "diameter": 15,
          "x": 66,
          "z": 30
        },
        {
          "diameter": 19,
          "x": 102,
          "z": 30
        },
        {
          "diameter": 20.7,
          "x": 138,
          "z": 30
        },
        {
          "diameter": 23,
          "x": 174,
          "z": 30
        },
        {
          "diameter": 25,
          "x": 210,
          "z": 30
        }
      ],
      "socketTrayCornerRadius": 0,
      "locked": false,
      "hidden": false
    }
  },
  "mountedSocketTray": {
    "asset": {
      "id": "mounted-socket-tray",
      "name": "Mounted Socket Tray",
      "src": "assets/sketchforge/shape-icons-gray/box.png",
      "menuIcon": "assets/sketchforge/shape-icons-gray/box.png",
      "kind": "mountedSocketTray",
      "color": "#0ea5a4",
      "category": "OpenGrid"
    },
    "fallbackColor": "#0ea5a4",
    "insert": {
      "name": "Mounted Socket Tray",
      "kind": "mountedSocketTray",
      "color": "#0ea5a4",
      "x": 0,
      "z": 0,
      "elevation": 0,
      "size": 20,
      "width": 240,
      "depth": 70,
      "height": 60,
      "rotation": 0,
      "rotationX": 0,
      "rotationZ": 0,
      "mountedTrayPlateThickness": 10,
      "mountedTraySlotSpacing": 28,
      "mountedTraySlotCount": 8,
      "mountedTrayProjection": 60,
      "mountedTrayThickness": 18,
      "mountedTrayPocketDepth": 14,
      "mountedTrayPockets": [
        {
          "diameter": 14,
          "x": 30,
          "z": 30
        },
        {
          "diameter": 19,
          "x": 120,
          "z": 30
        },
        {
          "diameter": 25,
          "x": 210,
          "z": 30
        }
      ],
      "mountedTrayCornerRadius": 0,
      "locked": false,
      "hidden": false
    }
  },
  "screwdriverTray": {
    "asset": {
      "id": "screwdriver-tray",
      "name": "Screwdriver Tray",
      "src": "assets/sketchforge/shape-icons-gray/box.png",
      "menuIcon": "assets/sketchforge/shape-icons-gray/box.png",
      "kind": "screwdriverTray",
      "color": "#db2777",
      "category": "OpenGrid"
    },
    "fallbackColor": "#db2777",
    "insert": {
      "name": "Screwdriver Tray",
      "kind": "screwdriverTray",
      "color": "#db2777",
      "x": 0,
      "z": 0,
      "elevation": 0,
      "size": 20,
      "width": 240,
      "depth": 60,
      "height": 18,
      "rotation": 0,
      "rotationX": 0,
      "rotationZ": 0,
      "screwdriverTrayHoles": [
        {
          "diameter": 8,
          "x": 30,
          "z": 30
        },
        {
          "diameter": 10,
          "x": 120,
          "z": 30
        },
        {
          "diameter": 12,
          "x": 210,
          "z": 30
        }
      ],
      "screwdriverTrayCornerRadius": 0,
      "locked": false,
      "hidden": false
    }
  },
  "mountedScrewdriverTray": {
    "asset": {
      "id": "mounted-screwdriver-tray",
      "name": "Mounted Screwdriver Tray",
      "src": "assets/sketchforge/shape-icons-gray/box.png",
      "menuIcon": "assets/sketchforge/shape-icons-gray/box.png",
      "kind": "mountedScrewdriverTray",
      "color": "#7c3aed",
      "category": "OpenGrid"
    },
    "fallbackColor": "#7c3aed",
    "insert": {
      "name": "Mounted Screwdriver Tray",
      "kind": "mountedScrewdriverTray",
      "color": "#7c3aed",
      "x": 0,
      "z": 0,
      "elevation": 0,
      "size": 20,
      "width": 240,
      "depth": 70,
      "height": 60,
      "rotation": 0,
      "rotationX": 0,
      "rotationZ": 0,
      "mountedScrewdriverTrayPlateThickness": 10,
      "mountedScrewdriverTraySlotSpacing": 28,
      "mountedScrewdriverTraySlotCount": 8,
      "mountedScrewdriverTrayProjection": 60,
      "mountedScrewdriverTrayThickness": 18,
      "mountedScrewdriverTrayHoles": [
        {
          "diameter": 8,
          "x": 30,
          "z": 30
        },
        {
          "diameter": 10,
          "x": 120,
          "z": 30
        },
        {
          "diameter": 12,
          "x": 210,
          "z": 30
        }
      ],
      "mountedScrewdriverTrayCornerRadius": 0,
      "locked": false,
      "hidden": false
    }
  }
};

function trayShape(overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return { ...makeShapeFromAsset(ASSET), id: "gridfinity-socket-tray-1", ...overrides };
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
    if (merged.length === 0 || Math.abs(y - merged[merged.length - 1]) > 1e-4) merged.push(y);
  }
  return merged;
}

// The editor's export arm is module-private (SketchForgeEditor.tsx
// buildGeometryMeshForShape -> bufferGeometryToMeshData -> transformMesh ->
// exportMeshesToStl). This reproduces its three operations on the app's
// geometry helper and then calls the REAL exporter, the same way the other
// trays' registration tests do.
function appExportStl(shape: WorkplaneShape) {
  const geometry = createGridfinitySocketTrayGeometryForShape(shape);
  const prepared = geometry.index ? geometry.toNonIndexed() : geometry;
  prepared.computeBoundingBox();
  const minY = prepared.boundingBox?.min.y ?? 0;
  expect(Math.abs(minY)).toBeLessThanOrEqual(0.000001); // rebase is a no-op: the feet stand on Y = 0
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

function asciiStlVertices(text: string): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(/^\s*vertex\s+(\S+)\s+(\S+)\s+(\S+)\s*$/gm)) {
    values.push(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  return values;
}

// Reads an exported ASCII STL back into SCENE coordinates: scene x = file x,
// scene y = file z, scene z = -file y.
function exportedStlToScenePositions(text: string): number[] {
  const file = asciiStlVertices(text);
  const scene: number[] = [];
  for (let i = 0; i < file.length; i += 3) scene.push(file[i], file[i + 2], 0 - file[i + 1]);
  return scene;
}

function positionsOf(geometry: THREE.BufferGeometry): Float32Array {
  return geometry.getAttribute("position").array as Float32Array;
}

describe("gridfinity socket tray registration", () => {
  it("is registered as \"Gridfinity Socket Tray\" in its own Gridfinity section", () => {
    expect(ASSET).toBeDefined();
    expect(ASSET.id).toBe("gridfinity-socket-tray");
    expect(ASSET.name).toBe("Gridfinity Socket Tray");
    expect(ASSET.category).toBe("Gridfinity");
    const section = toolbarShapeAssetGroups.find((group) => group.category === "Gridfinity")!;
    expect(section.shapes.map((shape) => shape.id)).toEqual(["gridfinity-socket-tray"]);
    // Its color is its own, and the fallback agrees with the catalog.
    expect(toolbarShapeAssets.filter((asset) => asset.color === ASSET.color)).toHaveLength(1);
    expect(fallbackSolidColor({ kind: "gridfinitySocketTray" } as WorkplaneShape)).toBe(ASSET.color);
  });

  it("inserts the owner's default: 3 x 2 squares, holes 15 / 19 / 19 labelled 8mm / 10mm / 12mm, Corner Radius 0, raised", () => {
    const placed = makeShapeFromAsset(ASSET, { x: 5, z: -3 });
    expect(placed).toMatchObject({
      kind: "gridfinitySocketTray",
      name: "Gridfinity Socket Tray",
      width: WIDTH,
      depth: DEPTH,
      height: TOP_Y + 0.8,
      gridfinityTraySquaresX: 3,
      gridfinityTraySquaresZ: 2,
      gridfinityTrayCornerRadius: 0,
      gridfinityTrayLabelStyle: "raised",
      gridfinityTrayHoles: DEFAULT_TRAY_OPTIONS.holes,
    });
    // The insert owns its own hole array, not the shared default constant.
    expect(placed.gridfinityTrayHoles).not.toBe(DEFAULT_GRIDFINITY_SOCKET_TRAY_SHAPE_HOLES);
    // No depth or height field of its own: hole depth and body height are fixed.
    expect(Object.keys(placed).filter((key) => key.startsWith("gridfinityTray")).sort()).toEqual([
      "gridfinityTrayCornerRadius",
      "gridfinityTrayHoles",
      "gridfinityTrayLabelStyle",
      "gridfinityTraySquaresX",
      "gridfinityTraySquaresZ",
    ]);
    expect(placed.gridfinityTrayHoles!.every((hole) => !("depth" in hole))).toBe(true);
    // A valid shape: the module accepts it and the inspector reports no error.
    expect(() => gridfinitySocketTrayPositions(gridfinitySocketTrayOptionsForShape(placed))).not.toThrow();
    expect(gridfinitySocketTrayLayoutError(placed)).toBeNull();
    // One evenly spaced row.
    const [a, b, c] = placed.gridfinityTrayHoles!;
    expect(b.x - a.x).toBe(c.x - b.x);
    expect(new Set([a.z, b.z, c.z]).size).toBe(1);
  });

  it("maps shape fields to the module's options: size from the squares, never from width / depth", () => {
    const holes = [{ diameter: 14, x: 30, z: 40, label: "5mm" }];
    const shape = trayShape({ width: 999, depth: 999, height: 999, gridfinityTraySquaresX: 4, gridfinityTraySquaresZ: 1, gridfinityTrayCornerRadius: 2, gridfinityTrayLabelStyle: "recessed", gridfinityTrayHoles: holes });
    expect(gridfinitySocketTrayOptionsForShape(shape)).toEqual({ squaresX: 4, squaresZ: 1, cornerRadius: 2, labelStyle: "recessed", holes });
    expect(gridfinitySocketTrayShapeSize(shape)).toEqual({ width: 167.5, depth: 41.5, height: TOP_Y });
    expect(gridfinitySocketTrayOptionsForShape(trayShape())).toEqual(DEFAULT_TRAY_OPTIONS);
  });

  it("derived size follows the squares and the label setting", () => {
    expect(gridfinitySocketTrayShapeSize(trayShape())).toEqual({ width: WIDTH, depth: DEPTH, height: TOP_Y + 0.8 });
    expect(gridfinitySocketTrayShapeSize(trayShape({ gridfinityTrayLabelStyle: "recessed" }))).toEqual({ width: WIDTH, depth: DEPTH, height: TOP_Y });
    expect(gridfinitySocketTrayShapeSize(trayShape({ gridfinityTrayHoles: [] }))).toEqual({ width: WIDTH, depth: DEPTH, height: TOP_Y });
    expect(gridfinitySocketTrayShapeSize(trayShape({ gridfinityTraySquaresX: 6, gridfinityTraySquaresZ: 5 }))).toMatchObject({ width: 251.5, depth: 209.5 });
    // And the mesh agrees with it.
    for (const labelStyle of ["raised", "recessed"] as const) {
      const shape = trayShape({ gridfinityTrayLabelStyle: labelStyle });
      const geometry = createGridfinitySocketTrayGeometryForShape(shape);
      const size = gridfinitySocketTrayShapeSize(shape);
      expect(geometry.boundingBox!.max.x).toBeCloseTo(size.width, 4);
      expect(geometry.boundingBox!.max.y).toBeCloseTo(size.height, 4);
      expect(geometry.boundingBox!.max.z).toBeCloseTo(size.depth, 4);
    }
  });

  it("Add Hole copies the last hole, just to its right, with a blank label", () => {
    const shape = trayShape();
    const added = nextGridfinitySocketTrayHole(shape);
    const last = shape.gridfinityTrayHoles![2];
    expect(added).toEqual({ diameter: 19, x: 104.75 + 19 + 3, z: 41.75, label: "" });
    expect(added.z).toBe(last.z);
    // It is exactly one gap from the last hole: moving it 0.1mm closer is rejected.
    const one = [{ diameter: 14, x: 30, z: 40, label: "5mm" }];
    const narrow = trayShape({ gridfinityTrayHoles: one });
    const next = nextGridfinitySocketTrayHole(narrow);
    expect(next).toEqual({ diameter: 14, x: 47, z: 40, label: "" });
    expect(gridfinitySocketTrayLayoutError({ ...narrow, gridfinityTrayHoles: [...one, next] })).toBeNull();
    expect(gridfinitySocketTrayLayoutError({ ...narrow, gridfinityTrayHoles: [...one, { ...next, x: next.x - 0.1 }] })).toMatch(/Holes 1 and 2 overlap/);
    // On the default insert the copy lands off the tray, and the app says so
    // rather than moving it.
    expect(gridfinitySocketTrayLayoutError({ ...shape, gridfinityTrayHoles: [...shape.gridfinityTrayHoles!, added] })).toMatch(/Hole 4 is too close to the tray edge/);
    // With a Corner Radius the widened rims are what is kept apart.
    expect(nextGridfinitySocketTrayHole({ ...narrow, gridfinityTrayCornerRadius: 1 }).x).toBe(30 + 14 + 2 + 3);
    // With no holes yet: a first hole, blank label.
    expect(nextGridfinitySocketTrayHole(trayShape({ gridfinityTrayHoles: [] }))).toEqual({ diameter: 15, x: 20.75, z: 41.75, label: "" });
  });

  it("round-trips through .skf persistence with squares, labels and the label setting intact", async () => {
    const original = trayShape({
      gridfinityTraySquaresX: 4,
      gridfinityTrayCornerRadius: 1.5,
      gridfinityTrayLabelStyle: "recessed",
      gridfinityTrayHoles: [{ diameter: 14, x: 30, z: 40, label: "5mm" }, { diameter: 20.7, x: 90, z: 45, label: "" }],
    });
    const bytes = await exportSkfProject({
      projectId: "gridfinity-socket-tray-registration-test",
      projectName: "Gridfinity socket tray registration",
      createdAt: 1_700_000_000_000,
      modifiedAt: 1_700_000_000_100,
      shapes: [original],
      assets: [],
      workspace: DEFAULT_WORKPLANE_WORKSPACE,
      snapGrid: DEFAULT_SNAP_GRID,
      placementElevation: 0,
    });
    const restored = await importSkfProject(bytes);
    expect(restored.shapes).toHaveLength(1);
    const shape = restored.shapes[0];
    expect(shape.kind).toBe("gridfinitySocketTray");
    expect(shape.gridfinityTraySquaresX).toBe(4);
    expect(shape.gridfinityTraySquaresZ).toBe(2);
    expect(shape.gridfinityTrayCornerRadius).toBe(1.5);
    expect(shape.gridfinityTrayLabelStyle).toBe("recessed");
    expect(shape.gridfinityTrayHoles).toEqual(original.gridfinityTrayHoles);
    expect(workplaneShapesEqual({ ...shape, gridfinityTrayHoles: original.gridfinityTrayHoles }, original)).toBe(true);
    expect(gridfinitySocketTrayOptionsForShape(shape)).toEqual(gridfinitySocketTrayOptionsForShape(original));
  });

  it("every geometry-affecting field takes part in the editor's change detection", () => {
    const base = trayShape();
    expect(workplaneShapesEqual(base, { ...base })).toBe(true);
    expect(workplaneShapesEqual(base, { ...base, gridfinityTraySquaresX: 4 })).toBe(false);
    expect(workplaneShapesEqual(base, { ...base, gridfinityTraySquaresZ: 1 })).toBe(false);
    expect(workplaneShapesEqual(base, { ...base, gridfinityTrayCornerRadius: 1 })).toBe(false);
    expect(workplaneShapesEqual(base, { ...base, gridfinityTrayLabelStyle: "recessed" })).toBe(false);
    expect(workplaneShapesEqual(base, { ...base, gridfinityTrayHoles: base.gridfinityTrayHoles!.map((hole) => ({ ...hole })) })).toBe(false);
  });

  it("render/export helper: the app's geometry is byte-identical to the module's direct output, in both label settings", () => {
    for (const labelStyle of ["raised", "recessed"] as const) {
      const app = positionsOf(createGridfinitySocketTrayGeometryForShape(trayShape({ gridfinityTrayLabelStyle: labelStyle })));
      const direct = positionsOf(createGridfinitySocketTrayGeometry({ ...DEFAULT_TRAY_OPTIONS, labelStyle }));
      expect(app.length).toBe(direct.length);
      expect(app.every((value, index) => Object.is(value, direct[index]))).toBe(true);
    }
    const rounded = positionsOf(createGridfinitySocketTrayGeometryForShape(trayShape({ gridfinityTrayCornerRadius: 2 })));
    const roundedDirect = positionsOf(createGridfinitySocketTrayGeometry({ ...DEFAULT_TRAY_OPTIONS, cornerRadius: 2 }));
    expect(rounded.length).toBe(roundedDirect.length);
    expect(rounded.every((value, index) => Object.is(value, roundedDirect[index]))).toBe(true);
  });

  it("each inspector value changes the mesh, and raised / recessed switches it", () => {
    const base = positionsOf(createGridfinitySocketTrayGeometryForShape(trayShape()));
    const differs = (overrides: Partial<WorkplaneShape>) => {
      const next = positionsOf(createGridfinitySocketTrayGeometryForShape(trayShape(overrides)));
      return next.length !== base.length || next.some((value, index) => !Object.is(value, base[index]));
    };
    const holes = DEFAULT_TRAY_OPTIONS.holes;
    expect(differs({ gridfinityTraySquaresX: 4 })).toBe(true);
    expect(differs({ gridfinityTraySquaresZ: 3 })).toBe(true);
    expect(differs({ gridfinityTrayCornerRadius: 1 })).toBe(true);
    expect(differs({ gridfinityTrayLabelStyle: "recessed" })).toBe(true);
    expect(differs({ gridfinityTrayHoles: [{ ...holes[0], diameter: 14 }, holes[1], holes[2]] })).toBe(true);
    expect(differs({ gridfinityTrayHoles: [{ ...holes[0], x: 21.75 }, holes[1], holes[2]] })).toBe(true);
    expect(differs({ gridfinityTrayHoles: [{ ...holes[0], z: 45 }, holes[1], holes[2]] })).toBe(true);
    expect(differs({ gridfinityTrayHoles: [{ ...holes[0], label: "9mm" }, holes[1], holes[2]] })).toBe(true);
    expect(differs({ gridfinityTrayHoles: [{ ...holes[0], label: "" }, holes[1], holes[2]] })).toBe(true);
    expect(differs({})).toBe(false);
    // Every one of those is still a valid layout, not the bare-tray fallback.
    expect(gridfinitySocketTrayLayoutError(trayShape({ gridfinityTrayHoles: [{ ...holes[0], z: 45 }, holes[1], holes[2]] }))).toBeNull();
  });

  it("export path through the real STL writer: the EXPORTED default insert is watertight, in both label settings", () => {
    for (const labelStyle of ["raised", "recessed"] as const) {
      const exported = appExportStl(trayShape({ gridfinityTrayLabelStyle: labelStyle }));
      expect(exported.startsWith("solid sketchforge_design\n")).toBe(true);
      const scene = exportedStlToScenePositions(exported);
      const analysis = analyzeTriangleSoup(scene);
      expect([analysis.boundaryEdges, analysis.nonManifoldEdges, analysis.degenerateTriangles]).toEqual([0, 0, 0]);
      expect(analysis.volume).toBeGreaterThan(0);

      // Bounding box in file (Z-up) coordinates: X 0..125.5, Y -83.5..0
      // (scene Z negated), Z 0..22.75, or 23.55 over raised labels.
      const file = asciiStlVertices(exported);
      const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let i = 0; i < file.length; i += 3) {
        for (let axis = 0; axis < 3; axis += 1) {
          bounds[axis] = Math.min(bounds[axis], file[i + axis]);
          bounds[axis + 3] = Math.max(bounds[axis + 3], file[i + axis]);
        }
      }
      expect(bounds.map((value) => Number(value.toFixed(4)))).toEqual([0, -DEPTH, 0, WIDTH, 0, labelStyle === "raised" ? 23.55 : TOP_Y]);

      // Raycast the EXPORTED file: every hole open down to its floor 14mm
      // below the top face, 4mm above the underside; solid between holes.
      for (const hole of DEFAULT_TRAY_OPTIONS.holes) {
        const crossings = verticalCrossingsFromPositions(scene, hole.x + 0.4, DEPTH - hole.z + 0.7);
        expect(crossings.length, `hole d=${hole.diameter}`).toBe(2);
        expect(crossings[1]).toBeCloseTo(FLOOR_Y, 4);
        expect(TOP_Y - crossings[1]).toBeCloseTo(14, 4);
      }
      for (const x of [41.6, 83.9]) {
        const crossings = verticalCrossingsFromPositions(scene, x, DEPTH - 41.75 + 0.7);
        expect(crossings.length, `between holes at x=${x}`).toBe(2);
        expect(crossings[1]).toBeCloseTo(TOP_Y, 4);
      }
    }
  });

  it("invalid layouts render as the bare tray and surface friendly inline errors", () => {
    const holes = DEFAULT_TRAY_OPTIONS.holes;
    const error = (overrides: Partial<WorkplaneShape>) => gridfinitySocketTrayLayoutError(trayShape(overrides));
    expect(error({ gridfinityTrayHoles: [{ diameter: 20, x: 50, z: 40, label: "" }, { diameter: 20, x: 60, z: 40, label: "" }] })).toMatch(/Holes 1 and 2 overlap or leave too thin a wall — keep at least 3mm between them/);
    expect(error({ gridfinityTrayHoles: [{ diameter: 20, x: 8, z: 40, label: "" }] })).toMatch(/Hole 1 is too close to the tray edge \(4mm clearance is required\)/);
    expect(error({ gridfinityTrayHoles: [{ diameter: 14, x: 12, z: 40, label: "10mm" }] })).toMatch(/Hole 1's label "10mm" is too close to the tray edge/);
    expect(error({ gridfinityTrayHoles: [{ diameter: 14, x: 40, z: 40, label: "10mm" }, { diameter: 14, x: 57, z: 40, label: "11mm" }] })).toMatch(/The labels of Holes 1 and 2 \("10mm" and "11mm"\) are too close together/);
    expect(error({ gridfinityTrayHoles: [{ diameter: 14, x: 60, z: 60, label: "5mm" }, { diameter: 14, x: 60, z: 43, label: "" }] })).toMatch(/Hole 1's label "5mm" is too close to Hole 2/);
    expect(error({ gridfinityTrayHoles: [{ ...holes[0], label: "3/8" }] })).toMatch(/Hole 1's label can only use the characters 0123456789m/);
    expect(error({ gridfinityTrayCornerRadius: 4 })).toMatch(/Corner Radius must be less than 3.75mm/);
    expect(error({ gridfinityTrayCornerRadius: 1, gridfinityTrayHoles: [{ diameter: 14, x: 11, z: 40, label: "" }] })).toMatch(/Corner Radius widens Hole 1 to within 4mm of the tray edge/);
    expect(error({ gridfinityTrayCornerRadius: 1, gridfinityTrayHoles: [{ diameter: 14, x: 30, z: 40, label: "" }, { diameter: 14, x: 47, z: 40, label: "" }] })).toMatch(/Corner Radius widens Hole 1 too close to Hole 2/);
    expect(error({ gridfinityTraySquaresX: 7 })).toMatch(/7 squares wide is 293.5mm, which does not fit the 256mm bed — the most that fits is 6 squares/);
    expect(error({ gridfinityTraySquaresZ: 2.5 })).toMatch(/Squares must be a whole number/);
    expect(error({})).toBeNull();

    // The render helper never throws, and an invalid hole layout falls back
    // to the bare tray -- nothing is moved to make it fit.
    const crowded = trayShape({ gridfinityTrayHoles: [{ diameter: 14, x: 40, z: 40, label: "10mm" }, { diameter: 14, x: 57, z: 40, label: "11mm" }] });
    const fallback = createGridfinitySocketTrayGeometryForShape(crowded);
    const bare = createGridfinitySocketTrayGeometryForShape(trayShape({ gridfinityTrayHoles: [] }));
    expect(fallback.getAttribute("position").count).toBe(bare.getAttribute("position").count);
    expect(() => createGridfinitySocketTrayGeometryForShape(trayShape({ gridfinityTrayCornerRadius: 9 }))).not.toThrow();
    expect(() => createGridfinitySocketTrayGeometryForShape(trayShape({ gridfinityTraySquaresX: 7 }))).not.toThrow();
    expect(() => createGridfinitySocketTrayGeometryForShape(trayShape({ gridfinityTraySquaresZ: 0 }))).not.toThrow();
  });

  it("leaves the four existing trays' registration and defaults unchanged", () => {
    const kinds = ["socketTray", "mountedSocketTray", "screwdriverTray", "mountedScrewdriverTray"] as const;
    for (const kind of kinds) {
      const expected = EXISTING_TRAYS[kind];
      const asset = toolbarShapeAssets.find((entry) => entry.kind === kind && !entry.presetId)!;
      expect(asset, kind).toEqual(expected.asset);
      expect(fallbackSolidColor({ kind } as WorkplaneShape), kind).toBe(expected.fallbackColor);
      const insert = makeShapeFromAsset(asset) as unknown as Record<string, unknown>;
      const defined = Object.fromEntries(Object.entries(insert).filter(([key, value]) => value !== undefined && key !== "id"));
      expect(defined, kind).toEqual(expected.insert);
      // They carry none of this shape's fields.
      expect(Object.keys(defined).filter((key) => key.startsWith("gridfinityTray")), kind).toEqual([]);
    }
    // All four are still in the OpenGrid section, in the same order.
    const openGrid = toolbarShapeAssetGroups.find((group) => group.category === "OpenGrid")!;
    expect(openGrid.shapes.map((shape) => shape.id)).toEqual([
      "opengrid-board",
      "openconnect-container",
      "opengrid-snap",
      "multiconnect-container",
      "socket-tray",
      "mounted-socket-tray",
      "screwdriver-tray",
      "mounted-screwdriver-tray",
    ]);
    // And the new shape carries none of theirs.
    const placed = makeShapeFromAsset(ASSET) as unknown as Record<string, unknown>;
    const foreign = Object.keys(placed).filter((key) => placed[key] !== undefined && /^(socketTray|mountedTray|screwdriverTray|mountedScrewdriverTray)/.test(key));
    expect(foreign).toEqual([]);
  });
});
