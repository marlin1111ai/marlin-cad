# Viewport mouse controls — build

Date: 2026-09-28. Built on top of `020c8f0`. Follows
`reference/reports/viewport-mouse-controls-recon.md`, whose question and
collision numbers are used here.

`Viewport` below is `apps/web/src/components/WorkplaneViewport.tsx`. Line
numbers are as of this commit.

---

## 1. Result

The 3D viewport now moves the way the brief describes. Every input in the
brief's verify list was run live, before and after the change, and each one
did what the brief says it should.

| Input | Before | After |
|---|---|---|
| Left-drag on empty space | Drew a selection box | Spins; selection unchanged |
| Right-drag | Spun | Slides |
| Middle-drag | Slid | Slides |
| Wheel | Zoomed toward the pointer | Same |
| Shift + left-drag on empty space | Box, adds to the selection | Same |
| Left-click on empty space | Cleared the selection | Same |
| Left-drag on a part | Moved it | Same |
| Shift + click on a part | Toggled it | Same |
| Left-drag on a handle | Resized | Same |
| Left-drag just outside a small part | Grabbed and moved the part | Spins; the part stays |
| Ctrl / Cmd + left-drag over a part | Spun | Same |
| Shift + right-drag over a part | Slid | Spins |
| Align: left-drag on empty space | Drew a box, emptied the selection, ended Align | Spins; selection and Align kept |
| Align: click a selected part | Set the anchor | Same |
| Mirror: left-drag on empty space | Drew a box, emptied the selection | Spins; selection kept |
| Chamfer / Fillet, Ruler, Place workplane | Left button did the tool's job | Same |
| 2D sketch view | Middle-drag slid, wheel zoomed | Same |
| Touch, one finger | Box on empty space; near-a-part grab | Same |
| Right-click menu | Suppressed | Same |

739 tests pass across 58 files; typecheck is clean (section 6).

## 2. Step a — what Ctrl / Cmd + left-drag does today

Checked live on `020c8f0`, before any edit.

**It spins the view.** Ctrl + left-drag and Cmd + left-drag both spin, from
empty space and from over a part. The selection and the parts are untouched.
The recon's trace (its "least sure" item 1) was right: the app assigns PAN
and OrbitControls turns it into a spin while Ctrl or Cmd is held.

| Input | Camera before | Camera after | Target | Result |
|---|---|---|---|---|
| Ctrl + left-drag from empty space, (300,650) → (450,600) | (118, 96, 118) | (5.813, 51.479, 185.419) | (0, 0, 0) → (0, 0, 0) | Spin |
| Ctrl + left-drag from over Big, (700,420) → (850,370) | (118, 96, 118) | (5.498, 51.373, 185.458) | (0, 0, 0) → (0, 0, 0) | Spin |
| Cmd + left-drag from empty space | (118, 96, 118) | (5.207, 51.276, 185.493) | (0, 0, 0) → (0, 0, 0) | Spin |
| Cmd + left-drag from over Big | (118, 96, 118) | (6.528, 51.718, 185.329) | (0, 0, 0) → (0, 0, 0) | Spin |

The distance from camera to target stayed 192.52 in all four, and the target
did not move: that is a spin, not a slide. So step c keeps it spinning.

## 3. What changed, with file:line

One code file. Six deleted lines, 94 added.

| Where | What |
|---|---|
| `Viewport:284` | New field on the scene state: the function the canvas asks what a plain left press should do |
| `Viewport:348-353` | New type for a left press that began on empty space |
| `Viewport:2352-2353` | Two new refs: the empty-space press, and the function above |
| `Viewport:2823` | The scene is given that function when it is created |
| `Viewport:3856-3858` | `pickShape` takes a third argument, off by default, that allows the near-a-part fallback |
| `Viewport:3880-3882` | Without that argument, a ray that misses every part returns nothing. The fallback below it is reached by touch only |
| `Viewport:4005-4028` | New `resolveLeftButtonCameraAction`. A plain left press spins only when it is not touch, Shift is not held, no tool owns the left button (Chamfer / Fillet, the three Ruler modes, Place workplane), and neither a handle nor a part is under the pointer |
| `Viewport:4030-4032` | Keeps the ref pointing at that function |
| `Viewport:4040` | Every new press forgets the last empty-space press |
| `Viewport:4219-4220` | The pick is a direct hit for the mouse, and allows the fallback for touch |
| `Viewport:4223-4234` | A plain mouse press on empty space no longer starts a box. It is remembered, and the camera has it. Shift, or touch, still starts the box below |
| `Viewport:4429-4436` | While that press is held, note whether it moved more than 5px, the same threshold the box uses |
| `Viewport:4568-4575` | On release: if it never moved, clear the selection. If it moved, do nothing |
| `Viewport:5148` | Right button: slide, at start-up |
| `Viewport:5243` | The new field's starting value |
| `Viewport:5250-5259` | New `leftButtonCameraAction`. Ctrl or Cmd: exactly the old rule. Otherwise ask the function above |
| `Viewport:5261` | The button map uses it on every press |
| `Viewport:5263`, `5268` | Right button: slide, on every press and on every release |

