import * as THREE from "three";
import type { OpenGridBoardType, OpenGridChamferMode, OpenGridScrewMounting, WorkplaneShape } from "@/types/sketchforge";

// Reference: AndyLevesque/QuackWorks openGrid/openGrid.scad (openGrid ecosystem
// spec by DavidD / BlackjackDuck). Board dimensions + screw holes are not
// ported yet (later phase) -- this covers the base plate and the per-tile
// perimeter capture groove.
export const OPENGRID_TILE_SIZE = 28;
export const OPENGRID_THICKNESS: Record<OpenGridBoardType, number> = {
  full: 6.8,
  lite: 4,
  heavy: 13.8,
};

// Corner-chamfer inset, matching openGrid's Intersection_Distance constant.
// The reference clip tool is a square of side sqrt(4.2^2 * 2) rotated 45deg
// and centered on each grid point; its diagonal vertices land exactly
// Intersection_Distance from the center along each axis, so every cut
// reduces to a straight inset of 4.2mm along the board edges.
const CHAMFER_INSET = 4.2;

export const DEFAULT_OPENGRID_GRID_WIDTH = 4;
export const DEFAULT_OPENGRID_GRID_HEIGHT = 4;
export const DEFAULT_OPENGRID_BOARD_TYPE: OpenGridBoardType = "full";
export const DEFAULT_OPENGRID_CHAMFER_MODE: OpenGridChamferMode = "corners";
export const DEFAULT_OPENGRID_CONNECTOR_HOLES = false;
export const DEFAULT_OPENGRID_SCREW_MOUNTING: OpenGridScrewMounting = "none";
export const MIN_OPENGRID_GRID_UNITS = 1;
export const MAX_OPENGRID_GRID_UNITS = 20;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeOpenGridUnits(value: number | undefined, fallback: number): number {
  return clamp(Math.round(Number.isFinite(value) ? (value as number) : fallback), MIN_OPENGRID_GRID_UNITS, MAX_OPENGRID_GRID_UNITS);
}

export function normalizeOpenGridBoardType(value?: string): OpenGridBoardType {
  return value === "lite" || value === "heavy" ? value : DEFAULT_OPENGRID_BOARD_TYPE;
}

export function normalizeOpenGridChamferMode(value?: string): OpenGridChamferMode {
  return value === "everywhere" || value === "none" ? value : DEFAULT_OPENGRID_CHAMFER_MODE;
}

export function normalizeOpenGridConnectorHoles(value: boolean | undefined): boolean {
  return value === true;
}

export function normalizeOpenGridScrewMounting(value?: string): OpenGridScrewMounting {
  return value === "corners" || value === "everywhere" ? value : DEFAULT_OPENGRID_SCREW_MOUNTING;
}

export function openGridBoardThickness(boardType?: string): number {
  return OPENGRID_THICKNESS[normalizeOpenGridBoardType(boardType)];
}

// Derives the shape's overall width/depth/height from grid units + board
// type. Callers keep these mirrored onto the shape record so the rest of the
// app's generic bounding-box machinery (selection, gizmos, mesh/STEP export)
// keeps working unchanged -- the board's footprint is not freely resizable,
// only in whole tile increments.
export function openGridBoardDimensions(gridWidth?: number, gridHeight?: number, boardType?: string) {
  return {
    width: normalizeOpenGridUnits(gridWidth, DEFAULT_OPENGRID_GRID_WIDTH) * OPENGRID_TILE_SIZE,
    depth: normalizeOpenGridUnits(gridHeight, DEFAULT_OPENGRID_GRID_HEIGHT) * OPENGRID_TILE_SIZE,
    height: openGridBoardThickness(boardType),
  };
}

export function openGridBoardSettings(shape: Pick<WorkplaneShape, "gridWidth" | "gridHeight" | "boardType" | "chamferMode" | "connectorHoles" | "screwMounting">) {
  return {
    gridWidth: normalizeOpenGridUnits(shape.gridWidth, DEFAULT_OPENGRID_GRID_WIDTH),
    gridHeight: normalizeOpenGridUnits(shape.gridHeight, DEFAULT_OPENGRID_GRID_HEIGHT),
    boardType: normalizeOpenGridBoardType(shape.boardType),
    chamferMode: normalizeOpenGridChamferMode(shape.chamferMode),
    connectorHoles: normalizeOpenGridConnectorHoles(shape.connectorHoles),
    screwMounting: normalizeOpenGridScrewMounting(shape.screwMounting),
  };
}

type Point = [number, number];

