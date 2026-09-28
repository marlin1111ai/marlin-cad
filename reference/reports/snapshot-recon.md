# Snapshot / project-thumbnail recon (read-only)

Date: 2026-09-09. Branch `main` at `6072323`. No file was edited; this
report is the only new file.

**Amended 2026-09-09** — section 5's explanation of *why* the LAN request
returns 403 was wrong and now carries a dated correction in place; the
original wording is preserved above it. Section 5 open question 2 is
marked RESOLVED. Everything else in this report stood up.

**Amended 2026-09-26** — section 6's "Traced but not confirmed" point
(whether the container's `node` user can create the thumbnail directory)
carries a dated confirmation in place: confirmed by owner observation of
thumbnails on the running `1.3.3` container, not by inspecting the image.

**Bottom line:** the snapshot pipeline is fully built and fully wired, but
it is entirely **automatic** — there is no button, menu item, or any other
UI control anywhere that captures a snapshot. The user cannot ask for one;
it happens on its own 850ms after the editor settles.

---

## 1. The "No snapshot yet" string

Exactly one occurrence in the repo:

```
apps/web/src/app/page.tsx:2099:          <span className="preview-empty-mark">No snapshot yet</span>
```

It is the fallback branch of `ProjectPreview`, shown whenever
`thumbnailUrl` is absent or the `<img>` failed to load
(`apps/web/src/app/page.tsx:2084-2103`).

### 1a. Every project-snapshot identifier, file and line

**The storage endpoint** — `apps/web/src/app/api/project-thumbnail/route.ts`
(whole file, 137 lines; `GET` / `POST` / `DELETE`):

```
:7   const THUMBNAIL_DIR = path.join(process.cwd(), ".codex", "project-thumbnails");
:9   const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
:10  const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
:11  const MAX_THUMBNAIL_REQUEST_BYTES = Math.ceil((MAX_THUMBNAIL_BYTES * 4) / 3) + PNG_DATA_URL_PREFIX.length + 2048;
:18  function thumbnailPath(projectId: string)   -> `${safeId}.png`
:26  function isLocalSameOriginRequest(request: Request)
:56  export async function GET(request: Request)
:78  export async function POST(request: Request)
:125 export async function DELETE(request: Request)
```

**The dashboard side** — `apps/web/src/app/page.tsx`:

```
:37   thumbnailUrl?: string | null;
:38   thumbnailVersion?: number;
:116  const STATIC_EXPORT_BUILD = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";
:400  thumbnailUrl: typeof project.thumbnailUrl === "string" ? project.thumbnailUrl : null,
:401  thumbnailVersion: typeof project.thumbnailVersion === "number" ? project.thumbnailVersion : undefined,
:436  thumbnailUrl: project.thumbnailUrl ?? storedProject.thumbnailUrl,
:437  thumbnailVersion: project.thumbnailVersion ?? storedProject.thumbnailVersion,
:456  thumbnailUrl: project.thumbnailUrl ?? null,
:457  thumbnailVersion: project.thumbnailVersion,
:784  const updateProjectSnapshot = useCallback((snapshot: { image: string; projectId: string; shapes: number }) => {
:786    if (STATIC_EXPORT_BUILD) {          <- data URL kept in memory/localStorage, no HTTP
:790      ... thumbnailUrl: snapshot.image, thumbnailVersion: version ...
:800    void fetch("/api/project-thumbnail", { method: "POST", ... })
:808      const thumbnailUrl = `/api/project-thumbnail?projectId=${encodeURIComponent(snapshot.projectId)}&v=${nextVersion}`;
:1168   void fetch(`/api/project-thumbnail?projectId=${encodeURIComponent(projectId)}`, { method: "DELETE" });
:1195   thumbnail: Boolean(project.thumbnailUrl),      <- hidden <pre data-codex-projects> debug blob
:1282   onProjectSnapshot={updateProjectSnapshot}      <- the only wiring into the editor
:1716   <ProjectPreview accent={...} />                <- SHARED projects: no thumbnailUrl passed, ever
:1817   <ProjectPreview accent={project.accent} thumbnailUrl={project.thumbnailUrl} />
:2084   function ProjectPreview({ accent, thumbnailUrl })
:2093   <span className={`project-preview accent-${accent}`} aria-hidden="true">
:2095   <img className="project-thumbnail-image" src={thumbnailUrl ?? ""} ... onError={...} />
:2098   <span className="preview-grid" />
:2099   <span className="preview-empty-mark">No snapshot yet</span>
```

**The capture trigger** — `apps/web/src/components/SketchForgeEditor.tsx`:

```
:215  sketchforgeCaptureCanvas?: () => string;                 (Window declaration)
:216  sketchforgeCaptureCanvasAsync?: () => Promise<string>;   (Window declaration)
:5452 onProjectSnapshot,                                       (prop destructure)
:5491 onProjectSnapshot?: (snapshot: { image: string; projectId: string; shapes: number }) => void;
:5555 const projectInteractionActiveRef = useRef(false);
:5561 const projectSnapshotRunRef = useRef(0);
:5577 const [projectInteractionActive, setProjectInteractionActive] = useState(false);
:6014-6061  the capture useEffect (quoted in full in section 3)
:6188 const updateProjectInteractionActive = useCallback((active: boolean) => {   <- the gate
:8163 if (command.action === "capture_image") {   <- MCP, unrelated to thumbnails (section 3c)
```

**The renderer-side capture functions** — `apps/web/src/components/WorkplaneViewport.tsx`:

```
:303  sketchforgeCaptureCanvas?: () => string;
:304  sketchforgeCaptureCanvasAsync?: () => Promise<string>;
:634  function canvasPngDataUrl(canvas: HTMLCanvasElement)   <- toBlob + FileReader -> data URL
:2809 window.sketchforgeCaptureCanvas = () => { ... toDataURL("image/png") }
:2814 window.sketchforgeCaptureCanvasAsync = () => { ... canvasPngDataUrl(...) }
:2819 window.sketchforgeCaptureView = (face = "current") => { ... }   <- MCP path
:2914-2922  the unmount cleanup that deletes all three off `window`
:5038 new THREE.WebGLRenderer({ ..., preserveDrawingBuffer: shouldPreserveDrawingBufferForLocalAutomation() })
:630  function shouldPreserveDrawingBufferForLocalAutomation() { return typeof window !== "undefined"; }
```

**Styling** — `apps/web/src/app/globals.css`: `.project-preview` (`:843`,
`:852`, `:1131`, `:1135`, `:1139`, `:1143`, `:6833`), `.preview-grid`
(`:1066`), `.project-thumbnail-image` (`:1077`), `.preview-empty-mark`
(`:1084`), `.preview-shape` / `.preview-shadow` (`:1096`, `:1103`,
`:1112`, `:1121` — the older non-thumbnail placeholder art, not currently
rendered by `ProjectPreview`).

**Docs** (prose only, no code):

```
README.md:38             "designs live in browser storage with generated project thumbnails"
docs/CHANGELOG.md:14     "Local project dashboard with generated thumbnails."
docs/SKF_PROJECT_FORMAT.md:56  imported .skf goes "through the existing dashboard, thumbnail, IndexedDB, history, and editor lifecycle"
.github/CONTRIBUTING.md:29     "Project persistence and dashboard thumbnails"
docs/media/videos/README.md:20,32,74,81  a planned "06-dashboard-thumbnails.mp4" demo
apps/web/next.config.ts:16     comment: "...which also breaks API routes such as project snapshots"
```

### 1b. `snapshot` / `preview` identifiers that are NOT project snapshots

Reported so the greps above are not misread. These are unrelated and were
not traced further:

- **Undo-history snapshots** (a cloned shape tree, not an image):
  `apps/web/src/lib/editorHistory.ts:146` `appendEditorHistorySnapshot`;
  `apps/web/src/lib/edgeTreatmentHistory.ts:25,28,35,41,42,49,54`
  (`compactSnapshotHistory`, `cloneWorkplaneShapeSnapshot`);
  `tests/unit/editorHistory.test.ts`, `tests/unit/edgeTreatmentHistory.test.ts`;
  `SketchForgeEditor.tsx:1559,6141,6156,6265,6273,6313-6322`.
- **`snapshot` as a plain local variable name** for a state payload:
  `SketchForgeEditor.tsx:5477,5492` (`onProjectShapesChange`,
  `onProjectWorkspaceChange`), `page.tsx:824-908`
  (`updateProjectShapes`, `updateProjectWorkspace`),
  `WorkplaneViewport.tsx:4190-4216` (`selectedIdsSnapshot`),
  `SketchForgeEditor.tsx:7837,7861,8184` (`mcpSceneSnapshot` — a JSON scene
  summary, no image).
- **`preview` in the geometry/CAD sense** — 322 total matches under
  `apps/web/src`, of which only the 6 in `page.tsx` are the dashboard
  thumbnail. The rest are workplane/CSG/sketch previews:
  `WorkplaneViewport.tsx` (135), `SketchForgeEditor.tsx` (123),
  `workplane/ActionOverlays.tsx` (18), `SketchWorkspace.tsx` (11),
  `workplane/WorkspaceSettingsModal.tsx` (8),
  `official/ChallengesDashboard.tsx` (6), `SketchRevolvePreview.tsx` (4),
  `workers/cadModifier.worker.ts` (3), `lib/cadModifierRuntime.ts` (3),
  `lib/cadModifierTypes.ts` (2), `workplane/ShapeInspector.tsx` (2),
  `workplane/EdgeModifierPanel.tsx` (1), plus `tests/unit/csgPreview.test.ts`.
  I did not enumerate those 316 lines individually; nothing in them touches
  `thumbnailUrl`, `/api/project-thumbnail`, or `onProjectSnapshot`.

---

## 2. Where a snapshot image is stored, and in what format

Two storage locations, and they hold different things.

**a) The image bytes — a PNG file on the server's disk.**

