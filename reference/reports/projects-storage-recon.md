# Where do projects actually get written? (read-only recon)

Date: 2026-09-09. Branch `main` at `9e926bf`. Read-only pass; this report
is the only new file. I cannot see the running container — everything
below comes from the code and the image definition, and anything I could
not confirm is marked.

---

## Bottom line, before the detail

**The empty `/mnt/user/appdata/marlin-cad/projects` is not a bug, and no
project data has been lost.** That directory backs the *shared* project
library, which is written **only** when someone clicks **Save to shared**
in the Export dialog. Nobody ever has.

The four projects — "Fill Rack Tags", "Screwdriver Holder", "Metric
Sockets 4-9", "Metric Socket 10-16" — are **local projects, and local
projects never leave the browser**. They are not in the container, not on
the mapped volume, and not in the container's disposable layer either.
They are in the IndexedDB and localStorage of the *browser profile* you
opened `http://192.168.1.250:3001/` with.

**Consequence for step 6: there is nothing for `docker cp` to copy.** The
requested command cannot exist, because the bytes are not on Unraid at
all. The real recovery path is in section 6, and the projects are safe as
long as that browser profile is intact.

---

## 1. Every code path that persists a project

There are exactly two, and they write to completely different places.

### Path A — local projects: the browser, always

This is what the four named projects are.

**A1. The project list** (names, dates, shape counts, accents,
`thumbnailUrl`) → `localStorage`, key **`sketchForge.projects`**:

```
apps/web/src/app/page.tsx:107   const PROJECTS_STORAGE_KEY = "sketchForge.projects";
apps/web/src/app/page.tsx:614     window.localStorage.setItem(PROJECTS_STORAGE_KEY, serialized);
apps/web/src/app/page.tsx:618     window.localStorage.setItem(PROJECTS_STORAGE_KEY, serialized);
apps/web/src/app/page.tsx:930     window.localStorage.setItem(PROJECTS_STORAGE_KEY, serialized);
```

Read back by `readStoredProjects()` at `page.tsx:380-415`.

**A2. The actual geometry** → **IndexedDB**, database
**`sketchForge.projectShapes`** (version 3), object stores
**`projectShapes`** and **`projectShapeResources`**:

```
apps/web/src/app/page.tsx:108   const PROJECT_SHAPES_DB_NAME = "sketchForge.projectShapes";
apps/web/src/app/page.tsx:109   const PROJECT_SHAPES_STORE_NAME = "projectShapes";
apps/web/src/app/page.tsx:110   const PROJECT_SHAPE_RESOURCES_STORE_NAME = "projectShapeResources";

apps/web/src/app/page.tsx:184-204   function openProjectShapesDb()
apps/web/src/app/page.tsx:186         if (typeof window === "undefined" || !window.indexedDB) {
apps/web/src/app/page.tsx:191         const request = window.indexedDB.open(PROJECT_SHAPES_DB_NAME, 3);
```

`window.indexedDB` is the **browser's** IndexedDB. The whole project —
shapes, history and assets — is serialised to an `.skf` package and
stored as a record there:

```
apps/web/src/app/page.tsx:293   async function saveProjectShapes(projectId, entry, context)
apps/web/src/app/page.tsx:294     const skfPackage = await exportSkfProject({ ... });
apps/web/src/app/page.tsx:345   function saveProjectShapesWhenIdle(...)   <- requestIdleCallback wrapper
apps/web/src/app/page.tsx:362   async function deleteProjectShapes(projectId)
```

**Triggered by:** every edit. `updateProjectShapes` (`page.tsx:824`)
queues `saveProjectShapesWhenIdle` at `page.tsx:862`.

**How the directory is chosen: it isn't.** There is no directory and no
server involved. I grepped the entire save path (`page.tsx:293-375`) for
`fetch(` — **zero matches**. Nothing is transmitted anywhere. The
storage location is whatever the browser allocates for the origin
`http://192.168.1.250:3001`, inside the browser profile on the machine
that has the tab open.

