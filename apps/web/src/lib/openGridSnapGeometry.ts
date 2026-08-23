import * as THREE from "three";
import type { OpenGridBoardType, OpenGridSnapBodyShape } from "@/types/sketchforge";
import {
  SNAP_FULL_DIRECTIONAL_INDICES,
  SNAP_FULL_DIRECTIONAL_POSITIONS,
  SNAP_FULL_SYMMETRIC_INDICES,
  SNAP_FULL_SYMMETRIC_POSITIONS,
  SNAP_LITE_DIRECTIONAL_INDICES,
  SNAP_LITE_DIRECTIONAL_POSITIONS,
  SNAP_LITE_SYMMETRIC_INDICES,
  SNAP_LITE_SYMMETRIC_POSITIONS,
} from "@/lib/openGridSnapMesh";

// Reference: mitufy/opengrid-projects opengrid_parametric_snap.scad / lib/
// opengrid_snap_lib.scad / lib/openconnect_lib.scad (CC-BY 4.0 -- same credit
// already established alongside OPENGRID_TILE_SIZE in openGridGeometry.ts).
// This is the push-fit connector ("snap") that seats into an OpenGrid
// Board's hole; the OpenConnect Container's slot cutouts (openConnectContainerGeometry.ts)
// are built to mate with its head. That head shape is NOT re-derived here --
// openconnect_lib.scad's openconnect_head module (head_type="head") is the
// single shared definition the Container's slot cutter also uses
// (head_type="slot", via ocslot_cfg's struct_merge(ochead_cfg(), head_cfg) --
// the slot profile is the head profile plus clearance, not a separate
// shape), confirmed identical before baking this primitive.
//
// Unlike the Board or Container, every parameter here is a discrete enum
// (boardType x snapBodyShape, 4 combinations) with no continuous sizing, and
// the snap body itself is a dense mix of chamfers/fillets/prismoids/offset
// sweeps (base_snap + snap_corner/snap_cut/snap_nub/snap_uninstall_notch,
// all BOSL2 attachable geometry) that isn't a good fit for this codebase's
// usual earcut-per-band reimplementation. So the geometry is baked instead:
// each variant was rendered from opengrid_parametric_snap.scad itself
// (generate_snap="openConnect", generate_screw="None" -- v1 scope is the
// plain push-fit body with its uninstall notch, no screw/thread mechanism)
// straight to STL and its triangle mesh stored verbatim in
// openGridSnapMesh.ts. See reference/openconnect/README.md to regenerate.
//
// boardType "Heavy" (13.8mm) has no baked variant: the upstream generator's
// own snap_thickness customizer only exposes 6.8mm (Standard/Full) and
// 4mm/3.4mm (Lite) -- there is no official "Heavy" value -- and our own Heavy
// board is currently a flat-slab placeholder without the real double-lip
// capture groove (see openGridGeometry.ts's createOpenGridBoardGeometry), so
// there's no matching groove for a Heavy snap to lock into yet either.
// normalizeOpenGridSnapBoardType folds "heavy" down to "full" rather than
// silently faking an unsupported thickness.
//
// Local mesh frame is OpenSCAD's own (Z-up: X/Y are the ~24.8mm-square
// footprint, Z spans [0, snap_thickness] for the body then on up through the
// openConnect head). createOpenGridSnapGeometry applies the same
// rotateX(-90deg) convention openGridGeometry.ts's extrudeBandGeometry and
// openConnectContainerGeometry.ts's extrudeXZFootprint already use to send a
// Z-up extrusion axis to the app's own world Y ("up"), so this primitive's
// footprint (X/Z) and thickness (Y) line up with every other primitive in
// the scene without a bespoke transform.

export const DEFAULT_OPENGRID_SNAP_BOARD_TYPE: OpenGridBoardType = "full";
export const DEFAULT_OPENGRID_SNAP_BODY_SHAPE: OpenGridSnapBodyShape = "Directional";

export function normalizeOpenGridSnapBoardType(value?: string): OpenGridBoardType {
  return value === "lite" ? "lite" : DEFAULT_OPENGRID_SNAP_BOARD_TYPE;
}

export function normalizeOpenGridSnapBodyShape(value?: string): OpenGridSnapBodyShape {
  return value === "Symmetric" ? "Symmetric" : DEFAULT_OPENGRID_SNAP_BODY_SHAPE;
}

type SnapMeshVariant = { positions: number[]; indices: number[] };

// "heavy" is never looked up directly -- normalizeOpenGridSnapBoardType folds
// it to "full" before this table is consulted -- but the table is typed over
// the full OpenGridBoardType so that stays a compile-time guarantee rather
// than a runtime assumption.
const SNAP_MESH_VARIANTS: Record<OpenGridBoardType, Record<OpenGridSnapBodyShape, SnapMeshVariant>> = {
  full: {
    Directional: { positions: SNAP_FULL_DIRECTIONAL_POSITIONS, indices: SNAP_FULL_DIRECTIONAL_INDICES },
    Symmetric: { positions: SNAP_FULL_SYMMETRIC_POSITIONS, indices: SNAP_FULL_SYMMETRIC_INDICES },
  },
  lite: {
    Directional: { positions: SNAP_LITE_DIRECTIONAL_POSITIONS, indices: SNAP_LITE_DIRECTIONAL_INDICES },
    Symmetric: { positions: SNAP_LITE_SYMMETRIC_POSITIONS, indices: SNAP_LITE_SYMMETRIC_INDICES },
  },
  heavy: {
    Directional: { positions: SNAP_FULL_DIRECTIONAL_POSITIONS, indices: SNAP_FULL_DIRECTIONAL_INDICES },
    Symmetric: { positions: SNAP_FULL_SYMMETRIC_POSITIONS, indices: SNAP_FULL_SYMMETRIC_INDICES },
  },
};

function meshVariant(boardType?: string, snapBodyShape?: string): SnapMeshVariant {
  const type = normalizeOpenGridSnapBoardType(boardType);
  const shape = normalizeOpenGridSnapBodyShape(snapBodyShape);
  return SNAP_MESH_VARIANTS[type][shape];
}

function expandIndexed(positions: number[], indices: number[]): number[] {
  const out: number[] = new Array(indices.length * 3);
  for (let i = 0; i < indices.length; i += 1) {
    const vertexIndex = indices[i] * 3;
    out[i * 3] = positions[vertexIndex];
    out[i * 3 + 1] = positions[vertexIndex + 1];
    out[i * 3 + 2] = positions[vertexIndex + 2];
  }
  return out;
}

// Bounding box of the baked mesh's SCAD-frame (X, Y, Z) positions, mapped
// through the same axis relabeling createOpenGridSnapGeometry's
// rotateX(-90deg) applies (world X = scad X, world Y = scad Z, world Z =
// scad Y) -- lets callers get the post-rotation footprint/height without
// constructing a THREE.BufferGeometry just to measure it.
export function openGridSnapDimensions(boardType?: string, snapBodyShape?: string) {
  const { positions } = meshVariant(boardType, snapBodyShape);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return {
    width: maxX - minX,
    depth: maxY - minY,
    height: maxZ - minZ,
  };
}

type OpenGridSnapOptions = {
  boardType?: OpenGridBoardType;
  snapBodyShape?: OpenGridSnapBodyShape;
};

export function createOpenGridSnapGeometry({ boardType, snapBodyShape }: OpenGridSnapOptions): THREE.BufferGeometry {
  const variant = meshVariant(boardType, snapBodyShape);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(expandIndexed(variant.positions, variant.indices), 3));
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}