const RECT_EDGE_DIRS: Point[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// Clip a rectangle's 4 corners with a straight 45deg cut, inset by
// `cornerInset(i)` along both adjacent edges at corner i. `corners` and
// `edgeDirs` must both be in BL, BR, TR, TL winding order. Used for the
// per-tile hole corners (see tileHoleOutline) and, via
// boardOuterOutlineWithFeatures, the board's own outer corners.
function clipRectangleCorners(corners: Point[], edgeDirs: Point[], cornerInset: (index: number) => number): Point[] {
  const outline: Point[] = [];
  for (let i = 0; i < 4; i += 1) {
    const inset = cornerInset(i);
    const corner = corners[i];
    const incomingDir = edgeDirs[(i + 3) % 4];
    const outgoingDir = edgeDirs[i];
    if (inset <= 0) {
      outline.push(corner);
      continue;
    }
    outline.push([corner[0] - incomingDir[0] * inset, corner[1] - incomingDir[1] * inset]);
    outline.push([corner[0] + outgoingDir[0] * inset, corner[1] + outgoingDir[1] * inset]);
  }
  return outline;
}

// The board's plain, sharp-cornered outer boundary. See
// boardOuterOutlineWithFeatures for the chamfered and/or connector-notched
// variants actually used per-band once either feature is enabled.
function boardOuterOutline(gridWidthUnits: number, gridHeightUnits: number): Point[] {
  const halfW = (gridWidthUnits * OPENGRID_TILE_SIZE) / 2;
  const halfD = (gridHeightUnits * OPENGRID_TILE_SIZE) / 2;
  return [[-halfW, -halfD], [halfW, -halfD], [halfW, halfD], [-halfW, halfD]];
}

// One tile's hole for a given groove band: a square centered on the tile,
// inset from each edge by the band's `inset` uniformly at all 4 corners --
// no special-casing at interior grid vertices. An earlier pass added a
// closure override there (forcing a much larger inset near 4-way
// intersections, meant to plug the channel), based on an empirical
// measurement from rendering the SCAD source that didn't hold up: ray-
// casting a real reference STL (10x10_Grid.stl) shows the real design is
// if anything MORE open right at an interior vertex, not solid-closed --
// full-height hollow within ~2-3mm of the vertex, settling into the normal
// per-band profile by ~4mm out. The override's 6.5mm reach (vs. a 28mm tile
// pitch and a max profile inset of 1.5mm) was pulling every tile corner
// adjacent to an interior vertex in hard from all 4 directions at once,
// which is what produced the 4-pointed star/diamond bug: the hole pinched
// toward every vertex it touched instead of staying a plain shrunk square.
//
// Each of the square's 4 corners is then further clipped diagonally by a
// per-band chamfer size (see cornerWedgeChamferAt below), the same style of
// cut used on the outer board corners (clipRectangleCorners's diagonal-
// inset-at-each-corner technique), giving an octagon rather than a
// sharp-cornered square. This is a genuinely separate step from the
// uniform inset above, not a repeat of the old closure bug: the uniform
// inset already gives a correctly-shrunk square with real solid material
// on every edge, and the chamfer only nibbles a diagonal off each of its 4
// corners -- it can't balloon into a star because it's bounded by the
// octagon's own corner, not by how close that corner happens to sit to a
// shared grid vertex.
//
// Critically, this chamfer is applied IDENTICALLY to all 4 corners of
// EVERY tile, with no branching on how many neighbors that corner has
// (see cornerWedgeChamferAt's own header comment for why). Where 4 tiles'
// corners meet at an interior grid vertex, their 4 independently-clipped
// holes simply sit side by side -- ordinary geometric abutment, not a
// special union/closure feature -- and whatever combined gap or solid
// pattern appears there falls out of that abutment on its own.
// `chamferFromTileCorner` is measured from the tile's own true outer
// corner (matching cornerWedgeChamferAt / the SCAD wedge's own 3D
// placement, both anchored on that corner), but clipRectangleCorners clips
// relative to the already wall-inset square's OWN corner -- which sits
// `inset` further in along BOTH adjacent edges, i.e. `2 * inset` closer in
// leg-sum terms -- so it has to be translated into a clip distance
// relative to that corner before use. Skipping this translation was an
// earlier bug here: it left the corner cut reaching further into the tile
// than intended at every band (worst at the waist, where inset is
// smallest relative to the chamfer, so least masked by clamping).
function tileHoleOutline(tileX: number, tileZ: number, gridWidthUnits: number, gridHeightUnits: number, inset: number, chamferFromTileCorner: number): Point[] {
  const halfW = (gridWidthUnits * OPENGRID_TILE_SIZE) / 2;
  const halfD = (gridHeightUnits * OPENGRID_TILE_SIZE) / 2;
  const half = OPENGRID_TILE_SIZE / 2;
  const cx = -halfW + (tileX + 0.5) * OPENGRID_TILE_SIZE;
  const cz = -halfD + (tileZ + 0.5) * OPENGRID_TILE_SIZE;
  const r = Math.min(inset, half - 0.01);
  const squareHalf = half - r;
  const corners: Point[] = [[cx - squareHalf, cz - squareHalf], [cx + squareHalf, cz - squareHalf], [cx + squareHalf, cz + squareHalf], [cx - squareHalf, cz + squareHalf]];
  const chamferFromSquareCorner = Math.max(0, chamferFromTileCorner - 2 * r);
  const clampedChamfer = Math.min(chamferFromSquareCorner, squareHalf - 0.01);
  return clipRectangleCorners(corners, RECT_EDGE_DIRS, () => clampedChamfer);
}

function bandTileHoles(gridWidthUnits: number, gridHeightUnits: number, inset: number, chamfer: number): Point[][] {
  const holes: Point[][] = [];
  if (inset > 0) {
    for (let tileX = 0; tileX < gridWidthUnits; tileX += 1) {
      for (let tileZ = 0; tileZ < gridHeightUnits; tileZ += 1) {
        holes.push(tileHoleOutline(tileX, tileZ, gridWidthUnits, gridHeightUnits, inset, chamfer));
      }
    }
  }
  return holes;
}

function tracePath(path: THREE.Path, points: Point[]) {
  path.moveTo(points[0][0], -points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    path.lineTo(points[i][0], -points[i][1]);
  }
  path.closePath();
}

// One Z-height band of the capture-groove cross-section: a constant inset
// (and a constant per-tile-hole corner chamfer) held over [zStart, zEnd]
// (from the board's underside). The real profile's diagonal transitions are
// approximated as a stack of thin constant-inset bands (see
// fullProfileBands) rather than a true lofted taper, so this stays "the
// same 2D-shape-with-holes extrusion technique" repeated per band instead
// of needing a separate lofting code path.
type GrooveBand = { zStart: number; zEnd: number; inset: number; chamfer: number };

function pushTaperBands(
  bands: GrooveBand[],
  zStart: number,
  zEnd: number,
  insetStart: number,
  insetEnd: number,
  steps: number,
) {
  const stepHeight = (zEnd - zStart) / steps;
  for (let i = 0; i < steps; i += 1) {
    const midpoint = (i + 0.5) / steps;
    const zMid = zStart + (i + 0.5) * stepHeight;
    bands.push({
      zStart: zStart + i * stepHeight,
      zEnd: zStart + (i + 1) * stepHeight,
      inset: insetStart + (insetEnd - insetStart) * midpoint,
      chamfer: cornerWedgeChamferAt(zMid),
    });
  }
}

// Fine subdivision for the two functional lip<->waist transitions (these
// gate where a connector clip's prong is captured vs. free to slide, so
// they need to land close to the analytic crossover height). Coarse
// subdivision for the two cosmetic flush-in chamfers at the very top/bottom
// face, which don't affect capture behavior. Coarse subdivision again for
// the two lip plateaus' own corner chamfer, which varies linearly across
// them (unlike the wall inset, which is genuinely flat there) but doesn't
// need 16 steps to approximate a straight line -- each extra band costs a
// full earcut+extrude per hole and a share of the CSG corner-chamfer pass,
// so this was previously a real (5-7s) performance regression on
// chamferMode "corners"/"everywhere" boards from tripling total band count
// for no accuracy gain.
const LIP_TAPER_STEPS = 16;
const LEAD_IN_TAPER_STEPS = 4;
// Odd, not 4, so the lip plateau's own midpoint (z=0.9 / z=5.9 -- the
// documented reference measurement heights) lands exactly on one sub-band's
// own midpoint instead of straddling a band boundary.
const CHAMFER_ONLY_TAPER_STEPS = 5;

// Wall cross-section profile from prior recon (AndyLevesque/QuackWorks
// openGrid.scad's openGridTileAp1, Full_or_Lite != "Heavy" branch), as
// (height from underside, inset from tile edge) breakpoints for a 6.8mm
// tile:
//   z=0.0 inset 0    z=0.0 inset 1.1   z=0.4 inset 1.5   z=1.4 inset 1.5
//   z=2.4 inset 0.8  z=4.4 inset 0.8   z=5.4 inset 1.5   z=6.4 inset 1.5
//   z=6.8 inset 1.1  z=6.8 inset 0
// The two zero-height "flush at z=0/z=6.8" points are folded into their
// adjacent taper (0->1.5 over [0,0.4], 1.5->0 over [6.4,6.8]) rather than
// modeled as a separate degenerate band.
//
// Corner chamfer: derived directly from openGrid.scad's own
// full_tile_corners_profile + its 3D placement transform (move to the
// tile's own corner -> rotate 45deg about Z -> translate back(cornerOffset)
// -> rotate 90deg about X -> linear_extrude), NOT from a rendered-and-
// measured lookup table. Earlier rounds all measured chamfer directly off
// rendered STLs and kept disagreeing with each other -- every one of those
// renders turned out to be confounded by something else in the SCAD's
// default parameters that also touches the corners (Screw_Mounting or
// Chamfers="Corners" cutting into a board-extreme corner tile, a T-junction
// or interior-vertex tile abutting and partially overlapping the measured
// one, or a rasterizing instrument clipped by a neighboring feature) -- see
// git history for the full trail. Re-deriving the wedge's placement
// transform analytically and cross-checking it against a *clean* rendered
// single tile (Chamfers=None, Screw_Mounting=None, Connector_Holes=false,
// so nothing else is touching that corner) confirmed the formula below
// exactly: solid from the tile's own corner point out to the returned
// distance along both adjacent edges, verified both on- and off-diagonal at
// all 3 z-plateaus.
//
// Working through the transform: with u = the profile's own first axis
// (0..cornerOffset, "how far the wedge reaches along the corner's 45deg
// bisector") and v = its second axis (0..Tile_Thickness, height, which the
// transform carries straight through to world Z with no tilt), world
// (X+Y) relative to the tile's corner comes out to exactly u*sqrt(2),
// independent of position along the tile edge -- i.e. at a given Z the
// wedge's reach is a single straight 45deg cut, exactly like the outer
// board's own corner chamfer, just with a height-varying distance instead
// of a constant one. u's own max at a given v is the profile boundary
// itself: flat at `cornerOffset` through the profile's middle plateau
// [cornerProfileChamfer, Tile_Thickness - cornerProfileChamfer], tapering
// linearly down to `cornerOffset - cornerProfileChamfer` at both v=0 and
// v=Tile_Thickness.
const CORNER_INTERSECTION_DISTANCE = 4.2; // openGrid.scad Intersection_Distance
const CORNER_TOP_CAPTURE_INITIAL_INSET = 2.4; // openGrid.scad Top_Capture_Initial_Inset
const CORNER_INSIDE_GRID_MIDDLE_CHAMFER = 1; // openGrid.scad Inside_Grid_Middle_Chamfer
const CORNER_SQUARE_THICKNESS = 2.6; // openGrid.scad Corner_Square_Thickness
const CORNER_PROFILE_CHAMFER = CORNER_TOP_CAPTURE_INITIAL_INSET - CORNER_INSIDE_GRID_MIDDLE_CHAMFER; // 1.4
const CORNER_OFFSET = Math.sqrt((CORNER_INTERSECTION_DISTANCE * CORNER_INTERSECTION_DISTANCE) / 2) + CORNER_SQUARE_THICKNESS; // 5.56985

function cornerWedgeChamferAt(z: number, tileThickness: number = OPENGRID_THICKNESS.full): number {
  let uMax: number;
  if (z <= CORNER_PROFILE_CHAMFER) {
    uMax = CORNER_OFFSET - CORNER_PROFILE_CHAMFER + z;
  } else if (z <= tileThickness - CORNER_PROFILE_CHAMFER) {
    uMax = CORNER_OFFSET;
  } else {
    uMax = CORNER_OFFSET - (z - (tileThickness - CORNER_PROFILE_CHAMFER));
  }
  return Math.max(0, uMax) * Math.SQRT2;
}

function fullProfileBands(): GrooveBand[] {
  const bands: GrooveBand[] = [];
  pushTaperBands(bands, 0, 0.4, 0, 1.5, LEAD_IN_TAPER_STEPS);
  pushTaperBands(bands, 0.4, 1.4, 1.5, 1.5, CHAMFER_ONLY_TAPER_STEPS);
  pushTaperBands(bands, 1.4, 2.4, 1.5, 0.8, LIP_TAPER_STEPS);
  bands.push({ zStart: 2.4, zEnd: 4.4, inset: 0.8, chamfer: cornerWedgeChamferAt(3.4) });
  pushTaperBands(bands, 4.4, 5.4, 0.8, 1.5, LIP_TAPER_STEPS);
  pushTaperBands(bands, 5.4, 6.4, 1.5, 1.5, CHAMFER_ONLY_TAPER_STEPS);
  pushTaperBands(bands, 6.4, 6.8, 1.5, 0, LEAD_IN_TAPER_STEPS);
  return bands;
}

// Lite reuses the Full profile and keeps only the top half (z from 2.8 to
// 6.8, matching openGridLite's top_half(z = Tile_Thickness - Lite_Tile_
// Thickness) clip) instead of deriving a separate profile, then shifts the
// result down so it spans [0, 4] like every other board type's geometry.
function liteProfileBands(): GrooveBand[] {
  const cut = OPENGRID_THICKNESS.full - OPENGRID_THICKNESS.lite;
  return fullProfileBands()
    .filter((band) => band.zEnd > cut)
    .map((band) => ({ zStart: Math.max(band.zStart, cut) - cut, zEnd: band.zEnd - cut, inset: band.inset, chamfer: band.chamfer }));
}

function extrudeBandGeometry(outerOutline: Point[], holes: Point[][], height: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  tracePath(shape, outerOutline);
  holes.forEach((hole) => {
    const path = new THREE.Path();
    tracePath(path, hole);
    shape.holes.push(path);
  });
  // Shape's local (x, y) maps to world (x, -z); rotateX(-90deg) below then
  // sends the extrusion depth (0..height) to world Y and the footprint to
  // world X/Z, matching the rest of the primitive family's convention.
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1, curveSegments: 1 });
  geometry.rotateX(-Math.PI / 2);
  return geometry.toNonIndexed();
}

function mergeBandGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  geometries.forEach((geometry) => {
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i += 1) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
    }
    geometry.dispose();
  });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return merged;
}

// Two adjacent bands whose outer boundary happens to be identical there
// (the corner chamfer and the connector notch are both Z-invariant, unlike
// inset/chamfer, which is why the wall profile needs many separate bands in
// the first place) each independently cap themselves at their shared Z
// plane -- both caps are valid on their own, but the plain-concatenation
// merge leaves that whole shared boundary as an internal double layer: two
// exactly-coincident, opposite-facing triangles occupying the same space,
// which is non-manifold by the strict definition slicers use (an edge
// shared by 4 faces instead of 2) even though there's no actual gap. A
// matched pair like that contributes nothing to the solid's exterior --
// removing both is exactly what a proper boolean union would have done.
// Only touches EXACT matches (same 3 vertex positions, opposite winding);
// anything else (including genuine non-manifold edges elsewhere, e.g. the
// pre-existing corner-wedge taper coincidences) is left alone rather than
// risk misidentifying real geometry.
export function weldCoincidentDoubleFaces(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  const triCount = Math.floor(position.count / 3);
  const quantize = (v: number) => Math.round(v * 1e5) / 1e5;
  const vertexKey = (i: number) => `${quantize(position.getX(i))},${quantize(position.getY(i))},${quantize(position.getZ(i))}`;

  const groups = new Map<string, number[]>();
  for (let t = 0; t < triCount; t += 1) {
    const base = t * 3;
    const keys = [vertexKey(base), vertexKey(base + 1), vertexKey(base + 2)].sort();
    const key = keys.join("|");
    const bucket = groups.get(key);
    if (bucket) bucket.push(base);
    else groups.set(key, [base]);
  }

  const normal = (base: number) => {
    const ax = position.getX(base), ay = position.getY(base), az = position.getZ(base);
    const bx = position.getX(base + 1), by = position.getY(base + 1), bz = position.getZ(base + 1);
    const cx = position.getX(base + 2), cy = position.getY(base + 2), cz = position.getZ(base + 2);
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  };

  const removed = new Set<number>();
  for (const bucket of groups.values()) {
    if (bucket.length !== 2) continue; // ambiguous (1 = unique, 3+ = not a simple coincident pair) -- leave alone
    const [n0, n1] = [normal(bucket[0]), normal(bucket[1])];
    const dot = n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2];
    if (dot < 0) {
      removed.add(bucket[0]);
      removed.add(bucket[1]);
    }
  }
  if (removed.size === 0) return geometry;

  const positions: number[] = [];
  for (let t = 0; t < triCount; t += 1) {
    const base = t * 3;
    if (removed.has(base)) continue;
    for (let k = 0; k < 3; k += 1) positions.push(position.getX(base + k), position.getY(base + k), position.getZ(base + k));
  }
  geometry.dispose();
  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return result;
}

