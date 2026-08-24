import type { MulticonnectShapePeg, WorkplaneShape } from "@/types/sketchforge";

// Built-in parts library for the Multiconnect Container: named, fully
// specified parameter sets that insert as ordinary, fully-editable
// multiconnectContainer shapes (makeShapeFromAsset applies `shape` on top
// of the blank insert; nothing is special about the result afterward).
//
// The six wrench racks below are the physically-validated production set:
// every number matches the batch-export specs the printed STLs in
// test-prints/ were generated from (240x60mm plate, 10mm thick, 5mm
// corners, 28mm slot spacing, tolerance 1.0; pegs length 45, fillet 2,
// tilt 5deg, row at z=35; peg x in AS-MOUNTED VIEW SPACE, left to right).
// Do not "tidy" the peg tables -- they are the printed parts.
//
// Adding a future preset (another tool family, another part) is one entry:
// give it an id, a display name, a `group` (its labeled section in the
// insert menu), and the shape fields to pre-fill.

export type MulticonnectPreset = {
  id: string;
  name: string;
  // Labeled group in the insert menu; presets sharing a group render as one
  // titled section.
  group: string;
  // Applied over the blank Multiconnect Container insert's defaults.
  shape: Partial<WorkplaneShape>;
};

const WRENCH_RACK_BASE: Partial<WorkplaneShape> = {
  width: 240,
  height: 60,
  depth: 10, // plateThickness parameter
  multiconnectShapeType: "PegPlate",
  multiconnectCornerRadius: 5,
  multiconnectSlotSpacing: 28,
  multiconnectSlotQuickRelease: false,
  multiconnectSlotTolerance: 1,
  multiconnectPegLength: 45,
  multiconnectPegFillet: 2,
  multiconnectPegTilt: 5,
  multiconnectPegRowZ: 35,
};

const pegs = (...entries: Array<[diameter: number, x: number]>): MulticonnectShapePeg[] =>
  entries.map(([diameter, x]) => ({ diameter, x }));

function wrenchRack(id: string, name: string, pegList: MulticonnectShapePeg[]): MulticonnectPreset {
  return { id, name, group: "Wrench Racks", shape: { ...WRENCH_RACK_BASE, multiconnectPegs: pegList } };
}

export const MULTICONNECT_PRESETS: MulticonnectPreset[] = [
  wrenchRack("wrench-rack-metric-1", "Wrench Rack Metric 1 (6-12mm)", pegs([5, 20], [5, 48], [6, 78], [6, 110], [7, 144], [7, 181], [8, 220])),
  wrenchRack("wrench-rack-metric-2", "Wrench Rack Metric 2 (13-19mm)", pegs([8, 20], [9, 50], [9, 81], [10, 113], [10, 147], [11, 183], [12, 220])),
  wrenchRack("wrench-rack-metric-3", "Wrench Rack Metric 3 (20-24mm)", pegs([12, 20], [13, 67], [13, 116], [14, 167], [14, 220])),
  wrenchRack("wrench-rack-sae-1", "Wrench Rack SAE 1 (5/16-11/16)", pegs([5, 20], [6, 48], [6, 78], [7, 110], [8, 144], [9, 181], [10, 220])),
  wrenchRack("wrench-rack-sae-2", "Wrench Rack SAE 2 (3/4-1)", pegs([10, 20], [11, 67], [11, 116], [12, 167], [13, 220])),
  wrenchRack("wrench-rack-sae-3", "Wrench Rack SAE 3 (1-1/16 - 1-1/4)", pegs([13, 20], [14, 85], [14, 152], [14, 220])),
];

export function multiconnectPresetById(id: string): MulticonnectPreset | undefined {
  return MULTICONNECT_PRESETS.find((preset) => preset.id === id);
}
