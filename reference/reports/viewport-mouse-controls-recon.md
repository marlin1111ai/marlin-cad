# Viewport mouse controls — recon against the Bambu Studio map

Date: 2026-09-28. Read-only pass, made at `88e16ac`. This report is the only
file the pass created; no app code, test, STL, script, notebook file or
config was edited.

**Everything here is traced from code, not tested live.** No dev server was
started, no browser was opened, and no pointer event was fired. Where a
finding depends on how a browser orders events, that is said at the finding.

Line numbers are as of `88e16ac`. `OrbitControls.js` is
`node_modules/three/examples/jsm/controls/OrbitControls.js`, three 0.184.0
(`node_modules/three/package.json:3`, `package.json:54`). It is not tracked
in the repo, but it is the code that runs, and four findings below depend on
it.

Short names used below:

| Short name | File |
|---|---|
| `Viewport` | `apps/web/src/components/WorkplaneViewport.tsx` |
| `Editor` | `apps/web/src/components/SketchForgeEditor.tsx` |
| `Overlay` | `apps/web/src/components/workplane/TransformOverlay.tsx` |
| `Actions` | `apps/web/src/components/workplane/ActionOverlays.tsx` |
| `MoveDim` | `apps/web/src/components/workplane/MoveDimensionOverlay.tsx` |
| `Sketch` | `apps/web/src/components/SketchWorkspace.tsx` |
| `CSS` | `apps/web/src/app/globals.css` |
| `Orbit` | `node_modules/three/examples/jsm/controls/OrbitControls.js` |

---

## a) Recon — where the viewport's input is handled

Searched: every tracked file in the repo (380 files: `apps/web`,
`apps/desktop`, `scripts`, `tests`, `docs`, `deploy`, `.github`,
`test-prints/README.md`, `README.md`, `reference/`, `CLAUDE.md`,
`CLAUDE-LESSONS.md`) for pointer, mouse, wheel, touch, context-menu,
modifier-key and keydown handling, and for `OrbitControls` and its settings.

The 3D viewport's input lives in **two layers inside one file**, plus three
overlay components and one window-level keyboard handler in the editor.

### Layer 1 — the camera: OrbitControls on the canvas

| What | Where |
|---|---|
| OrbitControls imported | `Viewport:8` |
| Created on the canvas element | `Viewport:5060` |
| Damping, rotate / zoom / pan speed, screen-space pan, zoom to cursor | `Viewport:5061-5067` |
| Button map at start-up: LEFT none, MIDDLE pan, RIGHT rotate | `Viewport:5068-5072` |
| Distance, zoom and polar-angle limits | `Viewport:5073-5078` |
| Button map rewritten on every pointerdown (capture phase) | `Viewport:5172-5176`, registered `Viewport:5186` |
| Button map reset on pointerup / pointercancel | `Viewport:5177-5181`, registered `Viewport:5187-5188` |
| Context menu suppressed on the canvas | `Viewport:5182-5184`, registered `Viewport:5189` |
| Wheel and pointerdown also request a redraw | `Viewport:5190-5191` |
| Zoom speed taken from the Workspace settings slider | `Viewport:5372` |
| Camera switched off while a part, handle or marquee is being dragged | `Viewport:3448`, `4168`, `4190`, `4281` |
| Camera switched back on when the drag ends | `Viewport:3707`, `4457`, `4494`, `4542` |

OrbitControls' own behaviour that the app relies on:

| What | Where |
|---|---|
| Listens for pointerdown, contextmenu, wheel on the canvas; sets `touch-action: none` | `Orbit:499-508` |
| Button → action lookup | `Orbit:1638-1663` |
| **A ROTATE button held with Shift, Ctrl or Cmd pans instead** | `Orbit:1677-1697` |
| **A PAN button held with Shift, Ctrl or Cmd rotates instead** | `Orbit:1699-1719` |
| Wheel: `deltaY < 0` zooms in, `deltaY > 0` zooms out | `Orbit:1155-1171`, `1019-1047` |
| Wheel with `ctrlKey` set but no Control key held (a trackpad pinch) is multiplied by 10 | `Orbit:1508-1540`, `1935-1961` |
| Wheel ignored while the camera is switched off or mid-drag | `Orbit:1767-1779` |
| Touch defaults: one finger rotates, two fingers zoom and pan | `Orbit:371`, `1789-1871` |
| Arrow-key camera movement exists but only if `listenToKeyEvents()` is called | `Orbit:576`, `1173-1270` |
| Context menu suppressed | `Orbit:1927-1933` |

`listenToKeyEvents` is never called anywhere in the repo, so the arrow keys
do not move the camera. `controls.touches` is never set, so touch uses the
defaults.