// Ensures a closed outline winds the same way as this file's own
// boardOuterOutline/tileHoleOutline convention (CCW in (x, z)) regardless of
// the winding a point list happened to be authored/extracted in, since
// extrudeBandGeometry's normal direction depends on it.
function ensureCcw(points: Point[]): Point[] {
  let signedArea = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[(i + 1) % points.length];
    signedArea += x0 * z1 - x1 * z0;
  }
  return signedArea < 0 ? [...points].reverse() : points;
}

// ===== Connector_Holes =====
//
// openGrid.scad's connector_cutout_delete_tool (see openGrid module, lines
// ~344-383): a hull of two capsule circles with two "dogbone" relief notches
// cut into it plus a small insertion flare, then clipped to half (half_of)
// so only the usable cut profile remains -- a 2.4mm-tall constant-cross-
// section prism (Connector_Holes' connector_cutout_height). Reproducing the
// hull/diff/half_of chain by hand risks a subtle mismatch, so this outline
// was extracted verbatim by rendering that exact module body (copied
// unmodified into a standalone wrapper .scad) through openscad-wasm+BOSL2 and
// exact-vector-slicing the resulting prism at mid-height -- not hand-derived.
// u = depth into the board from the cut edge (0 at the edge, growing inward);
// v = position along the edge, symmetric about 0 (confirmed by the extracted
// points themselves: every (u, v) has a matching (u, -v)).
const CONNECTOR_SLOT_LOCAL_OUTLINE: Point[] = [
  [0.0119, -2.5778], [0.019, -2.5543], [0.0306, -2.5327], [0.0421, -2.5111], [0.0577, -2.4922],
  [0.0732, -2.4732], [0.0922, -2.4577], [0.1111, -2.4421], [0.1327, -2.4306], [0.1543, -2.419],
  [0.1725, -2.4135], [0.1907, -2.408], [0.3483, -2.4279], [0.5059, -2.4478], [0.6701, -2.49],
  [0.8343, -2.5321], [0.9136, -2.5635], [0.9928, -2.5949], [1.828, -2.5949], [2.6633, -2.5949],
  [2.8252, -2.5744], [2.9872, -2.5539], [3.1453, -2.5133], [3.3034, -2.4727], [3.4552, -2.4126],
  [3.607, -2.3525], [3.7501, -2.2739], [3.8931, -2.1953], [4.0252, -2.0993], [4.1573, -2.0033],
  [4.2763, -1.8916], [4.3953, -1.7798], [4.4994, -1.654], [4.6034, -1.5282], [4.6909, -1.3904],
  [4.7784, -1.2526], [4.8479, -1.1048], [4.9174, -0.9571], [4.9679, -0.8019], [5.0183, -0.6466],
  [5.0489, -0.4862], [5.0795, -0.3259], [5.0897, -0.1629], [5.1, 0], [5.0897, 0.1629],
  [5.0795, 0.3259], [5.0489, 0.4862], [5.0183, 0.6466], [4.9679, 0.8019], [4.9174, 0.9571],
  [4.8479, 1.1048], [4.7784, 1.2526], [4.6909, 1.3904], [4.6034, 1.5282], [4.4994, 1.654],
  [4.3953, 1.7798], [4.2763, 1.8916], [4.1573, 2.0033], [4.0252, 2.0993], [3.8931, 2.1953],
  [3.7501, 2.2739], [3.607, 2.3525], [3.4552, 2.4126], [3.3034, 2.4727], [3.1453, 2.5133],
  [2.9872, 2.5539], [2.8252, 2.5744], [2.6633, 2.5949], [1.828, 2.5949], [0.9928, 2.5949],
  [0.9136, 2.5635], [0.8343, 2.5321], [0.6701, 2.49], [0.5059, 2.4478], [0.3483, 2.4279],
  [0.1907, 2.408], [0.1725, 2.4135], [0.1543, 2.419], [0.1327, 2.4306], [0.1111, 2.4421],
  [0.0922, 2.4577], [0.0732, 2.4732], [0.0577, 2.4922], [0.0421, 2.5111], [0.0306, 2.5327],
  [0.019, 2.5543], [0.0119, 2.5778], [0.0048, 2.6012], [0.0024, 2.6256], [0, 2.65],
  [0, 0], [0, -2.65], [0.0024, -2.6256], [0.0048, -2.6012],
];
const CONNECTOR_SLOT_HEIGHT = 2.4; // openGrid.scad connector_cutout_height
// openGrid.scad's own left(-tileSize*Board_Width/2-0.005) etc offsets the
// cutter 0.005mm PAST the true edge -- safe there because it's subtracted via
// a real 3D boolean (CGAL Nef polyhedra), which tolerates a cutter extending
// past the target with no effect. Baking the same offset into an earcut
// boundary is NOT safe: it left the slot's mouth outside the board's own
// outer contour, an invalid (self-intersecting-with-the-boundary) input that
// earcut/ExtrudeGeometry triangulated into garbage -- open and non-manifold
// edges at every affected band, confirmed via trimesh watertight checks that
// exactly matched a slicer's "not watertight" report on an exported STL. The
// splice below shares exact vertices with the outer boundary instead, so no
// clearance is needed (or wanted) here.
const CONNECTOR_EDGE_OFFSET = 0;

