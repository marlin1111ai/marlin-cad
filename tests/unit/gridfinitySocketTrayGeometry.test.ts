import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createGridfinitySocketTrayGeometry,
  DEFAULT_GRIDFINITY_SOCKET_TRAY_CORNER_RADIUS,
  DEFAULT_GRIDFINITY_SOCKET_TRAY_LABEL_STYLE,
  GRIDFINITY_SOCKET_TRAY_BED_SIZE,
  GRIDFINITY_SOCKET_TRAY_BODY_HEIGHT,
  GRIDFINITY_SOCKET_TRAY_BODY_THICKNESS,
  GRIDFINITY_SOCKET_TRAY_EDGE_CLEARANCE,
  GRIDFINITY_SOCKET_TRAY_FLOOR_THICKNESS,
  GRIDFINITY_SOCKET_TRAY_GAP,
  GRIDFINITY_SOCKET_TRAY_HOLE_DEPTH,
  MAX_GRIDFINITY_SOCKET_TRAY_SQUARES,
  gridfinitySocketTrayDimensions,
  gridfinitySocketTrayLayout,
  gridfinitySocketTrayPositions,
  type GridfinitySocketTrayHole,
  type GridfinitySocketTrayOptions,
} from "@/lib/gridfinitySocketTrayGeometry";
import { GRIDFINITY_FOOT_HEIGHT, GRIDFINITY_FOOT_TOP_RADIUS, GRIDFINITY_PITCH, gridfinityFootPositions } from "@/lib/gridfinityFootGeometry";
import { LABEL_BAND_BOTTOM, LABEL_BAND_TOP, LABEL_DEPTH, LABEL_DIGIT_HEIGHT, labelOutline, type LabelStyle } from "@/lib/labelSlabGeometry";
import { analyzeTriangleSoup } from "@/lib/svgImport";

// The default insert, typed out by hand here rather than read back from
// shapeCatalog.ts: 3 x 2 squares, three holes on the depth centreline at the
// centres of the three square columns, labelled with the sockets they hold.
// Diameters are the recorded finished pocket diameters from
// reference/socket-tray-sampler-report.md (8mm -> 15, 10mm and 12mm -> 19).
const DEFAULT_HOLES: GridfinitySocketTrayHole[] = [
  { diameter: 15, x: 20.75, z: 41.75, label: "8mm" },
  { diameter: 19, x: 62.75, z: 41.75, label: "10mm" },
  { diameter: 19, x: 104.75, z: 41.75, label: "12mm" },
];
const WIDTH = 125.5;
const DEPTH = 83.5;
const TOP_Y = 22.75;
const FLOOR_Y = 8.75;

function defaultTray(overrides: GridfinitySocketTrayOptions = {}): GridfinitySocketTrayOptions {
  return { squaresX: 3, squaresZ: 2, holes: DEFAULT_HOLES.map((hole) => ({ ...hole })), ...overrides };
}

// An asymmetric layout: no two holes share an x or a z, none sits at
// another's mirror image about either centreline, and the tray is not
// square -- so a missing or doubled front-edge mirror cannot pass.
const ASYMMETRIC_HOLES: GridfinitySocketTrayHole[] = [
  { diameter: 14, x: 18, z: 22, label: "5mm" },
  { diameter: 19, x: 52, z: 32, label: "11mm" },
  { diameter: 25, x: 100, z: 58, label: "16mm" },
];

// Every directed edge must appear exactly once, with its reverse exactly
// once, keyed on the raw doubles -- the exact-stitch contract from
// CLAUDE-LESSONS.md.
function directedEdgeDefects(positions: readonly number[]): string[] {
  const directed = new Map<string, number>();
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const keys = [0, 3, 6].map((offset) => `${positions[i + offset]},${positions[i + offset + 1]},${positions[i + offset + 2]}`);
    for (let edge = 0; edge < 3; edge += 1) {
      const key = `${keys[edge]}|${keys[(edge + 1) % 3]}`;
      directed.set(key, (directed.get(key) ?? 0) + 1);
    }
  }
  const defects: string[] = [];
  for (const [key, count] of directed) {
    const [a, b] = key.split("|");
    if (count !== 1 || directed.get(`${b}|${a}`) !== 1) defects.push(key);
  }
  return defects;
}

// Heights at which a vertical ray through (x, z) crosses the mesh, lowest
// first, coincident crossings merged.
function verticalCrossings(positions: readonly number[], x: number, z: number): number[] {
  const crossings: number[] = [];
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const p = positions;
    const denom = (p[i + 5] - p[i + 8]) * (p[i] - p[i + 6]) + (p[i + 6] - p[i + 3]) * (p[i + 2] - p[i + 8]);
    if (Math.abs(denom) < 1e-12) continue;
    const a = ((p[i + 5] - p[i + 8]) * (x - p[i + 6]) + (p[i + 6] - p[i + 3]) * (z - p[i + 8])) / denom;
    const b = ((p[i + 8] - p[i + 2]) * (x - p[i + 6]) + (p[i] - p[i + 6]) * (z - p[i + 8])) / denom;
    const c = 1 - a - b;
    if (a < 0 || b < 0 || c < 0) continue;
    crossings.push(a * p[i + 1] + b * p[i + 4] + c * p[i + 7]);
  }
  crossings.sort((m, n) => m - n);
  return crossings.filter((y, index) => index === 0 || y - crossings[index - 1] > 1e-6);
}

