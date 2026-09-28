import * as THREE from "three";
import {
  GRIDFINITY_FOOT_HEIGHT,
  GRIDFINITY_FOOT_TOP_RADIUS,
  gridfinityFootDimensions,
  gridfinityFootPositions,
} from "@/lib/gridfinityFootGeometry";
import {
  LABEL_BAND_BOTTOM,
  LABEL_BAND_TOP,
  LABEL_CHARACTERS,
  LABEL_DEPTH,
  labelOutline,
  type LabelGlyphOutline,
  type LabelStyle,
} from "@/lib/labelSlabGeometry";
import { SOCKET_TRAY_FILLET_SEGMENTS, SOCKET_TRAY_POCKET_SEGMENTS } from "@/lib/socketTrayGeometry";

// Gridfinity Socket Tray -- the fifth tray shape: a Gridfinity-footed block
// sized in whole Gridfinity squares, with round BLIND holes the sockets sit
// in and a text label in front of each hole. Built to the owner's answers
// and the foreman's calls recorded in reference/DECISIONS.md (2026-09-27).
// No stacking lip, no magnet pockets, no auto-layout.
//
// Three earlier modules are imported from and none is edited:
//
// - gridfinityFootGeometry.ts supplies the feet, the underside between them
//   and the body's outer wall. Its foot was printed and checked in the
//   owner's baseplate. This module calls it for the whole solid below the
//   top face and takes the plain top cap off (bodyBelowTop), so the feet
//   here ARE that module's feet, not a copy of its numbers.
// - labelSlabGeometry.ts supplies the label outlines (Helvetiker bold, the
//   digit set 5mm tall, 0.8mm raised or recessed) and the character set the
//   printed label test piece vetted.
// - socketTrayGeometry.ts supplies the hole and fillet resolution constants.
//
// Construction is a boundary representation, never a runtime CSG boolean
// (CLAUDE-LESSONS.md). The top face is one earcut cap notched with every
// hole's rim and every glyph's outer contour; the hole walls, hole floors,
// glyph walls and glyph caps are separate triangles that reuse the SAME
// point objects the notches were cut with, so every seam is bit-identical
// doubles by construction (the exact-stitch contract). The top face's outer
// contour is the foot module's own plate outline, read back out of the
// triangles that module emitted.
//
// World frame: the tray sits on the bed on its feet. X = width
// [0, 42 * squaresX - 0.5], Y = up (feet 0 to 4.75, body above), Z = depth
// [0, 42 * squaresZ - 0.5].
//
// VIEWER AND FRONT EDGE. The labels give this tray one reading direction,
// so unlike the other flat trays it has a front. The viewer stands on the
// +Z side looking along -Z, which is where the editor's home camera and a
// slicer's front view both stand: +X is on their right, so hole x needs no
// mirror, and the edge nearest them is Z = depth. Hole z is typed from that
// FRONT edge and is turned into geometry space at exactly one marked spot
// (normalizedHoles: z_geometry = depth - z_typed). Text reads along +X and
// its "up the page" direction is -Z, the same as labelSlabGeometry.ts, so a
// label sits between its hole and the front edge and reads upright from the
// front.

// Hole depth, measured down from the top face. Fixed, not typed.
export const GRIDFINITY_SOCKET_TRAY_HOLE_DEPTH = 14;
// Material kept between a hole's floor and the body's underside (the plane
// of the foot tops). Fixed, not typed.
export const GRIDFINITY_SOCKET_TRAY_FLOOR_THICKNESS = 4;
// The body above the feet: floor plus hole depth.
export const GRIDFINITY_SOCKET_TRAY_BODY_THICKNESS = GRIDFINITY_SOCKET_TRAY_FLOOR_THICKNESS + GRIDFINITY_SOCKET_TRAY_HOLE_DEPTH;
// Height of the top face above the bed: 4.75 + 18 = 22.75, exact in float64.
export const GRIDFINITY_SOCKET_TRAY_BODY_HEIGHT = GRIDFINITY_FOOT_HEIGHT + GRIDFINITY_SOCKET_TRAY_BODY_THICKNESS;

// Minimum distance from a hole's rim or a label to the tray's edge.
export const GRIDFINITY_SOCKET_TRAY_EDGE_CLEARANCE = 4;
// Minimum distance between two holes' rims, between a label and any hole,
// and between two labels. Also the distance a label is placed from its own
// hole.
export const GRIDFINITY_SOCKET_TRAY_GAP = 3;

