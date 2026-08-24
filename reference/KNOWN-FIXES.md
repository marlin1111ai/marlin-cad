# Known Fixes

Quick symptom → fix lookup. See [CLAUDE-LESSONS.md](../CLAUDE-LESSONS.md) for the full detail behind each entry (linked by heading text below).

- **Slot cavity passes watertight check but is sealed shut** → raycast the exported STL, don't trust mesh checks alone; check the cap-detection filter's epsilon (use `1e-4` for float32-derived data). See "Watertightness checks cannot detect a sealed-shut pocket; raycast the exported STL" and "EPS tolerance pitfalls: match the tolerance to the data's noise floor".
- **CSG subtraction leaves open boundary edges** → the cutter reaches the target's surface; use a boundary-rep instead of runtime CSG. See "Prefer boundary representation over runtime CSG for cuts that reach a surface".
- **False non-manifold edges on an OpenSCAD-baked mesh** → weld with `merge_vertices(digits_vertex=6)` and drop the triangles the merge degenerates. See "EPS tolerance pitfalls: match the tolerance to the data's noise floor".
- **Seam is non-manifold only at larger sizes** → ULP mismatch between two construction paths; build both sides of the seam through the same call path, and push exact literals for arc endpoints. See "The exact-stitch vertex contract: shared seams must be bit-identical doubles".
- **Printed slot pockets clogged / thin internal gap fused shut** → the slit is below printable line width; design it out rather than modeling it thinner. See "Slicer slit fusion: sub-printable internal gaps fuse and ooze".
- **PegPlate hangs mirrored on the wall** → `pegs[].x` is specified in as-mounted view space; do not remove the `normalizedPegs` mirror step. See "Front-face x-addressed features are specified in as-mounted view space; geometry mirrors internally".
- **`git push` prompts for credentials** → the remote should be SSH, not HTTPS: `git@github.com:marlin1111ai/marlin-cad.git`.
