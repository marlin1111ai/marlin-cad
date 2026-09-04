import * as THREE from "three";
import {
  MULTICONNECT_CHANNEL_OUTLINE,
  MULTICONNECT_HEAD_RADIUS,
  MULTICONNECT_SLOT_CUT_DEPTH,
  MULTICONNECT_TERMINATOR_CLIP_Y,
  MULTICONNECT_TERMINATOR_WITH_DIMPLE_INDICES,
  MULTICONNECT_TERMINATOR_WITH_DIMPLE_POSITIONS,
} from "@/lib/multiconnectSlotMesh";
import {
  DEFAULT_MULTICONNECT_SLOT_TOLERANCE,
  MAX_MULTICONNECT_PLATE_DIMENSION,
  MAX_MULTICONNECT_SLOT_SPACING,
  MIN_MULTICONNECT_PLATE_DIMENSION,
  MIN_MULTICONNECT_SLOT_SPACING,
  MULTICONNECT_BACK_THICKNESS,
  MULTICONNECT_SLOT_TOP_OFFSET,
} from "@/lib/multiconnectContainerGeometry";
import {
  MIN_SOCKET_TRAY_FLOOR_THICKNESS,
  SOCKET_TRAY_POCKET_EDGE_CLEARANCE,
  SOCKET_TRAY_POCKET_GAP,
  SOCKET_TRAY_POCKET_SEGMENTS,
} from "@/lib/socketTrayGeometry";

// Mounted Socket Tray -- a Multiconnect-style slotted back plate (NO pegs)
// with a shelf-like tray projecting forward from its bottom, carrying round
// blind pockets. Emitted as ONE solid.
//
// This is a NEW primitive, additive only. It does not modify, wrap, or
// re-export the flat Socket Tray (socketTrayGeometry.ts) or the Multiconnect
// plate (multiconnectContainerGeometry.ts); both stay exactly as they are and
// are read-only references here. What IS shared with them is imported, never
// copy-pasted: the baked slot terminator + channel cross-section come from
// multiconnectSlotMesh.ts, the plate's dimensional constants from
// multiconnectContainerGeometry.ts, and the pocket guard constants from
// socketTrayGeometry.ts, so "the same rule the existing tray uses" is
// literally the same constant, not a duplicated number that can drift.
//
// Construction is a boundary representation, never a runtime CSG boolean and
// never two meshes concatenated (see CLAUDE-LESSONS.md: three-bvh-csg is
// unreliable exactly where a cut reaches a surface, and two interpenetrating
// closed volumes are not one solid no matter what file they land in).
//
// ===== THE L-PRISM, AND WHY THERE IS NO PLATE-TO-TRAY SEAM TO GET WRONG =====
//
// The recon (reference/reports/socket-tray-mounted-recon.md) named the
// plate-to-tray junction as the primary risk: two independently built face
// sets sharing an edge is exactly the ULP-mismatch failure mode in
// CLAUDE-LESSONS.md's exact-stitch entry, which only shows up at larger
// coordinate magnitudes -- i.e. at this part's 240mm width.
//
// That risk is designed out rather than mitigated. The plate and the tray are
// not two bodies joined at a seam: together they are ONE prism whose
// cross-section in the (Y, Z) plane is an L, extruded along X. The L outline
// is built once, as one array of six points, and EVERY face derives from it:
//
//        Z = 0                          Z = mountingFaceZ
//   Y=plateHeight                 D +--------------+ C   <- plate top (edge 2)
//                                   |              |
//                    plate front -> |              | <- mounting face (edge 1),
//                        (edge 3)   |              |    carries the slot mouths
//   Y=trayThickness   F +-----------+ E            |
//     tray top (edge 4) |            (inner corner)|
//     carries pockets   |                          |
//              Y=0    A +--------------------------+ B   <- bottom (edge 0),
//                        tray front (edge 5)            carries channel exits
//
// The six side faces are the six outline edges extruded from X=0 to
// X=plateWidth; the two end caps at X=0 and X=plateWidth are that same L
// polygon. Points D, E and F -- the junction the recon flagged -- are ordinary
// entries in the outline array, consumed by reference by both the side faces
// and the end caps. There is no second construction path to disagree with the
// first, so the shared vertices are bit-identical because they are the SAME
// doubles, not because two computations happened to agree. The exact
// directed-edge test in tests/unit/mountedSocketTrayGeometry.test.ts pins it.
//
// ===== SLOT CHANNEL CLEARANCE =====
//
// The Multiconnect slot is a blind keyhole: it opens on the mounting face and
// runs down and out through the plate's bottom edge, and that bottom opening
// is how the plate slides down onto seated connectors. It must stay clear.
//
// It does, unconditionally, for a forward-projecting tray. All slot geometry
// is measured from the MOUNTING face and cuts MULTICONNECT_SLOT_CUT_DEPTH
// (4.15mm) into it, so the channel occupies only the rear 4.15mm of the plate
// in Z. The tray lives entirely forward of the plate's front face. Extra plate
// thickness moves the blind floor further back, never toward the front. So the
// two never share a Z band as long as the plate is at least
// MULTICONNECT_BACK_THICKNESS (6.5mm = 4.15mm cut + 2.35mm skin) thick -- which
// normalizeMountedSocketTrayPlateThickness enforces as a floor. That floor IS
// the clearance guarantee; there is no tray height that can obstruct the
// channel, so tray placement needs no clearance rule of its own.
//
// ===== FRAME =====
//
// X = plate width [0, plateWidth] (left-right), Y = up [0, plateHeight],
// Z = depth [0, trayDepth + plateThickness]. Z = 0 is the tray's front edge
// (nearest the user), Z = trayDepth is the plate's front face, and
// Z = trayDepth + plateThickness is the mounting face that goes against the
// board. The tray sits at the bottom of the plate: Y in [0, trayThickness].
//
// Like the flat Socket Tray and unlike the Multiconnect PegPlate, pocket x is
// NOT mirrored. The mirror on the PegPlate exists because pegs address a front
// face viewed from the wall side; pockets here open UPWARD on a horizontal
// shelf, so x runs the same direction the viewport shows it.

