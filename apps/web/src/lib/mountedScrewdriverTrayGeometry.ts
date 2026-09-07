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
  SOCKET_TRAY_FILLET_SEGMENTS,
  SOCKET_TRAY_POCKET_EDGE_CLEARANCE,
  SOCKET_TRAY_POCKET_GAP,
  SOCKET_TRAY_POCKET_SEGMENTS,
} from "@/lib/socketTrayGeometry";
import { MIN_SCREWDRIVER_TRAY_THICKNESS } from "@/lib/screwdriverTrayGeometry";

// Mounted Screwdriver Tray -- a Multiconnect-style slotted back plate (NO
// pegs) with a shelf projecting forward from its bottom, carrying round
// THROUGH-BORES. Emitted as ONE solid. The wall-hanging sibling of the flat
// Screwdriver Tray: a screwdriver's shaft passes all the way through the shelf
// and its handle rests on the shelf's top face, so a bore has no floor and
// there is no pocket depth to type.
//
// This is a NEW primitive, additive only. It does not modify, wrap or
// re-export any of the three trays that came before it
// (socketTrayGeometry.ts, mountedSocketTrayGeometry.ts,
// screwdriverTrayGeometry.ts); all three stay exactly as they are and are
// read-only references here. What IS shared with them is imported, never
// copy-pasted: the baked slot terminator + channel cross-section from
// multiconnectSlotMesh.ts, the plate's dimensional constants from
// multiconnectContainerGeometry.ts, the hole-layout guard constants from
// socketTrayGeometry.ts, and the 10mm minimum tray thickness from
// screwdriverTrayGeometry.ts -- so "the same rule the flat screwdriver tray
// uses" is literally the same constant, not a duplicated number that can
// drift.
//
// Construction is a boundary representation, never a runtime CSG boolean and
// never two meshes concatenated (see CLAUDE-LESSONS.md: three-bvh-csg is
// unreliable exactly where a cut reaches a surface -- and a through-bore
// reaches TWO -- and two interpenetrating closed volumes are not one solid no
// matter what file they land in).
//
// ===== THE L-PRISM, AND WHY THERE IS NO PLATE-TO-TRAY SEAM TO GET WRONG =====
//
// Copied wholesale from the Mounted Socket Tray, for the same reason it was
// built that way there: two independently built face sets sharing an edge is
// exactly the ULP-mismatch failure mode in CLAUDE-LESSONS.md's exact-stitch
// entry, which only shows up at larger coordinate magnitudes -- i.e. at this
// part's 240mm width.
//
// The plate and the tray are not two bodies joined at a seam: together they
// are ONE prism whose cross-section in the (Y, Z) plane is an L, extruded
// along X. The L outline is built once, as one array of six points, and EVERY
// face derives from it:
//
//        Z = 0                          Z = mountingFaceZ
//   Y=plateHeight                 D +--------------+ C   <- plate top (edge 2)
//                                   |              |
//                    plate front -> |              | <- mounting face (edge 1),
//                        (edge 3)   |              |    carries the slot mouths
//   Y=trayThickness   F +-----------+ E            |
//     tray top (edge 4) |            (inner corner)|
//     carries the bores |                          |
//              Y=0    A +--------------------------+ B   <- bottom (edge 0),
//                        tray front (edge 5)            carries channel exits
//                                                       AND the bore exits
//
// The six side faces are the six outline edges extruded from X=0 to
// X=plateWidth; the two end caps at X=0 and X=plateWidth are that same L
// polygon. Points D, E and F -- the junction -- are ordinary entries in the
// outline array, consumed by reference by both the side faces and the end
// caps. There is no second construction path to disagree with the first, so
// the shared vertices are bit-identical because they are the SAME doubles.
// The exact directed-edge test and the dedicated inner-corner test in
// tests/unit/mountedScrewdriverTrayGeometry.test.ts pin it.
//
// ===== WHAT DIFFERS FROM THE MOUNTED SOCKET TRAY =====
//
// Exactly the same three differences the flat Screwdriver Tray has from the
// flat Socket Tray, and nothing else:
//
// - There is no floor cap. That is the only triangle emission the mounted
//   socket tray has and this file does not.
// - The bore wall spans the full tray thickness (shelf top face to Y = 0)
//   instead of stopping at a floor plane.
// - The BOTTOM face is notched with the bores as well. On the mounted socket
//   tray that face is a single earcut cap whose CONTOUR already dives around
//   one slot-channel cross-section per slot; here the same cap additionally
//   carries one earcut HOLE per bore.
//
// The bores and the slot channels share that one face and cannot collide.
// Bore footprints are bounded in Z by the edge-clearance guard at
// `z + radius <= trayDepth - SOCKET_TRAY_POCKET_EDGE_CLEARANCE`, so the
// furthest-back point of any allowed bore is `trayDepth - 5`. The channel
// occupies `[mountingFaceZ - MULTICONNECT_SLOT_CUT_DEPTH, mountingFaceZ]`
// = `[trayDepth + plateThickness - 4.15, trayDepth + plateThickness]`, and
// plateThickness is floored at MULTICONNECT_BACK_THICKNESS (6.5), so the
// channel's nearest point is at worst `trayDepth + 2.35`. The gap is
// therefore at least 7.35mm in Z, independent of plate thickness, tray depth,
// tray thickness, bore diameter, slot count and slot spacing -- extra plate
// thickness moves the channel further away, never closer. See
// reference/reports/screwdriver-tray-recon.md section 5.
//
// There is also no depth anywhere: no per-bore depth, no shared depth option,
// and none of the mounted socket tray's floor-thickness or depth-vs-radius
// guards. A bore is Diameter / X / Z and nothing else.
//
// ===== SLOT CHANNEL CLEARANCE =====
//
// The Multiconnect slot is a blind keyhole: it opens on the mounting face and
// runs down and out through the plate's bottom edge, and that bottom opening
// is how the plate slides down onto seated connectors. It must stay clear.
//
// It does, unconditionally, for a forward-projecting tray, by the same
// argument as above: all slot geometry is measured from the MOUNTING face and
// cuts MULTICONNECT_SLOT_CUT_DEPTH (4.15mm) into it, so the channel occupies
// only the rear 4.15mm of the plate in Z, while the tray lives entirely
// forward of the plate's front face. Extra plate thickness moves the blind
// floor further back, never toward the front. normalizeMounted-
// ScrewdriverTrayPlateThickness enforces the 6.5mm floor that carries the
// guarantee; there is no tray height or bore position that can obstruct the
// channel, so bore placement needs no clearance rule of its own.
//
// ===== FRAME =====
//
// X = plate width [0, plateWidth] (left-right), Y = up [0, plateHeight],
// Z = depth [0, trayDepth + plateThickness]. Z = 0 is the tray's front edge
// (nearest the user), Z = trayDepth is the plate's front face, and
// Z = trayDepth + plateThickness is the mounting face that goes against the
// board. The tray sits at the bottom of the plate: Y in [0, trayThickness].
//
// ===================== MOUNTED-VIEW X CONVENTION =====================
//
// Like the Multiconnect PegPlate and the Mounted Socket Tray, and UNLIKE both
// flat trays, bore x IS mirrored: `holes[].x` is measured from the LEFT edge
// as the viewer standing in front of the MOUNTED part sees it, and
// normalizedHoles mirrors it into geometry space at exactly one marked spot
// (x_geometry = plateWidth - x_viewed).
//
// Why this part inherits the plate's rule, not the flat tray's: this shape has
// a FIXED as-mounted viewing side. The mounting face (Z = trayDepth +
// plateThickness) goes against the board and the tray projects forward to
// Z = 0, so the viewer always stands at low Z and looks along +Z -- and a
// viewer looking along +Z with +Y up has +X on their LEFT. Geometry x = 0 is
// therefore the mounted viewer's RIGHT edge, exactly as on the Multiconnect
// plate. Nothing about that mapping is changed by a bore opening upward, or by
// its opening downward as well: opening direction is a Y-axis fact, while
// left/right is an X-axis fact about a rigid body whose orientation the wall
// mount fully determines.
//
// The flat trays' no-mirror exemption does NOT apply here. Those trays are
// standalone and lie flat with no fixed viewing side, so their x reads plain
// left-to-right. This one cannot be viewed from the other side -- the slot
// channel runs down and out the bottom edge and the shelf projects forward,
// which between them leave exactly one valid mounting orientation.
//
// This is the bug that shipped on the Mounted Socket Tray and was fixed on
// 2026-09-06 (KNOWN-FIXES.md, DECISIONS.md's CORRECTED entry): it had wrongly
// inherited the flat tray's rule, so a pocket typed at X = 30 rendered near
// the RIGHT end. It is invisible to every geometry check and to a symmetric
// test layout, so the tests pin it with an asymmetric layout.
//
// Slots need no equivalent mirror: mountedScrewdriverTraySlotCenters is
// mirror-symmetric by construction, so mirroring the slot run maps it onto
// itself. Bore z is likewise unaffected -- it runs front-to-back, which a
// left/right mirror does not touch.
// =====================================================================
//
// ===== CORNER RADIUS (fillet) =====
//
// Same owner-typed fillet as the other three trays, same technique (an extra
// ring of points inserted along a quarter-circle arc at each rounded edge,
// using SOCKET_TRAY_FILLET_SEGMENTS imported from socketTrayGeometry.ts --
// read, never copy-pasted). Two edges of the L cross-section are rounded, each
// a lengthwise edge swept the full plateWidth, using the SAME local derivation
// both times (a +Y-outward horizontal face meeting a -Z-outward vertical face):
//
// - Corner D (plate top meets plate front) -- the plate's own outer top edge.
// - Corner F (tray top meets tray front) -- the tray's own outer top edge.
//
// Plus every bore's TOP rim, eased the same way the flat Screwdriver Tray
// eases its own.
//
// Left sharp, deliberately:
// - **Every bore's BOTTOM rim.** Owner's decision (option A of
//   reference/reports/screwdriver-tray-recon.md section 4), matching the flat
//   Screwdriver Tray. The bottom face is notched with each bore's NOMINAL
//   radius and there is no bottom fillet code in this file at all, so the
//   straight-wall guard stays `cornerRadius < trayThickness` (carried by
//   cornerFRoom below) rather than tightening to `2 * cornerRadius`.
// - Corner E (the L-junction itself) -- excluded, as on the Mounted Socket
//   Tray. Nothing here touches point E or either adjacent edge's E-end.
// - Corners A and B (the two bottom edges) -- the flat-on-bed contact edges.
// - Corner C (plate top meets the mounting face) -- keeps the mounting face's
//   own edge exactly as validated.
// - The two end-cap perimeters are not separately filleted; rounding D and F
//   inserts the arc directly into the shared L outline, so the end caps show
//   the same rounded profile with no separate treatment.