// Number of interior tile seams along one edge of `units` tiles -- both of
// openGrid.scad's Board_Height>2 / ==2 ycopies(spacing,l=...) branches reduce
// to this same count (verified algebraically), spaced at the tile pitch and
// centered on the edge.
function connectorSlotPositionsAlongEdge(units: number): number[] {
  const count = Math.max(0, units - 1);
  const positions: number[] = [];
  for (let i = 0; i < count; i += 1) positions.push((i - (count - 1) / 2) * OPENGRID_TILE_SIZE);
  return positions;
}

type BoardEdge = "left" | "right" | "top" | "bottom";
const CONNECTOR_EDGES: BoardEdge[] = ["left", "right", "top", "bottom"];

// Per-edge origin (the board's true edge, offset out by CONNECTOR_EDGE_OFFSET
// same as the source) and the (inward, along) unit basis the local (u, v)
// outline is transformed through -- derived from openGrid.scad's own
// left()/right()/fwd()/back() + zrot(180/-90/90) placement for each edge
// (Connector_Holes_Right/Left/Top/Bottom respectively).
function connectorSlotsForEdge(edge: BoardEdge, gridWidthUnits: number, gridHeightUnits: number) {
  const halfW = (gridWidthUnits * OPENGRID_TILE_SIZE) / 2;
  const halfD = (gridHeightUnits * OPENGRID_TILE_SIZE) / 2;
  const isVertical = edge === "left" || edge === "right";
  const gated = isVertical ? gridHeightUnits > 1 : gridWidthUnits > 1;
  if (!gated) return [];
  const positions = connectorSlotPositionsAlongEdge(isVertical ? gridHeightUnits : gridWidthUnits);
  const edgeCoord =
    edge === "right" ? halfW + CONNECTOR_EDGE_OFFSET
    : edge === "left" ? -halfW - CONNECTOR_EDGE_OFFSET
    : edge === "top" ? halfD + CONNECTOR_EDGE_OFFSET
    : -halfD - CONNECTOR_EDGE_OFFSET;
  const inward: Point =
    edge === "right" ? [-1, 0] : edge === "left" ? [1, 0] : edge === "top" ? [0, -1] : [0, 1];
  // A true rotation (det +1, matching the source's zrot(180/-90/90)), not a
  // mirror -- right/bottom need "along" flipped too, not just "inward",
  // else the transform reflects the outline instead of rotating it.
  const along: Point =
    edge === "right" ? [0, -1] : edge === "left" ? [0, 1] : edge === "top" ? [1, 0] : [-1, 0];
  return positions.map((along_offset): { origin: Point; inward: Point; along: Point } => ({
    origin: isVertical ? [edgeCoord, along_offset] : [along_offset, edgeCoord],
    inward,
    along,
  }));
}

