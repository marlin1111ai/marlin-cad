import * as THREE from "three";
import {
  SOCKET_TRAY_FILLET_SEGMENTS,
  SOCKET_TRAY_POCKET_EDGE_CLEARANCE,
  SOCKET_TRAY_POCKET_GAP,
  SOCKET_TRAY_POCKET_SEGMENTS,
} from "@/lib/socketTrayGeometry";

// Screwdriver Tray -- a flat block with a row of round THROUGH-HOLES. The
// hanging sibling of the flat Socket Tray: a screwdriver's shaft passes all
// the way through the hole and its handle rests on the top face, so there is
// no floor under a hole and no pocket depth to type.
//
// This is a NEW primitive, additive only. It does not modify, wrap or
// re-export socketTrayGeometry.ts (frozen: it is the validated shape and its
// coupon is print-gated). What IS shared with it is imported, never
// copy-pasted -- the hole-layout guard constants and the two resolution
// constants above -- so "the same rule the socket tray uses" is literally the
// same constant, not a duplicated number that can drift. The triangle
// emission helpers below are reimplemented rather than imported, matching the
// precedent mountedSocketTrayGeometry.ts set (that module restates the same
// four helpers); there is no shared cut-a-round-hole helper module in this
// codebase.
//
// Construction is a boundary representation, never a runtime CSG boolean --
// see CLAUDE-LESSONS.md: three-bvh-csg is unreliable exactly where a cut
// reaches a surface, and a through-hole reaches TWO. Every hole is cut by
// notching BOTH the top face's and the bottom face's outline with the hole's
// own rim contour, and building the hole's interior (one cylindrical wall,
// top face to bottom face) as separate triangles that reuse the SAME
// rim/bottom-ring point objects the two notches meet at, so both seams are
// bit-identical doubles by construction (the exact-stitch contract in
// CLAUDE-LESSONS.md) rather than something that has to line up by luck. A
// round hole needs no baked terminator mesh -- the rim is a plain
// parametrized circle -- so this file has no companion mesh data file.
//
// ===== WHAT DIFFERS FROM THE SOCKET TRAY =====
//
// The Socket Tray's pocket is a BLIND cavity: rim ring notched into the top
// face, cylindrical wall, and a flat floor cap over solid material. Here:
//
// - There is no floor cap. That is the only triangle emission the socket
//   tray has and this file does not.
// - The wall spans the full tray thickness (top face to Y = 0) instead of
//   stopping at a floor plane.
// - The BOTTOM face is notched with the same holes the top face is. On the
//   socket tray the bottom face is a plain uncut rectangle by construction;
//   here it is an earcut cap with one hole per bore, exactly the way the top
//   face already worked.
// - There is no depth anywhere: no per-hole depth, no shared depth option,
//   and none of the socket tray's floor-thickness or depth-vs-radius guards.
//   A hole is Diameter / X / Z and nothing else.
//
// World frame: identical to the socket tray's. This tray sits flat on a
// table/bed (it is not wall-mounted like Multiconnect), so there is no
// as-mounted-view mirror to apply -- x is plain left-to-right geometry space
// and matches what a user looking down at the tray from above sees directly.
// X = width [0, width] (left-right), Y = thickness [0, thickness] (up,
// matches this app's Y-up scene convention), Z = depth [0, depth]
// (front-back). The top face is at Y = thickness and the bottom face at
// Y = 0; a hole opens through both of them and through nothing else -- the
// four side walls are always emitted as plain uncut rectangles, guaranteed by
// the edge-clearance guard below.

export const DEFAULT_SCREWDRIVER_TRAY_WIDTH = 240;
export const DEFAULT_SCREWDRIVER_TRAY_DEPTH = 60;
export const DEFAULT_SCREWDRIVER_TRAY_THICKNESS = 18;

