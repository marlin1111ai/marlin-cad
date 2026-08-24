import { describe, expect, it } from "vitest";
import {
  createMulticonnectGeometryForShape,
  DEFAULT_MULTICONNECT_PEG_LENGTH,
  makeShapeFromAsset,
  multiconnectPegLayoutError,
  multiconnectPlateOptionsForShape,
  toolbarShapeAssets,
} from "@/lib/shapeCatalog";
import {
  createMulticonnectPlateGeometry,
  multiconnectSlotCenters,
} from "@/lib/multiconnectContainerGeometry";
import { exportSkfProject, importSkfProject } from "@/lib/skfProject";
import { fallbackSolidColor, workplaneShapesEqual } from "@/lib/workplaneShapes";
import { DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import type { WorkplaneShape } from "@/types/sketchforge";

const ASSET = toolbarShapeAssets.find((asset) => asset.kind === "multiconnectContainer")!;

function pegPlateShape(): WorkplaneShape {
  return {
    ...makeShapeFromAsset(ASSET),
    id: "multiconnect-1",
    width: 240,
    height: 60,
    depth: 10,
    multiconnectShapeType: "PegPlate",
    multiconnectPegRowZ: 35,
    multiconnectPegs: [
      { diameter: 6, x: 15 },
      { diameter: 10, x: 40 },
    ],
  };
}

describe("multiconnect container registration", () => {
  it("is registered in the OpenGrid category with its own kind and color", () => {
    expect(ASSET).toBeDefined();
    expect(ASSET.name).toBe("Multiconnect Container");
    expect(ASSET.category).toBe("OpenGrid");
    const colors = toolbarShapeAssets.filter((asset) => asset.category === "OpenGrid").map((asset) => asset.color);
    expect(new Set(colors).size).toBe(colors.length); // no color reuse in the category
    expect(fallbackSolidColor({ kind: "multiconnectContainer" } as WorkplaneShape)).toBe(ASSET.color);
  });

  it("inserts a 112x60x10 Plate with 4 slots and 5mm rounded corners by default", () => {
    const placed = makeShapeFromAsset(ASSET, { x: 5, z: -3 });
    expect(placed).toMatchObject({
      kind: "multiconnectContainer",
      name: "Multiconnect Container",
      width: 112,
      height: 60,
      depth: 10,
      multiconnectShapeType: "Plate",
      multiconnectSlotSpacing: 28,
      multiconnectSlotQuickRelease: false,
      multiconnectSlotTolerance: 1,
      multiconnectCornerRadius: 5,
      multiconnectPegLength: DEFAULT_MULTICONNECT_PEG_LENGTH,
      multiconnectPegFillet: 2,
      multiconnectPegTilt: 5,
      multiconnectPegRowZ: 30,
      multiconnectPegs: [],
    });
    expect(multiconnectSlotCenters(placed.width, placed.multiconnectSlotSpacing!)).toHaveLength(4);
  });

  it("maps inspector state to geometry params (shared peg length/row, viewed-x passed through)", () => {
    const options = multiconnectPlateOptionsForShape({
      ...pegPlateShape(),
      multiconnectSlotSpacing: 25,
      multiconnectSlotQuickRelease: true,
      multiconnectSlotTolerance: 1.05,
      multiconnectCornerRadius: 4,
      multiconnectPegLength: 50,
      multiconnectPegFillet: 1.5,
      multiconnectPegTilt: 8,
    });
    expect(options).toEqual({
      width: 240,
      height: 60,
      plateThickness: 10,
      cornerRadius: 4,
      slotSpacing: 25,
      slotQuickRelease: true,
      slotTolerance: 1.05,
      pegFilletRadius: 1.5,
      pegTiltDeg: 8,
      pegs: [
        { diameter: 6, length: 50, x: 15, z: 35 },
        { diameter: 10, length: 50, x: 40, z: 35 },
      ],
    });
    // Plate variant ignores the peg list entirely.
    expect(multiconnectPlateOptionsForShape({ ...pegPlateShape(), multiconnectShapeType: "Plate" }).pegs).toEqual([]);
  });

  it("round-trips through .skf persistence with every multiconnect field intact", async () => {
    const original = pegPlateShape();
    const bytes = await exportSkfProject({
      projectId: "multiconnect-registration-test",
      projectName: "Multiconnect registration",
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
    expect(shape.kind).toBe("multiconnectContainer");
    expect(shape.multiconnectShapeType).toBe("PegPlate");
    expect(shape.multiconnectPegs).toEqual(original.multiconnectPegs);
    expect(shape.multiconnectPegRowZ).toBe(35);
    // Field-level equality via the same comparator the editor's dirty
    // tracking uses (multiconnectPegs is reference-compared there, so
    // normalize that one field first).
    expect(workplaneShapesEqual({ ...shape, multiconnectPegs: original.multiconnectPegs }, original)).toBe(true);
    // The restored shape still builds the identical geometry.
    expect(multiconnectPlateOptionsForShape(shape)).toEqual(multiconnectPlateOptionsForShape(original));
  });

  it("export path: the app's geometry for a default insert is byte-identical to the module's direct output", () => {
    const placed = makeShapeFromAsset(ASSET);
    const appGeometry = createMulticonnectGeometryForShape(placed);
    const direct = createMulticonnectPlateGeometry({
      width: 112,
      height: 60,
      plateThickness: 10,
      cornerRadius: 5,
      slotSpacing: 28,
      slotQuickRelease: false,
      slotTolerance: 1,
      pegs: [],
    });
    const appPositions = appGeometry.getAttribute("position").array as Float32Array;
    const directPositions = direct.getAttribute("position").array as Float32Array;
    expect(appPositions.length).toBe(directPositions.length);
    expect(appPositions.every((value, index) => Object.is(value, directPositions[index]))).toBe(true);
    // The export pipeline's only kind-specific hazard is its rebase-to-Y=0
    // (bufferGeometryToMeshData translates when minY != 0, which would break
    // byte identity) -- the plate's own frame already starts at Y=0, so the
    // rebase is a no-op.
    let minY = Infinity;
    for (let i = 1; i < appPositions.length; i += 3) minY = Math.min(minY, appPositions[i]);
    expect(minY).toBe(0);
  });

  it("invalid peg layouts render as the bare plate and surface friendly inline errors", () => {
    // Overlap: d=10 + d=10 with 2mm fillets needs 14.1mm spacing; give 9.
    const overlapping: WorkplaneShape = {
      ...pegPlateShape(),
      multiconnectPegs: [
        { diameter: 10, x: 26 },
        { diameter: 10, x: 35 },
      ],
    };
    expect(multiconnectPegLayoutError(overlapping)).toMatch(/Pegs 1 and 2 overlap/);
    // Edge crowding (viewed x near the left edge as mounted).
    const crowded: WorkplaneShape = { ...pegPlateShape(), multiconnectPegs: [{ diameter: 10, x: 8 }] };
    expect(multiconnectPegLayoutError(crowded)).toMatch(/Peg 1 is too close to the plate edge/);
    // Valid layout reports no error; the render helper never throws either way.
    expect(multiconnectPegLayoutError(pegPlateShape())).toBeNull();
    const fallback = createMulticonnectGeometryForShape(overlapping);
    const plain = createMulticonnectGeometryForShape({ ...overlapping, multiconnectPegs: [] });
    expect(fallback.getAttribute("position").count).toBe(plain.getAttribute("position").count);
  });
});