### Layer 2 — selection, moving and tools: React handlers on the host

The host `<div>` wraps the canvas and carries the handlers
(`Viewport:4916-4929`):

| Handler | Where |
|---|---|
| `handlePointerDown` | `Viewport:3989-4305` |
| `handlePointerMove` | `Viewport:4307-4424` |
| `finishDrag` (pointerup and pointercancel) | `Viewport:4433-4548` |
| `handlePointerLeave` | `Viewport:4426-4431` |
| `handleDrop` (shape dragged in from the insert menu) | `Viewport:4550-4567` |
| What counts as "a part" under the pointer: `pickShape` | `Viewport:3845-3884` |
| What counts as "a handle": `pickTransformHandle` | `Viewport:3963-3987` |
| Which parts a marquee catches: `shapesInMarquee` | `Viewport:3292-3305` |
| Keyboard (window-level) | `Viewport:4792-4840` |

The first line of `handlePointerDown` that matters: **anything that is not
the left button, or that has Ctrl or Cmd held, is ignored by this layer**
(`Viewport:3995`) and left to the camera.

### Overlays drawn on top of the canvas

All three overlay containers are `pointer-events: none`
(`CSS:4344-4349`, `4376-4381`, `4426-4431`), so they take input only on
their own buttons and handles.

| Overlay | Input it handles | Where |
|---|---|---|
| Transform overlay (DOM handles, dimension labels) | Left button starts a resize / lift / rotate; middle and right are forwarded to the camera; wheel is forwarded to the camera; context menu suppressed | `Overlay:84-95`, `103-110`, `221-236`, `245-256`; forwarding in `Viewport:3455-3491`, `3493-3523` |
| Align dots and Mirror arrows | Click; hover previews | `Actions:32-57`, `81-103` |
| Move-dimension labels | Click to edit; pointerdown stopped; context menu suppressed | `MoveDim:25-27`, `78-82`, `102-107` |
| Ruler points and segments | Left button only | `Viewport:4695-4790`, drawn `Viewport:1461-1488` |
| View cube | Click a face; pointerdown stopped | `Viewport:4844-4852` |
| Camera buttons (Home, Zoom in, Zoom out) | Click | `Viewport:4865-4873` |
| Shape inspector, settings modal, tutorial panels | Stop pointerdown (and wheel, on the tutorials) from reaching the viewport | `ShapeInspector.tsx:761`, `WorkspaceSettingsModal.tsx:150`, `KeyTagTutorialPanel.tsx:154-155`, `NameplateTutorialPanel.tsx:188-189` |

### Keyboard in the editor

`Editor:8812-8979` is a second window-level keydown handler. It moves and
edits the selection; none of it moves the camera. It is listed in section b
because its arrow keys are the ones a user might expect to move the view.

### Places that turned out not to be the 3D viewport

| Place | What it is | Where |
|---|---|---|
| 2D sketch view | A separate SVG view with its own pan and zoom. While it is showing, the 3D viewport is not mounted at all | `Sketch:545-570`, `637-640`, `696-701`; the switch is `Editor:9085-9126` |
| Revolve preview | A three.js canvas with no controls and no input handlers | `apps/web/src/components/SketchRevolvePreview.tsx:12-39` |
| Desktop shell | A tray menu only; nothing that touches the viewport's mouse or zoom | `apps/desktop/main.cjs:262` |
| MCP server | Selects by id and captures view-cube angles; sends no pointer input | `scripts/sketchforge-mcp-server.mjs:39-40`, `241` |

### The notebook

`reference/` and both `CLAUDE*.md` files hold nothing on mouse bindings. The
only mention of camera movement is one line in
`reference/reports/snapshot-recon.md:373`. No decision in
`reference/DECISIONS.md` covers viewport controls, so nothing settled is
being reopened.

---

## b) Current map

### Camera

