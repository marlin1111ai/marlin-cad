import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import {
  createSocketTrayGeometryForShape,
  DEFAULT_SOCKET_TRAY_SHAPE_POCKET_DEPTH,
  DEFAULT_SOCKET_TRAY_SHAPE_POCKETS,
  makeShapeFromAsset,
  socketTrayLayoutError,
  socketTrayOptionsForShape,
  toolbarShapeAssetGroups,
  toolbarShapeAssets,
} from "@/lib/shapeCatalog";
import { createSocketTrayGeometry, socketTrayPositions } from "@/lib/socketTrayGeometry";
import { exportMeshesToStl } from "@/lib/stlExport";
import { exportSkfProject, importSkfProject } from "@/lib/skfProject";
import { fallbackSolidColor, workplaneShapesEqual } from "@/lib/workplaneShapes";
import { DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import type { WorkplaneShape } from "@/types/sketchforge";

const ASSET = toolbarShapeAssets.find((asset) => asset.kind === "socketTray")!;

// The sampler coupon the default insert must reproduce -- same numbers as
// scripts/generate-socket-tray-sampler.mjs and reference/socket-tray-sampler-report.md.
const COUPON_OPTIONS = {
  width: 240,
  depth: 60,
  thickness: 18,
  pockets: [
    { diameter: 14, depth: 14, x: 30, z: 30 },
    { diameter: 15, depth: 14, x: 66, z: 30 },
    { diameter: 19, depth: 14, x: 102, z: 30 },
    { diameter: 20.7, depth: 14, x: 138, z: 30 },
    { diameter: 23, depth: 14, x: 174, z: 30 },
    { diameter: 25, depth: 14, x: 210, z: 30 },
  ],
};
const COUPON_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../test-prints/socket-tray-sampler.stl");

function trayShape(overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return { ...makeShapeFromAsset(ASSET), id: "socket-tray-1", ...overrides };
}

// Vertical raycast along Y at (x, z): sorted, de-duplicated Y crossings.
// Same check as tests/unit/socketTrayGeometry.test.ts (verticalCrossings),
// reused here against the geometry the APP builds rather than the module's
// direct output: a sealed-shut pocket still passes every manifold check.
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
  crossings.sort((m, n) => m - n);
  const merged: number[] = [];
  for (const y of crossings) {
    if (merged.length === 0 || Math.abs(y - merged[merged.length - 1]) > 1e-6) merged.push(y);
  }
  return merged;
}