```
apps/web/src/app/api/project-thumbnail/route.ts:7
const THUMBNAIL_DIR = path.join(process.cwd(), ".codex", "project-thumbnails");

apps/web/src/app/api/project-thumbnail/route.ts:18-24
function thumbnailPath(projectId: string) {
  const safeId = safeProjectId(projectId);
  if (!safeId) { return null; }
  return path.join(THUMBNAIL_DIR, `${safeId}.png`);
}
```

So: `<cwd>/.codex/project-thumbnails/<projectId>.png`, one file per
project, filename = the project id stripped to `[a-zA-Z0-9_-]`
(`route.ts:13-16`). Format is **PNG only** — the POST rejects anything
whose data URL does not start with `data:image/png;base64,`
(`route.ts:100-102`), and the GET serves it with
`"Content-Type": "image/png"` and `"Cache-Control": "no-store"`
(`route.ts:66-71`). Size cap 5 MiB decoded (`route.ts:10`, enforced at
`:110-112`, with a pre-check on `content-length` at `:81-84`).

The wire format between browser and server is a base64 PNG **data URL**
in a JSON body `{ dataUrl, projectId }` (`page.tsx:800-804`); the server
strips the prefix and writes raw bytes (`route.ts:105,117`).

`.codex/` is gitignored (`.gitignore:36`) and excluded from the Docker
build context (`deploy/docker/Dockerfile.dockerignore:3`), so no thumbnail
is ever committed or baked into an image.

