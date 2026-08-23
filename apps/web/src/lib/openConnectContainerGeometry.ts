import * as THREE from "three";
import type {
  OpenConnectCornerRounding,
  OpenConnectShapeType,
  OpenConnectSlotLockDistribution,
  OpenConnectSlotPosition,
} from "@/types/sketchforge";
import { OPENGRID_TILE_SIZE, weldCoincidentDoubleFaces } from "@/lib/openGridGeometry";
import { SLOT_NO_LOCK_INDICES, SLOT_NO_LOCK_POSITIONS, SLOT_WITH_LOCK_INDICES, SLOT_WITH_LOCK_POSITIONS } from "@/lib/openConnectSlotMesh";

// Reference: mitufy/opengrid-projects openconnect_plate.scad / openconnect_sturdy_shelf.scad /
// lib/opengrid_base.scad / lib/openconnect_lib.scad (CC-BY 4.0). openConnect is a
// connector system designed for openGrid, the ecosystem created by David D
// (see the credit already established alongside OPENGRID_TILE_SIZE in
// openGridGeometry.ts). Container body (base/walls/lips) and slot placement
// pattern (isGridPosDescribed) are our own reimplementation of that logic.
//
// The slot cutout's shape (SLOT_NO_LOCK_*/SLOT_WITH_LOCK_*, in
// openConnectSlotMesh.ts) is not hand-derived: it was extracted by
// rendering openconnect_lib.scad's own openconnect_slot() module (default
// ocslot_cfg()) through OpenSCAD (the `openscad/openscad:dev` nightly build
// + a BOSL2 checkout -- the 2021.01 stable release doesn't support the
// module's one oblique linear_extrude(v=...) call and silently substitutes
// a garbage 100mm-tall artifact instead) and exporting STL. Confirmed
// watertight/manifold in isolation (0 boundary, 0 non-manifold edges,
// single volume) before use. See reference/openconnect/README.md to
// regenerate.
//
// The back wall is built as a proper boundary representation, not CSG: an
// earlier version subtracted the slot as a solid via three-bvh-csg, but
// that boolean reliably left dozens of open boundary edges behind on any
// cut whose own boundary reaches the target's surface (confirmed even on a
// plain box-minus-box case, and only partially resolved by the library's
// own `useCDTClipping` option) -- exactly what a slot's mouth opening onto
// the wall's outward face requires. A second attempt sliced the mesh into
// Z-bands and baked a hole into each band's own earcut outline (avoiding
// CSG entirely) but independently-capped adjacent bands with genuinely
// different hole shapes don't reconcile at their shared boundary (the same
// structural issue already on record for the board's own banded capture
// groove -- see the memory note on its deferred loft-based rewrite): each
// cap is individually valid, but two different hole shapes meeting at one
// Z-plane leave a real gap, not a false-positive weld candidate.
//
// This version instead reuses the slot mesh's own exact side-wall surface
// (everything except its 2 flat end caps, split off by
// splitCapAndSide/reverseWinding below) as the hole's own interior wall,
// with 2 small flat caps closing its 2 open rims -- a standard "hole in a
// solid" boundary representation, built once per grid cell and stitched
// into the wall via shared vertex coordinates rather than a boolean.

// ===== shape type / option normalizers =====

export const DEFAULT_OPENCONNECT_SHAPE_TYPE: OpenConnectShapeType = "Bin";
export const DEFAULT_OPENCONNECT_INTERNAL_WIDTH = 56;
export const DEFAULT_OPENCONNECT_INTERNAL_HEIGHT = 28;
export const DEFAULT_OPENCONNECT_INTERNAL_DEPTH = 28;
export const DEFAULT_OPENCONNECT_WALL_THICKNESS = 3;
export const DEFAULT_OPENCONNECT_BASE_THICKNESS = 3;
export const DEFAULT_OPENCONNECT_SLOT_LOCK_DISTRIBUTION: OpenConnectSlotLockDistribution = "Corners";
export const DEFAULT_OPENCONNECT_SLOT_POSITION: OpenConnectSlotPosition = "All";
export const DEFAULT_OPENCONNECT_CORNER_ROUNDING: OpenConnectCornerRounding = "None";

export const MIN_OPENCONNECT_DIMENSION = 20;
export const MAX_OPENCONNECT_DIMENSION = 560;
// Floored at 3mm, comfortably >= the openConnect slot mechanism's own ~2.7mm
// depth -- a wall thinner than the slot itself couldn't hold the connector
// mechanism anyway, and the back wall's boundary-representation construction
// (see the file header) assumes the slot's blind pocket fits entirely
// within the wall's thickness.
export const MIN_OPENCONNECT_WALL_THICKNESS = 3;
export const MAX_OPENCONNECT_WALL_THICKNESS = 20;
export const MIN_OPENCONNECT_BASE_THICKNESS = 1.5;
export const MAX_OPENCONNECT_BASE_THICKNESS = 20;

// Shelf is intentionally simplified from openconnect_sturdy_shelf.scad -- a
// flat platform + back wall (with slot cutouts) + small raised side lips,
// no truss/gusset reinforcement or print-orientation texture (those are
// print-strength cosmetics, not part of the board-mounting mechanism).
const SHELF_BACK_HEIGHT = OPENGRID_TILE_SIZE * 2; // matches the reference's "Standard" top+bottom grid default
const SHELF_LIP_HEIGHT = 12;
const SHELF_LIP_DEPTH = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeOpenConnectShapeType(value?: string): OpenConnectShapeType {
  return value === "Shelf" ? "Shelf" : DEFAULT_OPENCONNECT_SHAPE_TYPE;
}