// The tray must fit the Bambu X1C's bed.
export const GRIDFINITY_SOCKET_TRAY_BED_SIZE = 256;
// The largest square count along one axis that fits it: 6 squares are
// 251.5mm, 7 would be 293.5mm.
export const MAX_GRIDFINITY_SOCKET_TRAY_SQUARES = 6;

export const DEFAULT_GRIDFINITY_SOCKET_TRAY_SQUARES_X = 3;
export const DEFAULT_GRIDFINITY_SOCKET_TRAY_SQUARES_Z = 2;
export const DEFAULT_GRIDFINITY_SOCKET_TRAY_CORNER_RADIUS = 0;
export const DEFAULT_GRIDFINITY_SOCKET_TRAY_LABEL_STYLE: LabelStyle = "raised";

// Slack allowed on a clearance comparison. Label positions are derived
// (hole centre, plus radius, plus gap, plus the font's own extents), so a
// label or hole sitting exactly on its limit can come out a few ULPs short
// of it; this keeps "exactly on the limit" valid without letting anything
// measurable through.
const CLEARANCE_TOLERANCE = 1e-9;

export type GridfinitySocketTrayHole = {
  // Finished hole diameter, mm.
  diameter: number;
  // Hole centre: x from the tray's LEFT edge, z from its FRONT edge (the
  // edge nearest the viewer -- see file header).
  x: number;
  z: number;
  // Label text. Blank or missing: this hole gets no label.
  label?: string;
};

export type GridfinitySocketTrayOptions = {
  // Tray size in Gridfinity squares.
  squaresX?: number;
  squaresZ?: number;
  // Owner-typed fillet radius on every hole's top edge and the tray's top
  // perimeter. 0 (default) = sharp.
  cornerRadius?: number;
  // One setting for every label on the tray.
  labelStyle?: LabelStyle;
  holes?: GridfinitySocketTrayHole[];
};

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

function finiteOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

export function normalizeGridfinitySocketTraySquares(value: number | undefined, axis: "squaresX" | "squaresZ"): number {
  const squares = finiteOr(value, axis === "squaresX" ? DEFAULT_GRIDFINITY_SOCKET_TRAY_SQUARES_X : DEFAULT_GRIDFINITY_SOCKET_TRAY_SQUARES_Z);
  if (!Number.isInteger(squares) || squares < 1) {
    throw new Error(`gridfinity socket tray ${axis} must be a whole number of squares, 1 or more (got ${squares})`);
  }
  return squares;
}

export function normalizeGridfinitySocketTrayCornerRadius(value?: number): number {
  const radius = finiteOr(value, DEFAULT_GRIDFINITY_SOCKET_TRAY_CORNER_RADIUS);
  if (radius < 0) throw new Error(`gridfinity socket tray corner radius must be zero or positive (got ${radius})`);
  return radius;
}

export function normalizeGridfinitySocketTrayLabelStyle(value?: LabelStyle): LabelStyle {
  if (value === undefined) return DEFAULT_GRIDFINITY_SOCKET_TRAY_LABEL_STYLE;
  if (value !== "raised" && value !== "recessed") throw new Error(`gridfinity socket tray label style must be "raised" or "recessed" (got ${String(value)})`);
  return value;
}

function hasLabel(hole: GridfinitySocketTrayHole): boolean {
  return typeof hole.label === "string" && hole.label.length > 0;
}

export type GridfinitySocketTrayDimensions = {
  squaresX: number;
  squaresZ: number;
  // Overall size: width along X, depth along Z.
  width: number;
  depth: number;
  // Height of the top face above the bed.
  bodyHeight: number;
  // Overall height: the top face, plus the labels where they are raised.
  height: number;
};