export const DEFAULT_MOUNTED_SCREWDRIVER_TRAY_PLATE_WIDTH = 240;
export const DEFAULT_MOUNTED_SCREWDRIVER_TRAY_PLATE_HEIGHT = 60;
export const DEFAULT_MOUNTED_SCREWDRIVER_TRAY_PLATE_THICKNESS = 10;
export const DEFAULT_MOUNTED_SCREWDRIVER_TRAY_SLOT_SPACING = 28;
export const DEFAULT_MOUNTED_SCREWDRIVER_TRAY_SLOT_COUNT = 8;
export const DEFAULT_MOUNTED_SCREWDRIVER_TRAY_DEPTH = 60;
export const DEFAULT_MOUNTED_SCREWDRIVER_TRAY_THICKNESS = 18;
export const DEFAULT_MOUNTED_SCREWDRIVER_TRAY_CORNER_RADIUS = 0;

export const MIN_MOUNTED_SCREWDRIVER_TRAY_SLOT_COUNT = 1;
export const MAX_MOUNTED_SCREWDRIVER_TRAY_SLOT_COUNT = 20;
// Material kept between the outermost slot's widest (head-radius) extent and
// the plate's side edge. Same role and value as the Mounted Socket Tray's own
// constant: below this the side wall degenerates into a sliver.
export const MOUNTED_SCREWDRIVER_TRAY_SLOT_EDGE_CLEARANCE = 0.5;
// Slot tolerance is pinned at the Multiconnect default (1.0), the value the
// physically validated wrench racks use. Not exposed as a parameter: this
// primitive's whole point is to hang on the same connectors those racks do.
const SLOT_TOLERANCE = DEFAULT_MULTICONNECT_SLOT_TOLERANCE;

