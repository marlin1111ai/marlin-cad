import { canonicalizeShape } from "@/lib/workplaneShapes";
import { createLocalId } from "@/lib/localIds";
import { DEFAULT_GEAR_CENTER_HOLE_SIZE, DEFAULT_GEAR_HELIX_ANGLE, DEFAULT_GEAR_HELIX_QUALITY, DEFAULT_GEAR_TEETH, DEFAULT_GEAR_TOOTH_SIZE, DEFAULT_GEAR_TYPE } from "@/lib/gearGeometry";
import { DEFAULT_OPENGRID_BOARD_TYPE, DEFAULT_OPENGRID_CHAMFER_MODE, DEFAULT_OPENGRID_CONNECTOR_HOLES, DEFAULT_OPENGRID_GRID_HEIGHT, DEFAULT_OPENGRID_GRID_WIDTH, DEFAULT_OPENGRID_SCREW_MOUNTING, openGridBoardDimensions } from "@/lib/openGridGeometry";
import {
  DEFAULT_OPENCONNECT_BASE_THICKNESS,
  DEFAULT_OPENCONNECT_CORNER_ROUNDING,
  DEFAULT_OPENCONNECT_INTERNAL_DEPTH,
  DEFAULT_OPENCONNECT_INTERNAL_HEIGHT,
  DEFAULT_OPENCONNECT_INTERNAL_WIDTH,
  DEFAULT_OPENCONNECT_SHAPE_TYPE,
  DEFAULT_OPENCONNECT_SLOT_LOCK_DISTRIBUTION,
  DEFAULT_OPENCONNECT_SLOT_POSITION,
  DEFAULT_OPENCONNECT_WALL_THICKNESS,
  openConnectContainerDimensions,
} from "@/lib/openConnectContainerGeometry";
import { DEFAULT_OPENGRID_SNAP_BOARD_TYPE, DEFAULT_OPENGRID_SNAP_BODY_SHAPE, openGridSnapDimensions } from "@/lib/openGridSnapGeometry";
import {
  createMulticonnectPlateGeometry,
  DEFAULT_MULTICONNECT_PEG_FILLET_RADIUS,
  DEFAULT_MULTICONNECT_PEG_TILT_DEG,
  DEFAULT_MULTICONNECT_SLOT_SPACING,
  DEFAULT_MULTICONNECT_SLOT_TOLERANCE,
  multiconnectPlateDimensions,
  multiconnectPlatePositions,
  type MulticonnectPlateOptions,
} from "@/lib/multiconnectContainerGeometry";
import { shapeDepth, shapeWidth } from "@/lib/workplaneShapes";
import type { ShapeAsset, WorkplaneShape } from "@/types/sketchforge";

export type ToolbarShapeAsset = ShapeAsset & { menuIcon: string; category?: string };

const BASIC_SHAPES_CATEGORY = "Basic Shapes";
const OPENGRID_CATEGORY = "OpenGrid";