**Which machine?** DECISIONS.md records "The Mac is browser and slicer
only", so the Mac's browser profile is the likely holder — but I cannot
confirm which browser or machine you actually used, and if you have
opened the app from more than one, **each has its own separate copy**.

### Path B — shared projects: `/data/projects` in the container

This is the only path that writes to the server, and it is **manual and
explicit**.

```
apps/web/src/app/page.tsx:1022  const saveActiveProjectToShared = useCallback(...)
apps/web/src/app/page.tsx:1034    const response = await fetch(`/api/shared-projects?fileName=...`, { method: "POST", headers, body });
```

Reached only from the Export dialog's **Save to shared** button:

```
apps/web/src/components/SketchForgeEditor.tsx:10144-10154
  {exportFormat === "skf" && sharedProjectsEnabled ? (
    <button className="export-shared-button" ... onClick={() => onExportSkf(exportName, skfHistoryLimit, "shared")}>
      <CloudUpload />
      <span>Save to shared</span>
```

Server side, the write is careful — lock file, temp file, atomic rename:

```
apps/web/src/app/api/shared-projects/route.ts:186  export async function POST(request: Request)
apps/web/src/app/api/shared-projects/route.ts:194    const root = sharedProjectsDirectory();
apps/web/src/app/api/shared-projects/route.ts:205    await fs.mkdir(root, { recursive: true });
apps/web/src/app/api/shared-projects/route.ts:206    const filePath = path.join(root, fileName);
apps/web/src/app/api/shared-projects/route.ts:240    await fs.rename(temporaryPath, filePath);
```

The dashboard's **Shared** section lists this directory
(`page.tsx:533` → `GET /api/shared-projects`, rendered at
`page.tsx:1713-1716`). It is a *separate* section from **Projects**
(`page.tsx:1789-1817`).

**This is the decisive evidence.** The four projects appear in the
dashboard. If they were shared projects they would have to be files in
`/data/projects`, which is mapped to the host directory you found
**empty**. They cannot be listed from an empty directory. Therefore they
are local projects, from Path A, in the browser.

---

## 2. How `SKETCHFORGE_SHARED_PROJECTS_DIR` is read

**File and line:**

```
apps/web/src/app/api/shared-projects/route.ts:10   const SHARED_PROJECTS_ENV = "SKETCHFORGE_SHARED_PROJECTS_DIR";

apps/web/src/app/api/shared-projects/route.ts:20-23
function sharedProjectsDirectory() {
  const configured = process.env[SHARED_PROJECTS_ENV]?.trim();
  return configured ? path.resolve(configured) : null;
}
```

**Build time or run time: run time.** The read sits inside a function
body, and that function is called fresh at the top of every request
handler — `GET` at `:88`, `DELETE` at `:129`, `POST` at `:187`. It is
**not** inlined at build time: it is a dynamic `process.env[...]` index
with a runtime variable key, so Next's build-time `process.env`
substitution cannot fold it. Changing the container's env var and
restarting takes effect with no rebuild. (Contrast
`NEXT_PUBLIC_STATIC_EXPORT` at `page.tsx:116`, which *is* a build-time
literal.)

**Fallback when unset: there is none, and the feature switches off.**
`sharedProjectsDirectory()` returns `null`, and each verb refuses:

```
:80-86   function disabledResponse() -> { enabled: false, projects: [], error: "SKETCHFORGE_SHARED_PROJECTS_DIR is not configured" }
:89      GET     -> if (!root) return disabledResponse();
:130     DELETE  -> if (!root) return 404 { error: "Shared project storage is disabled" }
:188     POST    -> if (!root) return 404 { error: "Shared project storage is disabled" }
```

**Is the fallback silent? No — and this matters.** It is loud in three
ways:

1. `GET` returns `enabled: false` **with an explicit error string naming
   the missing variable**.
2. The dashboard hides the whole Shared section and the **Save to
   shared** button disappears (`sharedProjectsEnabled` gates it at
   `SketchForgeEditor.tsx:10144`, passed in at `page.tsx`/`:9225`).