// Size only -- validates the square counts and the bed fit, not the hole
// layout.
export function gridfinitySocketTrayDimensions(options: GridfinitySocketTrayOptions = {}): GridfinitySocketTrayDimensions {
  const squaresX = normalizeGridfinitySocketTraySquares(options.squaresX, "squaresX");
  const squaresZ = normalizeGridfinitySocketTraySquares(options.squaresZ, "squaresZ");
  const { width, depth } = gridfinityFootDimensions({ squaresX, squaresZ, plateThickness: GRIDFINITY_SOCKET_TRAY_BODY_THICKNESS });
  if (width > GRIDFINITY_SOCKET_TRAY_BED_SIZE) {
    throw new Error(`gridfinity socket tray is ${squaresX} squares wide (${width}mm), which does not fit the ${GRIDFINITY_SOCKET_TRAY_BED_SIZE}mm bed`);
  }
  if (depth > GRIDFINITY_SOCKET_TRAY_BED_SIZE) {
    throw new Error(`gridfinity socket tray is ${squaresZ} squares deep (${depth}mm), which does not fit the ${GRIDFINITY_SOCKET_TRAY_BED_SIZE}mm bed`);
  }
  const labelStyle = normalizeGridfinitySocketTrayLabelStyle(options.labelStyle);
  const raised = labelStyle === "raised" && (options.holes ?? []).some(hasLabel);
  return {
    squaresX,
    squaresZ,
    width,
    depth,
    bodyHeight: GRIDFINITY_SOCKET_TRAY_BODY_HEIGHT,
    height: raised ? GRIDFINITY_SOCKET_TRAY_BODY_HEIGHT + LABEL_DEPTH : GRIDFINITY_SOCKET_TRAY_BODY_HEIGHT,
  };
}

export type GridfinitySocketTrayPlacedHole = {
  // Hole centre in GEOMETRY space.
  x: number;
  z: number;
  radius: number;
  // Radius of the opening at the top face: radius + cornerRadius.
  rimRadius: number;
};

export type GridfinitySocketTrayPlacedLabel = {
  // Index of the hole this label belongs to.
  hole: number;
  text: string;
  // The rectangle the label occupies on the top face, geometry space: its
  // ink across, and the 5mm digit band front to back. This is what the
  // guards measure.
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  // Where the label's baseline lies.
  baselineZ: number;
  // The label's outlines as placed: [x, z] geometry space.
  glyphs: LabelGlyphOutline[];
};

export type GridfinitySocketTrayLayout = GridfinitySocketTrayDimensions & {
  cornerRadius: number;
  labelStyle: LabelStyle;
  holes: GridfinitySocketTrayPlacedHole[];
  labels: GridfinitySocketTrayPlacedLabel[];
};

// Validates the caller-provided hole layout the way every tray in this
// family does: positions are explicit (no auto-layout), so a bad layout
// throws rather than being nudged or dropped.
function normalizedHoles(holes: GridfinitySocketTrayHole[], width: number, depth: number, cornerRadius: number): GridfinitySocketTrayPlacedHole[] {
  const edge = GRIDFINITY_SOCKET_TRAY_EDGE_CLEARANCE;
  const gap = GRIDFINITY_SOCKET_TRAY_GAP;
  const placed: GridfinitySocketTrayPlacedHole[] = [];
  holes.forEach((hole, index) => {
    const { diameter, x, z } = hole;
    if (![diameter, x, z].every(Number.isFinite) || diameter <= 0) {
      throw new Error(`gridfinity socket tray hole ${index}: diameter/x/z must be finite and the diameter positive`);
    }
    const radius = diameter / 2;
    // ===== THE front-edge mirror. Hole z is typed from the FRONT edge (the
    // edge nearest the viewer, Z = depth); geometry z runs from the far
    // edge. Nowhere else in this module converts between the two. x needs
    // no mirror -- see file header. =====
    const geometryZ = depth - z;
    const tooNearEdge = (reach: number) =>
      x - reach < edge - CLEARANCE_TOLERANCE ||
      x + reach > width - edge + CLEARANCE_TOLERANCE ||
      geometryZ - reach < edge - CLEARANCE_TOLERANCE ||
      geometryZ + reach > depth - edge + CLEARANCE_TOLERANCE;
    if (tooNearEdge(radius)) {
      throw new Error(`gridfinity socket tray hole ${index}: footprint (r=${radius}mm) is within ${edge}mm of the tray edge`);
    }
    const rimRadius = radius + cornerRadius;
    if (tooNearEdge(rimRadius)) {
      throw new Error(`gridfinity socket tray corner radius ${cornerRadius}mm widens hole ${index} (diameter ${diameter}mm) to within ${edge}mm of the tray edge`);
    }
    placed.push({ x, z: geometryZ, radius, rimRadius });
  });
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const distance = Math.hypot(placed[i].x - placed[j].x, placed[i].z - placed[j].z);
      if (distance < placed[i].radius + placed[j].radius + gap - CLEARANCE_TOLERANCE) {
        throw new Error(`gridfinity socket tray holes ${i} and ${j}: footprints overlap or leave too thin a wall (centers ${distance.toFixed(2)}mm apart)`);
      }
      if (distance < placed[i].rimRadius + placed[j].rimRadius + gap - CLEARANCE_TOLERANCE) {
        throw new Error(`gridfinity socket tray corner radius ${cornerRadius}mm widens hole ${i} too close to hole ${j} (centers ${distance.toFixed(2)}mm apart)`);
      }
    }
  }
  return placed;
}