### How the two layers were put in order

The recon named this the hard part (row 1). The camera decides what a button
does on the canvas, before the selection layer runs, and the hook that runs
first could not see what was under the pointer. The scene state now carries
one function the component fills in, so the hook can ask. The selection
layer then makes the same tests in the same order with the same pick
functions, so the two cannot disagree about one press.

### The near-a-part fallback: what else it served

`pickShape` has one caller, `handlePointerDown` (`Viewport:4220`). Through
it the fallback served:

- selecting a part, and grabbing it to move — removed for the mouse;
- Align's click on a selected part (`Viewport:4256-4260`) — the same pick,
  so it now needs a direct hit too;
- **touch input** — left unchanged. One finger reaches the same code, and
  the brief rules that touch stays exactly as it works today.

Nothing else used it.

### Judgement calls

1. **Touch keeps the fallback and the plain-drag box.** Step b says to
   remove the fallback; step c says touch input stays exactly as it works
   today. Both hold if the change applies to the mouse and pen only. See
   open question 1.
2. **Alt + left-drag on empty space now spins.** The old code did not look
   at Alt, so Alt + left-drag drew a box like a plain drag. It still behaves
   like a plain drag.
3. **Ctrl / Cmd + left-drag still spins inside the tool modes**, as it did
   before. The brief says the left button never moves the camera in those
   modes, and also that Ctrl / Cmd + left-drag does what step a found "from
   anywhere". The old rule was left exactly as it was. See open question 2.
4. **A cancelled press counts as a release.** A box that was cancelled
   before it moved cleared the selection; an empty-space press does the
   same.

## 4. How it was checked

- Google Chrome 154.0.8037.57, headless, 1400 × 900, software WebGL
  (SwiftShader), against `npm run dev` on port 3000. Nothing was installed:
  Chrome was driven over its DevTools port with Node 22's built-in
  `WebSocket`.
- **No physical mouse was used.** The dev box has no display. Every press,
  move, release, wheel step and key went in through Chrome's own input
  pipeline (`Input.dispatchMouseEvent`, `Input.dispatchKeyEvent`,
  `Input.dispatchTouchEvent`). The page saw them as real input: each
  pointerdown reported `isTrusted: true`, `pointerType: "mouse"`, and the
  button and keys sent. A drag was a press, twelve moves and a release.
- Camera position, camera target, selection and part positions were read
  from the running page, from the viewport's own state.
- The scene was three boxes: Big 30 × 30 × 20 at (0, 0), Mid 20 × 20 × 20 at
  (-60, 20), Small 6 × 6 × 6 at (50, -40). The scene, the camera and the
  selection were put back to the same start before every input, through the
  app's own MCP bridge and by setting the camera directly. That is set-up,
  not an input under test.
- "Before" is `020c8f0`. "After" is this commit. The same scripts ran on
  both.
- A spin is: the camera moved, the target did not, the distance is the same.
  A slide is: camera and target moved together. A zoom is: the distance
  changed.
- Input 13a (the F key) is labelled by the jump back to the home view. The
  view was first moved with a right-drag, which spun before and slides
  now, so the jump back reads as a spin before and a slide after. In both
  the camera lands near the home view, (118, 96, 118), not exactly on it:
  (116.484, 95.127, 120.193) before the change and (117.694, 95.85,
  118.428) after. The drag before the key press was still easing to a
  stop. That drift was there before the change.
- Numbers differ by a few hundredths between two runs of the same drag. The
  camera eases to a stop, and the moves are timed by the clock.

The point "just outside Small's outline" is (1052, 503). A ray through it
hits no part; it is 11px below Small's outline and 37px from Small's centre,
inside the old 48px fallback radius.

## 5. Evidence — every input, before and after

Coordinates are screen pixels. Camera and target are world coordinates in
mm. Selection lists part names.

### 1. left-drag on empty space (Big selected beforehand)

Input: left button (300,650) -> (450,600)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → []; no part moved.
- Changed code: **SPIN**. Camera (118, 96, 118) → (6.278, 51.634, 185.36); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved.

### 2a. right-drag on empty space

Input: right button (300,650) -> (450,600)

- Today's code (before the change): **SPIN**. Camera (118, 96, 118) → (7.849, 52.16, 185.153); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved.
- Changed code: **SLIDE**. Camera (118, 96, 118) → (107.59, 90.898, 132.56); target (0, 0, 0) → (-10.41, -5.102, 14.56); selection ["Big"] → ["Big"]; no part moved.

### 2b. right-drag started over the part Mid

Input: right button (410,385) -> (560,420)

- Today's code (before the change): **SPIN**. Camera (118, 96, 118) → (9.119, 122.687, 148.084); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved.
- Changed code: **SLIDE**. Camera (118, 96, 118) → (104.172, 99.543, 128.946); target (0, 0, 0) → (-13.828, 3.543, 10.946); selection ["Big"] → ["Big"]; no part moved.

### 2c. middle-drag on empty space

