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
  createMountedSocketTrayGeometry,
  mountedSocketTrayDimensions,
  mountedSocketTrayPositions,
  DEFAULT_MOUNTED_SOCKET_TRAY_DEPTH,
  DEFAULT_MOUNTED_SOCKET_TRAY_PLATE_HEIGHT,
  DEFAULT_MOUNTED_SOCKET_TRAY_PLATE_THICKNESS,
  DEFAULT_MOUNTED_SOCKET_TRAY_PLATE_WIDTH,
  DEFAULT_MOUNTED_SOCKET_TRAY_POCKET_DEPTH,
  DEFAULT_MOUNTED_SOCKET_TRAY_SLOT_COUNT,
  DEFAULT_MOUNTED_SOCKET_TRAY_SLOT_SPACING,
  DEFAULT_MOUNTED_SOCKET_TRAY_THICKNESS,
  type MountedSocketTrayOptions,
} from "@/lib/mountedSocketTrayGeometry";
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
import { MULTICONNECT_PRESETS, multiconnectPresetById } from "@/lib/multiconnectPresets";
import {
  createSocketTrayGeometry,
  MIN_SOCKET_TRAY_FLOOR_THICKNESS,
  SOCKET_TRAY_POCKET_EDGE_CLEARANCE,
  SOCKET_TRAY_POCKET_GAP,
  socketTrayDimensions,
  socketTrayPositions,
  type SocketTrayOptions,
} from "@/lib/socketTrayGeometry";
import { shapeDepth, shapeWidth } from "@/lib/workplaneShapes";
import type { MountedSocketTrayShapePocket, ShapeAsset, SocketTrayShapePocket, WorkplaneShape } from "@/types/sketchforge";

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
  // Socket Tray: same box-icon stand-in, one catalog entry in the OpenGrid
  // section next to the Multiconnect Container; the pocket list is edited in
  // the inspector (SocketTrayPocketCard), like the PegPlate's peg list.
  { id: "socket-tray", name: "Socket Tray", src: "assets/sketchforge/shape-icons-gray/box.png", menuIcon: "assets/sketchforge/shape-icons-gray/box.png", kind: "socketTray", color: "#3b82f6", category: OPENGRID_CATEGORY },
  // Mounted Socket Tray: the wall-hanging sibling of the flat tray above -- a
  // Multiconnect slotted back plate (no pegs) with the pocketed tray
  // projecting forward from it, built as one solid. Same box-icon stand-in,
  // one catalog entry in the OpenGrid section; the pocket list is edited in
  // the inspector (MountedSocketTrayPocketCard).
  { id: "mounted-socket-tray", name: "Mounted Socket Tray", src: "assets/sketchforge/shape-icons-gray/box.png", menuIcon: "assets/sketchforge/shape-icons-gray/box.png", kind: "mountedSocketTray", color: "#0ea5a4", category: OPENGRID_CATEGORY },
  // Built-in parts library (multiconnectPresets.ts): each preset is a normal
  // multiconnectContainer entry whose presetId makes makeShapeFromAsset
  // pre-fill the inserted shape. Presets group under their own labeled
  // section (preset.group) in the OpenGrid insert menu.
  ...MULTICONNECT_PRESETS.map((preset): ToolbarShapeAsset => ({
    id: preset.id,
    name: preset.name,
    src: "assets/sketchforge/shape-icons-gray/box.png",
    menuIcon: "assets/sketchforge/shape-icons-gray/box.png",
    kind: "multiconnectContainer",
    color: "#9b3bd2",
    category: preset.group,
    presetId: preset.id,
  })),
];

// Insert defaults for the Multiconnect Container: a 112x60 Plate (4 slots at
// the 28mm spacing), 10mm thick (the physically-validated wrench-rack
// recipe), 5mm rounded corners.
export const DEFAULT_MULTICONNECT_SHAPE_WIDTH = 112;
export const DEFAULT_MULTICONNECT_SHAPE_HEIGHT = 60;
export const DEFAULT_MULTICONNECT_SHAPE_THICKNESS = 10;
export const DEFAULT_MULTICONNECT_SHAPE_CORNER_RADIUS = 5;
export const DEFAULT_MULTICONNECT_PEG_LENGTH = 45;

