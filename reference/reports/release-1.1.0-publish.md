# Publishing 1.1.0 — version bumped and workflow fixed, STOPPED at step 7

**The repo-side work is done and pushed. The image was not published, because
GitHub Actions is still disabled on this fork — seven consecutive polls over
three minutes after the push returned zero runs, while GitHub confirms it
received the commit.**

Steps 1–6 completed. Step 7 hit its stated STOP condition. Step 8 was not
reached. `ghcr.io/marlin1111ai/marlin-cad:1.1.0` **does not exist yet**;
`1.0.0` is untouched.

Owner action is a single button — see "What the owner must do" below.

## Step 1 — clean tree, and the version source of truth

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
$ git fetch origin
$ git rev-parse HEAD origin/main
2bde4319a980dd349aca9d79b126b5d50d16f2c0
2bde4319a980dd349aca9d79b126b5d50d16f2c0
```

**There is exactly one tracked `package.json`: the root one.**

```
$ git ls-files '*package.json' | grep -v node_modules
package.json

$ find . -name package.json -not -path '*/node_modules/*' -not -path './.git/*'
  ./package.json                        tracked=yes  version=1.0.4
  ./apps/web/.next-dev/package.json     tracked=NO   version=(none)
  ./apps/web/.next-dev/types/package.json tracked=NO version=(none)
```

The other two are gitignored Next.js dev-build output and declare no version
at all. So the root `package.json` (`name: sketchforge`, was `1.0.4`) is the
source of truth for the Docker image version, with nothing in the repo
suggesting otherwise. `package-lock.json` mirrored it in two places, top-level
`version` and `packages[""].version`, both `1.0.4`.

## Step 2 — version bumped to 1.1.0, lockfile change is version-only

No `preversion` / `version` / `postversion` / `prepare` / `prepublishOnly`
script exists, so `npm version` ran no hooks:

```
$ node -p "...scripts hooks..."
{}
```

```
$ npm version 1.1.0 --no-git-tag-version
v1.1.0

$ git diff --stat
 package-lock.json | 4 ++--
 package.json      | 2 +-
 2 files changed, 3 insertions(+), 3 deletions(-)

$ git diff package-lock.json
@@ -1,12 +1,12 @@
 {
   "name": "sketchforge",
-  "version": "1.0.4",
+  "version": "1.1.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "sketchforge",
-      "version": "1.0.4",
+      "version": "1.1.0",
       "license": "AGPL-3.0-only",
       "dependencies": {
         "@tailwindcss/postcss": "^4.1.8",

$ git diff package.json
@@ -1,6 +1,6 @@
 {
   "name": "sketchforge",
-  "version": "1.0.4",
+  "version": "1.1.0",
   "private": true,
```

**Proof the dependency tree did not move.** Every changed line in the lockfile
is a version field, and blanking those two fields makes the two documents
byte-identical:

```
$ git diff --numstat package-lock.json
2	2	package-lock.json

$ git diff -U0 package-lock.json | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)'
-  "version": "1.0.4",
+  "version": "1.1.0",
-      "version": "1.0.4",
+      "version": "1.1.0",

$ node -e '<blank both version fields, then compare>'
  package entries before/after : 479 / 479
  lockfileVersion before/after : 3 / 3
  everything-else identical    : true

$ node -e '<same for package.json>'
  dependencies identical       : true
  devDependencies identical    : true
  scripts identical            : true
  everything-else identical    : true
```

This matters beyond tidiness: `reference/DECISIONS.md` records that
`npm audit fix` is deliberately not run because rewriting the lockfile could
alter the byte-identical wrench-rack preset exports. 479 package entries
identical before and after means nothing in that tree moved. No STOP.

## Step 3 — workflow change

`.github/workflows/docker.yml`, full diff:

```diff
@@ -31,6 +31,16 @@ jobs:
           username: ${{ github.actor }}
           password: ${{ secrets.GITHUB_TOKEN }}
 
+      # The image's version tag comes from the root package.json, the repo's
+      # only tracked package manifest. Unraid pins a version tag and never
+      # :latest (see reference/DECISIONS.md), so a release needs a tag it can
+      # pin to; bumping the version in package.json is what produces one.
+      - name: Read package version
+        id: package
+        run: |
+          version=$(node -p "require('./package.json').version")
+          echo "version=$version" >> "$GITHUB_OUTPUT"
+
       - name: Extract Docker metadata
         id: meta
         uses: docker/metadata-action@v5
@@ -40,6 +50,7 @@ jobs:
             type=ref,event=branch
             type=sha,format=short
             type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}
+            type=raw,value=${{ steps.package.outputs.version }},enable=${{ github.ref == 'refs/heads/main' }}
 
       - name: Build and Push Docker Image
         uses: docker/build-push-action@v6
```

Additive only. What was deliberately **not** changed:

| Thing | Status |
|---|---|
| `on: push: branches: [main]` | unchanged |
| `on: workflow_dispatch` | unchanged |
| Tag triggers | **none added** — `v*` drives the desktop release workflow |
| `images: ghcr.io/${{ github.repository }}` | unchanged |
| `type=ref,event=branch` → `main` | kept |
| `type=sha,format=short` → `sha-<short>` | kept |
| `type=raw,value=latest` | kept |
| Build step, platforms, cache, Dockerfile path | unchanged |

The new version tag is gated on `refs/heads/main`, exactly matching the
existing `latest` rule, so a dispatch on some other branch cannot publish a
version tag. The `echo "version=$version" >> "$GITHUB_OUTPUT"` form matches
what `desktop-release.yml` already does, and Node is preinstalled on
`ubuntu-latest`.

## Step 4 — YAML parses

`js-yaml` was already in `node_modules`. **Nothing was installed.**

```
$ for m in yaml js-yaml; do [ -d "node_modules/$m" ] && echo found: $m || echo absent: $m; done
  absent: yaml
  found: js-yaml

$ node -e '<parse with js-yaml>'
  parsed OK
  name        : Build and Push Docker Images
  on.push     : {"branches":["main"]}
  on keys     : push, workflow_dispatch
  step names  :
    - Checkout Repository
    - Set up Docker Buildx
    - Log in to GitHub Container Registry
    - Read package version
    - Extract Docker metadata
    - Build and Push Docker Image
  images      : ghcr.io/${{ github.repository }}
  tag rules   :
     type=ref,event=branch
     type=sha,format=short
     type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}
     type=raw,value=${{ steps.package.outputs.version }},enable=${{ github.ref == 'refs/heads/main' }}
  version step present: true