function transformLocalOutline(local: Point[], origin: Point, inward: Point, along: Point): Point[] {
  return local.map(([u, v]): Point => [
    origin[0] + u * inward[0] + v * along[0],
    origin[1] + u * inward[1] + v * along[1],
  ]);
}

// A connector slot is open to the board's true outer edge (that's the whole
// point -- a connector clip has to slide in from outside) so, unlike every
// other hole in the board, it is NOT a closed loop strictly interior to the
// outer boundary. earcut/ExtrudeGeometry requires holes to be strictly
// interior; a hole that touches or crosses the boundary is invalid input and
// silently triangulates into gaps. The correct model is a notch spliced
// directly into the outer boundary contour itself (the same idea
// clipRectangleCorners already uses for the outer corner chamfer), sharing
// exact vertices with it, rather than a `holes` entry.
//
// CONNECTOR_SLOT_LOCAL_OUTLINE's own loop touches the mouth (u=0) at exactly
// 3 consecutive points -- [0,+2.65], [0,0], [0,-2.65], the straight edge
// segment that's already implicit in the board's outer boundary line -- with
// every other point at u>0 (strictly inward). Dropping those 3 and rotating
// the array to start right after them gives a single contiguous polyline
// from v=-2.65ish to v=+2.65ish: the notch to splice in, with its two open
// ends being the exact points where it should meet the boundary.
function connectorSlotDentLocal(local: Point[]): Point[] {
  const mouthIndices: number[] = [];
  local.forEach(([u], index) => { if (Math.abs(u) < 1e-6) mouthIndices.push(index); });
  const mouthStart = mouthIndices[0];
  const mouthEnd = mouthIndices[mouthIndices.length - 1];
  return [...local.slice(mouthEnd + 1), ...local.slice(0, mouthStart)];
}

// The board's outer boundary with every gated edge's connector slots spliced
// directly into the contour (see connectorSlotDentLocal). Verified empirically
// (signed area + self-intersection check, all 4 edges) that the dent's local
// v-increasing order has to be reversed to match boardOuterOutline's own CCW
// winding on every edge -- inserting it un-reversed produces a
// self-intersecting boundary.
// The point(s) a rectangle corner contributes to its outline: a single point
// if sharp, or the two clipRectangleCorners-style diagonal-clip points
// (entry along the incoming edge, exit along the outgoing edge) if chamfered.
function cornerOutlinePoints(corner: Point, incomingDir: Point, outgoingDir: Point, inset: number): Point[] {
  if (inset <= 0) return [corner];
  return [
    [corner[0] - incomingDir[0] * inset, corner[1] - incomingDir[1] * inset],
    [corner[0] + outgoingDir[0] * inset, corner[1] + outgoingDir[1] * inset],
  ];
}

