export type ShapeKind =
  | "box"
  | "cylinder"
  | "sphere"
  | "sketch"
  | "scribble"
  | "cone"
  | "pyramid"
  | "roof"
  | "text"
  | "roundRoof"
  | "halfSphere"
  | "torus"
  | "tube"
  | "gear"
  | "ring"
  | "wedge"
  | "polygon"
  | "icosahedron"
  | "mesh"
  | "openGridBoard"
  | "openConnectContainer"
  | "openGridSnap"
  | "multiconnectContainer"
  | "socketTray"
  | "mountedSocketTray";

export type ShapeAsset = {
  id: string;
  name: string;
  src: string;
  kind: ShapeKind;
  color: string;
  hole?: boolean;
  // Set on built-in parts-library entries: makeShapeFromAsset pre-fills the
  // inserted shape from the named preset (multiconnectPresets.ts). The
  // result is a normal parametric shape -- fully editable, nothing special
  // about it after insertion.
  presetId?: string;
};

export type ProjectAssetSourceFormat = "stl" | "obj" | "svg" | "step";

export type ProjectAsset = {
  id: string;
  name: string;
  mediaType: string;
  sourceFormat: ProjectAssetSourceFormat;
  bytes: Uint8Array;
  byteLength: number;
  sha256: string;
};

export type GridSize = "Off" | "0.1 mm" | "0.25 mm" | "0.5 mm" | "1.0 mm" | "2.0 mm" | "5.0 mm" | "Brick";
export type MeasurementAccuracy = 1 | 2 | 3;
export type HistoryRetentionLimit = "unlimited" | number;

export type WorkplaneWorkspaceSettings = {
  width: number;
  depth: number;
  sizePreset: string;
  gridBlockSize: number;
  gridBlockPreset: string;
  gridColor: string;
  background: string;
  showShadows: boolean;
  showGrid: boolean;
  cruiseShapes: boolean;
  zoomSpeed: number;
  units: string;
  scale: string;
  accuracy: MeasurementAccuracy;
  historyLimit: HistoryRetentionLimit;
};

export type AlignAxis = "x" | "y" | "z";
export type AlignTarget = "min" | "center" | "max";
export type AlignHandleStatus = {
  axis: AlignAxis;
  target: AlignTarget;
  disabled: boolean;
  aligned: boolean;
  title: string;
};

export type SketchPoint = {
  id: string;
  x: number;
  z: number;
  handleIn?: { x: number; z: number };
  handleOut?: { x: number; z: number };
  mode?: "corner" | "smooth" | "split";
};

export type SketchSegment = {
  id: string;
  startId: string;
  endId: string;
  kind?: "line" | "bezier" | "smooth";
};

export type SketchImage = {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  pixelWidth: number;
  pixelHeight: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  opacity?: number;
  lockAspect?: boolean;
};

export type SketchProfile = {
  points: SketchPoint[];
  segments: SketchSegment[];
  images?: SketchImage[];
};

export type SketchOperation = "extrude" | "revolve";

export type GearType = "spur" | "helical" | "bevel";

export type OpenGridBoardType = "full" | "lite" | "heavy";
export type OpenGridChamferMode = "everywhere" | "corners" | "none";
export type OpenGridScrewMounting = "none" | "corners" | "everywhere";

export type OpenConnectShapeType = "Bin" | "Shelf";
export type OpenConnectSlotLockDistribution = "All" | "Staggered" | "Corners" | "Top Corners" | "None";
export type OpenConnectSlotPosition = "All" | "Staggered" | "Edge Rows" | "Edge Columns" | "Corners";
export type OpenConnectCornerRounding = "None" | "Chamfer" | "Fillet";

// "Heavy" boardType is intentionally unsupported for the Snap (see
// openGridSnapGeometry.ts) -- the upstream generator has no matching
// snap_thickness and our own Heavy board has no real groove yet.
export type OpenGridSnapBodyShape = "Directional" | "Symmetric";