// Insert defaults for the Socket Tray: the 6-pocket sampler coupon from
// reference/socket-tray-sampler-report.md verbatim. Tray 240 x 60 x 18 comes
// from the module's own defaults (socketTrayDimensions); pocket depth 14mm
// over a 4mm floor; diameters are measured socket OD + 2mm clearance at 36mm
// pitch with 30mm margins on the z=30 centerline.
export const DEFAULT_SOCKET_TRAY_SHAPE_POCKET_DEPTH = 14;
export const DEFAULT_SOCKET_TRAY_SHAPE_POCKETS: ReadonlyArray<SocketTrayShapePocket> = [
  { diameter: 14, x: 30, z: 30 },
  { diameter: 15, x: 66, z: 30 },
  { diameter: 19, x: 102, z: 30 },
  { diameter: 20.7, x: 138, z: 30 },
  { diameter: 23, x: 174, z: 30 },
  { diameter: 25, x: 210, z: 30 },
];

// The single shape -> geometry-options mapping for the Socket Tray: the
// viewport arm, the editor's export arm, and the inspector's validation all
// go through this. Tray width -> shape.width, tray depth -> shape.depth, tray
// thickness -> shape.height (the app's Y-up dimension, matching the module's
// Y = thickness frame). The shared socketTrayPocketDepth is applied to every
// pocket; the module takes depth per pocket but the UI does not expose that.
export function socketTrayOptionsForShape(shape: WorkplaneShape): SocketTrayOptions {
  const pocketDepth = shape.socketTrayPocketDepth ?? DEFAULT_SOCKET_TRAY_SHAPE_POCKET_DEPTH;
  return {
    width: shapeWidth(shape),
    depth: shapeDepth(shape),
    thickness: shape.height,
    pockets: (shape.socketTrayPockets ?? []).map((pocket) => ({ diameter: pocket.diameter, depth: pocketDepth, x: pocket.x, z: pocket.z })),
  };
}

// The geometry module THROWS on an invalid pocket layout (its callers are
// expected to validate). The render/export arms must never crash on a
// half-edited layout, so they fall back to the bare tray (no pockets); the
// inspector shows the validation message inline instead (socketTrayLayoutError).
export function createSocketTrayGeometryForShape(shape: WorkplaneShape) {
  const options = socketTrayOptionsForShape(shape);
  try {
    return createSocketTrayGeometry(options);
  } catch {
    return createSocketTrayGeometry({ ...options, pockets: [] });
  }
}

// Friendly inline message for the inspector: null when the pocket layout is
// valid, otherwise the geometry module's rejection translated to 1-based
// pocket numbers and plain language.
export function socketTrayLayoutError(shape: WorkplaneShape): string | null {
  const options = socketTrayOptionsForShape(shape);
  if (!options.pockets?.length) return null;
  try {
    socketTrayPositions(options);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const overlap = message.match(/pockets (\d+) and (\d+): footprints overlap/);
    if (overlap) return `Pockets ${Number(overlap[1]) + 1} and ${Number(overlap[2]) + 1} overlap or leave too thin a wall — keep at least ${SOCKET_TRAY_POCKET_GAP}mm between them.`;
    const edge = message.match(/pocket (\d+): footprint .* edge/);
    if (edge) return `Pocket ${Number(edge[1]) + 1} is too close to the tray edge (${SOCKET_TRAY_POCKET_EDGE_CLEARANCE}mm clearance is required).`;
    const floor = message.match(/pocket (\d+): depth .* floor/);
    if (floor) return `Pocket Depth leaves less than the ${MIN_SOCKET_TRAY_FLOOR_THICKNESS}mm minimum floor — reduce Pocket Depth or increase Thickness.`;
    const invalid = message.match(/pocket (\d+): diameter/);
    if (invalid) return `Pocket ${Number(invalid[1]) + 1} has invalid values.`;
    return message;
  }
}

// Insert defaults for the Mounted Socket Tray: a printable coupon, NOT a
// production tray. The plate numbers are the physically validated wrench-rack
// recipe (multiconnectPresets.ts): 240 x 60 x 10mm at 28mm slot spacing, which
// is 8 slots centered on the plate. Tray 60mm deep and 18mm thick, pockets
// 14mm deep over a 4mm floor (18 - 14). Three pockets at 14 / 19 / 25mm on the
// z = 30 tray centerline, 30mm end margins like the flat coupon, so the pitch
// is (240 - 30 - 30) / 2 = 90mm and the centers land at 30 / 120 / 210.
// See reference/reports/mounted-socket-tray-build.md for the arithmetic.
export const DEFAULT_MOUNTED_SOCKET_TRAY_SHAPE_POCKETS: ReadonlyArray<MountedSocketTrayShapePocket> = [
  { diameter: 14, x: 30, z: 30 },
  { diameter: 19, x: 120, z: 30 },
  { diameter: 25, x: 210, z: 30 },
];

