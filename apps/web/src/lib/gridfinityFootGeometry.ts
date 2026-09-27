import * as THREE from "three";

// Gridfinity Foot -- the stacking foot of a Gridfinity bin as printable
// geometry: an N x M grid of feet on a 42mm pitch, joined by a plain flat
// plate on top. First use case: the foot test piece
// (test-prints/gridfinity-foot-test-piece.stl), printed and checked in the
// owner's baseplate BEFORE the Gridfinity labeled socket tray is built on
// this foot, per reference/DECISIONS.md (2026-09-27). No holes, no labels,
// no stacking lip, no magnet pockets, no UI registration.
//
// Every foot dimension below was MEASURED from the owner's reference
// Gridfinity STL (socket_tray_3-8dr_metric_6-14.stl, a 3 x 2 tray,
// 125.5 x 83.5 x 19.55mm), not taken from a spec:
//
//   height   plan size       plan corner radius
//   0        35.6 x 35.6     0.8      (the face that sits in the baseplate)
//   0.8      37.2 x 37.2     1.6      (top of the lower 45-degree chamfer)
//   2.6      37.2 x 37.2     1.6      (top of the 1.8mm straight band)
//   4.75     41.5 x 41.5     3.75     (top of the upper 45-degree chamfer)
//
// The corner arcs are concentric at every height (half-size minus radius is
// 17mm on all four levels). Feet sit on a 42mm pitch, so neighbouring foot
// tops are 0.5mm apart, and the body above them measures 42N - 0.5 by
// 42M - 0.5 with a 3.75mm plan corner radius -- the outermost foot tops are
// flush with the body's edge, and the body's corner arc IS the corner
// foot's top arc.
//
// The reference is not one solid: each foot is its own closed shell that
// runs 0.5mm up INTO the body (to 5.25, 41.3 x 41.3) so the slicer unions
// them. That overlap is hidden inside the body and is not part of the
// foot's shape, so it is not reproduced here.
//
// Construction is a boundary representation, never a runtime CSG boolean
// and never a hull (CLAUDE-LESSONS.md). A hull of coaxial rounded squares
// IS the ruled surface between their outlines, so each foot is four rings
// of identical point count joined by three bands of quads. ONE solid: the
// plate's underside is tiled by hand around the foot tops -- strips between
// neighbouring feet, a small square where four feet meet, and a fan in each
// foot corner that is not a plate corner. No earcut anywhere: every cap is
// either that hand tiling or a fan from an interior centre point, so no
// triangle edge can pass over a contour point lying on it.
//
// Exact-stitch contract: every foot-top coordinate is 42 * index plus one
// of 0, 3.75, 37.75 or 41.5, all exactly representable, and every consumer
// reads them from the same per-axis table (axisStations). Arc ENDPOINTS are
// pushed as those exact values; only arc interior points come from the
// parametrization. Rings are built once per foot and the bands, the
// fans, the bed face and the plate outline all reuse the same point
// objects.
//
// World frame: the piece sits on the bed on its feet, like the flat trays.
// X = width [0, 42N - 0.5], Y = up (feet from 0 to 4.75, plate above),
// Z = depth [0, 42M - 0.5]. No as-mounted-view mirror: the piece is
// standalone and every foot is identical.

// Centre-to-centre distance between neighbouring feet.
export const GRIDFINITY_PITCH = 42;

export type GridfinityFootLevel = {
  // Height above the bed.
  height: number;
  // Plan size of the foot's (square) outline at this height.
  size: number;
  // Plan corner radius of that outline.
  radius: number;
};

// The foot's profile, bottom-up, as measured (see file header).
export const GRIDFINITY_FOOT_PROFILE: readonly GridfinityFootLevel[] = [
  { height: 0, size: 35.6, radius: 0.8 },
  { height: 0.8, size: 37.2, radius: 1.6 },
  { height: 2.6, size: 37.2, radius: 1.6 },
  { height: 4.75, size: 41.5, radius: 3.75 },
];