// Minimum tray thickness. Owner's decision, and this module's replacement for
// the role MIN_SOCKET_TRAY_FLOOR_THICKNESS plays on the socket trays: that
// constant guards the material left UNDER a blind pocket, which does not
// exist here, so it is deliberately not imported. What a through-hole needs
// instead is enough bore length to hold a screwdriver shaft upright -- a
// 2mm-thick tray would make a valid mesh and a useless part. 10mm.
export const MIN_SCREWDRIVER_TRAY_THICKNESS = 10;

// Corner Radius -- an owner-typed fillet (never a chamfer) applied to (a) the
// tray's own outer top perimeter (all four top/side/end edges, where the top
// face meets each side wall) and (b) every hole's TOP rim, where its wall
// meets the top face. Default 0 = sharp.
//
// The BOTTOM rim of a through-hole is deliberately left SHARP (owner's
// decision; see reference/reports/screwdriver-tray-recon.md section 4,
// option A). That matches what both socket trays already do with their own
// bottom edges -- the flat tray's bottom face is a full uncut rectangle at
// any radius, and the mounted tray's two bottom corners are explicitly
// excluded from rounding -- and it keeps the first printed layer's edges the
// same shape every physically validated part in this repo has. There is
// therefore no bottom fillet code in this file at all: the bottom face is
// notched with each hole's NOMINAL radius.
//
// Technique for the two fillets that do exist: the same mitered quarter-arc
// the socket tray and the Multiconnect peg fillet use (extra points inserted
// along a quarter-circle arc between two tangent points, each additional
// point becoming one more ring/band of triangles, normals resolved by the
// dot-product-against-a-desired-direction flip every builder here uses):
//
// - Outer top edge: a CONVEX fillet (rounds an outside corner, removing
//   material). At tray height Y, for Y in [thickness - cornerRadius,
//   thickness], the footprint is the tray rectangle inset by
//   `cornerRadius * (1 + cos(theta))` on all four sides, theta running from
//   pi/2 (Y = thickness, inset = cornerRadius, flush with the now-smaller top
//   cap) to pi (Y = thickness - cornerRadius, inset = 0, flush with the
//   ordinary side wall below it). The four vertical corners are a straight
//   miter between adjacent sides -- a swept edge fillet, not a rounded box.
// - Hole top rim: the mechanical mirror, a CONCAVE fillet (eases the
//   opening, widening it slightly right at the top face). For the same Y
//   range the hole's open radius is `hole.radius + cornerRadius * (1 +
//   cos(theta))`, from `hole.radius + cornerRadius` at the top face down to
//   the hole's own nominal radius one cornerRadius below it, where it
//   continues as the ordinary straight wall all the way to Y = 0.
//
// Both arcs are pushed as EXACT literal endpoints, per CLAUDE-LESSONS.md's
// exact-stitch entry: trig does not land exactly on an arc endpoint, so only
// the interior points come from the parametrization.
export const DEFAULT_SCREWDRIVER_TRAY_CORNER_RADIUS = 0;

export type ScrewdriverTrayHole = {
  // Finished bore diameter, mm (the owner types the measured shaft diameter
  // plus their own clearance; no screwdriver-size lookup happens anywhere,
  // matching how the Socket Tray's diameters work).
  diameter: number;
  // Hole center, geometry space (no view-space mirror -- see file header).
  x: number;
  z: number;
};

export type ScrewdriverTrayOptions = {
  width?: number;
  depth?: number;
  thickness?: number;
  // Owner-typed fillet radius, applied to the outer top perimeter and every
  // hole's TOP rim only. 0 (default) = sharp.
  cornerRadius?: number;
  holes?: ScrewdriverTrayHole[];
};

function finiteOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

export function normalizeScrewdriverTrayWidth(value?: number): number {
  const width = finiteOr(value, DEFAULT_SCREWDRIVER_TRAY_WIDTH);
  if (width <= 0) throw new Error(`screwdriver tray width must be positive (got ${width})`);
  return width;
}

export function normalizeScrewdriverTrayDepth(value?: number): number {
  const depth = finiteOr(value, DEFAULT_SCREWDRIVER_TRAY_DEPTH);
  if (depth <= 0) throw new Error(`screwdriver tray depth must be positive (got ${depth})`);
  return depth;
}

