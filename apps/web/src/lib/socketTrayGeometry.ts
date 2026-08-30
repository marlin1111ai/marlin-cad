import * as THREE from "three";

// Socket Tray -- phase 1: a flat block with a row of round BLIND pockets cut
// into its top face (solid floor, not through-holes). First use case: a
// sampler coupon with a handful of pockets at stepped diameters, printed and
// handed to the owner to test real sockets against, per
// reference/socket-tray-recon.md. No back plate / OpenGrid Snap mount yet
// (deferred -- see that recon doc's closing note) and no UI registration.
//
// Construction is a boundary representation, never a runtime CSG boolean --
// same family as Multiconnect's blind keyhole slots
// (multiconnectContainerGeometry.ts, read-only reference for this file, not
// imported from): every pocket is cut by notching the top face's outline
// with the pocket's own rim contour and building the pocket's interior
// (cylindrical wall + flat floor) as separate triangles that reuse the
// SAME rim/floor-ring point objects the notch and wall meet at, so the seam
// is bit-identical doubles by construction (the exact-stitch contract in
// CLAUDE-LESSONS.md) rather than something that has to line up by luck. A
// round pocket needs no baked terminator mesh the way the keyhole slot
// does -- the rim is a plain parametrized circle -- so this file has no
// companion "SocketTrayMesh.ts" data file.
//
// World frame: this tray sits flat on a table/bed (it is not wall-mounted
// like Multiconnect), so unlike that primitive's pegs there is no
// as-mounted-view mirror to apply here -- x is plain left-to-right geometry
// space and matches what a user looking down at the tray from above sees
// directly. X = width [0, width] (left-right), Y = thickness [0, thickness]
// (up, matches this app's Y-up scene convention), Z = depth [0, depth]
// (front-back). The top face (pockets open here) is at Y = thickness; the
// bottom face and all four side walls are always emitted as plain
// uncut rectangles -- a pocket only ever perforates the top face by
// construction, so "the floor stays solid" holds the same way Multiconnect's
// front face stays solid: nothing here ever emits geometry between a
// pocket's floor and the tray's bottom face.

export const DEFAULT_SOCKET_TRAY_WIDTH = 240;
export const DEFAULT_SOCKET_TRAY_DEPTH = 60;
export const DEFAULT_SOCKET_TRAY_THICKNESS = 24;

// Circle resolution for a pocket wall/floor -- higher than Multiconnect's
// 32-segment pegs (openGridSnapGeometry.ts-adjacent primitives can get away
// with fewer segments on a feature nobody slides a precision part into) since
// a socket has to actually seat round in this pocket.
export const SOCKET_TRAY_POCKET_SEGMENTS = 64;

// Minimum material kept between a pocket's floor and the tray's bottom face.
// Not zero, not "as thin as the pocket depth allows" -- see
// CLAUDE-LESSONS.md's slicer-slit-fusion entry: an FDM floor that's allowed
// to go arbitrarily thin risks warping/cracking even where the geometry
// itself is perfectly valid. 2mm is comfortably above minimum printable
// thickness while staying easy to satisfy for a shallow coupon.
export const MIN_SOCKET_TRAY_FLOOR_THICKNESS = 2;
// Minimum material kept between a pocket's rim and the tray's outer edge --
// this is a structural side wall, not a tangent-footprint clearance, so it's
// larger than Multiconnect's 2mm peg keep-out.
export const SOCKET_TRAY_POCKET_EDGE_CLEARANCE = 5;
// Minimum gap between two adjacent pockets' rims -- keeps the dividing wall
// thick enough to print cleanly and survive sockets being dropped in/out.
export const SOCKET_TRAY_POCKET_GAP = 4;

export type SocketTrayPocket = {
  // Outer diameter of the round blind pocket, mm.
  diameter: number;
  // Pocket depth measured down from the top face, mm.
  depth: number;
  // Pocket center, geometry space (no view-space mirror -- see file header).
  x: number;
  z: number;
};

export type SocketTrayOptions = {
  width?: number;
  depth?: number;
  thickness?: number;
  pockets?: SocketTrayPocket[];
};

function finiteOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

export function normalizeSocketTrayWidth(value?: number): number {
  const width = finiteOr(value, DEFAULT_SOCKET_TRAY_WIDTH);
  if (width <= 0) throw new Error(`socket tray width must be positive (got ${width})`);
  return width;
}

