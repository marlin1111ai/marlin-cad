import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createOpenGridSnapGeometry, openGridSnapDimensions } from "@/lib/openGridSnapGeometry";
import { analyzeTriangleSoup } from "@/lib/svgImport";

function positionsArray(geometry: THREE.BufferGeometry): number[] {
  return Array.from(geometry.getAttribute("position").array);
}

function hasNaN(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute("position");
  for (let i = 0; i < pos.count * 3; i += 1) {
    if (!Number.isFinite(pos.array[i])) return true;
  }
  return false;
}

const VARIANTS: Array<{ boardType: "full" | "lite" | "heavy"; snapBodyShape: "Directional" | "Symmetric" }> = [
  { boardType: "full", snapBodyShape: "Directional" },
  { boardType: "full", snapBodyShape: "Symmetric" },
  { boardType: "lite", snapBodyShape: "Directional" },
  { boardType: "lite", snapBodyShape: "Symmetric" },
];

describe("createOpenGridSnapGeometry", () => {
  for (const { boardType, snapBodyShape } of VARIANTS) {
    it(`${boardType}/${snapBodyShape} is a watertight manifold with no NaNs`, () => {
      const geometry = createOpenGridSnapGeometry({ boardType, snapBodyShape });
      expect(hasNaN(geometry)).toBe(false);
      const analysis = analyzeTriangleSoup(positionsArray(geometry));
      expect(analysis.boundaryEdges).toBe(0);
      expect(analysis.nonManifoldEdges).toBe(0);
    });
  }

  it("boardType 'heavy' falls back to the 'full' baked mesh rather than throwing or faking a variant", () => {
    const heavy = positionsArray(createOpenGridSnapGeometry({ boardType: "heavy", snapBodyShape: "Directional" }));
    const full = positionsArray(createOpenGridSnapGeometry({ boardType: "full", snapBodyShape: "Directional" }));
    expect(heavy).toEqual(full);
  });

  it("Directional and Symmetric bodies differ (front/back nub asymmetry only on Directional)", () => {
    const directional = positionsArray(createOpenGridSnapGeometry({ boardType: "full", snapBodyShape: "Directional" }));
    const symmetric = positionsArray(createOpenGridSnapGeometry({ boardType: "full", snapBodyShape: "Symmetric" }));
    expect(directional).not.toEqual(symmetric);
  });

  it("Lite body is shorter (thinner board thickness) than Full", () => {
    const full = openGridSnapDimensions("full", "Directional");
    const lite = openGridSnapDimensions("lite", "Directional");
    expect(lite.height).toBeLessThan(full.height);
    // Footprint (width) is board-thickness-independent -- same connector head/body plan either way.
    expect(lite.width).toBeCloseTo(full.width, 3);
  });
});