// Distance from a rectangle to a point; 0 when the point is inside it.
function rectanglePointDistance(label: GridfinitySocketTrayPlacedLabel, x: number, z: number): number {
  const dx = Math.max(label.minX - x, 0, x - label.maxX);
  const dz = Math.max(label.minZ - z, 0, z - label.maxZ);
  return Math.hypot(dx, dz);
}

// Distance between two rectangles; 0 when they touch or overlap.
function rectangleDistance(a: GridfinitySocketTrayPlacedLabel, b: GridfinitySocketTrayPlacedLabel): number {
  const dx = Math.max(a.minX - b.maxX, 0, b.minX - a.maxX);
  const dz = Math.max(a.minZ - b.maxZ, 0, b.minZ - a.maxZ);
  return Math.hypot(dx, dz);
}

// Places each label and checks it. A label is centred on its hole across
// the tray and sits GRIDFINITY_SOCKET_TRAY_GAP in front of the hole's rim;
// that is the only place it can be, so a label that does not fit throws --
// nothing is moved.
function placedLabels(holes: GridfinitySocketTrayHole[], placedHoles: GridfinitySocketTrayPlacedHole[], width: number, depth: number): GridfinitySocketTrayPlacedLabel[] {
  const edge = GRIDFINITY_SOCKET_TRAY_EDGE_CLEARANCE;
  const gap = GRIDFINITY_SOCKET_TRAY_GAP;
  const labels: GridfinitySocketTrayPlacedLabel[] = [];
  holes.forEach((hole, index) => {
    if (!hasLabel(hole)) return;
    const text = hole.label as string;
    for (const character of text) {
      if (!LABEL_CHARACTERS.includes(character)) {
        throw new Error(`gridfinity socket tray label ${index}: "${text}" contains "${character}"; only the characters ${LABEL_CHARACTERS} are supported`);
      }
    }
    const outline = labelOutline(text);
    const placedHole = placedHoles[index];
    const originX = placedHole.x - (outline.minX + outline.maxX) / 2;
    // The top of the digit band (as read) sits one gap in front of the rim.
    const bandTopZ = placedHole.z + placedHole.rimRadius + gap;
    const baselineZ = bandTopZ + LABEL_BAND_TOP;
    const place = (loop: readonly (readonly [number, number])[]): Point2[] => loop.map(([x, y]) => [originX + x, baselineZ - y] as const);
    labels.push({
      hole: index,
      text,
      minX: originX + outline.minX,
      maxX: originX + outline.maxX,
      minZ: bandTopZ,
      maxZ: baselineZ - LABEL_BAND_BOTTOM,
      baselineZ,
      glyphs: outline.glyphs.map((glyph) => ({ outer: place(glyph.outer), holes: glyph.holes.map(place) })),
    });
  });

  for (const label of labels) {
    if (
      label.minX < edge - CLEARANCE_TOLERANCE ||
      label.maxX > width - edge + CLEARANCE_TOLERANCE ||
      label.minZ < edge - CLEARANCE_TOLERANCE ||
      label.maxZ > depth - edge + CLEARANCE_TOLERANCE
    ) {
      throw new Error(`gridfinity socket tray label ${label.hole} ("${label.text}") is within ${edge}mm of the tray edge`);
    }
    placedHoles.forEach((other, otherIndex) => {
      // Its own hole is one gap away by construction.
      if (otherIndex === label.hole) return;
      if (rectanglePointDistance(label, other.x, other.z) - other.rimRadius < gap - CLEARANCE_TOLERANCE) {
        throw new Error(`gridfinity socket tray label ${label.hole} ("${label.text}") is within ${gap}mm of hole ${otherIndex}`);
      }
    });
  }
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      if (rectangleDistance(labels[i], labels[j]) < gap - CLEARANCE_TOLERANCE) {
        throw new Error(`gridfinity socket tray labels ${labels[i].hole} and ${labels[j].hole} ("${labels[i].text}" and "${labels[j].text}") are within ${gap}mm of each other`);
      }
    }
  }
  return labels;
}