function bounds(positions: readonly number[]) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[i + axis]);
      max[axis] = Math.max(max[axis], positions[i + axis]);
    }
  }
  return { min, max };
}

// Same text the app's exporter writes: ASCII STL, scene [x, y, z] -> file
// [x, -z, y].
function toStlText(positions: readonly number[]): string {
  const lines = ["solid gridfinity_socket_tray"];
  for (let i = 0; i + 8 < positions.length; i += 9) {
    lines.push("  facet normal 0 0 0", "    outer loop");
    for (const offset of [0, 3, 6]) lines.push(`      vertex ${positions[i + offset]} ${0 - positions[i + offset + 2]} ${positions[i + offset + 1]}`);
    lines.push("    endloop", "  endfacet");
  }
  lines.push("endsolid gridfinity_socket_tray");
  return lines.join("\n") + "\n";
}

function parseStlToScenePositions(stl: string): number[] {
  const positions: number[] = [];
  const vertexPattern = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = vertexPattern.exec(stl))) {
    // Inverse of [x, y, z] -> [x, -z, y]; "0 - fy" so a file 0 comes back as 0, not -0.
    positions.push(Number(match[1]), Number(match[3]), 0 - Number(match[2]));
  }
  return positions;
}

// The triangles lying wholly at or below the foot tops: the feet and the
// underside between them. Returned as sorted text keys so two meshes can be
// compared as SETS of triangles, whatever order they were emitted in.
function footTriangleKeys(positions: readonly number[], shiftX = 0, shiftZ = 0, keep: (x: number, z: number) => boolean = () => true): string[] {
  const keys: string[] = [];
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const ys = [positions[i + 1], positions[i + 4], positions[i + 7]];
    if (ys.some((y) => y > GRIDFINITY_FOOT_HEIGHT)) continue;
    const corners = [0, 3, 6].map((offset) => [positions[i + offset] - shiftX, positions[i + offset + 1], positions[i + offset + 2] - shiftZ]);
    if (!corners.every(([x, , z]) => keep(x, z))) continue;
    keys.push(
      corners
        .map(([x, y, z]) => `${x.toFixed(9)},${y.toFixed(9)},${z.toFixed(9)}`)
        .sort()
        .join(" | "),
    );
  }
  return keys.sort();
}

const STYLES: LabelStyle[] = ["raised", "recessed"];

describe("gridfinity socket tray: size", () => {
  it("measures 42N - 0.5 by 42M - 0.5, and 22.75 to the top face", () => {
    expect(gridfinitySocketTrayDimensions({ squaresX: 3, squaresZ: 2 })).toEqual({ squaresX: 3, squaresZ: 2, width: 125.5, depth: 83.5, bodyHeight: 22.75, height: 22.75 });
    expect(gridfinitySocketTrayDimensions({ squaresX: 4, squaresZ: 2 })).toMatchObject({ width: 167.5, depth: 83.5 });
    expect(gridfinitySocketTrayDimensions({ squaresX: 1, squaresZ: 1 })).toMatchObject({ width: 41.5, depth: 41.5 });
    expect(gridfinitySocketTrayDimensions({ squaresX: 6, squaresZ: 6 })).toMatchObject({ width: 251.5, depth: 251.5 });
  });

  it("is a 4mm floor under 14mm holes on the 4.75mm feet", () => {
    expect(GRIDFINITY_SOCKET_TRAY_HOLE_DEPTH).toBe(14);
    expect(GRIDFINITY_SOCKET_TRAY_FLOOR_THICKNESS).toBe(4);
    expect(GRIDFINITY_SOCKET_TRAY_BODY_THICKNESS).toBe(18);
    expect(GRIDFINITY_SOCKET_TRAY_BODY_HEIGHT).toBe(22.75);
    expect(GRIDFINITY_FOOT_HEIGHT).toBe(4.75);
  });

  it("defaults to 3 x 2 squares, Corner Radius 0 and raised labels", () => {
    expect(gridfinitySocketTrayLayout({})).toMatchObject({ squaresX: 3, squaresZ: 2, cornerRadius: 0, labelStyle: "raised", holes: [], labels: [] });
    expect(DEFAULT_GRIDFINITY_SOCKET_TRAY_CORNER_RADIUS).toBe(0);
    expect(DEFAULT_GRIDFINITY_SOCKET_TRAY_LABEL_STYLE).toBe("raised");
  });

  it("is 0.8mm taller overall when its labels are raised, and only then", () => {
    expect(gridfinitySocketTrayDimensions(defaultTray({ labelStyle: "raised" })).height).toBe(22.75 + LABEL_DEPTH);
    expect(gridfinitySocketTrayDimensions(defaultTray({ labelStyle: "recessed" })).height).toBe(22.75);
    const unlabelled = DEFAULT_HOLES.map((hole) => ({ ...hole, label: "" }));
    expect(gridfinitySocketTrayDimensions(defaultTray({ labelStyle: "raised", holes: unlabelled })).height).toBe(22.75);
  });

  it("has the bounding box its dimensions say, in both label styles", () => {
    for (const labelStyle of STYLES) {
      const { min, max } = bounds(gridfinitySocketTrayPositions(defaultTray({ labelStyle })));
      expect(min).toEqual([0, 0, 0]);
      expect(max).toEqual([WIDTH, labelStyle === "raised" ? TOP_Y + LABEL_DEPTH : TOP_Y, DEPTH]);
    }
  });
});

