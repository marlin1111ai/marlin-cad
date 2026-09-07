import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createScrewdriverTrayGeometry,
  MIN_SCREWDRIVER_TRAY_THICKNESS,
  normalizeScrewdriverTrayCornerRadius,
  normalizeScrewdriverTrayDepth,
  normalizeScrewdriverTrayThickness,
  normalizeScrewdriverTrayWidth,
  screwdriverTrayPositions,
  type ScrewdriverTrayHole,
  type ScrewdriverTrayOptions,
} from "@/lib/screwdriverTrayGeometry";
import { analyzeTriangleSoup } from "@/lib/svgImport";

// Converts a raw positions array to ASCII STL text (same coordinate
// convention as stlExport.ts: scene [x, y, z] -> file [x, -z, y]) and
// immediately parses that TEXT back into a positions array in scene
// coordinates -- an actual STL round-trip, not a re-use of the in-memory
// geometry, per KNOWN-FIXES.md's "raycast the exported STL, don't trust mesh
// checks alone."
function toStlText(positions: readonly number[]): string {
  const lines = ["solid screwdriver_tray_test"];
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const toZUp = (x: number, y: number, z: number) => [x, -z, y] as const;
    const a = toZUp(positions[i], positions[i + 1], positions[i + 2]);
    const b = toZUp(positions[i + 3], positions[i + 4], positions[i + 5]);
    const c = toZUp(positions[i + 6], positions[i + 7], positions[i + 8]);
    lines.push("  facet normal 0 0 0", "    outer loop", `      vertex ${a[0]} ${a[1]} ${a[2]}`, `      vertex ${b[0]} ${b[1]} ${b[2]}`, `      vertex ${c[0]} ${c[1]} ${c[2]}`, "    endloop", "  endfacet");
  }
  lines.push("endsolid screwdriver_tray_test");
  return lines.join("\n");
}

function parseStlToScenePositions(stl: string): number[] {
  const positions: number[] = [];
  const vertexPattern = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = vertexPattern.exec(stl))) {
    const fx = Number(match[1]);
    const fy = Number(match[2]);
    const fz = Number(match[3]);
    // Inverse of [x, y, z] -> [x, -z, y]: scene x = file x, scene y = file z, scene z = -file y.
    positions.push(fx, fz, -fy);
  }
  return positions;
}

// The registered default insert: 240 x 60 x 18 with three through-holes at
// 8 / 10 / 12mm on the z = 30 centreline, 30mm end margins, 90mm pitch.
// The diameters are deliberate GENERIC PLACEHOLDERS chosen by the owner, not
// measured shaft sizes -- unlike the Socket Tray's coupon, whose diameters
// are caliper-measured socket ODs plus a stated clearance.
const DEFAULT_HOLES: ScrewdriverTrayHole[] = [
  { diameter: 8, x: 30, z: 30 },
  { diameter: 10, x: 120, z: 30 },
  { diameter: 12, x: 210, z: 30 },
];
const DEFAULT_OPTIONS: ScrewdriverTrayOptions = { width: 240, depth: 60, thickness: 18, holes: DEFAULT_HOLES };

// A deliberately ASYMMETRIC layout: no two holes share an x, none shares a z,
// and none sits at a mirror image of another about either centreline. A
// coordinate error (a swapped axis, a missing or a spurious mirror -- the
// exact class of bug that shipped on the Mounted Socket Tray, see
// KNOWN-FIXES.md) cannot pass on this layout the way it can on a symmetric
// one. Mirror images about x = width/2 are x = 200 / 145 / 80, all of which
// land in solid material and are asserted so below.
const ASYMMETRIC_HOLES: ScrewdriverTrayHole[] = [
  { diameter: 8, x: 40, z: 20 },
  { diameter: 10, x: 95, z: 30 },
  { diameter: 12, x: 160, z: 42 },
];
const ASYMMETRIC_OPTIONS: ScrewdriverTrayOptions = { width: 240, depth: 60, thickness: 18, holes: ASYMMETRIC_HOLES };

