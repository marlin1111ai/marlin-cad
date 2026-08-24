# Decisions

Design decisions and the reason for each.

- **Foreman/builder workflow, print-gated phases.** The owner (Marlin) makes design decisions and rules on scope; Claude builds in small phases, each committed and pushed under an agreed gate. Phases that produce physical geometry are print-gated — a coupon or sampler is printed and hand-verified before the next phase builds on it.
- **Boundary-rep/earcut over runtime CSG.** Runtime CSG subtraction is unreliable for cuts that reach a surface and is slower; boundary construction is dependable and dramatically faster. See CLAUDE-LESSONS.md.
- **UI scoping over code deletion.** Board Type is restricted to "full" and Heavy is hidden in the UI rather than removing the underlying code, since the variants aren't validated yet.
- **Wrench Racks presets must stay byte-identical to test-prints/ reference STLs.** Those STLs are the physically validated exports; any geometry change that alters them requires a new print verification pass before merging.
- **Multiconnect slots are blind keyhole cuts, 4.15mm deep.** The front face stays solid by construction.
- **plateThickness extra material goes frontward.** Slots are always measured from the mounting face, so added thickness doesn't change slot depth.
- **Peg x is "from the left edge as mounted."** User-facing peg positions are specified in as-mounted view space; geometry mirrors internally at exactly one marked spot (`normalizedPegs`), since the front face is X-mirrored relative to geometry space.
- **Shelf variant intentionally has no truss/gusset.**
- **MIN_OPENCONNECT_DIMENSION lowered to 0.1** (`97a97a3`).
- **Deployment to Unraid is a separate, human-gated step.** Dev runs as a local process on port 3000.