Input: middle button (300,650) -> (450,600)

- Today's code (before the change): **SLIDE**. Camera (118, 96, 118) → (107.623, 90.915, 132.514); target (0, 0, 0) → (-10.377, -5.085, 14.514); selection ["Big"] → ["Big"]; no part moved.
- Changed code: **SLIDE**. Camera (118, 96, 118) → (107.637, 90.921, 132.495); target (0, 0, 0) → (-10.363, -5.079, 14.495); selection ["Big"] → ["Big"]; no part moved.

### 3a. wheel rolled away from you, pointer over Small

Input: wheel deltaY -240 at (1052,466)

- Today's code (before the change): **ZOOM IN**. Camera (118, 96, 118) → (112.243, 88.125, 104.635); target (0, 0, 0) → (4.385, 0.376, -3.223); selection [] → []; no part moved. Extra: `{"Big":[700,413],"Mid":[427,351],"Small":[1052,466]}` → `{"Big":[668,408],"Mid":[377,341],"Small":[1052,466]}`.
- Changed code: **ZOOM IN**. Camera (118, 96, 118) → (112.243, 88.125, 104.635); target (0, 0, 0) → (4.385, 0.376, -3.223); selection [] → []; no part moved. Extra: `{"Big":[700,413],"Mid":[427,351],"Small":[1052,466]}` → `{"Big":[668,408],"Mid":[377,341],"Small":[1052,466]}`.

### 3b. wheel rolled toward you, pointer over Small

Input: wheel deltaY +240 at (1052,466)

- Today's code (before the change): **ZOOM OUT**. Camera (118, 96, 118) → (124.298, 104.616, 132.622); target (0, 0, 0) → (-4.797, -0.411, 3.527); selection [] → []; no part moved. Extra: `{"Big":[700,413],"Mid":[427,351],"Small":[1052,466]}` → `{"Big":[729,418],"Mid":[474,359],"Small":[1052,466]}`.
- Changed code: **ZOOM OUT**. Camera (118, 96, 118) → (124.298, 104.616, 132.622); target (0, 0, 0) → (-4.797, -0.411, 3.527); selection [] → []; no part moved. Extra: `{"Big":[700,413],"Mid":[427,351],"Small":[1052,466]}` → `{"Big":[729,418],"Mid":[474,359],"Small":[1052,466]}`.

### 4a. Shift + left-drag on empty space, box over Mid (Big selected beforehand)

Input: Shift held, left button (330,230) -> (540,450)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big","Mid"]; no part moved.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big","Mid"]; no part moved.

### 4b. plain left-drag on empty space over the same box (Big selected beforehand)

Input: left button (330,230) -> (540,450)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Mid"]; no part moved.
- Changed code: **SPIN**. Camera (118, 96, 118) → (-2.818, 192.174, 11.195); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved.

### 5. left-click on empty space (Big and Mid selected beforehand)

Input: left click (300,650)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big","Mid"] → []; no part moved.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big","Mid"] → []; no part moved.

### 6a. left-drag on the part Big (nothing selected beforehand)

Input: left button (700,440) -> (820,500)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → ["Big"]; Big x,z (0, 0) → (31, 1).
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → ["Big"]; Big x,z (0, 0) → (31, 1).

### 6b. left-click on the part Mid

Input: left click (410,385)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → ["Mid"]; no part moved.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → ["Mid"]; no part moved.

### 7a. Shift + click on Mid (Big selected beforehand)

Input: Shift held, left click (410,385)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big","Mid"]; no part moved.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big","Mid"]; no part moved.

### 7b. Shift + click on Mid again

Input: Shift held, left click (410,385)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big","Mid"] → ["Big"]; no part moved.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big","Mid"] → ["Big"]; no part moved.

### 8. left-drag on a corner resize handle of Big

Input: left button on handle (813,461) -> (873,486)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; Big x,z (0, 0) → (6.5, -0.5), size 30×30 → 43×31.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; Big x,z (0, 0) → (6.5, -0.5), size 30×30 → 43×31.

### 9. left-drag starting just outside Small's outline

Input: left button (1052,503) -> (1150,470); ray at start hits: null

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → ["Small"]; Small x,z (50, -40) → (57, -63).
- Changed code: **SPIN**. Camera (118, 96, 118) → (52.433, 67.257, 172.601); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved.

### 9b. left-click just outside Small's outline

Input: left click (1052,503)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → ["Small"]; no part moved.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved.

### 10a. Ctrl + left-drag started over Big

Input: Ctrl held, left button (700,440) -> (820,500)

- Today's code (before the change): **SPIN**. Camera (118, 96, 118) → (24.95, 140.662, 129.057); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved.
- Changed code: **SPIN**. Camera (118, 96, 118) → (24.137, 141.038, 128.801); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved.

### 10b. Cmd + left-drag started over Big

Input: Cmd held, left button (700,440) -> (820,500)