export type MountedScrewdriverTrayHole = {
  // Finished bore diameter, mm (the owner types the measured shaft diameter
  // plus their own clearance; no screwdriver-size lookup happens anywhere).
  diameter: number;
  // Bore center on the shelf. x is in AS-MOUNTED VIEW SPACE: measured from the
  // LEFT edge as the viewer standing in front of the mounted part sees it,
  // mirrored into geometry space by normalizedHoles -- see the MOUNTED-VIEW X
  // CONVENTION block in the file header. z is plain geometry space, from the
  // tray's FRONT edge, and is not mirrored.
  x: number;
  z: number;
};

export type MountedScrewdriverTrayOptions = {
  plateWidth?: number;
  plateHeight?: number;
  plateThickness?: number;
  slotSpacing?: number;
  slotCount?: number;
  trayDepth?: number;
  trayThickness?: number;
  // Owner-typed fillet radius, applied to the plate's own top edge (corner D),
  // the tray's own top edge (corner F), and every bore's TOP rim. 0 (default)
  // = sharp. Never applied to the L-junction (corner E) or to any bore's
  // BOTTOM rim -- see the file header.
  cornerRadius?: number;
  holes?: MountedScrewdriverTrayHole[];
};

function finiteOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeMountedScrewdriverTrayPlateWidth(value?: number): number {
  return clamp(finiteOr(value, DEFAULT_MOUNTED_SCREWDRIVER_TRAY_PLATE_WIDTH), MIN_MULTICONNECT_PLATE_DIMENSION, MAX_MULTICONNECT_PLATE_DIMENSION);
}

export function normalizeMountedScrewdriverTrayPlateHeight(value?: number): number {
  return clamp(finiteOr(value, DEFAULT_MOUNTED_SCREWDRIVER_TRAY_PLATE_HEIGHT), MIN_MULTICONNECT_PLATE_DIMENSION, MAX_MULTICONNECT_PLATE_DIMENSION);
}