export const toolbarShapeAssets: ToolbarShapeAsset[] = [
  { id: "box", name: "Box", src: "assets/sketchforge/shape-icons-gray/box.png", menuIcon: "assets/sketchforge/shape-icons-gray/box.png", kind: "box", color: "#d41721", category: BASIC_SHAPES_CATEGORY },
  { id: "cylinder", name: "Cylinder", src: "assets/sketchforge/shape-icons-gray/cylinder.png", menuIcon: "assets/sketchforge/shape-icons-gray/cylinder.png", kind: "cylinder", color: "#d97813", category: BASIC_SHAPES_CATEGORY },
  { id: "sphere", name: "Sphere", src: "assets/sketchforge/shape-icons-gray/sphere.png", menuIcon: "assets/sketchforge/shape-icons-gray/sphere.png", kind: "sphere", color: "#0098c7", category: BASIC_SHAPES_CATEGORY },
  { id: "cone", name: "Cone", src: "assets/sketchforge/shape-icons-gray/cone.png", menuIcon: "assets/sketchforge/shape-icons-gray/cone.png", kind: "cone", color: "#6e2786", category: BASIC_SHAPES_CATEGORY },
  { id: "pyramid", name: "Pyramid", src: "assets/sketchforge/shape-icons-gray/pyramid.png", menuIcon: "assets/sketchforge/shape-icons-gray/pyramid.png", kind: "pyramid", color: "#f2cf10", category: BASIC_SHAPES_CATEGORY },
  { id: "wedge", name: "Wedge", src: "assets/sketchforge/shape-icons-gray/wedge.png", menuIcon: "assets/sketchforge/shape-icons-gray/wedge.png", kind: "wedge", color: "#33983d", category: BASIC_SHAPES_CATEGORY },
  { id: "text", name: "Text", src: "assets/sketchforge/shape-icons-gray/text.png", menuIcon: "assets/sketchforge/shape-icons-gray/text.png", kind: "text", color: "#cf101b", category: BASIC_SHAPES_CATEGORY },
  { id: "round-roof", name: "Round Roof", src: "assets/sketchforge/shape-icons-gray/round-roof.png", menuIcon: "assets/sketchforge/shape-icons-gray/round-roof.png", kind: "roundRoof", color: "#67c4ce", category: BASIC_SHAPES_CATEGORY },
  { id: "half-sphere", name: "Half Sphere", src: "assets/sketchforge/shape-icons-gray/half-sphere.png", menuIcon: "assets/sketchforge/shape-icons-gray/half-sphere.png", kind: "halfSphere", color: "#c9009a", category: BASIC_SHAPES_CATEGORY },
  { id: "torus", name: "Torus", src: "assets/sketchforge/shape-icons-gray/torus.png", menuIcon: "assets/sketchforge/shape-icons-gray/torus.png", kind: "torus", color: "#0098c7", category: BASIC_SHAPES_CATEGORY },
  { id: "tube", name: "Tube", src: "assets/sketchforge/shape-icons-gray/tube.png", menuIcon: "assets/sketchforge/shape-icons-gray/tube.png", kind: "tube", color: "#ce7013", category: BASIC_SHAPES_CATEGORY },
  { id: "gear", name: "Gear", src: "assets/sketchforge/gear-types/spur.png", menuIcon: "assets/sketchforge/gear-types/spur.png", kind: "gear", color: "#6f7f8d", category: BASIC_SHAPES_CATEGORY },
  // No dedicated icon asset exists yet for the openGrid board -- reusing the
  // box icon as the closest stand-in for a flat plate until one is made.
  { id: "opengrid-board", name: "OpenGrid Board", src: "assets/sketchforge/shape-icons-gray/box.png", menuIcon: "assets/sketchforge/shape-icons-gray/box.png", kind: "openGridBoard", color: "#5b5ce2", category: OPENGRID_CATEGORY },
  // No dedicated icon asset exists yet for the openConnect container either --
  // reusing the box icon as its stand-in too. Bin/Shelf is a property
  // (containerShapeType), switched via the inspector panel, same pattern as
  // the board's own boardType/chamferMode -- one catalog entry, not two.
  { id: "openconnect-container", name: "OpenConnect Container", src: "assets/sketchforge/shape-icons-gray/box.png", menuIcon: "assets/sketchforge/shape-icons-gray/box.png", kind: "openConnectContainer", color: "#2f9e6e", category: OPENGRID_CATEGORY },
  // No dedicated icon asset exists yet for the openGrid snap either -- reusing
  // the box icon as its stand-in too. boardType/snapBodyShape are properties
  // switched via the inspector panel, same one-catalog-entry pattern as the
  // board and container above.
  { id: "opengrid-snap", name: "OpenGrid Snap", src: "assets/sketchforge/shape-icons-gray/box.png", menuIcon: "assets/sketchforge/shape-icons-gray/box.png", kind: "openGridSnap", color: "#c77b1f", category: OPENGRID_CATEGORY },
  // No dedicated icon asset exists yet for the multiconnect container either --
  // same box-icon stand-in. Plate/PegPlate is a property
  // (multiconnectShapeType) switched via the inspector panel, one catalog
  // entry, matching the container/board/snap pattern above.
  { id: "multiconnect-container", name: "Multiconnect Container", src: "assets/sketchforge/shape-icons-gray/box.png", menuIcon: "assets/sketchforge/shape-icons-gray/box.png", kind: "multiconnectContainer", color: "#9b3bd2", category: OPENGRID_CATEGORY },
];