3. **The container's healthcheck fails**, because it greps for exactly
   that flag:
   ```
   deploy/docker/Dockerfile:41-42
   HEALTHCHECK ... CMD wget -q -O - http://127.0.0.1:3000/api/shared-projects | grep -q '"enabled":true' || exit 1
   ```
   An unset variable would show the container as **unhealthy** in the
   Unraid Docker tab. You have not reported that, which is good
   independent evidence the variable *is* set correctly.

**Fallback when the directory is unwritable: none either, and it is
loud.** There is no alternate path anywhere in the file. `fs.mkdir` /
`fs.open` / `fs.rename` throw, and the catch blocks surface the real
errno message to the UI — `GET` returns HTTP 500 with
`error: <message>` (`:124`), `POST` returns HTTP 400 (`:249`). A
permission problem would appear as a visible error, never as a silent
write somewhere else.

**So: no silent fallback exists on this path at all.** If the variable
were wrong or the mount broken, you would have seen an unhealthy
container and error toasts — not four happily-listed projects.

---

## 3. Is `SKETCHFORGE_SHARED_PROJECTS_DIR=/data/projects` baked into the image?

**Yes.** Quoting `deploy/docker/Dockerfile` (read-only):

```
deploy/docker/Dockerfile:16   FROM node:22-alpine AS runner
deploy/docker/Dockerfile:18   WORKDIR /app
...
deploy/docker/Dockerfile:24   ENV SKETCHFORGE_SHARED_PROJECTS_DIR=/data/projects
```

**Stage: the `runner` stage** (the second and final `FROM`, line 16), so
it is present in the shipped image, not just at build. It is set
alongside `HOSTNAME=0.0.0.0` (`:22`) and `PORT=3000` (`:23`). This
matches SESSION-STATE's "baked into the image, so only the path mapping
is needed". Confirmed, not inferred.

---

## 4. Container user, and whether it can write

```
deploy/docker/Dockerfile:36   USER node
```

The container runs as the **`node`** user (uid 1000 in `node:22-alpine`),
switched at line 36 — after every `COPY`, before `CMD`.

**`/data/projects`: writable, explicitly arranged.**

```
deploy/docker/Dockerfile:26-29
RUN apk add --no-cache libcap \
  && setcap cap_net_bind_service=+ep /usr/local/bin/node \
  && mkdir -p /data/projects \
  && chown node:node /data/projects
```

The directory is created and `chown`ed to `node:node` while still root,
then `USER node` takes effect. **Caveat I cannot confirm:** when Unraid
bind-mounts `/mnt/user/appdata/marlin-cad/projects` over `/data/projects`,
the *host* directory's ownership replaces the image's — the `chown` at
line 29 applies to the image layer underneath the mount, not to what is
mounted on top. Whether `node` (uid 1000) can write the mounted host
directory depends on that host directory's ownership, which I cannot see.
Unraid's appdata is typically `nobody:users` (99:100) and world-writable,
which would work, but **this is inference**. If it were wrong you would
see save errors, not silence.

**The application root: also node-owned**, via
`COPY --from=builder --chown=node:node` at lines 31-34. So the thumbnail
directory under `/app/apps/web` (section 7) is creatable by `node`. I
verified the equivalent write succeeds when running the real standalone
build locally, but **not inside the actual image**.

---

## 5. Every filesystem location a project can end up in