export const DEFAULT_MOUNTED_SOCKET_TRAY_PLATE_WIDTH = 240;
export const DEFAULT_MOUNTED_SOCKET_TRAY_PLATE_HEIGHT = 60;
export const DEFAULT_MOUNTED_SOCKET_TRAY_PLATE_THICKNESS = 10;
export const DEFAULT_MOUNTED_SOCKET_TRAY_SLOT_SPACING = 28;
export const DEFAULT_MOUNTED_SOCKET_TRAY_SLOT_COUNT = 8;
export const DEFAULT_MOUNTED_SOCKET_TRAY_DEPTH = 60;
export const DEFAULT_MOUNTED_SOCKET_TRAY_THICKNESS = 18;
export const DEFAULT_MOUNTED_SOCKET_TRAY_POCKET_DEPTH = 14;

export const MIN_MOUNTED_SOCKET_TRAY_SLOT_COUNT = 1;
export const MAX_MOUNTED_SOCKET_TRAY_SLOT_COUNT = 20;
// Material kept between the outermost slot's widest (head-radius) extent and
// the plate's side edge. Same role as MULTICONNECT_CORNER_SLOT_CLEARANCE in the
// plate module: below this the side wall degenerates into a sliver.
export const MOUNTED_SOCKET_TRAY_SLOT_EDGE_CLEARANCE = 0.5;
// Slot tolerance is pinned at the Multiconnect default (1.0), the value the
// physically validated wrench racks use. Not exposed as a parameter: this
// primitive's whole point is to hang on the same connectors those racks do.
const SLOT_TOLERANCE = DEFAULT_MULTICONNECT_SLOT_TOLERANCE;

export type MountedSocketTrayPocket = {
  // Finished hole diameter, mm (the owner types the measured socket OD plus
  // their own clearance; no socket-size lookup happens anywhere).
  diameter: number;
  // Pocket center on the tray, geometry space. x from the LEFT edge, z from
  // the tray's FRONT edge. No view-space mirror -- see file header.
  x: number;
  z: number;
};