**b) The pointer — a URL string in browser localStorage.**

The dashboard project record carries `thumbnailUrl` and `thumbnailVersion`
(`page.tsx:37-38`), persisted through `projectForStorage`
(`page.tsx:456-457`) into the `PROJECTS_STORAGE_KEY` localStorage blob and
read back at `page.tsx:400-401`. The stored value is not an image, it is
the URL of the GET endpoint with a cache-buster:

```
apps/web/src/app/page.tsx:808
const thumbnailUrl = `/api/project-thumbnail?projectId=${encodeURIComponent(snapshot.projectId)}&v=${nextVersion}`;
```

`nextVersion` is the `{ version: Date.now() }` the POST returns
(`route.ts:120`).

**Exception — the static-export build.** When
`NEXT_PUBLIC_STATIC_EXPORT === "true"` (`page.tsx:116`, set by
`next.config.ts:20`, used by the `npm run export` script,
`package.json:19`), `updateProjectSnapshot` takes an early return at
`page.tsx:786-795` and stores the **base64 data URL itself** as
`thumbnailUrl`. No HTTP call, no file. That URL then goes into
localStorage verbatim via `projectForStorage`.

---

## 3. Every code path that WRITES a snapshot

There is exactly **one** writer, and it is an effect, not a command.

### 3a. The trigger: an automatic `useEffect` in the editor