| Input | Under the pointer | What happens | Where |
|---|---|---|---|
| Right-drag | Anything on the canvas | Spins the view | `Viewport:5071`, `5175`; `Orbit:1654-1657`, `1687-1695` |
| Right-drag + Shift, Ctrl or Cmd | Anything | Slides the view | `Orbit:1677-1686` |
| Middle-drag | Anything | Slides the view | `Viewport:5070`, `5174`; `Orbit:1709-1717` |
| Middle-drag + Shift, Ctrl or Cmd | Anything | Spins the view | `Orbit:1699-1708` |
| Ctrl- or Cmd- + left-drag | Anything | Camera drag. The app assigns PAN (`Viewport:5173`), and OrbitControls turns a PAN button held with Ctrl or Cmd into a spin (`Orbit:1699-1708`), so the traced result is **spin, not slide**. See "least sure", item 1 | `Viewport:3995`, `5173`; `Orbit:1699-1708` |
| Right or middle button | On a DOM transform handle or label | Forwarded to the canvas as the same camera drag | `Overlay:84-90`; `Viewport:3455-3491` |
| Wheel | Canvas | Zoom toward the pointer. Rolling toward you (`deltaY > 0`) zooms out; rolling away zooms in | `Viewport:5064`, `5067`; `Orbit:1155-1171` |
| Wheel | On a DOM transform handle or label | Forwarded to the canvas | `Overlay:91`; `Viewport:3493-3523` |
| Wheel | While a part, handle or marquee is being dragged | Nothing (camera is switched off) | `Orbit:1769`; `Viewport:4190`, `4281` |
| Trackpad two-finger scroll | Canvas | Arrives as wheel: zoom. There is no trackpad slide | `Orbit:1508-1540` |
| Trackpad pinch | Canvas | Arrives as wheel with `ctrlKey`: zoom, ×10 | `Orbit:1531-1536` |
| Right-click (no drag) | Canvas, transform overlay, move-dimension labels | Nothing; the browser menu is suppressed and there is no app menu | `Viewport:5182-5184`; `Orbit:1927-1933`; `Overlay:92-95`; `MoveDim:79-82`, `104-107` |
| `F` or `Home` | — | Reset view | `Viewport:4823-4825` |
| `O` (no Ctrl / Cmd / Alt) | — | Perspective ↔ orthographic | `Viewport:4826-4828` |
| `+` or `=` | — | Zoom in | `Viewport:4829-4831` |
| `-` or `_` | — | Zoom out | `Viewport:4832-4834` |
| View cube face | — | Snap to that view | `Viewport:4846-4851` |
| Home / Zoom in / Zoom out buttons | — | As named | `Viewport:4865-4873` |
| Arrow keys | — | **Do not move the camera.** They nudge the selection (below) | `Editor:8948-8959` |

### Left button, no tool active

| Input | Under the pointer | What happens | Where |
|---|---|---|---|
| Left-drag | Empty space | Draws a selection box; on release the selection is **replaced** by what it caught | `Viewport:4173-4193`, `4356-4368`, `4471-4489` |
| Shift + left-drag | Empty space | Draws a selection box; on release what it caught is **added** | `Viewport:4174`, `4186`, `4479-4486` |
| Left-click (moved under 5px) | Empty space | Clears the selection | `Viewport:4365`, `4490-4492` |
| Shift + left-click | Empty space | Nothing; selection kept | `Viewport:4490` |
| Left-drag | A part | Selects it if it was not selected, then moves it along the active workplane. If it was already part of a multi-selection, the whole selection moves | `Viewport:4195-4282`, `4370-4421`, `4500-4546` |
| Left-click | A part | Selects it (replaces the selection) | `Viewport:4215-4217`; `Editor:8724` |
| Shift + left-click | A part | Toggles it in or out of the selection. No move, even if dragged | `Viewport:4211-4214`; `Editor:8721-8723` |
| Left-drag | A locked part | Selects it; does not move | `Viewport:4218-4220` |
| Left-drag | A handle (one part selected) | Resize, height, lift or rotate | `Viewport:4041-4171`; `Overlay:221-230`, `245-252` |
| … + Shift, on a corner resize | | Keeps proportions | `Viewport:2001-2006`, `2214-2227` |
| … + Alt, on a resize | | Resizes about the centre | `Viewport:1992-1994`, `2008-2010`, `2200-2203`, `2229-2231` |
| … + Shift, on a rotate | | Snaps to 45° | `Viewport:3636-3637` |
| Left-click | Lift handle, rotate handle, dimension label | Opens a number box | `Overlay:157`, `231-236`, `253-256` |
| Ctrl- or Cmd- + left-click | A part | **Nothing is selected.** The selection layer ignores it | `Viewport:3995` |

"A part" is wider than the part's outline: when the ray misses every part,
`pickShape` falls back to the nearest part whose centre is within 48 to
112px of the pointer (`Viewport:3868-3881`). So "empty space" means empty
*and* not near a part's centre.

Handles on the canvas are only offered when exactly one part is selected
(`Viewport:3965`).

### When a mode or tool is active

Modes are tested in this order at the top of `handlePointerDown`, before any
handle, part or empty-space logic, so each one takes over the left button.
The camera (right, middle, wheel) is unchanged in every mode.