- Today's code (before the change): **SPIN**. Camera (118, 96, 118) → (24.933, 140.67, 129.051); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved.
- Changed code: **SPIN**. Camera (118, 96, 118) → (24.385, 140.923, 128.88); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved.

### 10c. Shift + right-drag started over Big

Input: Shift held, right button (700,440) -> (820,500)

- Today's code (before the change): **SLIDE**. Camera (118, 96, 118) → (105.342, 102.21, 125.606); target (0, 0, 0) → (-12.658, 6.21, 7.606); selection [] → []; no part moved.
- Changed code: **SPIN**. Camera (118, 96, 118) → (24.79, 140.736, 129.007); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved.

### 10d. Shift + middle-drag started over Big

Input: Shift held, middle button (700,440) -> (820,500)

- Today's code (before the change): **SPIN**. Camera (118, 96, 118) → (24.137, 141.038, 128.801); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved.
- Changed code: **SPIN**. Camera (118, 96, 118) → (23.908, 141.143, 128.728); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved.

### 11a. Align on: left-click on the selected part Mid

Input: left click (410,385)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big","Mid"] → ["Big","Mid"]; no part moved. Extra: `{"alignMode":true,"anchor":null}` → `{"alignMode":true,"anchor":"Mid"}`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big","Mid"] → ["Big","Mid"]; no part moved. Extra: `{"alignMode":true,"anchor":null}` → `{"alignMode":true,"anchor":"Mid"}`.

### 11b. Align on: left-drag on empty space

Input: left button (300,650) -> (450,600)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big","Mid"] → []; no part moved. Extra: `{"alignMode":true,"anchor":"Mid"}` → `{"alignMode":false,"anchor":null}`.
- Changed code: **SPIN**. Camera (118, 96, 118) → (6.536, 51.72, 185.328); target (0, 0, 0) → (0, 0, 0); selection ["Big","Mid"] → ["Big","Mid"]; no part moved. Extra: `{"alignMode":true,"anchor":"Mid"}` → `{"alignMode":true,"anchor":"Mid"}`.

### 12. Mirror on: left-drag on empty space

Input: left button (300,650) -> (450,600)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → []; no part moved.
- Changed code: **SPIN**. Camera (118, 96, 118) → (14.218, 54.299, 184.156); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved.

### 13a. F key after the view was moved

Input: key F

- Today's code (before the change): **SPIN**. Camera (5.601, 51.408, 185.445) → (116.268, 95.005, 120.498); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved.
- Changed code: **SLIDE**. Camera (107.526, 90.867, 132.651) → (117.694, 95.85, 118.428); target (-10.474, -5.133, 14.651) → (-0.306, -0.15, 0.428); selection [] → []; no part moved.

### 13b. + key

Input: key +

- Today's code (before the change): **ZOOM IN**. Camera (116.268, 95.005, 120.498) → (83.564, 68.319, 86.969); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved.
- Changed code: **ZOOM IN**. Camera (117.694, 95.85, 118.428) → (84.627, 68.957, 85.426); target (-0.306, -0.15, 0.428) → (-0.333, -0.163, 0.466); selection [] → []; no part moved.

### 13c. - key

Input: key -

- Today's code (before the change): **ZOOM OUT**. Camera (83.564, 68.319, 86.969) → (106.944, 87.438, 111.345); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved.
- Changed code: **ZOOM OUT**. Camera (84.627, 68.957, 85.426) → (108.413, 88.309, 109.218); target (-0.333, -0.163, 0.466) → (-0.336, -0.165, 0.47); selection [] → []; no part moved.

### 13d. O key

Input: key O

- Today's code (before the change): **camera still**. Camera (106.944, 87.438, 111.345) → (106.943, 87.438, 111.346); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `PerspectiveCamera` → `OrthographicCamera`.
- Changed code: **camera still**. Camera (108.413, 88.309, 109.218) → (108.413, 88.309, 109.218); target (-0.336, -0.165, 0.47) → (-0.336, -0.165, 0.47); selection [] → []; no part moved. Extra: `PerspectiveCamera` → `OrthographicCamera`.

### 13e. O key again

Input: key O

- Today's code (before the change): **camera still**. Camera (106.943, 87.438, 111.346) → (106.943, 87.438, 111.346); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `OrthographicCamera` → `PerspectiveCamera`.
- Changed code: **camera still**. Camera (108.413, 88.309, 109.218) → (108.413, 88.309, 109.218); target (-0.336, -0.165, 0.47) → (-0.336, -0.165, 0.47); selection [] → []; no part moved. Extra: `OrthographicCamera` → `PerspectiveCamera`.

### 13f. ArrowRight with Big selected

Input: key ArrowRight

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; Big x,z (0, 0) → (1, 0).
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; Big x,z (0, 0) → (1, 0).

### 14 Fillet: left-drag on empty space

Input: left button (300,650) -> (450,600)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `0 of 12 sharp edges selected` → `0 of 12 sharp edges selected`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `0 of 12 sharp edges selected` → `0 of 12 sharp edges selected`.

### 14 Fillet: left-click on Big's front vertical edge