export function normalizeOpenConnectDimension(value: number | undefined, fallback: number): number {
  return clamp(Number.isFinite(value) ? (value as number) : fallback, MIN_OPENCONNECT_DIMENSION, MAX_OPENCONNECT_DIMENSION);
}

export function normalizeOpenConnectWallThickness(value: number | undefined): number {
  return clamp(Number.isFinite(value) ? (value as number) : DEFAULT_OPENCONNECT_WALL_THICKNESS, MIN_OPENCONNECT_WALL_THICKNESS, MAX_OPENCONNECT_WALL_THICKNESS);
}

export function normalizeOpenConnectBaseThickness(value: number | undefined): number {
  return clamp(Number.isFinite(value) ? (value as number) : DEFAULT_OPENCONNECT_BASE_THICKNESS, MIN_OPENCONNECT_BASE_THICKNESS, MAX_OPENCONNECT_BASE_THICKNESS);
}

export function normalizeOpenConnectWallEnabled(value: boolean | undefined): boolean {
  return value !== false;
}

const SLOT_LOCK_DISTRIBUTION_OPTIONS: OpenConnectSlotLockDistribution[] = ["All", "Staggered", "Corners", "Top Corners", "None"];
const SLOT_POSITION_OPTIONS: OpenConnectSlotPosition[] = ["All", "Staggered", "Edge Rows", "Edge Columns", "Corners"];
const CORNER_ROUNDING_OPTIONS: OpenConnectCornerRounding[] = ["None", "Chamfer", "Fillet"];

export function normalizeSlotLockDistribution(value?: string): OpenConnectSlotLockDistribution {
  return (SLOT_LOCK_DISTRIBUTION_OPTIONS as string[]).includes(value ?? "") ? (value as OpenConnectSlotLockDistribution) : DEFAULT_OPENCONNECT_SLOT_LOCK_DISTRIBUTION;
}

export function normalizeSlotPosition(value?: string): OpenConnectSlotPosition {
  return (SLOT_POSITION_OPTIONS as string[]).includes(value ?? "") ? (value as OpenConnectSlotPosition) : DEFAULT_OPENCONNECT_SLOT_POSITION;
}

export function normalizeCornerRounding(value?: string): OpenConnectCornerRounding {
  return (CORNER_ROUNDING_OPTIONS as string[]).includes(value ?? "") ? (value as OpenConnectCornerRounding) : DEFAULT_OPENCONNECT_CORNER_ROUNDING;
}

// ===== is_grid_pos_described (lib/opengrid_base.scad) -- direct port =====
//
// Pure boolean placement-pattern function, used by both slot_position (does
// a slot exist at this grid cell) and slot_lock_distribution (does that
// slot get the locking nub). No BOSL2 dependency in the original -- this is
// a 1:1 port, not an approximation. `except_pos` (the reference's optional
// exclusion list) is dropped since neither of our two call sites use it.
function isGridPosDescribed(hgrid: number, vgrid: number, maxHgrid: number, maxVgrid: number, description: string): boolean {
  const isStagger = hgrid % 2 === vgrid % 2;
  const isTopRow = vgrid === 0;
  const isBottomRow = vgrid === maxVgrid - 1;
  const isLeftColumn = hgrid === 0;
  const isRightColumn = hgrid === maxHgrid - 1;
  const isEdgeRow = isTopRow || isBottomRow;
  const isEdgeColumn = isLeftColumn || isRightColumn;
  const isCorner = isEdgeRow && isEdgeColumn;
  const isTopCorner = isCorner && isTopRow;
  switch (description) {
    case "All":
      return true;
    case "None":
      return false;
    case "Staggered":
      return isStagger;
    case "Corners":
      return isCorner;
    case "Top Corners":
      return isTopCorner;
    case "Edge Rows":
      return isEdgeRow;
    case "Edge Columns":
      return isEdgeColumn;
    default:
      return false;
  }
}


// ===== openConnect slot cutout mesh processing =====
//
// Local frame (as rendered, see file header): X = across the wall (tile
// pitch axis), Y = slide axis (mouth/onramp toward -Y, capture pocket + the
// locking nub toward +Y), Z = depth from the wall's outward face (0) inward
// (~2.7mm at the deepest point). `add_nubs="Left"` is mitufy's own default
// (openconnect_plate.scad hardcodes slot_lock_side="Left"); we do the same,
// no lock-side option was requested.

export type Point2 = [number, number];

// `target.push(...source)` blows the call stack once `source` gets into the
// tens of thousands of elements (each element becomes a function argument)
// -- a real case here, not hypothetical.
function appendAll(target: number[], source: number[]) {
  for (let i = 0; i < source.length; i += 1) target.push(source[i]);
}