// The single shape -> geometry-options mapping for the Mounted Socket Tray:
// the viewport arm, the editor's export arm, and the inspector's validation
// all go through this. Plate width -> shape.width (X), plate height ->
// shape.height (the app's Y-up dimension), and the solid's full Z extent ->
// shape.depth, with the tray projection and plate thickness held in their own
// fields. That is the same axis rule the flat Socket Tray's build report
// established (the app's `height` IS the Y-up dimension); here the Y-up
// dimension is the plate's height rather than the tray's thickness, because
// this part stands up against a board instead of lying flat.
export function mountedSocketTrayOptionsForShape(shape: WorkplaneShape): MountedSocketTrayOptions {
  return {
    plateWidth: shapeWidth(shape),
    plateHeight: shape.height,
    plateThickness: shape.mountedTrayPlateThickness ?? DEFAULT_MOUNTED_SOCKET_TRAY_PLATE_THICKNESS,
    slotSpacing: shape.mountedTraySlotSpacing ?? DEFAULT_MOUNTED_SOCKET_TRAY_SLOT_SPACING,
    slotCount: shape.mountedTraySlotCount ?? DEFAULT_MOUNTED_SOCKET_TRAY_SLOT_COUNT,
    trayDepth: shape.mountedTrayProjection ?? DEFAULT_MOUNTED_SOCKET_TRAY_DEPTH,
    trayThickness: shape.mountedTrayThickness ?? DEFAULT_MOUNTED_SOCKET_TRAY_THICKNESS,
    pocketDepth: shape.mountedTrayPocketDepth ?? DEFAULT_MOUNTED_SOCKET_TRAY_POCKET_DEPTH,
    pockets: (shape.mountedTrayPockets ?? []).map((pocket) => ({ diameter: pocket.diameter, x: pocket.x, z: pocket.z })),
  };
}

// The geometry module THROWS on an invalid layout. The render/export arms must
// never crash on a half-edited shape, so they fall back to the bare tray (no
// pockets), and then to the module's own defaults if even that is rejected;
// the inspector shows the message inline instead.
export function createMountedSocketTrayGeometryForShape(shape: WorkplaneShape) {
  const options = mountedSocketTrayOptionsForShape(shape);
  try {
    return createMountedSocketTrayGeometry(options);
  } catch {
    try {
      return createMountedSocketTrayGeometry({ ...options, pockets: [] });
    } catch {
      return createMountedSocketTrayGeometry({});
    }
  }
}