// The board's outer boundary, composing both outer-corner treatments
// directly into one earcut contour instead of a separate CSG pass:
// - the 4-corner chamfer (chamferMode !== "none"), the same diagonal clip
//   clipRectangleCorners already applies to every tile hole's own corners;
// - the connector slot notches (see connectorSlotDentLocal), spliced into
//   the flat edge run between each pair of adjacent corners.
// subtractOuterCorners (CSG) was the original approach for the chamfer
// alone and remains correct in isolation, but three-bvh-csg's boolean
// proved unreliable again once the board's outer contour also carries the
// connector notch -- confirmed empirically (Chamfers=Corners + a connector
// notch, no screw, no coalescing involved) reproduces open edges at exactly
// the notch-affected bands. Doing both corner features in the same earcut
// pass this function builds sidesteps CSG for this primitive entirely.
function boardOuterOutlineWithFeatures(gridWidthUnits: number, gridHeightUnits: number, chamfered: boolean, connectorHolesEnabled: boolean): Point[] {
  const halfW = (gridWidthUnits * OPENGRID_TILE_SIZE) / 2;
  const halfD = (gridHeightUnits * OPENGRID_TILE_SIZE) / 2;
  const chamferInset = chamfered ? Math.min(CHAMFER_INSET, OPENGRID_TILE_SIZE / 2 - 0.01) : 0;
  const corners: Point[] = [[-halfW, -halfD], [halfW, -halfD], [halfW, halfD], [-halfW, halfD]];
  const cornerPoints = corners.map((corner, i) =>
    cornerOutlinePoints(corner, RECT_EDGE_DIRS[(i + 3) % 4], RECT_EDGE_DIRS[i], chamferInset),
  );

  const dentLocal = connectorSlotDentLocal(CONNECTOR_SLOT_LOCAL_OUTLINE);
  const dentsForEdge = (edge: BoardEdge, traversalAscending: boolean): Point[] => {
    if (!connectorHolesEnabled) return [];
    const slots = connectorSlotsForEdge(edge, gridWidthUnits, gridHeightUnits);
    const ordered = traversalAscending ? slots : [...slots].reverse();
    return ordered.flatMap((slot) => [...transformLocalOutline(dentLocal, slot.origin, slot.inward, slot.along)].reverse());
  };

  return [
    ...cornerPoints[0], // BL
    ...dentsForEdge("bottom", true), // BL -> BR, x ascending
    ...cornerPoints[1], // BR
    ...dentsForEdge("right", true), // BR -> TR, z ascending
    ...cornerPoints[2], // TR
    ...dentsForEdge("top", false), // TR -> TL, x descending
    ...cornerPoints[3], // TL
    ...dentsForEdge("left", false), // TL -> BL, z descending
  ];
}

// ===== Screw_Mounting =====
//
// openGrid.scad's applyTileCornerModifications screw stack (lines ~495-528):
// a straight shank punched fully through, a countersink frustum, and a
// straight head-clearance counterbore. Like Connector_Holes above, this is
// baked in as a per-band circular hole (radius varying band-to-band to
// approximate the frustum, the same style of approximation already used for
// the wall profile's own taper bands) rather than a single revolved CSG
// cutter, for the same three-bvh-csg robustness reason -- confirmed
// empirically: a plain revolved cutter also left the screw hole almost
// entirely un-subtracted next to a tile's corner wedge.
const SCREW_DIAMETER = 4.1; // openGrid.scad Screw_Diameter
const SCREW_HEAD_DIAMETER = 7.2; // openGrid.scad Screw_Head_Diameter
const SCREW_HEAD_INSET = 1; // openGrid.scad Screw_Head_Inset
const SCREW_HEAD_COUNTERSUNK_DEGREE = 90; // openGrid.scad Screw_Head_CounterSunk_Degree
const SCREW_HOLE_SEGMENTS = 32; // matches openGrid module's own $fn = 30 (rounded up)

// Radius of the screw cutter at height `z` (0 at the board's underside):
// shank up to the countersink, linearly widening through the countersink to
// the head-clearance radius, held flat for the head-clearance counterbore.
function screwHoleRadiusAt(z: number, thickness: number): number {
  const shankRadius = SCREW_DIAMETER / 2;
  const headRadius = SCREW_HEAD_DIAMETER / 2;
  const headBottom = thickness - SCREW_HEAD_INSET;
  const countersinkHeight = Math.tan(((180 - SCREW_HEAD_COUNTERSUNK_DEGREE) / 2) * (Math.PI / 180)) * (headRadius - shankRadius) - 0.01;
  const shankTop = headBottom - countersinkHeight;
  if (z >= headBottom) return headRadius;
  if (z >= shankTop) return shankRadius + ((headRadius - shankRadius) * (z - shankTop)) / Math.max(1e-9, countersinkHeight);
  return shankRadius;
}

function circlePoints(cx: number, cz: number, radius: number, segments: number): Point[] {
  const points: Point[] = [];
  for (let s = 0; s < segments; s += 1) {
    const t = (s / segments) * Math.PI * 2;
    points.push([cx + radius * Math.cos(t), cz + radius * Math.sin(t)]);
  }
  return points;
}