export function normalizeSocketTrayDepth(value?: number): number {
  const depth = finiteOr(value, DEFAULT_SOCKET_TRAY_DEPTH);
  if (depth <= 0) throw new Error(`socket tray depth must be positive (got ${depth})`);
  return depth;
}

export function normalizeSocketTrayThickness(value?: number): number {
  const thickness = finiteOr(value, DEFAULT_SOCKET_TRAY_THICKNESS);
  if (thickness <= 0) throw new Error(`socket tray thickness must be positive (got ${thickness})`);
  return thickness;
}

export function socketTrayDimensions(options: SocketTrayOptions = {}) {
  return {
    width: normalizeSocketTrayWidth(options.width),
    depth: normalizeSocketTrayDepth(options.depth),
    thickness: normalizeSocketTrayThickness(options.thickness),
  };
}

type NormalizedPocket = { x: number; z: number; radius: number; depth: number };

// Validates the caller-provided pocket layout the same way
// multiconnectContainerGeometry.ts's normalizedPegs validates peg layouts:
// positions are explicit (no auto-layout), so a bad layout is a caller bug
// and this throws rather than silently dropping or nudging pockets.
function normalizedPockets(pockets: SocketTrayPocket[], width: number, depth: number, thickness: number): NormalizedPocket[] {
  const result: NormalizedPocket[] = [];
  pockets.forEach((pocket, index) => {
    const { diameter, depth: pocketDepth, x, z } = pocket;
    if (![diameter, pocketDepth, x, z].every(Number.isFinite) || diameter <= 0 || pocketDepth <= 0) {
      throw new Error(`socket tray pocket ${index}: diameter/depth/x/z must be finite and positive`);
    }
    if (thickness - pocketDepth < MIN_SOCKET_TRAY_FLOOR_THICKNESS) {
      throw new Error(
        `socket tray pocket ${index}: depth ${pocketDepth}mm leaves less than the ${MIN_SOCKET_TRAY_FLOOR_THICKNESS}mm minimum floor at tray thickness ${thickness}mm`,
      );
    }
    const radius = diameter / 2;
    if (
      x - radius < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      x + radius > width - SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      z - radius < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      z + radius > depth - SOCKET_TRAY_POCKET_EDGE_CLEARANCE
    ) {
      throw new Error(`socket tray pocket ${index}: footprint (r=${radius}mm) is within ${SOCKET_TRAY_POCKET_EDGE_CLEARANCE}mm of the tray edge`);
    }
    result.push({ x, z, radius, depth: pocketDepth });
  });
  for (let i = 0; i < result.length; i += 1) {
    for (let j = i + 1; j < result.length; j += 1) {
      const distance = Math.hypot(result[i].x - result[j].x, result[i].z - result[j].z);
      if (distance < result[i].radius + result[j].radius + SOCKET_TRAY_POCKET_GAP) {
        throw new Error(`socket tray pockets ${i} and ${j}: footprints overlap or leave too thin a wall (centers ${distance.toFixed(2)}mm apart)`);
      }
    }
  }
  return result;
}

// ===== triangle emission helpers (same technique as
// multiconnectContainerGeometry.ts's pushTriangle/triangleNormal/pushCap/
// pushRectangleCap -- reimplemented here rather than imported, per the
// do-not-import instruction; there is no shared cut-pocket helper module in
// this codebase today, see reference/socket-tray-recon.md section 3) =====

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

// Triangulates a simple (possibly holed) planar contour and emits it wound
// so its normal points along desiredNormal, deciding winding from the first
// non-degenerate triangle rather than trusting the contour's own point order.
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

const POCKET_ANGLES = Array.from({ length: SOCKET_TRAY_POCKET_SEGMENTS }, (_, index) => (2 * Math.PI * index) / SOCKET_TRAY_POCKET_SEGMENTS);

// ===== main entry point =====

