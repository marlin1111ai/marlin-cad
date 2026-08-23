# openConnect reference sources

Fetched from `mitufy/opengrid-projects` (CC-BY 4.0 -- credited in
`apps/web/src/lib/openConnectContainerGeometry.ts` and
`apps/web/src/lib/openGridSnapGeometry.ts`), used to derive the OpenConnect
Container primitive's slot-cutout geometry and the OpenGrid Snap primitive's
body geometry. Not modified from upstream except `render_slot.scad`, which is
our own extraction wrapper.

- `openconnect_plate.scad` / `openconnect_sturdy_shelf.scad` -- top-level
  reference models (Bin's slot usage and Shelf's simplified-away truss
  structure respectively).
- `opengrid_parametric_snap.scad` -- top-level model for the push-fit
  connector ("snap") that mates into a Container's slot; also the source of
  the OpenGrid Snap primitive.
- `lib/opengrid_base.scad`, `lib/openconnect_lib.scad`,
  `lib/opengrid_snap_lib.scad`, `lib/opengrid_threads_lib.scad` -- the shared
  library modules. `openconnect_lib.scad`'s `openconnect_head` module is the
  single shared definition for both the connector head shape (called with
  `head_type="head"`, used by the snap body) and the Container's slot cutout
  shape (called with `head_type="slot"`, via `ocslot_cfg`'s
  `struct_merge(ochead_cfg(), head_cfg)` -- the slot is the head profile plus
  clearance, not a separate definition) -- confirmed no mismatch between the
  two before building the Snap primitive.
- `render_slot.scad` -- renders one `openconnect_slot()` cutout tool (default
  `ocslot_cfg()`) to STL, with `add_nubs` passed via `-D`.

## Regenerating the baked slot meshes

`SLOT_NO_LOCK_POSITIONS`/`SLOT_WITH_LOCK_POSITIONS` in
`apps/web/src/lib/openConnectSlotMesh.ts` were baked from this pipeline. The
**nightly** OpenSCAD build is required -- the 2021.01 stable release doesn't
support `linear_extrude(v=...)` (oblique/sheared extrude), silently falls
back to the default height of 100, and produces a disconnected 100mm-tall
artifact next to the real (~2.7mm-tall) slot geometry.

```sh
# from this directory
git clone --depth 1 https://github.com/BelfrySCAD/BOSL2.git /tmp/BOSL2
docker pull openscad/openscad:dev

docker run --rm -v "$(pwd)":/work -v /tmp/BOSL2:/root/.local/share/OpenSCAD/libraries/BOSL2 \
  -w /work openscad/openscad:dev \
  openscad -D 'ADD_NUBS=""' --export-format asciistl -o /work/slot_none.stl render_slot.scad

docker run --rm -v "$(pwd)":/work -v /tmp/BOSL2:/root/.local/share/OpenSCAD/libraries/BOSL2 \
  -w /work openscad/openscad:dev \
  openscad -D 'ADD_NUBS="Left"' --export-format asciistl -o /work/slot_left.stl render_slot.scad
```

Both renders should report `Status: NoError` / a single volume. Parse the
ASCII STL, dedupe vertices (exact match only -- do not filter by triangle
area; a handful of very-thin-but-real sliver triangles at the onramp's
grazing-angle bridge are load-bearing and removing them opens boundary
edges), and bake as `POSITIONS`/`INDICES` arrays.

## Regenerating the baked snap meshes

The `SNAP_*_POSITIONS`/`SNAP_*_INDICES` arrays in
`apps/web/src/lib/openGridSnapMesh.ts` (one pair per boardType x
snapBodyShape combination) were baked the same way, rendering
`opengrid_parametric_snap.scad` itself (no wrapper needed) with `-D`
overrides -- also requires the **nightly** OpenSCAD build:

```sh
# from this directory
docker run --rm -v "$(pwd)":/work -v /tmp/BOSL2:/root/.local/share/OpenSCAD/libraries/BOSL2 \
  -w /work openscad/openscad:dev \
  openscad -D 'snap_thickness=6.8' -D 'snap_body_shape="Directional"' \
    -D 'generate_snap="openConnect"' -D 'generate_screw="None"' \
    --export-format asciistl -o /work/full_directional.stl opengrid_parametric_snap.scad
# repeat with snap_thickness=4 for Lite, and snap_body_shape="Symmetric" for the other axis
```

`snap_thickness=6.8`/`4` are the upstream generator's own Standard/Lite
values (matching `OPENGRID_THICKNESS.full`/`.lite` in `openGridGeometry.ts`).
boardType "Heavy" (13.8mm) is NOT baked -- the upstream generator has no
"Heavy" option (only 6.8/4/3.4mm are customizer-exposed), and our own Heavy
board is currently a flat-slab placeholder without the real double-lip
capture groove, so there's no matching groove for a Heavy snap to lock into
yet either.

Unlike the slot renders, cleanup here takes 2 passes -- see the header
comment in `openGridSnapMesh.ts` for the full detail:

1. Exact-match vertex weld, then drop any triangle left with a repeated
   vertex index (true 0-area degenerate faces, not thin-but-real slivers).
   The two Full-thickness (6.8mm) variants each had 4 such faces at the
   uninstall notch's tangent point; the two Lite variants had none.
2. ALL 4 variants also carry ~20-32 vertex pairs sitting only ~1e-8..1e-7mm
   apart (CGAL/STL-export float noise, not a real gap) that trimesh's
   default load-time merge leaves distinct -- explicitly weld these too
   (`mesh.merge_vertices(digits_vertex=6)`), then repeat the degenerate-face
   drop from step 1 (welding exposes a further ~10-16 newly-zero-area faces
   per variant). Skipping this step leaves the mesh reporting clean on a
   plain open/non-manifold edge count (each half of a near-duplicate pair is
   independently well-formed) but non-manifold once re-analyzed by anything
   that re-derives topology via spatial quantization coarser than that gap
   -- including this codebase's own `analyzeTriangleSoup` -- because two
   unrelated real edges collapse into one edge key once their endpoints
   quantize together.

Re-verify watertightness (0 open, 0 non-manifold edges) at full precision
after both cleanup passes, and ideally also by reproducing
`analyzeTriangleSoup`'s own algorithm against the actual rounded/rotated
output, before re-baking.