describe("gridfinity socket tray: closed solid", () => {
  const cases: Array<[string, GridfinitySocketTrayOptions]> = [
    ["the default insert, raised", defaultTray({ labelStyle: "raised" })],
    ["the default insert, recessed", defaultTray({ labelStyle: "recessed" })],
    ["the default insert, raised, Corner Radius 1", defaultTray({ labelStyle: "raised", cornerRadius: 1 })],
    ["the default insert, recessed, Corner Radius 2.5", defaultTray({ labelStyle: "recessed", cornerRadius: 2.5 })],
    ["the default insert, raised, Corner Radius 3.5", defaultTray({ labelStyle: "raised", cornerRadius: 3.5 })],
    ["the asymmetric layout, raised", { squaresX: 3, squaresZ: 2, holes: ASYMMETRIC_HOLES, labelStyle: "raised" }],
    ["the asymmetric layout, recessed, Corner Radius 1.5", { squaresX: 3, squaresZ: 2, holes: ASYMMETRIC_HOLES, labelStyle: "recessed", cornerRadius: 1.5 }],
    ["no holes", { squaresX: 3, squaresZ: 2 }],
    ["no holes, Corner Radius 2", { squaresX: 2, squaresZ: 1, cornerRadius: 2 }],
    ["holes without labels", defaultTray({ holes: DEFAULT_HOLES.map(({ label: _label, ...hole }) => hole) })],
    ["1 x 1 with one labelled hole", { squaresX: 1, squaresZ: 1, holes: [{ diameter: 14, x: 20.75, z: 26, label: "5mm" }] }],
    ["4 x 2", { squaresX: 4, squaresZ: 2, holes: DEFAULT_HOLES }],
    ["6 x 6, the largest", { squaresX: 6, squaresZ: 6, holes: DEFAULT_HOLES, cornerRadius: 1 }],
  ];

  for (const [name, options] of cases) {
    it(`${name}: watertight and manifold by the repo's check`, () => {
      const analysis = analyzeTriangleSoup(gridfinitySocketTrayPositions(options));
      expect(analysis.boundaryEdges).toBe(0);
      expect(analysis.nonManifoldEdges).toBe(0);
      expect(analysis.degenerateTriangles).toBe(0);
      expect(analysis.volume).toBeGreaterThan(0);
    });

    it(`${name}: every directed edge has exactly one partner, on the raw doubles`, () => {
      expect(directedEdgeDefects(gridfinitySocketTrayPositions(options))).toEqual([]);
    });
  }

  it("closes with every character a label may hold, in both styles", () => {
    const holes: GridfinitySocketTrayHole[] = [
      { diameter: 14, x: 22, z: 60, label: "01234" },
      { diameter: 14, x: 62, z: 60, label: "56789" },
      { diameter: 14, x: 102, z: 60, label: "mm" },
      { diameter: 14, x: 40, z: 26, label: "13mm" },
      { diameter: 14, x: 85, z: 26, label: "7" },
    ];
    for (const labelStyle of STYLES) {
      const positions = gridfinitySocketTrayPositions({ squaresX: 3, squaresZ: 2, holes, labelStyle });
      expect(directedEdgeDefects(positions)).toEqual([]);
      const analysis = analyzeTriangleSoup(positions);
      expect([analysis.boundaryEdges, analysis.nonManifoldEdges]).toEqual([0, 0]);
    }
  });

  it("builds a float32 geometry with the same triangle count", () => {
    const positions = gridfinitySocketTrayPositions(defaultTray());
    const geometry = createGridfinitySocketTrayGeometry(defaultTray());
    expect(geometry.getAttribute("position").count).toBe(positions.length / 3);
    expect(geometry.boundingBox?.max.x).toBeCloseTo(WIDTH, 5);
  });
});