// Floored at MULTICONNECT_BACK_THICKNESS: the slot mechanism needs the full
// 4.15mm cut plus the 2.35mm skin behind its blind floor, and that floor is
// exactly what keeps the forward tray -- and now its through-bores -- out of
// the channel's Z band. See the SLOT CHANNEL CLEARANCE block in the header.
export function normalizeMountedScrewdriverTrayPlateThickness(value?: number): number {
  return Math.max(finiteOr(value, DEFAULT_MOUNTED_SCREWDRIVER_TRAY_PLATE_THICKNESS), MULTICONNECT_BACK_THICKNESS);
}

export function normalizeMountedScrewdriverTraySlotSpacing(value?: number): number {
  return clamp(finiteOr(value, DEFAULT_MOUNTED_SCREWDRIVER_TRAY_SLOT_SPACING), MIN_MULTICONNECT_SLOT_SPACING, MAX_MULTICONNECT_SLOT_SPACING);
}

export function normalizeMountedScrewdriverTraySlotCount(value?: number): number {
  return clamp(Math.round(finiteOr(value, DEFAULT_MOUNTED_SCREWDRIVER_TRAY_SLOT_COUNT)), MIN_MOUNTED_SCREWDRIVER_TRAY_SLOT_COUNT, MAX_MOUNTED_SCREWDRIVER_TRAY_SLOT_COUNT);
}

export function normalizeMountedScrewdriverTrayDepth(value?: number): number {
  const depth = finiteOr(value, DEFAULT_MOUNTED_SCREWDRIVER_TRAY_DEPTH);
  if (depth <= 0) throw new Error(`mounted screwdriver tray depth must be positive (got ${depth})`);
  return depth;
}

// Unlike the Mounted Socket Tray's "must be positive", this enforces the flat
// Screwdriver Tray's own 10mm minimum -- the SAME imported constant, since a
// through-bore needs the same minimum length to hold a shaft upright whether
// the tray is standing on a bench or hanging on a board. Thrown rather than
// clamped, matching every other layout guard in this family.
export function normalizeMountedScrewdriverTrayThickness(value?: number): number {
  const thickness = finiteOr(value, DEFAULT_MOUNTED_SCREWDRIVER_TRAY_THICKNESS);
  if (thickness < MIN_SCREWDRIVER_TRAY_THICKNESS) {
    throw new Error(`mounted screwdriver tray thickness ${thickness}mm is below the ${MIN_SCREWDRIVER_TRAY_THICKNESS}mm minimum`);
  }
  return thickness;
}

// Zero or positive only -- 0 (sharp) is the default, valid state.
export function normalizeMountedScrewdriverTrayCornerRadius(value?: number): number {
  const radius = finiteOr(value, DEFAULT_MOUNTED_SCREWDRIVER_TRAY_CORNER_RADIUS);
  if (radius < 0) throw new Error(`mounted screwdriver tray corner radius must be zero or positive (got ${radius})`);
  return radius;
}

// Slot run centered on the plate. With an explicit count this reduces to
// (width - span) / 2; at count = floor(width / spacing) it reproduces the
// SCAD's own centering (240mm at 28mm spacing, 8 slots -> first center 22mm),
// which is the wrench-rack layout. Mirror-symmetric by construction, which is
// why the slots need no as-mounted mirror of their own.
export function mountedScrewdriverTraySlotCenters(plateWidth: number, slotSpacing: number, slotCount: number): number[] {
  const span = (slotCount - 1) * slotSpacing;
  const first = (plateWidth - span) / 2;
  return Array.from({ length: slotCount }, (_, index) => first + index * slotSpacing);
}

export function mountedScrewdriverTrayDimensions(options: MountedScrewdriverTrayOptions = {}) {
  return {
    width: normalizeMountedScrewdriverTrayPlateWidth(options.plateWidth),
    height: normalizeMountedScrewdriverTrayPlateHeight(options.plateHeight),
    // Full Z extent of the solid: the tray's projection plus the plate behind it.
    depth: normalizeMountedScrewdriverTrayDepth(options.trayDepth) + normalizeMountedScrewdriverTrayPlateThickness(options.plateThickness),
  };
}

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

type NormalizedHole = { x: number; z: number; radius: number };

