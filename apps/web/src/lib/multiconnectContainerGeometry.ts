import * as THREE from "three";
import {
  MULTICONNECT_CHANNEL_OUTLINE,
  MULTICONNECT_HEAD_RADIUS,
  MULTICONNECT_SLOT_CUT_DEPTH,
  MULTICONNECT_TERMINATOR_CLIP_Y,
  MULTICONNECT_TERMINATOR_NO_DIMPLE_INDICES,
  MULTICONNECT_TERMINATOR_NO_DIMPLE_POSITIONS,
  MULTICONNECT_TERMINATOR_WITH_DIMPLE_INDICES,
  MULTICONNECT_TERMINATOR_WITH_DIMPLE_POSITIONS,
} from "@/lib/multiconnectSlotMesh";

// Multiconnect Container geometry -- phase 2: the Plate variant only (a
// slotted back panel; the Bin variant and any UI wiring come later).
// Reference: reference/multiconnect.scad's multiconnectBack module.
//
// TODO(attribution): reference/multiconnect.scad was provided without a
// license header. Identify the upstream Multiconnect project + license and
// credit it here (repo practice: CC-BY credit headers) before this ships.
//
// Construction is a boundary representation, never a runtime CSG boolean
// (three-bvh-csg is unreliable exactly where this shape needs cuts that
// reach the surface, and the manifold-3d kernel is async-loaded while this
// builder must stay synchronous for the shared viewport/editor geometry
// cache). Each slot is a "segment stack": the baked terminator mesh
// (multiconnectSlotMesh.ts -- revolved keyhole pocket + taper + lock
// dimple) provides the curved top, and a straight prism of
// MULTICONNECT_CHANNEL_OUTLINE continues from the terminator's clip plane
// down through the plate's bottom edge. The stitch works because phase 1
// guarantees the baked clip-plane vertices ARE the outline values verbatim,
// and every world coordinate here is produced by the one shared transform,
// so shared seams are bit-identical -- verified by the exact directed-edge
// test in tests/unit/multiconnectContainerGeometry.test.ts.
//
// World frame (matches the openConnect Container's convention): X = width
// [0, W], Y = height [0, H], Z = thickness [0, 6.5] with the container-side
// (front) face at Z=0 and the mounting face at Z=MOUNTING_FACE_Z. The slot
// is a BLIND cut: it opens on the mounting face and out the bottom edge,
// and the front face is emitted as one full uncut rectangle -- the "must
// not perforate" requirement holds by construction, since a boundary rep
// only has the holes it explicitly cuts. The baked blind-floor/crater
// triangulation is carried through verbatim (transform + winding reversal
// only, never re-derived).
//
// cornerRadius (default 0 = sharp) rounds all four plate corners with
// quarter-circle arcs in the 2D outline; the caps and perimeter walls all
// follow the rounded outline through the same earcut/quad path. The radius
// is clamped by maxCornerRadiusFor so no arc can reach slot geometry
// (exposed as multiconnectPlateDimensions().maxCornerRadius for the future
// UI). cornerRadius === 0 takes the exact construction the printed phase-2
// coupon verified, byte for byte.
//
// slotTolerance is applied as a PLANAR (across/slide) scale about each
// slot's round-top center, deliberately NOT scaling the through-wall depth
// axis. The SCAD scales all three axes and lets the oversized cutter
// overshoot the mounting face (the wall clips it); with a baked tool
// pre-trimmed at the mounting face, scaling depth would either unseal the
// bake's trim plane into the slab (scale > 1) or leave the mouth sealed
// under a skin (scale < 1). Keeping depth fixed preserves every
// from-the-mounting-face seating dimension exactly and only forgoes the
// SCAD's +/-7.5% scaling of the 1.2121mm head-recess depth (<=0.09mm) --
// the radial fit the tolerance knob exists for is scaled identically to
// the SCAD.