// Two 12mm holes 16.1mm apart, centre to centre: the pairwise guard's
// minimum is 6 + 6 + 4 = 16mm, so this clears it by 0.1mm and leaves a
// 4.1mm dividing wall -- the tightest layout the module accepts.
const TIGHT_OPTIONS: ScrewdriverTrayOptions = {
  width: 240,
  depth: 60,
  thickness: 18,
  holes: [
    { diameter: 12, x: 100, z: 30 },
    { diameter: 12, x: 116.1, z: 30 },
  ],
};

function expectManifold(positions: readonly number[]) {
  expect(positions.every(Number.isFinite)).toBe(true);
  const analysis = analyzeTriangleSoup(positions as number[]);
  expect(analysis.boundaryEdges).toBe(0);
  expect(analysis.nonManifoldEdges).toBe(0);
}

// Stricter than the spatially-quantized check above -- every directed edge
// must appear exactly once, with its reverse exactly once, on the raw double
// coordinates. Only holds if every stitched seam (top-cap notch <-> hole wall
// top ring, hole wall bottom ring <-> BOTTOM-cap notch) reuses bit-identical
// vertex coordinates and every winding is consistent -- the exact-stitch
// contract from CLAUDE-LESSONS.md. Note the second seam is the one the Socket
// Tray does not have: there, the wall's bottom ring closes into a floor cap.
function expectExactDirectedEdges(positions: readonly number[]) {
  const directed = new Map<string, number>();
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const keys = [0, 3, 6].map((offset) => `${positions[i + offset]},${positions[i + offset + 1]},${positions[i + offset + 2]}`);
    for (let edge = 0; edge < 3; edge += 1) {
      const key = `${keys[edge]}|${keys[(edge + 1) % 3]}`;
      directed.set(key, (directed.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of directed) {
    expect(count, `directed edge ${key} should appear exactly once`).toBe(1);
    const [a, b] = key.split("|");
    expect(directed.get(`${b}|${a}`), `reverse of ${key} should appear exactly once`).toBe(1);
  }
}

// A hole sealed shut by a stray cap still passes every manifold check above
// -- it's a perfectly valid closed solid, just the WRONG one
// (CLAUDE-LESSONS.md). Raycast the actual geometry instead. Barycentric solve
// in (X, Z) for the ray x=const, z=const running along Y; returns the sorted
// Y values where the ray crosses a triangle.
function verticalCrossingsFromPositions(positions: readonly number[], x: number, z: number): number[] {
  const crossings: number[] = [];
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const p0: [number, number, number] = [positions[i], positions[i + 1], positions[i + 2]];
    const p1: [number, number, number] = [positions[i + 3], positions[i + 4], positions[i + 5]];
    const p2: [number, number, number] = [positions[i + 6], positions[i + 7], positions[i + 8]];
    const denom = (p1[2] - p2[2]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[2] - p2[2]);
    if (Math.abs(denom) < 1e-9) continue;
    const a = ((p1[2] - p2[2]) * (x - p2[0]) + (p2[0] - p1[0]) * (z - p2[2])) / denom;
    const b = ((p2[2] - p0[2]) * (x - p2[0]) + (p0[0] - p2[0]) * (z - p2[2])) / denom;
    const c = 1 - a - b;
    if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
    crossings.push(a * p0[1] + b * p1[1] + c * p2[1]);
  }
  crossings.sort((m, n) => m - n);
  // A sample point that lands exactly on an internal edge of a flat face's
  // own earcut triangulation registers a hit from both triangles sharing that
  // edge -- same physical surface, same Y, not a second layer of material.
  // Merge crossings within float noise of each other; real distinct layers
  // here (bottom face / top face) are mm apart, so this cannot hide an actual
  // double wall.
  const merged: number[] = [];
  for (const y of crossings) {
    if (merged.length === 0 || Math.abs(y - merged[merged.length - 1]) > 1e-6) merged.push(y);
  }
  return merged;
}

function verticalCrossings(geometry: THREE.BufferGeometry, x: number, z: number): number[] {
  const position = geometry.getAttribute("position");
  const positions: number[] = [];
  for (let i = 0; i < position.count; i += 1) positions.push(position.getX(i), position.getY(i), position.getZ(i));
  return verticalCrossingsFromPositions(positions, x, z);
}

describe("screwdriverTrayPositions: default insert layout", () => {
  it("is watertight and manifold (0 boundary edges, 0 non-manifold edges)", () => {
    expectManifold(screwdriverTrayPositions(DEFAULT_OPTIONS));
  });

  it("exact directed-edge manifold (bit-identical seams, consistent winding)", () => {
    expectExactDirectedEdges(screwdriverTrayPositions(DEFAULT_OPTIONS));
  });

  it("bounding box matches the requested tray dimensions", () => {
    const geometry = createScrewdriverTrayGeometry(DEFAULT_OPTIONS);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(0, 6);
    expect(box.max.x).toBeCloseTo(240, 6);
    expect(box.min.y).toBeCloseTo(0, 6);
    expect(box.max.y).toBeCloseTo(18, 6);
    expect(box.min.z).toBeCloseTo(0, 6);
    expect(box.max.z).toBeCloseTo(60, 6);
  });

  it("a tray with no holes at all is still a manifold slab", () => {
    const positions = screwdriverTrayPositions({ width: 240, depth: 60, thickness: 18 });
    expectManifold(positions);
    expectExactDirectedEdges(positions);
    // 6 plain rectangular faces, 2 triangles each.
    expect(positions.length / 9).toBe(12);
  });
});

describe("screwdriverTrayPositions: holes are open all the way THROUGH", () => {
  const geometry = createScrewdriverTrayGeometry(DEFAULT_OPTIONS);

  // The defining difference from the Socket Tray. There, a vertical ray down
  // a pocket's axis crosses the pocket floor and then the tray bottom (two
  // crossings). Here it must cross NOTHING: no floor cap, no bottom face,
  // no top face -- the bore is open at both ends.
  it.each(DEFAULT_HOLES)("hole d=$diameter at x=$x: zero solid crossings on its axis (open top to bottom)", (hole) => {
    expect(verticalCrossings(geometry, hole.x, hole.z)).toEqual([]);
  });

  it("off-centre but still inside the largest hole (12mm), still open top to bottom", () => {
    // 12mm hole at x = 210; sample 4mm off-axis, well inside the 6mm radius.
    expect(verticalCrossings(geometry, 214, 30)).toEqual([]);
    expect(verticalCrossings(geometry, 210, 26)).toEqual([]);
  });

  it("off-centre but still inside the smallest hole (8mm), still open top to bottom", () => {
    // 8mm hole at x = 30; sample 2.5mm off-axis, inside the 4mm radius.
    expect(verticalCrossings(geometry, 32.5, 30)).toEqual([]);
  });

  it("between holes the tray is a solid slab top to bottom", () => {
    const crossings = verticalCrossings(geometry, 75, 30);
    expect(crossings.length).toBe(2);
    expect(crossings[0]).toBeCloseTo(0, 6);
    expect(crossings[1]).toBeCloseTo(18, 6);
  });

  it("just outside a hole's rim the tray is solid again (the wall does not overshoot)", () => {
    // 10mm hole at x = 120: 5mm nominal radius, sample 0.5mm outside it.
    const crossings = verticalCrossings(geometry, 125.5, 30);
    expect(crossings.length).toBe(2);
    expect(crossings[0]).toBeCloseTo(0, 6);
    expect(crossings[1]).toBeCloseTo(18, 6);
  });

  it("in front of and behind the hole row the tray is solid (holes perforate nothing else)", () => {
    for (const z of [12, 48]) {
      const crossings = verticalCrossings(geometry, 120, z);
      expect(crossings.length, `z=${z}`).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 6);
      expect(crossings[1]).toBeCloseTo(18, 6);
    }
  });
});