Input: left click (700,470)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `0 of 12 sharp edges selected` → `1 of 12 sharp edges selected`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `0 of 12 sharp edges selected` → `1 of 12 sharp edges selected`.

### 14 Fillet: left-drag started on the part Mid

Input: left button (410,385) -> (520,430)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `1 of 12 sharp edges selected` → `1 of 12 sharp edges selected`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `1 of 12 sharp edges selected` → `1 of 12 sharp edges selected`.

### 14 Fillet: right-drag on empty space

Input: right button (300,650) -> (450,600)

- Today's code (before the change): **SPIN**. Camera (118, 96, 118) → (5.992, 51.538, 185.397); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `1 of 12 sharp edges selected` → `1 of 12 sharp edges selected`.
- Changed code: **SLIDE**. Camera (118, 96, 118) → (107.633, 90.92, 132.5); target (0, 0, 0) → (-10.367, -5.08, 14.5); selection ["Big"] → ["Big"]; no part moved. Extra: `1 of 12 sharp edges selected` → `1 of 12 sharp edges selected`.

### 14 Chamfer: left-drag on empty space

Input: left button (300,650) -> (450,600)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `0 of 12 sharp edges selected` → `0 of 12 sharp edges selected`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `0 of 12 sharp edges selected` → `0 of 12 sharp edges selected`.

### 14 Chamfer: left-click on Big's front vertical edge

Input: left click (700,470)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `0 of 12 sharp edges selected` → `1 of 12 sharp edges selected`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `0 of 12 sharp edges selected` → `1 of 12 sharp edges selected`.

### 14 Chamfer: left-drag started on the part Mid

Input: left button (410,385) -> (520,430)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `1 of 12 sharp edges selected` → `1 of 12 sharp edges selected`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `1 of 12 sharp edges selected` → `1 of 12 sharp edges selected`.

### 14 Chamfer: right-drag on empty space

Input: right button (300,650) -> (450,600)

- Today's code (before the change): **SPIN**. Camera (118, 96, 118) → (6.824, 51.817, 185.29); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `1 of 12 sharp edges selected` → `1 of 12 sharp edges selected`.
- Changed code: **SLIDE**. Camera (118, 96, 118) → (107.672, 90.939, 132.446); target (0, 0, 0) → (-10.328, -5.061, 14.446); selection ["Big"] → ["Big"]; no part moved. Extra: `1 of 12 sharp edges selected` → `1 of 12 sharp edges selected`.

### 15a Ruler add: left-click on Big's top face

Input: left click (700,380)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-mode","points":0,"segments":0}` → `{"mode":"workplane-wrap ruler-mode","points":1,"segments":0}`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-mode","points":0,"segments":0}` → `{"mode":"workplane-wrap ruler-mode","points":1,"segments":0}`.

### 15b Ruler add: left-click on Mid's top face

Input: left click (420,310)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-mode","points":1,"segments":0}` → `{"mode":"workplane-wrap ruler-mode","points":2,"segments":1}`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-mode","points":1,"segments":0}` → `{"mode":"workplane-wrap ruler-mode","points":2,"segments":1}`.

### 15c Ruler add: left-drag on empty space

Input: left button (300,650) -> (450,600)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-mode","points":2,"segments":1}` → `{"mode":"workplane-wrap ruler-mode","points":3,"segments":1}`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-mode","points":2,"segments":1}` → `{"mode":"workplane-wrap ruler-mode","points":3,"segments":1}`.

### 15d Ruler add: right-drag on empty space

Input: right button (300,650) -> (450,600)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-mode","points":3,"segments":1}` → `{"mode":"workplane-wrap ruler-mode","points":3,"segments":1}`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-mode","points":3,"segments":1}` → `{"mode":"workplane-wrap ruler-mode","points":3,"segments":1}`.

### 15e Ruler move: left-drag on empty space

Input: left button (300,650) -> (450,600)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-move-mode","points":3,"segments":1}` → `{"mode":"workplane-wrap ruler-move-mode","points":3,"segments":1}`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-move-mode","points":3,"segments":1}` → `{"mode":"workplane-wrap ruler-move-mode","points":3,"segments":1}`.

### 15f Ruler move: left-drag started on the part Big

Input: left button (700,440) -> (820,500)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-move-mode","points":3,"segments":1}` → `{"mode":"workplane-wrap ruler-move-mode","points":3,"segments":1}`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-move-mode","points":3,"segments":1}` → `{"mode":"workplane-wrap ruler-move-mode","points":3,"segments":1}`.

### 15g Ruler delete: left-drag on empty space