// The editor's export arm is module-private (SketchForgeEditor.tsx
// buildGeometryMeshForShape -> bufferGeometryToMeshData -> transformMesh ->
// exportMeshesToStl). This reproduces its three operations on the app's
// geometry helper and then calls the REAL exporter: (1) non-indexed
// positions, (2) rebase to Y=0 when |minY| > 1e-6 (bufferGeometryToMeshData),
// (3) transformMesh, which for a default insert (x=0, z=0, elevation=0, no
// rotation, no mirror) is the identity.
function appExportStl(shape: WorkplaneShape) {
  const geometry = createSocketTrayGeometryForShape(shape);
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

describe("socket tray registration", () => {
  it("is registered in the OpenGrid category with its own kind and color", () => {
    expect(ASSET).toBeDefined();
    expect(ASSET.name).toBe("Socket Tray");
    expect(ASSET.category).toBe("OpenGrid");
    const colors = toolbarShapeAssets.filter((asset) => asset.category === "OpenGrid").map((asset) => asset.color);
    expect(new Set(colors).size).toBe(colors.length); // no color reuse in the category
    expect(fallbackSolidColor({ kind: "socketTray" } as WorkplaneShape)).toBe(ASSET.color);
    const openGrid = toolbarShapeAssetGroups.find((group) => group.category === "OpenGrid")!;
    expect(openGrid.shapes.map((shape) => shape.id)).toContain("socket-tray");
  });

  it("inserts the 6-pocket sampler coupon by default (240 x 60 x 18, pocket depth 14)", () => {
    const placed = makeShapeFromAsset(ASSET, { x: 5, z: -3 });
    expect(placed).toMatchObject({
      kind: "socketTray",
      name: "Socket Tray",
      width: 240,
      depth: 60,
      height: 18,
      socketTrayPocketDepth: 14,
      socketTrayPockets: [
        { diameter: 14, x: 30, z: 30 },
        { diameter: 15, x: 66, z: 30 },
        { diameter: 19, x: 102, z: 30 },
        { diameter: 20.7, x: 138, z: 30 },
        { diameter: 23, x: 174, z: 30 },
        { diameter: 25, x: 210, z: 30 },
      ],
    });
    // The insert owns its own pocket array, not the shared default constant.
    expect(placed.socketTrayPockets).not.toBe(DEFAULT_SOCKET_TRAY_SHAPE_POCKETS);
    // A valid shape: the geometry module accepts it without throwing and the
    // inspector reports no layout error.
    expect(() => socketTrayPositions(socketTrayOptionsForShape(placed))).not.toThrow();
    expect(socketTrayLayoutError(placed)).toBeNull();
  });

  it("maps shape fields to the module's options (width/depth -> width/depth, height -> thickness, shared pocket depth, corner radius passes through)", () => {
    const options = socketTrayOptionsForShape(trayShape({ width: 200, depth: 50, height: 20, socketTrayPocketDepth: 12, socketTrayCornerRadius: 3, socketTrayPockets: [{ diameter: 16, x: 40, z: 25 }, { diameter: 22, x: 90, z: 25 }] }));
    expect(options).toEqual({
      width: 200,
      depth: 50,
      thickness: 20,
      cornerRadius: 3,
      pockets: [
        { diameter: 16, depth: 12, x: 40, z: 25 },
        { diameter: 22, depth: 12, x: 90, z: 25 },
      ],
    });
    // Missing pocket depth falls back to the insert default; no pockets -> [];
    // the default insert's corner radius is 0 (sharp).
    expect(socketTrayOptionsForShape(trayShape({ socketTrayPocketDepth: undefined, socketTrayPockets: undefined }))).toEqual({ width: 240, depth: 60, thickness: 18, cornerRadius: 0, pockets: [] });
    expect(DEFAULT_SOCKET_TRAY_SHAPE_POCKET_DEPTH).toBe(14);
  });

  it("round-trips through .skf persistence with the pocket list and corner radius intact", async () => {
    const original = trayShape({ socketTrayPocketDepth: 12, socketTrayCornerRadius: 4, socketTrayPockets: [{ diameter: 16, x: 40, z: 25 }, { diameter: 22.5, x: 90, z: 35 }] });
    const bytes = await exportSkfProject({
      projectId: "socket-tray-registration-test",
      projectName: "Socket tray registration",
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
    expect(shape.kind).toBe("socketTray");
    expect(shape.socketTrayPocketDepth).toBe(12);
    expect(shape.socketTrayCornerRadius).toBe(4);
    expect(shape.socketTrayPockets).toEqual(original.socketTrayPockets);
    // Same comparator the editor's dirty tracking uses (the pocket list is
    // reference-compared there, so normalize that one field first).
    expect(workplaneShapesEqual({ ...shape, socketTrayPockets: original.socketTrayPockets }, original)).toBe(true);
    expect(socketTrayOptionsForShape(shape)).toEqual(socketTrayOptionsForShape(original));
  });

  it("render/export dispatch: a rounded shape's app geometry is byte-identical to the module's direct output", () => {
    const rounded = trayShape({ socketTrayCornerRadius: 3 });
    const appGeometry = createSocketTrayGeometryForShape(rounded);
    const direct = createSocketTrayGeometry({ ...COUPON_OPTIONS, cornerRadius: 3 });
    const appPositions = appGeometry.getAttribute("position").array as Float32Array;
    const directPositions = direct.getAttribute("position").array as Float32Array;
    expect(appPositions.length).toBe(directPositions.length);
    expect(appPositions.every((value, index) => Object.is(value, directPositions[index]))).toBe(true);
  });

  it("render/export helper: the app's geometry for a default insert is byte-identical to the module's direct output", () => {
    const placed = makeShapeFromAsset(ASSET);
    const appGeometry = createSocketTrayGeometryForShape(placed);
    const direct = createSocketTrayGeometry(COUPON_OPTIONS);
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

  it("export path reproduces test-prints/socket-tray-sampler.stl (same triangles, float32-identical vertices, pockets open)", () => {
    const coupon = readFileSync(COUPON_PATH, "utf8");
    const exported = appExportStl(makeShapeFromAsset(ASSET));
    // Same ASCII format; the solid name is the only header difference
    // (the coupon generator names its solid, the app names every export
    // "sketchforge_design").
    expect(coupon.startsWith("solid socket_tray_sampler\n")).toBe(true);
    expect(exported.startsWith("solid sketchforge_design\n")).toBe(true);
    expect(facetCount(exported)).toBe(facetCount(coupon));
    expect(facetCount(exported)).toBe(1548);
    // Triangle-by-triangle, vertex-by-vertex comparison in the STL's own
    // (Z-up) coordinates. The coupon was written from the module's doubles;
    // the app path reads the module's Float32BufferAttribute, so agreement
    // is to float32 precision (~1.5e-5 at 240mm), not bit-for-bit.
    const couponVertices = asciiStlVertices(coupon);
    const exportedVertices = asciiStlVertices(exported);
    expect(exportedVertices.length).toBe(couponVertices.length);
    expect(exportedVertices.length).toBe(1548 * 9);
    let maxDelta = 0;
    for (let i = 0; i < couponVertices.length; i += 1) maxDelta = Math.max(maxDelta, Math.abs(couponVertices[i] - exportedVertices[i]));
    expect(maxDelta).toBeLessThan(1e-4);
    // Bounding box of the export in file (Z-up) coordinates: X 0..240,
    // Y -60..0 (scene Z negated), Z 0..18 (scene Y), matching the coupon.
    const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < exportedVertices.length; i += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        bounds[axis] = Math.min(bounds[axis], exportedVertices[i + axis]);
        bounds[axis + 3] = Math.max(bounds[axis + 3], exportedVertices[i + axis]);
      }
    }
    expect(bounds.map((value) => Number(value.toFixed(4)))).toEqual([0, -60, 0, 240, 0, 18]);
    // Raycast the app-built geometry: every pocket open from the top face to
    // its floor and solid below it; solid slab between pockets.
    const geometry = createSocketTrayGeometryForShape(makeShapeFromAsset(ASSET));
    for (const pocket of COUPON_OPTIONS.pockets) {
      const crossings = verticalCrossings(geometry, pocket.x, pocket.z);
      expect(crossings.length).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 4);
      expect(crossings[1]).toBeCloseTo(18 - pocket.depth, 4);
    }
    for (const x of [48, 84, 120, 156, 192]) {
      const crossings = verticalCrossings(geometry, x, 30);
      expect(crossings.length).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 4);
      expect(crossings[1]).toBeCloseTo(18, 4);
    }
  });

  it("invalid pocket layouts render as the bare tray and surface friendly inline errors", () => {
    // Overlap: two 20mm pockets 10mm apart (needs 24mm center-to-center).
    const overlapping = trayShape({ socketTrayPockets: [{ diameter: 20, x: 100, z: 30 }, { diameter: 20, x: 110, z: 30 }] });
    expect(socketTrayLayoutError(overlapping)).toMatch(/Pockets 1 and 2 overlap/);
    // Edge crowding: a 20mm pocket centered 8mm from the left edge.
    const crowded = trayShape({ socketTrayPockets: [{ diameter: 20, x: 8, z: 30 }] });
    expect(socketTrayLayoutError(crowded)).toMatch(/Pocket 1 is too close to the tray edge/);
    // Too-thin floor: 17mm pockets in an 18mm tray leave 1mm (minimum is 2mm).
    const thinFloor = trayShape({ socketTrayPocketDepth: 17 });
    expect(socketTrayLayoutError(thinFloor)).toMatch(/minimum floor/);
    // Valid layout reports no error; the render helper never throws either way.
    expect(socketTrayLayoutError(trayShape())).toBeNull();
    const fallback = createSocketTrayGeometryForShape(overlapping);
    const plain = createSocketTrayGeometryForShape({ ...overlapping, socketTrayPockets: [] });
    expect(fallback.getAttribute("position").count).toBe(plain.getAttribute("position").count);
    expect(fallback.getAttribute("position").count).toBe(12 * 3); // six uncut rectangles, two triangles each
  });
});