export type MountedSocketTrayOptions = {
  plateWidth?: number;
  plateHeight?: number;
  plateThickness?: number;
  slotSpacing?: number;
  slotCount?: number;
  trayDepth?: number;
  trayThickness?: number;
  // One depth for every pocket on the tray, not per pocket.
  pocketDepth?: number;
  pockets?: MountedSocketTrayPocket[];
};

function finiteOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeMountedSocketTrayPlateWidth(value?: number): number {
  return clamp(finiteOr(value, DEFAULT_MOUNTED_SOCKET_TRAY_PLATE_WIDTH), MIN_MULTICONNECT_PLATE_DIMENSION, MAX_MULTICONNECT_PLATE_DIMENSION);
}

export function normalizeMountedSocketTrayPlateHeight(value?: number): number {
  return clamp(finiteOr(value, DEFAULT_MOUNTED_SOCKET_TRAY_PLATE_HEIGHT), MIN_MULTICONNECT_PLATE_DIMENSION, MAX_MULTICONNECT_PLATE_DIMENSION);
}

// Floored at MULTICONNECT_BACK_THICKNESS: the slot mechanism needs the full
// 4.15mm cut plus the 2.35mm skin behind its blind floor, and that floor is
// exactly what keeps the forward tray out of the channel's Z band. See the
// SLOT CHANNEL CLEARANCE block in the file header.
export function normalizeMountedSocketTrayPlateThickness(value?: number): number {
  return Math.max(finiteOr(value, DEFAULT_MOUNTED_SOCKET_TRAY_PLATE_THICKNESS), MULTICONNECT_BACK_THICKNESS);
}

export function normalizeMountedSocketTraySlotSpacing(value?: number): number {
  return clamp(finiteOr(value, DEFAULT_MOUNTED_SOCKET_TRAY_SLOT_SPACING), MIN_MULTICONNECT_SLOT_SPACING, MAX_MULTICONNECT_SLOT_SPACING);
}

export function normalizeMountedSocketTraySlotCount(value?: number): number {
  return clamp(Math.round(finiteOr(value, DEFAULT_MOUNTED_SOCKET_TRAY_SLOT_COUNT)), MIN_MOUNTED_SOCKET_TRAY_SLOT_COUNT, MAX_MOUNTED_SOCKET_TRAY_SLOT_COUNT);
}

export function normalizeMountedSocketTrayDepth(value?: number): number {
  const depth = finiteOr(value, DEFAULT_MOUNTED_SOCKET_TRAY_DEPTH);
  if (depth <= 0) throw new Error(`mounted socket tray depth must be positive (got ${depth})`);
  return depth;
}

export function normalizeMountedSocketTrayThickness(value?: number): number {
  const thickness = finiteOr(value, DEFAULT_MOUNTED_SOCKET_TRAY_THICKNESS);
  if (thickness <= 0) throw new Error(`mounted socket tray thickness must be positive (got ${thickness})`);
  return thickness;
}

// Slot run centered on the plate. With an explicit count this reduces to
// (width - span) / 2; at count = floor(width / spacing) it reproduces the
// SCAD's own centering (240mm at 28mm spacing, 8 slots -> first center 22mm),
// which is the wrench-rack layout.
export function mountedSocketTraySlotCenters(plateWidth: number, slotSpacing: number, slotCount: number): number[] {
  const span = (slotCount - 1) * slotSpacing;
  const first = (plateWidth - span) / 2;
  return Array.from({ length: slotCount }, (_, index) => first + index * slotSpacing);
}

export function mountedSocketTrayDimensions(options: MountedSocketTrayOptions = {}) {
  return {
    width: normalizeMountedSocketTrayPlateWidth(options.plateWidth),
    height: normalizeMountedSocketTrayPlateHeight(options.plateHeight),
    // Full Z extent of the solid: the tray's projection plus the plate behind it.
    depth: normalizeMountedSocketTrayDepth(options.trayDepth) + normalizeMountedSocketTrayPlateThickness(options.plateThickness),
  };
}

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

