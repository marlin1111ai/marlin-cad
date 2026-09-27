import * as THREE from "three";
import { Font, type FontData } from "three/examples/jsm/loaders/FontLoader.js";
import helvetikerBoldFontJson from "three/examples/fonts/helvetiker_bold.typeface.json" with { type: "json" };

// Label Slab -- text labels as printable geometry: a plain flat slab whose
// top face carries a grid of labels, each either RAISED 0.8mm above the top
// face or RECESSED 0.8mm into it. First use case: the label test piece
// (test-prints/label-test-piece.stl), printed and hand-checked for
// legibility BEFORE any Gridfinity tray is built on labels, per
// reference/DECISIONS.md (2026-09-27) and risk 2 of
// reference/reports/gridfinity-labeled-tray-recon.md. No pockets, no
// Gridfinity foot, no UI registration.
//
// Construction is a boundary representation, never a runtime CSG boolean --
// same family as the trays' round pockets (socketTrayGeometry.ts, read-only
// reference for this file, not imported from). A glyph is cut exactly the
// way a pocket is: its outer contour is notched into the top face as an
// earcut hole, and its walls and caps are separate triangles that reuse the
// SAME contour point objects the notch was cut with, so every seam is
// bit-identical doubles by construction (the exact-stitch contract in
// CLAUDE-LESSONS.md). Counters (the enclosed holes of 0, 4, 6, 8, 9) are
// holes in the glyph's own cap and get their own wall and their own small
// cap back at top-face level -- earcut never sees nesting.
//
// Glyph outlines come from three's bundled typeface fonts through
// Font.generateShapes, which returns vector outlines only (no triangles, no
// ExtrudeGeometry, no float32). The points are curve-sampled float64: the
// exact-stitch contract is met by REUSING the sampled arrays, never by
// recomputing them. Font glyphs are not CAD contours, so only the
// characters in LABEL_CHARACTERS are accepted -- each one is pinned by the
// exact directed-edge test in tests/unit/labelSlabGeometry.test.ts.
//
// World frame: the slab lies flat on the bed like the flat Socket Tray, so
// there is no as-mounted-view mirror. X = width [0, width], Y = thickness
// (up; top face at Y = thickness, raised labels reach thickness +
// LABEL_DEPTH), Z = depth [0, depth]. Text reads left to right along +X and
// its "up the page" direction is -Z, so after the STL export's Y-up -> Z-up
// swap ([x, y, z] -> [x, -z, y]) the labels read correctly looking down at
// the bed with +X to the right. Row 0 is the top row as read (smallest Z).

// The owner's "5mm": the printed digits measure 5mm tall -- NOT font size 5
// (which makes Helvetiker bold digits 5.105mm). Helvetiker's digits are not
// all one height (round digits overshoot the baseline and the flat tops), so
// this is the overall height of the digit set 0-9 on a shared baseline --
// the same measurement the owner was shown when choosing it. One uniform
// scale serves every label, so stroke widths match across labels; an
// individual digit measures between 4.69mm (4, 7) and 4.99mm (3).
export const LABEL_DIGIT_HEIGHT = 5;
// Raised height above / recessed depth below the top face.
export const LABEL_DEPTH = 0.8;
// The only characters a label may contain (see file header).
export const LABEL_CHARACTERS = "0123456789m";
// Points sampled per quadratic curve of a glyph outline.
export const LABEL_CURVE_DIVISIONS = 8;
// Minimum material kept under a recessed label's floor -- this module's own
// constant, matching the trays' 2mm floor rule in value (CLAUDE-LESSONS.md's
// slicer-slit-fusion entry: don't let a floor go arbitrarily thin).
export const MIN_LABEL_SLAB_FLOOR_THICKNESS = 2;

export const DEFAULT_LABEL_SLAB_THICKNESS = 3;
// Clear band kept between the slab's edge and the nearest label.
export const DEFAULT_LABEL_SLAB_MARGIN = 3;
// Clear band kept between neighbouring labels, across and down.
export const DEFAULT_LABEL_SLAB_GAP = 3;

