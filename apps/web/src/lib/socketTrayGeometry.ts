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
export const DEFAULT_SOCKET_TRAY_THICKNESS = 18;

// Corner Radius -- an owner-typed fillet (never a chamfer) applied to (a)
// the tray's own outer top perimeter (all four top/side/end edges, where
// the top face meets each side wall) and (b) every pocket's rim, where its
// wall meets the top face. Default 0 = sharp, byte-identical to this
// module's pre-rounding output (see the explicit radius===0 branches
// below -- this is not an approximation that happens to converge to zero,
// it is the original code, untouched, still reachable verbatim).
//
// Technique: the same one multiconnectContainerGeometry.ts's peg fillet
// uses (read there, never imported: a revolved/swept profile with extra
// points inserted along a quarter-circle arc between two tangent points,
// each additional point becoming one more ring/band of triangles, normals
// resolved by the existing dot-product-against-a-desired-direction flip
// every builder in this file already uses). Two independent instances of
// that same technique are built here:
//
// - Outer top edge: a CONVEX fillet (rounds an outside corner, removing
//   material). At tray height Y, for Y in [thickness - cornerRadius,
//   thickness], the footprint is the tray rectangle inset by
//   `cornerRadius * (1 + cos(theta))` on all four sides, where theta runs
//   from pi/2 (Y = thickness, inset = cornerRadius, flush with the now-
//   smaller top cap) to pi (Y = thickness - cornerRadius, inset = 0, flush
//   with the ordinary, unmodified side wall below it). The four vertical
//   corners are a straight miter between adjacent sides (not a smooth 3D
//   corner blend) -- this is a swept edge fillet, not a fully rounded box.
// - Pocket rim: the mechanical mirror, a CONCAVE fillet (eases the
//   opening, widening it slightly right at the top face). For the same Y
//   range, the pocket's open radius is `pocket.radius + cornerRadius * (1
//   + cos(theta))`, from `pocket.radius + cornerRadius` at the top face
//   down to the pocket's own nominal radius one cornerRadius below it,
//   where it continues as the ordinary straight wall to the floor.
//
// Both arcs are pushed as EXACT literal endpoints (theta = pi/2 and
// theta = pi collapse to inset = cornerRadius/0 and 1+cos/1-sin = 0/2
// exactly in the two closed-form cases actually used below -- see the
// per-function comments), per CLAUDE-LESSONS.md's exact-stitch entry:
// trig does not land exactly on an arc endpoint, so only the interior
// points come from the parametrization.
export const DEFAULT_SOCKET_TRAY_CORNER_RADIUS = 0;
// Arc resolution for a fillet band -- this module's own constant, not
// imported from multiconnectContainerGeometry.ts's
// MULTICONNECT_PEG_FILLET_SEGMENTS, matching that constant's value only
// because it reads well at this scale, not because the two are linked.
export const SOCKET_TRAY_FILLET_SEGMENTS = 6;

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
  // Owner-typed fillet radius, applied to the outer top perimeter and
  // every pocket rim. 0 (default) = sharp, identical to pre-rounding
  // output.
  cornerRadius?: number;
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