describe("gridfinity socket tray: feet", () => {
  const TEST_PIECE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../test-prints/gridfinity-foot-test-piece.stl");

  it("a 2 x 1 tray has the printed foot test piece's feet and underside, triangle for triangle", () => {
    const printed = parseStlToScenePositions(readFileSync(TEST_PIECE_PATH, "utf8"));
    const tray = gridfinitySocketTrayPositions({ squaresX: 2, squaresZ: 1 });
    const printedFeet = footTriangleKeys(printed);
    expect(printedFeet.length).toBeGreaterThan(500);
    expect(footTriangleKeys(tray)).toEqual(printedFeet);
  });

  it("every foot of the default 3 x 2 tray is the printed test piece's first foot, moved by whole squares", () => {
    const printed = parseStlToScenePositions(readFileSync(TEST_PIECE_PATH, "utf8"));
    // A foot proper: the triangles reaching below the foot tops, inside one
    // square's own 41.5mm box.
    const insideFirstSquare = (x: number, z: number) => x >= -1e-9 && x <= 41.5 + 1e-9 && z >= -1e-9 && z <= 41.5 + 1e-9;
    const footProper = (positions: readonly number[], shiftX: number, shiftZ: number) => {
      const below: number[] = [];
      for (let i = 0; i + 8 < positions.length; i += 9) {
        if ([positions[i + 1], positions[i + 4], positions[i + 7]].some((y) => y < GRIDFINITY_FOOT_HEIGHT)) below.push(...positions.slice(i, i + 9));
      }
      return footTriangleKeys(below, shiftX, shiftZ, insideFirstSquare);
    };
    const printedFoot = footProper(printed, 0, 0);
    expect(printedFoot.length).toBeGreaterThan(200);
    const tray = gridfinitySocketTrayPositions(defaultTray());
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        expect(footProper(tray, GRIDFINITY_PITCH * i, GRIDFINITY_PITCH * j)).toEqual(printedFoot);
      }
    }
  });

  it("holes, labels and Corner Radius never change anything at or below the foot tops", () => {
    const bare = footTriangleKeys(gridfinityFootPositions({ squaresX: 3, squaresZ: 2, plateThickness: 3 }));
    expect(footTriangleKeys(gridfinitySocketTrayPositions(defaultTray()))).toEqual(bare);
    expect(footTriangleKeys(gridfinitySocketTrayPositions(defaultTray({ cornerRadius: 3, labelStyle: "recessed" })))).toEqual(bare);
  });

  it("stands on its feet, and between two feet its underside is at the foot tops", () => {
    const positions = gridfinitySocketTrayPositions(defaultTray());
    // Between hole 1 and hole 2, over foot (0, 0)'s bed face.
    const overFoot = verticalCrossings(positions, 36, 20);
    expect(overFoot).toHaveLength(2);
    expect(overFoot[0]).toBeCloseTo(0, 9);
    expect(overFoot[1]).toBeCloseTo(TOP_Y, 9);
    // In the 0.5mm gap between two feet the underside is at the foot tops.
    const inGap = verticalCrossings(positions, 41.75, 20);
    expect(inGap).toHaveLength(2);
    expect(inGap[0]).toBeCloseTo(GRIDFINITY_FOOT_HEIGHT, 9);
    expect(inGap[1]).toBeCloseTo(TOP_Y, 9);
  });
});

