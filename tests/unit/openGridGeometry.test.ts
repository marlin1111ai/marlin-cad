import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createOpenGridBoardGeometry } from "@/lib/openGridGeometry";

function bbox(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  return {
    size: [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z],
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
  };
}

function hasNaN(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute("position");
  for (let i = 0; i < pos.count * 3; i += 1) {
    if (!Number.isFinite(pos.array[i])) return true;
  }
  return false;
}

// Vertical ray-cast through the non-indexed mesh at world (x, z): for every
// triangle, solve its plane for Y at (x, z) via barycentric coordinates and
// record a crossing if (x, z) falls inside the triangle. Same method used to
// verify the reference openGrid mesh during recon (rendered via openscad-wasm
// + BOSL2, exported to STL, ray-cast the same way).
function verticalCrossings(geometry: THREE.BufferGeometry, x: number, z: number): number[] {
  const position = geometry.getAttribute("position");
  const crossings: number[] = [];
  for (let i = 0; i < position.count; i += 3) {
    const p0: [number, number, number] = [position.getX(i), position.getY(i), position.getZ(i)];
    const p1: [number, number, number] = [position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1)];
    const p2: [number, number, number] = [position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2)];
    const denom = (p1[2] - p2[2]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[2] - p2[2]);
    if (Math.abs(denom) < 1e-9) continue;
    const a = ((p1[2] - p2[2]) * (x - p2[0]) + (p2[0] - p1[0]) * (z - p2[2])) / denom;
    const b = ((p2[2] - p0[2]) * (x - p2[0]) + (p0[0] - p2[0]) * (z - p2[2])) / denom;
    const c = 1 - a - b;
    if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
    crossings.push(a * p0[1] + b * p1[1] + c * p2[1]);
  }
  return crossings.sort((m, n) => m - n);
}

// Exact vector slice at height targetY: intersect every triangle EDGE with
// the horizontal plane via linear interpolation of its two endpoints (no
// rasterization/sampling at all) and return the resulting (x, z) segments.
// A single logical cut edge in the source geometry can come back as 2+
// collinear segments here if earcut split it across multiple triangles --
// callers that want one cut's true span should merge by extent, not count
// segments.
function sliceSegments(geometry: THREE.BufferGeometry, targetY: number): Array<[[number, number], [number, number]]> {
  const position = geometry.getAttribute("position");
  const segments: Array<[[number, number], [number, number]]> = [];
  for (let i = 0; i + 2 < position.count; i += 3) {
    const tri: [number, number, number][] = [0, 1, 2].map((k) => [position.getX(i + k), position.getY(i + k), position.getZ(i + k)]);
    const pts: [number, number][] = [];
    for (let e = 0; e < 3; e += 1) {
      const a = tri[e];
      const b = tri[(e + 1) % 3];
      if ((a[1] < targetY && b[1] >= targetY) || (b[1] < targetY && a[1] >= targetY)) {
        const t = (targetY - a[1]) / (b[1] - a[1]);
        pts.push([a[0] + t * (b[0] - a[0]), a[2] + t * (b[2] - a[2])]);
      }
    }
    if (pts.length === 2) segments.push([pts[0], pts[1]]);
  }
  return segments;
}

function isSolidAt(crossings: number[], y: number): boolean {
  let count = 0;
  for (const crossing of crossings) if (crossing < y) count += 1;
  return count % 2 === 1;
}