Input: left button (300,650) -> (450,600)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-delete-mode","points":3,"segments":1}` → `{"mode":"workplane-wrap ruler-delete-mode","points":3,"segments":1}`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-delete-mode","points":3,"segments":1}` → `{"mode":"workplane-wrap ruler-delete-mode","points":3,"segments":1}`.

### 15h Ruler delete: left-click on a ruler point

Input: left click (700,380)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-delete-mode","points":3,"segments":1}` → `{"mode":"workplane-wrap ruler-delete-mode","points":2,"segments":0}`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"mode":"workplane-wrap ruler-delete-mode","points":3,"segments":1}` → `{"mode":"workplane-wrap ruler-delete-mode","points":2,"segments":0}`.

### 16a Place workplane: left-drag on empty space

Input: left button (300,650) -> (450,600)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"workplaneMode":true,"origin":{"x":0,"y":0,"z":0},"normal":{"x":0,"y":1,"z":0}}` → `{"workplaneMode":false,"origin":{"x":0,"y":0,"z":0},"normal":{"x":0,"y":1,"z":0}}`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"workplaneMode":true,"origin":{"x":0,"y":0,"z":0},"normal":{"x":0,"y":1,"z":0}}` → `{"workplaneMode":false,"origin":{"x":0,"y":0,"z":0},"normal":{"x":0,"y":1,"z":0}}`.

### 16b Place workplane: left-click on Big's right side face

Input: left click (760,450)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"workplaneMode":true,"origin":{"x":0,"y":0,"z":0},"normal":{"x":0,"y":1,"z":0}}` → `{"workplaneMode":false,"origin":{"x":15,"y":8,"z":0},"normal":{"x":1,"y":0,"z":0}}`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"workplaneMode":true,"origin":{"x":0,"y":0,"z":0},"normal":{"x":0,"y":1,"z":0}}` → `{"workplaneMode":false,"origin":{"x":15,"y":8,"z":0},"normal":{"x":1,"y":0,"z":0}}`.

### 16c Place workplane: left-click on empty grid (back to the base)

Input: left click (300,650)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"workplaneMode":true,"origin":{"x":15,"y":8,"z":0},"normal":{"x":1,"y":0,"z":0}}` → `{"workplaneMode":false,"origin":{"x":0,"y":0,"z":0},"normal":{"x":0,"y":1,"z":0}}`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → []; no part moved. Extra: `{"workplaneMode":true,"origin":{"x":15,"y":8,"z":0},"normal":{"x":1,"y":0,"z":0}}` → `{"workplaneMode":false,"origin":{"x":0,"y":0,"z":0},"normal":{"x":0,"y":1,"z":0}}`.

### 17a Sketch: middle-drag

Input: middle button (700,500) -> (800,540)

- Today's code (before the change): `{"sketch":"not mounted","viewport3dMounted":true}` → `{"sketch":"not mounted","viewport3dMounted":true}`
- Changed code: `{"viewBox":"-100 -100 200 200","viewport3dMounted":false}` → `{"viewBox":"-130.8166409861325 -112.32665639445301 200 200","viewport3dMounted":false}`

### 17b Sketch: wheel rolled away from you

Input: wheel deltaY -240 at (700,500)

- Today's code (before the change): `{"sketch":"not mounted","viewport3dMounted":true}` → `{"sketch":"not mounted","viewport3dMounted":true}`
- Changed code: `{"viewBox":"-130.8166409861325 -112.32665639445301 200 200","viewport3dMounted":false}` → `{"viewBox":"-118.53593923174655 -100.04595464006704 175.43859649122808 175.43859649122808","viewport3dMounted":false}`

### 17c Sketch: wheel rolled toward you

Input: wheel deltaY +240 at (700,500)

- Today's code (before the change): `{"sketch":"not mounted","viewport3dMounted":true}` → `{"sketch":"not mounted","viewport3dMounted":true}`
- Changed code: `{"viewBox":"-118.53593923174655 -100.04595464006704 175.43859649122808 175.43859649122808","viewport3dMounted":false}` → `{"viewBox":"-130.49766171978484 -112.00767712810534 199.36204146730466 199.36204146730466","viewport3dMounted":false}`

### 17d Sketch: right-drag

Input: right button (700,500) -> (800,540)

- Today's code (before the change): `{"sketch":"not mounted","viewport3dMounted":true}` → `{"sketch":"not mounted","viewport3dMounted":true}`
- Changed code: `{"viewBox":"-130.49766171978484 -112.00767712810534 199.36204146730466 199.36204146730466","viewport3dMounted":false}` → `{"viewBox":"-130.49766171978484 -112.00767712810534 199.36204146730466 199.36204146730466","viewport3dMounted":false}`

### T1. one-finger drag on empty space (Big selected beforehand)

Input: touch (300,650) -> (450,600)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → []; no part moved.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → []; no part moved.

### T2. one-finger drag on empty space, over Mid (Big selected beforehand)

Input: touch (330,230) -> (540,450)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Mid"]; no part moved.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Mid"]; no part moved.

### T3. one-finger drag on the part Big

Input: touch (700,440) -> (820,500)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → ["Big"]; Big x,z (0, 0) → (31, 1).
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → ["Big"]; Big x,z (0, 0) → (31, 1).

### T4. one-finger drag starting just outside Small's outline

Input: touch (1052,503) -> (1150,470)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → ["Small"]; Small x,z (50, -40) → (57, -63).
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection [] → ["Small"]; Small x,z (50, -40) → (57, -63).