describe("gridfinity socket tray: holes", () => {
  it("every hole is open from the top face down to its floor, and solid below it", () => {
    for (const labelStyle of STYLES) {
      const positions = parseStlToScenePositions(toStlText(gridfinitySocketTrayPositions(defaultTray({ labelStyle }))));
      for (const hole of DEFAULT_HOLES) {
        const geometryZ = DEPTH - hole.z;
        for (const [dx, dz] of [
          [0.01, 0.013],
          [hole.diameter * 0.3, 0.017],
          [0.011, -hole.diameter * 0.3],
        ]) {
          const crossings = verticalCrossings(positions, hole.x + dx, geometryZ + dz);
          // The underside (a foot, or the body's own underside in the
          // 0.5mm gap between two rows of feet, which the default holes
          // sit over), then the hole's floor, and nothing above it.
          expect(crossings).toHaveLength(2);
          expect(crossings[0]).toBeLessThanOrEqual(GRIDFINITY_FOOT_HEIGHT + 1e-6);
          expect(crossings[1]).toBeCloseTo(FLOOR_Y, 6);
        }
      }
    }
  });

  it("measures 14mm deep over a 4mm floor", () => {
    const positions = gridfinitySocketTrayPositions(defaultTray());
    const [, floor] = verticalCrossings(positions, 62.75 + 0.01, DEPTH - 41.75 + 0.013);
    const [, top] = verticalCrossings(positions, 36, 20);
    expect(top - floor).toBeCloseTo(14, 9);
    expect(floor - GRIDFINITY_FOOT_HEIGHT).toBeCloseTo(4, 9);
  });

  it("is solid between holes and just outside each rim", () => {
    const positions = parseStlToScenePositions(toStlText(gridfinitySocketTrayPositions(defaultTray({ labelStyle: "recessed" }))));
    const z = DEPTH - 41.75;
    for (const x of [41.6, 83.9]) {
      const crossings = verticalCrossings(positions, x, z + 0.013);
      expect(crossings[crossings.length - 1]).toBeCloseTo(TOP_Y, 6);
      expect(crossings).toHaveLength(2);
    }
    for (const hole of DEFAULT_HOLES) {
      const crossings = verticalCrossings(positions, hole.x + hole.diameter / 2 + 0.5, z + 0.013);
      expect(crossings[crossings.length - 1]).toBeCloseTo(TOP_Y, 6);
      expect(crossings).toHaveLength(2);
    }
  });

  it("hole diameters are the typed diameters, measured on the floor ring", () => {
    const positions = gridfinitySocketTrayPositions(defaultTray());
    for (const hole of DEFAULT_HOLES) {
      let reach = 0;
      for (let i = 0; i < positions.length; i += 3) {
        if (positions[i + 1] !== FLOOR_Y) continue;
        const distance = Math.hypot(positions[i] - hole.x, positions[i + 2] - (DEPTH - hole.z));
        if (distance < hole.diameter) reach = Math.max(reach, distance);
      }
      expect(reach * 2).toBeCloseTo(hole.diameter, 9);
    }
  });

  it("z is typed from the FRONT edge: an asymmetric hole opens at depth - z and is solid at z", () => {
    const positions = gridfinitySocketTrayPositions({ squaresX: 3, squaresZ: 2, holes: ASYMMETRIC_HOLES, labelStyle: "recessed" });
    for (const hole of ASYMMETRIC_HOLES) {
      const open = verticalCrossings(positions, hole.x + 0.01, DEPTH - hole.z + 0.013);
      expect(open[open.length - 1]).toBeCloseTo(FLOOR_Y, 9);
      // The un-mirrored position: solid to the top face.
      const unmirrored = verticalCrossings(positions, hole.x + 0.01, hole.z + 0.013);
      expect(unmirrored[unmirrored.length - 1]).toBeCloseTo(TOP_Y, 9);
      // x is NOT mirrored: the hole's image about the width centreline is solid.
      const mirroredX = verticalCrossings(positions, WIDTH - hole.x + 0.01, DEPTH - hole.z + 0.013);
      expect(mirroredX[mirroredX.length - 1]).toBeCloseTo(TOP_Y, 9);
    }
  });

  it("Corner Radius widens each hole's opening at the top face and nothing below the fillet", () => {
    const cornerRadius = 2;
    const positions = gridfinitySocketTrayPositions(defaultTray({ cornerRadius, labelStyle: "recessed" }));
    const hole = DEFAULT_HOLES[1];
    const z = DEPTH - hole.z + 0.013;
    // Inside the nominal radius: open to the floor.
    expect(verticalCrossings(positions, hole.x + 9.4, z).pop()).toBeCloseTo(FLOOR_Y, 6);
    // Between the nominal radius and the widened rim: on the fillet.
    const onFillet = verticalCrossings(positions, hole.x + 10.5, z).pop() as number;
    expect(onFillet).toBeGreaterThan(TOP_Y - cornerRadius);
    expect(onFillet).toBeLessThan(TOP_Y);
    // Outside the widened rim: the flat top face.
    expect(verticalCrossings(positions, hole.x + 11.6, z).pop()).toBeCloseTo(TOP_Y, 9);
  });

  it("Corner Radius rounds the top perimeter and leaves the wall below it straight", () => {
    const cornerRadius = 2;
    const positions = gridfinitySocketTrayPositions({ squaresX: 3, squaresZ: 2, cornerRadius });
    // 0.5mm in from the long front edge, mid-side: on the fillet.
    const onFillet = verticalCrossings(positions, 60.3, DEPTH - 0.5).pop() as number;
    expect(onFillet).toBeGreaterThan(TOP_Y - cornerRadius);
    expect(onFillet).toBeLessThan(TOP_Y);
    // A quarter circle: at inset d the surface is r - sqrt(r^2 - (r - d)^2) below the top.
    expect(TOP_Y - onFillet).toBeCloseTo(cornerRadius - Math.sqrt(cornerRadius ** 2 - (cornerRadius - 0.5) ** 2), 1);
    // Past the fillet: the flat top face.
    expect(verticalCrossings(positions, 60.3, DEPTH - 2.5).pop()).toBeCloseTo(TOP_Y, 9);
    // The overall footprint is unchanged.
    const { min, max } = bounds(positions);
    expect([min[0], min[2], max[0], max[2]]).toEqual([0, 0, WIDTH, DEPTH]);
  });

  it("Corner Radius 0 leaves no vertex between the hole floors and the top face other than on them", () => {
    const positions = gridfinitySocketTrayPositions(defaultTray({ labelStyle: "recessed", holes: DEFAULT_HOLES.map((hole) => ({ ...hole, label: "" })) }));
    const heights = new Set<number>();
    for (let i = 1; i < positions.length; i += 3) if (positions[i] > GRIDFINITY_FOOT_HEIGHT) heights.add(positions[i]);
    expect([...heights].sort((a, b) => a - b)).toEqual([FLOOR_Y, TOP_Y]);
  });
});