```

Triggers, image name and all four tag rules confirmed by the parser, not by
eye.

## Step 5 — full unit suite

```
$ npm test
> sketchforge@1.1.0 test          <- the bump is live

 Test Files  49 passed (49)
      Tests  378 passed (378)
   Duration  2.20s
EXIT: 0

$ git status --short test-prints/
(empty — nothing under test-prints/ modified)

$ git status --short
 M .github/workflows/docker.yml
 M package-lock.json
 M package.json
```

Exactly the three files this task was allowed to edit.

## Step 6 — committed and pushed

```
$ git log --oneline -1
2c3767d Tag Docker images with the package.json version; set version to 1.1.0

$ git push origin main
  push started at 2026-09-04T21:10:24Z
To github.com:marlin1111ai/marlin-cad.git
   2bde431..2c3767d  main -> main
push exit=0
  push finished at 2026-09-04T21:10:25Z

$ git fetch origin && git rev-parse HEAD origin/main
2c3767daa504ad1dca3d7dde79701d4784f84cc9
2c3767daa504ad1dca3d7dde79701d4784f84cc9
```

## Step 7 — STOP: no run appeared

Push landed at **21:10:25Z**. Polled the public API every 30 seconds:

```
watching for a run on 2c3767daa504ad1dca3d7dde79701d4784f84cc9
--- t+0s    total_runs=0
--- t+30s   total_runs=0
--- t+60s   total_runs=0
--- t+90s   total_runs=0
--- t+120s  total_runs=0
--- t+150s  total_runs=0
--- t+180s  total_runs=0
==> 3 MINUTES ELAPSED, STILL ZERO RUNS
```

Independent check past the gate:

```
  now: 2026-09-04T21:13:40Z   (push 21:10:25Z, gate 21:13:25Z)
  total runs across all workflows, all time: 0

  workflow states:
   active   .github/workflows/ci.yml
   active   .github/workflows/desktop-release.yml
   active   .github/workflows/docker.yml
   active   .github/workflows/sanity-content-deploy.yml
```

**GitHub definitely received the push** — this is not a delivery problem:

```
$ git ls-remote origin refs/heads/main
2c3767daa504ad1dca3d7dde79701d4784f84cc9	refs/heads/main
```

So the commit is on `origin/main`, `docker.yml` triggers on push to `main`,
`ci.yml` triggers on every push, all four workflows are `active` — and the
run count across all of them, all time, is still zero. **Actions has not been
enabled on the fork yet.** This is the same condition diagnosed in
`reference/reports/release-1.1.0-actions.md`: the repo is a fork of
`Formsmith746/SketchForge-3D` (`fork: true`), and GitHub disables workflows on
a fork that already contained workflow files.

## Step 8 — not reached

GHCR is unchanged. Read anonymously, no credentials:

```
$ curl -s -H "Authorization: Bearer <anonymous pull token>" \
       https://ghcr.io/v2/marlin1111ai/marlin-cad/tags/list
{
  "name": "marlin1111ai/marlin-cad",
  "tags": [
    "1.0.0",
    "latest"
  ]
}
```

**`1.1.0` is absent. `1.0.0` is present and untouched.**

## What the owner must do

1. Open `https://github.com/marlin1111ai/marlin-cad/actions` and click the
   banner button **"I understand my workflows, go ahead and enable them"**.
   If there is no banner, open
   `https://github.com/marlin1111ai/marlin-cad/settings/actions` and set
   **Actions permissions** to **"Allow all actions and reusable workflows"**.