// Zero or positive only -- unlike width/depth/thickness there is no "must
// be positive" guard here, since 0 (sharp) is the default, valid state.
export function normalizeSocketTrayCornerRadius(value?: number): number {
  const radius = finiteOr(value, DEFAULT_SOCKET_TRAY_CORNER_RADIUS);
  if (radius < 0) throw new Error(`socket tray corner radius must be zero or positive (got ${radius})`);
  return radius;
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

// Validates the fillet against the tray's own footprint/thickness and
// every pocket's depth and effective (widened-by-the-fillet) footprint.
// Mirrors the floor-thickness guard's style: a clear, specific message,
// thrown rather than clamped.
function validateSocketTrayCornerRadius(cornerRadius: number, width: number, depth: number, thickness: number, pockets: NormalizedPocket[]) {
  if (cornerRadius === 0) return;
  const smallestFootprint = Math.min(width, depth);
  if (2 * cornerRadius >= smallestFootprint) {
    throw new Error(`socket tray corner radius ${cornerRadius}mm is too large for the tray's ${smallestFootprint}mm smallest footprint dimension`);
  }
  if (cornerRadius >= thickness) {
    throw new Error(`socket tray corner radius ${cornerRadius}mm leaves no straight wall below it at tray thickness ${thickness}mm`);
  }
  pockets.forEach((pocket, index) => {
    if (cornerRadius >= pocket.depth) {
      throw new Error(`socket tray corner radius ${cornerRadius}mm leaves no straight wall below it in pocket ${index} (depth ${pocket.depth}mm)`);
    }
    // The rim fillet widens the pocket's opening at the top face from
    // pocket.radius to pocket.radius + cornerRadius -- re-check the same
    // edge-clearance and pairwise-gap guards normalizedPockets already
    // enforced for the nominal radius, this time for the widened one,
    // since a fillet with no room to widen into is exactly "radius too
    // large relative to the pocket diameter."
    const widened = pocket.radius + cornerRadius;
    if (
      pocket.x - widened < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      pocket.x + widened > width - SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      pocket.z - widened < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      pocket.z + widened > depth - SOCKET_TRAY_POCKET_EDGE_CLEARANCE
    ) {
      throw new Error(
        `socket tray corner radius ${cornerRadius}mm widens pocket ${index} (diameter ${pocket.radius * 2}mm) to within ${SOCKET_TRAY_POCKET_EDGE_CLEARANCE}mm of the tray edge`,
      );
    }
    for (let j = 0; j < pockets.length; j += 1) {
      if (j === index) continue;
      const distance = Math.hypot(pocket.x - pockets[j].x, pocket.z - pockets[j].z);
      if (distance < widened + pockets[j].radius + cornerRadius + SOCKET_TRAY_POCKET_GAP) {
        throw new Error(
          `socket tray corner radius ${cornerRadius}mm widens pocket ${index} (diameter ${pocket.radius * 2}mm) too close to pocket ${j} (centers ${distance.toFixed(2)}mm apart)`,
        );
      }
    }
  });
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

// theta runs [pi/2, pi] for both fillet families in this file. At the
// endpoints, cos/sin do not land on exact 0/1/-1 in float64 (CLAUDE-LESSONS:
// "trig does not land exactly"), so every ring at k=0 or k=SEGMENTS is
// pushed with hand-written literal coordinates below; this helper is only
// ever called for the interior points, k=1..SEGMENTS-1.
function filletTheta(k: number, segments: number): number {
  return Math.PI / 2 + (k * (Math.PI / 2)) / segments;
}

export function socketTrayPositions(options: SocketTrayOptions = {}): number[] {
  const width = normalizeSocketTrayWidth(options.width);
  const depth = normalizeSocketTrayDepth(options.depth);
  const thickness = normalizeSocketTrayThickness(options.thickness);
  const cornerRadius = normalizeSocketTrayCornerRadius(options.cornerRadius);
  const pockets = normalizedPockets(options.pockets ?? [], width, depth, thickness);
  validateSocketTrayCornerRadius(cornerRadius, width, depth, thickness, pockets);

  const topY = thickness;
  const positions: number[] = [];
  const K = SOCKET_TRAY_FILLET_SEGMENTS;

  // Precompute each pocket's rings once. With cornerRadius === 0 this is
  // exactly the original two-ring (rim/floorRing) build, untouched, so the
  // rest of this function's radius===0 branches reuse it byte-for-byte.
  // With cornerRadius > 0, `rings[0]` is a WIDENED ring (radius + cornerRadius)
  // at the top face -- the concave fillet eases the opening -- and
  // `rings[K]` is the ordinary nominal-radius ring one cornerRadius below
  // the top, from which the existing straight wall continues to the floor
  // exactly as before. The SAME Point3 objects feed both the top cap's hole
  // contour and the fillet band's own rings, so every seam is bit-identical
  // by construction (the exact-stitch contract), the same guarantee the
  // original rim/floorRing pair already relied on.
  const pocketBuilds = pockets.map((pocket) => {
    const floorY = topY - pocket.depth;
    const floorRing: Point3[] = POCKET_ANGLES.map((angle) => [pocket.x + pocket.radius * Math.cos(angle), floorY, pocket.z + pocket.radius * Math.sin(angle)]);
    if (cornerRadius === 0) {
      const rim: Point3[] = POCKET_ANGLES.map((angle) => [pocket.x + pocket.radius * Math.cos(angle), topY, pocket.z + pocket.radius * Math.sin(angle)]);
      return { pocket, floorY, rings: [rim], floorRing };
    }
    const rings: Point3[][] = [];
    for (let k = 0; k <= K; k += 1) {
      let radius: number;
      let y: number;
      if (k === 0) {
        radius = pocket.radius + cornerRadius;
        y = topY;
      } else if (k === K) {
        radius = pocket.radius;
        y = topY - cornerRadius;
      } else {
        const theta = filletTheta(k, K);
        radius = pocket.radius + cornerRadius * (1 + Math.cos(theta));
        y = topY - cornerRadius * (1 - Math.sin(theta));
      }
      rings.push(POCKET_ANGLES.map((angle) => [pocket.x + radius * Math.cos(angle), y, pocket.z + radius * Math.sin(angle)]));
    }
    return { pocket, floorY, rings, floorRing };
  });
  const pocketHoles: Point2[][] = pocketBuilds.map(({ rings }) => rings[0].map(([x, , z]) => [x, z]));

  if (cornerRadius === 0) {
    // ===== original, unrounded construction -- verbatim, unreachable diff
    // from the pre-rounding module. This branch is what proves radius=0 is
    // byte-identical to the tray's historical output: it is that output. =====

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
  } else {
    // ===== rounded top-edge construction =====
    //
    // For Y in [topY - cornerRadius, topY], the footprint is the tray
    // rectangle inset by `cornerRadius * (1 + cos(theta))` on all four
    // sides, theta running pi/2 (Y = topY, inset = cornerRadius, flush with
    // the smaller top cap) to pi (Y = topY - cornerRadius, inset = 0, flush
    // with the ordinary side wall). Ring k's four corners, in the same
    // winding order the unrounded top-face rectangle used (front-left,
    // front-right, back-right, back-left):
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
    // each pocket's widened rim contour exactly as the unrounded path
    // notches the nominal one.
    const topContour: Point2[] = [
      [topRing[0][0], topRing[0][2]],
      [topRing[1][0], topRing[1][2]],
      [topRing[2][0], topRing[2][2]],
      [topRing[3][0], topRing[3][2]],
    ];
    if (pocketHoles.length === 0) {
      pushRectangleCap(positions, topRing, [0, 1, 0]);
    } else {
      pushCap(positions, topContour, ([x, z]) => [x, topY, z], [0, 1, 0], pocketHoles);
    }

    // Bottom face: unchanged, full rectangle.
    pushRectangleCap(positions, [[0, 0, 0], [0, 0, depth], [width, 0, depth], [width, 0, 0]], [0, -1, 0]);

    // Four side walls: now only run from Y = 0 up to the fillet's own
    // start (wallTopY), not all the way to topY -- the fillet band above
    // continues them the rest of the way.
    pushRectangleCap(positions, [[0, 0, 0], [width, 0, 0], [width, wallTopY, 0], [0, wallTopY, 0]], [0, 0, -1]); // front, Z=0
    pushRectangleCap(positions, [[width, 0, depth], [0, 0, depth], [0, wallTopY, depth], [width, wallTopY, depth]], [0, 0, 1]); // back, Z=depth
    pushRectangleCap(positions, [[0, 0, depth], [0, 0, 0], [0, wallTopY, 0], [0, wallTopY, depth]], [-1, 0, 0]); // left, X=0
    pushRectangleCap(positions, [[width, 0, 0], [width, 0, depth], [width, wallTopY, depth], [width, wallTopY, 0]], [1, 0, 0]); // right, X=width

    // The fillet bands themselves: K quad-bands per side, four sides, sharp
    // (mitered) vertical corners -- this is a swept edge fillet, not a
    // smoothly blended 3D box corner. Desired normal per band comes from
    // this file header's derivation: local (outward-perpendicular, Y)
    // components are (-cos(thetaMid), sin(thetaMid)), thetaMid the band's
    // own midpoint angle (an approximation used only to pick the correct
    // triangle winding via the existing dot-product flip -- it does not
    // need to be exact, only roughly right).
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

  // Per-pocket interior. With cornerRadius === 0, `rings` holds only the
  // original rim, so this reduces to exactly the unrounded wall+floor
  // construction; with cornerRadius > 0 it also emits the K extra fillet
  // bands between the widened top ring and the ordinary wall-top ring,
  // using the same per-band midpoint-angle desired-normal technique as the
  // box fillet above, generalized to the pocket's own azimuthal angle.
  for (const { pocket, floorY, rings, floorRing } of pocketBuilds) {
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
      const p2 = floorRing[j];
      const p3 = floorRing[i];
      // Wall normal must point into the void (toward the pocket's own
      // axis), the same "into the void" rule Multiconnect's channel prism
      // walls follow.
      const midAngle = (2 * Math.PI * (i + 0.5)) / segments;
      const inward: Point3 = [-Math.cos(midAngle), 0, -Math.sin(midAngle)];
      pushRectangleCap(positions, [p0, p1, p2, p3], inward);
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