export const GRIDFINITY_FOOT_HEIGHT = 4.75;
// Plan size and corner radius of a foot's top outline.
export const GRIDFINITY_FOOT_TOP_SIZE = 41.5;
export const GRIDFINITY_FOOT_TOP_RADIUS = 3.75;
// Gap between neighbouring foot tops: GRIDFINITY_PITCH - GRIDFINITY_FOOT_TOP_SIZE.
export const GRIDFINITY_FOOT_GAP = 0.5;
// Segments per quarter-circle corner arc -- the reference's own count (17
// points per corner, 5.625 degrees apart).
export const GRIDFINITY_FOOT_CORNER_SEGMENTS = 16;

export const DEFAULT_GRIDFINITY_FOOT_PLATE_THICKNESS = 3;

export type GridfinityFootOptions = {
  // Grid size in Gridfinity squares.
  squaresX: number;
  squaresZ: number;
  // Thickness of the flat plate joining the feet, measured up from the foot
  // tops.
  plateThickness?: number;
};

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

function finiteOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

export function normalizeGridfinitySquares(value: number, axis: "squaresX" | "squaresZ"): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`gridfinity foot ${axis} must be a whole number of squares, 1 or more (got ${value})`);
  return value;
}

export function normalizeGridfinityFootPlateThickness(value?: number): number {
  const thickness = finiteOr(value, DEFAULT_GRIDFINITY_FOOT_PLATE_THICKNESS);
  if (thickness <= 0) throw new Error(`gridfinity foot plate thickness must be positive (got ${thickness})`);
  return thickness;
}

export type GridfinityFootDimensions = {
  squaresX: number;
  squaresZ: number;
  plateThickness: number;
  // Overall size: width along X, depth along Z, height along Y.
  width: number;
  depth: number;
  height: number;
};

export function gridfinityFootDimensions(options: GridfinityFootOptions): GridfinityFootDimensions {
  const squaresX = normalizeGridfinitySquares(options.squaresX, "squaresX");
  const squaresZ = normalizeGridfinitySquares(options.squaresZ, "squaresZ");
  const plateThickness = normalizeGridfinityFootPlateThickness(options.plateThickness);
  return {
    squaresX,
    squaresZ,
    plateThickness,
    width: GRIDFINITY_PITCH * (squaresX - 1) + GRIDFINITY_FOOT_TOP_SIZE,
    depth: GRIDFINITY_PITCH * (squaresZ - 1) + GRIDFINITY_FOOT_TOP_SIZE,
    height: GRIDFINITY_FOOT_HEIGHT + plateThickness,
  };
}

// Where one foot's top outline meets one axis: the two edges of its box and
// the two points where its straight edge hands over to a corner arc. THE
// shared source of every foot-top coordinate.
type AxisStations = {
  low: number;
  lowTangent: number;
  highTangent: number;
  high: number;
};

function axisStations(index: number): AxisStations {
  const low = GRIDFINITY_PITCH * index;
  return {
    low,
    lowTangent: low + GRIDFINITY_FOOT_TOP_RADIUS,
    highTangent: low + (GRIDFINITY_FOOT_TOP_SIZE - GRIDFINITY_FOOT_TOP_RADIUS),
    high: low + GRIDFINITY_FOOT_TOP_SIZE,
  };
}

// One foot outline at one height: four corner arcs of
// GRIDFINITY_FOOT_CORNER_SEGMENTS + 1 points each, in the order
// (high x, low z), (high x, high z), (low x, high z), (low x, low z). The
// straight edges are the single segments between one arc's last point and
// the next arc's first.
type FootRing = {
  y: number;
  // arcs[corner][k]; arcs[corner][0] and the last point are the exact
  // tangent points.
  arcs: Point2[][];
  // All four arcs, concatenated in order.
  loop: Point2[];
};