2. Then either click **Run workflow** on "Build and Push Docker Images" for
   `main`, or let the next push to `main` trigger it. Do **not** push a git
   tag — `v*` drives the desktop release workflow.

On a successful run the image should publish under four tags: `main`,
`sha-<short>`, `latest`, and **`1.1.0`**. Unraid then pins:

```
ghcr.io/marlin1111ai/marlin-cad:1.1.0
```

Until that run succeeds, Unraid stays on `:1.0.0`.

**Note on the report commit.** The brief anticipated that pushing this report
would trigger a second run. With Actions disabled it will trigger nothing.
Once Actions is enabled, the report commit is a perfectly good trigger — its
version is still 1.1.0, so it would publish the same version tag.

## Open questions

1. **The version tagging is written and parses, but has never executed.** No
   run has ever happened on this fork, so the `steps.package.outputs.version`
   wiring is unproven at runtime. It follows the same pattern
   `desktop-release.yml` uses, but that workflow has never run here either.
2. **`SKF_CREATED_WITH_VERSION` is still `1.0.4`**
   (`apps/web/src/lib/skfProject.ts:15`). It is a hardcoded app constant, not
   read from `package.json`, and it is an app source file this task must not
   touch. Saved `.skf` files will record "created with 1.0.4" while the app
   and image say 1.1.0. No test caught this because nothing asserts the two
   match. Recorded, not fixed.
3. **Whether 1.1.0 is the right number.** `1.0.4` was the previous value,
   Unraid runs `1.0.0`. 1.1.0 was the brief's instruction, and it is a
   forward move from both, but the numbering scheme is the owner's call.
4. **`latest` will also be republished** by a successful run. DECISIONS says
   Unraid pins a version and never `:latest`, so this should be harmless, but
   whatever consumes `latest` today would move.
5. **Whether the fork-enable button is actually present.** The authoritative
   `actions/permissions` endpoint requires auth (`HTTP 401`), so the fork
   disable remains inference from `fork: true` plus zero-runs-versus-139-
   upstream, not a direct read.

## Credential scan

No token, PAT, or credential value appears in this report. The one grep hit,
`password: ${{ secrets.GITHUB_TOKEN }}`, is an unchanged context line inside
the step-3 diff: a GitHub Actions expression naming a secret, not a secret
value, and already committed in the workflow. Every GitHub API call was
unauthenticated. The anonymous GHCR pull token used for the tag listing was
confined to one shell pipeline, never printed, and unset immediately; it is a
short-lived public read token tied to no account. No `docker login`, no PAT
read, `~/.docker/config.json` never opened.

## SCOPE CHECK

| Path | Action | Step |
|---|---|---|
| `package.json` | edited — **version field only**, 1.0.4 → 1.1.0 | 2 |
| `package-lock.json` | edited — **the two version fields only**, proven by diff and structural compare | 2 |
| `.github/workflows/docker.yml` | edited — one step added, one tag rule added; triggers, image name and existing tags untouched | 3 |
| `reference/reports/release-1.1.0-publish.md` | created (this report) | deliverable |
| every dependency entry in `package.json` / `package-lock.json` | **not changed** — 479 entries identical | 2 |
| `.github/workflows/ci.yml`, `desktop-release.yml`, `sanity-content-deploy.yml` | **not touched** | do-not-touch |
| `deploy/docker/Dockerfile` and all of `deploy/docker/` | **not touched** | do-not-touch |
| `apps/web/src/lib/{multiconnect,socket,mountedSocket}*Geometry.ts` | not opened | do-not-touch |
| `test-prints/` | **not touched**, verified by `git status` | 5 |
| Existing GHCR `1.0.0` image and tag | **not touched** — read anonymously only | 8 |
| Git tags | **none created or pushed** — repo still has zero tags | — |
| Unraid | not touched | — |

No new tool installed (`js-yaml` was already present). No `docker` command
(none installed). No force push. Nothing outside steps 1–8.