| Mode | Left button does | Where |
|---|---|---|
| Chamfer / Fillet edge pick | Click an edge to toggle it and its tangent chain; Shift toggles that single edge. No select, move or marquee | `Viewport:4001-4006`; `Editor:5965-5976` |
| Ruler — delete | Swallowed on the canvas; clicking a ruler point or segment deletes it | `Viewport:4008-4011`, `4700-4705`, `4773-4778` |
| Ruler — move | Swallowed on the canvas; ruler points drag | `Viewport:4013-4017`, `4706-4712`, `4729-4766` |
| Ruler — add | Click picks a measurement point | `Viewport:4019-4026`, `4713-4724`, `4779-4787` |
| Place workplane (`W`) | Click a face, or empty grid for the base; Shift reverses it; then the mode ends | `Viewport:4028-4039`, `4309-4337` |
| **Align** | Click a part **that is already selected** to make it the anchor, with no move. Everything else is as with no tool: a part that is not selected is selected and dragged, empty space draws a selection box. The transform handles are hidden; the align dots are clicked instead | `Viewport:4197-4201`, `4938`; `Actions:52-56`; `Editor:7092-7125` |
| **Mirror** | No special case in the pointer handlers: exactly as with no tool. The transform handles are hidden; the mirror arrows are clicked instead | `Viewport:4938`; `Actions:92-96`; `Editor:7155-7171` |
| Sketch | The 3D viewport is not mounted. In the 2D view: middle-drag slides, wheel zooms (toward you zooms out), left-drag on empty space with the Select tool draws a selection box, and there is no right-button or modifier handling | `Editor:9085-9126`; `Sketch:552-570`, `637-640` |

Hiding of overlays by mode: `Viewport:4930-4982`.

### Keyboard that acts on the viewport but not the camera

| Key | What happens | Where |
|---|---|---|
| `Escape` | Leaves workplane or ruler mode; otherwise clears the selection | `Viewport:4806-4817`; `Editor:8850-8854` |
| `W` / Shift+`W` | Workplane tool / workplane on the selected part | `Viewport:4818-4822` |
| Arrows; Shift = 5 instead of 1 | Nudge the selection | `Editor:8941`, `8948-8959` |
| Ctrl/Cmd + Up / Down | Raise / lower the selection | `Editor:8942-8947` |
| `R`, `D`, `H`, `S`, `L`, `M` | Rotate 45°, drop to workplane, hole, solid, align mode, mirror mode | `Editor:8935-8939`, `8960-8975` |
| Ctrl/Cmd + `Z` `Y` `C` `X` `V` `D` `A` `G` `L` `H` | Undo, redo, copy, cut, paste, duplicate, select all, group, lock, hide | `Editor:8862-8933` |
| `Delete` / `Backspace` | Delete the selection | `Editor:8856-8860` |
| `Escape` / `Enter` in Chamfer / Fillet | Cancel / apply | `Editor:7527-7542` |

### Touch

Traced only, and the least certain part of the map. One finger reaches both
layers: OrbitControls starts a spin (`Orbit:1565-1567`, `1795-1807`), and the
selection layer treats it as a left button (`Viewport:3995`) and switches the
camera off when it starts a marquee, a move or a handle drag
(`Viewport:4190`, `4281`, `4168`). In the branches that return without
switching the camera off (the tool modes, the align anchor, Shift-toggle, a
locked part) the one-finger spin would carry on.

---

## c) Compared with the Bambu Studio map

| # | Bambu Studio | marlin-cad now | Same? |
|---|---|---|---|
| 1 | Spin: left-drag on empty space | Left-drag on empty space draws a selection box. Spin is right-drag | **No** |
| 2 | Slide: right-drag, or middle-drag | Middle-drag slides. Right-drag spins | **Half** |
| 3 | Zoom: wheel; toward you zooms out | Wheel; toward you zooms out | **Yes** |
| 4 | Selection box: Shift + left-drag | Left-drag on empty space (replace); Shift + left-drag on empty space (add) | **Partly** |
| 5 | Add to selection: Ctrl + click | Shift + click. Ctrl + click selects nothing and drives the camera | **No** |
| 6 | Move a part: left-drag on it | Left-drag on it | **Yes** |

### Row 1 — Spin the view: left-drag on empty space

- **Now:** selection box (`Viewport:4173-4193`). Spin is on the right button
  (`Viewport:5071`, `5175`).
- **What would have to change:**
  - The left button has to become a camera button when the pointer is on
    empty space and no modifier is held (`Viewport:5068-5072`,
    `5172-5181`).
  - The empty-space branch has to stop starting a marquee when Shift is not
    held (`Viewport:4175-4193`).
  - **The order of the two layers is the hard part.** OrbitControls decides
    what a button does at pointerdown on the canvas
    (`Orbit:1544-1581`), and the only hook that runs before it is
    `configureSketchForgeMouseButtons` (`Viewport:5172-5176`), which sits
    inside `createThreeScene` and has no access to `pickShape`,
    `pickTransformHandle` or the tool modes; those live in the component
    (`Viewport:3845-3987`, `4001-4039`). Knowing "is this empty space?"
    needs them. So either the pick moves to where the capture hook can call
    it, or the selection layer starts the spin itself.