// The whole layout, validated: every guard in this module fires from here.
export function gridfinitySocketTrayLayout(options: GridfinitySocketTrayOptions = {}): GridfinitySocketTrayLayout {
  const dimensions = gridfinitySocketTrayDimensions(options);
  const cornerRadius = normalizeGridfinitySocketTrayCornerRadius(options.cornerRadius);
  const labelStyle = normalizeGridfinitySocketTrayLabelStyle(options.labelStyle);
  // The perimeter fillet shrinks the body's plan corner arcs by the same
  // amount it insets the top face; at the plan corner radius they would
  // vanish. That also keeps the fillet shorter than the hole depth.
  if (cornerRadius >= GRIDFINITY_FOOT_TOP_RADIUS) {
    throw new Error(`gridfinity socket tray corner radius ${cornerRadius}mm is too large: it must stay below the tray's own ${GRIDFINITY_FOOT_TOP_RADIUS}mm plan corner radius`);
  }
  const holes = options.holes ?? [];
  const placedHoles = normalizedHoles(holes, dimensions.width, dimensions.depth, cornerRadius);
  const labels = placedLabels(holes, placedHoles, dimensions.width, dimensions.depth);
  return { ...dimensions, cornerRadius, labelStyle, holes: placedHoles, labels };
}

// ===== triangle emission helpers (same technique as the trays' and
// labelSlabGeometry.ts's pushTriangle/triangleNormal/pushCap/
// pushRectangleCap/pushLoopWall -- reimplemented here rather than imported,
// matching the one-primitive-per-file convention) =====

function pushTriangle(out: number[], a: Point3, b: Point3, c: Point3) {
  out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
}

function triangleNormal(a: Point3, b: Point3, c: Point3): Point3 {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

function planArea2(a: Point2, b: Point2, c: Point2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
}

// Makes an earcut triangulation CONFORMING: no triangle edge may pass
// through a contour point without stopping at it (CLAUDE-LESSONS.md,
// 2026-09-27). Two things put contour points on one line here: the glyphs
// of a label stand on one baseline, and the top face's own outline carries
// several points along each straight side, where the feet and the strips
// between them meet the wall below. Zero-area triangles are dropped, then
// any triangle is split at each point lying exactly on one of its edges.
// No coordinate is computed; every vertex is still one of the caller's own
// points.
function conformTriangles(triangles: number[][], points: Point2[]): number[][] {
  const pending = triangles.filter(([i0, i1, i2]) => planArea2(points[i0], points[i1], points[i2]) !== 0).reverse();
  const conforming: number[][] = [];
  while (pending.length > 0) {
    const triangle = pending.pop() as number[];
    let split = false;
    for (let edge = 0; edge < 3 && !split; edge += 1) {
      const ia = triangle[edge];
      const ib = triangle[(edge + 1) % 3];
      const ic = triangle[(edge + 2) % 3];
      const a = points[ia];
      const b = points[ib];
      const lengthSquared = (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]);
      for (let ip = 0; ip < points.length; ip += 1) {
        if (ip === ia || ip === ib || ip === ic) continue;
        const p = points[ip];
        if (planArea2(a, b, p) !== 0) continue;
        const along = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]);
        if (along <= 0 || along >= lengthSquared) continue;
        // Second half first, so the halves come back off the stack in
        // their original order.
        pending.push([ip, ib, ic], [ia, ip, ic]);
        split = true;
        break;
      }
    }
    if (!split) conforming.push(triangle);
  }
  return conforming;
}