export const MULTICONNECT_BACK_THICKNESS = 6.5;
// Material kept between the blind floor and the front face (the SCAD's
// fixed 2.35mm skin; slotDepthMicroadjustment is pinned at 0).
export const MULTICONNECT_BLIND_FLOOR_Z = 2.35;
// One shared derived value for every mounting-face coordinate, so the cap
// plane and the transformed baked mouth rim can never disagree by a ULP.
const MOUNTING_FACE_Z = MULTICONNECT_BLIND_FLOOR_Z + MULTICONNECT_SLOT_CUT_DEPTH;

export const DEFAULT_MULTICONNECT_PLATE_WIDTH = 56;
export const DEFAULT_MULTICONNECT_PLATE_HEIGHT = 56;
// openGrid pitch per owner decision; the SCAD's Multiboard default is 25.
export const DEFAULT_MULTICONNECT_SLOT_SPACING = 28;
export const DEFAULT_MULTICONNECT_SLOT_TOLERANCE = 1;
// The SCAD's own floors: backHeight >= 25, backWidth >= distanceBetweenSlots
// (so at least one slot always fits) -- we also apply its 25 to width.
export const MIN_MULTICONNECT_PLATE_DIMENSION = 25;
export const MAX_MULTICONNECT_PLATE_DIMENSION = 560;
// The SCAD leaves spacing unbounded, but below ~24mm adjacent slots' head
// recesses (2 x 10.15 x max tolerance = 21.8mm wide) would merge and the
// notched-cap construction would self-intersect.
export const MIN_MULTICONNECT_SLOT_SPACING = 24;
export const MAX_MULTICONNECT_SLOT_SPACING = 200;
// The SCAD's slotTolerance customizer range.
export const MIN_MULTICONNECT_SLOT_TOLERANCE = 0.925;
export const MAX_MULTICONNECT_SLOT_TOLERANCE = 1.075;
// Round-top center sits this far below the plate's top edge (SCAD:
// backHeight - 13).
export const MULTICONNECT_SLOT_TOP_OFFSET = 13;
// Corner rounding: quarter-circle arcs on the plate outline. Segment count
// per corner, the minimum kept between a rounded corner's straight span and
// any slot keyhole's widest (head-radius) extent, and the threshold under
// which a requested radius snaps to a sharp corner (micro-arcs would only
// produce sliver walls).
export const MULTICONNECT_CORNER_SEGMENTS = 10;
export const MULTICONNECT_CORNER_SLOT_CLEARANCE = 0.5;
const MIN_EFFECTIVE_CORNER_RADIUS = 0.1;

