import { describe, expect, it } from "vitest";
import {
  createMulticonnectPlateGeometry,
  multiconnectMaxCornerRadius,
  multiconnectPlateDimensions,
  multiconnectPlatePositions,
  multiconnectSlotCenters,
  normalizeMulticonnectSlotSpacing,
  normalizeMulticonnectSlotTolerance,
  MULTICONNECT_BACK_THICKNESS,
  MULTICONNECT_BLIND_FLOOR_Z,
  MULTICONNECT_SLOT_TOP_OFFSET,
} from "@/lib/multiconnectContainerGeometry";
import { MULTICONNECT_SLOT_CUT_DEPTH } from "@/lib/multiconnectSlotMesh";
import { analyzeTriangleSoup } from "@/lib/svgImport";

// The Multiconnect slot is a BLIND cut -- the opposite acceptance from the
// openConnect Container's perforation tests: there the raycast asserts the
// cavity opens through the wall; here it must assert the front
// (container-side) face stays solid everywhere while the channel is open
// from the mounting face down to the blind floor.

const COUPON = { width: 60, height: 60 };
const PEGS3 = [
  { diameter: 6, length: 20, x: 15, z: 35 },
  { diameter: 8, length: 20, x: 30, z: 35 },
  { diameter: 10, length: 20, x: 45, z: 35 },
];

function depthCrossings(positions: readonly number[], x: number, y: number): number[] {
  const crossings: number[] = [];
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const p0 = [positions[i], positions[i + 1], positions[i + 2]];
    const p1 = [positions[i + 3], positions[i + 4], positions[i + 5]];
    const p2 = [positions[i + 6], positions[i + 7], positions[i + 8]];
    const denom = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
    if (Math.abs(denom) < 1e-12) continue;
    const a = ((p1[1] - p2[1]) * (x - p2[0]) + (p2[0] - p1[0]) * (y - p2[1])) / denom;
    const b = ((p2[1] - p0[1]) * (x - p2[0]) + (p0[0] - p2[0]) * (y - p2[1])) / denom;
    const c = 1 - a - b;
    if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
    crossings.push(a * p0[2] + b * p1[2] + c * p2[2]);
  }
  crossings.sort((m, n) => m - n);
  // A ray passing exactly through an edge shared by two triangles reports
  // the crossing once per triangle; collapse those duplicates so parity
  // counting stays correct. All crossings in these tests are transversal
  // (no sample grazes a crease tangentially), and the plate has no feature
  // thinner than ~0.4mm, so a 1e-6 merge cannot swallow a real pair.
  return crossings.filter((value, index) => index === 0 || value - crossings[index - 1] > 1e-6);
}

function isSolidAt(crossings: number[], z: number): boolean {
  let count = 0;
  for (const crossing of crossings) if (crossing < z) count += 1;
  return count % 2 === 1;
}

const CONFIGS = [
  { label: "two-slot coupon 60x60", options: COUPON },
  { label: "single-slot 28x40", options: { width: 28, height: 40 } },
  { label: "quick release 60x60", options: { ...COUPON, slotQuickRelease: true } },
  { label: "tolerance 0.925", options: { ...COUPON, slotTolerance: 0.925 } },
  { label: "tolerance 1.075", options: { ...COUPON, slotTolerance: 1.075 } },
  { label: "rounded corners r=5", options: { ...COUPON, cornerRadius: 5 } },
  { label: "peg plate: 3 pegs, tilt 5, fillet 2, rounded", options: { ...COUPON, cornerRadius: 5, pegs: PEGS3 } },
  { label: "peg plate: no fillet, no tilt", options: { ...COUPON, pegFilletRadius: 0, pegTiltDeg: 0, pegs: [{ diameter: 10, length: 30, x: 30, z: 30 }] } },
  { label: "thick plate 10mm", options: { ...COUPON, plateThickness: 10 } },
  { label: "thick peg plate 10mm, rounded", options: { ...COUPON, plateThickness: 10, cornerRadius: 5, pegs: PEGS3 } },
] as const;

// Replicates plateZPlanes' exact expression path so plane-membership checks
// can use exact equality against the builder's own doubles.
const blindFloorZFor = (thickness: number) => MULTICONNECT_BLIND_FLOOR_Z + (thickness - MULTICONNECT_BACK_THICKNESS);
const mountingFaceZFor = (thickness: number) => blindFloorZFor(thickness) + MULTICONNECT_SLOT_CUT_DEPTH;