const CORNER_HIGH_X_LOW_Z = 0;
const CORNER_HIGH_X_HIGH_Z = 1;
const CORNER_LOW_X_HIGH_Z = 2;
const CORNER_LOW_X_LOW_Z = 3;

function footRing(x: AxisStations, z: AxisStations, level: GridfinityFootLevel): FootRing {
  const inset = (GRIDFINITY_FOOT_TOP_SIZE - level.size) / 2;
  const top = inset === 0;
  // At the top level these ARE the axis stations, not a recomputation of
  // them.
  const lowX = top ? x.low : x.low + inset;
  const highX = top ? x.high : x.high - inset;
  const lowZ = top ? z.low : z.low + inset;
  const highZ = top ? z.high : z.high - inset;
  const innerLowX = top ? x.lowTangent : lowX + level.radius;
  const innerHighX = top ? x.highTangent : highX - level.radius;
  const innerLowZ = top ? z.lowTangent : lowZ + level.radius;
  const innerHighZ = top ? z.highTangent : highZ - level.radius;

  // Each corner: its arc centre, its first and last point (exact), and the
  // angle its first point stands at, measured from +X toward +Z.
  const corners: Array<{ centre: Point2; first: Point2; last: Point2; startAngle: number }> = [
    { centre: [innerHighX, innerLowZ], first: [innerHighX, lowZ], last: [highX, innerLowZ], startAngle: -Math.PI / 2 },
    { centre: [innerHighX, innerHighZ], first: [highX, innerHighZ], last: [innerHighX, highZ], startAngle: 0 },
    { centre: [innerLowX, innerHighZ], first: [innerLowX, highZ], last: [lowX, innerHighZ], startAngle: Math.PI / 2 },
    { centre: [innerLowX, innerLowZ], first: [lowX, innerLowZ], last: [innerLowX, lowZ], startAngle: Math.PI },
  ];
  const arcs = corners.map(({ centre, first, last, startAngle }) => {
    const arc: Point2[] = [first];
    for (let k = 1; k < GRIDFINITY_FOOT_CORNER_SEGMENTS; k += 1) {
      const angle = startAngle + (k / GRIDFINITY_FOOT_CORNER_SEGMENTS) * (Math.PI / 2);
      arc.push([centre[0] + level.radius * Math.cos(angle), centre[1] + level.radius * Math.sin(angle)]);
    }
    arc.push(last);
    return arc;
  });
  return { y: level.height, arcs, loop: arcs.flat() };
}

// ===== triangle emission helpers (same technique as the trays'
// pushTriangle/triangleNormal -- reimplemented here rather than imported,
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

// Emits one triangle wound so its normal points along desiredNormal.
function pushFacing(out: number[], a: Point3, b: Point3, c: Point3, desiredNormal: Point3) {
  const normal = triangleNormal(a, b, c);
  const dot = normal[0] * desiredNormal[0] + normal[1] * desiredNormal[1] + normal[2] * desiredNormal[2];
  if (dot < 0) pushTriangle(out, a, c, b);
  else pushTriangle(out, a, b, c);
}

// Emits the quad a-b-c-d (corners in order around it) as two triangles
// split along a-c.
function pushQuad(out: number[], a: Point3, b: Point3, c: Point3, d: Point3, desiredNormal: Point3) {
  pushFacing(out, a, b, c, desiredNormal);
  pushFacing(out, a, c, d, desiredNormal);
}

// A band of quads between two loops of identical point count, facing away
// from `centre` in plan. Serves the foot's chamfers and straight band and
// the plate's edge alike; both loops' own points are reused.
function pushBand(out: number[], low: Point2[], lowY: number, high: Point2[], highY: number, centre: Point2) {
  for (let index = 0; index < low.length; index += 1) {
    const next = (index + 1) % low.length;
    const a: Point3 = [low[index][0], lowY, low[index][1]];
    const b: Point3 = [low[next][0], lowY, low[next][1]];
    const c: Point3 = [high[next][0], highY, high[next][1]];
    const d: Point3 = [high[index][0], highY, high[index][1]];
    const outward: Point3 = [(a[0] + b[0] + c[0] + d[0]) / 4 - centre[0], 0, (a[2] + b[2] + c[2] + d[2]) / 4 - centre[1]];
    pushQuad(out, a, b, c, d, outward);
  }
}

