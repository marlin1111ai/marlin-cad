import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createScrewdriverTrayGeometryForShape,
  DEFAULT_SCREWDRIVER_TRAY_SHAPE_HOLES,
  makeShapeFromAsset,
  screwdriverTrayLayoutError,
  screwdriverTrayOptionsForShape,
  toolbarShapeAssetGroups,
  toolbarShapeAssets,
} from "@/lib/shapeCatalog";
import { createScrewdriverTrayGeometry, screwdriverTrayPositions } from "@/lib/screwdriverTrayGeometry";
import { exportMeshesToStl } from "@/lib/stlExport";
import { exportSkfProject, importSkfProject } from "@/lib/skfProject";
import { fallbackSolidColor, workplaneShapesEqual } from "@/lib/workplaneShapes";
import { DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import type { WorkplaneShape } from "@/types/sketchforge";

const ASSET = toolbarShapeAssets.find((asset) => asset.kind === "screwdriverTray")!;

// What the default insert must reproduce. Diameters are generic placeholders
// chosen by the owner, not measured shafts -- see shapeCatalog.ts.
const DEFAULT_TRAY_OPTIONS = {
  width: 240,
  depth: 60,
  thickness: 18,
  holes: [
    { diameter: 8, x: 30, z: 30 },
    { diameter: 10, x: 120, z: 30 },
    { diameter: 12, x: 210, z: 30 },
  ],
};

function trayShape(overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return { ...makeShapeFromAsset(ASSET), id: "screwdriver-tray-1", ...overrides };
}

// Vertical raycast along Y at (x, z): sorted, de-duplicated Y crossings. Same
// check as tests/unit/screwdriverTrayGeometry.test.ts, reused here against the
// geometry the APP builds rather than the module's direct output.
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

// The editor's export arm is module-private (SketchForgeEditor.tsx
// buildGeometryMeshForShape -> bufferGeometryToMeshData -> transformMesh ->
// exportMeshesToStl). This reproduces its three operations on the app's
// geometry helper and then calls the REAL exporter: (1) non-indexed positions,
// (2) rebase to Y=0 when |minY| > 1e-6, (3) transformMesh, which for a default
// insert (x=0, z=0, elevation=0, no rotation, no mirror) is the identity.
function appExportStl(shape: WorkplaneShape) {
  const geometry = createScrewdriverTrayGeometryForShape(shape);
  const prepared = geometry.index ? geometry.toNonIndexed() : geometry;
  prepared.computeBoundingBox();
  const minY = prepared.boundingBox?.min.y ?? 0;
  expect(Math.abs(minY)).toBeLessThanOrEqual(0.000001); // rebase is a no-op for the tray
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

function facetCount(text: string) {
  return (text.match(/^\s*facet normal /gm) ?? []).length;
}

// Reads an exported ASCII STL back into SCENE coordinates. exportMeshesToStl
// writes scene [x, y, z] as file [x, -z, y], so the inverse is scene x = file
// x, scene y = file z, scene z = -file y.
function exportedStlToScenePositions(text: string): number[] {
  const file = asciiStlVertices(text);
  const scene: number[] = [];
  for (let i = 0; i < file.length; i += 3) scene.push(file[i], file[i + 2], -file[i + 1]);
  return scene;
}

describe("screwdriver tray registration", () => {
  it("is registered in the OpenGrid category with its own kind and color", () => {
    expect(ASSET).toBeDefined();
    expect(ASSET.name).toBe("Screwdriver Tray");
    expect(ASSET.category).toBe("OpenGrid");
    const colors = toolbarShapeAssets.filter((asset) => asset.category === "OpenGrid").map((asset) => asset.color);
    expect(new Set(colors).size).toBe(colors.length); // no color reuse in the category
    expect(fallbackSolidColor({ kind: "screwdriverTray" } as WorkplaneShape)).toBe(ASSET.color);
    const openGrid = toolbarShapeAssetGroups.find((group) => group.category === "OpenGrid")!;
    expect(openGrid.shapes.map((shape) => shape.id)).toContain("screwdriver-tray");
  });

  it("inserts the 3-hole default by default (240 x 60 x 18, diameters 8 / 10 / 12)", () => {
    const placed = makeShapeFromAsset(ASSET, { x: 5, z: -3 });
    expect(placed).toMatchObject({
      kind: "screwdriverTray",
      name: "Screwdriver Tray",
      width: 240,
      depth: 60,
      height: 18,
      screwdriverTrayCornerRadius: 0,
      screwdriverTrayHoles: [
        { diameter: 8, x: 30, z: 30 },
        { diameter: 10, x: 120, z: 30 },
        { diameter: 12, x: 210, z: 30 },
      ],
    });
    // The insert owns its own hole array, not the shared default constant.
    expect(placed.screwdriverTrayHoles).not.toBe(DEFAULT_SCREWDRIVER_TRAY_SHAPE_HOLES);
    // No pocket-depth field exists on this shape, shared or per row.
    expect("screwdriverTrayPocketDepth" in placed).toBe(false);
    expect(placed.screwdriverTrayHoles!.every((hole) => !("depth" in hole))).toBe(true);
    // A valid shape: the module accepts it and the inspector reports no error.
    expect(() => screwdriverTrayPositions(screwdriverTrayOptionsForShape(placed))).not.toThrow();
    expect(screwdriverTrayLayoutError(placed)).toBeNull();
  });

  it("maps shape fields to the module's options (width/depth pass through, height -> thickness, no depth anywhere)", () => {
    const options = screwdriverTrayOptionsForShape(
      trayShape({ width: 200, depth: 50, height: 20, screwdriverTrayCornerRadius: 3, screwdriverTrayHoles: [{ diameter: 6, x: 40, z: 25 }, { diameter: 9, x: 90, z: 25 }] }),
    );
    expect(options).toEqual({
      width: 200,
      depth: 50,
      thickness: 20,
      cornerRadius: 3,
      holes: [
        { diameter: 6, x: 40, z: 25 },
        { diameter: 9, x: 90, z: 25 },
      ],
    });
    // No holes -> []; the default insert's corner radius is 0 (sharp).
    expect(screwdriverTrayOptionsForShape(trayShape({ screwdriverTrayHoles: undefined }))).toEqual({ width: 240, depth: 60, thickness: 18, cornerRadius: 0, holes: [] });
  });

  it("round-trips through .skf persistence with the hole list and corner radius intact", async () => {
    const original = trayShape({ screwdriverTrayCornerRadius: 4, screwdriverTrayHoles: [{ diameter: 6, x: 40, z: 25 }, { diameter: 9.5, x: 90, z: 35 }] });
    const bytes = await exportSkfProject({
      projectId: "screwdriver-tray-registration-test",
      projectName: "Screwdriver tray registration",
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
    expect(shape.kind).toBe("screwdriverTray");
    expect(shape.screwdriverTrayCornerRadius).toBe(4);
    expect(shape.screwdriverTrayHoles).toEqual(original.screwdriverTrayHoles);
    // Same comparator the editor's dirty tracking uses (the hole list is
    // reference-compared there, so normalize that one field first).
    expect(workplaneShapesEqual({ ...shape, screwdriverTrayHoles: original.screwdriverTrayHoles }, original)).toBe(true);
    expect(screwdriverTrayOptionsForShape(shape)).toEqual(screwdriverTrayOptionsForShape(original));
  });

  it("render/export helper: the app's geometry for a default insert is byte-identical to the module's direct output", () => {
    const placed = makeShapeFromAsset(ASSET);
    const appGeometry = createScrewdriverTrayGeometryForShape(placed);
    const direct = createScrewdriverTrayGeometry(DEFAULT_TRAY_OPTIONS);
    const appPositions = appGeometry.getAttribute("position").array as Float32Array;
    const directPositions = direct.getAttribute("position").array as Float32Array;
    expect(appPositions.length).toBe(directPositions.length);
    expect(appPositions.every((value, index) => Object.is(value, directPositions[index]))).toBe(true);
    // Both arms (viewport addMesh -> putGeometryOnBase; editor
    // bufferGeometryToMeshData) rebase to Y=0 only when minY != 0 -- the
    // tray's bottom face is already at Y=0, so neither arm moves it.
    let minY = Infinity;
    for (let i = 1; i < appPositions.length; i += 3) minY = Math.min(minY, appPositions[i]);
    expect(minY).toBe(0);
  });

  it("render/export dispatch: a rounded shape's app geometry is byte-identical to the module's direct output", () => {
    const rounded = trayShape({ screwdriverTrayCornerRadius: 3 });
    const appPositions = createScrewdriverTrayGeometryForShape(rounded).getAttribute("position").array as Float32Array;
    const directPositions = createScrewdriverTrayGeometry({ ...DEFAULT_TRAY_OPTIONS, cornerRadius: 3 }).getAttribute("position").array as Float32Array;
    expect(appPositions.length).toBe(directPositions.length);
    expect(appPositions.every((value, index) => Object.is(value, directPositions[index]))).toBe(true);
  });

  it("export path through the real STL writer: bores are open top to bottom on the EXPORTED file", () => {
    const exported = appExportStl(makeShapeFromAsset(ASSET));
    expect(exported.startsWith("solid sketchforge_design\n")).toBe(true);
    // 2 notched caps (196 contour+hole points, 3 holes -> 200 triangles each),
    // 4 plain side walls (2 each), 3 bores (64 quads -> 128 triangles each).
    expect(facetCount(exported)).toBe(200 + 200 + 8 + 384);
    // Bounding box in file (Z-up) coordinates: X 0..240, Y -60..0 (scene Z
    // negated), Z 0..18 (scene Y).
    const fileVertices = asciiStlVertices(exported);
    const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < fileVertices.length; i += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        bounds[axis] = Math.min(bounds[axis], fileVertices[i + axis]);
        bounds[axis + 3] = Math.max(bounds[axis + 3], fileVertices[i + axis]);
      }
    }
    expect(bounds.map((value) => Number(value.toFixed(4)))).toEqual([0, -60, 0, 240, 0, 18]);

    // Raycast the EXPORTED file, not the in-memory geometry: every bore open
    // all the way through (zero crossings), solid slab between bores.
    const scene = exportedStlToScenePositions(exported);
    for (const hole of DEFAULT_TRAY_OPTIONS.holes) {
      expect(verticalCrossingsFromPositions(scene, hole.x, hole.z), `bore d=${hole.diameter}`).toEqual([]);
    }
    for (const x of [75, 165]) {
      const crossings = verticalCrossingsFromPositions(scene, x, 30);
      expect(crossings.length, `between bores at x=${x}`).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 4);
      expect(crossings[1]).toBeCloseTo(18, 4);
    }
  });

  it("invalid hole layouts render as the bare tray and surface friendly inline errors", () => {
    // Overlap: two 20mm holes 10mm apart (needs 24mm center-to-center).
    const overlapping = trayShape({ screwdriverTrayHoles: [{ diameter: 20, x: 100, z: 30 }, { diameter: 20, x: 110, z: 30 }] });
    expect(screwdriverTrayLayoutError(overlapping)).toMatch(/Holes 1 and 2 overlap/);
    // Edge crowding: a 20mm hole centered 8mm from the left edge.
    const crowded = trayShape({ screwdriverTrayHoles: [{ diameter: 20, x: 8, z: 30 }] });
    expect(screwdriverTrayLayoutError(crowded)).toMatch(/Hole 1 is too close to the tray edge/);
    // Below the 10mm minimum thickness -- the guard that replaces the socket
    // trays' minimum-floor guard on this shape.
    expect(screwdriverTrayLayoutError(trayShape({ height: 8 }))).toMatch(/Thickness must be at least 10mm/);
    // Corner radius with nowhere to go.
    expect(screwdriverTrayLayoutError(trayShape({ screwdriverTrayCornerRadius: 18 }))).toMatch(/Corner Radius is too large for the tray's own Thickness/);
    // Valid layout reports no error; the render helper never throws either way.
    expect(screwdriverTrayLayoutError(trayShape())).toBeNull();
    const fallback = createScrewdriverTrayGeometryForShape(overlapping);
    const plain = createScrewdriverTrayGeometryForShape({ ...overlapping, screwdriverTrayHoles: [] });
    expect(fallback.getAttribute("position").count).toBe(plain.getAttribute("position").count);
    expect(fallback.getAttribute("position").count).toBe(12 * 3); // six uncut rectangles, two triangles each
    // A sub-minimum thickness also falls back rather than throwing in render.
    expect(() => createScrewdriverTrayGeometryForShape(trayShape({ height: 8 }))).not.toThrow();
  });

  it("leaves both Socket Trays' registration untouched", () => {
    // This shape is additive: the socket trays keep their own catalog
    // entries, kinds, colors and default inserts.
    const socket = toolbarShapeAssets.find((asset) => asset.kind === "socketTray")!;
    const mounted = toolbarShapeAssets.find((asset) => asset.kind === "mountedSocketTray")!;
    expect(socket.name).toBe("Socket Tray");
    expect(socket.color).toBe("#3b82f6");
    expect(mounted.name).toBe("Mounted Socket Tray");
    expect(mounted.color).toBe("#0ea5a4");
    expect(makeShapeFromAsset(socket)).toMatchObject({ kind: "socketTray", width: 240, depth: 60, height: 18, socketTrayPocketDepth: 14 });
    expect(makeShapeFromAsset(mounted)).toMatchObject({ kind: "mountedSocketTray", mountedTrayPocketDepth: 14, mountedTrayThickness: 18 });
    // And the new shape carries none of their fields.
    const placed = makeShapeFromAsset(ASSET);
    expect(placed.socketTrayPockets).toBeUndefined();
    expect(placed.socketTrayPocketDepth).toBeUndefined();
    expect(placed.mountedTrayPockets).toBeUndefined();
    expect(placed.mountedTrayPocketDepth).toBeUndefined();
  });
});