function geometryFromPositions(positions: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function expandIndexed(positions: number[], indices: number[]): number[] {
  const out: number[] = new Array(indices.length * 3);
  for (let i = 0; i < indices.length; i += 1) {
    const vertexIndex = indices[i] * 3;
    out[i * 3] = positions[vertexIndex];
    out[i * 3 + 1] = positions[vertexIndex + 1];
    out[i * 3 + 2] = positions[vertexIndex + 2];
  }
  return out;
}

// Swaps 2 of a triangle's 3 vertices, reversing its winding (and therefore
// its normal direction) without moving any vertex.
function reverseWinding(soup: number[]): number[] {
  const out: number[] = new Array(soup.length);
  for (let i = 0; i < soup.length; i += 9) {
    out[i] = soup[i]; out[i + 1] = soup[i + 1]; out[i + 2] = soup[i + 2];
    out[i + 3] = soup[i + 6]; out[i + 4] = soup[i + 7]; out[i + 5] = soup[i + 8];
    out[i + 6] = soup[i + 3]; out[i + 7] = soup[i + 4]; out[i + 8] = soup[i + 5];
  }
  return out;
}

// Splits a closed mesh's triangle soup into its 2 flat end caps (every
// vertex at local Z ~= 0, or every vertex at local Z ~= maxZ) and
// everything else (the connecting side wall). Used to reuse the slot tool's
// own exact side-wall surface as a hole's interior wall while replacing its
// end caps with ones that carry the wall's own outer-rectangle boundary
// (see buildBackWallPositions).
function splitCapAndSide(soup: number[], maxZ: number) {
  const EPS = 1e-4;
  const side: number[] = [];
  const mouthCap: number[] = [];
  const deepCap: number[] = [];
  for (let i = 0; i < soup.length; i += 9) {
    const z0 = soup[i + 2], z1 = soup[i + 5], z2 = soup[i + 8];
    if (Math.abs(z0) < EPS && Math.abs(z1) < EPS && Math.abs(z2) < EPS) {
      for (let k = 0; k < 9; k += 1) mouthCap.push(soup[i + k]);
    } else if (Math.abs(z0 - maxZ) < EPS && Math.abs(z1 - maxZ) < EPS && Math.abs(z2 - maxZ) < EPS) {
      for (let k = 0; k < 9; k += 1) deepCap.push(soup[i + k]);
    } else {
      for (let k = 0; k < 9; k += 1) side.push(soup[i + k]);
    }
  }
  return { side, mouthCap, deepCap };
}

// Extracts the closed 2D boundary loop of a flat (constant-Z) triangle set
// -- the edges used by exactly one triangle, chained by shared endpoints.
// Same technique used offline to slice the board's own capture-groove
// profile (openGridGeometry.ts), just run here at module load instead of
// baked ahead of time, since it only needs to run once per variant over a
// small (tens of triangles) cap.
function outlineFromCapTriangles(capSoup: number[]): Point2[] {
  const quantize = (v: number) => Math.round(v * 1e4) / 1e4;
  const pointKey = (x: number, y: number) => `${quantize(x)},${quantize(y)}`;
  const edgeCounts = new Map<string, number>();
  const edgeEnds = new Map<string, [Point2, Point2]>();
  for (let i = 0; i < capSoup.length; i += 9) {
    const tri: Point2[] = [[capSoup[i], capSoup[i + 1]], [capSoup[i + 3], capSoup[i + 4]], [capSoup[i + 6], capSoup[i + 7]]];
    for (let e = 0; e < 3; e += 1) {
      const a = tri[e];
      const b = tri[(e + 1) % 3];
      const ka = pointKey(a[0], a[1]);
      const kb = pointKey(b[0], b[1]);
      const edgeKey = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      edgeCounts.set(edgeKey, (edgeCounts.get(edgeKey) ?? 0) + 1);
      if (!edgeEnds.has(edgeKey)) edgeEnds.set(edgeKey, [a, b]);
    }
  }
  const adjacency = new Map<string, Array<{ to: string; point: Point2 }>>();
  const pointByKey = new Map<string, Point2>();
  for (const [edgeKey, count] of edgeCounts) {
    if (count !== 1) continue;
    const [a, b] = edgeEnds.get(edgeKey)!;
    const ka = pointKey(a[0], a[1]);
    const kb = pointKey(b[0], b[1]);
    pointByKey.set(ka, a);
    pointByKey.set(kb, b);
    if (!adjacency.has(ka)) adjacency.set(ka, []);
    if (!adjacency.has(kb)) adjacency.set(kb, []);
    adjacency.get(ka)!.push({ to: kb, point: b });
    adjacency.get(kb)!.push({ to: ka, point: a });
  }
  const startKey = adjacency.keys().next().value;
  if (startKey === undefined) return [];
  const loop: Point2[] = [pointByKey.get(startKey)!];
  const visited = new Set<string>([startKey]);
  let currentKey = startKey;
  let guard = 0;
  while (guard < 10000) {
    guard += 1;
    const options = adjacency.get(currentKey) ?? [];
    const next = options.find((o) => !visited.has(o.to));
    if (!next) break;
    visited.add(next.to);
    loop.push(next.point);
    currentKey = next.to;
  }
  return loop;
}

function meshMaxZ(soup: number[]): number {
  let maxZ = 0;
  for (let i = 2; i < soup.length; i += 3) maxZ = Math.max(maxZ, soup[i]);
  return maxZ;
}

const NO_LOCK_SOUP = expandIndexed(SLOT_NO_LOCK_POSITIONS, SLOT_NO_LOCK_INDICES);
const WITH_LOCK_SOUP = expandIndexed(SLOT_WITH_LOCK_POSITIONS, SLOT_WITH_LOCK_INDICES);
const NO_LOCK_MAX_Z = meshMaxZ(NO_LOCK_SOUP);
const WITH_LOCK_MAX_Z = meshMaxZ(WITH_LOCK_SOUP);
// Both variants share the same base slot profile depth (the lock nub only
// differs in X); either would do, but average away any last-decimal noise.
export const SLOT_TOOL_DEPTH = (NO_LOCK_MAX_Z + WITH_LOCK_MAX_Z) / 2;

const NO_LOCK_SPLIT = splitCapAndSide(NO_LOCK_SOUP, NO_LOCK_MAX_Z);
const WITH_LOCK_SPLIT = splitCapAndSide(WITH_LOCK_SOUP, WITH_LOCK_MAX_Z);
// The tool's own side wall has outward-facing normals (pointing away from
// its own solid, i.e. into the surrounding wall material) -- reused as a
// HOLE's interior wall, it needs to face the opposite way (into the empty
// hole), hence reversed.
const NO_LOCK_SIDE_REVERSED = reverseWinding(NO_LOCK_SPLIT.side);
const WITH_LOCK_SIDE_REVERSED = reverseWinding(WITH_LOCK_SPLIT.side);
// Exported (alongside SLOT_TOOL_DEPTH and openConnectSlotGridCells below) so
// tests can locate each cavity's own known 2D footprint and depth without
// duplicating this module's mesh-slicing math -- see the raycast "slot is
// actually open" test in openConnectContainerGeometry.test.ts.
export const NO_LOCK_MOUTH_OUTLINE = outlineFromCapTriangles(NO_LOCK_SPLIT.mouthCap);
export const NO_LOCK_DEEP_OUTLINE = outlineFromCapTriangles(NO_LOCK_SPLIT.deepCap);
export const WITH_LOCK_MOUTH_OUTLINE = outlineFromCapTriangles(WITH_LOCK_SPLIT.mouthCap);
export const WITH_LOCK_DEEP_OUTLINE = outlineFromCapTriangles(WITH_LOCK_SPLIT.deepCap);

// Local Z increases going INTO the wall from its outward face; local Y is
// negated when placed into world space (see buildBackWallPositions) --
// world Y = -localY + center. Transforms a slot-tool triangle soup (already
// in local X/Y/Z) into world space for one grid cell.
function transformedSlotSoup(soup: number[], worldXCenter: number, worldYCenter: number, outwardFaceZ: number): number[] {
  const out: number[] = new Array(soup.length);
  for (let i = 0; i < soup.length; i += 3) {
    out[i] = soup[i] + worldXCenter;
    out[i + 1] = -soup[i + 1] + worldYCenter;
    out[i + 2] = outwardFaceZ - soup[i + 2];
  }
  return out;
}

export function transformedOutline(outline: Point2[], worldXCenter: number, worldYCenter: number): Point2[] {
  return outline.map(([x, y]): Point2 => [x + worldXCenter, -y + worldYCenter]);
}

export type OpenConnectSlotGridCell = { worldXCenter: number; worldYCenter: number; withLock: boolean };

// Same grid-cell placement buildBackWallPositions uses internally, exposed
// standalone so tests can locate a real slot's world-space cell center
// without duplicating (and risking drift from) this placement math.
export function openConnectSlotGridCells(
  backWallWidth: number,
  backWallHeight: number,
  slotPosition: OpenConnectSlotPosition,
  slotLockDistribution: OpenConnectSlotLockDistribution,
): OpenConnectSlotGridCell[] {
  const horizontalGrids = Math.max(1, Math.floor(backWallWidth / OPENGRID_TILE_SIZE));
  const verticalGrids = Math.max(1, Math.floor(backWallHeight / OPENGRID_TILE_SIZE));
  const cells: OpenConnectSlotGridCell[] = [];
  for (let i = 0; i < horizontalGrids; i += 1) {
    for (let j = 0; j < verticalGrids; j += 1) {
      if (!isGridPosDescribed(i, j, horizontalGrids, verticalGrids, slotPosition)) continue;
      const withLock = isGridPosDescribed(i, j, horizontalGrids, verticalGrids, slotLockDistribution);
      // Reference's own openconnect_slot_grid centering formula
      // (lib/openconnect_lib.scad), ported verbatim.
      const xOffset = -(horizontalGrids - i * 2 - 1) * (OPENGRID_TILE_SIZE / 2);
      const yOffset = (verticalGrids - j * 2 - 1) * (OPENGRID_TILE_SIZE / 2);
      cells.push({ worldXCenter: backWallWidth / 2 + xOffset, worldYCenter: backWallHeight / 2 + yOffset, withLock });
    }
  }
  return cells;
}

// ===== simple axis-aligned box pieces (side walls / front wall / lips) =====

type Box = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };

function box(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Box {
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

function boxPositions(b: Box): number[] {
  const sizeX = Math.max(0, b.maxX - b.minX);
  const sizeY = Math.max(0, b.maxY - b.minY);
  const sizeZ = Math.max(0, b.maxZ - b.minZ);
  if (sizeX <= 0 || sizeY <= 0 || sizeZ <= 0) return [];
  const geometry = new THREE.BoxGeometry(sizeX, sizeY, sizeZ).toNonIndexed();
  geometry.translate((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
  const position = geometry.getAttribute("position");
  const out: number[] = new Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    out[i * 3] = position.getX(i);
    out[i * 3 + 1] = position.getY(i);
    out[i * 3 + 2] = position.getZ(i);
  }
  geometry.dispose();
  return out;
}

// Body pieces only TOUCH at their shared seams rather than merging into one
// mesh -- each piece is independently a closed, watertight box (or
// extrusion), so simply concatenating their triangle soups already
// satisfies a plain edge-count watertightness check (every edge is still
// shared by exactly 2 triangles within its own piece). The one exception is
// two pieces whose touching face is an EXACT full match in both size and
// position (not just overlapping footprints) -- that creates a literal
// double-layer face (edge count 4, not 2), confirmed on a minimal repro.
// WALL_OVERLAP grows each wall/lip slightly into its neighbor so touching
// seams are always a genuine (if tiny) volumetric overlap instead of an
// exact coincidence -- harmless extra interior material on a solid,
// 3D-printed part.
const WALL_OVERLAP = 0.2;

// ===== earcut + ExtrudeGeometry =====

// The baked slot band outlines (sliced from a mesh, not hand-authored)
// occasionally carry a run of consecutive near-duplicate points -- e.g. two
// triangles meeting exactly at the slice plane both contributing the same
// intersection point. A zero-length edge like that is harmless to a plain
// edge-count check on the raw mesh, but it can make earcut's triangulation
// of the 2D outline non-manifold locally, so it's dropped before use.
function dedupeOutline(points: Point2[]): Point2[] {
  const EPS = 1e-6;
  const out: Point2[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(p[0] - prev[0]) < EPS && Math.abs(p[1] - prev[1]) < EPS) continue;
    out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && Math.abs(first[0] - last[0]) < EPS && Math.abs(first[1] - last[1]) < EPS) out.pop();
  return out;
}

function shapeFromOutline(outer: Point2[], holes: Point2[][]): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(outer[0][0], outer[0][1]);
  for (let i = 1; i < outer.length; i += 1) shape.lineTo(outer[i][0], outer[i][1]);
  shape.closePath();
  for (const rawHole of holes) {
    const hole = dedupeOutline(rawHole);
    const path = new THREE.Path();
    path.moveTo(hole[0][0], hole[0][1]);
    for (let i = 1; i < hole.length; i += 1) path.lineTo(hole[i][0], hole[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

function extractPositions(geometry: THREE.BufferGeometry): number[] {
  const position = geometry.getAttribute("position");
  const out: number[] = new Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    out[i * 3] = position.getX(i);
    out[i * 3 + 1] = position.getY(i);
    out[i * 3 + 2] = position.getZ(i);
  }
  geometry.dispose();
  return out;
}

// Extrudes a (X, Y) footprint (outer boundary + optional holes) along Z from
// zStart to zEnd -- three.js's own native ExtrudeGeometry convention
// (footprint in the XY plane, extrude toward +Z). Used for the back wall,
// whose own natural "up" (extrude) axis is world Z (its thickness/depth).
function extrudeXYFootprint(outer: Point2[], holes: Point2[][], zStart: number, zEnd: number): number[] {
  const geometry = new THREE.ExtrudeGeometry(shapeFromOutline(outer, holes), { depth: zEnd - zStart, bevelEnabled: false, steps: 1, curveSegments: 8 }).toNonIndexed();
  geometry.translate(0, 0, zStart);
  return extractPositions(geometry);
}

// A flat (zero-thickness) (X, Y) filled shape at a fixed Z -- ShapeGeometry
// is ExtrudeGeometry's own single flat cap, same CCW-outer/+Z-normal
// convention (verified: a CCW rect's ShapeGeometry has normal (0,0,1),
// matching ExtrudeGeometry's own far-cap normal for the same input).
function capXYFootprint(outer: Point2[], holes: Point2[][], z: number): number[] {
  const geometry = new THREE.ShapeGeometry(shapeFromOutline(outer, holes)).toNonIndexed();
  geometry.translate(0, 0, z);
  return extractPositions(geometry);
}

// The 4 side faces of a (X, Y) rectangle extruded from zStart to zEnd,
// WITHOUT its 2 end caps -- used where a separate, differently-shaped cap
// (built via capXYFootprint) needs to close each end instead. Built from
// the same ExtrudeGeometry call path as capXYFootprint's own caps (rather
// than THREE.BoxGeometry's independent corner computation), so the two
// pieces' shared corner vertices are bit-identical, not just numerically
// close: THREE.BoxGeometry computes each corner as center +/- size/2
// internally, while ShapeGeometry/ExtrudeGeometry place the outline's own
// literal coordinates directly, and two different float computations of
// "the same" corner can round to adjacent quantization buckets once
// float32 storage is involved -- confirmed as the cause of 12 stray
// boundary edges on a larger (140x84) configuration despite the default
// (56x28) one passing clean.
function sideWallsFromRect(rect: Point2[], zStart: number, zEnd: number): number[] {
  const all = extrudeXYFootprint(rect, [], zStart, zEnd);
  const out: number[] = [];
  // 1e-6 is too tight here: ExtrudeGeometry's own cap vertices, run back
  // through translate()'s float32-backed position buffer, can land ~2e-6
  // off their exact zStart/zEnd value (confirmed: a real 13-vertex slot
  // outline's far cap landed 1.83e-6 short) -- just under that threshold
  // leaves the entire far cap misclassified as "side" geometry, i.e. a
  // real flat surface silently sealing shut whatever this function's own
  // caller expected to stay open. 1e-4 matches the tolerance already used
  // elsewhere in this file for the same class of baked/derived float data
  // (see splitCapAndSide).
  const EPS = 1e-4;
  for (let i = 0; i < all.length; i += 9) {
    const z0 = all[i + 2], z1 = all[i + 5], z2 = all[i + 8];
    const allMinZ = Math.abs(z0 - zStart) < EPS && Math.abs(z1 - zStart) < EPS && Math.abs(z2 - zStart) < EPS;
    const allMaxZ = Math.abs(z0 - zEnd) < EPS && Math.abs(z1 - zEnd) < EPS && Math.abs(z2 - zEnd) < EPS;
    if (allMinZ || allMaxZ) continue;
    for (let k = 0; k < 9; k += 1) out.push(all[i + k]);
  }
  return out;
}

// Extrudes an (X, Z) footprint along Y from yStart to yEnd -- same
// shape-local-(x,-z) + rotateX(-90deg) convention openGridGeometry.ts's own
// extrudeBandGeometry/tracePath use (that primitive's own extrude axis is
// also world Y), so footprint winding/orientation matches the rest of this
// codebase's primitives. Used for the base slab, whose "up" axis is Y.
function extrudeXZFootprint(outline: Point2[], yStart: number, yEnd: number): number[] {
  const shape = new THREE.Shape();
  shape.moveTo(outline[0][0], -outline[0][1]);
  for (let i = 1; i < outline.length; i += 1) shape.lineTo(outline[i][0], -outline[i][1]);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: yEnd - yStart, bevelEnabled: false, steps: 1, curveSegments: 8 }).toNonIndexed();
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, yStart, 0);
  return extractPositions(geometry);
}

// ===== corner rounding (small nice-to-have) =====
//
// Applied to the base slab's own footprint outline only (not carried through
// the walls) -- keeps this to a single, low-risk earcut outline change
// rather than reworking every wall piece into an outline-extrusion too.
// Direct port of openGridGeometry.ts's own clipRectangleCorners technique
// (corner -> incomingDir/outgoingDir offsets), generalized to also support
// an arc (fillet) instead of a straight chamfer line between the two offset
// points; the arc sweep is computed generically from the two offset points'
// angles around a common center, so it works unmodified for all 4 corners
// without hand-casing each quadrant.
const RECT_EDGE_DIRS: Point2[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function roundedRectOutline(minX: number, maxX: number, minZ: number, maxZ: number, cornerRounding: OpenConnectCornerRounding, size: number): Point2[] {
  const corners: Point2[] = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
  if (cornerRounding === "None" || size <= 0) return corners;
  const points: Point2[] = [];
  for (let i = 0; i < 4; i += 1) {
    const corner = corners[i];
    const incomingDir = RECT_EDGE_DIRS[(i + 3) % 4];
    const outgoingDir = RECT_EDGE_DIRS[i];
    const arrive: Point2 = [corner[0] - incomingDir[0] * size, corner[1] - incomingDir[1] * size];
    const depart: Point2 = [corner[0] + outgoingDir[0] * size, corner[1] + outgoingDir[1] * size];
    if (cornerRounding === "Chamfer") {
      points.push(arrive, depart);
      continue;
    }
    const centerX = corner[0] - incomingDir[0] * size + outgoingDir[0] * size;
    const centerZ = corner[1] - incomingDir[1] * size + outgoingDir[1] * size;
    const startAngle = Math.atan2(arrive[1] - centerZ, arrive[0] - centerX);
    const endAngle = Math.atan2(depart[1] - centerZ, depart[0] - centerX);
    let delta = endAngle - startAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const segments = 8;
    for (let s = 0; s <= segments; s += 1) {
      const angle = startAngle + (delta * s) / segments;
      points.push([centerX + size * Math.cos(angle), centerZ + size * Math.sin(angle)]);
    }
  }
  return points;
}

// ===== back wall =====
//
// Builds the back wall's outer box (X width, Y height, Z thickness) with
// each active slot cutout's cavity stitched in as a proper hole, fully
// perforating the wall (0 remaining material at the interior face -- a
// blind pocket would strand the connector mechanism without through
// clearance): 4 outer side walls (constant cross-section, spans the full
// thickness) + an outward-face cap (Z = outerFaceZ, holed wherever a
// cell's mouth sits) + an inward-face cap (Z = innerFaceZ, holed wherever
// a cell's cavity opens through) + per cell: the slot tool's own
// side-wall surface (reversed, see NO_LOCK_SIDE_REVERSED/WITH_LOCK_SIDE_REVERSED)
// closing the cavity's outer boundary from the mouth down to where the
// tool's own baked mesh ends (~2.7mm, cavityDepthStart), plus a straight
// extension of that same deep-rim cross-section (also reversed) carrying
// the cavity the rest of the way through whatever wall thickness remains
// beyond the tool's own reach (MIN_OPENCONNECT_WALL_THICKNESS guarantees
// this remainder is never negative) to the wall's true interior face --
// no cap in between, since the cross-section is unchanged at that Z and
// the hole simply continues. World Y is the tool's local Y NEGATED: the reference's own
// mouth/onramp end (-Y) is the wide, easy entry point, and the capture
// pocket + locking nub (+Y) is the tight, secured resting position --
// physically the mouth belongs at the TOP of the cutout (you lower the
// container onto the snap heads) and the pocket/lock at the BOTTOM (sliding
// down seats it).
function buildBackWallPositions(
  outerMinX: number,
  outerMaxX: number,
  wallYMin: number,
  wallYMax: number,
  innerFaceZ: number,
  outerFaceZ: number,
  backWallWidth: number,
  backWallHeight: number,
  slotPosition: OpenConnectSlotPosition,
  slotLockDistribution: OpenConnectSlotLockDistribution,
): number[] {
  const outerRect: Point2[] = [[outerMinX, wallYMin], [outerMaxX, wallYMin], [outerMaxX, wallYMax], [outerMinX, wallYMax]];
  const positions: number[] = [];

  const cells = openConnectSlotGridCells(backWallWidth, backWallHeight, slotPosition, slotLockDistribution);

  const cavityDepthStart = outerFaceZ - SLOT_TOOL_DEPTH; // where the slot tool's own baked mesh geometry ends
  // The outer perimeter from innerFaceZ..cavityDepthStart is unaffected by
  // cavities (they sit entirely inside the grid cells, away from the
  // perimeter) -- built the same way regardless of whether any cell is
  // active.
  appendAll(positions, sideWallsFromRect(outerRect, innerFaceZ, cavityDepthStart));

  if (cells.length === 0) {
    appendAll(positions, reverseWinding(capXYFootprint(outerRect, [], innerFaceZ))); // true inner face, facing -Z (away from the wall's own solid)
    appendAll(positions, extrudeXYFootprint(outerRect, [], cavityDepthStart, outerFaceZ));
    return positions;
  }

  appendAll(positions, sideWallsFromRect(outerRect, cavityDepthStart, outerFaceZ));

  const mouthHoles: Point2[][] = [];
  const deepHoles: Point2[][] = [];
  for (const cell of cells) {
    const mouthOutline = cell.withLock ? WITH_LOCK_MOUTH_OUTLINE : NO_LOCK_MOUTH_OUTLINE;
    const deepOutline = cell.withLock ? WITH_LOCK_DEEP_OUTLINE : NO_LOCK_DEEP_OUTLINE;
    const sideReversed = cell.withLock ? WITH_LOCK_SIDE_REVERSED : NO_LOCK_SIDE_REVERSED;
    const deepOutlineWorld = transformedOutline(deepOutline, cell.worldXCenter, cell.worldYCenter);
    mouthHoles.push(transformedOutline(mouthOutline, cell.worldXCenter, cell.worldYCenter));
    deepHoles.push(deepOutlineWorld);
    appendAll(positions, transformedSlotSoup(sideReversed, cell.worldXCenter, cell.worldYCenter, outerFaceZ));
    // Straight continuation of the tool's own deep-rim cross-section
    // (unchanged outline, so no cap/boundary needed at cavityDepthStart
    // itself) from where the baked mesh ends through to the wall's true
    // interior face -- reversed the same way as the tool's own side wall,
    // since this is also hole-interior surface, not solid-exterior surface.
    appendAll(positions, reverseWinding(sideWallsFromRect(deepOutlineWorld, innerFaceZ, cavityDepthStart)));
  }
  appendAll(positions, reverseWinding(capXYFootprint(outerRect, deepHoles, innerFaceZ))); // true inner face, holed through wherever a cavity fully perforates
  appendAll(positions, capXYFootprint(outerRect, mouthHoles, outerFaceZ)); // outward face, holed at every cell's mouth
  return positions;
}

// ===== overall bounding box (mirrored onto WorkplaneShape width/height/depth,
// same convention openGridBoardDimensions already establishes for the board) =====

export type OpenConnectContainerOptions = {
  shapeType?: OpenConnectShapeType;
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
};

export function openConnectContainerDimensions(options: OpenConnectContainerOptions) {
  const shapeType = normalizeOpenConnectShapeType(options.shapeType);
  const internalWidth = normalizeOpenConnectDimension(options.internalWidth, DEFAULT_OPENCONNECT_INTERNAL_WIDTH);
  const internalDepth = normalizeOpenConnectDimension(options.internalDepth, DEFAULT_OPENCONNECT_INTERNAL_DEPTH);
  const wallThickness = normalizeOpenConnectWallThickness(options.wallThickness);
  const baseThickness = normalizeOpenConnectBaseThickness(options.baseThickness);

  if (shapeType === "Shelf") {
    return {
      width: internalWidth + wallThickness * 2,
      height: baseThickness + SHELF_BACK_HEIGHT,
      depth: internalDepth + wallThickness,
    };
  }

  const internalHeight = normalizeOpenConnectDimension(options.internalHeight, DEFAULT_OPENCONNECT_INTERNAL_HEIGHT);
  const leftEnabled = normalizeOpenConnectWallEnabled(options.leftWallEnabled);
  const rightEnabled = normalizeOpenConnectWallEnabled(options.rightWallEnabled);
  const frontEnabled = normalizeOpenConnectWallEnabled(options.frontWallEnabled);
  const bottomEnabled = normalizeOpenConnectWallEnabled(options.bottomWallEnabled);
  return {
    width: internalWidth + (leftEnabled ? wallThickness : 0) + (rightEnabled ? wallThickness : 0),
    height: (bottomEnabled ? baseThickness : 0) + internalHeight,
    depth: internalDepth + wallThickness + (frontEnabled ? wallThickness : 0),
  };
}

// ===== main entry point =====

export function createOpenConnectContainerGeometry(options: OpenConnectContainerOptions): THREE.BufferGeometry {
  const shapeType = normalizeOpenConnectShapeType(options.shapeType);
  const internalWidth = normalizeOpenConnectDimension(options.internalWidth, DEFAULT_OPENCONNECT_INTERNAL_WIDTH);
  const internalDepth = normalizeOpenConnectDimension(options.internalDepth, DEFAULT_OPENCONNECT_INTERNAL_DEPTH);
  const wallThickness = normalizeOpenConnectWallThickness(options.wallThickness);
  const baseThickness = normalizeOpenConnectBaseThickness(options.baseThickness);
  const slotLockDistribution = normalizeSlotLockDistribution(options.slotLockDistribution);
  const slotPosition = normalizeSlotPosition(options.slotPosition);
  const cornerRounding = normalizeCornerRounding(options.cornerRounding);
  const cornerSize = clamp(wallThickness * 2, 3, 10);

  const positions: number[] = [];
  let outerMinX: number;
  let outerMaxX: number;
  let outerMinZ: number;
  let outerMaxZ: number;
  let totalHeight: number;
  let backWallMinX: number;
  let backWallMaxX: number;
  let backWallWidth: number;
  let backWallHeight: number;
  let backWallInnerZ: number;
  let backWallYStart: number;

  if (shapeType === "Shelf") {
    outerMinX = -wallThickness;
    outerMaxX = internalWidth + wallThickness;
    outerMinZ = 0;
    outerMaxZ = internalDepth + wallThickness;
    totalHeight = baseThickness + SHELF_BACK_HEIGHT;
    backWallYStart = baseThickness - WALL_OVERLAP;

    const baseOutline = cornerRounding !== "None" ? roundedRectOutline(outerMinX, outerMaxX, outerMinZ, outerMaxZ, cornerRounding, cornerSize) : null;
    appendAll(positions, (baseOutline ? extrudeXZFootprint(baseOutline, 0, baseThickness) : boxPositions(box(outerMinX, outerMaxX, 0, baseThickness, outerMinZ, outerMaxZ))));
    appendAll(positions, boxPositions(box(outerMinX, 0, baseThickness - WALL_OVERLAP, baseThickness + SHELF_LIP_HEIGHT, 0, SHELF_LIP_DEPTH))); // left lip
    appendAll(positions, boxPositions(box(internalWidth, outerMaxX, baseThickness - WALL_OVERLAP, baseThickness + SHELF_LIP_HEIGHT, 0, SHELF_LIP_DEPTH))); // right lip

    backWallMinX = outerMinX;
    backWallMaxX = outerMaxX;
    backWallWidth = internalWidth;
    backWallHeight = SHELF_BACK_HEIGHT;
    backWallInnerZ = internalDepth;
  } else {
    const internalHeight = normalizeOpenConnectDimension(options.internalHeight, DEFAULT_OPENCONNECT_INTERNAL_HEIGHT);
    const leftEnabled = normalizeOpenConnectWallEnabled(options.leftWallEnabled);
    const rightEnabled = normalizeOpenConnectWallEnabled(options.rightWallEnabled);
    const frontEnabled = normalizeOpenConnectWallEnabled(options.frontWallEnabled);
    const bottomEnabled = normalizeOpenConnectWallEnabled(options.bottomWallEnabled);

    // internalDepth is the clear cavity depth; an enabled front wall adds
    // its own thickness beyond that (not carved out of it), matching
    // openConnectContainerDimensions' depth formula.
    const frontOffset = frontEnabled ? wallThickness : 0;
    outerMinX = leftEnabled ? -wallThickness : 0;
    outerMaxX = rightEnabled ? internalWidth + wallThickness : internalWidth;
    outerMinZ = 0;
    outerMaxZ = frontOffset + internalDepth + wallThickness;
    totalHeight = (bottomEnabled ? baseThickness : 0) + internalHeight;

    // Side/front/back walls span the full Z depth (wrapping the front/back
    // corners) and, when the base is enabled, start slightly below
    // baseThickness (WALL_OVERLAP) so they genuinely overlap the base's
    // volume -- see WALL_OVERLAP's own comment for why an exact coincident
    // touch (not just "close") needs avoiding. With the base disabled
    // there's nothing below to overlap into, so the walls simply start at
    // their own true bottom (Y=0) instead.
    const wallYStart = bottomEnabled ? baseThickness - WALL_OVERLAP : 0;
    backWallYStart = wallYStart;
    const backFrontMinX = leftEnabled ? -WALL_OVERLAP : 0;
    const backFrontMaxX = rightEnabled ? internalWidth + WALL_OVERLAP : internalWidth;

    if (bottomEnabled) {
      const baseOutline = cornerRounding !== "None" ? roundedRectOutline(outerMinX, outerMaxX, outerMinZ, outerMaxZ, cornerRounding, cornerSize) : null;
      appendAll(positions, (baseOutline ? extrudeXZFootprint(baseOutline, 0, baseThickness) : boxPositions(box(outerMinX, outerMaxX, 0, baseThickness, outerMinZ, outerMaxZ)))); // base (always full footprint, for wall support)
    }
    if (leftEnabled) appendAll(positions, boxPositions(box(outerMinX, 0, wallYStart, totalHeight, 0, outerMaxZ)));
    if (rightEnabled) appendAll(positions, boxPositions(box(internalWidth, outerMaxX, wallYStart, totalHeight, 0, outerMaxZ)));
    if (frontEnabled) appendAll(positions, boxPositions(box(backFrontMinX, backFrontMaxX, wallYStart, totalHeight, 0, wallThickness)));

    backWallMinX = backFrontMinX;
    backWallMaxX = backFrontMaxX;
    backWallWidth = internalWidth;
    backWallHeight = internalHeight;
    backWallInnerZ = frontOffset + internalDepth;
  }

  appendAll(positions, buildBackWallPositions(backWallMinX, backWallMaxX, backWallYStart, totalHeight, backWallInnerZ, outerMaxZ, backWallWidth, backWallHeight, slotPosition, slotLockDistribution));

  // A handful of seams here are two independently-built pieces that happen
  // to share an exact boundary (e.g. corner rounding off -> the base's
  // outline exactly matches its side walls' own footprint) -- valid on
  // their own, but leaving an exactly-coincident, opposite-facing double
  // layer there (non-manifold by the strict edge-count-4 definition even
  // though there's no actual gap). weldCoincidentDoubleFaces only removes
  // EXACT matched pairs, so it's safe to always run. It returns a fresh
  // geometry with no normal attribute, so recompute.
  const welded = weldCoincidentDoubleFaces(geometryFromPositions(positions));
  welded.computeVertexNormals();
  return welded;
}