- **Loses its binding or collides:**
  - Plain left-drag selection box (replace) — loses its binding; it moves
    to Shift + left-drag, row 4 (`Viewport:4173-4193`, `4487-4489`).
  - Click on empty space to clear the selection (`Viewport:4490-4492`) —
    collides. It is decided on release of the marquee. With no marquee on a
    plain left button it has to be re-made as "left button released on
    empty space having moved under 5px" (`Viewport:4365`).
  - Right-drag spin — loses its binding if row 2 is taken
    (`Viewport:5071`).
  - The near-a-part fallback (`Viewport:3868-3881`) — collides. A left-drag
    begun in visibly empty space within 48 to 112px of a part's centre
    would move that part instead of spinning the view. Today the same drag
    also moves the part, but the alternative is a selection box, not the
    camera, so the miss is less surprising now than it would be.
  - The tool modes (`Viewport:4001-4039`) — collide. In each of them a left
    press on empty space belongs to the tool, so the left button must stay
    off the camera while one is active. Align and Mirror have no branch of
    their own for empty space (`Viewport:4197-4201`), so they would spin.
  - The `grab` / `grabbing` cursor on the host (`CSS:4143-4153`) — no
    collision; it would finally match what the left button does.
  - **Spinning with the pointer over a part stops being possible with the
    mouse alone.** Today right-drag spins from anywhere. Under the Bambu
    map, left-drag on a part moves it and right-drag slides, so a part that
    fills the viewport leaves only the view cube (`Viewport:4846-4851`) and
    the modifier swaps below.

### Row 2 — Slide the view: right-drag, or middle-drag

- **Now:** middle-drag slides (`Viewport:5070`, `5174`, `5179`); right-drag
  spins (`Viewport:5071`, `5175`, `5180`).
- **What would have to change:** RIGHT from ROTATE to PAN in all three
  places. Middle needs nothing.
- **Loses its binding or collides:**
  - Right-drag spin — loses its binding (`Viewport:5071`, `5175`, `5180`).
  - Shift / Ctrl / Cmd + right-drag, which slides today
    (`Orbit:1677-1686`) — flips to spin (`Orbit:1699-1708`), because
    OrbitControls swaps a PAN button under those keys. Not in the Bambu
    map; it would exist as a side effect unless switched off.
  - Shift / Ctrl / Cmd + middle-drag already spins (`Orbit:1699-1708`) —
    unchanged, and also not in the Bambu map.
  - Right and middle on a DOM handle (`Overlay:84-90`,
    `Viewport:3455-3491`) — no collision; they are forwarded as raw button
    events and follow whatever the button map says.

### Row 3 — Zoom: scroll wheel; rolling toward you zooms out

- **Now:** the same. `deltaY > 0` calls `_dollyOut` (`Orbit:1163-1167`),
  which grows the camera distance (`Orbit:1019-1023`, `776`).
- **What would have to change:** nothing.
- **Loses its binding or collides:** nothing.
- **Notes:** the direction is the browser's `deltaY`, so an operating
  system set to "natural" scrolling reverses it for the app as it does for
  everything else. Zoom goes toward the pointer (`Viewport:5067`); the
  brief's map does not say whether Bambu's does. The 2D sketch view's wheel
  runs the same direction (`Sketch:637-640`).

### Row 4 — Draw a selection box: Shift + left-drag

- **Now:** Shift + left-drag on empty space already draws a box, and adds
  what it catches (`Viewport:4174`, `4186`, `4479-4486`). Plain left-drag
  draws one too and replaces (`Viewport:4487-4489`).
- **What would have to change:** the marquee has to require Shift
  (`Viewport:4175-4193`). Whether a Shift box **adds or replaces** has to be
  decided: today Shift means add, and the brief's map does not say.
- **Loses its binding or collides:**
  - Plain left-drag box — loses its binding (row 1).
  - Shift + left-click on a part, which toggles it today
    (`Viewport:4211-4214`) — collides if the box may start over a part. The
    toggle fires on pointerdown and returns, so a Shift-drag that begins on
    a part can never become a box. Either the box only starts on empty
    space (as now), or the toggle moves to release-without-movement.
  - Shift + right-drag and Shift + middle-drag (`Orbit:1677-1686`,
    `1699-1708`) — no collision; different buttons.
  - Shift inside a handle drag: proportional resize
    (`Viewport:2001-2006`, `2214-2227`) and 45° rotate
    (`Viewport:3636-3637`) — no collision; a handle is already held.
  - Shift in the workplane tool (`Viewport:4031`, `4310`, `4324`) and in
    edge pick (`Viewport:4004`) — no collision; the mode owns the left
    button, so no box can be drawn in those modes, as now.
  - Shift + arrows and Shift + `W` (`Editor:8941`, `Viewport:4820`) — no
    collision; keyboard only.