export type LabelStyle = "raised" | "recessed";

export type LabelSlabCell = {
  text: string;
  style: LabelStyle;
};

export type LabelSlabOptions = {
  thickness?: number;
  margin?: number;
  gap?: number;
  // rows[r][c]; row 0 is the top row as read, column 0 the leftmost. Every
  // row must hold the same number of cells.
  rows: LabelSlabCell[][];
};

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

// One closed outline with the enclosed counters cut out of it. A glyph of
// the accepted character set is exactly one part.
export type LabelGlyphOutline = {
  outer: Point2[];
  holes: Point2[][];
};

// A label's outlines in mm, in the label's own frame: x runs right from the
// pen origin, y runs up from the baseline.
export type LabelOutline = {
  text: string;
  glyphs: LabelGlyphOutline[];
  // Ink extents of this label.
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const LABEL_FONT_DATA = helvetikerBoldFontJson as unknown as FontData;
const LABEL_FONT = new Font(LABEL_FONT_DATA);
const LABEL_FONT_RESOLUTION = (helvetikerBoldFontJson as unknown as { resolution: number }).resolution;

function finiteOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

// Drops repeated points (including a closing point equal to the first) and
// exactly collinear points, one at a time against the loop as it currently
// stands. Earcut silently discards both kinds from a contour; a wall built
// from a point the cap never used would leave an open T-junction, so they
// are removed HERE, once, and every consumer reads the cleaned loop.
function cleanLoop(points: readonly THREE.Vector2[]): Point2[] {
  const loop: Point2[] = points.map((point) => [point.x, point.y] as const);
  let index = 0;
  let sinceLastRemoval = 0;
  while (loop.length >= 3 && sinceLastRemoval < loop.length) {
    const count = loop.length;
    const previous = loop[(index - 1 + count) % count];
    const current = loop[index % count];
    const next = loop[(index + 1) % count];
    const repeated = current[0] === next[0] && current[1] === next[1];
    const cross = (current[1] - previous[1]) * (next[0] - current[0]) - (current[0] - previous[0]) * (next[1] - current[1]);
    if (repeated || cross === 0) {
      loop.splice(index % count, 1);
      index = (index % count) - 1;
      if (index < 0) index = 0;
      sinceLastRemoval = 0;
    } else {
      index = (index + 1) % count;
      sinceLastRemoval += 1;
    }
  }
  return loop;
}

// Glyph outlines in FONT UNITS (the generator is run at size = resolution,
// so its scale is exactly 1 and every on-curve point is the font's own
// integer coordinate).
function fontUnitOutlines(text: string): LabelGlyphOutline[] {
  const glyphs: LabelGlyphOutline[] = [];
  for (const shape of LABEL_FONT.generateShapes(text, LABEL_FONT_RESOLUTION)) {
    const { shape: outer, holes } = shape.extractPoints(LABEL_CURVE_DIVISIONS);
    glyphs.push({ outer: cleanLoop(outer), holes: holes.map((hole) => cleanLoop(hole)) });
  }
  return glyphs;
}

function verticalExtent(glyphs: LabelGlyphOutline[]): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const glyph of glyphs) {
    for (const point of glyph.outer) {
      min = Math.min(min, point[1]);
      max = Math.max(max, point[1]);
    }
  }
  return { min, max };
}

// The digit set's own extent, measured from the same sampled outlines the
// geometry is built from rather than typed in as a constant.
const DIGIT_EXTENT_UNITS = verticalExtent(fontUnitOutlines("0123456789"));

// mm per font unit. The ONE scale every label is built at.
export const LABEL_SCALE = LABEL_DIGIT_HEIGHT / (DIGIT_EXTENT_UNITS.max - DIGIT_EXTENT_UNITS.min);
// Every label's digits sit inside this band, measured up from the baseline:
// LABEL_BAND_TOP - LABEL_BAND_BOTTOM is LABEL_DIGIT_HEIGHT. The bottom is
// slightly negative -- round digits overshoot the baseline.
export const LABEL_BAND_BOTTOM = DIGIT_EXTENT_UNITS.min * LABEL_SCALE;
export const LABEL_BAND_TOP = DIGIT_EXTENT_UNITS.max * LABEL_SCALE;