describe("createMulticonnectPlateGeometry", () => {
  it.each(CONFIGS)("$label: watertight manifold (0 boundary edges, 0 non-manifold edges)", ({ options }) => {
    const positions = multiconnectPlatePositions(options);
    expect(positions.every(Number.isFinite)).toBe(true);
    const analysis = analyzeTriangleSoup(positions);
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  }, 20000);

  // Stricter than the spatially-quantized check above: on the raw double
  // coordinates, every directed edge must appear exactly once, with its
  // reverse appearing exactly once. This only holds if every stitched seam
  // (baked terminator <-> channel prism <-> cap notch boundaries) reuses
  // bit-identical vertex coordinates AND all windings are consistent -- the
  // exactness contract phase 1's clip-plane bake guarantee exists for.
  it.each(CONFIGS)("$label: exact directed-edge manifold (bit-identical seams, consistent winding)", ({ options }) => {
    const positions = multiconnectPlatePositions(options);
    const directed = new Map<string, number>();
    for (let i = 0; i + 8 < positions.length; i += 9) {
      const keys = [0, 3, 6].map((offset) => `${positions[i + offset]},${positions[i + offset + 1]},${positions[i + offset + 2]}`);
      for (let edge = 0; edge < 3; edge += 1) {
        const key = `${keys[edge]}|${keys[(edge + 1) % 3]}`;
        directed.set(key, (directed.get(key) ?? 0) + 1);
      }
    }
    for (const [key, count] of directed) {
      expect(count).toBe(1);
      const [a, b] = key.split("|");
      expect(directed.get(`${b}|${a}`)).toBe(1);
    }
  }, 20000);

  it.each(CONFIGS)("$label: globally outward orientation (signed volume positive and consistent)", ({ options }) => {
    const positions = multiconnectPlatePositions(options);
    let signedVolume = 0;
    for (let i = 0; i + 8 < positions.length; i += 9) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.slice(i, i + 9);
      signedVolume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    }
    expect(signedVolume).toBeGreaterThan(0);
    // analyzeTriangleSoup reports absolute volume; matching the signed sum
    // confirms no inward-facing patch cancels against the rest.
    const analysis = analyzeTriangleSoup(positions);
    expect(Math.abs(signedVolume - analysis.volume)).toBeLessThan(analysis.volume * 1e-9);
  }, 20000);

  it("bounding box is width x height x back thickness", () => {
    const positions = multiconnectPlatePositions(COUPON);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i + 2 < positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], positions[i + axis]);
        max[axis] = Math.max(max[axis], positions[i + axis]);
      }
    }
    expect(min).toEqual([0, 0, 0]);
    expect(max[0]).toBe(COUPON.width);
    expect(max[1]).toBe(COUPON.height);
    expect(max[2]).toBeCloseTo(MULTICONNECT_BACK_THICKNESS, 9);
  });

  it("slot centers follow the SCAD centering formula", () => {
    const twoSlot = multiconnectSlotCenters(60, 28);
    expect(twoSlot).toHaveLength(2);
    expect(twoSlot[0]).toBeCloseTo(16, 9);
    expect(twoSlot[1]).toBeCloseTo(44, 9);
    expect(multiconnectSlotCenters(28, 28)).toEqual([14]);
    const multiboard = multiconnectSlotCenters(100, 25);
    expect(multiboard).toEqual([12.5, 37.5, 62.5, 87.5]);
  });

  it("normalization: SCAD floors and clamps", () => {
    // Width floors at max(25, spacing) so at least one slot always fits;
    // height floors at the SCAD's 25.
    expect(multiconnectPlateDimensions({ width: 10, height: 10 })).toMatchObject({ width: 28, height: 25 });
    expect(multiconnectPlateDimensions({ width: 10, height: 10, slotSpacing: 25 })).toMatchObject({ width: 25, height: 25 });
    expect(normalizeMulticonnectSlotSpacing(1)).toBe(24);
    expect(normalizeMulticonnectSlotTolerance(2)).toBe(1.075);
    expect(normalizeMulticonnectSlotTolerance(0.5)).toBe(0.925);
    expect(normalizeMulticonnectSlotTolerance(undefined)).toBe(1);
  });

  it("blind guarantee: solid material everywhere between the front face and the blind floor plane", () => {
    const positions = multiconnectPlatePositions(COUPON);
    // Full-footprint sweep (0.5mm inside the outer boundary to avoid
    // grazing hits on the plate's own side faces).
    for (let x = 1; x < COUPON.width; x += 2.9) {
      for (let y = 1; y < COUPON.height; y += 2.9) {
        const crossings = depthCrossings(positions, x, y);
        expect(isSolidAt(crossings, 1.2)).toBe(true);
        expect(isSolidAt(crossings, MULTICONNECT_BLIND_FLOOR_Z - 0.15)).toBe(true);
      }
    }
  }, 20000);

  it("channel is open from the mounting face through to the blind floor (and no deeper)", () => {
    const positions = multiconnectPlatePositions(COUPON);
    const topCenterY = COUPON.height - MULTICONNECT_SLOT_TOP_OFFSET;
    for (const cx of multiconnectSlotCenters(COUPON.width, 28)) {
      const samples: [number, number][] = [];
      // Neck strip along the slide (staying 1.15mm inside the 7.65mm neck
      // half-width, and below the clip plane).
      for (let dx = -6.5; dx <= 6.5; dx += 1.625) {
        for (let y = 2; y <= topCenterY - 2.5; y += 4.3) samples.push([cx + dx, y]);
      }
      // Round-top region (inside the 7.65 semicircle, outside the 1.5mm
      // dimple's plan radius).
      samples.push([cx + 4, topCenterY], [cx - 4, topCenterY], [cx, topCenterY + 4], [cx + 3, topCenterY + 3]);
      for (const [x, y] of samples) {
        const crossings = depthCrossings(positions, x, y);
        // Nothing between just past the blind floor and just short of the
        // mounting face: the slot void runs clear through that band.
        expect(crossings.filter((z) => z > MULTICONNECT_BLIND_FLOOR_Z + 1e-3 && z < MULTICONNECT_BACK_THICKNESS - 1e-3)).toEqual([]);
        // ...but the blind floor itself is present, and the front skin is
        // solid beneath it.
        expect(crossings.some((z) => Math.abs(z - MULTICONNECT_BLIND_FLOOR_Z) < 1e-6)).toBe(true);
        expect(isSolidAt(crossings, 1.2)).toBe(true);
        expect(isSolidAt(crossings, 4)).toBe(false);
      }
    }
  }, 20000);

  it("keyhole profile: head recess is wider than the neck (void behind the mounting face at head radius)", () => {
    const positions = multiconnectPlatePositions(COUPON);
    // At 9mm across from the slot center -- outside the 7.65 neck, inside
    // the 10.15 head -- the void spans the head recess only, with solid
    // material between it and the mounting face.
    const crossings = depthCrossings(positions, 16 + 9, 5);
    expect(isSolidAt(crossings, 1.2)).toBe(true); // front skin
    expect(isSolidAt(crossings, 3)).toBe(false); // head recess void
    expect(isSolidAt(crossings, 5.5)).toBe(true); // solid behind the recess
  });

  it("lock dimple: bump on the blind floor by default, absent with slotQuickRelease", () => {
    const withDimple = multiconnectPlatePositions(COUPON);
    const quickRelease = multiconnectPlatePositions({ ...COUPON, slotQuickRelease: true });
    const topCenterY = COUPON.height - MULTICONNECT_SLOT_TOP_OFFSET;
    // 0.707mm plan radius off the round-top center: the 45-degree bump
    // surface sits ~0.79mm above the blind floor there.
    const [x, y] = [16 + 0.5, topCenterY + 0.5];
    const bumped = depthCrossings(withDimple, x, y);
    expect(isSolidAt(bumped, MULTICONNECT_BLIND_FLOOR_Z + 0.7)).toBe(true);
    expect(isSolidAt(bumped, MULTICONNECT_BLIND_FLOOR_Z + 0.9)).toBe(false);
    const flat = depthCrossings(quickRelease, x, y);
    expect(isSolidAt(flat, MULTICONNECT_BLIND_FLOOR_Z + 0.1)).toBe(false);
    expect(isSolidAt(flat, MULTICONNECT_BLIND_FLOOR_Z - 0.1)).toBe(true);
  });

  it("between and beside slots the plate is solid through its full thickness", () => {
    const positions = multiconnectPlatePositions(COUPON);
    for (const [x, y] of [[30, 5], [30, 30], [30, 47], [2, 30], [58, 30]] as const) {
      const crossings = depthCrossings(positions, x, y);
      for (const z of [0.5, 3.25, 6.2]) expect(isSolidAt(crossings, z)).toBe(true);
    }
  });

  it("cornerRadius 0 reproduces the phase-2 output exactly (regression guard for the printed coupon)", () => {
    const sharp = multiconnectPlatePositions(COUPON);
    expect(multiconnectPlatePositions({ ...COUPON, cornerRadius: 0 })).toEqual(sharp);
    // Snap-under-threshold radii are sharp too; a real radius changes the mesh.
    expect(multiconnectPlatePositions({ ...COUPON, cornerRadius: 0.05 })).toEqual(sharp);
    expect(multiconnectPlatePositions({ ...COUPON, cornerRadius: 5 })).not.toEqual(sharp);
    // Anchor against the exact triangle count the printed coupon shipped with.
    expect(sharp.length).toBe(696 * 9);
  });

  it("rounded plate keeps the blind guarantee across the rounded footprint", () => {
    const radius = 5;
    const positions = multiconnectPlatePositions({ ...COUPON, cornerRadius: radius });
    const insideRounded = (x: number, y: number, margin: number) => {
      const cornerCenters: [number, number][] = [[radius, radius], [COUPON.width - radius, radius], [COUPON.width - radius, COUPON.height - radius], [radius, COUPON.height - radius]];
      for (const [ccx, ccy] of cornerCenters) {
        const inCornerSquare = (x < radius || x > COUPON.width - radius) && (y < radius || y > COUPON.height - radius) && Math.abs(x - ccx) <= radius && Math.abs(y - ccy) <= radius;
        if (inCornerSquare && Math.hypot(x - ccx, y - ccy) > radius - margin) return false;
      }
      return true;
    };
    let samples = 0;
    for (let x = 1.3; x < COUPON.width; x += 2.9) {
      for (let y = 1.7; y < COUPON.height; y += 2.9) {
        if (!insideRounded(x, y, 0.6)) continue;
        const crossings = depthCrossings(positions, x, y);
        expect(isSolidAt(crossings, 1.2)).toBe(true);
        expect(isSolidAt(crossings, MULTICONNECT_BLIND_FLOOR_Z - 0.15)).toBe(true);
        samples += 1;
      }
    }
    expect(samples).toBeGreaterThan(350);
  }, 20000);

  it("oversized cornerRadius clamps to the exposed safe max and channels stay open", () => {
    const dims = multiconnectPlateDimensions({ ...COUPON, cornerRadius: 50 });
    // Coupon safe max: outer slot center to side edge (16) minus the head
    // half-width (10.15) minus the 0.5 clearance.
    expect(dims.maxCornerRadius).toBeCloseTo(5.35, 9);
    expect(dims.cornerRadius).toBeCloseTo(5.35, 9);
    expect(multiconnectMaxCornerRadius(COUPON)).toBeCloseTo(5.35, 9);

    const positions = multiconnectPlatePositions({ ...COUPON, cornerRadius: 50 });
    const analysis = analyzeTriangleSoup(positions);
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
    const topCenterY = COUPON.height - MULTICONNECT_SLOT_TOP_OFFSET;
    for (const cx of multiconnectSlotCenters(COUPON.width, 28)) {
      for (const [x, y] of [[cx, 3], [cx - 6.5, 20], [cx + 6.5, 20], [cx, topCenterY - 3]] as const) {
        const crossings = depthCrossings(positions, x, y);
        expect(crossings.filter((z) => z > MULTICONNECT_BLIND_FLOOR_Z + 1e-3 && z < MULTICONNECT_BACK_THICKNESS - 1e-3)).toEqual([]);
        expect(isSolidAt(crossings, 1.2)).toBe(true);
      }
    }
  }, 20000);

  it("plateThickness: default and clamped values are byte-identical to the 6.5 plate", () => {
    const base = multiconnectPlatePositions(COUPON);
    expect(multiconnectPlatePositions({ ...COUPON, plateThickness: 6.5 })).toEqual(base);
    // Below the 6.5 minimum clamps up to the default construction.
    expect(multiconnectPlatePositions({ ...COUPON, plateThickness: 4 })).toEqual(base);
    expect(multiconnectPlateDimensions({ ...COUPON, plateThickness: 3 }).depth).toBe(multiconnectPlateDimensions(COUPON).depth);
    // A genuinely thicker plate changes the mesh and the reported depth.
    expect(multiconnectPlatePositions({ ...COUPON, plateThickness: 10 })).not.toEqual(base);
    expect(multiconnectPlateDimensions({ ...COUPON, plateThickness: 10 }).depth).toBe(mountingFaceZFor(10));
  });

  it("plateThickness 10: deeper solid band, channel open exactly the cut depth from the mounting face", () => {
    const positions = multiconnectPlatePositions({ ...COUPON, plateThickness: 10 });
    const blindFloor = blindFloorZFor(10); // 5.85: the extra 3.5mm all lands in the front skin
    const mountingFace = mountingFaceZFor(10);
    const topCenterY = COUPON.height - MULTICONNECT_SLOT_TOP_OFFSET;
    // Blind guarantee across the full footprint, now through the deeper band.
    for (let x = 1; x < COUPON.width; x += 2.9) {
      for (let y = 1; y < COUPON.height; y += 2.9) {
        const crossings = depthCrossings(positions, x, y);
        expect(isSolidAt(crossings, 1.2)).toBe(true);
        expect(isSolidAt(crossings, blindFloor - 0.15)).toBe(true);
      }
    }
    // In-channel: the void spans exactly (blind floor, mounting face) --
    // 4.15mm of cut measured from the mounting face, and no deeper.
    for (const cx of multiconnectSlotCenters(COUPON.width, 28)) {
      for (const [x, y] of [[cx, 3], [cx - 6.5, 20], [cx + 6.5, 20], [cx, topCenterY + 4]] as const) {
        const crossings = depthCrossings(positions, x, y);
        expect(crossings.filter((z) => z > blindFloor + 1e-3 && z < mountingFace - 1e-3)).toEqual([]);
        expect(crossings.some((z) => Math.abs(z - blindFloor) < 1e-6)).toBe(true);
        expect(isSolidAt(crossings, blindFloor - 0.15)).toBe(true);
        expect(isSolidAt(crossings, blindFloor + 1)).toBe(false);
      }
    }
  }, 20000);

  it("slot cross-section at the mounting face is identical between thickness 6.5 and 10", () => {
    // Distinct points only: adjacent faces (e.g. the taller bottom face)
    // earcut differently at different aspect ratios, so per-vertex
    // multiplicities on the plane legitimately vary -- the cross-section
    // GEOMETRY (which exact x,y doubles lie on the mounting face) must not.
    const xyOnPlane = (positions: number[], planeZ: number) => {
      const xy = new Set<string>();
      for (let i = 0; i + 2 < positions.length; i += 3) {
        if (positions[i + 2] === planeZ) xy.add(`${positions[i]},${positions[i + 1]}`);
      }
      return [...xy].sort();
    };
    const thin = xyOnPlane(multiconnectPlatePositions(COUPON), mountingFaceZFor(6.5));
    const thick = xyOnPlane(multiconnectPlatePositions({ ...COUPON, plateThickness: 10 }), mountingFaceZFor(10));
    // 64 distinct points: two slots' mouth-rim polylines + strip corners +
    // the plate outline corners.
    expect(thin.length).toBeGreaterThan(50);
    expect(thick).toEqual(thin);
  });

  it("plateThickness 10 bounding box reaches exactly the thicker mounting face", () => {
    const positions = multiconnectPlatePositions({ ...COUPON, plateThickness: 10 });
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i + 2 < positions.length; i += 3) {
      minZ = Math.min(minZ, positions[i + 2]);
      maxZ = Math.max(maxZ, positions[i + 2]);
    }
    expect(minZ).toBe(0); // front face stays at Z=0; pegs would extend below
    expect(maxZ).toBe(mountingFaceZFor(10));
  });

  it("pegs=[] produces byte-identical Plate output (regression guard)", () => {
    expect(multiconnectPlatePositions({ ...COUPON, pegs: [] })).toEqual(multiconnectPlatePositions(COUPON));
    expect(multiconnectPlatePositions({ ...COUPON, cornerRadius: 5, pegs: [] })).toEqual(multiconnectPlatePositions({ ...COUPON, cornerRadius: 5 }));
  });

  it("peg plate keeps the blind guarantee (sampler skips the sheared peg-body projections)", () => {
    const positions = multiconnectPlatePositions({ ...COUPON, cornerRadius: 5, pegs: PEGS3 });
    const rise = 20 * Math.sin((5 * Math.PI) / 180) + 0.8;
    // Peg x is mounted-view space; the geometry places each peg mirrored.
    const nearPeg = (x: number, y: number) =>
      PEGS3.some((peg) => {
        const footprint = peg.diameter / 2 + 2;
        const gx = COUPON.width - peg.x;
        return Math.abs(x - gx) <= footprint + 0.8 && y - peg.z >= -(footprint + 0.8) && y - peg.z <= footprint + rise + 0.8;
      });
    const radius = 5;
    const insideRounded = (x: number, y: number) => {
      const centers: [number, number][] = [[radius, radius], [COUPON.width - radius, radius], [COUPON.width - radius, COUPON.height - radius], [radius, COUPON.height - radius]];
      return centers.every(([ccx, ccy]) => {
        const inCornerSquare = (x < radius || x > COUPON.width - radius) && (y < radius || y > COUPON.height - radius) && Math.abs(x - ccx) <= radius && Math.abs(y - ccy) <= radius;
        return !inCornerSquare || Math.hypot(x - ccx, y - ccy) <= radius - 0.6;
      });
    };
    let samples = 0;
    for (let x = 1.3; x < COUPON.width; x += 2.9) {
      for (let y = 1.7; y < COUPON.height; y += 2.9) {
        if (!insideRounded(x, y) || nearPeg(x, y)) continue;
        const crossings = depthCrossings(positions, x, y);
        expect(isSolidAt(crossings, 1.2)).toBe(true);
        expect(isSolidAt(crossings, MULTICONNECT_BLIND_FLOOR_Z - 0.15)).toBe(true);
        samples += 1;
      }
    }
    expect(samples).toBeGreaterThan(200);
  }, 20000);

  it("peg body, fillet, and tip are where the parameters say (raycasts through the 10mm peg)", () => {
    const positions = multiconnectPlatePositions({ ...COUPON, cornerRadius: 5, pegs: PEGS3 });
    const peg = PEGS3[2]; // d=10 at viewed (45, 35) -> geometry x = 15
    const gx = COUPON.width - peg.x;
    const tiltRad = (5 * Math.PI) / 180;
    const tipDepth = peg.length * Math.cos(tiltRad); // 19.92

    // Through the peg center: solid from inside the peg through the plate.
    const center = depthCrossings(positions, gx, peg.z);
    expect(isSolidAt(center, -10)).toBe(true); // inside the peg body
    expect(isSolidAt(center, -tipDepth - 0.5)).toBe(false); // beyond the tip
    expect(isSolidAt(center, 1.2)).toBe(true); // front skin behind the root

    // Just outside the footprint: air in front of the face.
    const beside = depthCrossings(positions, gx + peg.diameter / 2 + 2 + 1.5, peg.z);
    expect(isSolidAt(beside, -0.5)).toBe(false);
    expect(isSolidAt(beside, 1.2)).toBe(true);

    // Fillet collar: at 1mm outside the peg wall the quarter-round surface
    // sits ~0.27mm in front of the face (45deg arc chord tolerance ~0.02).
    const collar = depthCrossings(positions, gx + peg.diameter / 2 + 1, peg.z + 0.3);
    expect(isSolidAt(collar, -0.15)).toBe(true);
    expect(isSolidAt(collar, -0.45)).toBe(false);

    // Tilt: the tip ring's top edge rises by ~length*sin(tilt) above the
    // root circle's top edge; probe a point that is peg material only
    // because of the upward shear.
    const risen = depthCrossings(positions, gx, peg.z + peg.diameter / 2 + 0.8);
    expect(isSolidAt(risen, -tipDepth + 1)).toBe(true); // sheared body covers it near the tip
    expect(isSolidAt(risen, -0.5)).toBe(false); // but not at the root
  });

  // The mounted-view convention (see MulticonnectPeg): peg x counts from
  // the plate's left edge AS THE MOUNTED VIEWER SEES IT, so the geometry
  // places every peg at plateWidth - x. Regression for the physical-test
  // finding that the v1 sampler read right-to-left on the wall.
  it("peg viewed-x=10 on a 240mm plate lands at geometry x=230", () => {
    const positions = multiconnectPlatePositions({ width: 240, height: 60, pegs: [{ diameter: 6, length: 20, x: 10, z: 30 }] });
    // Exact: the tip-fan center vertex carries the geometry-space center x.
    let hasTipCenterAt230 = false;
    for (let i = 0; i + 2 < positions.length; i += 3) {
      if (positions[i] === 230 && positions[i + 2] < -19) hasTipCenterAt230 = true;
    }
    expect(hasTipCenterAt230).toBe(true);
    // Peg material in front of the face at geometry 230, none at geometry 10.
    expect(isSolidAt(depthCrossings(positions, 230, 30), -5)).toBe(true);
    expect(isSolidAt(depthCrossings(positions, 10, 30), -0.5)).toBe(false);
  }, 20000);

  it("asymmetric two-peg layout lands mirrored (each diameter at width - viewedX)", () => {
    // d=6 at viewed 15 -> geometry 45; d=10 at viewed 40 -> geometry 20.
    // Pre-fix, the same spec produced the x-mirror of this placement.
    const positions = multiconnectPlatePositions({
      ...COUPON,
      pegs: [
        { diameter: 6, length: 20, x: 15, z: 30 },
        { diameter: 10, length: 20, x: 40, z: 30 },
      ],
    });
    // Both pegs solid through their geometry-space centers.
    expect(isSolidAt(depthCrossings(positions, 45, 30), -5)).toBe(true);
    expect(isSolidAt(depthCrossings(positions, 20, 30), -5)).toBe(true);
    // Diameter disambiguates the mirror: 4.2mm off-center at 1mm depth is
    // inside the d=10 body (r=5) but outside the d=6 wall (r=3, fillet
    // surface only ~0.4mm proud there). The pre-fix layout would invert
    // these two expectations.
    expect(isSolidAt(depthCrossings(positions, 20 + 4.2, 30), -1)).toBe(true);
    expect(isSolidAt(depthCrossings(positions, 45 + 4.2, 30), -1)).toBe(false);
  });

  it("rejects invalid peg layouts", () => {
    const base = { ...COUPON, cornerRadius: 5 };
    // Footprints overlap: d=10 fillet 2 -> footprint 7; centers 9mm apart.
    expect(() => multiconnectPlatePositions({ ...base, pegs: [{ diameter: 10, length: 20, x: 26, z: 30 }, { diameter: 10, length: 20, x: 35, z: 30 }] })).toThrow(/overlap/);
    // Straight-edge clearance: footprint 7 + 2mm keep-out needs 9mm.
    expect(() => multiconnectPlatePositions({ ...base, pegs: [{ diameter: 10, length: 20, x: 8.9, z: 30 }] })).toThrow(/edge/);
    // Rounded-corner clearance: passes on a sharp plate, fails inside the
    // corner arc of a heavily rounded one. slotSpacing 50 centers the single
    // slot so the corner radius clamp allows the full 12mm (the coupon's
    // 28mm layout would clamp it to 5.35 before the peg check could see it).
    const cornerPeg = [{ diameter: 4, length: 20, x: 6.5, z: 6.5 }];
    expect(() => multiconnectPlatePositions({ ...COUPON, slotSpacing: 50, pegs: cornerPeg })).not.toThrow();
    expect(() => multiconnectPlatePositions({ ...COUPON, slotSpacing: 50, cornerRadius: 12, pegs: cornerPeg })).toThrow(/edge/);
    // Too short to clear its own fillet.
    expect(() => multiconnectPlatePositions({ ...base, pegs: [{ diameter: 10, length: 2, x: 30, z: 30 }] })).toThrow(/short|fillet/);
    // Nonsense values.
    expect(() => multiconnectPlatePositions({ ...base, pegs: [{ diameter: -5, length: 20, x: 30, z: 30 }] })).toThrow(/finite|positive/);
  });

  it("peg plate bounding box extends to the tilted tip", () => {
    const positions = multiconnectPlatePositions({ ...COUPON, cornerRadius: 5, pegs: PEGS3 });
    let minZ = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i + 2 < positions.length; i += 3) {
      minZ = Math.min(minZ, positions[i + 2]);
      maxY = Math.max(maxY, positions[i + 1]);
    }
    expect(minZ).toBeCloseTo(-20 * Math.cos((5 * Math.PI) / 180), 6);
    expect(maxY).toBe(COUPON.height); // pegs never outgrow the plate outline in Y
  });

  it("createMulticonnectPlateGeometry returns a renderable BufferGeometry", () => {
    const geometry = createMulticonnectPlateGeometry(COUPON);
    expect(geometry.getAttribute("position").count).toBeGreaterThan(0);
    expect(geometry.getAttribute("normal")).toBeDefined();
  });
});
