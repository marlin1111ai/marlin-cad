# marlin-cad — banked lessons & traps

Hard-won lessons from building and physically printing the parametric
primitives in this repo (OpenGrid Board, OpenConnect Container, OpenGrid
Snap, Multiconnect Plate/PegPlate). One entry per lesson, dated when it was
learned. Add new lessons at the bottom; never reword or delete an existing
entry — if a lesson turns out to be wrong, append a dated correction.

---

## 2026-08-22 — Watertightness checks cannot detect a sealed-shut pocket; raycast the exported STL

A cavity that should open through a wall but is accidentally sealed by a
stray cap is still a perfectly valid closed solid: 0 boundary edges, 0
non-manifold edges, every mesh check green. The openConnect Container's
first slot implementation left ~0.3mm of solid skin between each slot
cavity and the wall's interior face whenever `wallThickness` exceeded the
baked tool's depth — found only by raycasting an actual exported STL and
asserting the cavity is open where it must be open. The inverse also holds:
the Multiconnect slot is a deliberately BLIND cut, so its tests raycast to
assert material IS present in the blind band. Lesson: for every cavity,
write raycast tests that pin both "open where open" and "solid where
solid", and run them against the exported file itself, not just the
in-memory geometry.

## 2026-08-22 — EPS tolerance pitfalls: match the tolerance to the data's noise floor

Two ways a plausible-looking epsilon silently breaks geometry:

- A cap-detection filter used `EPS = 1e-6` to identify and drop an
  extrusion's end caps. `THREE.BufferGeometry.translate()` works on a
  float32-backed buffer and can land vertices ~1.8e-6 off their exact
  target plane — just past the threshold, so an entire end cap leaked
  through misclassified as side wall, sealing shut a cavity with zero
  watertightness symptoms (see the raycast lesson above; these two combined
  in the same bug). Use `1e-4` for anything float32-backed, baked, sliced,
  or otherwise derived; reserve tighter epsilons for exact doubles you
  produced yourself.
- OpenSCAD/CGAL STL exports carry near-duplicate vertex pairs 1e-8..1e-7mm
  apart plus true zero-area triangles. Each half of a pair is independently
  well-formed, so default-tolerance checks pass — but spatial-quantization
  topology (our `analyzeTriangleSoup`) collapses the pair and reports false
  non-manifold edges. Weld explicitly before baking
  (`merge_vertices(digits_vertex=6)`), then drop any triangles the merge
  degenerated.

## 2026-08-24 (recorded; physical-print finding) — Slicer slit fusion: sub-printable internal gaps fuse and ooze

An internal gap narrower than the printer can resolve does not print as a
gap: the walls on either side fuse, and molten material oozes through into
adjacent cavities. Every geometry check passes — the mesh genuinely
contains the slit — but the physical part comes out wrong (blocked or
undersized cavities, fused features). Lesson: internal clearances must be
printable-width or designed out entirely; a modeled gap below roughly a
line width is a defect, not a feature. Geometry validation cannot catch
this class of bug — only thinking about minimum feature size, or a test
print, does.

## 2026-08-22 — Prefer boundary representation over runtime CSG for cuts that reach a surface

`three-bvh-csg` SUBTRACTION reliably leaves open boundary edges whenever
the cutter's own boundary reaches the target's surface (a through or flush
cut) — confirmed on a minimal box-minus-box repro. The undocumented
`evaluator.useCDTClipping = true` fixes simple axis-aligned cases but not
complex curvy cutters. Blind interior pockets are the only case where CSG
subtraction is dependable. For anything that opens onto a face, build a
boundary representation instead: keep the cutter mesh's own side-wall
surface with reversed winding as the hole's interior wall, and close the
rims with earcut caps whose contours are notched/holed by the cutter's
exact rim polyline. No boolean at all. This pattern (worked examples:
`openConnectContainerGeometry.ts`, `multiconnectContainerGeometry.ts`) also
turned out dramatically faster — removing CSG from the OpenGrid Board took
generation from ~2.3s to milliseconds. Bonus reason to avoid runtime CSG:
the manifold-3d kernel is async-loaded, while primitive builders must stay
synchronous; use Manifold in bake scripts, not the runtime path.

## 2026-08-22 → 2026-08-24 — The exact-stitch vertex contract: shared seams must be bit-identical doubles

Boundary-rep construction only stays manifold if every seam shared between
independently emitted patches reuses bit-identical vertex coordinates.
Three traps:

- Two geometry construction paths that compute "the same" corner (e.g.
  `BoxGeometry` vs `ExtrudeGeometry`) can disagree by a few ULPs, and only
  at larger coordinate magnitudes — so it passes on a small test case and
  fails scaled up. Build both sides of a seam through the SAME construction
  call path / shared transform function.
- Trig does not land exactly: `Math.cos(π/2)` is 6e-17, not 0. Arc
  ENDPOINTS must be pushed as the exact straight-edge coordinate literals;
  only arc interior points may come from the parametrization.
- Verify the contract with an exact directed-edge test (every directed edge
  appears exactly once, with its reverse exactly once, keyed on raw
  doubles). Spatially-quantized manifold checks cannot see ULP seams or
  flipped patches; the exact test can. Baked meshes make this possible by
  guaranteeing their clip-plane vertices ARE the shared outline values
  verbatim (see `multiconnectSlotMesh.ts` phase-1 bake).

## 2026-08-24 — Front-face x-addressed features are specified in as-mounted view space; geometry mirrors internally

A wall-mounted plate presents its front face X-MIRRORED to the viewer: the
mounting face goes against the wall, the viewer looks along +Z, and
geometry x=0 lands on their right. The first printed PegPlate sampler,
specified left-to-right in geometry space, hung on the wall reading
right-to-left (14→5mm instead of 5→14mm). Convention now: any user-facing
x-addressed front-face feature (today: `pegs[].x`) means "x from the LEFT
edge as the mounted viewer sees it", and the geometry mirrors it internally
at exactly one clearly-marked spot (`normalizedPegs`:
`x_geometry = plateWidth - x_viewed`). Do not "simplify" the mirror away —
the printed sampler is the proof it belongs there. Slots need no mirror
(the centering formula is mirror-symmetric), and vertical z is unaffected.