`apps/web/src/components/SketchForgeEditor.tsx:6014-6061`, verbatim:

```tsx
useEffect(() => {
  if (!projectId || !onProjectSnapshot || typeof window === "undefined") {
    return;
  }
  if (projectInteractionActive) {
    return;
  }

  const runId = projectSnapshotRunRef.current + 1;
  projectSnapshotRunRef.current = runId;
  const capture = async () => {
    if (projectSnapshotRunRef.current !== runId) {
      return true;
    }
    const image = window.sketchforgeCaptureCanvasAsync
      ? await window.sketchforgeCaptureCanvasAsync()
      : window.sketchforgeCaptureCanvas?.() ?? "";
    if (projectSnapshotRunRef.current !== runId) {
      return true;
    }
    if (image && image.length > 100) {
      onProjectSnapshot({ image, projectId, shapes: shapes.length });
      return true;
    }
    return false;
  };

  let idleId: number | null = null;
  let retryTimer: number | null = null;
  const runCapture = () => {
    void capture().then((captured) => {
      if (!captured) {
        retryTimer = window.setTimeout(() => void capture(), 650);
      }
    });
  };
  const captureTimer = window.setTimeout(() => {
    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(runCapture, { timeout: 1200 });
    } else {
      runCapture();
    }
  }, 850);
  return () => {
    window.clearTimeout(captureTimer);
    if (retryTimer !== null) window.clearTimeout(retryTimer);
    if (idleId !== null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
  };
}, [onProjectSnapshot, projectId, projectInteractionActive, shapes]);
```

What fires it: any change to the `shapes` array, to `projectId`, or to
`projectInteractionActive` — i.e. **every time the model changes**, plus
on mount when a project opens. It then waits 850ms, waits for browser
idle (1200ms timeout), captures, and retries once after 650ms if the
canvas came back blank. It is suppressed entirely while a drag/gesture is
in flight (`projectInteractionActive`, set by
`updateProjectInteractionActive` at `SketchForgeEditor.tsx:6188-6212`), so
the snapshot lands on a settled scene.

### 3b. The chain, end to end

1. **Pixels** — `WorkplaneViewport.tsx:2809-2818` installs the capture
   functions on `window` when the three.js scene is created:

   ```tsx
   window.sketchforgeCaptureCanvas = () => {
     state.camera.updateMatrixWorld();
     state.renderer.render(state.scene, state.camera);
     return state.renderer.domElement.toDataURL("image/png");
   };
   window.sketchforgeCaptureCanvasAsync = () => {
     state.camera.updateMatrixWorld();
     state.renderer.render(state.scene, state.camera);
     return canvasPngDataUrl(state.renderer.domElement);
   };
   ```

   Both force a fresh render immediately before reading the buffer, and
   the renderer is created with `preserveDrawingBuffer: true` in any
   browser (`:5038` + `:630-632`). They are deleted on unmount
   (`:2914-2922`).