// openGrid.scad's applyTileCornerModifications mount-point formulas.
// "corners": one tile in from each of the board's 4 corners. "everywhere":
// BOSL2 grid_copies(spacing=tileSize, size=[(BW-2)*tileSize,(BH-2)*tileSize])
// -- a screw at every interior grid vertex (superset of "corners").
function screwMountPoints(gridWidthUnits: number, gridHeightUnits: number, mode: OpenGridScrewMounting): Point[] {
  const halfW = (gridWidthUnits * OPENGRID_TILE_SIZE) / 2;
  const halfD = (gridHeightUnits * OPENGRID_TILE_SIZE) / 2;
  if (mode === "corners") {
    return [
      [halfW - OPENGRID_TILE_SIZE, halfD - OPENGRID_TILE_SIZE],
      [-halfW + OPENGRID_TILE_SIZE, halfD - OPENGRID_TILE_SIZE],
      [halfW - OPENGRID_TILE_SIZE, -halfD + OPENGRID_TILE_SIZE],
      [-halfW + OPENGRID_TILE_SIZE, -halfD + OPENGRID_TILE_SIZE],
    ];
  }
  if (mode === "everywhere") {
    const axisPositions = (units: number) => {
      const size = Math.max(0, (units - 2) * OPENGRID_TILE_SIZE);
      const count = Math.floor(size / OPENGRID_TILE_SIZE) + 1;
      return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * OPENGRID_TILE_SIZE);
    };
    const xs = axisPositions(gridWidthUnits);
    const zs = axisPositions(gridHeightUnits);
    const points: Point[] = [];
    for (const x of xs) for (const z of zs) points.push([x, z]);
    return points;
  }
  return [];
}

type OpenGridBoardOptions = {
  gridWidth?: number;
  gridHeight?: number;
  boardType?: OpenGridBoardType;
  chamferMode?: OpenGridChamferMode;
  connectorHoles?: boolean;
  screwMounting?: OpenGridScrewMounting;
};

export function createOpenGridBoardGeometry({ gridWidth, gridHeight, boardType, chamferMode, connectorHoles, screwMounting }: OpenGridBoardOptions) {
  const gridWidthUnits = normalizeOpenGridUnits(gridWidth, DEFAULT_OPENGRID_GRID_WIDTH);
  const gridHeightUnits = normalizeOpenGridUnits(gridHeight, DEFAULT_OPENGRID_GRID_HEIGHT);
  const type = normalizeOpenGridBoardType(boardType);
  const mode = normalizeOpenGridChamferMode(chamferMode);
  const connectorHolesEnabled = normalizeOpenGridConnectorHoles(connectorHoles);
  const screwMode = normalizeOpenGridScrewMounting(screwMounting);
  const chamfered = mode !== "none";

  // Both outer-corner features (the 4-corner chamfer and the connector
  // notches) are composed into the earcut boundary itself -- see
  // boardOuterOutlineWithFeatures for why the chamfer moved off its
  // original CSG pass (subtractOuterCorners, now unused) once connector
  // notches were also in play. Only 2 of the 4 combinations can actually
  // occur on a given band (chamfer applies to the whole board height,
  // notches only to bands overlapping the connector range), but building
  // all 4 up front is cheap and keeps the per-band selection below simple.
  const outlineVariant = (bandChamfered: boolean, bandNotched: boolean) =>
    bandChamfered || bandNotched
      ? boardOuterOutlineWithFeatures(gridWidthUnits, gridHeightUnits, bandChamfered, bandNotched)
      : boardOuterOutline(gridWidthUnits, gridHeightUnits);
  const plainOutline = outlineVariant(false, false);
  const chamferedOutline = chamfered ? outlineVariant(true, false) : plainOutline;
  const notchedOutline = connectorHolesEnabled ? outlineVariant(false, true) : plainOutline;
  const chamferedNotchedOutline = chamfered && connectorHolesEnabled ? outlineVariant(true, true) : chamferedOutline;

  let board: THREE.BufferGeometry;
  let thickness: number;
  if (type === "heavy") {
    // Heavy mirrors two Full-thickness tiles back to back with their own
    // (currently unported) asymmetric single-lip profile -- the Full/Lite
    // band breakpoints above are dimensioned for a 6.8mm tile and don't
    // apply, so Heavy falls back to a flat slab until that profile lands
    // (Connector_Holes/Screw_Mounting fall back along with it).
    thickness = OPENGRID_THICKNESS.heavy;
    board = extrudeBandGeometry(chamferedOutline, [], thickness);
  } else {
    const bands = type === "lite" ? liteProfileBands() : fullProfileBands();
    thickness = bands[bands.length - 1].zEnd;

    const connectorYMin = thickness / 2 - CONNECTOR_SLOT_HEIGHT / 2;
    const connectorYMax = thickness / 2 + CONNECTOR_SLOT_HEIGHT / 2;
    const screwPoints = screwMode !== "none" ? screwMountPoints(gridWidthUnits, gridHeightUnits, screwMode) : [];

    const geometries = bands.map((band) => {
      const holes = bandTileHoles(gridWidthUnits, gridHeightUnits, band.inset, band.chamfer);
      if (screwPoints.length > 0) {
        const radius = screwHoleRadiusAt((band.zStart + band.zEnd) / 2, thickness);
        for (const [cx, cz] of screwPoints) holes.push(circlePoints(cx, cz, radius, SCREW_HOLE_SEGMENTS));
      }
      const bandNotched = connectorHolesEnabled && band.zStart < connectorYMax && band.zEnd > connectorYMin;
      const bandOuterOutline = chamfered
        ? (bandNotched ? chamferedNotchedOutline : chamferedOutline)
        : (bandNotched ? notchedOutline : plainOutline);
      const geometry = extrudeBandGeometry(bandOuterOutline, holes, band.zEnd - band.zStart);
      geometry.translate(0, band.zStart, 0);
      return geometry;
    });
    board = weldCoincidentDoubleFaces(mergeBandGeometries(geometries));
  }

  return board;
}
