include <lib/opengrid_base.scad>
use <lib/openconnect_lib.scad>

$fa = 1;
$fs = 0.4;

// Single slot cutout tool, matching openconnect_slot_grid's per-cell placement
// (default ocslot_cfg, "slot" body). ADD_NUBS is passed via -D from the CLI.
slot_cfg = ocslot_cfg();
openconnect_slot(slot_type="slot", slot_cfg=slot_cfg, add_nubs=ADD_NUBS, slot_entryramp_flip=false, excess_thickness=0.005, anchor=BOTTOM);