// Triangulates a simple (possibly holed) planar contour and emits it wound
// so its normal points along desiredNormal, deciding winding from the first
// triangle rather than trusting the contour's own point order.
function pushCap(out: number[], contour: Point2[], to3D: (point: Point2) => Point3, desiredNormal: Point3, holes: Point2[][] = []) {
  const allPoints = holes.length > 0 ? contour.concat(...holes) : contour;
  const triangles = conformTriangles(
    THREE.ShapeUtils.triangulateShape(
      contour.map(([u, v]) => new THREE.Vector2(u, v)),
      holes.map((hole) => hole.map(([u, v]) => new THREE.Vector2(u, v))),
    ),
    allPoints,
  );
  let flip: boolean | null = null;
  for (const [i0, i1, i2] of triangles) {
    const a = to3D(allPoints[i0]);
    const b = to3D(allPoints[i1]);
    const c = to3D(allPoints[i2]);
    if (flip === null) {
      const normal = triangleNormal(a, b, c);
      const dot = normal[0] * desiredNormal[0] + normal[1] * desiredNormal[1] + normal[2] * desiredNormal[2];
      if (dot === 0) continue;
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

// Twice the signed area of a loop in the (x, z) plan; its sign tells which
// side of each edge the loop's interior is on.
function signedArea2(loop: Point2[]): number {
  let sum = 0;
  for (let index = 0; index < loop.length; index += 1) {
    const [ax, az] = loop[index];
    const [bx, bz] = loop[(index + 1) % loop.length];
    sum += ax * bz - bx * az;
  }
  return sum;
}

// A vertical wall standing on a closed loop between two heights, reusing
// the loop's own points at both heights. `facing` says which way the wall's
// surface looks relative to the area the loop encloses.
function pushLoopWall(out: number[], loop: Point2[], yLow: number, yHigh: number, facing: "outward" | "inward") {
  const orientation = (signedArea2(loop) > 0 ? 1 : -1) * (facing === "outward" ? 1 : -1);
  for (let index = 0; index < loop.length; index += 1) {
    const [ax, az] = loop[index];
    const [bx, bz] = loop[(index + 1) % loop.length];
    pushRectangleCap(
      out,
      [
        [ax, yLow, az],
        [bx, yLow, bz],
        [bx, yHigh, bz],
        [ax, yHigh, az],
      ],
      [orientation * (bz - az), 0, -orientation * (bx - ax)],
    );
  }
}

// ===== the body below the top face, from the foot module =====

type BodyBelowTop = {
  // Feet, the underside between them and the outer wall -- every triangle
  // the foot module emitted except its plain top cap.
  positions: number[];
  // The wall's top edge, walked once around: the contour the top face (or
  // the perimeter fillet) continues from. These are the foot module's own
  // doubles.
  outline: Point2[];
  // Height of that edge above the bed.
  y: number;
};

// The foot module builds feet under a plain flat plate. Here the plate is
// the tray's body, so its plain top cap is taken off and replaced by this
// module's own top face. The cap is the fan the foot module emits last --
// one triangle per outline edge, every one starting at the same centre
// point -- and the outline is read back out of it, so the wall below and
// the top face above meet on the same doubles. If the foot module ever
// emitted something else, this throws rather than guessing.
function bodyBelowTop(squaresX: number, squaresZ: number, wallThickness: number): BodyBelowTop {
  const all = gridfinityFootPositions({ squaresX, squaresZ, plateThickness: wallThickness });
  let topY = Number.NEGATIVE_INFINITY;
  for (let index = 1; index < all.length; index += 3) topY = Math.max(topY, all[index]);
  let start = all.length;
  while (start >= 9 && all[start - 8] === topY && all[start - 5] === topY && all[start - 2] === topY) start -= 9;
  const count = (all.length - start) / 9;
  const unexpected = () => new Error("gridfinity socket tray: the foot module's plate top is not the fan this module reads its outline from");
  if (count < 3) throw unexpected();
  const vertex = (triangle: number, corner: number): Point2 => [all[start + triangle * 9 + corner * 3], all[start + triangle * 9 + corner * 3 + 2]];
  const same = (a: Point2, b: Point2) => a[0] === b[0] && a[1] === b[1];
  const apex = vertex(0, 0);
  // Each fan triangle is (centre, loop[i], loop[i + 1]) or, wound the other
  // way, (centre, loop[i + 1], loop[i]); the point two neighbouring
  // triangles share tells which.
  const forward = same(vertex(0, 2), vertex(1, 1));
  const first = forward ? 1 : 2;
  const second = forward ? 2 : 1;
  const outline: Point2[] = [];
  for (let triangle = 0; triangle < count; triangle += 1) {
    if (!same(vertex(triangle, 0), apex)) throw unexpected();
    if (!same(vertex(triangle, second), vertex((triangle + 1) % count, first))) throw unexpected();
    outline.push(vertex(triangle, first));
  }
  return { positions: all.slice(0, start), outline, y: topY };
}

// The outline moved inward by `inset`: straight sides move square to
// themselves and each corner arc keeps its centre and loses `inset` of
// radius. Every point on one side gets that side's ONE coordinate, so the
// side stays exactly straight.
function insetOutline(outline: Point2[], inset: number, width: number, depth: number): Point2[] {
  const radius = GRIDFINITY_FOOT_TOP_RADIUS;
  const lowX = inset;
  const highX = width - inset;
  const lowZ = inset;
  const highZ = depth - inset;
  const scale = (radius - inset) / radius;
  return outline.map(([x, z]) => {
    const onX = x === 0 || x === width;
    const onZ = z === 0 || z === depth;
    if (onX || onZ) return [x === 0 ? lowX : x === width ? highX : x, z === 0 ? lowZ : z === depth ? highZ : z] as const;
    const centreX = x < width / 2 ? radius : width - radius;
    const centreZ = z < depth / 2 ? radius : depth - radius;
    return [centreX + (x - centreX) * scale, centreZ + (z - centreZ) * scale] as const;
  });
}

// theta runs [pi/2, pi] across a fillet, as in socketTrayGeometry.ts. Only
// ever called for interior points; the two ends are pushed as exact values.
function filletTheta(k: number, segments: number): number {
  return Math.PI / 2 + (k * (Math.PI / 2)) / segments;
}

const HOLE_ANGLES = Array.from({ length: SOCKET_TRAY_POCKET_SEGMENTS }, (_, index) => (2 * Math.PI * index) / SOCKET_TRAY_POCKET_SEGMENTS);

// ===== main entry point =====

export function gridfinitySocketTrayPositions(options: GridfinitySocketTrayOptions = {}): number[] {
  const { squaresX, squaresZ, width, depth, cornerRadius, labelStyle, holes, labels } = gridfinitySocketTrayLayout(options);
  const K = SOCKET_TRAY_FILLET_SEGMENTS;
  const up: Point3 = [0, 1, 0];

  // Feet, underside and outer wall. With a Corner Radius the wall stops one
  // radius short of the top face and the perimeter fillet carries on.
  const body = bodyBelowTop(squaresX, squaresZ, GRIDFINITY_SOCKET_TRAY_BODY_THICKNESS - cornerRadius);
  const positions = body.positions;
  const topY = cornerRadius === 0 ? body.y : GRIDFINITY_SOCKET_TRAY_BODY_HEIGHT;
  const at = (y: number) => (point: Point2): Point3 => [point[0], y, point[1]];

  // Perimeter fillet: K bands from the wall's top edge (ring K, the foot
  // module's own outline) in and up to the top face's edge (ring 0).
  let topContour = body.outline;
  if (cornerRadius > 0) {
    const rings: Array<{ y: number; loop: Point2[] }> = [];
    for (let k = 0; k <= K; k += 1) {
      if (k === K) rings.push({ y: body.y, loop: body.outline });
      else if (k === 0) rings.push({ y: topY, loop: insetOutline(body.outline, cornerRadius, width, depth) });
      else {
        const theta = filletTheta(k, K);
        rings.push({ y: topY - cornerRadius * (1 - Math.sin(theta)), loop: insetOutline(body.outline, cornerRadius * (1 + Math.cos(theta)), width, depth) });
      }
    }
    for (let k = 0; k < K; k += 1) {
      const high = rings[k];
      const low = rings[k + 1];
      const thetaMid = filletTheta(k + 0.5, K);
      for (let index = 0; index < high.loop.length; index += 1) {
        const next = (index + 1) % high.loop.length;
        const a: Point3 = [high.loop[index][0], high.y, high.loop[index][1]];
        const b: Point3 = [high.loop[next][0], high.y, high.loop[next][1]];
        const c: Point3 = [low.loop[next][0], low.y, low.loop[next][1]];
        const d: Point3 = [low.loop[index][0], low.y, low.loop[index][1]];
        // Away from the tray's centre and upward. Only the sign of the dot
        // product is used, so the direction need not be exact.
        const awayX = (a[0] + b[0] + c[0] + d[0]) / 4 - width / 2;
        const awayZ = (a[2] + b[2] + c[2] + d[2]) / 4 - depth / 2;
        pushRectangleCap(positions, [a, b, c, d], [awayX * -Math.cos(thetaMid), Math.sin(thetaMid), awayZ * -Math.cos(thetaMid)]);
      }
    }
    topContour = rings[0].loop;
  }

  // Each hole's rings, built once. With cornerRadius === 0 there is one ring
  // (the rim); otherwise rings[0] is the WIDENED rim at the top face and
  // rings[K] the nominal-radius ring one cornerRadius below it, from which
  // the straight wall runs down to the floor.
  const floorY = topY - GRIDFINITY_SOCKET_TRAY_HOLE_DEPTH;
  const holeBuilds = holes.map((hole) => {
    const ring = (radius: number): Point2[] => HOLE_ANGLES.map((angle) => [hole.x + radius * Math.cos(angle), hole.z + radius * Math.sin(angle)] as const);
    const nominal = ring(hole.radius);
    if (cornerRadius === 0) return { rings: [{ y: topY, loop: nominal }], nominal };
    const rings: Array<{ y: number; loop: Point2[] }> = [];
    for (let k = 0; k <= K; k += 1) {
      if (k === 0) rings.push({ y: topY, loop: ring(hole.rimRadius) });
      else if (k === K) rings.push({ y: topY - cornerRadius, loop: nominal });
      else {
        const theta = filletTheta(k, K);
        rings.push({ y: topY - cornerRadius * (1 - Math.sin(theta)), loop: ring(hole.radius + cornerRadius * (1 + Math.cos(theta))) });
      }
    }
    return { rings, nominal };
  });

  // Top face: the only face a hole or a label ever opens through. One cap,
  // notched with every hole's rim and every glyph's outer contour.
  pushCap(positions, topContour, at(topY), up, [...holeBuilds.map(({ rings }) => rings[0].loop), ...labels.flatMap((label) => label.glyphs.map((glyph) => glyph.outer))]);

  // Hole interiors: rim fillet, straight wall, flat floor.
  for (const { rings, nominal } of holeBuilds) {
    const segments = SOCKET_TRAY_POCKET_SEGMENTS;
    for (let k = 0; k + 1 < rings.length; k += 1) {
      const high = rings[k];
      const low = rings[k + 1];
      const thetaMid = filletTheta(k + 0.5, K);
      for (let i = 0; i < segments; i += 1) {
        const j = (i + 1) % segments;
        const midAngle = (2 * Math.PI * (i + 0.5)) / segments;
        pushRectangleCap(
          positions,
          [
            [high.loop[i][0], high.y, high.loop[i][1]],
            [high.loop[j][0], high.y, high.loop[j][1]],
            [low.loop[j][0], low.y, low.loop[j][1]],
            [low.loop[i][0], low.y, low.loop[i][1]],
          ],
          [Math.cos(thetaMid) * Math.cos(midAngle), Math.sin(thetaMid), Math.cos(thetaMid) * Math.sin(midAngle)],
        );
      }
    }
    const wallTopY = rings[rings.length - 1].y;
    for (let i = 0; i < segments; i += 1) {
      const j = (i + 1) % segments;
      const midAngle = (2 * Math.PI * (i + 0.5)) / segments;
      // The wall faces into the void, toward the hole's own axis.
      pushRectangleCap(
        positions,
        [
          [nominal[i][0], wallTopY, nominal[i][1]],
          [nominal[j][0], wallTopY, nominal[j][1]],
          [nominal[j][0], floorY, nominal[j][1]],
          [nominal[i][0], floorY, nominal[i][1]],
        ],
        [-Math.cos(midAngle), 0, -Math.sin(midAngle)],
      );
    }
    pushCap(positions, nominal, at(floorY), up);
  }

  // Labels, exactly as labelSlabGeometry.ts builds them.
  for (const label of labels) {
    for (const glyph of label.glyphs) {
      if (labelStyle === "raised") {
        // Walls run UP from the notch; the glyph's face sits proud of the
        // top face; each counter re-exposes a floor at top-face level.
        const faceY = topY + LABEL_DEPTH;
        pushLoopWall(positions, glyph.outer, topY, faceY, "outward");
        pushCap(positions, glyph.outer, at(faceY), up, glyph.holes);
        for (const counter of glyph.holes) {
          pushLoopWall(positions, counter, topY, faceY, "inward");
          pushCap(positions, counter, at(topY), up);
        }
      } else {
        // Walls run DOWN from the notch to the groove's floor; each counter
        // is an island standing back up to top-face level.
        const grooveY = topY - LABEL_DEPTH;
        pushLoopWall(positions, glyph.outer, grooveY, topY, "inward");
        pushCap(positions, glyph.outer, at(grooveY), up, glyph.holes);
        for (const counter of glyph.holes) {
          pushLoopWall(positions, counter, grooveY, topY, "outward");
          pushCap(positions, counter, at(topY), up);
        }
      }
    }
  }

  return positions;
}

export function createGridfinitySocketTrayGeometry(options: GridfinitySocketTrayOptions = {}): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(gridfinitySocketTrayPositions(options), 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