// Insert defaults for the Multiconnect Container: a 112x60 Plate (4 slots at
// the 28mm spacing), 10mm thick (the physically-validated wrench-rack
// recipe), 5mm rounded corners.
export const DEFAULT_MULTICONNECT_SHAPE_WIDTH = 112;
export const DEFAULT_MULTICONNECT_SHAPE_HEIGHT = 60;
export const DEFAULT_MULTICONNECT_SHAPE_THICKNESS = 10;
export const DEFAULT_MULTICONNECT_SHAPE_CORNER_RADIUS = 5;
export const DEFAULT_MULTICONNECT_PEG_LENGTH = 45;

// The single shape -> geometry-options mapping for the Multiconnect
// Container: the viewport arm, the editor's export arm, and the inspector's
// validation all go through this, so what renders, what exports, and what
// validates can never disagree. Peg x stays in as-mounted view space here --
// the geometry module owns the mirror.
export function multiconnectPlateOptionsForShape(shape: WorkplaneShape): MulticonnectPlateOptions {
  const pegLength = shape.multiconnectPegLength ?? DEFAULT_MULTICONNECT_PEG_LENGTH;
  const pegRowZ = shape.multiconnectPegRowZ ?? Math.round(shape.height / 2);
  const pegs = shape.multiconnectShapeType === "PegPlate"
    ? (shape.multiconnectPegs ?? []).map((peg) => ({ diameter: peg.diameter, length: pegLength, x: peg.x, z: pegRowZ }))
    : [];
  return {
    width: shapeWidth(shape),
    height: shape.height,
    plateThickness: shapeDepth(shape),
    cornerRadius: shape.multiconnectCornerRadius,
    slotSpacing: shape.multiconnectSlotSpacing,
    slotQuickRelease: shape.multiconnectSlotQuickRelease,
    slotTolerance: shape.multiconnectSlotTolerance,
    pegs,
    pegFilletRadius: shape.multiconnectPegFillet,
    pegTiltDeg: shape.multiconnectPegTilt,
  };
}

// The geometry module THROWS on invalid peg layouts (its callers are
// expected to validate). The render/export arms must never crash on a
// half-edited layout, so they fall back to the bare plate; the inspector
// shows the validation message inline instead (multiconnectPegLayoutError).
export function createMulticonnectGeometryForShape(shape: WorkplaneShape) {
  const options = multiconnectPlateOptionsForShape(shape);
  try {
    return createMulticonnectPlateGeometry(options);
  } catch {
    return createMulticonnectPlateGeometry({ ...options, pegs: [] });
  }
}

// Friendly inline message for the inspector: null when the peg layout is
// valid, otherwise the geometry module's rejection translated to 1-based
// peg numbers and plain language.
export function multiconnectPegLayoutError(shape: WorkplaneShape): string | null {
  const options = multiconnectPlateOptionsForShape(shape);
  if (!options.pegs?.length) return null;
  try {
    multiconnectPlatePositions(options);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const overlap = message.match(/pegs (\d+) and (\d+): footprints overlap/);
    if (overlap) return `Pegs ${Number(overlap[1]) + 1} and ${Number(overlap[2]) + 1} overlap — space them further apart.`;
    const edge = message.match(/peg (\d+): footprint .* edge/);
    if (edge) return `Peg ${Number(edge[1]) + 1} is too close to the plate edge (2mm clearance beyond the fillet is required).`;
    const short = message.match(/peg (\d+): length/);
    if (short) return `Peg ${Number(short[1]) + 1} is too short to clear its root fillet.`;
    const invalid = message.match(/peg (\d+): diameter/);
    if (invalid) return `Peg ${Number(invalid[1]) + 1} has invalid values.`;
    return message;
  }
}

export type ToolbarShapeAssetGroup = { category: string; shapes: ToolbarShapeAsset[] };