function validateLabelText(text: string, where: string) {
  if (typeof text !== "string" || text.length === 0) throw new Error(`${where}: label text must not be empty`);
  for (const character of text) {
    if (!LABEL_CHARACTERS.includes(character)) {
      throw new Error(`${where}: label "${text}" contains "${character}"; only the characters ${LABEL_CHARACTERS} are supported`);
    }
  }
}

export function labelOutline(text: string): LabelOutline {
  validateLabelText(text, "label");
  const toMm = (loop: Point2[]): Point2[] => loop.map(([u, v]) => [u * LABEL_SCALE, v * LABEL_SCALE] as const);
  const glyphs = fontUnitOutlines(text).map((glyph) => ({ outer: toMm(glyph.outer), holes: glyph.holes.map(toMm) }));
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const glyph of glyphs) {
    for (const [x, y] of glyph.outer) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { text, glyphs, minX, maxX, minY, maxY };
}

export function normalizeLabelSlabThickness(value?: number): number {
  const thickness = finiteOr(value, DEFAULT_LABEL_SLAB_THICKNESS);
  if (thickness <= 0) throw new Error(`label slab thickness must be positive (got ${thickness})`);
  return thickness;
}

export function normalizeLabelSlabMargin(value?: number): number {
  const margin = finiteOr(value, DEFAULT_LABEL_SLAB_MARGIN);
  if (margin <= 0) throw new Error(`label slab margin must be positive (got ${margin})`);
  return margin;
}

export function normalizeLabelSlabGap(value?: number): number {
  const gap = finiteOr(value, DEFAULT_LABEL_SLAB_GAP);
  if (gap <= 0) throw new Error(`label slab gap must be positive (got ${gap})`);
  return gap;
}

export type LabelSlabPlacedLabel = {
  text: string;
  style: LabelStyle;
  row: number;
  column: number;
  // The cell of the top face this label owns.
  cellMinX: number;
  cellMaxX: number;
  cellMinZ: number;
  cellMaxZ: number;
  // Ink extents of the label as placed, slab coordinates.
  inkMinX: number;
  inkMaxX: number;
  inkMinZ: number;
  inkMaxZ: number;
  // Where the label's baseline lies.
  baselineZ: number;
  // The label's outlines as placed: [x, z] slab coordinates.
  glyphs: LabelGlyphOutline[];
};

export type LabelSlabLayout = {
  width: number;
  depth: number;
  thickness: number;
  labels: LabelSlabPlacedLabel[];
};