// Unlike the socket tray's "must be positive", this enforces the module's own
// 10mm minimum bore length. Thrown rather than clamped, matching the style of
// every other layout guard in this family.
export function normalizeScrewdriverTrayThickness(value?: number): number {
  const thickness = finiteOr(value, DEFAULT_SCREWDRIVER_TRAY_THICKNESS);
  if (thickness < MIN_SCREWDRIVER_TRAY_THICKNESS) {
    throw new Error(`screwdriver tray thickness ${thickness}mm is below the ${MIN_SCREWDRIVER_TRAY_THICKNESS}mm minimum`);
  }
  return thickness;
}

export function screwdriverTrayDimensions(options: ScrewdriverTrayOptions = {}) {
  return {
    width: normalizeScrewdriverTrayWidth(options.width),
    depth: normalizeScrewdriverTrayDepth(options.depth),
    thickness: normalizeScrewdriverTrayThickness(options.thickness),
  };
}

// Zero or positive only -- unlike width/depth/thickness there is no "must be
// positive" guard here, since 0 (sharp) is the default, valid state.
export function normalizeScrewdriverTrayCornerRadius(value?: number): number {
  const radius = finiteOr(value, DEFAULT_SCREWDRIVER_TRAY_CORNER_RADIUS);
  if (radius < 0) throw new Error(`screwdriver tray corner radius must be zero or positive (got ${radius})`);
  return radius;
}

type NormalizedHole = { x: number; z: number; radius: number };

// Validates the caller-provided hole layout the same way the socket tray's
// normalizedPockets does, against the SAME imported constants: positions are
// explicit (no auto-layout), so a bad layout is a caller bug and this throws
// rather than silently dropping or nudging holes. There is no depth to check
// and no floor to protect -- the socket tray's floor-thickness guard has no
// analogue here.
function normalizedHoles(holes: ScrewdriverTrayHole[], width: number, depth: number): NormalizedHole[] {
  const result: NormalizedHole[] = [];
  holes.forEach((hole, index) => {
    const { diameter, x, z } = hole;
    if (![diameter, x, z].every(Number.isFinite) || diameter <= 0) {
      throw new Error(`screwdriver tray hole ${index}: diameter/x/z must be finite and the diameter positive`);
    }
    const radius = diameter / 2;
    if (
      x - radius < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      x + radius > width - SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      z - radius < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      z + radius > depth - SOCKET_TRAY_POCKET_EDGE_CLEARANCE
    ) {
      throw new Error(`screwdriver tray hole ${index}: footprint (r=${radius}mm) is within ${SOCKET_TRAY_POCKET_EDGE_CLEARANCE}mm of the tray edge`);
    }
    result.push({ x, z, radius });
  });
  for (let i = 0; i < result.length; i += 1) {
    for (let j = i + 1; j < result.length; j += 1) {
      const distance = Math.hypot(result[i].x - result[j].x, result[i].z - result[j].z);
      if (distance < result[i].radius + result[j].radius + SOCKET_TRAY_POCKET_GAP) {
        throw new Error(`screwdriver tray holes ${i} and ${j}: footprints overlap or leave too thin a wall (centers ${distance.toFixed(2)}mm apart)`);
      }
    }
  }
  return result;
}