// Bin does not exist yet for the Multiconnect Container -- the geometry
// module only builds the (Peg)Plate so far; the enum grows when it does.
export type MulticonnectShapeType = "Plate" | "PegPlate";

// One peg row in the inspector's peg list. `x` is in AS-MOUNTED VIEW SPACE
// (from the plate's left edge as the mounted viewer sees it) -- the
// geometry module mirrors it internally; see the MOUNTED-VIEW X CONVENTION
// block in multiconnectContainerGeometry.ts. Length and row height are
// shared across pegs (multiconnectPegLength / multiconnectPegRowZ).
export type MulticonnectShapePeg = { diameter: number; x: number };

// One pocket row in the inspector's Socket Tray pocket list. `x`/`z` are the
// pocket center in the tray's own geometry space (x from the left edge, z
// from the front edge). The tray lies flat, so there is no as-mounted
// mirror -- see the world-frame note in socketTrayGeometry.ts. Pocket depth
// is shared across pockets (socketTrayPocketDepth), not per row.
export type SocketTrayShapePocket = { diameter: number; x: number; z: number };

// One pocket row in the inspector's Mounted Socket Tray pocket list. Same
// meaning as SocketTrayShapePocket: `x` from the tray's LEFT edge, `z` from
// its FRONT edge, both in geometry space. Pockets open upward on a horizontal
// shelf, so there is no as-mounted mirror -- see the frame note in
// mountedSocketTrayGeometry.ts. Depth is shared across pockets
// (mountedTrayPocketDepth), not per row.
export type MountedSocketTrayShapePocket = { diameter: number; x: number; z: number };

export type SketchRevolveSettings = {
  startAngle: number;
  sweepAngle: number;
  sides: number;
  quality: number;
  thickness: number;
};

export type EdgeTreatmentFeature = {
  kind: "fillet" | "chamfer";
  amount: number;
  edgeCount: number;
  chamferAngle?: number;
};

export type EdgeTreatmentHistoryEntry = {
  id: string;
  createdAt: number;
  feature: EdgeTreatmentFeature;
  before: WorkplaneShape;
  appliedFrame?: {
    x: number;
    z: number;
    elevation: number;
    width: number;
    depth: number;
    height: number;
    rotation: number;
    rotationX: number;
    rotationZ: number;
    mirrorX: boolean;
    mirrorY: boolean;
    mirrorZ: boolean;
  };
};

export type CadDisplayEdge = {
  points: number[];
};

export type CadBrepFrame = {
  x: number;
  z: number;
  elevation: number;
  width: number;
  depth: number;
  height: number;
  sourceTransform?: number[];
};

export type CadPrimitiveFrame = {
  kind: "box";
  width: number;
  depth: number;
  height: number;
  frame: CadBrepFrame;
};