describe("screwdriverTrayPositions: asymmetric layout pins the coordinate convention", () => {
  const positions = screwdriverTrayPositions(ASYMMETRIC_OPTIONS);
  const geometry = createScrewdriverTrayGeometry(ASYMMETRIC_OPTIONS);

  it("is watertight and manifold", () => {
    expectManifold(positions);
  });

  it("exact directed-edge manifold", () => {
    expectExactDirectedEdges(positions);
  });

  it.each(ASYMMETRIC_HOLES)("hole d=$diameter at (x=$x, z=$z): open exactly where it was asked for", (hole) => {
    expect(verticalCrossings(geometry, hole.x, hole.z)).toEqual([]);
  });

  // The mirror trap. Each hole's image about the width centreline (x = 120)
  // must be SOLID. If an as-mounted-style x mirror were ever introduced into
  // this flat tray -- it must not be, the tray lies flat with no fixed
  // viewing side -- these three samples would open up and the ones above
  // would close.
  it.each([
    { label: "mirror of x=40", x: 200, z: 20 },
    { label: "mirror of x=95", x: 145, z: 30 },
    { label: "mirror of x=160", x: 80, z: 42 },
  ])("$label (x=$x, z=$z) is solid, so no x mirror is applied anywhere", ({ x, z }) => {
    const crossings = verticalCrossings(geometry, x, z);
    expect(crossings.length).toBe(2);
    expect(crossings[0]).toBeCloseTo(0, 6);
    expect(crossings[1]).toBeCloseTo(18, 6);
  });

  // The z images likewise: a swapped x/z would move every hole.
  it.each([
    { label: "z image of the d=8 hole", x: 40, z: 40 },
    { label: "z image of the d=12 hole", x: 160, z: 18 },
  ])("$label (x=$x, z=$z) is solid, so x and z are not swapped", ({ x, z }) => {
    const crossings = verticalCrossings(geometry, x, z);
    expect(crossings.length).toBe(2);
    expect(crossings[0]).toBeCloseTo(0, 6);
    expect(crossings[1]).toBeCloseTo(18, 6);
  });
});