export type MulticonnectPlateOptions = {
  width?: number;
  height?: number;
  slotSpacing?: number;
  slotQuickRelease?: boolean;
  slotTolerance?: number;
  cornerRadius?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

export function normalizeMulticonnectSlotSpacing(value?: number): number {
  return clamp(finiteOr(value, DEFAULT_MULTICONNECT_SLOT_SPACING), MIN_MULTICONNECT_SLOT_SPACING, MAX_MULTICONNECT_SLOT_SPACING);
}

export function normalizeMulticonnectSlotTolerance(value?: number): number {
  return clamp(finiteOr(value, DEFAULT_MULTICONNECT_SLOT_TOLERANCE), MIN_MULTICONNECT_SLOT_TOLERANCE, MAX_MULTICONNECT_SLOT_TOLERANCE);
}

export function normalizeMulticonnectPlateWidth(value: number | undefined, slotSpacing: number): number {
  const clamped = clamp(finiteOr(value, DEFAULT_MULTICONNECT_PLATE_WIDTH), MIN_MULTICONNECT_PLATE_DIMENSION, MAX_MULTICONNECT_PLATE_DIMENSION);
  return Math.max(clamped, slotSpacing);
}

export function normalizeMulticonnectPlateHeight(value?: number): number {
  return clamp(finiteOr(value, DEFAULT_MULTICONNECT_PLATE_HEIGHT), MIN_MULTICONNECT_PLATE_DIMENSION, MAX_MULTICONNECT_PLATE_DIMENSION);
}

// Largest corner radius that keeps every rounded corner clear of slot
// geometry: the corner arcs must not eat into the bottom edge's channel
// notches or the keyhole head recesses running beside them, so the radius
// stays inside the gap between each outer slot's widest extent and its
// nearest side edge (which also keeps the top corners clear of the slot
// domes -- same X separation, and the layout is why one bound covers all
// four corners). Also capped at half the smaller plate dimension, minus a
// hair so opposite arcs never collapse the straight span between them.
function maxCornerRadiusFor(width: number, height: number, centers: number[], tolerance: number): number {
  const headHalfWidth = MULTICONNECT_HEAD_RADIUS * tolerance;
  const slotClearance = Math.min(centers[0] - headHalfWidth, width - centers[centers.length - 1] - headHalfWidth) - MULTICONNECT_CORNER_SLOT_CLEARANCE;
  return Math.max(0, Math.min(Math.min(width, height) / 2 - 0.05, slotClearance));
}

export function multiconnectMaxCornerRadius(options: MulticonnectPlateOptions = {}): number {
  const slotSpacing = normalizeMulticonnectSlotSpacing(options.slotSpacing);
  const width = normalizeMulticonnectPlateWidth(options.width, slotSpacing);
  const height = normalizeMulticonnectPlateHeight(options.height);
  const tolerance = normalizeMulticonnectSlotTolerance(options.slotTolerance);
  return maxCornerRadiusFor(width, height, multiconnectSlotCenters(width, slotSpacing), tolerance);
}

export function normalizeMulticonnectCornerRadius(value: number | undefined, maxRadius: number): number {
  const radius = finiteOr(value, 0);
  if (radius < MIN_EFFECTIVE_CORNER_RADIUS) return 0;
  return Math.min(radius, maxRadius);
}

export function multiconnectPlateDimensions(options: MulticonnectPlateOptions) {
  const slotSpacing = normalizeMulticonnectSlotSpacing(options.slotSpacing);
  const width = normalizeMulticonnectPlateWidth(options.width, slotSpacing);
  const height = normalizeMulticonnectPlateHeight(options.height);
  const tolerance = normalizeMulticonnectSlotTolerance(options.slotTolerance);
  const maxCornerRadius = maxCornerRadiusFor(width, height, multiconnectSlotCenters(width, slotSpacing), tolerance);
  return {
    width,
    height,
    depth: MOUNTING_FACE_Z,
    maxCornerRadius,
    cornerRadius: normalizeMulticonnectCornerRadius(options.cornerRadius, maxCornerRadius),
  };
}

// SCAD slot centering: slotCount = floor(backWidth / spacing), first center
// at spacing/2 plus half the leftover fraction of a pitch (which centers
// the run on the plate).
export function multiconnectSlotCenters(width: number, slotSpacing: number): number[] {
  const count = Math.floor(width / slotSpacing);
  const first = slotSpacing / 2 + ((width / slotSpacing - count) * slotSpacing) / 2;
  return Array.from({ length: count }, (_, index) => first + index * slotSpacing);
}

// ===== baked terminator: split + mouth-rim extraction =====

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

type TerminatorData = {
  // Local triangle soup (across, slide, depth), cutter-outward winding,
  // with the mouth cap (depth === cut depth) and clip cap (slide === clip Y)
  // removed -- everything kept becomes hole-interior/blind-floor surface.
  keptSoup: number[];
  // Ordered mouth-rim polyline in (across, slide): the kept surface's exact
  // boundary on the mounting-face plane, from the clip-plane corner with
  // across < 0, up the neck edge, over the 50-gon semicircle, and back down
  // to the across > 0 clip corner. Used verbatim as the mounting-face cap's
  // notch boundary so no T-junction can exist along that seam.
  mouthRim: Point2[];
};

function buildTerminatorData(positions: readonly number[], indices: readonly number[]): TerminatorData {
  const keptSoup: number[] = [];
  const rimNeighbors = new Map<string, Point2[]>();
  const rimPoints = new Map<string, Point2>();
  const rimKey = ([across, slide]: Point2) => `${across},${slide}`;
  const addRimEdge = (a: Point2, b: Point2) => {
    rimPoints.set(rimKey(a), a);
    rimPoints.set(rimKey(b), b);
    rimNeighbors.set(rimKey(a), [...(rimNeighbors.get(rimKey(a)) ?? []), b]);
    rimNeighbors.set(rimKey(b), [...(rimNeighbors.get(rimKey(b)) ?? []), a]);
  };

  for (let i = 0; i + 2 < indices.length; i += 3) {
    const vertices: Point3[] = [0, 1, 2].map((corner) => {
      const offset = indices[i + corner] * 3;
      return [positions[offset], positions[offset + 1], positions[offset + 2]] as const;
    });
    // Baked coordinates are 1e-4-quantized at bake time, so cap membership
    // is exact equality, not a tolerance band.
    const isMouthCap = vertices.every((vertex) => vertex[2] === MULTICONNECT_SLOT_CUT_DEPTH);
    const isClipCap = vertices.every((vertex) => vertex[1] === MULTICONNECT_TERMINATOR_CLIP_Y);
    if (isMouthCap || isClipCap) continue;
    for (const vertex of vertices) keptSoup.push(vertex[0], vertex[1], vertex[2]);
    for (let edge = 0; edge < 3; edge += 1) {
      const a = vertices[edge];
      const b = vertices[(edge + 1) % 3];
      if (a[2] === MULTICONNECT_SLOT_CUT_DEPTH && b[2] === MULTICONNECT_SLOT_CUT_DEPTH) {
        addRimEdge([a[0], a[1]], [b[0], b[1]]);
      }
    }
  }

  const endpoints = [...rimNeighbors.entries()].filter(([, neighbors]) => neighbors.length === 1);
  if (endpoints.length !== 2) {
    throw new Error(`multiconnect terminator mouth rim is not a simple open chain (${endpoints.length} endpoints)`);
  }
  const startKey = endpoints.map(([key]) => key).sort((a, b) => (rimPoints.get(a)![0] < rimPoints.get(b)![0] ? -1 : 1))[0];
  const mouthRim: Point2[] = [rimPoints.get(startKey)!];
  const visited = new Set<string>([startKey]);
  for (;;) {
    const current = mouthRim[mouthRim.length - 1];
    const next = (rimNeighbors.get(rimKey(current)) ?? []).find((candidate) => !visited.has(rimKey(candidate)));
    if (!next) break;
    visited.add(rimKey(next));
    mouthRim.push(next);
  }
  if (mouthRim.length !== rimPoints.size) {
    throw new Error("multiconnect terminator mouth rim did not chain into a single polyline");
  }
  return { keptSoup, mouthRim };
}

let terminatorWithDimple: TerminatorData | null = null;
let terminatorNoDimple: TerminatorData | null = null;

function terminatorData(quickRelease: boolean): TerminatorData {
  if (quickRelease) {
    terminatorNoDimple ??= buildTerminatorData(MULTICONNECT_TERMINATOR_NO_DIMPLE_POSITIONS, MULTICONNECT_TERMINATOR_NO_DIMPLE_INDICES);
    return terminatorNoDimple;
  }
  terminatorWithDimple ??= buildTerminatorData(MULTICONNECT_TERMINATOR_WITH_DIMPLE_POSITIONS, MULTICONNECT_TERMINATOR_WITH_DIMPLE_INDICES);
  return terminatorWithDimple;
}

// ===== triangle emission helpers =====

function pushTriangle(out: number[], a: Point3, b: Point3, c: Point3) {
  out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
}

function triangleNormal(a: Point3, b: Point3, c: Point3): [number, number, number] {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

// Triangulates a simple (possibly notched, hole-free) planar contour and
// emits it wound so its normal points along desiredNormal. Winding is
// decided from the contour's own signed area rather than per-earcut-triangle
// normals, so degenerate slivers can't flip individual faces.
function pushCap(out: number[], contour: Point2[], to3D: (point: Point2) => Point3, desiredNormal: Point3) {
  const triangles = THREE.ShapeUtils.triangulateShape(contour.map(([u, v]) => new THREE.Vector2(u, v)), []);
  let flip: boolean | null = null;
  for (const [i0, i1, i2] of triangles) {
    const a = to3D(contour[i0]);
    const b = to3D(contour[i1]);
    const c = to3D(contour[i2]);
    if (flip === null) {
      const normal = triangleNormal(a, b, c);
      const dot = normal[0] * desiredNormal[0] + normal[1] * desiredNormal[1] + normal[2] * desiredNormal[2];
      if (dot === 0) continue; // degenerate first triangle -- decide on the next one
      flip = dot < 0;
    }
    if (flip) pushTriangle(out, a, c, b);
    else pushTriangle(out, a, b, c);
  }
}

function pushRectangleCap(out: number[], corners: [Point3, Point3, Point3, Point3], desiredNormal: Point3) {
  const [a, b, c, d] = corners;
  const normal = triangleNormal(a, b, c);
  const dot = normal[0] * desiredNormal[0] + normal[1] * desiredNormal[1] + normal[2] * desiredNormal[2];
  if (dot < 0) {
    pushTriangle(out, a, c, b);
    pushTriangle(out, a, d, c);
  } else {
    pushTriangle(out, a, b, c);
    pushTriangle(out, a, c, d);
  }
}

// ===== main entry point =====

export function multiconnectPlatePositions(options: MulticonnectPlateOptions = {}): number[] {
  const slotSpacing = normalizeMulticonnectSlotSpacing(options.slotSpacing);
  const width = normalizeMulticonnectPlateWidth(options.width, slotSpacing);
  const height = normalizeMulticonnectPlateHeight(options.height);
  const tolerance = normalizeMulticonnectSlotTolerance(options.slotTolerance);
  const quickRelease = options.slotQuickRelease === true;

  const topCenterY = height - MULTICONNECT_SLOT_TOP_OFFSET;
  const centers = multiconnectSlotCenters(width, slotSpacing);
  const cornerRadius = normalizeMulticonnectCornerRadius(options.cornerRadius, maxCornerRadiusFor(width, height, centers, tolerance));
  const { keptSoup, mouthRim } = terminatorData(quickRelease);

  // THE shared transform: every slot-derived world coordinate -- baked
  // vertices, prism walls, cap notch boundaries -- goes through these exact
  // expressions so shared seam vertices are bit-identical.
  const worldX = (cx: number, across: number) => cx + across * tolerance;
  const worldY = (slide: number) => topCenterY + slide * tolerance;
  const worldZ = (depth: number) => MULTICONNECT_BLIND_FLOOR_Z + depth;

  const positions: number[] = [];
  const notchOrder = [3, 2, 1, 0, 7, 6, 5, 4];
  const pushMountingNotches = (contour: Point2[]) => {
    for (const cx of centers) {
      const stripLeftX = worldX(cx, mouthRim[0][0]);
      const stripRightX = worldX(cx, mouthRim[mouthRim.length - 1][0]);
      contour.push([stripLeftX, 0]);
      for (const [across, slide] of mouthRim) contour.push([worldX(cx, across), worldY(slide)]);
      contour.push([stripRightX, 0]);
    }
  };
  const pushBottomNotches = (contour: Point2[]) => {
    for (const cx of [...centers].reverse()) {
      for (const outlineIndex of notchOrder) {
        const [across, depth] = MULTICONNECT_CHANNEL_OUTLINE[outlineIndex];
        contour.push([worldX(cx, across), worldZ(depth)]);
      }
    }
  };

  if (cornerRadius === 0) {
    // Front (container-side) face: one full uncut rectangle at Z=0 -- the
    // blind guarantee. Nothing else in this builder emits geometry at Z < the
    // blind floor plane.
    pushRectangleCap(positions, [[0, 0, 0], [width, 0, 0], [width, height, 0], [0, height, 0]], [0, 0, -1]);
    // Top edge and both side edges are never reached by slot geometry (the
    // dome stays >= ~2.1mm below the top edge, and slot centers stay
    // >= spacing/2 >= 12mm from the sides while the widest scaled head is
    // 10.91mm): full rectangles.
    pushRectangleCap(positions, [[0, height, 0], [width, height, 0], [width, height, MOUNTING_FACE_Z], [0, height, MOUNTING_FACE_Z]], [0, 1, 0]);
    pushRectangleCap(positions, [[0, 0, 0], [0, height, 0], [0, height, MOUNTING_FACE_Z], [0, 0, MOUNTING_FACE_Z]], [-1, 0, 0]);
    pushRectangleCap(positions, [[width, 0, 0], [width, height, 0], [width, height, MOUNTING_FACE_Z], [width, 0, MOUNTING_FACE_Z]], [1, 0, 0]);

    // Mounting face (Z = MOUNTING_FACE_Z): rectangle with one notch per slot
    // opening through the bottom edge -- straight strip sides matching the
    // channel prism's neck walls, closed over the top by the baked mouth rim
    // polyline (whose first/last points ARE the strip corners at the clip
    // plane, so the strip side edge is split there exactly like the
    // neighboring surfaces expect).
    const mountingContour: Point2[] = [[0, 0]];
    pushMountingNotches(mountingContour);
    mountingContour.push([width, 0], [width, height], [0, height]);
    pushCap(positions, mountingContour, ([x, y]) => [x, y, MOUNTING_FACE_Z], [0, 0, 1]);

    // Bottom edge (Y = 0): rectangle with one keyhole notch per slot opening
    // through its mounting-face edge. Traversed along Z = MOUNTING_FACE_Z from
    // x = width back to 0, diving around each channel cross-section
    // (MULTICONNECT_CHANNEL_OUTLINE indices 3..0 then 7..4 -- everything
    // except the open neck-top edge).
    const bottomContour: Point2[] = [[0, 0], [width, 0], [width, MOUNTING_FACE_Z]];
    pushBottomNotches(bottomContour);
    bottomContour.push([0, MOUNTING_FACE_Z]);
    pushCap(positions, bottomContour, ([x, z]) => [x, 0, z], [0, -1, 0]);
  } else {
    // Rounded corners: the plate outline becomes a rounded rectangle (CCW,
    // starting at the bottom edge's left end). Arc interior points come from
    // the angle parametrization, but every arc ENDPOINT is pushed as the
    // exact straight-edge coordinate -- Math.cos(PI/2) is 6e-17, not 0, and
    // a corner seam off by an ULP would fail the exact directed-edge
    // stitching contract. maxCornerRadiusFor keeps every arc clear of slot
    // geometry, so the notch walks are unchanged from the sharp path.
    const outline: Point2[] = [[cornerRadius, 0], [width - cornerRadius, 0]];
    const pushArc = (centerX: number, centerY: number, startAngle: number, endPoint: Point2 | null) => {
      for (let step = 1; step < MULTICONNECT_CORNER_SEGMENTS; step += 1) {
        const angle = startAngle + (step * (Math.PI / 2)) / MULTICONNECT_CORNER_SEGMENTS;
        outline.push([centerX + cornerRadius * Math.cos(angle), centerY + cornerRadius * Math.sin(angle)]);
      }
      if (endPoint) outline.push(endPoint);
    };
    pushArc(width - cornerRadius, cornerRadius, -Math.PI / 2, [width, cornerRadius]);
    outline.push([width, height - cornerRadius]);
    pushArc(width - cornerRadius, height - cornerRadius, 0, [width - cornerRadius, height]);
    outline.push([cornerRadius, height]);
    pushArc(cornerRadius, height - cornerRadius, Math.PI / 2, [0, height - cornerRadius]);
    outline.push([0, cornerRadius]);
    pushArc(cornerRadius, cornerRadius, Math.PI, null); // closes back to outline[0]

    // Front face: the full uncut rounded outline -- still the blind
    // guarantee by construction.
    pushCap(positions, outline, ([x, y]) => [x, y, 0], [0, 0, -1]);

    // Mounting face: the rounded outline with the slot notches spliced into
    // its bottom edge (outline[0] -> outline[1]).
    const mountingContour: Point2[] = [outline[0]];
    pushMountingNotches(mountingContour);
    for (let i = 1; i < outline.length; i += 1) mountingContour.push(outline[i]);
    pushCap(positions, mountingContour, ([x, y]) => [x, y, MOUNTING_FACE_Z], [0, 0, 1]);

    // Bottom face: now spans only the straight run between the two bottom
    // arcs, reusing the outline's own endpoint doubles for the seam.
    const bottomContour: Point2[] = [[outline[0][0], 0], [outline[1][0], 0], [outline[1][0], MOUNTING_FACE_Z]];
    pushBottomNotches(bottomContour);
    bottomContour.push([outline[0][0], MOUNTING_FACE_Z]);
    pushCap(positions, bottomContour, ([x, z]) => [x, 0, z], [0, -1, 0]);

    // Perimeter walls: one quad per outline edge except the bottom edge
    // (edge 0), whose surface is the notched bottom face above. For the CCW
    // outline the outward direction is the edge direction rotated -90deg.
    for (let i = 1; i < outline.length; i += 1) {
      const p = outline[i];
      const q = outline[(i + 1) % outline.length];
      const p0: Point3 = [p[0], p[1], 0];
      const p1: Point3 = [q[0], q[1], 0];
      const p2: Point3 = [q[0], q[1], MOUNTING_FACE_Z];
      const p3: Point3 = [p[0], p[1], MOUNTING_FACE_Z];
      const outward: Point3 = [q[1] - p[1], -(q[0] - p[0]), 0];
      const normal = triangleNormal(p0, p1, p2);
      const dot = normal[0] * outward[0] + normal[1] * outward[1] + normal[2] * outward[2];
      if (dot < 0) {
        pushTriangle(positions, p0, p2, p1);
        pushTriangle(positions, p0, p3, p2);
      } else {
        pushTriangle(positions, p0, p1, p2);
        pushTriangle(positions, p0, p2, p3);
      }
    }
  }

  // Per-slot interior surfaces.
  for (const cx of centers) {
    // Baked terminator: transform + reverse winding (cutter-outward becomes
    // hole-inward / blind-floor-outward). The blind floor and crater
    // triangulation pass through verbatim.
    for (let i = 0; i + 8 < keptSoup.length; i += 9) {
      const vertex = (offset: number): Point3 => [
        worldX(cx, keptSoup[i + offset]),
        worldY(keptSoup[i + offset + 1]),
        worldZ(keptSoup[i + offset + 2]),
      ];
      pushTriangle(positions, vertex(0), vertex(6), vertex(3));
    }

    // Straight channel prism from the terminator clip plane down through the
    // bottom edge: one wall per outline edge except the neck-top edge
    // (outline index 3 -> 4), which lies in the open mounting face. The
    // closing edge (index 7 -> 0) is the channel's blind floor.
    const yTop = worldY(MULTICONNECT_TERMINATOR_CLIP_Y);
    for (let edge = 0; edge < MULTICONNECT_CHANNEL_OUTLINE.length; edge += 1) {
      if (edge === 3) continue;
      const [pAcross, pDepth] = MULTICONNECT_CHANNEL_OUTLINE[edge];
      const [qAcross, qDepth] = MULTICONNECT_CHANNEL_OUTLINE[(edge + 1) % MULTICONNECT_CHANNEL_OUTLINE.length];
      const p0: Point3 = [worldX(cx, pAcross), yTop, worldZ(pDepth)];
      const p1: Point3 = [worldX(cx, qAcross), yTop, worldZ(qDepth)];
      const p2: Point3 = [worldX(cx, qAcross), 0, worldZ(qDepth)];
      const p3: Point3 = [worldX(cx, pAcross), 0, worldZ(pDepth)];
      // Wall normal must point into the void: for the CCW outline, that is
      // the interior side, i.e. the edge direction rotated +90deg in
      // (across, depth).
      const inward: Point3 = [-(qDepth - pDepth) * tolerance, 0, (qAcross - pAcross) * tolerance];
      const normal = triangleNormal(p0, p1, p2);
      const dot = normal[0] * inward[0] + normal[1] * inward[1] + normal[2] * inward[2];
      if (dot < 0) {
        pushTriangle(positions, p0, p2, p1);
        pushTriangle(positions, p0, p3, p2);
      } else {
        pushTriangle(positions, p0, p1, p2);
        pushTriangle(positions, p0, p2, p3);
      }
    }
  }

  return positions;
}

export function createMulticonnectPlateGeometry(options: MulticonnectPlateOptions = {}): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(multiconnectPlatePositions(options), 3));
  geometry.computeVertexNormals();
  return geometry;
}