export type WorkplaneShape = {
  id: string;
  name: string;
  kind: ShapeKind;
  color: string;
  hole?: boolean;
  x: number;
  z: number;
  elevation?: number;
  size: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  rotationX?: number;
  rotationZ?: number;
  mirrorX?: boolean;
  mirrorY?: boolean;
  mirrorZ?: boolean;
  radius?: number;
  steps?: number;
  sides?: number;
  bevel?: number;
  segments?: number;
  topRadius?: number;
  baseRadius?: number;
  teeth?: number;
  toothSize?: number;
  toothWidth?: number;
  centerHoleSize?: number;
  gearType?: GearType;
  helixAngle?: number;
  helixQuality?: number;
  gridWidth?: number;
  gridHeight?: number;
  boardType?: OpenGridBoardType;
  chamferMode?: OpenGridChamferMode;
  connectorHoles?: boolean;
  screwMounting?: OpenGridScrewMounting;
  containerShapeType?: OpenConnectShapeType;
  internalWidth?: number;
  internalHeight?: number;
  internalDepth?: number;
  wallThickness?: number;
  baseThickness?: number;
  leftWallEnabled?: boolean;
  rightWallEnabled?: boolean;
  frontWallEnabled?: boolean;
  bottomWallEnabled?: boolean;
  slotLockDistribution?: OpenConnectSlotLockDistribution;
  slotPosition?: OpenConnectSlotPosition;
  cornerRounding?: OpenConnectCornerRounding;
  snapBodyShape?: OpenGridSnapBodyShape;
  // Multiconnect Container (kind "multiconnectContainer"). Plate width /
  // height / thickness live directly in width / height / depth; these hold
  // the rest of the geometry parameters.
  multiconnectShapeType?: MulticonnectShapeType;
  multiconnectSlotSpacing?: number;
  multiconnectSlotQuickRelease?: boolean;
  multiconnectSlotTolerance?: number;
  multiconnectCornerRadius?: number;
  multiconnectPegLength?: number;
  multiconnectPegFillet?: number;
  multiconnectPegTilt?: number;
  multiconnectPegRowZ?: number;
  multiconnectPegs?: MulticonnectShapePeg[];
  // Socket Tray (kind "socketTray"). Tray width / depth / thickness live in
  // width / depth / height (thickness is the Y-up dimension); these hold the
  // shared pocket depth and the pocket list.
  socketTrayPocketDepth?: number;
  socketTrayPockets?: SocketTrayShapePocket[];
  // Owner-typed fillet radius, applied to the tray's outer top perimeter and
  // every pocket rim. 0 (default) = sharp.
  socketTrayCornerRadius?: number;
  // Mounted Socket Tray (kind "mountedSocketTray"). Plate width / plate height
  // live in width / height (height is the Y-up dimension); depth holds the
  // solid's full Z extent, i.e. tray projection + plate thickness, so the
  // selection frame matches the mesh. Everything else is dedicated.
  mountedTrayPlateThickness?: number;
  mountedTraySlotSpacing?: number;
  mountedTraySlotCount?: number;
  mountedTrayProjection?: number;
  mountedTrayThickness?: number;
  mountedTrayPocketDepth?: number;
  mountedTrayPockets?: MountedSocketTrayShapePocket[];
  // Owner-typed fillet radius, applied to the plate's own top edge, the
  // tray's own top edge, and every pocket rim. 0 (default) = sharp. Never
  // applied to the L-junction.
  mountedTrayCornerRadius?: number;
  text?: string;
  font?: string;
  importedMesh?: {
    positions: number[];
    normals?: number[];
    baseWidth: number;
    baseDepth: number;
    baseHeight: number;
    triangleCount: number;
    sourceFormat: "stl" | "obj" | "svg" | "json" | "step";
    // IndexedDB persistence uses this only in compact stored shape records.
    // Runtime editor shapes are hydrated with the full immutable mesh resource.
    storageResourceId?: string;
    // Stable reference to the original imported file in the project's shared
    // asset table. Copies and grouped operands reuse this reference.
    assetId?: string;
    // Exact OpenCascade B-Rep of the body (single-shape STEP text) in the same
    // local frame as `positions`. Set only for STEP imports; lets the exporter
    // re-emit the original analytic geometry instead of the tessellation.
    brepStep?: string;
  };
  imagePlate?: {
    dataUrl: string;
    mimeType: string;
    pixelWidth: number;
    pixelHeight: number;
  };
  sketchProfile?: SketchProfile;
  sketchOperation?: SketchOperation;
  sketchRevolve?: SketchRevolveSettings;
  edgeTreatments?: EdgeTreatmentFeature[];
  edgeTreatmentHistory?: EdgeTreatmentHistoryEntry[];
  cadDisplayEdges?: CadDisplayEdge[];
  cadDisplayEdgesVersion?: 2;
  edgeResizeMode?: "scale" | "preserve";
  cadBrep?: string;
  cadBrepFrame?: CadBrepFrame;
  cadPrimitiveFrame?: CadPrimitiveFrame;
  groupedShapes?: WorkplaneShape[];
  groupedBaseWidth?: number;
  groupedBaseDepth?: number;
  groupedBaseHeight?: number;
  groupOperation?: "group" | "intersection";
  locked?: boolean;
  hidden?: boolean;
};