// A flat cap over a CONVEX loop, as a fan from an interior centre point:
// every edge of the loop gets its own triangle, so points lying on a
// straight run of the loop are all used.
function pushCentreFan(out: number[], loop: Point2[], y: number, centre: Point2, desiredNormal: Point3) {
  const apex: Point3 = [centre[0], y, centre[1]];
  for (let index = 0; index < loop.length; index += 1) {
    const a = loop[index];
    const b = loop[(index + 1) % loop.length];
    pushFacing(out, apex, [a[0], y, a[1]], [b[0], y, b[1]], desiredNormal);
  }
}

// ===== main entry point =====

export function gridfinityFootPositions(options: GridfinityFootOptions): number[] {
  const { squaresX, squaresZ, width, depth, height } = gridfinityFootDimensions(options);
  const positions: number[] = [];
  const up: Point3 = [0, 1, 0];
  const down: Point3 = [0, -1, 0];
  const footTopY = GRIDFINITY_FOOT_HEIGHT;

  const stationsX = Array.from({ length: squaresX }, (_, index) => axisStations(index));
  const stationsZ = Array.from({ length: squaresZ }, (_, index) => axisStations(index));
  const under = (x: number, z: number): Point3 => [x, footTopY, z];

  // topRings[i][j]: the top outline of the foot in column i, row j. The
  // plate outline below reads its corner arcs out of these.
  const topRings: FootRing[][] = [];

  for (let i = 0; i < squaresX; i += 1) {
    topRings.push([]);
    for (let j = 0; j < squaresZ; j += 1) {
      const x = stationsX[i];
      const z = stationsZ[j];
      const centre: Point2 = [x.low + GRIDFINITY_FOOT_TOP_SIZE / 2, z.low + GRIDFINITY_FOOT_TOP_SIZE / 2];
      const rings = GRIDFINITY_FOOT_PROFILE.map((level) => footRing(x, z, level));
      const top = rings[rings.length - 1];
      topRings[i].push(top);

      // The face that sits in the baseplate.
      pushCentreFan(positions, rings[0].loop, rings[0].y, centre, down);
      // Lower chamfer, straight band, upper chamfer.
      for (let level = 0; level + 1 < rings.length; level += 1) {
        pushBand(positions, rings[level].loop, rings[level].y, rings[level + 1].loop, rings[level + 1].y, centre);
      }

      // The plate's underside in each corner of this foot's box, between
      // the corner arc and the box's own square corner. A plate corner has
      // none: there the plate's outline is this arc.
      const boxCorners: Array<{ corner: number; point: Point2; atPlateCorner: boolean }> = [
        { corner: CORNER_HIGH_X_LOW_Z, point: [x.high, z.low], atPlateCorner: i === squaresX - 1 && j === 0 },
        { corner: CORNER_HIGH_X_HIGH_Z, point: [x.high, z.high], atPlateCorner: i === squaresX - 1 && j === squaresZ - 1 },
        { corner: CORNER_LOW_X_HIGH_Z, point: [x.low, z.high], atPlateCorner: i === 0 && j === squaresZ - 1 },
        { corner: CORNER_LOW_X_LOW_Z, point: [x.low, z.low], atPlateCorner: i === 0 && j === 0 },
      ];
      for (const { corner, point, atPlateCorner } of boxCorners) {
        if (atPlateCorner) continue;
        const arc = top.arcs[corner];
        for (let k = 0; k + 1 < arc.length; k += 1) {
          pushFacing(positions, under(point[0], point[1]), under(arc[k][0], arc[k][1]), under(arc[k + 1][0], arc[k + 1][1]), down);
        }
      }

      // The 0.5mm strip between this foot and the next one along X, split
      // where this foot's straight edge hands over to its corner arcs so
      // the strip meets the foot and both corner fans edge for edge.
      if (i + 1 < squaresX) {
        const left = x.high;
        const right = stationsX[i + 1].low;
        const breaks = [z.low, z.lowTangent, z.highTangent, z.high];
        for (let k = 0; k + 1 < breaks.length; k += 1) {
          pushQuad(positions, under(left, breaks[k]), under(right, breaks[k]), under(right, breaks[k + 1]), under(left, breaks[k + 1]), down);
        }
      }
      // The same strip toward the next foot along Z.
      if (j + 1 < squaresZ) {
        const near = z.high;
        const far = stationsZ[j + 1].low;
        const breaks = [x.low, x.lowTangent, x.highTangent, x.high];
        for (let k = 0; k + 1 < breaks.length; k += 1) {
          pushQuad(positions, under(breaks[k], near), under(breaks[k + 1], near), under(breaks[k + 1], far), under(breaks[k], far), down);
        }
      }
      // The small square where four feet meet.
      if (i + 1 < squaresX && j + 1 < squaresZ) {
        const left = x.high;
        const right = stationsX[i + 1].low;
        const near = z.high;
        const far = stationsZ[j + 1].low;
        pushQuad(positions, under(left, near), under(right, near), under(right, far), under(left, far), down);
      }
    }
  }

  // The plate's outline, walked once around: each side's straight run stops
  // at every point a foot, a corner fan or a strip touches it, and each
  // corner is the corner foot's own top arc. The plate's edge and its top
  // face both read this one loop.
  const lastX = squaresX - 1;
  const lastZ = squaresZ - 1;
  const outline: Point2[] = [];
  const pushRun = (stations: AxisStations[], reversed: boolean, at: (station: number) => Point2) => {
    const stops: number[] = [];
    stations.forEach((station, index) => {
      if (index > 0) stops.push(station.low);
      stops.push(station.lowTangent, station.highTangent);
      if (index + 1 < stations.length) stops.push(station.high);
    });
    if (reversed) stops.reverse();
    // The run's first and last stops are the ends of the corner arcs on
    // either side of it, which are pushed with those arcs.
    for (const stop of stops.slice(1, -1)) outline.push(at(stop));
  };
  outline.push(...topRings[lastX][0].arcs[CORNER_HIGH_X_LOW_Z]);
  pushRun(stationsZ, false, (z) => [stationsX[lastX].high, z]);
  outline.push(...topRings[lastX][lastZ].arcs[CORNER_HIGH_X_HIGH_Z]);
  pushRun(stationsX, true, (x) => [x, stationsZ[lastZ].high]);
  outline.push(...topRings[0][lastZ].arcs[CORNER_LOW_X_HIGH_Z]);
  pushRun(stationsZ, true, (z) => [stationsX[0].low, z]);
  outline.push(...topRings[0][0].arcs[CORNER_LOW_X_LOW_Z]);
  pushRun(stationsX, false, (x) => [x, stationsZ[0].low]);

  const plateCentre: Point2 = [width / 2, depth / 2];
  pushBand(positions, outline, footTopY, outline, height, plateCentre);
  pushCentreFan(positions, outline, height, plateCentre, up);
  return positions;
}

export function createGridfinityFootGeometry(options: GridfinityFootOptions): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(gridfinityFootPositions(options), 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// ===== the foot test piece =====

// 2 x 1 Gridfinity squares: two feet joined by a plain 3mm plate. No holes,
// no labels.
export function gridfinityFootTestPieceOptions(): GridfinityFootOptions {
  return { squaresX: 2, squaresZ: 1, plateThickness: DEFAULT_GRIDFINITY_FOOT_PLATE_THICKNESS };
}