type NormalizedPocket = { x: number; z: number; radius: number };

// Validates the caller-provided pocket layout the same way the flat tray's
// normalizedPockets does, against the SAME imported constants: positions are
// explicit (no auto-layout), so a bad layout is a caller bug and this throws
// rather than silently dropping or nudging pockets.
function normalizedPockets(
  pockets: MountedSocketTrayPocket[],
  plateWidth: number,
  trayDepth: number,
  trayThickness: number,
  pocketDepth: number,
): NormalizedPocket[] {
  if (!Number.isFinite(pocketDepth) || pocketDepth <= 0) {
    throw new Error(`mounted socket tray pocket depth must be finite and positive (got ${pocketDepth})`);
  }
  if (pockets.length > 0 && trayThickness - pocketDepth < MIN_SOCKET_TRAY_FLOOR_THICKNESS) {
    throw new Error(
      `mounted socket tray: pocket depth ${pocketDepth}mm leaves less than the ${MIN_SOCKET_TRAY_FLOOR_THICKNESS}mm minimum floor at tray thickness ${trayThickness}mm`,
    );
  }
  const result: NormalizedPocket[] = [];
  pockets.forEach((pocket, index) => {
    const { diameter, x, z } = pocket;
    if (![diameter, x, z].every(Number.isFinite) || diameter <= 0) {
      throw new Error(`mounted socket tray pocket ${index}: diameter/x/z must be finite and the diameter positive`);
    }
    const radius = diameter / 2;
    if (
      x - radius < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      x + radius > plateWidth - SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      z - radius < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      z + radius > trayDepth - SOCKET_TRAY_POCKET_EDGE_CLEARANCE
    ) {
      throw new Error(`mounted socket tray pocket ${index}: footprint (r=${radius}mm) is within ${SOCKET_TRAY_POCKET_EDGE_CLEARANCE}mm of the tray edge`);
    }
    result.push({ x, z, radius });
  });
  for (let i = 0; i < result.length; i += 1) {
    for (let j = i + 1; j < result.length; j += 1) {
      const distance = Math.hypot(result[i].x - result[j].x, result[i].z - result[j].z);
      if (distance < result[i].radius + result[j].radius + SOCKET_TRAY_POCKET_GAP) {
        throw new Error(`mounted socket tray pockets ${i} and ${j}: footprints overlap or leave too thin a wall (centers ${distance.toFixed(2)}mm apart)`);
      }
    }
  }
  return result;
}

// ===== baked terminator: split + mouth-rim extraction =====
//
// Same technique multiconnectContainerGeometry.ts uses on the same baked
// arrays, reimplemented here rather than imported because that module's
// buildTerminatorData is local and unexported. The DATA is imported; only the
// (short, mechanical) split is restated.

type TerminatorData = {
  // Local soup (across, slide, depth), cutter-outward winding, with the mouth
  // cap and the clip cap dropped -- what is left becomes hole-interior surface.
  keptSoup: number[];
  // Ordered mouth-rim polyline in (across, slide): the kept surface's exact
  // boundary on the mounting-face plane. Used verbatim as the mounting-face
  // cap's notch boundary, so no T-junction can exist along that seam.
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
    // Baked coordinates are 1e-4-quantized at bake time, so cap membership is
    // exact equality against those baked values, not a tolerance band.
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
    throw new Error(`mounted socket tray terminator mouth rim is not a simple open chain (${endpoints.length} endpoints)`);
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
    throw new Error("mounted socket tray terminator mouth rim did not chain into a single polyline");
  }
  return { keptSoup, mouthRim };
}

let terminatorCache: TerminatorData | null = null;

// The dimpled terminator is the default everywhere in this repo: the crater in
// the blind floor prints as the lock bump that holds the plate on the
// connector. Quick-release (no dimple) is not exposed by this primitive.
function terminatorData(): TerminatorData {
  terminatorCache ??= buildTerminatorData(MULTICONNECT_TERMINATOR_WITH_DIMPLE_POSITIONS, MULTICONNECT_TERMINATOR_WITH_DIMPLE_INDICES);
  return terminatorCache;
}