### 18a. right-click (no drag) on empty space

Input: right click (300,650)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `[]` → `[{"target":"CANVAS","defaultPrevented":true,"isTrusted":true}]`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `[]` → `[{"target":"CANVAS","defaultPrevented":true,"isTrusted":true}]`.

### 18b. right-click (no drag) on the part Big

Input: right click (700,440)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `[{"target":"CANVAS","defaultPrevented":true,"isTrusted":true}]` → `[{"target":"CANVAS","defaultPrevented":true,"isTrusted":true},{"target":"CANVAS","defaultPrevented":true,"isTrusted":true}]`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `[{"target":"CANVAS","defaultPrevented":true,"isTrusted":true}]` → `[{"target":"CANVAS","defaultPrevented":true,"isTrusted":true},{"target":"CANVAS","defaultPrevented":true,"isTrusted":true}]`.

### 19. Alt + left-drag on empty space (Big selected beforehand)

Input: Alt held, left button (300,650) -> (450,600)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → []; no part moved.
- Changed code: **SPIN**. Camera (118, 96, 118) → (7.371, 52, 185.218); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved.

### 20. Shift + left-drag started on the part Mid (Big selected beforehand)

Input: Shift held, left button (410,385) -> (520,430)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big","Mid"]; no part moved.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big","Mid"]; no part moved.

### 21. Shift + left-click on empty space (Big selected beforehand)

Input: Shift held, left click (300,650)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved.

### 22. Orthographic view: left-drag on empty space (Big selected beforehand)

Input: left button (300,650) -> (450,600)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → []; no part moved. Extra: `OrthographicCamera` → `OrthographicCamera`.
- Changed code: **SPIN**. Camera (118, 96, 118) → (7.283, 51.971, 185.23); target (0, 0, 0) → (0, 0, 0); selection ["Big"] → ["Big"]; no part moved. Extra: `OrthographicCamera` → `OrthographicCamera`.

### 23. Align on: left-click (no drag) on empty space

Input: left click (300,650)

- Today's code (before the change): **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big","Mid"] → []; no part moved. Extra: `true` → `true`.
- Changed code: **camera still**. Camera (118, 96, 118) → (118, 96, 118); target (0, 0, 0) → (0, 0, 0); selection ["Big","Mid"] → []; no part moved. Extra: `true` → `true`.

## 6. Tests and typecheck

`npm test`: **739 passed, 0 failed, across 58 files.** Counted from the
runner's per-test output, one line per test, tallied per file:

| Tests passed | Failed | File |
|---|---|---|
| 2 | 0 | `tests/unit/appTheme.test.ts` |
| 3 | 0 | `tests/unit/appUpdates.test.ts` |
| 2 | 0 | `tests/unit/cadModifierGroups.test.ts` |
| 8 | 0 | `tests/unit/cadModifierRuntime.test.ts` |
| 2 | 0 | `tests/unit/challenges.test.ts` |
| 1 | 0 | `tests/unit/csgPreview.test.ts` |
| 4 | 0 | `tests/unit/edgeTreatmentHistory.test.ts` |
| 10 | 0 | `tests/unit/editorHistory.test.ts` |
| 3 | 0 | `tests/unit/exportNames.test.ts` |
| 5 | 0 | `tests/unit/gearGeometry.test.ts` |
| 39 | 0 | `tests/unit/gridfinityFootGeometry.test.ts` |
| 64 | 0 | `tests/unit/gridfinitySocketTrayGeometry.test.ts` |
| 12 | 0 | `tests/unit/gridfinitySocketTrayShapeRegistration.test.ts` |
| 2 | 0 | `tests/unit/gridSnap.test.ts` |
| 2 | 0 | `tests/unit/importExtensions.test.ts` |
| 49 | 0 | `tests/unit/labelSlabGeometry.test.ts` |
| 1 | 0 | `tests/unit/meshCoordinates.test.ts` |
| 59 | 0 | `tests/unit/mountedScrewdriverTrayGeometry.test.ts` |
| 13 | 0 | `tests/unit/mountedScrewdriverTrayShapeRegistration.test.ts` |
| 57 | 0 | `tests/unit/mountedSocketTrayGeometry.test.ts` |
| 13 | 0 | `tests/unit/mountedSocketTrayShapeRegistration.test.ts` |
| 4 | 0 | `tests/unit/moveDimensionLines.test.ts` |
| 53 | 0 | `tests/unit/multiconnectContainerGeometry.test.ts` |
| 8 | 0 | `tests/unit/multiconnectPresets.test.ts` |
| 6 | 0 | `tests/unit/multiconnectShapeRegistration.test.ts` |
| 8 | 0 | `tests/unit/multiconnectSlotMesh.test.ts` |
| 2 | 0 | `tests/unit/objExport.test.ts` |
| 5 | 0 | `tests/unit/objImport.test.ts` |
| 16 | 0 | `tests/unit/openConnectContainerGeometry.test.ts` |
| 11 | 0 | `tests/unit/openGridGeometry.test.ts` |
| 7 | 0 | `tests/unit/openGridSnapGeometry.test.ts` |
| 7 | 0 | `tests/unit/placementWorkplane.test.ts` |
| 10 | 0 | `tests/unit/projectAssets.test.ts` |
| 3 | 0 | `tests/unit/projectShapePersistence.test.ts` |
| 28 | 0 | `tests/unit/projectThumbnailOrigin.test.ts` |
| 6 | 0 | `tests/unit/regularPolygonFootprint.test.ts` |
| 50 | 0 | `tests/unit/screwdriverTrayGeometry.test.ts` |
| 9 | 0 | `tests/unit/screwdriverTrayShapeRegistration.test.ts` |
| 2 | 0 | `tests/unit/selectionOutlineReopen.test.ts` |
| 4 | 0 | `tests/unit/shapeCatalog.test.ts` |
| 4 | 0 | `tests/unit/sharedProjectsDelete.test.ts` |
| 8 | 0 | `tests/unit/sketchCadProfile.test.ts` |
| 3 | 0 | `tests/unit/sketchForgeEditorBake.test.ts` |
| 2 | 0 | `tests/unit/sketchPlacement.test.ts` |
| 5 | 0 | `tests/unit/sketchProfileValidation.test.ts` |
| 5 | 0 | `tests/unit/sketchRevolve.test.ts` |
| 16 | 0 | `tests/unit/skfProject.test.ts` |
| 36 | 0 | `tests/unit/socketTrayGeometry.test.ts` |
| 8 | 0 | `tests/unit/socketTrayShapeRegistration.test.ts` |
| 2 | 0 | `tests/unit/sphereTessellation.test.ts` |
| 10 | 0 | `tests/unit/stepExport.test.ts` |
| 1 | 0 | `tests/unit/stlExport.test.ts` |
| 3 | 0 | `tests/unit/stlImportOrientation.test.ts` |
| 2 | 0 | `tests/unit/svgExport.test.ts` |
| 16 | 0 | `tests/unit/svgImport.test.ts` |
| 7 | 0 | `tests/unit/workplaneGrid.test.ts` |
| 8 | 0 | `tests/unit/workplaneSettings.test.ts` |
| 13 | 0 | `tests/unit/workplaneShapes.test.ts` |
| **739** | **0** | **58 files** |