2. **Editor → dashboard** — `onProjectSnapshot({ image, projectId, shapes })`,
   the prop declared at `SketchForgeEditor.tsx:5491` and wired at
   `page.tsx:1282` to `updateProjectSnapshot`.

3. **Dashboard → server** — `page.tsx:800-804`:

   ```tsx
   void fetch("/api/project-thumbnail", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ dataUrl: snapshot.image, projectId: snapshot.projectId }),
   })
   ```

4. **Server → disk** — `route.ts:114-118`:

   ```ts
   await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
   await fs.rm(filePath, { force: true });
   await fs.writeFile(filePath, Buffer.from(encodedImage, "base64"));
   ```

5. **Back to the card** — the returned `version` becomes the `?v=` on the
   stored `thumbnailUrl` (`page.tsx:806-816`), which `ProjectPreview`
   renders as an `<img>`.

The **delete** path is symmetric and equally automatic: deleting a project
fires `DELETE /api/project-thumbnail?projectId=...`
(`page.tsx:1162-1173`, call at `:1168`; handler at `route.ts:125-137`).
There is no "delete just the snapshot" control either.

### 3c. A near miss that does NOT write a snapshot

`SketchForgeEditor.tsx:8163-8170` handles the MCP `capture_image` command
and calls `window.sketchforgeCaptureView(face)`
(`WorkplaneViewport.tsx:2819-2829`). It **returns** the data URL to the
MCP caller (`scripts/sketchforge-mcp-server.mjs:240,332-333`,
`sketchforge_capture_image`); it never touches `/api/project-thumbnail`
and never updates `thumbnailUrl`. Same for the unrelated
`/api/codex-screenshot` route, which writes to
`.codex/screenshots` (`apps/web/src/app/api/codex-screenshot/route.ts:86`)
for the boolean self-test at `SketchForgeEditor.tsx:8302-8337`.

---

## 4. The click path, if a UI control existed

Not applicable — see section 5. What a user actually does today to get a
snapshot written, which is the closest thing to a click path:

1. Dashboard → click a project card (`onOpenProject`, `page.tsx:1815`).
2. The editor mounts with that `projectId`; the effect fires on mount.
3. Add, move, or edit any shape — or simply wait ~850ms after the scene
   settles.
4. Release the mouse (the effect is suppressed while
   `projectInteractionActive` is true).
5. The current camera view is captured as-is — whatever the viewport
   happens to be showing, at whatever zoom and angle, including any
   selection highlight. The user has no framing control other than
   orbiting the camera before the capture fires.
6. Navigate back to the dashboard; the card shows the PNG.

Note step 5: because the trigger is "the model changed", the snapshot is
always of the *last* view after the *last* edit. There is no way to say
"use this view".

---

## 5. Is a UI control wired? — No.

**Plainly: there is no UI control anywhere that captures, recaptures,
clears, or chooses a project snapshot.** I grepped `page.tsx` and
`SketchForgeEditor.tsx` for any `button`, `label`, or `title=` carrying
"Snapshot" or "Thumbnail" and the only hit in either file is the
`<img className="project-thumbnail-image">` at `page.tsx:2095`. The
string "No snapshot yet" is the sole user-visible use of the word
"snapshot" in the app. The project card's own menu
(`page.tsx:1820+`, "Project options") was read and carries exactly two
entries, **Rename** (`page.tsx:1838`) and **Delete** (`page.tsx:1842`) —
no snapshot entry.

**Is the capture function itself complete?** Yes, and it looks finished
rather than half-built:

- `window.sketchforgeCaptureCanvasAsync` (`WorkplaneViewport.tsx:2814-2818`)
  and its sync fallback (`:2809-2813`) both force a render first and both
  return a PNG data URL; `preserveDrawingBuffer` is on
  (`:5038` + `:630-632`), so the read-back is sound.
- The effect handles the real failure modes: stale-run cancellation via
  `projectSnapshotRunRef`, a blank-canvas retry, idle scheduling, and full
  timer cleanup (`SketchForgeEditor.tsx:6014-6061`).
- The route validates origin, id, MIME prefix, base64 shape and size, and
  writes atomically enough (`rm` then `writeFile`) — `route.ts:78-123`.
- The dashboard has an `onError` fallback on the `<img>` so a 404 or 403
  degrades to "No snapshot yet" rather than a broken image
  (`page.tsx:2085-2095`).

So the machinery is complete; what is missing is only a way to *ask* for
it.

**Two conditions under which nothing is ever written, both reachable:**

1. **Non-localhost access returns 403.** `isLocalSameOriginRequest`
   (`route.ts:26-46`) tests `requestUrl.hostname` against
   `LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])`
   (`route.ts:8`) and returns 403 otherwise, with the message
   `"Project thumbnails are only available from this localhost app"`. The
   Unraid deployment is reached over the LAN by IP or hostname, so
   **every POST from that deployment is refused**, `.catch()` at
   `page.tsx:825-829` swallows it, `thumbnailUrl` stays null, and every
   card reads "No snapshot yet" permanently. I traced this from the code;
   I did **not** test it against the running Unraid container.

   > **CORRECTED 2026-09-09 — the 403 is real, but this explanation of its
   > cause is wrong.** The paragraph above is left as written, per the
   > project's rule that a wrong entry gets a dated correction rather than
   > a rewrite. The outcome it predicts is right: nothing is ever written
   > from Unraid. The mechanism is not.
   >
   > `requestUrl` is `new URL(request.url)`, and Next derives `request.url`
   > from the address the **server bound to**, never from the client's Host
   > header. Measured on a running dev server: a browser request to
   > `http://192.168.1.245:3100/` arrives as
   > `request.url = http://0.0.0.0:3100/api/project-thumbnail`, hostname
   > `0.0.0.0`, while the Host header separately reads
   > `192.168.1.245:3100`. The container sets `HOSTNAME=0.0.0.0`
   > (`deploy/docker/Dockerfile:24`), so the hostname tested there is
   > **always the literal string `0.0.0.0`** — not the LAN IP, not a
   > hostname, and not anything the client can influence. Confirmed by
   > running the standalone production build exactly as the container does.
   >
   > There is a second, independent blocker the original text missed
   > entirely: Unraid publishes host port 3001 onto container port 3000
   > (`deploy/docker/compose-ghcr.yaml:5`), so even with the hostname
   > fixed, `originUrl.port` (`3001`, from the browser) could never equal
   > `requestUrl.port` (`3000`, from the bind), and the Origin comparison
   > would still refuse every request.
   >
   > Both are fixed together by reading the Host header, which carries the
   > real address *and* the published port (`192.168.1.250:3001`). Owner
   > ruled on 2026-09-09; see the guard in `route.ts` and
   > `tests/unit/projectThumbnailOrigin.test.ts`.
2. **Shared projects never get one at all.** `page.tsx:1716` renders
   `<ProjectPreview accent={...} />` with no `thumbnailUrl` argument, so
   the shared-library cards always show the empty state by construction.
   `apps/web/src/app/api/shared-projects/route.ts` has no image handling
   of any kind (grepped for `thumbnail|png|image`: zero hits).

---

## 6. Are snapshots stored in the shared projects dir (`/data/projects`)? — No.

They are stored in a **completely different, non-persistent place**.