// ===== triangle emission helpers =====

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

function pushQuad(out: number[], corners: [Point3, Point3, Point3, Point3], desiredNormal: Point3) {
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

export function mountedSocketTrayPositions(options: MountedSocketTrayOptions = {}): number[] {
  const plateWidth = normalizeMountedSocketTrayPlateWidth(options.plateWidth);
  const plateHeight = normalizeMountedSocketTrayPlateHeight(options.plateHeight);
  const plateThickness = normalizeMountedSocketTrayPlateThickness(options.plateThickness);
  const slotSpacing = normalizeMountedSocketTraySlotSpacing(options.slotSpacing);
  const slotCount = normalizeMountedSocketTraySlotCount(options.slotCount);
  const trayDepth = normalizeMountedSocketTrayDepth(options.trayDepth);
  const trayThickness = normalizeMountedSocketTrayThickness(options.trayThickness);
  const pocketDepth = finiteOr(options.pocketDepth, DEFAULT_MOUNTED_SOCKET_TRAY_POCKET_DEPTH);

  // The tray occupies the bottom of the plate's front face, so it has to leave
  // some plate above it -- otherwise outline points D and E cross and the L
  // self-intersects.
  if (trayThickness >= plateHeight) {
    throw new Error(`mounted socket tray: tray thickness ${trayThickness}mm must be less than plate height ${plateHeight}mm`);
  }
  // The slot run must stay inside the plate with a real side wall beside the
  // widest (head-radius) extent of the outermost slots.
  const centers = mountedSocketTraySlotCenters(plateWidth, slotSpacing, slotCount);
  const headHalfWidth = MULTICONNECT_HEAD_RADIUS * SLOT_TOLERANCE;
  if (
    centers[0] - headHalfWidth < MOUNTED_SOCKET_TRAY_SLOT_EDGE_CLEARANCE ||
    centers[centers.length - 1] + headHalfWidth > plateWidth - MOUNTED_SOCKET_TRAY_SLOT_EDGE_CLEARANCE
  ) {
    throw new Error(
      `mounted socket tray: ${slotCount} slots at ${slotSpacing}mm spacing do not fit a ${plateWidth}mm plate with ${MOUNTED_SOCKET_TRAY_SLOT_EDGE_CLEARANCE}mm beside the outer slots`,
    );
  }
  // The slot's round top sits MULTICONNECT_SLOT_TOP_OFFSET below the plate's
  // top edge and its channel runs from there down to the bottom edge, so the
  // plate has to be at least that tall for a channel to exist at all.
  const topCenterY = plateHeight - MULTICONNECT_SLOT_TOP_OFFSET;
  if (topCenterY <= 0) {
    throw new Error(`mounted socket tray: plate height ${plateHeight}mm leaves no room for a slot ${MULTICONNECT_SLOT_TOP_OFFSET}mm below the top edge`);
  }

  const pockets = normalizedPockets(options.pockets ?? [], plateWidth, trayDepth, trayThickness, pocketDepth);

  // Z planes. All slot geometry is measured from the MOUNTING face, so extra
  // plate thickness goes entirely into the front skin: the blind floor moves
  // away from the tray, never toward it. Both planes come from this one
  // expression path so the mounting-face cap and the transformed baked mouth
  // rim can never disagree by a ULP.
  const mountingFaceZ = trayDepth + plateThickness;
  const blindFloorZ = mountingFaceZ - MULTICONNECT_SLOT_CUT_DEPTH;
  const plateFrontZ = trayDepth;

  // THE shared L outline, in (y, z), counter-clockwise when z runs right and y
  // runs up. Every face below reads its corners out of THIS array -- see the
  // L-PRISM block in the file header.
  const outline: Point2[] = [
    [0, 0], // A  bottom front
    [0, mountingFaceZ], // B  bottom back
    [plateHeight, mountingFaceZ], // C  plate top back
    [plateHeight, plateFrontZ], // D  plate top front
    [trayThickness, plateFrontZ], // E  inner corner (plate front meets tray top)
    [trayThickness, 0], // F  tray top front
  ];

  // THE shared slot transform: every slot-derived world coordinate -- baked
  // vertices, prism walls, cap notch boundaries -- goes through these exact
  // expressions so shared seam vertices are bit-identical.
  const worldX = (cx: number, across: number) => cx + across * SLOT_TOLERANCE;
  const worldY = (slide: number) => topCenterY + slide * SLOT_TOLERANCE;
  const worldZ = (depth: number) => blindFloorZ + depth;

  const { keptSoup, mouthRim } = terminatorData();
  const positions: number[] = [];

  // Pocket rim/floor rings, precomputed once. The SAME Point3 objects feed
  // both the tray top cap's hole contour and the pocket wall's top ring, so
  // that seam is bit-identical by construction.
  const trayTopY = trayThickness;
  const pocketBuilds = pockets.map((pocket) => {
    const floorY = trayTopY - pocketDepth;
    const rim: Point3[] = POCKET_ANGLES.map((angle) => [pocket.x + pocket.radius * Math.cos(angle), trayTopY, pocket.z + pocket.radius * Math.sin(angle)]);
    const floorRing: Point3[] = POCKET_ANGLES.map((angle) => [pocket.x + pocket.radius * Math.cos(angle), floorY, pocket.z + pocket.radius * Math.sin(angle)]);
    return { floorY, rim, floorRing };
  });
  const pocketHoles: Point2[][] = pocketBuilds.map(({ rim }) => rim.map(([x, , z]) => [x, z]));

  // ---- the two end caps: the L outline itself, at X = 0 and X = plateWidth.
  pushCap(positions, outline, ([y, z]) => [0, y, z], [-1, 0, 0]);
  pushCap(positions, outline, ([y, z]) => [plateWidth, y, z], [1, 0, 0]);

  // ---- outline edge 0 (A->B): bottom face, Y = 0, with one keyhole notch per
  // slot opening through its mounting-face edge. Traversed along
  // Z = mountingFaceZ from x = plateWidth back to 0, diving around each channel
  // cross-section (outline indices 3..0 then 7..4 -- everything except the open
  // neck-top edge, which lies in the mounting face).
  const notchOrder = [3, 2, 1, 0, 7, 6, 5, 4];
  const bottomContour: Point2[] = [[outline[0][1], outline[0][0]], [plateWidth, 0], [plateWidth, outline[1][1]]];
  for (const cx of [...centers].reverse()) {
    for (const outlineIndex of notchOrder) {
      const [across, depth] = MULTICONNECT_CHANNEL_OUTLINE[outlineIndex];
      bottomContour.push([worldX(cx, across), worldZ(depth)]);
    }
  }
  bottomContour.push([0, outline[1][1]]);
  pushCap(positions, bottomContour, ([x, z]) => [x, 0, z], [0, -1, 0]);

  // ---- outline edge 1 (B->C): mounting face, Z = mountingFaceZ, with one
  // notch per slot: straight strip sides matching the channel prism's neck
  // walls, closed over the top by the baked mouth rim polyline (whose
  // first/last points ARE the strip corners at the clip plane).
  const mountingContour: Point2[] = [[0, 0]];
  for (const cx of centers) {
    const stripLeftX = worldX(cx, mouthRim[0][0]);
    const stripRightX = worldX(cx, mouthRim[mouthRim.length - 1][0]);
    mountingContour.push([stripLeftX, 0]);
    for (const [across, slide] of mouthRim) mountingContour.push([worldX(cx, across), worldY(slide)]);
    mountingContour.push([stripRightX, 0]);
  }
  mountingContour.push([plateWidth, 0], [plateWidth, outline[2][0]], [0, outline[2][0]]);
  pushCap(positions, mountingContour, ([x, y]) => [x, y, mountingFaceZ], [0, 0, 1]);

  // ---- outline edge 4 (E->F): tray top, Y = trayThickness, notched with each
  // pocket's exact rim contour as an earcut hole. This is the ONLY face a
  // pocket ever opens through, so "the floor stays solid" holds by
  // construction -- nothing in this builder emits geometry between a pocket's
  // floor and the tray's bottom face.
  const trayTopContour: Point2[] = [[0, 0], [plateWidth, 0], [plateWidth, outline[4][1]], [0, outline[4][1]]];
  pushCap(positions, trayTopContour, ([x, z]) => [x, trayTopY, z], [0, 1, 0], pocketHoles);

  // ---- outline edges 2, 3, 5: plain rectangles, read straight out of the
  // shared outline so their corners are the same doubles the end caps used.
  for (const edge of [2, 3, 5]) {
    const p = outline[edge];
    const q = outline[(edge + 1) % outline.length];
    // Outward direction for a CCW outline in (z, y): the edge direction
    // rotated -90 degrees.
    const outward: Point3 = [0, -(q[1] - p[1]), q[0] - p[0]];
    pushQuad(
      positions,
      [
        [0, p[0], p[1]],
        [plateWidth, p[0], p[1]],
        [plateWidth, q[0], q[1]],
        [0, q[0], q[1]],
      ],
      outward,
    );
  }

  // ---- per-slot interior surfaces.
  for (const cx of centers) {
    // Baked terminator: transform + reverse winding (cutter-outward becomes
    // hole-inward / blind-floor-outward). The blind floor and crater
    // triangulation pass through verbatim, never re-derived.
    for (let i = 0; i + 8 < keptSoup.length; i += 9) {
      const vertex = (offset: number): Point3 => [
        worldX(cx, keptSoup[i + offset]),
        worldY(keptSoup[i + offset + 1]),
        worldZ(keptSoup[i + offset + 2]),
      ];
      pushTriangle(positions, vertex(0), vertex(6), vertex(3));
    }

    // Straight channel prism from the terminator clip plane down through the
    // bottom face: one wall per outline edge except the neck-top edge
    // (index 3 -> 4), which lies in the open mounting face. The closing edge
    // (7 -> 0) is the channel's blind floor.
    const yTop = worldY(MULTICONNECT_TERMINATOR_CLIP_Y);
    for (let edge = 0; edge < MULTICONNECT_CHANNEL_OUTLINE.length; edge += 1) {
      if (edge === 3) continue;
      const [pAcross, pDepth] = MULTICONNECT_CHANNEL_OUTLINE[edge];
      const [qAcross, qDepth] = MULTICONNECT_CHANNEL_OUTLINE[(edge + 1) % MULTICONNECT_CHANNEL_OUTLINE.length];
      const p0: Point3 = [worldX(cx, pAcross), yTop, worldZ(pDepth)];
      const p1: Point3 = [worldX(cx, qAcross), yTop, worldZ(qDepth)];
      const p2: Point3 = [worldX(cx, qAcross), 0, worldZ(qDepth)];
      const p3: Point3 = [worldX(cx, pAcross), 0, worldZ(pDepth)];
      // Wall normal must point into the void: for the CCW outline that is the
      // edge direction rotated +90deg in (across, depth).
      const inward: Point3 = [-(qDepth - pDepth) * SLOT_TOLERANCE, 0, (qAcross - pAcross) * SLOT_TOLERANCE];
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

  // ---- per-pocket interior: cylindrical wall (top rim down to floor ring)
  // plus the flat floor cap, reusing rim/floorRing verbatim.
  for (const { floorY, rim, floorRing } of pocketBuilds) {
    const segments = SOCKET_TRAY_POCKET_SEGMENTS;
    for (let i = 0; i < segments; i += 1) {
      const j = (i + 1) % segments;
      const p0 = rim[i];
      const p1 = rim[j];
      const p2 = floorRing[j];
      const p3 = floorRing[i];
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
    // Floor cap: the pocket's blind bottom, normal pointing up into the cavity
    // (away from the solid material below it, toward the socket).
    pushCap(positions, floorRing.map(([x, , z]) => [x, z] as Point2), ([x, z]) => [x, floorY, z], [0, 1, 0]);
  }

  return positions;
}

export function createMountedSocketTrayGeometry(options: MountedSocketTrayOptions = {}): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(mountedSocketTrayPositions(options), 3));
  geometry.computeVertexNormals();
  return geometry;
}