// Validates the caller-provided bore layout the same way the flat Screwdriver
// Tray's normalizedHoles does, against the SAME imported constants: positions
// are explicit (no auto-layout), so a bad layout is a caller bug and this
// throws rather than silently dropping or nudging bores. There is no depth to
// check and no floor to protect -- the mounted socket tray's floor-thickness
// guard has no analogue here.
function normalizedHoles(holes: MountedScrewdriverTrayHole[], plateWidth: number, trayDepth: number): NormalizedHole[] {
  const result: NormalizedHole[] = [];
  holes.forEach((hole, index) => {
    const { diameter, x, z } = hole;
    if (![diameter, x, z].every(Number.isFinite) || diameter <= 0) {
      throw new Error(`mounted screwdriver tray hole ${index}: diameter/x/z must be finite and the diameter positive`);
    }
    // MOUNTED-VIEW MIRROR -- the one place viewed-space x (see
    // MountedScrewdriverTrayHole) becomes geometry X. Everything downstream of
    // this line works in geometry space only. Same operation, same reason as
    // multiconnectContainerGeometry.ts's normalizedPegs and
    // mountedSocketTrayGeometry.ts's normalizedPockets; do NOT "simplify" it
    // away, and do NOT "harmonize" it with the flat Screwdriver Tray, which is
    // correctly unmirrored because it has no fixed viewing side.
    const geometryX = plateWidth - x;
    const radius = diameter / 2;
    if (
      geometryX - radius < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      geometryX + radius > plateWidth - SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      z - radius < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      z + radius > trayDepth - SOCKET_TRAY_POCKET_EDGE_CLEARANCE
    ) {
      throw new Error(`mounted screwdriver tray hole ${index}: footprint (r=${radius}mm) is within ${SOCKET_TRAY_POCKET_EDGE_CLEARANCE}mm of the tray edge`);
    }
    result.push({ x: geometryX, z, radius });
  });
  for (let i = 0; i < result.length; i += 1) {
    for (let j = i + 1; j < result.length; j += 1) {
      const distance = Math.hypot(result[i].x - result[j].x, result[i].z - result[j].z);
      if (distance < result[i].radius + result[j].radius + SOCKET_TRAY_POCKET_GAP) {
        throw new Error(`mounted screwdriver tray holes ${i} and ${j}: footprints overlap or leave too thin a wall (centers ${distance.toFixed(2)}mm apart)`);
      }
    }
  }
  return result;
}

// ===== baked terminator: split + mouth-rim extraction =====
//
// Same technique multiconnectContainerGeometry.ts and
// mountedSocketTrayGeometry.ts each use on the same baked arrays,
// reimplemented here for the same reason they each reimplement it: both of
// those modules keep their buildTerminatorData local and unexported. The DATA
// is imported; only the (short, mechanical) split is restated.

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
    throw new Error(`mounted screwdriver tray terminator mouth rim is not a simple open chain (${endpoints.length} endpoints)`);
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
    throw new Error("mounted screwdriver tray terminator mouth rim did not chain into a single polyline");
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

const HOLE_ANGLES = Array.from({ length: SOCKET_TRAY_POCKET_SEGMENTS }, (_, index) => (2 * Math.PI * index) / SOCKET_TRAY_POCKET_SEGMENTS);

// theta runs [pi/2, pi] for every fillet in this file, same convention as the
// other three trays. Only ever called for interior points (k = 1..segments-1);
// k = 0 and k = segments are hand-written literals wherever this is used, per
// CLAUDE-LESSONS.md's exact-stitch entry (trig does not land exactly on an arc
// endpoint).
function filletTheta(k: number, segments: number): number {
  return Math.PI / 2 + (k * (Math.PI / 2)) / segments;
}

// Validates the fillet against the plate/tray geometry it's swept into (corner
// D needs room along both the plate-top and plate-front edges before it would
// reach C or E; corner F needs room along both the tray-top and tray-front
// edges before it would reach E or A) and, per bore, against the same
// widened-footprint clearance checks the flat Screwdriver Tray uses.
//
// Note what is NOT here, exactly as on the flat Screwdriver Tray: the mounted
// socket tray carries a `cornerRadius >= pocketDepth` check because its fillet
// has to leave straight wall above a floor plane. A through-bore's wall length
// IS the tray thickness, and `cornerFRoom = min(trayDepth, trayThickness)`
// below already guarantees `cornerRadius < trayThickness`, so that check has no
// separate form here. The bottom rim being sharp is what keeps that sufficient:
// it consumes none of the wall.
function validateMountedScrewdriverTrayCornerRadius(
  cornerRadius: number,
  plateHeight: number,
  plateThickness: number,
  trayThickness: number,
  trayDepth: number,
  plateWidth: number,
  holes: NormalizedHole[],
) {
  if (cornerRadius === 0) return;
  const cornerDRoom = Math.min(plateThickness, plateHeight - trayThickness);
  if (cornerRadius >= cornerDRoom) {
    throw new Error(`mounted screwdriver tray corner radius ${cornerRadius}mm is too large for the plate's own top edge (${cornerDRoom}mm of room before it reaches the mounting face or the tray junction)`);
  }
  const cornerFRoom = Math.min(trayDepth, trayThickness);
  if (cornerRadius >= cornerFRoom) {
    throw new Error(`mounted screwdriver tray corner radius ${cornerRadius}mm is too large for the tray's own top edge (${cornerFRoom}mm of room before it reaches the plate junction or the tray bottom)`);
  }
  holes.forEach((hole, index) => {
    const widened = hole.radius + cornerRadius;
    if (
      hole.x - widened < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      hole.x + widened > plateWidth - SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      hole.z - widened < SOCKET_TRAY_POCKET_EDGE_CLEARANCE ||
      hole.z + widened > trayDepth - SOCKET_TRAY_POCKET_EDGE_CLEARANCE
    ) {
      throw new Error(
        `mounted screwdriver tray corner radius ${cornerRadius}mm widens hole ${index} (diameter ${hole.radius * 2}mm) to within ${SOCKET_TRAY_POCKET_EDGE_CLEARANCE}mm of the tray edge`,
      );
    }
    for (let j = 0; j < holes.length; j += 1) {
      if (j === index) continue;
      const distance = Math.hypot(hole.x - holes[j].x, hole.z - holes[j].z);
      if (distance < widened + holes[j].radius + cornerRadius + SOCKET_TRAY_POCKET_GAP) {
        throw new Error(
          `mounted screwdriver tray corner radius ${cornerRadius}mm widens hole ${index} (diameter ${hole.radius * 2}mm) too close to hole ${j} (centers ${distance.toFixed(2)}mm apart)`,
        );
      }
    }
  });
}