`npm run typecheck`: clean, exit 0, no output after the command line.

No test file was changed or added. No test pins a mouse binding (recon
section d), so the suite says nothing about this change either way; section
5 is the evidence for it.

## 7. Files touched

| File | Step |
|---|---|
| `apps/web/src/components/WorkplaneViewport.tsx` | b, c |
| `reference/DECISIONS.md` | d |
| `reference/SESSION-STATE.md` | d |
| `reference/reports/viewport-mouse-controls-recon.md` (appended only) | d |
| `reference/reports/viewport-mouse-controls-build.md` (new) | step 5 |

## 8. The dev server

`npm run dev` as it stands refuses the app's scripts to a browser on another
machine: `/_next/*` answered 403 to a request from `192.168.1.245`, and the
server logged "Blocked cross-origin request". `apps/web/next.config.ts`
reads extra allowed origins from `SKETCHFORGE_ALLOWED_DEV_ORIGINS`, so the
server left running for the hands-on test was started as
`SKETCHFORGE_ALLOWED_DEV_ORIGINS=192.168.1.245 npm run dev`. With it the
same request answered 200. No file was edited for this.

## 9. Open questions

1. **Touch.** The near-a-part fallback and the plain-drag box are still
   there for a finger. Should touch follow the mouse?
2. **Ctrl / Cmd + left-drag inside Chamfer / Fillet, Ruler and Place
   workplane** still spins the view, as before. Should the tools switch it
   off?
3. **Shift / Ctrl / Cmd + middle-drag spins**, as before. With Shift +
   right-drag now spinning too, there are four ways to spin. Is that
   wanted?
4. **The pointer over the canvas is still a grab hand**
   (`apps/web/src/app/globals.css:4143-4153`, do-not-touch in this pass).
   It now matches what a left-drag on empty space does, and does not change
   over a part.
5. **Nothing on screen tells the user the new controls.** The README has no
   controls section (recon section d).
6. **Ruler add mode: right-drag does not move the camera**, because the
   pending measurement point is under the pointer. Found live; it was so
   before this change. Middle-drag in that mode was not tried. Is it
   wanted?

## 10. Least sure of

1. **A real mouse on the owner's Mac.** Everything here went in through
   Chrome's input pipeline on Linux. A real mouse, a trackpad, macOS's
   Ctrl + click and Safari were not tried. That is what the hands-on test
   is for.
2. **Two-finger touch.** Only one finger was checked.
3. **Left-drag on empty space while a part's handles are showing.** The
   handles are small targets around the selected part; a press on one
   resizes. Checked with one part selected and the press well away from it,
   not with the press close to a handle.
4. **Very large scenes.** A plain left press now makes two extra ray casts
   before the camera moves. On the three-box scene it is not noticeable; it
   was not measured on a heavy one.