describe("createOpenGridBoardGeometry", () => {
  it("4x4 full board, corners chamfer -> exact real-world dimensions", () => {
    const geometry = createOpenGridBoardGeometry({ gridWidth: 4, gridHeight: 4, boardType: "full", chamferMode: "corners" });
    const box = bbox(geometry);
    expect(box.size[0]).toBeCloseTo(112, 5);
    expect(box.size[2]).toBeCloseTo(112, 5);
    expect(box.size[1]).toBeCloseTo(6.8, 5);
    expect(box.min[1]).toBeCloseTo(0, 5);
    expect(hasNaN(geometry)).toBe(false);
    expect(geometry.getAttribute("position").count).toBeGreaterThan(0);
  }, 15000);

  it("lite/heavy board types produce correct thickness", () => {
    const lite = bbox(createOpenGridBoardGeometry({ gridWidth: 2, gridHeight: 2, boardType: "lite", chamferMode: "none" }));
    const heavy = bbox(createOpenGridBoardGeometry({ gridWidth: 2, gridHeight: 2, boardType: "heavy", chamferMode: "none" }));
    expect(lite.size[1]).toBeCloseTo(4, 5);
    expect(heavy.size[1]).toBeCloseTo(13.8, 5);
  });

  it("chamferMode none keeps sharp rectangular footprint", () => {
    const geometry = createOpenGridBoardGeometry({ gridWidth: 3, gridHeight: 5, boardType: "full", chamferMode: "none" });
    const box = bbox(geometry);
    expect(box.size[0]).toBeCloseTo(84, 5);
    expect(box.size[2]).toBeCloseTo(140, 5);
    expect(hasNaN(geometry)).toBe(false);
  });

  it("chamferMode corners/everywhere clip the outer 4 corners identically; none leaves them sharp", () => {
    const none = createOpenGridBoardGeometry({ gridWidth: 4, gridHeight: 4, boardType: "full", chamferMode: "none" });
    const corners = createOpenGridBoardGeometry({ gridWidth: 4, gridHeight: 4, boardType: "full", chamferMode: "corners" });
    const everywhere = createOpenGridBoardGeometry({ gridWidth: 4, gridHeight: 4, boardType: "full", chamferMode: "everywhere" });
    expect(hasNaN(everywhere)).toBe(false);
    // The per-tile groove now punches interior holes unconditionally, so
    // chamferMode only controls the outer 4-corner clip -- "corners" and
    // "everywhere" are equivalent (the old "everywhere"-only interior
    // notching is superseded by the groove holes), "none" leaves the outer
    // corners sharp.
    expect(corners.getAttribute("position").count).toBe(everywhere.getAttribute("position").count);
    expect(everywhere.getAttribute("position").count).toBeGreaterThan(none.getAttribute("position").count);
    const box = bbox(everywhere);
    expect(box.size[0]).toBeCloseTo(112, 5);
    expect(box.size[2]).toBeCloseTo(112, 5);
    expect(box.size[1]).toBeCloseTo(6.8, 5);
  }, 15000);

  it("1mm in from a tile edge: solid in the capture lips, hollow in the waist (ray-cast, matches recon)", () => {
    const geometry = createOpenGridBoardGeometry({ gridWidth: 4, gridHeight: 4, boardType: "full", chamferMode: "corners" });
    // 1mm in from the board's outer right edge (x = 56), at a z within one
    // tile's edge span -- away from any seam line or interior 4-way vertex,
    // matching the recon's single-tile-edge probe.
    const x = 56 - 1;
    const z = 10;
    const crossings = verticalCrossings(geometry, x, z);
    // Lower capture lip plateau [0.4, 1.4] and the taper up to it.
    expect(isSolidAt(crossings, 1.0)).toBe(true);
    expect(isSolidAt(crossings, 1.9)).toBe(true);
    // Waist plateau [2.4, 4.4] -- hollow, matching the recon's 2.114..4.686 window.
    expect(isSolidAt(crossings, 2.6)).toBe(false);
    expect(isSolidAt(crossings, 3.4)).toBe(false);
    expect(isSolidAt(crossings, 4.2)).toBe(false);
    // Taper back up to and through the upper capture lip plateau [5.4, 6.4].
    expect(isSolidAt(crossings, 4.9)).toBe(true);
    expect(isSolidAt(crossings, 6.0)).toBe(true);
  }, 15000);

  it("2x2 board: internal seam between tiles is solid full-height (tiles fuse, no gap)", () => {
    const geometry = createOpenGridBoardGeometry({ gridWidth: 2, gridHeight: 2, boardType: "full", chamferMode: "corners" });
    // x=0 is the shared seam between the two tile columns; z=10 keeps clear
    // of the board's one interior 4-way vertex at (0, 0). Each of the ~40
    // stacked bands contributes its own (coincident, touching) cap faces at
    // the band boundaries, so raw crossing count isn't 2 here even though
    // the solid is genuinely continuous -- check solidity by parity at
    // sample heights instead, including right at the two band-stack seams.
    const seam = verticalCrossings(geometry, 0, 10);
    for (const y of [0.01, 0.4, 1.4, 2.4, 3.4, 4.4, 5.4, 6.4, 6.79]) {
      expect(isSolidAt(seam, y)).toBe(true);
    }
    // Sanity check: deep tile interior (far from every edge) is a through-hole.
    const interior = verticalCrossings(geometry, 14, 10);
    expect(interior.length).toBe(0);
  }, 15000);

  it("interior 4-way vertex does not balloon solid material across the tile (star/diamond regression)", () => {
    // Regression for a bug where an interior-vertex "closure" override forced
    // every tile corner touching a 4-way intersection out to a 6.5mm inset
    // (vs. the profile's own <=1.5mm) -- on a 28mm tile that ballooned into a
    // 4-pointed star spanning most of the board. Verified against a real
    // reference STL (10x10_Grid.stl): the true design does not close the
    // channel near interior vertices at all.
    const geometry = createOpenGridBoardGeometry({ gridWidth: 2, gridHeight: 2, boardType: "full", chamferMode: "corners" });
    // The board's one interior vertex sits at (0, 0). At the waist, each of
    // the 4 tiles meeting there independently reaches solid material out to
    // leg-sum ~7.88mm from its own corner (cornerWedgeChamferAt's flat
    // middle plateau -- see openGridGeometry.ts), so a point at leg-sum
    // 8.49mm (8mm out along the pure diagonal) must still be hollow: the old
    // bug's 6.5mm *edge* inset (not a small diagonal corner nibble) spanned
    // close to a quarter of the 28mm tile in every direction, not a few mm
    // at a corner.
    const nearVertex = verticalCrossings(geometry, 8 / Math.SQRT2, 8 / Math.SQRT2);
    expect(isSolidAt(nearVertex, 3.4)).toBe(false);
    // Right at the vertex, each of the 4 meeting tiles independently reaches
    // solid out to leg-sum ~7.88mm from its own corner (see the test above),
    // not the old bug's much larger, position-dependent reach -- sample a
    // ring of points 12mm out (comfortably clear of that ~7.88mm reach at
    // every angle) in every quadrant and require all hollow. Angles offset
    // from 0/90/180/270 so no sample lands exactly on either seam line
    // (which is legitimately solid full-height on its own).
    for (const angleDeg of [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]) {
      const angle = (angleDeg * Math.PI) / 180;
      const crossings = verticalCrossings(geometry, 12 * Math.cos(angle), 12 * Math.sin(angle));
      expect(isSolidAt(crossings, 3.4)).toBe(false);
    }
  }, 15000);

  it("tile hole corner chamfer varies per band, matching the reference at all 3 measured heights (exact vector slice, no rasterization)", () => {
    // The reference's tile-hole corner is NOT a constant chamfer -- it's
    // built from its own full_tile_corners_profile (a distinct wedge
    // extruded along the tile corner's 45deg diagonal, unioned identically
    // onto all 4 corners of every tile -- see cornerWedgeChamferAt in
    // openGridGeometry.ts for the full derivation from the SCAD source's own
    // constants and 3D placement transform). Earlier calibration rounds all
    // measured a much smaller chamfer (order 4-6mm) directly off rendered
    // STLs, which kept disagreeing with each other; every one of those
    // renders turned out to be confounded by something else in the SCAD's
    // default parameters that also touches the corners (Screw_Mounting or
    // Chamfers="Corners" cutting into a board-extreme corner tile, or a
    // neighboring tile/vertex partially overlapping the measured one). These
    // values are the tile's true, unconfounded reach (Chamfers=None,
    // Screw_Mounting=None, Connector_Holes=false), verified both on- and
    // off-diagonal against a clean single-tile reference render, at the
    // midpoint of each of the 3 z-plateaus: lower lip (z=0.9) 7.17mm, waist
    // (z=3.4) 7.88mm, upper lip (z=5.9) 7.17mm -- symmetric top-to-bottom,
    // matching the profile's own symmetric shape.
    const geometry = createOpenGridBoardGeometry({ gridWidth: 1, gridHeight: 1, boardType: "full", chamferMode: "none" });
    const cases: Array<{ z: number; expectedLegSum: number }> = [
      { z: 0.9, expectedLegSum: 7.17 },
      { z: 3.4, expectedLegSum: 7.88 },
      { z: 5.9, expectedLegSum: 7.17 },
    ];
    for (const { z, expectedLegSum } of cases) {
      const segments = sliceSegments(geometry, z);
      // Single tile, corner at (14, 14): the diagonal cut's segments (earcut
      // may split one logical cut edge into 2+ collinear pieces) all have
      // both endpoints near that corner and run at ~45deg. Broad "near
      // corner" net (midpoint x and z both > 6) plus a 45deg-slope filter
      // isolates them from every other edge in the slice.
      const diagonal = segments.filter(([a, b]) => {
        const midX = (a[0] + b[0]) / 2;
        const midZ = (a[1] + b[1]) / 2;
        if (midX <= 6 || midZ <= 6) return false;
        const dx = Math.abs(a[0] - b[0]);
        const dz = Math.abs(a[1] - b[1]);
        return dx > 0.3 && Math.abs(dx - dz) < 0.05;
      });
      // The cut's endpoints sit on the tile's inset square, not its true
      // outer corner (14, 14) -- clipRectangleCorners clips relative to the
      // already wall-inset square's own corner. Measuring leg-sum
      // ((14 - x) + (14 - z)) from the tile's TRUE corner instead of the
      // segment's own x-extent recovers the quantity cornerWedgeChamferAt
      // actually models (and what was independently verified against the
      // clean single-tile reference render), regardless of that offset.
      const legSums = diagonal.flatMap(([a, b]) => [14 - a[0] + (14 - a[1]), 14 - b[0] + (14 - b[1])]);
      expect(legSums.length).toBeGreaterThan(0);
      const avgLegSum = legSums.reduce((sum, v) => sum + v, 0) / legSums.length;
      // A wider tolerance than a bare unit-conversion rounding error: z=0.9
      // and z=5.9 fall inside a 5-step linear taper (CHAMFER_ONLY_TAPER_
      // STEPS) approximating the true continuous formula as a staircase, so
      // some residual band-discretization error vs. the exact target is
      // expected and legitimate here, not a bug.
      expect(avgLegSum).toBeCloseTo(expectedLegSum, 1);
    }
  }, 15000);

  it("corner treatment applies identically everywhere -- no interior-vertex/relief-hole special-casing", () => {
    // Source-verified (openGrid.scad's openGridTileAp1): the tile-hole
    // corner is NOT a special interior-vertex closure feature. It's the
    // same wedge, unioned identically onto all 4 corners of EVERY tile via
    // zrot_copies(n=4), with no branching on how many tiles share that
    // corner. An earlier pass modeled a hand-measured small round "relief
    // hole" that only appeared at interior 4-way vertices -- that was a
    // genuine special case (isInteriorVertex + a separate hole outline) and
    // has been deleted; whatever pattern shows up at a vertex now has to
    // fall out of each tile's own, uniformly-applied corner treatment.
    const board = createOpenGridBoardGeometry({ gridWidth: 2, gridHeight: 2, boardType: "full", chamferMode: "none" });

    // Right at the interior vertex (0, 0), each of the 4 meeting tiles'
    // corner wedges reaches leg-sum 0 from its own corner -- solid, not a
    // hollow relief hole. (Sampled 0.05mm off the exact vertex point, which
    // sits on 4 tiles' shared mesh vertex and rasterizes as a degenerate
    // ray-cast otherwise.)
    const nearVertex = verticalCrossings(board, 0.05, 0.05);
    for (const y of [0.9, 3.4, 5.9]) expect(isSolidAt(nearVertex, y)).toBe(true);

    // A free (board-edge) tile corner -- e.g. tile(0,0)'s own corner at this
    // 2x2 board's world (-28, -28), touched by only 1 tile -- must behave
    // IDENTICALLY to the interior vertex above: same formula, no branching
    // on how many neighbors the corner has.
    const freeCorner = verticalCrossings(board, -27.95, -27.95);
    for (const y of [0.9, 3.4]) expect(isSolidAt(freeCorner, y)).toBe(true);

    // Both should transition to hollow past the same per-band threshold
    // (leg-sum ~7.88mm at the waist -- see cornerWedgeChamferAt), regardless
    // of which corner type is being probed.
    const pastThresholdFromVertex = verticalCrossings(board, 8 / Math.SQRT2, 8 / Math.SQRT2);
    expect(isSolidAt(pastThresholdFromVertex, 3.4)).toBe(false);
    const pastThresholdFromFreeCorner = verticalCrossings(board, -28 + 8 / Math.SQRT2, -28 + 8 / Math.SQRT2);
    expect(isSolidAt(pastThresholdFromFreeCorner, 3.4)).toBe(false);

    // A 3-wide, 1-tall strip has internal seams (x = -14, x = 14) but no
    // interior 4-way vertex anywhere (gridHeightUnits = 1 means no gz
    // satisfies 0 < gz < 1) -- the seam's own solid rim is unaffected either
    // way, confirming there's no separate machinery keyed off vertex count.
    const strip = createOpenGridBoardGeometry({ gridWidth: 3, gridHeight: 1, boardType: "full", chamferMode: "corners" });
    const onSeam = verticalCrossings(strip, -14.3, 0);
    for (const y of [0.9, 3.4]) expect(isSolidAt(onSeam, y)).toBe(true);
  }, 15000);

  it("degenerate 1x1 grid does not crash for any chamfer mode", () => {
    for (const chamferMode of ["everywhere", "corners", "none"] as const) {
      const geometry = createOpenGridBoardGeometry({ gridWidth: 1, gridHeight: 1, boardType: "full", chamferMode });
      expect(hasNaN(geometry)).toBe(false);
      const box = bbox(geometry);
      expect(box.size[0]).toBeCloseTo(28, 5);
      expect(box.size[2]).toBeCloseTo(28, 5);
    }
  }, 15000);

  it("clamps out-of-range grid units to [1, 20]", () => {
    const tooSmall = bbox(createOpenGridBoardGeometry({ gridWidth: 0, gridHeight: -5, boardType: "full", chamferMode: "none" }));
    const tooBig = bbox(createOpenGridBoardGeometry({ gridWidth: 999, gridHeight: 999, boardType: "full", chamferMode: "none" }));
    expect(tooSmall.size[0]).toBeCloseTo(28, 5);
    expect(tooSmall.size[2]).toBeCloseTo(28, 5);
    expect(tooBig.size[0]).toBeCloseTo(20 * 28, 5);
    expect(tooBig.size[2]).toBeCloseTo(20 * 28, 5);
  });
});