describe("screwdriverTrayPositions: tightest accepted gap", () => {
  // Two 12mm holes 16.1mm apart -- 0.1mm above the 16mm pairwise minimum,
  // leaving a 4.1mm dividing wall. Per CLAUDE-LESSONS.md's slicer-slit-fusion
  // entry the geometry passing is not proof the wall prints; what this pins
  // is that the module actually emits a wall there rather than letting the
  // two bores merge.
  const positions = screwdriverTrayPositions(TIGHT_OPTIONS);
  const geometry = createScrewdriverTrayGeometry(TIGHT_OPTIONS);

  it("is watertight and manifold at the tightest accepted spacing", () => {
    expectManifold(positions);
    expectExactDirectedEdges(positions);
  });

  it("the 4.1mm dividing wall is solid top to bottom", () => {
    const crossings = verticalCrossings(geometry, 108.05, 30);
    expect(crossings.length).toBe(2);
    expect(crossings[0]).toBeCloseTo(0, 6);
    expect(crossings[1]).toBeCloseTo(18, 6);
  });

  it("both bores either side of that wall are still open top to bottom", () => {
    expect(verticalCrossings(geometry, 100, 30)).toEqual([]);
    expect(verticalCrossings(geometry, 116.1, 30)).toEqual([]);
  });

  it("0.1mm tighter is rejected", () => {
    expect(() =>
      screwdriverTrayPositions({ ...TIGHT_OPTIONS, holes: [{ diameter: 12, x: 100, z: 30 }, { diameter: 12, x: 115.9, z: 30 }] }),
    ).toThrow(/overlap or leave too thin a wall/);
  });
});