| # | Location | What lands there | Mapped volume or disposable? |
|---|---|---|---|
| 1 | **Browser IndexedDB** `sketchForge.projectShapes` (stores `projectShapes`, `projectShapeResources`) | **All four named projects.** Full geometry, history, assets, as `.skf` packages | **Neither — not on Unraid at all.** Lives in the browser profile on your Mac/PC |
| 2 | **Browser localStorage** `sketchForge.projects` | The project list: names, dates, shape counts, `thumbnailUrl` | Same as above — browser profile |
| 3 | `/data/projects` in the container | `.skf` files, **only** from Export → Save to shared | **Mapped** → `/mnt/user/appdata/marlin-cad/projects`. Survives updates. Currently empty because nothing was ever saved here |
| 4 | `/data/projects/*.lock`, `/data/projects/.<name>.<uuid>.tmp` | Transient lock and temp files during a shared save (`route.ts:205`, `:206`) | Mapped; cleaned up in `finally` (`:180-182`, `:250-253`) |
| 5 | `/app/apps/web/.codex/project-thumbnails/<projectId>.png` | Dashboard snapshot PNGs | **Disposable layer** — see section 7 |
| 6 | Wherever the browser downloads to | `.skf` / STL / STEP from the ordinary Export button | The user's own machine |
| 7 | A user-chosen folder via `/api/local-download` | Same, in "Save to folder" mode | Host filesystem of whatever machine runs the server; **not** the mapped volume |

Only rows 3 and 4 are on the mapped volume. **The projects you are
worried about are row 1, which is not on Unraid in any form.**

---

## 6. Are the four projects recoverable, and how?

**Yes — they are not lost, and they were never at risk from the container
going missing.** They live in your browser, which is why recreating the
container twice (KNOWN-FIXES) never cost you anything.

### The requested `docker cp` cannot be given, and here is why

You asked for a copy-pasteable `docker cp` using the real in-container
path. **There is no such path.** Local projects are never transmitted to
the server (section 1, Path A — zero `fetch(` calls in the save path), so
no file inside the container contains them. Any `docker cp` I wrote would
copy an empty directory and give false reassurance. I am not going to
hand you a command that pretends to rescue data it cannot reach.

### Commands you can run to confirm that for yourself

Both are read-only on the container (`docker cp` *out* modifies nothing,
and works whether the container is running or stopped). Run on the Unraid
console:

```sh
mkdir -p /mnt/user/appdata/marlin-cad/projects-rescue

# 1. The shared project space. Expect this to copy nothing - the directory
#    is empty, which is the finding, not a failure.
docker cp marlin-cad:/data/projects/. /mnt/user/appdata/marlin-cad/projects-rescue/

# 2. The dashboard snapshot PNGs, if any were ever written. This is the
#    only trace of your projects that could exist inside the container.
docker cp marlin-cad:/app/apps/web/.codex/project-thumbnails/. /mnt/user/appdata/marlin-cad/projects-rescue/

ls -la /mnt/user/appdata/marlin-cad/projects-rescue/
```

Command 2 will very likely fail with `No such file or directory`, because
the thumbnail write has been returning 403 on every LAN request for the
life of this deployment (section 7). If it *does* produce PNGs, they are
pictures only — **a thumbnail cannot be turned back into a project.**
Container name `marlin-cad` is from SESSION-STATE; the in-container
thumbnail path is `process.cwd()` + `.codex/project-thumbnails`, where
cwd is `/app/apps/web` because Next's standalone `server.js` calls
`process.chdir(__dirname)` — verified by running the real standalone
build, but **not verified inside the actual image**.

### The actual rescue — do this from the browser that shows the projects

The projects are safe *only* while that browser profile is intact, so get
them onto the mapped volume before anything else. Nothing here needs a
console.

For **each** of the four projects:

1. Open `http://192.168.1.250:3001/` **in the same browser and profile
   that lists them** — a different browser, a different machine, or a
   private window will show an empty dashboard.
2. Click the project to open it in the editor.
3. **Export** → choose format **SKF**.
4. Click **Save to shared** (the cloud-upload button, left of the main
   export button).
5. It writes to `/data/projects` → appears in
   `/mnt/user/appdata/marlin-cad/projects` on the host.

After all four, that host directory should hold four `.skf` files and its
mtime will no longer be Aug 28.

**Belt and braces:** in the same Export dialog, the main **Save
SketchForge Project** button downloads the `.skf` to your own machine.
Doing that as well gives you a copy that does not depend on Unraid.

Until you have done this, **do not clear browser data, "clear site data"
for that origin, or reset the browser profile** — that is the one action
that would actually destroy these four projects.

---

## 7. Do snapshots share this problem?

**No — snapshots have a separate problem, in fact two, and they are
unrelated to the projects question.**