- Shared projects: `SKETCHFORGE_SHARED_PROJECTS_DIR`, set to
  `/data/projects` (`deploy/docker/Dockerfile:24`), declared a volume
  (`Dockerfile:39` `VOLUME ["/data/projects"]`), mounted in both compose
  files (`deploy/docker/compose.yaml:15`,
  `deploy/docker/compose-ghcr.yaml:12`). Read by
  `apps/web/src/app/api/shared-projects/route.ts:10`.
- Snapshots: `path.join(process.cwd(), ".codex", "project-thumbnails")`
  (`route.ts:7`) — **no env var, not configurable, not a volume, and not
  under `/data`**.

Where that resolves to in the container: the entrypoint is
`node deploy/docker/start-server.mjs` (`Dockerfile:45`) from `WORKDIR /app`
(`Dockerfile:18`), which spawns `apps/web/server.js`
(`start-server.mjs:17`). That is the Next standalone server, and Next's
generated standalone entrypoint contains `process.chdir(__dirname)` —
confirmed in the installed Next in this repo at
`node_modules/next/dist/build/utils.js:1313`. So `process.cwd()` at
runtime is `/app/apps/web`, and thumbnails would be written to
`/app/apps/web/.codex/project-thumbnails/`.

That path is inside the container's writable layer, not on a volume.
**Recreating the container discards every snapshot** — which matches
SESSION-STATE's note that the Unraid container "had again gone missing
during this update and was recreated by hand". Combined with the 403 in
section 5, the practical situation on Unraid is that nothing is written
there in the first place.

Traced but **not confirmed**: whether the `node` user can actually create
`/app/apps/web/.codex/`. `/app/apps/web` is created by
`COPY --from=builder --chown=node:node ... ./` (`Dockerfile:32`), which
should leave it node-owned, so `fs.mkdir` should succeed — but I did not
run the image to verify, and the 403 fires before this code is reached
anyway.

> **CONFIRMED 2026-09-26 — by owner observation, not by inspecting the
> image.** With `1.3.3` (the Host-header guard, `9e926bf`) deployed, the
> owner has seen thumbnails on the project cards of the running Unraid
> container. A card can only show one if the POST wrote the PNG and the GET
> served it back, so the `node` user can create
> `/app/apps/web/.codex/project-thumbnails/`. Nobody listed the directory
> inside the container; this is confirmed by sight. The persistence problem
> above (lost on every container recreate) is unchanged.

In the local dev app (`localhost:3000`, `npm run dev` from the repo root),
`process.cwd()` is the repo root, so the path is
`/Apps/marlin-cad/.codex/project-thumbnails/`. That directory **does not
currently exist** on this box (`ls -la .codex` → no such file), which is
consistent with no dev session having produced a snapshot since the last
clean, or with the dev server having run from `apps/web`.

---

## Open questions (for the owner — nothing here was built)

1. **Should there be a "Take snapshot" control at all?** Today the only
   snapshot is "whatever the camera happened to show after the last
   edit". A deliberate control (project card menu, or an editor toolbar
   button) is the obvious missing piece, but it is a design decision, not
   a bug fix.
2. **The localhost-only gate is what breaks this on Unraid.** Was
   `isLocalSameOriginRequest` (`route.ts:26-46`) written for the desktop
   /dev app before the Docker deployment existed? Relaxing it is a
   security-relevant change to a write endpoint that accepts 5 MiB of
   attacker-controlled bytes and a path-derived filename, so I am not
   proposing a shape for it here.
   **RESOLVED 2026-09-09** — the owner ruled: accept private-LAN IPv4
   (10/8, 172.16/12, 192.168/16) plus localhost across all three verbs,
   sourcing host and port from the Host header. Only this route's copy
   changed; `local-download` and `codex-screenshot` keep their own
   localhost-only copies. See the correction under section 5 for why the
   first attempt at this fix (`6ae02f7`, released as nothing) was a no-op
   in the container.
3. **Snapshots are not on a persistent volume.** Even with the 403 fixed,
   `.codex/project-thumbnails` under the standalone cwd is lost on every
   container recreate. Should the directory move under `/data`
   (alongside, not inside, `/data/projects`), behind a new env var?