// Validates the fillet against the tray's own footprint/thickness and every
// hole's effective (widened-by-the-fillet) footprint. Note what is NOT here:
// the socket tray carries a per-pocket `cornerRadius >= pocket.depth` check,
// because its fillet has to leave straight wall above a floor plane. A
// through-hole's wall length IS the tray thickness, so that check collapses
// into the tray-thickness check below and does not need a per-hole form.
function validateScrewdriverTrayCornerRadius(cornerRadius: number, width: number, depth: number, thickness: number, holes: NormalizedHole[]) {
  if (cornerRadius === 0) return;
  const smallestFootprint = Math.min(width, depth);
  if (2 * cornerRadius >= smallestFootprint) {
    throw new Error(`screwdriver tray corner radius ${cornerRadius}mm is too large for the tray's ${smallestFootprint}mm smallest footprint dimension`);
  }
  // Covers both the outer top edge and every hole's top rim: one cornerRadius
  // of arc has to fit above Y = 0 with straight wall left below it. The
  // bottom rim is sharp, so it consumes none.
  if (cornerRadius >= thickness) {
    throw new Error(`screwdriver tray corner radius ${cornerRadius}mm leaves no straight wall below it at tray thickness ${thickness}mm`);
  }
  holes.forEach((hole, index) => {
    // The rim fillet widens the hole's opening at the top face from
    // hole.radius to hole.radius + cornerRadius -- re-check the same
    // edge-clearance and pairwise-gap guards normalizedHoles already enforced
    // for the nominal radius, this time for the widened one, since a fillet
    // with no room to widen into is exactly "radius too large relative to the
    // hole diameter."
    const widened = hole.radius + cornerRadius;
    if (
      hole.x - widened < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      hole.x + widened > width - SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      hole.z - widened < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      hole.z + widened > depth - SOCKET_TRAY_POCKET_EDGE_CLEARANCE
    ) {
      throw new Error(
        `screwdriver tray corner radius ${cornerRadius}mm widens hole ${index} (diameter ${hole.radius * 2}mm) to within ${SOCKET_TRAY_POCKET_EDGE_CLEARANCE}mm of the tray edge`,
      );
    }
    for (let j = 0; j < holes.length; j += 1) {
      if (j === index) continue;
      const distance = Math.hypot(hole.x - holes[j].x, hole.z - holes[j].z);
      if (distance < widened + holes[j].radius + cornerRadius + SOCKET_TRAY_POCKET_GAP) {
        throw new Error(
          `screwdriver tray corner radius ${cornerRadius}mm widens hole ${index} (diameter ${hole.radius * 2}mm) too close to hole ${j} (centers ${distance.toFixed(2)}mm apart)`,
        );
      }
    }
  });
}

// ===== triangle emission helpers (the same four the socket tray and the
// mounted socket tray each define; reimplemented here rather than imported,
// matching that precedent -- there is no shared helper module) =====

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

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