Snapshots do not use `SKETCHFORGE_SHARED_PROJECTS_DIR` at all:

```
apps/web/src/app/api/project-thumbnail/route.ts:7
const THUMBNAIL_DIR = path.join(process.cwd(), ".codex", "project-thumbnails");
```

No env var, not configurable, and **not under `/data`** — so it is on the
container's **disposable layer** at `/app/apps/web/.codex/project-thumbnails/`
and is discarded every time the container is recreated. That is
independent of the projects issue: projects are fine because they are in
the browser; snapshots are fragile because they are in the container and
not on a volume.

The second problem — the write was rejected outright — was diagnosed and
**fixed this week but is not yet deployed**: `1.3.3` (`9e926bf`) makes the
guard read the `Host` header instead of the server's bind address. The
running container is `1.3.1`, so **every snapshot write on Unraid is
still returning 403 today** and every card still reads "No snapshot yet".
See `reference/reports/snapshot-recon.md` (section 5, dated correction).

Even after `1.3.3` is deployed, snapshots will still vanish on container
recreate, because nothing has moved them onto a volume. That is an open
question below, not something I changed.

---

## Open questions

1. **Should local projects be server-side at all?** Today "local-first"
   means a browser-profile-scoped store: clearing site data destroys
   everything, the projects are invisible from any other device, and a
   second browser sees an empty dashboard. That is the documented design
   (README:38, README:170), not a defect — but it is plainly not what
   "my projects are on the NAS" intuitively means, and the empty appdata
   directory is exactly how that gap surfaces. Do you want a server-backed
   project store, or is browser-local correct and the shared space the
   intended escape hatch?
2. **Should saving to shared be automatic, or at least prompted?** The
   only route from browser to volume is a button most workflows never
   press.
3. **Should snapshots move onto a persistent volume** — under `/data`
   beside (not inside) `/data/projects`, behind a new env var? This needs
   a Dockerfile change, which is do-not-touch for me.
4. **Is `/mnt/user/appdata/marlin-cad/projects` writable by uid 1000?**
   Unconfirmable from here (section 4). The first successful **Save to
   shared** answers it definitively.
5. **Is `1.3.3` cleared to release?** It is pushed but undeployed, and the
   snapshot 403 persists until it ships.
6. **Was the Aug 28 mtime the container recreate?** SESSION-STATE dates
   the second recreate to 2026-09-07 and the projects are dated Sep 7.
   An Aug 28 mtime on an empty directory suggests it was last touched
   when created, consistent with "never written to".

---

## SCOPE CHECK

No file was modified, created or deleted except this report. No build was
run, no server started, no container contacted, no dependency added. Only
`git log`/`ls`/`cat`/`sed -n`/`grep` were used.

**Files created:** `reference/reports/projects-storage-recon.md`.

| File | Step(s) |
|---|---|
| `reference/SESSION-STATE.md` (Production deployment section) | orientation, 6 |
| `reference/DECISIONS.md` | orientation, 1 |
| `reference/KNOWN-FIXES.md` | orientation, 6 |
| `reference/reports/snapshot-recon.md` | orientation, 7 |
| `apps/web/src/app/page.tsx` | 1, 2, 5, 6 |
| `apps/web/src/app/api/shared-projects/route.ts` | 1, 2, 5 |
| `apps/web/src/lib/projectShapePersistence.ts` | 1 |
| `apps/web/src/components/SketchForgeEditor.tsx` | 1, 6 |
| `apps/web/src/app/api/project-thumbnail/route.ts` | 7 |
| `deploy/docker/Dockerfile` | 3, 4, 5 (**read-only**) |
| `README.md`, `docs/CHANGELOG.md` (via prior recon) | 1 |

**Do-not-touch:** `test-prints/` and all six named `apps/web/src/lib`
geometry modules were neither read nor touched — nothing in this question
goes near geometry. `.github/` was not read. `deploy/docker/Dockerfile`
was **read only**, which steps 3 and 4 explicitly required; no file under
`deploy/` was modified.