### Row 5 — Add to selection: Ctrl + click

- **Now:** add-to-selection is Shift + click, and it is a toggle
  (`Viewport:4174`, `4211-4214`; `Editor:8721-8723`). Ctrl + left button is
  refused by the selection layer (`Viewport:3995`) and handed to the camera
  (`Viewport:5173`).
- **What would have to change:**
  - Drop Ctrl / Cmd from the early return (`Viewport:3995`).
  - Stop giving the left button to the camera under Ctrl / Cmd
    (`Viewport:5173`).
  - Make the additive test read Ctrl (`Viewport:4174`, `4211`).
  - Decide **add only, or toggle**. `selectShape` has `"replace"` and
    `"toggle"` and no add-only mode (`Editor:8712-8726`).
  - Decide **Ctrl, Cmd, or both**. The code treats the two alike everywhere
    today (`Viewport:3995`, `5173`; `Editor:8826`).
- **Loses its binding or collides:**
  - Ctrl / Cmd + left-drag camera drag — loses its binding
    (`Viewport:5173`). It is the only camera movement on the left button,
    so it is the one a mouse with no middle button, or a trackpad, relies
    on.
  - Shift + click toggle (`Viewport:4211-4214`) — collides with row 4 as
    above, and would duplicate Ctrl + click if kept.
  - Ctrl + click on a Mac is the system's secondary click. The canvas
    already suppresses the menu it raises (`Viewport:5182-5184`,
    `Orbit:1927-1933`), but which button the browser reports for it was not
    checked.
  - Ctrl / Cmd keyboard shortcuts (`Editor:8862-8933`, `8942-8947`) — no
    collision; keyboard only.
  - Ctrl + wheel (`Orbit:1531-1536`) — no collision.

### Row 6 — Move a part: left-drag on it

- **Now:** the same (`Viewport:4195-4282`, `4370-4421`, `4500-4546`).
- **What would have to change:** nothing.
- **Loses its binding or collides:** nothing of its own. It is the other
  half of row 1's near-a-part collision (`Viewport:3868-3881`), and in
  Align mode a left press on a selected part sets the anchor instead of
  moving it (`Viewport:4197-4201`), which the Bambu map has no row for.

### Every collision, in one list

| # | Current action | Where | Fate under the Bambu map |
|---|---|---|---|
| 1 | Left-drag on empty space: selection box, replace | `Viewport:4173-4193`, `4487-4489` | Loses binding → Shift + left-drag |
| 2 | Left-click on empty space: clear selection | `Viewport:4490-4492` | Must be rebuilt; it rides on the marquee |
| 3 | Right-drag: spin | `Viewport:5071`, `5175`, `5180` | Loses binding → left-drag on empty space |
| 4 | Ctrl / Cmd + left-drag: camera drag | `Viewport:3995`, `5173` | Loses binding → Ctrl + click selects |
| 5 | Shift + left-click on a part: toggle | `Viewport:4211-4214` | Collides with the Shift box; duplicates Ctrl + click |
| 6 | Shift + left-drag on empty space: box that adds | `Viewport:4186`, `4479-4486` | Kept, but add-or-replace is undecided |
| 7 | Shift / Ctrl / Cmd + right-drag: slide | `Orbit:1677-1686` | Flips to spin as a side effect |
| 8 | Near-a-part fallback counts as the part | `Viewport:3868-3881` | Collides with "left-drag on empty space spins" |
| 9 | Tool modes own the left button | `Viewport:4001-4039` | Left button must stay off the camera in each |
| 10 | Align: left press on a selected part sets the anchor | `Viewport:4197-4201` | No row in the Bambu map; stays as is or is decided |
| 11 | Spin from anywhere, including over a part | `Viewport:5071` | Lost; spin needs empty space |
| 12 | One-finger touch spins where the selection layer lets it | `Orbit:1795-1807` | Unknown; touch has no row in the Bambu map |

---

## d) Where the controls are described, and what pins them

### Described to the user

**No text anywhere in the repo names a mouse button or says how to spin,
slide or zoom the view.** These are all the places that describe a control
at all:

| Where | What it says |
|---|---|
| `README.md:49-51` | "Press **O** in the editor to switch between perspective and orthographic projection." The only control in the README |
| `Viewport:4878` | Tooltip "Place workplane (W)" |
| `Viewport:4857`, `4862`, `4865`, `4868`, `4871` | Labels: Show / Hide controls, Home, Zoom in, Zoom out |
| `Viewport:4846-4851` | View cube face labels |
| `Viewport:4889`, `4898`, `4901`, `4904` | Ruler tool tooltips |
| `Overlay:212`, `244` | Handle tooltips, "Rotate" |
| `Editor:7104` | Notice: "Align: choose a dot, or click a selected shape to anchor it" |
| `Editor:7168` | Notice: "Mirror: choose an axis arrow" |
| `Editor:7715` | Notice: "Workplane tool: click a face or empty grid; hold Shift to reverse" |
| `apps/web/src/components/workplane/EdgeModifierPanel.tsx:216` | "Click highlighted model edges to toggle them. Hold Shift to add or remove a single edge." |
| `Editor:9763-9766` | "Ctrl/Cmd + Shift + H: all" |
| `apps/web/src/components/workplane/WorkspaceSettingsModal.tsx:211-224` | "Zoom speed" slider, Slow to Fast |
| `apps/web/src/components/workplane/KeyTagTutorialPanel.tsx:67`, `86`, `93`, `100` | "Select the …", "Press Align …". No button named |
| `apps/web/src/components/workplane/NameplateTutorialPanel.tsx:49`, `84`, `92` | The same |
| `docs/media/videos/README.md:50`, `52`, `62`, `69`, `71` | A shot list: "Select both shapes", "Orbit to show the cut". No button named |
| `docs/skills/sketchforge-mcp-skill/SKILL.md:82` | The view-cube faces the capture tool accepts |
| `CSS:4143-4153`, `4155-4178` | The pointer itself: a grab hand over the canvas, a crosshair in the workplane, ruler-add and edge-pick tools |

Of these, the only ones a rebinding would make wrong are the ones that name
Shift for something the change moves. The workplane and edge-pick Shift
hints (`Editor:7715`, `EdgeModifierPanel.tsx:216`) describe tool modes the
Bambu map does not touch, so they stay true. `docs/CHANGELOG.md` (14 lines)
mentions no control.

The tutorial panels show screenshots (`KeyTagTutorialPanel.tsx:208`,
`NameplateTutorialPanel.tsx:244`); an image cannot be searched for text, so
whether any of them pictures a control was not checked.

### Tests that pin the bindings

**None.** No test in `tests/` fires a pointer, mouse, wheel or key event, and
none imports a component. The unit suite runs in a `node` environment with
no DOM (`tests/vitest.config.ts:14-15`).

| Where | What it is |
|---|---|
| `tests/unit/workplaneSettings.test.ts:35` | Pins that a bad `zoomSpeed` falls back to the default. The nearest thing to a control test; a rebinding does not touch it |
| `tests/unit/sketchForgeEditorBake.test.ts:83`, `126` | "wheel rotation" here is the rotate handle's protractor wheel, not the mouse wheel |
| `reference/OPEN-ITEMS.md:50` | Already records that there is no unit test of the viewport and editor arms |

So a rebinding breaks no test, and no test would catch a mistake in it.

---

## e) Sort — STANDALONE

The notebook does not define SWEEP or STANDALONE. This report reads them as:
SWEEP is one change repeated across many files in one pass, the way a shape
registration runs through eight; STANDALONE is one self-contained change.

**STANDALONE.** Reasons:

1. Every binding the Bambu map changes is decided in one file,
   `Viewport`, at two spots: the OrbitControls button map
   (`Viewport:5068-5072`, `5172-5181`) and `handlePointerDown` /
   `finishDrag` (`Viewport:3989-4305`, `4433-4548`).
2. It touches no geometry module, no shape registration file and nothing in
   `test-prints/`, so it is not print-gated and cannot disturb the
   byte-identical preset exports.
3. No test pins the current bindings (section d), so no test files change
   to follow it.
4. No user-facing text names a mouse button (section d), so there is no
   trail of hints to chase.

It is standalone but not small: rows 1, 4 and 5 all rewrite the same
left-button decision, and row 1 needs the two layers re-ordered (row 1,
"what would have to change"). Rows 2 and 3 are one line and nothing.

### Files it would touch

| File | Why | Needed? |
|---|---|---|
| `apps/web/src/components/WorkplaneViewport.tsx` | All six rows | Yes |
| `apps/web/src/app/globals.css` | The cursor over the canvas (`CSS:4143-4153`), if it should change with what the left button will do | Optional |
| `README.md` | Has no controls section (`README.md:49-51`); one could be added | Optional |
| A new test file under `tests/unit/` | Only if the left-button decision is first pulled out into a plain function the `node` suite can call | Optional |
| `apps/web/src/components/workplane/TransformOverlay.tsx` | Forwards middle and right as they are (`Overlay:84-90`) | No |
| `apps/web/src/components/SketchForgeEditor.tsx` | `selectShape` needs a new mode only if Ctrl + click is add-only (`Editor:8712-8726`) | Only on that decision |
| `apps/web/src/components/SketchWorkspace.tsx` | Only if the 2D sketch view should follow the same map (`Sketch:552-570`) | Only on that decision |

