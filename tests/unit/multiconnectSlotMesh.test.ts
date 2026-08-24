import { describe, expect, it } from "vitest";
import {
  MULTICONNECT_CHANNEL_OUTLINE,
  MULTICONNECT_DIMPLE_HEIGHT,
  MULTICONNECT_DIMPLE_RADIUS,
  MULTICONNECT_HEAD_RADIUS,
  MULTICONNECT_NECK_RADIUS,
  MULTICONNECT_SLOT_CUT_DEPTH,
  MULTICONNECT_TERMINATOR_CLIP_Y,
  MULTICONNECT_TERMINATOR_NO_DIMPLE_INDICES,
  MULTICONNECT_TERMINATOR_NO_DIMPLE_POSITIONS,
  MULTICONNECT_TERMINATOR_WITH_DIMPLE_INDICES,
  MULTICONNECT_TERMINATOR_WITH_DIMPLE_POSITIONS,
} from "@/lib/multiconnectSlotMesh";
import { analyzeTriangleSoup } from "@/lib/svgImport";

// Isolation checks for the baked Multiconnect slot terminator (phase 1 of
// the Multiconnect Container primitive -- see reference/multiconnect.scad
// and scripts/bake-multiconnect-slot.mjs). The container geometry itself
// doesn't exist yet; these tests pin down the properties phase 2's
// boundary-rep construction will rely on, most importantly that the clip
// plane's vertices are EXACTLY the MULTICONNECT_CHANNEL_OUTLINE values --
// they become shared stitch coordinates with the straight channel
// extrusion, where "close" is not good enough (see the shared-seam gotcha
// on record for three-bvh-csg/boundary-rep work: two constructions that
// agree only nominally leave real gaps).

const VARIANTS = [
  { label: "with dimple", positions: MULTICONNECT_TERMINATOR_WITH_DIMPLE_POSITIONS, indices: MULTICONNECT_TERMINATOR_WITH_DIMPLE_INDICES },
  { label: "no dimple (slotQuickRelease)", positions: MULTICONNECT_TERMINATOR_NO_DIMPLE_POSITIONS, indices: MULTICONNECT_TERMINATOR_NO_DIMPLE_INDICES },
] as const;

function toTriangleSoup(positions: readonly number[], indices: readonly number[]): number[] {
  const soup: number[] = [];
  for (const index of indices) {
    soup.push(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]);
  }
  return soup;
}

function bbox(positions: readonly number[]) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[i + axis]);
      max[axis] = Math.max(max[axis], positions[i + axis]);
    }
  }
  return { min, max };
}