// ===== main entry point =====

export function mountedScrewdriverTrayPositions(options: MountedScrewdriverTrayOptions = {}): number[] {
  const plateWidth = normalizeMountedScrewdriverTrayPlateWidth(options.plateWidth);
  const plateHeight = normalizeMountedScrewdriverTrayPlateHeight(options.plateHeight);
  const plateThickness = normalizeMountedScrewdriverTrayPlateThickness(options.plateThickness);
  const slotSpacing = normalizeMountedScrewdriverTraySlotSpacing(options.slotSpacing);
  const slotCount = normalizeMountedScrewdriverTraySlotCount(options.slotCount);
  const trayDepth = normalizeMountedScrewdriverTrayDepth(options.trayDepth);
  const trayThickness = normalizeMountedScrewdriverTrayThickness(options.trayThickness);
  const cornerRadius = normalizeMountedScrewdriverTrayCornerRadius(options.cornerRadius);

  // The tray occupies the bottom of the plate's front face, so it has to leave
  // some plate above it -- otherwise outline points D and E cross and the L
  // self-intersects.
  if (trayThickness >= plateHeight) {
    throw new Error(`mounted screwdriver tray: tray thickness ${trayThickness}mm must be less than plate height ${plateHeight}mm`);
  }
  // The slot run must stay inside the plate with a real side wall beside the
  // widest (head-radius) extent of the outermost slots.
  const centers = mountedScrewdriverTraySlotCenters(plateWidth, slotSpacing, slotCount);
  const headHalfWidth = MULTICONNECT_HEAD_RADIUS * SLOT_TOLERANCE;
  if (
    centers[0] - headHalfWidth < MOUNTED_SCREWDRIVER_TRAY_SLOT_EDGE_CLEARANCE ||
    centers[centers.length - 1] + headHalfWidth > plateWidth - MOUNTED_SCREWDRIVER_TRAY_SLOT_EDGE_CLEARANCE
  ) {
    throw new Error(
      `mounted screwdriver tray: ${slotCount} slots at ${slotSpacing}mm spacing do not fit a ${plateWidth}mm plate with ${MOUNTED_SCREWDRIVER_TRAY_SLOT_EDGE_CLEARANCE}mm beside the outer slots`,
    );
  }
  // The slot's round top sits MULTICONNECT_SLOT_TOP_OFFSET below the plate's
  // top edge and its channel runs from there down to the bottom edge, so the
  // plate has to be at least that tall for a channel to exist at all.
  const topCenterY = plateHeight - MULTICONNECT_SLOT_TOP_OFFSET;
  if (topCenterY <= 0) {
    throw new Error(`mounted screwdriver tray: plate height ${plateHeight}mm leaves no room for a slot ${MULTICONNECT_SLOT_TOP_OFFSET}mm below the top edge`);
  }

  const holes = normalizedHoles(options.holes ?? [], plateWidth, trayDepth);
  validateMountedScrewdriverTrayCornerRadius(cornerRadius, plateHeight, plateThickness, trayThickness, trayDepth, plateWidth, holes);

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

  // Bore rim/bottom rings, precomputed once. `bottomRing` sits on the tray's
  // bottom face at Y = 0 (the mounted socket tray's equivalent ring sits on a
  // floor plane part way down and is capped off; here it is a real opening).
  // The SAME Point3 objects feed the tray top cap's hole contour, the fillet
  // band's rings, the wall, and the BOTTOM cap's hole contour, so every seam is
  // bit-identical by construction (the exact-stitch contract).
  const trayTopY = trayThickness;
  const K = SOCKET_TRAY_FILLET_SEGMENTS;
  const holeBuilds = holes.map((hole) => {
    const bottomRing: Point3[] = HOLE_ANGLES.map((angle) => [hole.x + hole.radius * Math.cos(angle), 0, hole.z + hole.radius * Math.sin(angle)]);
    if (cornerRadius === 0) {
      const rim: Point3[] = HOLE_ANGLES.map((angle) => [hole.x + hole.radius * Math.cos(angle), trayTopY, hole.z + hole.radius * Math.sin(angle)]);
      return { rings: [rim], bottomRing };
    }
    const rings: Point3[][] = [];
    for (let k = 0; k <= K; k += 1) {
      let radius: number;
      let y: number;
      if (k === 0) {
        radius = hole.radius + cornerRadius;
        y = trayTopY;
      } else if (k === K) {
        radius = hole.radius;
        y = trayTopY - cornerRadius;
      } else {
        const theta = filletTheta(k, K);
        radius = hole.radius + cornerRadius * (1 + Math.cos(theta));
        y = trayTopY - cornerRadius * (1 - Math.sin(theta));
      }
      rings.push(HOLE_ANGLES.map((angle) => [hole.x + radius * Math.cos(angle), y, hole.z + radius * Math.sin(angle)]));
    }
    return { rings, bottomRing };
  });
  // Top notches use the (possibly widened) rim ring; bottom notches always use
  // the nominal-radius bottom ring, because the bottom rim is sharp.
  const topHoles: Point2[][] = holeBuilds.map(({ rings }) => rings[0].map(([x, , z]) => [x, z]));
  const bottomHoles: Point2[][] = holeBuilds.map(({ bottomRing }) => bottomRing.map(([x, , z]) => [x, z]));

  // ---- outline edge 0 (A->B) and edge 1 (B->C): bottom face and mounting
  // face. Unaffected by cornerRadius -- corners A, B, C are never rounded, and
  // neither are the bore bottom rims. Factored into a function (called at the
  // same position in both branches below) purely to avoid duplicating it.
  const pushBottomAndMountingFaces = () => {
    // Bottom face, Y = 0, with one keyhole notch per slot opening through its
    // mounting-face edge, AND -- new on this shape -- one earcut hole per bore.
    // The contour traverses along Z = mountingFaceZ from x = plateWidth back to
    // 0, diving around each channel cross-section (outline indices 3..0 then
    // 7..4 -- everything except the open neck-top edge, which lies in the
    // mounting face). The bores are interior holes, not contour indentations:
    // they sit at Z <= trayDepth - 5 while the channels sit at
    // Z >= trayDepth + 2.35, so the two never interact (see the header).
    const notchOrder = [3, 2, 1, 0, 7, 6, 5, 4];
    const bottomContour: Point2[] = [[outline[0][1], outline[0][0]], [plateWidth, 0], [plateWidth, outline[1][1]]];
    for (const cx of [...centers].reverse()) {
      for (const outlineIndex of notchOrder) {
        const [across, depth] = MULTICONNECT_CHANNEL_OUTLINE[outlineIndex];
        bottomContour.push([worldX(cx, across), worldZ(depth)]);
      }
    }
    bottomContour.push([0, outline[1][1]]);
    pushCap(positions, bottomContour, ([x, z]) => [x, 0, z], [0, -1, 0], bottomHoles);

    // Mounting face, Z = mountingFaceZ, with one notch per slot: straight strip
    // sides matching the channel prism's neck walls, closed over the top by the
    // baked mouth rim polyline (whose first/last points ARE the strip corners
    // at the clip plane). No bore ever reaches this face.
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
  };

  if (cornerRadius === 0) {
    // ===== unrounded construction =====

    // ---- the two end caps: the L outline itself, at X = 0 and X = plateWidth.
    pushCap(positions, outline, ([y, z]) => [0, y, z], [-1, 0, 0]);
    pushCap(positions, outline, ([y, z]) => [plateWidth, y, z], [1, 0, 0]);

    pushBottomAndMountingFaces();

    // ---- outline edge 4 (E->F): tray top, Y = trayThickness, notched with
    // each bore's exact rim contour as an earcut hole.
    const trayTopContour: Point2[] = [[0, 0], [plateWidth, 0], [plateWidth, outline[4][1]], [0, outline[4][1]]];
    pushCap(positions, trayTopContour, ([x, z]) => [x, trayTopY, z], [0, 1, 0], topHoles);

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
  } else {
    // ===== rounded corners D and F =====
    //
    // Both use the SAME local derivation as the flat trays' own top-edge
    // fillet: a horizontal face (outward +Y) meets a vertical face (outward
    // -Z), theta running pi/2 (flush with the horizontal face, at the sharp
    // corner's Y) to pi (flush with the vertical face, at the sharp corner's
    // Z). ringD(k)/ringF(k) return the (y, z) of the k-th point, walked in
    // outline order (increasing k moves AWAY from the sharp corner along the
    // horizontal face first, through the arc, to the vertical face) so they
    // read directly into the outline in place of a single sharp point.
    const ringD = (k: number): Point2 => {
      if (k === 0) return [plateHeight, plateFrontZ + cornerRadius];
      if (k === K) return [plateHeight - cornerRadius, plateFrontZ];
      const theta = filletTheta(k, K);
      return [plateHeight - cornerRadius * (1 - Math.sin(theta)), plateFrontZ + cornerRadius * (1 + Math.cos(theta))];
    };
    const ringF = (k: number): Point2 => {
      if (k === 0) return [trayTopY, cornerRadius];
      if (k === K) return [trayTopY - cornerRadius, 0];
      const theta = filletTheta(k, K);
      return [trayTopY - cornerRadius * (1 - Math.sin(theta)), cornerRadius * (1 + Math.cos(theta))];
    };
    // Desired normal per band -- both fillets share the same "horizontal face
    // outward +Y, vertical face outward -Z" local frame, so the formula is
    // identical: normal3D = (0, sin(thetaMid), cos(thetaMid)).
    const filletDesiredNormal = (k: number): Point3 => {
      const thetaMid = filletTheta(k + 0.5, K);
      return [0, Math.sin(thetaMid), Math.cos(thetaMid)];
    };

    const filletedOutline: Point2[] = [
      outline[0], // A
      outline[1], // B
      outline[2], // C
      ...Array.from({ length: K + 1 }, (_, k) => ringD(k)),
      outline[4], // E, unchanged -- the excluded junction
      ...Array.from({ length: K + 1 }, (_, k) => ringF(k)),
    ];

    // ---- the two end caps: the filleted L outline, at X = 0 and X = plateWidth.
    pushCap(positions, filletedOutline, ([y, z]) => [0, y, z], [-1, 0, 0]);
    pushCap(positions, filletedOutline, ([y, z]) => [plateWidth, y, z], [1, 0, 0]);

    pushBottomAndMountingFaces();

    // ---- outline edge 4 (E->F): tray top, trimmed at its F end so its own
    // front edge stops cornerRadius short of Z = 0 -- the corner-F fillet band
    // fills the rest. Unaffected at the E end (the excluded junction).
    const trayTopContour: Point2[] = [[0, cornerRadius], [plateWidth, cornerRadius], [plateWidth, outline[4][1]], [0, outline[4][1]]];
    pushCap(positions, trayTopContour, ([x, z]) => [x, trayTopY, z], [0, 1, 0], topHoles);

    // ---- outline edges 2, 3, 5: plain rectangles, each trimmed only at the
    // end that touches a rounded corner (D or F); untouched at C, E, A.
    const trimmedEdges: [Point2, Point2][] = [
      [outline[2], ringD(0)], // edge 2 (C->D): trimmed at the D end
      [ringD(K), outline[4]], // edge 3 (D->E): trimmed at the D end
      [ringF(K), outline[0]], // edge 5 (F->A): trimmed at the F end
    ];
    for (const [p, q] of trimmedEdges) {
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

    // ---- the two fillet bands themselves, K quad-bands each, extruded the
    // full plateWidth.
    for (const ring of [ringD, ringF]) {
      for (let k = 0; k < K; k += 1) {
        const [pY, pZ] = ring(k);
        const [qY, qZ] = ring(k + 1);
        pushQuad(
          positions,
          [
            [0, pY, pZ],
            [plateWidth, pY, pZ],
            [plateWidth, qY, qZ],
            [0, qY, qZ],
          ],
          filletDesiredNormal(k),
        );
      }
    }
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

  // ---- per-bore interior. With cornerRadius === 0, `rings` holds only the
  // rim, so this is one wall band from the shelf's top face straight down to
  // its bottom face; with cornerRadius > 0 it also emits the K extra fillet
  // bands between the widened top ring and the ordinary wall-top ring, same
  // technique as the flat Screwdriver Tray's own bore rim.
  //
  // There is NO floor cap here. That is the mounted socket tray's blind
  // bottom, and this shape does not have one.
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
          pushQuad(positions, [ringA[i], ringA[j], ringB[j], ringB[i]], desired);
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
      const midAngle = (2 * Math.PI * (i + 0.5)) / segments;
      const inward: Point3 = [-Math.cos(midAngle), 0, -Math.sin(midAngle)];
      pushQuad(positions, [p0, p1, p2, p3], inward);
    }
  }

  return positions;
}

export function createMountedScrewdriverTrayGeometry(options: MountedScrewdriverTrayOptions = {}): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(mountedScrewdriverTrayPositions(options), 3));
  geometry.computeVertexNormals();
  return geometry;
}