describe("gridfinity socket tray: labels", () => {
  it("places each label centred on its hole, one gap in front of its rim", () => {
    const { labels, holes } = gridfinitySocketTrayLayout(defaultTray());
    expect(labels.map((label) => label.text)).toEqual(["8mm", "10mm", "12mm"]);
    labels.forEach((label, index) => {
      const hole = holes[index];
      expect((label.minX + label.maxX) / 2).toBeCloseTo(hole.x, 9);
      // In front of the hole: toward the front edge, Z = depth.
      expect(label.minZ - (hole.z + hole.radius)).toBeCloseTo(GRIDFINITY_SOCKET_TRAY_GAP, 9);
      expect(label.maxZ - label.minZ).toBeCloseTo(LABEL_DIGIT_HEIGHT, 9);
      expect(label.maxZ).toBeLessThanOrEqual(DEPTH - GRIDFINITY_SOCKET_TRAY_EDGE_CLEARANCE);
      const outline = labelOutline(label.text);
      expect(label.maxX - label.minX).toBeCloseTo(outline.maxX - outline.minX, 9);
    });
  });

  it("with a Corner Radius the label keeps its gap from the WIDENED rim", () => {
    const { labels, holes } = gridfinitySocketTrayLayout(defaultTray({ cornerRadius: 2 }));
    labels.forEach((label, index) => {
      expect(label.minZ - (holes[index].z + holes[index].radius + 2)).toBeCloseTo(GRIDFINITY_SOCKET_TRAY_GAP, 9);
    });
  });

  it("reads upright from the front: left to right along +X, tops of the letters toward the hole", () => {
    const { labels, holes } = gridfinitySocketTrayLayout(defaultTray());
    const label = labels[1]; // "10mm"
    const extents = label.glyphs.map((glyph) => ({
      minX: Math.min(...glyph.outer.map(([x]) => x)),
      maxX: Math.max(...glyph.outer.map(([x]) => x)),
      minZ: Math.min(...glyph.outer.map(([, z]) => z)),
      maxZ: Math.max(...glyph.outer.map(([, z]) => z)),
    }));
    expect(extents).toHaveLength(4);
    // "1", "0", "m", "m" in that order along +X -- which is left to right
    // for a viewer on the +Z side, the side the front edge is on.
    for (let i = 0; i + 1 < extents.length; i += 1) expect(extents[i].maxX).toBeLessThan(extents[i + 1].minX);
    // The digits are taller than the "m"s, and all four stand on one
    // baseline at the FRONT (largest z): the extra height reaches toward the
    // hole (smaller z), so "up the page" is away from the viewer.
    const [one, zero, m1, m2] = extents;
    expect(m1.maxZ).toBeCloseTo(label.baselineZ, 9);
    expect(m2.maxZ).toBeCloseTo(label.baselineZ, 9);
    expect(one.maxZ).toBeCloseTo(label.baselineZ, 9);
    expect(one.minZ).toBeLessThan(m1.minZ - 0.5);
    expect(zero.minZ).toBeLessThan(m1.minZ - 0.5);
    // And the whole label lies between its hole and the front edge.
    expect(label.minZ).toBeGreaterThan(holes[1].z + holes[1].radius);
    expect(label.maxZ).toBeLessThan(DEPTH);
  });

  it("raised labels stand 0.8mm proud and recessed labels are cut 0.8mm deep, measured by raycast", () => {
    const { labels } = gridfinitySocketTrayLayout(defaultTray());
    for (const labelStyle of STYLES) {
      const positions = parseStlToScenePositions(toStlText(gridfinitySocketTrayPositions(defaultTray({ labelStyle }))));
      const expected = labelStyle === "raised" ? TOP_Y + LABEL_DEPTH : TOP_Y - LABEL_DEPTH;
      for (const label of labels) {
        // The stem of the last "m": its leftmost 0.3mm, a third of the way up.
        const glyph = label.glyphs[label.glyphs.length - 1];
        const minX = Math.min(...glyph.outer.map(([x]) => x));
        const crossings = verticalCrossings(positions, minX + 0.3, label.baselineZ - 1.2);
        expect(crossings[crossings.length - 1]).toBeCloseTo(expected, 6);
        // Just left of the label: the flat top face.
        const beside = verticalCrossings(positions, label.minX - 1, label.baselineZ - 1.2);
        expect(beside[beside.length - 1]).toBeCloseTo(TOP_Y, 6);
      }
    }
  });

  it("label faces measure the font's own ink, inside the 5mm digit band", () => {
    const { labels } = gridfinitySocketTrayLayout(defaultTray());
    for (const labelStyle of STYLES) {
      const positions = gridfinitySocketTrayPositions(defaultTray({ labelStyle }));
      const faceY = labelStyle === "raised" ? TOP_Y + LABEL_DEPTH : TOP_Y - LABEL_DEPTH;
      for (const label of labels) {
        let minZ = Infinity;
        let maxZ = -Infinity;
        let minX = Infinity;
        let maxX = -Infinity;
        for (let i = 0; i < positions.length; i += 3) {
          if (positions[i + 1] !== faceY) continue;
          if (positions[i] < label.minX - 1e-9 || positions[i] > label.maxX + 1e-9) continue;
          minX = Math.min(minX, positions[i]);
          maxX = Math.max(maxX, positions[i]);
          minZ = Math.min(minZ, positions[i + 2]);
          maxZ = Math.max(maxZ, positions[i + 2]);
        }
        const outline = labelOutline(label.text);
        expect(maxZ - minZ).toBeCloseTo(outline.maxY - outline.minY, 9);
        expect(maxX - minX).toBeCloseTo(outline.maxX - outline.minX, 9);
        expect(minZ).toBeGreaterThanOrEqual(label.minZ - 1e-9);
        expect(maxZ).toBeLessThanOrEqual(label.maxZ + 1e-9);
        expect(maxZ - minZ).toBeLessThanOrEqual(LABEL_DIGIT_HEIGHT);
        expect(maxZ - minZ).toBeGreaterThan(4.6);
      }
      expect(LABEL_BAND_TOP - LABEL_BAND_BOTTOM).toBeCloseTo(5, 12);
    }
  });

  it("a hole with blank label text gets no label", () => {
    const labelled = gridfinitySocketTrayPositions(defaultTray());
    const blank = gridfinitySocketTrayPositions(defaultTray({ holes: DEFAULT_HOLES.map((hole) => ({ ...hole, label: "" })) }));
    const missing = gridfinitySocketTrayPositions(defaultTray({ holes: DEFAULT_HOLES.map(({ label: _label, ...hole }) => hole) }));
    expect(blank).toEqual(missing);
    expect(blank.length).toBeLessThan(labelled.length);
    expect(gridfinitySocketTrayLayout(defaultTray({ holes: [{ ...DEFAULT_HOLES[0], label: "" }, DEFAULT_HOLES[1]] })).labels.map((label) => label.hole)).toEqual([1]);
    expect(bounds(blank).max[1]).toBe(TOP_Y);
  });

  it("the raised/recessed setting applies to every label on the tray", () => {
    const raised = gridfinitySocketTrayPositions(defaultTray({ labelStyle: "raised" }));
    const recessed = gridfinitySocketTrayPositions(defaultTray({ labelStyle: "recessed" }));
    expect(raised.length).toBe(recessed.length);
    const heightsAbove = (positions: number[]) => positions.filter((value, index) => index % 3 === 1 && value > TOP_Y).length;
    expect(heightsAbove(raised)).toBeGreaterThan(0);
    expect(heightsAbove(recessed)).toBe(0);
  });
});