describe("multiconnect slot terminator (baked)", () => {
  it.each(VARIANTS)("$label: watertight manifold (0 boundary edges, 0 non-manifold edges)", ({ positions, indices }) => {
    const soup = toTriangleSoup(positions, indices);
    expect(soup.every(Number.isFinite)).toBe(true);
    const analysis = analyzeTriangleSoup(soup);
    expect(analysis.boundaryEdges).toBe(0);
    expect(analysis.nonManifoldEdges).toBe(0);
  });

  it.each(VARIANTS)("$label: bounding box matches the SCAD dimensions", ({ positions }) => {
    const { min, max } = bbox(positions);
    // Across: the head pocket's full 10.15 radius (the revolve's 50-gon has
    // exact vertices at 0/180 degrees, so these are exact).
    expect(min[0]).toBe(-MULTICONNECT_HEAD_RADIUS);
    expect(max[0]).toBe(MULTICONNECT_HEAD_RADIUS);
    // Slide: from the clip plane up to the dome top. 90 degrees falls
    // between 50-gon vertices, so the top is the inscribed 10.15*cos(3.6deg)
    // = 10.13, not 10.15.
    expect(min[1]).toBe(MULTICONNECT_TERMINATOR_CLIP_Y);
    expect(max[1]).toBeGreaterThan(MULTICONNECT_HEAD_RADIUS * Math.cos((3.6 * Math.PI) / 180) - 1e-3);
    expect(max[1]).toBeLessThanOrEqual(MULTICONNECT_HEAD_RADIUS);
    // Depth: blind floor (0) to the mounting-face trim at 4.15 -- the blind
    // cut's full reach into the fixed 6.5mm back.
    expect(min[2]).toBe(0);
    expect(max[2]).toBe(MULTICONNECT_SLOT_CUT_DEPTH);
  });

  it.each(VARIANTS)("$label: clip-plane cross-section is exactly the channel outline (phase-2 stitch points)", ({ positions }) => {
    const found = new Set<string>();
    for (let i = 0; i + 2 < positions.length; i += 3) {
      if (positions[i + 1] === MULTICONNECT_TERMINATOR_CLIP_Y) found.add(`${positions[i]},${positions[i + 2]}`);
    }
    const expected = new Set(MULTICONNECT_CHANNEL_OUTLINE.map(([across, depth]) => `${across},${depth}`));
    // Exact string-key equality on the raw baked values -- no tolerance:
    // these coordinates must be reusable verbatim as shared stitch vertices.
    expect([...found].sort()).toEqual([...expected].sort());
  });

  it("channel outline is the depth-capped keyhole profile (head/neck radii, CCW)", () => {
    expect(MULTICONNECT_CHANNEL_OUTLINE).toEqual([
      [MULTICONNECT_HEAD_RADIUS, 0],
      [MULTICONNECT_HEAD_RADIUS, 1.2121],
      [MULTICONNECT_NECK_RADIUS, 3.712],
      [MULTICONNECT_NECK_RADIUS, MULTICONNECT_SLOT_CUT_DEPTH],
      [-MULTICONNECT_NECK_RADIUS, MULTICONNECT_SLOT_CUT_DEPTH],
      [-MULTICONNECT_NECK_RADIUS, 3.712],
      [-MULTICONNECT_HEAD_RADIUS, 1.2121],
      [-MULTICONNECT_HEAD_RADIUS, 0],
    ]);
    let doubledArea = 0;
    for (let i = 0; i < MULTICONNECT_CHANNEL_OUTLINE.length; i += 1) {
      const [x0, y0] = MULTICONNECT_CHANNEL_OUTLINE[i];
      const [x1, y1] = MULTICONNECT_CHANNEL_OUTLINE[(i + 1) % MULTICONNECT_CHANNEL_OUTLINE.length];
      doubledArea += x0 * y1 - x1 * y0;
    }
    expect(doubledArea).toBeGreaterThan(0); // CCW
  });

  it("with-dimple variant carries the lock-dimple crater; no-dimple variant does not", () => {
    // The crater's apex is a real baked vertex at the round-top center,
    // MULTICONNECT_DIMPLE_HEIGHT off the blind floor.
    const positions = MULTICONNECT_TERMINATOR_WITH_DIMPLE_POSITIONS;
    let hasApex = false;
    for (let i = 0; i + 2 < positions.length; i += 3) {
      if (positions[i] === 0 && positions[i + 1] === 0 && positions[i + 2] === MULTICONNECT_DIMPLE_HEIGHT) hasApex = true;
    }
    expect(hasApex).toBe(true);

    // Inside the neck (plan radius < dimple reach), the no-dimple variant
    // only has surface on the blind floor (depth 0) and the mouth trim
    // plane (depth 4.15) -- any vertex at an intermediate depth there could
    // only come from a crater.
    const noDimple = MULTICONNECT_TERMINATOR_NO_DIMPLE_POSITIONS;
    for (let i = 0; i + 2 < noDimple.length; i += 3) {
      const planRadius = Math.hypot(noDimple[i], noDimple[i + 1]);
      if (planRadius < MULTICONNECT_DIMPLE_RADIUS - 0.1) {
        expect([0, MULTICONNECT_SLOT_CUT_DEPTH]).toContain(noDimple[i + 2]);
      }
    }

    expect(MULTICONNECT_TERMINATOR_WITH_DIMPLE_INDICES.length).toBeGreaterThan(MULTICONNECT_TERMINATOR_NO_DIMPLE_INDICES.length);
  });
});