// The slab is sized FROM its labels -- just big enough to hold them. Each
// column is as wide as its widest label, every row is LABEL_DIGIT_HEIGHT
// tall, `gap` separates neighbours and `margin` surrounds the lot. Labels
// are left-aligned in their column by their ink, not by their pen origin.
export function labelSlabLayout(options: LabelSlabOptions): LabelSlabLayout {
  const thickness = normalizeLabelSlabThickness(options.thickness);
  const margin = normalizeLabelSlabMargin(options.margin);
  const gap = normalizeLabelSlabGap(options.gap);
  const rows = options.rows;
  if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(rows[0]) || rows[0].length === 0) {
    throw new Error("label slab needs at least one row holding at least one label");
  }
  const columnCount = rows[0].length;
  const outlines: LabelOutline[][] = rows.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== columnCount) {
      throw new Error(`label slab row ${rowIndex}: holds ${Array.isArray(row) ? row.length : 0} labels, but row 0 holds ${columnCount}`);
    }
    return row.map((cell, columnIndex) => {
      const where = `label slab row ${rowIndex} column ${columnIndex}`;
      if (cell.style !== "raised" && cell.style !== "recessed") throw new Error(`${where}: style must be "raised" or "recessed"`);
      validateLabelText(cell.text, where);
      // Compared as a sum, not as thickness - LABEL_DEPTH: 2.8 - 0.8 is
      // 1.9999999999999998 in float64 and would reject a slab that leaves
      // exactly the minimum floor, while 2 + 0.8 is exactly 2.8.
      if (cell.style === "recessed" && thickness < MIN_LABEL_SLAB_FLOOR_THICKNESS + LABEL_DEPTH) {
        throw new Error(
          `${where}: a ${LABEL_DEPTH}mm recessed label leaves less than the ${MIN_LABEL_SLAB_FLOOR_THICKNESS}mm minimum floor at slab thickness ${thickness}mm`,
        );
      }
      return labelOutline(cell.text);
    });
  });

  const columnLeft: number[] = [];
  const columnWidth: number[] = [];
  for (let column = 0; column < columnCount; column += 1) {
    columnWidth.push(Math.max(...outlines.map((row) => row[column].maxX - row[column].minX)));
    columnLeft.push(column === 0 ? margin : columnLeft[column - 1] + columnWidth[column - 1] + gap);
  }
  const width = columnLeft[columnCount - 1] + columnWidth[columnCount - 1] + margin;
  const rowTop = rows.map((_, row) => margin + row * (LABEL_DIGIT_HEIGHT + gap));
  const depth = rowTop[rows.length - 1] + LABEL_DIGIT_HEIGHT + margin;

  // Cell boundaries: the slab's own edges outside, the middle of each gap
  // inside. Built ONCE -- neighbouring cells read the same doubles.
  const cellX = [0, ...columnLeft.slice(1).map((left) => left - gap / 2), width];
  const cellZ = [0, ...rowTop.slice(1).map((top) => top - gap / 2), depth];

  const labels: LabelSlabPlacedLabel[] = [];
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      const outline = outlines[rowIndex][columnIndex];
      const originX = columnLeft[columnIndex] - outline.minX;
      const baselineZ = rowTop[rowIndex] + LABEL_BAND_TOP;
      const place = (loop: Point2[]): Point2[] => loop.map(([x, y]) => [originX + x, baselineZ - y] as const);
      labels.push({
        text: cell.text,
        style: cell.style,
        row: rowIndex,
        column: columnIndex,
        cellMinX: cellX[columnIndex],
        cellMaxX: cellX[columnIndex + 1],
        cellMinZ: cellZ[rowIndex],
        cellMaxZ: cellZ[rowIndex + 1],
        inkMinX: originX + outline.minX,
        inkMaxX: originX + outline.maxX,
        inkMinZ: baselineZ - outline.maxY,
        inkMaxZ: baselineZ - outline.minY,
        baselineZ,
        glyphs: outline.glyphs.map((glyph) => ({ outer: place(glyph.outer), holes: glyph.holes.map(place) })),
      });
    });
  });
  return { width, depth, thickness, labels };
}

// ===== triangle emission helpers (same technique as socketTrayGeometry.ts's
// pushTriangle/triangleNormal/pushCap/pushRectangleCap -- reimplemented here
// rather than imported, matching the one-primitive-per-file convention) =====

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
// through a contour point without stopping at it. This is the one place
// glyph outlines differ from every contour the trays notch a face with:
// the glyphs of a label all stand on one baseline, so the bottom edges of
// separate glyphs are exactly collinear, and earcut will happily run a
// single triangle edge along that line straight over the corner points
// lying on it (first seen on "12mm"). The walls DO stop at those points, so
// the long edge has no partner and the mesh is open -- while still looking
// closed to any spatially-quantized check that tolerates a T-junction.
// Fix: drop exactly-zero-area triangles (earcut's own filler along such a
// line), then split any triangle at each point lying exactly on one of its
// edges. No coordinate is computed here; every vertex is still one of the
// caller's own points.
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
// triangle rather than trusting the contour's own point order. Same as the
// trays' pushCap, plus the conforming pass above.
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

// ===== main entry point =====