describe("screwdriverTrayPositions: corner radius (fillet)", () => {
  it("radius 0 is identical to omitting cornerRadius entirely", () => {
    expect(screwdriverTrayPositions({ ...DEFAULT_OPTIONS, cornerRadius: 0 })).toEqual(screwdriverTrayPositions(DEFAULT_OPTIONS));
  });

  describe("valid nonzero radius", () => {
    const ROUNDED_OPTIONS: ScrewdriverTrayOptions = { ...ASYMMETRIC_OPTIONS, cornerRadius: 3 };
    const positions = screwdriverTrayPositions(ROUNDED_OPTIONS);

    it("is watertight and manifold", () => {
      expectManifold(positions);
    });

    it("exact directed-edge manifold", () => {
      expectExactDirectedEdges(positions);
    });

    it("bounding box is unchanged by the fillet (it recedes inward, never grows outward)", () => {
      const geometry = createScrewdriverTrayGeometry(ROUNDED_OPTIONS);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      expect(box.min.x).toBeCloseTo(0, 6);
      expect(box.max.x).toBeCloseTo(240, 6);
      expect(box.min.y).toBeCloseTo(0, 6);
      expect(box.max.y).toBeCloseTo(18, 6);
      expect(box.min.z).toBeCloseTo(0, 6);
      expect(box.max.z).toBeCloseTo(60, 6);
    });

    // Raycast the actual EXPORTED STL -- an ASCII round-trip through
    // toStlText/parseStlToScenePositions, not the in-memory geometry. A rim
    // fillet could reseal a bore while every check above still passed.
    it.each(ASYMMETRIC_HOLES)("hole d=$diameter, rounded: still open top to bottom on the EXPORTED STL", (hole) => {
      const exported = parseStlToScenePositions(toStlText(positions));
      expect(verticalCrossingsFromPositions(exported, hole.x, hole.z)).toEqual([]);
    });

    it("between holes, the exported STL is still a solid slab top to bottom", () => {
      const exported = parseStlToScenePositions(toStlText(positions));
      const crossings = verticalCrossingsFromPositions(exported, 130, 30);
      expect(crossings.length).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 3);
      expect(crossings[1]).toBeCloseTo(18, 3);
    });

    // THE BOTTOM RIM IS SHARP (owner's decision -- recon option A). Sample
    // inside the fillet's widened band: 1.5mm outside the 10mm hole's 5mm
    // nominal radius, i.e. within the 3mm the top rim widens by. The top face
    // is open there, so the ray enters material only at the fillet surface --
    // but it must still exit at Y = 0, proving material runs all the way down
    // to a SHARP bottom rim rather than being eased away by a second fillet.
    it("the bottom rim is sharp: material reaches Y=0 at a radius the top rim has opened up", () => {
      const geometry = createScrewdriverTrayGeometry(ROUNDED_OPTIONS);
      const crossings = verticalCrossings(geometry, 95 + 6.5, 30); // 10mm hole at x=95, r=5, sample at r+1.5
      expect(crossings.length).toBe(2);
      expect(crossings[0]).toBeCloseTo(0, 6); // sharp bottom rim: solid down to the bottom face
      // Top surface here is the fillet band, strictly between the fillet's
      // start (18 - 3) and the top face (18) -- i.e. genuinely rounded above.
      expect(crossings[1]).toBeGreaterThan(15);
      expect(crossings[1]).toBeLessThan(18);
    });

    it("the bottom face's notch is the NOMINAL radius, not the widened one", () => {
      // 0.5mm outside the nominal 5mm radius of the x=95 hole: at Y just
      // above the bottom face there must be material (bottom rim sharp), and
      // at the hole's own nominal radius minus a hair there must be none.
      const geometry = createScrewdriverTrayGeometry(ROUNDED_OPTIONS);
      expect(verticalCrossings(geometry, 95 + 5.5, 30)[0]).toBeCloseTo(0, 6);
      expect(verticalCrossings(geometry, 95 + 4.5, 30)).toEqual([]);
    });
  });
});