// Triangulates a simple (possibly holed) planar contour and emits it wound so
// its normal points along desiredNormal, deciding winding from the first
// non-degenerate triangle rather than trusting the contour's own point order.
// This is what lets the top and bottom faces share one contour/hole point
// order and still come out wound in opposite directions.
function pushCap(out: number[], contour: Point2[], to3D: (point: Point2) => Point3, desiredNormal: Point3, holes: Point2[][] = []) {
  const triangles = THREE.ShapeUtils.triangulateShape(
    contour.map(([u, v]) => new THREE.Vector2(u, v)),
    holes.map((hole) => hole.map(([u, v]) => new THREE.Vector2(u, v))),
  );
  const allPoints = holes.length > 0 ? contour.concat(...holes) : contour;
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

const HOLE_ANGLES = Array.from({ length: SOCKET_TRAY_POCKET_SEGMENTS }, (_, index) => (2 * Math.PI * index) / SOCKET_TRAY_POCKET_SEGMENTS);

// ===== main entry point =====

// theta runs [pi/2, pi] for both fillet families in this file. At the
// endpoints, cos/sin do not land on exact 0/1/-1 in float64
// (CLAUDE-LESSONS.md: "trig does not land exactly"), so every ring at k=0 or
// k=SEGMENTS is pushed with hand-written literal coordinates below; this
// helper is only ever called for the interior points, k=1..SEGMENTS-1.
function filletTheta(k: number, segments: number): number {
  return Math.PI / 2 + (k * (Math.PI / 2)) / segments;
}

export function screwdriverTrayPositions(options: ScrewdriverTrayOptions = {}): number[] {
  const width = normalizeScrewdriverTrayWidth(options.width);
  const depth = normalizeScrewdriverTrayDepth(options.depth);
  const thickness = normalizeScrewdriverTrayThickness(options.thickness);
  const cornerRadius = normalizeScrewdriverTrayCornerRadius(options.cornerRadius);
  const holes = normalizedHoles(options.holes ?? [], width, depth);
  validateScrewdriverTrayCornerRadius(cornerRadius, width, depth, thickness, holes);

  const topY = thickness;
  const positions: number[] = [];
  const K = SOCKET_TRAY_FILLET_SEGMENTS;

  // Precompute each hole's rings once. `bottomRing` sits on the bottom face
  // at Y = 0 (the socket tray's equivalent ring sits on a floor plane part
  // way down and is capped off; here it is a real opening). With
  // cornerRadius === 0 the hole is two rings, rim and bottom, and one wall
  // band between them. With cornerRadius > 0, `rings[0]` is a WIDENED ring
  // (radius + cornerRadius) at the top face -- the concave fillet eases the
  // opening -- and `rings[K]` is the ordinary nominal-radius ring one
  // cornerRadius below the top, from which the straight wall continues all
  // the way down to bottomRing.
  //
  // The SAME Point3 objects feed the top cap's hole contour, the fillet
  // band's rings, the wall, and the bottom cap's hole contour, so every seam
  // is bit-identical by construction (the exact-stitch contract).
  const holeBuilds = holes.map((hole) => {
    const bottomRing: Point3[] = HOLE_ANGLES.map((angle) => [hole.x + hole.radius * Math.cos(angle), 0, hole.z + hole.radius * Math.sin(angle)]);
    if (cornerRadius === 0) {
      const rim: Point3[] = HOLE_ANGLES.map((angle) => [hole.x + hole.radius * Math.cos(angle), topY, hole.z + hole.radius * Math.sin(angle)]);
      return { rings: [rim], bottomRing };
    }
    const rings: Point3[][] = [];
    for (let k = 0; k <= K; k += 1) {
      let radius: number;
      let y: number;
      if (k === 0) {
        radius = hole.radius + cornerRadius;
        y = topY;
      } else if (k === K) {
        radius = hole.radius;
        y = topY - cornerRadius;
      } else {
        const theta = filletTheta(k, K);
        radius = hole.radius + cornerRadius * (1 + Math.cos(theta));
        y = topY - cornerRadius * (1 - Math.sin(theta));
      }
      rings.push(HOLE_ANGLES.map((angle) => [hole.x + radius * Math.cos(angle), y, hole.z + radius * Math.sin(angle)]));
    }
    return { rings, bottomRing };
  });
  // Top notches use the (possibly widened) rim ring; bottom notches always
  // use the nominal-radius bottom ring, because the bottom rim is sharp.
  const topHoles: Point2[][] = holeBuilds.map(({ rings }) => rings[0].map(([x, , z]) => [x, z]));
  const bottomHoles: Point2[][] = holeBuilds.map(({ bottomRing }) => bottomRing.map(([x, , z]) => [x, z]));

  // The bottom face's outline is the full tray rectangle at every corner
  // radius (the outer bottom edges are sharp), in the same point order the
  // top face uses -- pushCap resolves the winding from desiredNormal, so one
  // order serves both faces.
  const footprintContour: Point2[] = [
    [0, 0],
    [width, 0],
    [width, depth],
    [0, depth],
  ];

  if (cornerRadius === 0) {
    // ===== unrounded construction =====

    // Top face (Y = topY). Full rectangle when there are no holes; otherwise
    // notched with each hole's exact rim contour as an earcut hole.
    if (topHoles.length === 0) {
      pushRectangleCap(positions, [[0, topY, 0], [width, topY, 0], [width, topY, depth], [0, topY, depth]], [0, 1, 0]);
    } else {
      pushCap(positions, footprintContour, ([x, z]) => [x, topY, z], [0, 1, 0], topHoles);
    }

    // Bottom face (Y = 0). THE DIFFERENCE FROM THE SOCKET TRAY: notched with
    // the same holes, since every bore opens through it. The no-holes branch
    // is the socket tray's plain rectangle, kept so a bare tray stays two
    // triangles on this face.
    if (bottomHoles.length === 0) {
      pushRectangleCap(positions, [[0, 0, 0], [0, 0, depth], [width, 0, depth], [width, 0, 0]], [0, -1, 0]);
    } else {
      pushCap(positions, footprintContour, ([x, z]) => [x, 0, z], [0, -1, 0], bottomHoles);
    }

    // Four side walls: plain rectangles -- normalizedHoles' edge-clearance
    // check guarantees no hole ever reaches an outer edge.
    pushRectangleCap(positions, [[0, 0, 0], [width, 0, 0], [width, topY, 0], [0, topY, 0]], [0, 0, -1]); // front, Z=0
    pushRectangleCap(positions, [[width, 0, depth], [0, 0, depth], [0, topY, depth], [width, topY, depth]], [0, 0, 1]); // back, Z=depth
    pushRectangleCap(positions, [[0, 0, depth], [0, 0, 0], [0, topY, 0], [0, topY, depth]], [-1, 0, 0]); // left, X=0
    pushRectangleCap(positions, [[width, 0, 0], [width, 0, depth], [width, topY, depth], [width, topY, 0]], [1, 0, 0]); // right, X=width
  } else {
    // ===== rounded top-edge construction =====
    //
    // For Y in [topY - cornerRadius, topY], the footprint is the tray
    // rectangle inset by `cornerRadius * (1 + cos(theta))` on all four sides,
    // theta running pi/2 (Y = topY, inset = cornerRadius, flush with the
    // smaller top cap) to pi (Y = topY - cornerRadius, inset = 0, flush with
    // the ordinary side wall). Ring k's four corners, in the same winding
    // order the unrounded top-face rectangle used (front-left, front-right,
    // back-right, back-left):
    const boxRing = (k: number): [Point3, Point3, Point3, Point3] => {
      let inset: number;
      let y: number;
      if (k === 0) {
        inset = cornerRadius;
        y = topY;
      } else if (k === K) {
        inset = 0;
        y = topY - cornerRadius;
      } else {
        const theta = filletTheta(k, K);
        inset = cornerRadius * (1 + Math.cos(theta));
        y = topY - cornerRadius * (1 - Math.sin(theta));
      }
      return [
        [inset, y, inset],
        [width - inset, y, inset],
        [width - inset, y, depth - inset],
        [inset, y, depth - inset],
      ];
    };
    const topRing = boxRing(0);
    const wallTopRing = boxRing(K);
    const wallTopY = wallTopRing[0][1];

    // Top face: the smaller (inset-by-cornerRadius) rectangle, notched with
    // each hole's widened rim contour exactly as the unrounded path notches
    // the nominal one.
    const topContour: Point2[] = [
      [topRing[0][0], topRing[0][2]],
      [topRing[1][0], topRing[1][2]],
      [topRing[2][0], topRing[2][2]],
      [topRing[3][0], topRing[3][2]],
    ];
    if (topHoles.length === 0) {
      pushRectangleCap(positions, topRing, [0, 1, 0]);
    } else {
      pushCap(positions, topContour, ([x, z]) => [x, topY, z], [0, 1, 0], topHoles);
    }

    // Bottom face: the full rectangle (bottom outer edges stay sharp),
    // notched with each hole's NOMINAL contour (bottom rims stay sharp too).
    if (bottomHoles.length === 0) {
      pushRectangleCap(positions, [[0, 0, 0], [0, 0, depth], [width, 0, depth], [width, 0, 0]], [0, -1, 0]);
    } else {
      pushCap(positions, footprintContour, ([x, z]) => [x, 0, z], [0, -1, 0], bottomHoles);
    }

    // Four side walls: now only run from Y = 0 up to the fillet's own start
    // (wallTopY), not all the way to topY -- the fillet band above continues
    // them the rest of the way.
    pushRectangleCap(positions, [[0, 0, 0], [width, 0, 0], [width, wallTopY, 0], [0, wallTopY, 0]], [0, 0, -1]); // front, Z=0
    pushRectangleCap(positions, [[width, 0, depth], [0, 0, depth], [0, wallTopY, depth], [width, wallTopY, depth]], [0, 0, 1]); // back, Z=depth
    pushRectangleCap(positions, [[0, 0, depth], [0, 0, 0], [0, wallTopY, 0], [0, wallTopY, depth]], [-1, 0, 0]); // left, X=0
    pushRectangleCap(positions, [[width, 0, 0], [width, 0, depth], [width, wallTopY, depth], [width, wallTopY, 0]], [1, 0, 0]); // right, X=width

    // The fillet bands themselves: K quad-bands per side, four sides, sharp
    // (mitered) vertical corners -- a swept edge fillet, not a smoothly
    // blended 3D box corner. Desired normal per band: local
    // (outward-perpendicular, Y) components are (-cos(thetaMid),
    // sin(thetaMid)), thetaMid the band's own midpoint angle (an
    // approximation used only to pick the correct triangle winding via the
    // dot-product flip -- it need not be exact, only roughly right).
    const outwardBySide: Point3[] = [
      [0, 0, -1], // front, Z=0
      [1, 0, 0], // right, X=width
      [0, 0, 1], // back, Z=depth
      [-1, 0, 0], // left, X=0
    ];
    for (let k = 0; k < K; k += 1) {
      const ringA = boxRing(k);
      const ringB = boxRing(k + 1);
      const thetaMid = filletTheta(k + 0.5, K);
      for (let side = 0; side < 4; side += 1) {
        const next = (side + 1) % 4;
        const outward = outwardBySide[side];
        const desired: Point3 = [outward[0] * -Math.cos(thetaMid), Math.sin(thetaMid), outward[2] * -Math.cos(thetaMid)];
        pushRectangleCap(positions, [ringA[side], ringA[next], ringB[next], ringB[side]], desired);
      }
    }
  }

  // Per-hole interior. With cornerRadius === 0, `rings` holds only the rim,
  // so this is one wall band from the top face straight down to the bottom
  // face; with cornerRadius > 0 it also emits the K extra fillet bands
  // between the widened top ring and the ordinary wall-top ring, using the
  // same per-band midpoint-angle desired-normal technique as the box fillet
  // above, generalized to the hole's own azimuthal angle.
  //
  // There is NO floor cap here. That is the socket tray's blind bottom, and
  // this shape does not have one.
  for (const { rings, bottomRing } of holeBuilds) {
    const segments = SOCKET_TRAY_POCKET_SEGMENTS;
    if (cornerRadius > 0) {
      for (let k = 0; k < K; k += 1) {
        const ringA = rings[k];
        const ringB = rings[k + 1];
        const thetaMid = filletTheta(k + 0.5, K);
        for (let i = 0; i < segments; i += 1) {
          const j = (i + 1) % segments;
          const midAngle = (2 * Math.PI * (i + 0.5)) / segments;
          const desired: Point3 = [Math.cos(thetaMid) * Math.cos(midAngle), Math.sin(thetaMid), Math.cos(thetaMid) * Math.sin(midAngle)];
          pushRectangleCap(positions, [ringA[i], ringA[j], ringB[j], ringB[i]], desired);
        }
      }
    }
    const wallTopRing = rings[rings.length - 1];
    for (let i = 0; i < segments; i += 1) {
      const j = (i + 1) % segments;
      const p0 = wallTopRing[i];
      const p1 = wallTopRing[j];
      const p2 = bottomRing[j];
      const p3 = bottomRing[i];
      // Wall normal must point into the void (toward the hole's own axis),
      // the same "into the void" rule every cavity wall in this codebase
      // follows.
      const midAngle = (2 * Math.PI * (i + 0.5)) / segments;
      const inward: Point3 = [-Math.cos(midAngle), 0, -Math.sin(midAngle)];
      pushRectangleCap(positions, [p0, p1, p2, p3], inward);
    }
  }

  return positions;
}

export function createScrewdriverTrayGeometry(options: ScrewdriverTrayOptions = {}): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(screwdriverTrayPositions(options), 3));
  geometry.computeVertexNormals();
  return geometry;
}