export function socketTrayPositions(options: SocketTrayOptions = {}): number[] {
  const width = normalizeSocketTrayWidth(options.width);
  const depth = normalizeSocketTrayDepth(options.depth);
  const thickness = normalizeSocketTrayThickness(options.thickness);
  const pockets = normalizedPockets(options.pockets ?? [], width, depth, thickness);

  const topY = thickness;
  const positions: number[] = [];

  // Precompute each pocket's top rim ring once. The SAME Point3 objects
  // feed both the top cap's hole contour and the pocket wall's top ring, so
  // that seam is bit-identical by construction (mirrors how Multiconnect's
  // pegHoles reuse pegBuilds' root rings, multiconnectContainerGeometry.ts's
  // normalizedPegs/pegBuilds).
  const pocketBuilds = pockets.map((pocket) => {
    const floorY = topY - pocket.depth;
    const rim: Point3[] = POCKET_ANGLES.map((angle) => [pocket.x + pocket.radius * Math.cos(angle), topY, pocket.z + pocket.radius * Math.sin(angle)]);
    const floorRing: Point3[] = POCKET_ANGLES.map((angle) => [pocket.x + pocket.radius * Math.cos(angle), floorY, pocket.z + pocket.radius * Math.sin(angle)]);
    return { pocket, floorY, rim, floorRing };
  });
  const pocketHoles: Point2[][] = pocketBuilds.map(({ rim }) => rim.map(([x, , z]) => [x, z]));

  // Top face (Y = topY): the only face a pocket ever opens through. Full
  // rectangle when there are no pockets; otherwise notched with each
  // pocket's exact rim contour as an earcut hole -- the "floor/other faces
  // stay solid" guarantee holds by construction, the same way Multiconnect's
  // front face does, since nothing else in this builder ever emits an
  // opening anywhere else.
  if (pocketHoles.length === 0) {
    pushRectangleCap(positions, [[0, topY, 0], [width, topY, 0], [width, topY, depth], [0, topY, depth]], [0, 1, 0]);
  } else {
    pushCap(positions, [[0, 0], [width, 0], [width, depth], [0, depth]], ([x, z]) => [x, topY, z], [0, 1, 0], pocketHoles);
  }

  // Bottom face (Y = 0): always a plain rectangle -- no pocket reaches it.
  pushRectangleCap(positions, [[0, 0, 0], [0, 0, depth], [width, 0, depth], [width, 0, 0]], [0, -1, 0]);

  // Four side walls: plain rectangles -- normalizedPockets' edge-clearance
  // check guarantees no pocket ever reaches an outer edge.
  pushRectangleCap(positions, [[0, 0, 0], [width, 0, 0], [width, topY, 0], [0, topY, 0]], [0, 0, -1]); // front, Z=0
  pushRectangleCap(positions, [[width, 0, depth], [0, 0, depth], [0, topY, depth], [width, topY, depth]], [0, 0, 1]); // back, Z=depth
  pushRectangleCap(positions, [[0, 0, depth], [0, 0, 0], [0, topY, 0], [0, topY, depth]], [-1, 0, 0]); // left, X=0
  pushRectangleCap(positions, [[width, 0, 0], [width, 0, depth], [width, topY, depth], [width, topY, 0]], [1, 0, 0]); // right, X=width

  // Per-pocket interior: cylindrical wall (top rim down to floor ring) plus
  // the flat floor cap. Reuses `rim`/`floorRing` verbatim -- no re-derivation.
  for (const { pocket, floorY, rim, floorRing } of pocketBuilds) {
    const segments = SOCKET_TRAY_POCKET_SEGMENTS;
    for (let i = 0; i < segments; i += 1) {
      const j = (i + 1) % segments;
      const p0 = rim[i];
      const p1 = rim[j];
      const p2 = floorRing[j];
      const p3 = floorRing[i];
      // Wall normal must point into the void (toward the pocket's own
      // axis), the same "into the void" rule Multiconnect's channel prism
      // walls follow.
      const midAngle = (2 * Math.PI * (i + 0.5)) / segments;
      const inward: Point3 = [-Math.cos(midAngle), 0, -Math.sin(midAngle)];
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
    // Floor cap: the pocket's blind bottom, normal pointing up into the
    // cavity (away from the solid material below it, toward the socket).
    pushCap(positions, floorRing.map(([x, , z]) => [x, z] as Point2), ([x, z]) => [x, floorY, z], [0, 1, 0]);
  }

  return positions;
}

export function createSocketTrayGeometry(options: SocketTrayOptions = {}): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(socketTrayPositions(options), 3));
  geometry.computeVertexNormals();
  return geometry;
}