---

## Open questions

1. **Spin over a part.** Under the Bambu map the view cannot be spun with
   the mouse while a part fills the viewport (collision 11). Is that
   accepted, or is a second spin binding kept?
2. **Ctrl + left-drag.** It is the only left-button camera drag
   (collision 4). Is it given up?
3. **Ctrl, Cmd, or both** for add-to-selection. The Mac is the owner's
   browser machine (`reference/DECISIONS.md:20`).
4. **Ctrl + click: add only, or toggle?** Today's Shift + click toggles.
5. **Shift box: add or replace?** Today's Shift box adds.
6. **Shift + click toggle:** kept alongside Ctrl + click, or removed?
7. **May a Shift box start over a part?** Today it cannot (collision 5).
8. **The near-a-part fallback** (collision 8): kept, narrowed or removed?
9. **Align and Mirror:** should left-drag on empty space spin the view
   while they are active?
10. **The modifier swaps** OrbitControls adds (collision 7): left in, or
    switched off so only the six rows exist?
11. **The 2D sketch view:** should it follow the same map?
12. **Touch:** in scope or not?
13. **SWEEP / STANDALONE:** is this report's reading of the two words the
    intended one?

## What this report is least sure of

1. **Ctrl / Cmd + left-drag spins rather than slides.** This rests on two
   things: that the capture-phase listener (`Viewport:5186`) runs before
   OrbitControls' own pointerdown listener on the same element, which is
   how current browsers order listeners on a target, and that OrbitControls
   then swaps PAN to ROTATE under Ctrl (`Orbit:1699-1708`). The code
   assigns `THREE.MOUSE.PAN` (`Viewport:5173`), which reads as if slide was
   intended. One drag in the running app settles it.
2. **Touch** (section b). Two layers receive the same finger and the
   outcome depends on which branch the selection layer takes.
3. **Bambu Studio itself was not examined.** The comparison uses the six
   rows the brief gave and nothing else; anything Bambu does beyond them
   (what its Shift box does to the selection, whether its zoom follows the
   pointer, its Mac keys) is an open question above, not a finding.
4. **The wheel direction** is stated for an operating system with standard
   scrolling.
5. **Hidden parts and the near-a-part fallback.** The fallback loop skips
   image plates but has no test for hidden parts (`Viewport:3870-3871`).
   Whether hidden parts ever reach it was not traced.

---

## Answers — 2026-09-28

Appended after the owner and foreman answered the open questions above.
Nothing above this line was changed. The numbers are the open questions'
numbers.

1. Plain left-drag over a part grabs it, as in Bambu; Ctrl/Cmd + left-drag
   and Shift + right-drag still move the camera from anywhere.
2. Ctrl/Cmd + left-drag is kept (owner chose the movement only, 1a).
3. Does not apply: add-to-selection stays Shift + click (1a).
4. Does not apply: add-to-selection stays Shift + click (1a).
5. The Shift box adds, as today.
6. Shift + click toggle is kept.
7. The Shift box starts only on empty space, as today.
8. The near-a-part fallback is removed for selecting and grabbing (owner,
   2a).
9. Align and Mirror: left-drag on empty space spins.
10. The modifier swaps stay on.
11. The 2D sketch view is unchanged.
12. Touch is unchanged and not in scope.
13. SWEEP: independent, additive, clear of do-not-touch paths. STANDALONE:
    touches do-not-touch or fragile paths or deploys, or is plainly hard.
    This change was STANDALONE and got its own pass.

### Builder's notes on the answers, 2026-09-28

- Answer 8 and answer 12 meet in one place. The fallback was reached by
  touch through the same code as the mouse. It is removed for the mouse and
  left in place for touch, so that touch stays exactly as it was.
- "Least sure" item 1 is settled. Checked live before any edit:
  Ctrl + left-drag and Cmd + left-drag both **spin** the view, from empty
  space and from over a part. The trace was right.
- One line of section b was wrong. It says the camera is unchanged in every
  mode. Checked live, in Ruler add mode a right-drag does not move the
  camera: the pending measurement point follows the pointer and takes the
  press before the canvas sees it. This was so before the change and is so
  after it.

The build is in `reference/reports/viewport-mouse-controls-build.md`.