describe("gridfinity socket tray: guards", () => {
  const tray = (holes: GridfinitySocketTrayHole[], overrides: GridfinitySocketTrayOptions = {}) => () => gridfinitySocketTrayPositions({ squaresX: 3, squaresZ: 2, holes, ...overrides });

  it("bed size: more than 6 squares along either axis does not fit the 256mm bed", () => {
    expect(MAX_GRIDFINITY_SOCKET_TRAY_SQUARES).toBe(6);
    expect(GRIDFINITY_SOCKET_TRAY_BED_SIZE).toBe(256);
    expect(() => gridfinitySocketTrayPositions({ squaresX: 6, squaresZ: 6 })).not.toThrow();
    expect(() => gridfinitySocketTrayPositions({ squaresX: 7, squaresZ: 2 })).toThrow(/7 squares wide \(293.5mm\), which does not fit the 256mm bed/);
    expect(() => gridfinitySocketTrayPositions({ squaresX: 3, squaresZ: 7 })).toThrow(/7 squares deep \(293.5mm\), which does not fit the 256mm bed/);
  });

  it("squares must be whole numbers, 1 or more", () => {
    expect(() => gridfinitySocketTrayPositions({ squaresX: 2.5, squaresZ: 2 })).toThrow(/squaresX must be a whole number of squares/);
    expect(() => gridfinitySocketTrayPositions({ squaresX: 3, squaresZ: 0 })).toThrow(/squaresZ must be a whole number of squares/);
  });

  it("edge: a hole's rim must stay 4mm from every tray edge", () => {
    expect(GRIDFINITY_SOCKET_TRAY_EDGE_CLEARANCE).toBe(4);
    // Exactly on the limit is allowed, on all four sides.
    expect(tray([{ diameter: 14, x: 11, z: 40 }])).not.toThrow();
    expect(tray([{ diameter: 14, x: WIDTH - 11, z: 40 }])).not.toThrow();
    expect(tray([{ diameter: 14, x: 60, z: 11 }])).not.toThrow();
    expect(tray([{ diameter: 14, x: 60, z: DEPTH - 11 }])).not.toThrow();
    expect(tray([{ diameter: 14, x: 10.9, z: 40 }])).toThrow(/hole 0: footprint \(r=7mm\) is within 4mm of the tray edge/);
    expect(tray([{ diameter: 14, x: WIDTH - 10.9, z: 40 }])).toThrow(/hole 0: footprint/);
    expect(tray([{ diameter: 14, x: 60, z: 10.9 }])).toThrow(/hole 0: footprint/);
    expect(tray([{ diameter: 14, x: 60, z: DEPTH - 10.9 }])).toThrow(/hole 0: footprint/);
  });

  it("hole spacing: two rims must stay 3mm apart", () => {
    expect(GRIDFINITY_SOCKET_TRAY_GAP).toBe(3);
    // 14mm holes: centres 17mm apart is exactly the limit.
    expect(tray([{ diameter: 14, x: 30, z: 40 }, { diameter: 14, x: 47, z: 40 }])).not.toThrow();
    expect(tray([{ diameter: 14, x: 30, z: 40 }, { diameter: 14, x: 46.9, z: 40 }])).toThrow(/holes 0 and 1: footprints overlap or leave too thin a wall \(centers 16.90mm apart\)/);
    expect(tray([{ diameter: 14, x: 30.1, z: 40 }, { diameter: 14, x: 47.1, z: 40 }])).not.toThrow();
  });

  it("label edge: a label must stay 4mm from every tray edge", () => {
    // "10mm" is 18.11mm wide: centred 12mm from the left edge it reaches to 2.9mm.
    expect(tray([{ diameter: 14, x: 12, z: 40, label: "10mm" }])).toThrow(/label 0 \("10mm"\) is within 4mm of the tray edge/);
    expect(tray([{ diameter: 14, x: 12, z: 40 }])).not.toThrow();
    // A hole too near the FRONT edge for its label: rim at 7, label band from 4 down to -1.
    expect(tray([{ diameter: 14, x: 60, z: 14, label: "5mm" }])).toThrow(/label 0 \("5mm"\) is within 4mm of the tray edge/);
    expect(tray([{ diameter: 14, x: 60, z: 14 }])).not.toThrow();
    // Exactly on the limit: rim 12mm from the front edge, 3mm gap, 5mm band, 4mm clearance.
    expect(tray([{ diameter: 14, x: 60, z: 19, label: "5mm" }])).not.toThrow();
    expect(tray([{ diameter: 14, x: 60, z: 18.9, label: "5mm" }])).toThrow(/label 0 .* tray edge/);
  });

  it("label overlap: two labels must stay 3mm apart", () => {
    // Two 14mm holes at the 3mm hole limit (17mm pitch): their "10mm" and
    // "11mm" labels, 18.11mm wide each, would overlap.
    const crowded = [
      { diameter: 14, x: 40, z: 40, label: "10mm" },
      { diameter: 14, x: 57, z: 40, label: "11mm" },
    ];
    expect(tray(crowded)).toThrow(/labels 0 and 1 \("10mm" and "11mm"\) are within 3mm of each other/);
    // The same holes without labels are fine: it is the labels that collide.
    expect(tray(crowded.map(({ label: _label, ...hole }) => hole))).not.toThrow();
    // One label only: fine.
    expect(tray([crowded[0], { ...crowded[1], label: "" }])).not.toThrow();
    // Far enough apart: 18.11 + 3 = 21.11mm pitch.
    expect(tray([crowded[0], { ...crowded[1], x: 40 + 21.2 }])).not.toThrow();
    expect(tray([crowded[0], { ...crowded[1], x: 40 + 21.0 }])).toThrow(/labels 0 and 1/);
  });

  it("label to hole: a label must stay 3mm from every other hole", () => {
    // Hole 1 sits directly in front of hole 0, where hole 0's label goes.
    const stacked = [
      { diameter: 14, x: 60, z: 60, label: "5mm" },
      { diameter: 14, x: 60, z: 43 },
    ];
    expect(tray(stacked)).toThrow(/label 0 \("5mm"\) is within 3mm of hole 1/);
    expect(tray(stacked.map(({ label: _label, ...hole }) => hole))).not.toThrow();
    // Moved forward by the label band plus one more gap, it clears.
    expect(tray([stacked[0], { diameter: 14, x: 60, z: 60 - 7 - 3 - 5 - 3 - 7 }])).not.toThrow();
  });

  it("Corner Radius: must stay below the tray's 3.75mm plan corner radius", () => {
    expect(GRIDFINITY_FOOT_TOP_RADIUS).toBe(3.75);
    expect(tray([], { cornerRadius: 3.7 })).not.toThrow();
    expect(tray([], { cornerRadius: 3.75 })).toThrow(/corner radius 3.75mm is too large: it must stay below the tray's own 3.75mm plan corner radius/);
    expect(tray([], { cornerRadius: 10 })).toThrow(/corner radius 10mm is too large/);
    expect(tray([], { cornerRadius: -1 })).toThrow(/corner radius must be zero or positive/);
  });

  it("Corner Radius: a widened rim must still clear the edge and its neighbours", () => {
    expect(tray([{ diameter: 14, x: 11, z: 40 }], { cornerRadius: 1 })).toThrow(/corner radius 1mm widens hole 0 \(diameter 14mm\) to within 4mm of the tray edge/);
    expect(tray([{ diameter: 14, x: 12, z: 40 }], { cornerRadius: 1 })).not.toThrow();
    const pair = [{ diameter: 14, x: 30, z: 40 }, { diameter: 14, x: 47, z: 40 }];
    expect(tray(pair, { cornerRadius: 1 })).toThrow(/corner radius 1mm widens hole 0 too close to hole 1/);
    expect(tray([pair[0], { ...pair[1], x: 49 }], { cornerRadius: 1 })).not.toThrow();
  });

  it("label text: only 0123456789m", () => {
    expect(tray([{ diameter: 14, x: 60, z: 40, label: "5 mm" }])).toThrow(/label 0: "5 mm" contains " "; only the characters 0123456789m are supported/);
    expect(tray([{ diameter: 14, x: 60, z: 40, label: "3/8" }])).toThrow(/label 0: "3\/8" contains "\/"/);
    expect(tray([{ diameter: 14, x: 60, z: 40, label: "16mm" }])).not.toThrow();
  });

  it("invalid hole values and label style", () => {
    expect(tray([{ diameter: 0, x: 60, z: 40 }])).toThrow(/hole 0: diameter\/x\/z must be finite/);
    expect(tray([{ diameter: 14, x: Number.NaN, z: 40 }])).toThrow(/hole 0: diameter\/x\/z must be finite/);
    expect(tray([], { labelStyle: "engraved" as LabelStyle })).toThrow(/label style must be "raised" or "recessed"/);
  });

  it("nothing moves automatically: a rejected layout throws, it is not adjusted", () => {
    const holes = [{ diameter: 14, x: 12, z: 40, label: "10mm" }];
    expect(tray(holes)).toThrow();
    // The same hole, labelled with something narrow enough, lands exactly where it was typed.
    const { holes: placed, labels } = gridfinitySocketTrayLayout({ squaresX: 3, squaresZ: 2, holes: [{ ...holes[0], label: "5" }] });
    expect(placed[0]).toMatchObject({ x: 12, z: DEPTH - 40, radius: 7 });
    expect((labels[0].minX + labels[0].maxX) / 2).toBeCloseTo(12, 9);
  });
});
