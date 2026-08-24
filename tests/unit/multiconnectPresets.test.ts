import { describe, expect, it } from "vitest";
import { MULTICONNECT_PRESETS, multiconnectPresetById } from "@/lib/multiconnectPresets";
import { makeShapeFromAsset, multiconnectPlateOptionsForShape, toolbarShapeAssets } from "@/lib/shapeCatalog";
import { multiconnectPlatePositions, type MulticonnectPlateOptions } from "@/lib/multiconnectContainerGeometry";
import { exportSkfProject, importSkfProject } from "@/lib/skfProject";
import { DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";

// The production batch-export parameter tables the printed STLs in
// test-prints/ were generated from -- the presets must reproduce these
// byte for byte. (d, x) pairs are peg diameter and MOUNTED-VIEW x.
const PRODUCTION_BASE = {
  width: 240,
  height: 60,
  plateThickness: 10,
  cornerRadius: 5,
  slotSpacing: 28,
  slotQuickRelease: false,
  slotTolerance: 1,
  pegFilletRadius: 2,
  pegTiltDeg: 5,
} as const;
const productionSpec = (pegs: Array<[number, number]>): MulticonnectPlateOptions => ({
  ...PRODUCTION_BASE,
  pegs: pegs.map(([diameter, x]) => ({ diameter, length: 45, x, z: 35 })),
});
const PRODUCTION_SPECS: Record<string, MulticonnectPlateOptions> = {
  "wrench-rack-metric-1": productionSpec([[5, 20], [5, 48], [6, 78], [6, 110], [7, 144], [7, 181], [8, 220]]),
  "wrench-rack-metric-2": productionSpec([[8, 20], [9, 50], [9, 81], [10, 113], [10, 147], [11, 183], [12, 220]]),
  "wrench-rack-metric-3": productionSpec([[12, 20], [13, 67], [13, 116], [14, 167], [14, 220]]),
  "wrench-rack-sae-1": productionSpec([[5, 20], [6, 48], [6, 78], [7, 110], [8, 144], [9, 181], [10, 220]]),
  "wrench-rack-sae-2": productionSpec([[10, 20], [11, 67], [11, 116], [12, 167], [13, 220]]),
  "wrench-rack-sae-3": productionSpec([[13, 20], [14, 85], [14, 152], [14, 220]]),
};

const presetAsset = (presetId: string) => toolbarShapeAssets.find((asset) => asset.presetId === presetId)!;

describe("multiconnect presets", () => {
  it("all six wrench racks appear in the insert panel as a Wrench Racks group", () => {
    expect(MULTICONNECT_PRESETS).toHaveLength(6);
    const assets = toolbarShapeAssets.filter((asset) => asset.presetId);
    expect(assets).toHaveLength(6);
    for (const preset of MULTICONNECT_PRESETS) {
      const asset = presetAsset(preset.id);
      expect(asset).toBeDefined();
      expect(asset.kind).toBe("multiconnectContainer");
      expect(asset.category).toBe("Wrench Racks");
      expect(asset.name).toBe(preset.name);
    }
    expect(new Set(toolbarShapeAssets.map((asset) => asset.id)).size).toBe(toolbarShapeAssets.length);
    expect(multiconnectPresetById("wrench-rack-metric-1")).toBeDefined();
    expect(multiconnectPresetById("nope")).toBeUndefined();
  });

  it.each(Object.keys(PRODUCTION_SPECS))("%s inserts geometry byte-identical to the production STL spec", (presetId) => {
    const inserted = makeShapeFromAsset(presetAsset(presetId));
    expect(inserted.kind).toBe("multiconnectContainer");
    expect(inserted.multiconnectShapeType).toBe("PegPlate");
    const fromPreset = multiconnectPlatePositions(multiconnectPlateOptionsForShape(inserted));
    const fromSpec = multiconnectPlatePositions(PRODUCTION_SPECS[presetId]);
    expect(fromPreset.length).toBe(fromSpec.length);
    expect(fromPreset.every((value, index) => Object.is(value, fromSpec[index]))).toBe(true);
  }, 20000);

  it("an inserted preset is a normal shape: editable, and survives .skf export round-trip", async () => {
    const inserted = { ...makeShapeFromAsset(presetAsset("wrench-rack-metric-1"), { x: 10, z: 5 }), id: "preset-roundtrip" };
    const bytes = await exportSkfProject({
      projectId: "multiconnect-preset-test",
      projectName: "Preset round trip",
      createdAt: 1_700_000_000_000,
      modifiedAt: 1_700_000_000_100,
      shapes: [inserted],
      assets: [],
      workspace: DEFAULT_WORKPLANE_WORKSPACE,
      snapGrid: DEFAULT_SNAP_GRID,
      placementElevation: 0,
    });
    const restored = (await importSkfProject(bytes)).shapes[0];
    expect(multiconnectPlateOptionsForShape(restored)).toEqual(multiconnectPlateOptionsForShape(inserted));
    // Nothing preset-specific survives on the shape itself -- editing works
    // like any hand-configured plate (drop a peg, options follow).
    const edited = { ...restored, multiconnectPegs: restored.multiconnectPegs!.slice(0, 3) };
    expect(multiconnectPlateOptionsForShape(edited).pegs).toHaveLength(3);
  });
});