// Friendly inline message for the inspector: null when the layout is valid,
// otherwise the geometry module's rejection translated to 1-based pocket
// numbers and plain language.
export function mountedSocketTrayLayoutError(shape: WorkplaneShape): string | null {
  const options = mountedSocketTrayOptionsForShape(shape);
  try {
    mountedSocketTrayPositions(options);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const overlap = message.match(/pockets (\d+) and (\d+): footprints overlap/);
    if (overlap) return `Pockets ${Number(overlap[1]) + 1} and ${Number(overlap[2]) + 1} overlap or leave too thin a wall — keep at least ${SOCKET_TRAY_POCKET_GAP}mm between them.`;
    const edge = message.match(/pocket (\d+): footprint .* edge/);
    if (edge) return `Pocket ${Number(edge[1]) + 1} is too close to the tray edge (${SOCKET_TRAY_POCKET_EDGE_CLEARANCE}mm clearance is required).`;
    if (/minimum floor/.test(message)) return `Pocket Depth leaves less than the ${MIN_SOCKET_TRAY_FLOOR_THICKNESS}mm minimum floor — reduce Pocket Depth or increase Tray Thickness.`;
    if (/do not fit/.test(message)) return "Too many slots for this plate width — reduce Slot Count, reduce Slot Spacing, or widen the plate.";
    if (/tray thickness/.test(message)) return "Tray Thickness must be less than Plate Height.";
    const invalid = message.match(/pocket (\d+): diameter/);
    if (invalid) return `Pocket ${Number(invalid[1]) + 1} has invalid values.`;
    return message;
  }
}

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
  // Socket Tray: width/depth/thickness straight from the module's defaults;
  // thickness is the Y-up dimension, so it becomes shape.height.
  const socketTrayDefaults = asset.kind === "socketTray" ? socketTrayDimensions({}) : undefined;
  // Mounted Socket Tray: plate width/height straight from the module's
  // defaults; `depth` is the solid's full Z extent (tray projection + plate
  // thickness), so the selection frame matches the mesh.
  const mountedSocketTrayDefaults = asset.kind === "mountedSocketTray" ? mountedSocketTrayDimensions({}) : undefined;
  const size = asset.kind === "gear" ? 30 : roundProfile ? 22 : 20;
  const height = mountedSocketTrayDefaults ? mountedSocketTrayDefaults.height : openGridBoardDefaults ? openGridBoardDefaults.height : openConnectContainerDefaults ? openConnectContainerDefaults.height : openGridSnapDefaults ? openGridSnapDefaults.height : multiconnectDefaults ? multiconnectDefaults.height : socketTrayDefaults ? socketTrayDefaults.thickness : asset.kind === "gear" ? 6 : asset.kind === "text" ? 10 : asset.kind === "roundRoof" ? 10 : asset.kind === "halfSphere" ? 11 : flatProfile ? 5 : 20;
  const width = mountedSocketTrayDefaults ? mountedSocketTrayDefaults.width : openGridBoardDefaults ? openGridBoardDefaults.width : openConnectContainerDefaults ? openConnectContainerDefaults.width : openGridSnapDefaults ? openGridSnapDefaults.width : multiconnectDefaults ? multiconnectDefaults.width : socketTrayDefaults ? socketTrayDefaults.width : asset.kind === "text" ? 86 : size;
  const depth = mountedSocketTrayDefaults ? mountedSocketTrayDefaults.depth : openGridBoardDefaults ? openGridBoardDefaults.depth : openConnectContainerDefaults ? openConnectContainerDefaults.depth : openGridSnapDefaults ? openGridSnapDefaults.depth : multiconnectDefaults ? multiconnectDefaults.depth : socketTrayDefaults ? socketTrayDefaults.depth : asset.kind === "text" ? 28 : size;

  const shape: WorkplaneShape = {
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
    socketTrayPocketDepth: asset.kind === "socketTray" ? DEFAULT_SOCKET_TRAY_SHAPE_POCKET_DEPTH : undefined,
    socketTrayPockets: asset.kind === "socketTray" ? DEFAULT_SOCKET_TRAY_SHAPE_POCKETS.map((pocket) => ({ ...pocket })) : undefined,
    mountedTrayPlateThickness: asset.kind === "mountedSocketTray" ? DEFAULT_MOUNTED_SOCKET_TRAY_PLATE_THICKNESS : undefined,
    mountedTraySlotSpacing: asset.kind === "mountedSocketTray" ? DEFAULT_MOUNTED_SOCKET_TRAY_SLOT_SPACING : undefined,
    mountedTraySlotCount: asset.kind === "mountedSocketTray" ? DEFAULT_MOUNTED_SOCKET_TRAY_SLOT_COUNT : undefined,
    mountedTrayProjection: asset.kind === "mountedSocketTray" ? DEFAULT_MOUNTED_SOCKET_TRAY_DEPTH : undefined,
    mountedTrayThickness: asset.kind === "mountedSocketTray" ? DEFAULT_MOUNTED_SOCKET_TRAY_THICKNESS : undefined,
    mountedTrayPocketDepth: asset.kind === "mountedSocketTray" ? DEFAULT_MOUNTED_SOCKET_TRAY_POCKET_DEPTH : undefined,
    mountedTrayPockets: asset.kind === "mountedSocketTray" ? DEFAULT_MOUNTED_SOCKET_TRAY_SHAPE_POCKETS.map((pocket) => ({ ...pocket })) : undefined,
    locked: false,
    hidden: false,
  };
  // Parts-library entries: overlay the preset's fully-specified parameters
  // on the blank insert. The result is an ordinary shape -- every field
  // remains editable in the inspector afterward.
  const preset = asset.presetId ? multiconnectPresetById(asset.presetId) : undefined;
  return preset ? { ...shape, ...preset.shape } : shape;
}