export function labelSlabPositions(options: LabelSlabOptions): number[] {
  const { width, depth, thickness, labels } = labelSlabLayout(options);
  const topY = thickness;
  const positions: number[] = [];
  const up: Point3 = [0, 1, 0];
  const at = (y: number) => (point: Point2): Point3 => [point[0], y, point[1]];

  for (const label of labels) {
    const { cellMinX: x0, cellMaxX: x1, cellMinZ: z0, cellMaxZ: z1 } = label;
    const cell: Point2[] = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];

    // Top face of this cell, notched with every glyph's outer contour.
    pushCap(
      positions,
      cell,
      at(topY),
      up,
      label.glyphs.map((glyph) => glyph.outer),
    );
    // Bottom face of this cell: never cut. It is split along the same cell
    // boundaries as the top face so the side walls below meet both faces at
    // the same corner points.
    pushRectangleCap(
      positions,
      [
        [x0, 0, z0],
        [x1, 0, z0],
        [x1, 0, z1],
        [x0, 0, z1],
      ],
      [0, -1, 0],
    );
    // Side walls, only where this cell's edge IS the slab's edge.
    const sideWall = (ax: number, az: number, bx: number, bz: number, normal: Point3) =>
      pushRectangleCap(
        positions,
        [
          [ax, 0, az],
          [bx, 0, bz],
          [bx, topY, bz],
          [ax, topY, az],
        ],
        normal,
      );
    if (z0 === 0) sideWall(x0, z0, x1, z0, [0, 0, -1]);
    if (z1 === depth) sideWall(x0, z1, x1, z1, [0, 0, 1]);
    if (x0 === 0) sideWall(x0, z0, x0, z1, [-1, 0, 0]);
    if (x1 === width) sideWall(x1, z0, x1, z1, [1, 0, 0]);

    for (const glyph of label.glyphs) {
      if (label.style === "raised") {
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
        const floorY = topY - LABEL_DEPTH;
        pushLoopWall(positions, glyph.outer, floorY, topY, "inward");
        pushCap(positions, glyph.outer, at(floorY), up, glyph.holes);
        for (const counter of glyph.holes) {
          pushLoopWall(positions, counter, floorY, topY, "outward");
          pushCap(positions, counter, at(topY), up);
        }
      }
    }
  }
  return positions;
}

export function createLabelSlabGeometry(options: LabelSlabOptions): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(labelSlabPositions(options), 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// ===== the label test piece =====

// The owner's socket set: the 12 standard metric sockets the socket trays
// are for, nominal sizes in mm (reference/socket-tray-sampler-report.md,
// "Sockets-per-pocket mapping (5-16mm) -- CONFIRMED").
export const LABEL_TEST_PIECE_SOCKET_SIZES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;

// Labels are the real socket sizes, written "5mm", "6mm" and so on.
export function socketSizeLabel(size: number): string {
  return `${size}mm`;
}

// Every socket-size label twice -- once raised, once recessed -- on a plain
// 3mm slab. Six rows of four: each row reads
//   [size raised] [size recessed] [size + 6 raised] [size + 6 recessed]
// so the two styles of one label sit side by side, 5mm at the top left and
// 16mm at the bottom right.
export function labelTestPieceOptions(): LabelSlabOptions {
  const half = LABEL_TEST_PIECE_SOCKET_SIZES.length / 2;
  const rows: LabelSlabCell[][] = [];
  for (let row = 0; row < half; row += 1) {
    const left = socketSizeLabel(LABEL_TEST_PIECE_SOCKET_SIZES[row]);
    const right = socketSizeLabel(LABEL_TEST_PIECE_SOCKET_SIZES[row + half]);
    rows.push([
      { text: left, style: "raised" },
      { text: left, style: "recessed" },
      { text: right, style: "raised" },
      { text: right, style: "recessed" },
    ]);
  }
  return {
    thickness: DEFAULT_LABEL_SLAB_THICKNESS,
    margin: DEFAULT_LABEL_SLAB_MARGIN,
    gap: DEFAULT_LABEL_SLAB_GAP,
    rows,
  };
}