4. **Should shared projects show a thumbnail?** `page.tsx:1716` passes
   none by design. A shared `.skf` has no associated image today.
5. **The static-export build stores a full base64 PNG in localStorage**
   (`page.tsx:786-795`). With several projects this can approach the
   ~5 MB localStorage quota. Is the static export path still in use?
6. **Does the `.skf` format carry a thumbnail?** `docs/SKF_PROJECT_FORMAT.md:56`
   says an import goes "through the existing dashboard, thumbnail, ...
   lifecycle", which reads as "a new snapshot gets generated after
   import", not "the file contains one". I did not open the `.skf`
   writer to confirm either reading.
7. **No tests cover any of this.** `grep -rln "thumbnail\|Snapshot" tests/`
   returns only `tests/unit/editorHistory.test.ts`, which is the unrelated
   undo-history sense. The route, the effect, and the 403 gate are all
   untested.

   > **CORRECTED 2026-09-27.** The gate now has tests:
   > `tests/unit/projectThumbnailOrigin.test.ts`, 28 tests, added across
   > `6ae02f7` and `9e926bf`. It is the only test file that mentions
   > thumbnails; the route's write path and the capture effect have no test.

---

## SCOPE CHECK

No file in the repository was modified, created, or deleted by this pass
except this report. No commands were run other than `git log`, `ls`,
`cat`, `sed -n`, `grep`, and `mkdir -p reference/reports`. Nothing was
built, wired, or installed.

**Files created:** `reference/reports/snapshot-recon.md` (this file).

**Files read, mapped to the task step that required them:**

| File | Steps |
|---|---|
| `reference/SESSION-STATE.md` | orientation (read first, as instructed) |
| `reference/DECISIONS.md` | orientation (read first, as instructed) |
| `apps/web/src/app/page.tsx` | 1, 2, 3, 4, 5 |
| `apps/web/src/app/api/project-thumbnail/route.ts` | 1, 2, 3, 5, 6 |
| `apps/web/src/components/SketchForgeEditor.tsx` | 1, 3, 4, 5 |
| `apps/web/src/components/WorkplaneViewport.tsx` | 1, 3, 5 |
| `apps/web/src/app/globals.css` | 1 |
| `apps/web/next.config.ts` | 1, 2 |
| `apps/web/src/app/api/shared-projects/route.ts` | 5, 6 |
| `apps/web/src/app/api/codex-screenshot/route.ts` | 3 (ruled out as unrelated) |
| `scripts/sketchforge-mcp-server.mjs` | 3 (ruled out as unrelated) |
| `deploy/docker/Dockerfile` | 6 |
| `deploy/docker/start-server.mjs` | 6 |
| `deploy/docker/compose.yaml`, `compose-ghcr.yaml` | 6 |
| `deploy/docker/Dockerfile.dockerignore`, `.gitignore` | 2 |
| `package.json` | 2 (static-export script) |
| `README.md`, `docs/CHANGELOG.md`, `docs/SKF_PROJECT_FORMAT.md`, `.github/CONTRIBUTING.md`, `docs/media/videos/README.md` | 1 |
| `node_modules/next/dist/build/utils.js` | 6 (standalone `process.chdir`) |
| `tests/` (grep only) | open question 7 |

**Do-not-touch list:** `test-prints/`, all four tray geometry modules,
`multiconnectContainerGeometry.ts`, `multiconnectSlotMesh.ts`, `deploy/`,
`.github/` — none were edited. `deploy/docker/*` and `.github/CONTRIBUTING.md`
were **read only**, which step 6 and step 1 required (`/data/projects` is
defined nowhere else, and the CONTRIBUTING line is a literal "thumbnails"
grep hit). Nothing in this pass pulled toward the geometry modules or
`test-prints/` at all.