describe("screwdriverTrayPositions: validation guards", () => {
  it("rejects a tray thinner than the 10mm minimum", () => {
    expect(MIN_SCREWDRIVER_TRAY_THICKNESS).toBe(10);
    expect(() => screwdriverTrayPositions({ ...DEFAULT_OPTIONS, thickness: 9.5 })).toThrow(/below the 10mm minimum/);
    expect(() => normalizeScrewdriverTrayThickness(2)).toThrow(/below the 10mm minimum/);
  });

  it("accepts exactly the 10mm minimum", () => {
    expect(normalizeScrewdriverTrayThickness(10)).toBe(10);
    const positions = screwdriverTrayPositions({ ...DEFAULT_OPTIONS, thickness: 10 });
    expectManifold(positions);
    const geometry = createScrewdriverTrayGeometry({ ...DEFAULT_OPTIONS, thickness: 10 });
    expect(verticalCrossings(geometry, 120, 30)).toEqual([]);
  });

  it("defaults to 240 x 60 x 18 when nothing is supplied", () => {
    expect(normalizeScrewdriverTrayWidth(undefined)).toBe(240);
    expect(normalizeScrewdriverTrayDepth(undefined)).toBe(60);
    expect(normalizeScrewdriverTrayThickness(undefined)).toBe(18);
    expect(normalizeScrewdriverTrayCornerRadius(undefined)).toBe(0);
  });

  it("rejects a non-positive width or depth", () => {
    expect(() => normalizeScrewdriverTrayWidth(0)).toThrow(/width must be positive/);
    expect(() => normalizeScrewdriverTrayDepth(-1)).toThrow(/depth must be positive/);
  });

  it("rejects a negative corner radius but accepts zero", () => {
    expect(() => normalizeScrewdriverTrayCornerRadius(-0.5)).toThrow(/zero or positive/);
    expect(normalizeScrewdriverTrayCornerRadius(0)).toBe(0);
  });

  it("rejects a hole with a non-finite or non-positive diameter", () => {
    expect(() => screwdriverTrayPositions({ ...DEFAULT_OPTIONS, holes: [{ diameter: 0, x: 100, z: 30 }] })).toThrow(/diameter\/x\/z must be finite/);
    expect(() => screwdriverTrayPositions({ ...DEFAULT_OPTIONS, holes: [{ diameter: 10, x: Number.NaN, z: 30 }] })).toThrow(/diameter\/x\/z must be finite/);
  });

  it("rejects a hole within 5mm of the tray edge", () => {
    expect(() => screwdriverTrayPositions({ ...DEFAULT_OPTIONS, holes: [{ diameter: 12, x: 8, z: 30 }] })).toThrow(/within 5mm of the tray edge/);
    expect(() => screwdriverTrayPositions({ ...DEFAULT_OPTIONS, holes: [{ diameter: 12, x: 120, z: 56 }] })).toThrow(/within 5mm of the tray edge/);
  });

  it("rejects two holes that overlap or leave too thin a wall", () => {
    expect(() => screwdriverTrayPositions({ ...DEFAULT_OPTIONS, holes: [{ diameter: 12, x: 100, z: 30 }, { diameter: 12, x: 105, z: 30 }] })).toThrow(
      /holes 0 and 1: footprints overlap/,
    );
  });

  it("rejects a corner radius at or above the tray thickness", () => {
    expect(() => screwdriverTrayPositions({ ...DEFAULT_OPTIONS, cornerRadius: 18 })).toThrow(/leaves no straight wall below it at tray thickness/);
  });

  it("rejects a corner radius too large for the tray footprint", () => {
    expect(() => screwdriverTrayPositions({ width: 240, depth: 20, thickness: 18, cornerRadius: 10, holes: [] })).toThrow(/too large for the tray's 20mm smallest footprint/);
  });

  it("rejects a corner radius that widens a hole to within 5mm of the tray edge", () => {
    expect(() => screwdriverTrayPositions({ ...DEFAULT_OPTIONS, cornerRadius: 12, holes: [{ diameter: 12, x: 15, z: 30 }] })).toThrow(/widens hole 0 .* to within 5mm of the tray edge/);
  });

  it("rejects a corner radius that widens two holes into each other", () => {
    expect(() => screwdriverTrayPositions({ ...TIGHT_OPTIONS, cornerRadius: 3 })).toThrow(/widens hole 0 .* too close to hole 1/);
  });
});

describe("screwdriverTrayPositions: there is no pocket-depth concept", () => {
  // The Socket Tray reads a per-pocket `depth`; this shape has none, and a
  // stray one supplied by a caller must be inert rather than silently
  // producing a blind pocket. Pinned on the geometry, not the type.
  it("ignores a stray depth field on a hole", () => {
    const withStrayDepth = screwdriverTrayPositions({
      ...DEFAULT_OPTIONS,
      holes: DEFAULT_HOLES.map((hole) => ({ ...hole, depth: 6 }) as ScrewdriverTrayHole),
    });
    expect(withStrayDepth).toEqual(screwdriverTrayPositions(DEFAULT_OPTIONS));
  });

  it("emits no floor cap: the hole footprint contains no triangle at any height", () => {
    const positions = screwdriverTrayPositions(DEFAULT_OPTIONS);
    // Sample a grid across the 12mm hole at x = 210 and assert every ray
    // misses every triangle -- a floor cap at any Y would register here.
    for (let dx = -4; dx <= 4; dx += 2) {
      for (let dz = -4; dz <= 4; dz += 2) {
        if (Math.hypot(dx, dz) > 4.5) continue;
        expect(verticalCrossingsFromPositions(positions, 210 + dx, 30 + dz), `dx=${dx} dz=${dz}`).toEqual([]);
      }
    }
  });
});