export const toolbarShapeAssetGroups: ToolbarShapeAssetGroup[] = (() => {
  const order: string[] = [];
  const byCategory = new Map<string, ToolbarShapeAsset[]>();
  toolbarShapeAssets.forEach((shape) => {
    const category = shape.category ?? BASIC_SHAPES_CATEGORY;
    if (!byCategory.has(category)) {
      order.push(category);
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(shape);
  });
  return order.map((category) => ({ category, shapes: byCategory.get(category)! }));
})();

export function sceneShape(shape: Partial<WorkplaneShape> & Pick<WorkplaneShape, "name" | "kind" | "color">): WorkplaneShape {
  const width = shape.width ?? shape.size ?? 20;
  const depth = shape.depth ?? shape.size ?? 20;
  const height = shape.height ?? 20;
  return canonicalizeShape({
    id: shape.id ?? createLocalId("shape"),
    name: shape.name,
    kind: shape.kind,
    color: shape.color,
    hole: shape.hole,
    x: shape.x ?? 0,
    z: shape.z ?? 0,
    elevation: shape.elevation ?? 0,
    size: shape.size ?? Math.max(width, depth),
    width,
    depth,
    height,
    rotation: shape.rotation ?? 0,
    rotationX: shape.rotationX ?? 0,
    rotationZ: shape.rotationZ ?? 0,
    radius: shape.radius,
    steps: shape.steps,
    sides: shape.sides,
    bevel: shape.bevel,
    segments: shape.segments,
    topRadius: shape.topRadius,
    baseRadius: shape.baseRadius,
    teeth: shape.teeth,
    toothSize: shape.toothSize,
    toothWidth: shape.toothWidth,
    centerHoleSize: shape.centerHoleSize,
    gearType: shape.gearType,
    helixAngle: shape.helixAngle,
    helixQuality: shape.helixQuality,
    text: shape.text,
    font: shape.font,
    importedMesh: shape.importedMesh,
    imagePlate: shape.imagePlate,
    sketchProfile: shape.sketchProfile,
    sketchOperation: shape.sketchOperation,
    sketchRevolve: shape.sketchRevolve,
    groupedShapes: shape.groupedShapes,
    groupedBaseWidth: shape.groupedBaseWidth,
    groupedBaseDepth: shape.groupedBaseDepth,
    groupedBaseHeight: shape.groupedBaseHeight,
    groupOperation: shape.groupOperation,
    locked: shape.locked ?? false,
    hidden: shape.hidden ?? false,
  });
}

export function makeShapeFromAsset(asset: ShapeAsset, point?: { x: number; z: number; elevation?: number }): WorkplaneShape {
  const roundProfile = asset.kind === "sphere" || asset.kind === "torus" || asset.kind === "ring" || asset.kind === "halfSphere";
  const flatProfile = asset.kind === "torus" || asset.kind === "ring" || asset.kind === "text" || asset.kind === "gear";
  const openGridBoardDefaults = asset.kind === "openGridBoard" ? openGridBoardDimensions(DEFAULT_OPENGRID_GRID_WIDTH, DEFAULT_OPENGRID_GRID_HEIGHT, DEFAULT_OPENGRID_BOARD_TYPE) : undefined;
  const openConnectContainerDefaults = asset.kind === "openConnectContainer"
    ? openConnectContainerDimensions({
        shapeType: DEFAULT_OPENCONNECT_SHAPE_TYPE,
        internalWidth: DEFAULT_OPENCONNECT_INTERNAL_WIDTH,
        internalHeight: DEFAULT_OPENCONNECT_INTERNAL_HEIGHT,
        internalDepth: DEFAULT_OPENCONNECT_INTERNAL_DEPTH,
        wallThickness: DEFAULT_OPENCONNECT_WALL_THICKNESS,
        baseThickness: DEFAULT_OPENCONNECT_BASE_THICKNESS,
      })
    : undefined;
  const openGridSnapDefaults = asset.kind === "openGridSnap" ? openGridSnapDimensions(DEFAULT_OPENGRID_SNAP_BOARD_TYPE, DEFAULT_OPENGRID_SNAP_BODY_SHAPE) : undefined;
  // width/height validated through the module's own clamps; depth stays the
  // literal plateThickness parameter (multiconnectPlateDimensions().depth is
  // the derived mounting-face coordinate -- numerically ~= thickness but not
  // the same double, and depth round-trips back in as the parameter).
  const multiconnectDefaults = asset.kind === "multiconnectContainer"
    ? {
        ...multiconnectPlateDimensions({ width: DEFAULT_MULTICONNECT_SHAPE_WIDTH, height: DEFAULT_MULTICONNECT_SHAPE_HEIGHT, plateThickness: DEFAULT_MULTICONNECT_SHAPE_THICKNESS }),
        depth: DEFAULT_MULTICONNECT_SHAPE_THICKNESS,
      }
    : undefined;
  const size = asset.kind === "gear" ? 30 : roundProfile ? 22 : 20;
  const height = openGridBoardDefaults ? openGridBoardDefaults.height : openConnectContainerDefaults ? openConnectContainerDefaults.height : openGridSnapDefaults ? openGridSnapDefaults.height : multiconnectDefaults ? multiconnectDefaults.height : asset.kind === "gear" ? 6 : asset.kind === "text" ? 10 : asset.kind === "roundRoof" ? 10 : asset.kind === "halfSphere" ? 11 : flatProfile ? 5 : 20;
  const width = openGridBoardDefaults ? openGridBoardDefaults.width : openConnectContainerDefaults ? openConnectContainerDefaults.width : openGridSnapDefaults ? openGridSnapDefaults.width : multiconnectDefaults ? multiconnectDefaults.width : asset.kind === "text" ? 86 : size;
  const depth = openGridBoardDefaults ? openGridBoardDefaults.depth : openConnectContainerDefaults ? openConnectContainerDefaults.depth : openGridSnapDefaults ? openGridSnapDefaults.depth : multiconnectDefaults ? multiconnectDefaults.depth : asset.kind === "text" ? 28 : size;

  return {
    id: createLocalId(asset.id),
    name: asset.name,
    kind: asset.kind,
    color: asset.color,
    hole: asset.hole,
    x: point?.x ?? 0,
    z: point?.z ?? 0,
    elevation: point?.elevation ?? 0,
    size,
    width,
    depth,
    height,
    rotation: 0,
    rotationX: 0,
    rotationZ: 0,
    radius: asset.kind === "box" ? 0 : undefined,
    text: asset.kind === "text" ? "TEXT" : undefined,
    font: asset.kind === "text" ? "Multilanguage" : undefined,
    steps: asset.kind === "box" ? 10 : asset.kind === "sphere" ? 24 : asset.kind === "halfSphere" ? 32 : undefined,
    sides: asset.kind === "cylinder" || asset.kind === "cone" ? 96 : asset.kind === "roundRoof" ? 64 : asset.kind === "pyramid" ? 4 : undefined,
    bevel: asset.kind === "cylinder" ? 0 : asset.kind === "tube" || asset.kind === "ring" ? 4 : undefined,
    segments: asset.kind === "cylinder" ? 1 : undefined,
    topRadius: asset.kind === "cone" ? 0 : undefined,
    baseRadius: asset.kind === "cone" ? size / 2 : undefined,
    teeth: asset.kind === "gear" ? DEFAULT_GEAR_TEETH : undefined,
    toothSize: asset.kind === "gear" ? DEFAULT_GEAR_TOOTH_SIZE : undefined,
    centerHoleSize: asset.kind === "gear" ? DEFAULT_GEAR_CENTER_HOLE_SIZE : undefined,
    gearType: asset.kind === "gear" ? DEFAULT_GEAR_TYPE : undefined,
    helixAngle: asset.kind === "gear" ? DEFAULT_GEAR_HELIX_ANGLE : undefined,
    helixQuality: asset.kind === "gear" ? DEFAULT_GEAR_HELIX_QUALITY : undefined,
    gridWidth: asset.kind === "openGridBoard" ? DEFAULT_OPENGRID_GRID_WIDTH : undefined,
    gridHeight: asset.kind === "openGridBoard" ? DEFAULT_OPENGRID_GRID_HEIGHT : undefined,
    boardType: asset.kind === "openGridBoard" ? DEFAULT_OPENGRID_BOARD_TYPE : asset.kind === "openGridSnap" ? DEFAULT_OPENGRID_SNAP_BOARD_TYPE : undefined,
    chamferMode: asset.kind === "openGridBoard" ? DEFAULT_OPENGRID_CHAMFER_MODE : undefined,
    connectorHoles: asset.kind === "openGridBoard" ? DEFAULT_OPENGRID_CONNECTOR_HOLES : undefined,
    screwMounting: asset.kind === "openGridBoard" ? DEFAULT_OPENGRID_SCREW_MOUNTING : undefined,
    containerShapeType: asset.kind === "openConnectContainer" ? DEFAULT_OPENCONNECT_SHAPE_TYPE : undefined,
    internalWidth: asset.kind === "openConnectContainer" ? DEFAULT_OPENCONNECT_INTERNAL_WIDTH : undefined,
    internalHeight: asset.kind === "openConnectContainer" ? DEFAULT_OPENCONNECT_INTERNAL_HEIGHT : undefined,
    internalDepth: asset.kind === "openConnectContainer" ? DEFAULT_OPENCONNECT_INTERNAL_DEPTH : undefined,
    wallThickness: asset.kind === "openConnectContainer" ? DEFAULT_OPENCONNECT_WALL_THICKNESS : undefined,
    baseThickness: asset.kind === "openConnectContainer" ? DEFAULT_OPENCONNECT_BASE_THICKNESS : undefined,
    leftWallEnabled: asset.kind === "openConnectContainer" ? true : undefined,
    rightWallEnabled: asset.kind === "openConnectContainer" ? true : undefined,
    frontWallEnabled: asset.kind === "openConnectContainer" ? true : undefined,
    bottomWallEnabled: asset.kind === "openConnectContainer" ? true : undefined,
    slotLockDistribution: asset.kind === "openConnectContainer" ? DEFAULT_OPENCONNECT_SLOT_LOCK_DISTRIBUTION : undefined,
    slotPosition: asset.kind === "openConnectContainer" ? DEFAULT_OPENCONNECT_SLOT_POSITION : undefined,
    cornerRounding: asset.kind === "openConnectContainer" ? DEFAULT_OPENCONNECT_CORNER_ROUNDING : undefined,
    snapBodyShape: asset.kind === "openGridSnap" ? DEFAULT_OPENGRID_SNAP_BODY_SHAPE : undefined,
    multiconnectShapeType: asset.kind === "multiconnectContainer" ? "Plate" : undefined,
    multiconnectSlotSpacing: asset.kind === "multiconnectContainer" ? DEFAULT_MULTICONNECT_SLOT_SPACING : undefined,
    multiconnectSlotQuickRelease: asset.kind === "multiconnectContainer" ? false : undefined,
    multiconnectSlotTolerance: asset.kind === "multiconnectContainer" ? DEFAULT_MULTICONNECT_SLOT_TOLERANCE : undefined,
    multiconnectCornerRadius: asset.kind === "multiconnectContainer" ? DEFAULT_MULTICONNECT_SHAPE_CORNER_RADIUS : undefined,
    multiconnectPegLength: asset.kind === "multiconnectContainer" ? DEFAULT_MULTICONNECT_PEG_LENGTH : undefined,
    multiconnectPegFillet: asset.kind === "multiconnectContainer" ? DEFAULT_MULTICONNECT_PEG_FILLET_RADIUS : undefined,
    multiconnectPegTilt: asset.kind === "multiconnectContainer" ? DEFAULT_MULTICONNECT_PEG_TILT_DEG : undefined,
    multiconnectPegRowZ: asset.kind === "multiconnectContainer" ? Math.round(DEFAULT_MULTICONNECT_SHAPE_HEIGHT / 2) : undefined,
    multiconnectPegs: asset.kind === "multiconnectContainer" ? [] : undefined,
    locked: false,
    hidden: false,
  };
}
