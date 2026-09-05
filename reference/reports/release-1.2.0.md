# Release 1.2.0 — version bump and automatic-publish confirmation

Bumps the version to confirm GitHub Actions now publishes a new Docker image
automatically on every push to `main`, with no manual dispatch click,
following the permissions fixes recorded in `reference/reports/release-1.1.0-actions.md`
and `reference/reports/release-1.1.0-publish.md`. Version-only change —
no dependency, workflow, Dockerfile, or geometry-module edits.

## Step 1 — clean tree, HEAD == origin/main

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
$ git log --oneline -1
73586ee Bank the Corner Radius rounding work: docs current with 4be03de
$ git fetch origin
$ git rev-parse HEAD
73586eeb26124e71ac39d3eeb3989435573d0329
$ git rev-parse origin/main
73586eeb26124e71ac39d3eeb3989435573d0329
```

## Step 2 — version bump, lockfile diff is version-fields only

```
$ npm version 1.2.0 --no-git-tag-version
v1.2.0

$ git diff --stat
 package-lock.json | 4 ++--
 package.json      | 2 +-
 2 files changed, 3 insertions(+), 3 deletions(-)

$ git diff package.json
diff --git a/package.json b/package.json
index 7009e47..c1d7016 100644
--- a/package.json
+++ b/package.json
@@ -1,6 +1,6 @@
 {
   "name": "sketchforge",
-  "version": "1.1.0",
+  "version": "1.2.0",
   "private": true,

$ git diff package-lock.json
diff --git a/package-lock.json b/package-lock.json
index c484dff..a78698c 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,12 +1,12 @@
 {
   "name": "sketchforge",
-  "version": "1.1.0",
+  "version": "1.2.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "sketchforge",
-      "version": "1.1.0",
+      "version": "1.2.0",
       "license": "AGPL-3.0-only",
       "dependencies": {
         "@tailwindcss/postcss": "^4.1.8",
```

Only the two `"version"` fields changed in the lockfile (root `version` and
the root package entry's `version` under `packages[""]`) — no dependency
entry touched. No `--no-git-tag-version` tag was created (confirmed by
`npm version`'s own behavior with that flag, and no `git tag` command was
ever run this pass).

## Step 3 — full unit suite, test-prints untouched

```
$ npm test
> sketchforge@1.2.0 test
> vitest run --config tests/vitest.config.ts

 Test Files  49 passed (49)
      Tests  415 passed (415)

$ git status --short test-prints/
(no output — nothing changed under test-prints/)
```

## Step 4 — commit and push

```
$ git add package.json package-lock.json
$ git status --short
M  package-lock.json
M  package.json
$ git commit -m "Bump version to 1.2.0 ..."
[main 9d73496] Bump version to 1.2.0
 2 files changed, 3 insertions(+), 3 deletions(-)
$ git push origin main
   73586ee..9d73496  main -> main
```

## Step 5 — polling the public Actions API for an automatic run

Polled `https://api.github.com/repos/marlin1111ai/marlin-cad/actions/runs?per_page=5`
every 30 seconds. A run matching this push's head SHA
(`9d7349619d9682543bb6d08fe3ddce6b7dc7a745`) appeared on the **first poll**,
well inside the 3-minute no-run-appeared threshold:

```
Watching for a run with head_sha=9d7349619d9682543bb6d08fe3ddce6b7dc7a745
Poll start: 2026-09-05T02:34:33Z
[02:34:33] attempt 1: {"id":33939448777,"name":"CI","event":"push","status":"in_progress", ...}
```

The repo runs two workflows on every push (`ci.yml` and `docker.yml`); the
first hit was `CI`. Listing the last 10 runs by head SHA to find the Docker
publish run specifically:

```
{"id":33939448777,"name":"CI","path":".github/workflows/ci.yml","event":"push","status":"completed","conclusion":"success","head_sha":"9d73496","created_at":"2026-09-05T02:34:20Z"}
{"id":33939448755,"name":"Build and Push Docker Images","path":".github/workflows/docker.yml","event":"push","status":"in_progress","conclusion":null,"head_sha":"9d73496","created_at":"2026-09-05T02:34:20Z"}
{"id":33939151511,"name":"CI","path":".github/workflows/ci.yml","event":"push","status":"completed","conclusion":"success","head_sha":"73586ee","created_at":"2026-09-05T02:28:08Z"}
{"id":33939151506,"name":"Build and Push Docker Images","path":".github/workflows/docker.yml","event":"push","status":"completed","conclusion":"success","head_sha":"73586ee","created_at":"2026-09-05T02:28:08Z"}
{"id":33938953656,"name":"Build and Push Docker Images","path":".github/workflows/docker.yml","event":"push","status":"completed","conclusion":"success","head_sha":"4be03de","created_at":"2026-09-05T02:23:54Z"}
{"id":33938953575,"name":"CI","path":".github/workflows/ci.yml","event":"push","status":"completed","conclusion":"success","head_sha":"4be03de","created_at":"2026-09-05T02:23:54Z"}
{"id":33935445149,"name":"CI","path":".github/workflows/ci.yml","event":"push","status":"completed","conclusion":"success","head_sha":"ea0464a","created_at":"2026-09-05T01:12:19Z"}
{"id":33935445120,"name":"Build and Push Docker Images","path":".github/workflows/docker.yml","event":"push","status":"completed","conclusion":"success","head_sha":"ea0464a","created_at":"2026-09-05T01:12:19Z"}
{"id":33922552951,"name":"Build and Push Docker Images","path":".github/workflows/docker.yml","event":"push","status":"completed","conclusion":"success","head_sha":"d3c864d","created_at":"2026-09-04T21:45:38Z"}
{"id":33922552901,"name":"CI","path":".github/workflows/ci.yml","event":"push","status":"completed","conclusion":"success","head_sha":"d3c864d","created_at":"2026-09-04T21:45:37Z"}
```

**Notable finding, from evidence not asked for by name but directly relevant:**
`docker.yml` has already been firing automatically, unattended, with
`event: "push"`, on every one of the last several pushes to `main`
(`d3c864d`, `ea0464a`, `4be03de`, `73586ee`) — this pass's push is not the
first automatic run, it's confirmation the behavior already established in
the prior session (per `reference/SESSION-STATE.md`'s Release process
section) continues to hold for a genuinely new version bump specifically.

Polled the specific `docker.yml` run (id `33939448755`) every 30 seconds
until it completed:

```
[02:36:06] run 33939448755 status: in_progress|null
[02:36:36] run 33939448755 status: in_progress|null
[02:37:06] run 33939448755 status: in_progress|null
[02:37:36] run 33939448755 status: completed|success
```

Full run detail:

```json
{
  "id": 33939448755,
  "name": "Build and Push Docker Images",
  "path": ".github/workflows/docker.yml",
  "event": "push",
  "status": "completed",
  "conclusion": "success",
  "head_sha": "9d7349619d9682543bb6d08fe3ddce6b7dc7a745",
  "head_branch": "main",
  "run_started_at": "2026-09-05T02:34:20Z",
  "updated_at": "2026-09-05T02:37:32Z",
  "html_url": "https://github.com/marlin1111ai/marlin-cad/actions/runs/33939448755",
  "run_attempt": 1
}
```

**Result: SUCCESS, triggered automatically by `push`, no manual dispatch.**
No STOP condition was hit (a matching run appeared on the first poll, well
under 3 minutes; the run's conclusion was `success`, not a failure).

## Step 6 — GHCR tag verification (anonymous)

Anonymous GHCR pull token obtained via `https://ghcr.io/token?scope=repository:marlin1111ai/marlin-cad:pull`
(the token itself is not pasted here, per the redaction rule — it is a
short-lived, scope-limited anonymous pull token, not a durable credential).

```
$ curl -s -H "Authorization: Bearer <redacted>" https://ghcr.io/v2/marlin1111ai/marlin-cad/tags/list
name: marlin1111ai/marlin-cad
tags: ["1.0.0","latest","main","1.1.0","sha-23571b9","sha-d3c864d","sha-ea0464a","sha-4be03de","sha-73586ee","1.2.0","sha-9d73496"]
```

`1.2.0`, `main`, `latest`, and a `sha-9d73496` tag are all present, alongside
`1.1.0` and `1.0.0` still present, unmoved.

**Digest cross-check**, confirming `1.2.0`/`latest`/`main`/`sha-9d73496` all
resolve to the SAME freshly-built image, and that `1.1.0`/`1.0.0` resolve to
their own distinct, untouched digests:

```
1.2.0      -> sha256:c4174a3c0dd3b5dd73b0112b1210d3206daea24a9a07f236addcacb1dc2dfc1e
latest     -> sha256:c4174a3c0dd3b5dd73b0112b1210d3206daea24a9a07f236addcacb1dc2dfc1e
main       -> sha256:c4174a3c0dd3b5dd73b0112b1210d3206daea24a9a07f236addcacb1dc2dfc1e
sha-9d73496 -> sha256:c4174a3c0dd3b5dd73b0112b1210d3206daea24a9a07f236addcacb1dc2dfc1e
1.1.0      -> sha256:54b99aec39fb4b9cdcf542bc282125db572732a12ca7ba9407130e6f74f38823
1.0.0      -> sha256:b38705679fc1e72b1f159993b5cdfb64702cbd5b74a47eeaad06940f9b5de6d2
```

`1.1.0` and `1.0.0` are confirmed untouched — different digests from `1.2.0`
and from each other, exactly as before this pass.

## Credential scan

Every command output pasted in this report was scanned for `ghp_`, `ghs_`,
`token`, `secret`, `password`: the only literal match is the word "token" in
this report's own prose describing the redaction, and in the GHCR bearer
token HTTP header placeholder (`<redacted>`) — the actual token value was
never printed to the terminal or pasted anywhere in this report.

## SCOPE CHECK

```
$ git status --short          (after step 4's push, before this report)
(clean)
```

| File | Action | Step |
|---|---|---|
| `package.json` | edited — version field only, `1.1.0` → `1.2.0` | 2 |
| `package-lock.json` | edited — two version fields only, no dependency changed | 2 |
| `reference/reports/release-1.2.0.md` | created (this report) | deliverable |

**Not touched, confirmed by not appearing in any diff this pass:**
`apps/web/src/lib/multiconnectContainerGeometry.ts`, `socketTrayGeometry.ts`,
`mountedSocketTrayGeometry.ts`, every file under `test-prints/`,
`deploy/docker/Dockerfile`, every file under `.github/workflows/`, every
dependency entry in `package.json`/`package-lock.json`. No git tag was ever
created (`npm version ... --no-git-tag-version` was used specifically to
avoid it, and no `git tag` command was run).

## Closing summary (plain English)

**Did it publish automatically without any manual GitHub click this time?**
Yes. The `Build and Push Docker Images` workflow (`docker.yml`) fired on
`event: push` the moment `9d73496` landed on `main` — no Actions-tab click,
no workflow_dispatch, nothing manual — and completed with `conclusion:
success` about 3.5 minutes later. (Evidence beyond what was asked: this has
in fact been true automatically for every push since the permissions fix
landed, not just this one — the last four pushes before this one all show
the same unattended `docker.yml` run.)

**The exact image reference for Unraid:** `ghcr.io/marlin1111ai/marlin-cad:1.2.0`

**Confirmation 1.1.0 and 1.0.0 are untouched:** Confirmed — both tags are
still present in the GHCR tag list, and each resolves to its own distinct
manifest digest, unchanged from before this pass and different from the new
`1.2.0` digest.

**Anything that still needs a manual step:** Only the one step the Release
process in `reference/SESSION-STATE.md` has always named as the owner's own:
changing the tag in the Unraid container's image field from `1.1.0` to
`1.2.0` and applying the update. Nothing on the GitHub/Actions/GHCR side
needs a manual step anymore.
