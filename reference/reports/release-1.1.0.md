# Release 1.1.0 to GHCR — investigation, STOPPED at step 4

**Outcome: no release was made. No git tag was created, nothing was pushed,
and no file was modified. The brief's assumed release procedure does not
exist in this repo.**

Every STOP condition in step 4 except "there is no publishing workflow at
all" is met, and a further blocker was found that none of them anticipated:
**GitHub Actions has never executed a single run on this repository.**

This is a read-only investigation. The only file created is this report.

## Step 1 — clean tree, HEAD == origin/main

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
$ git fetch origin
$ git rev-parse HEAD origin/main
5866b10674029e2afa60aab7bc4b33a75459ddb5
5866b10674029e2afa60aab7bc4b33a75459ddb5
```

HEAD is `5866b10` as the brief expected.

## Step 2 — how a GHCR image actually gets built and tagged

`.github/workflows/docker.yml` is the only workflow that touches GHCR. Its
trigger section, verbatim (`:1-11`):

```yaml
name: Build and Push Docker Images

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: docker-publish-${{ github.ref }}
  cancel-in-progress: true
```

**There is no `tags:` filter.** The workflow fires on a push to `main`, or on
a manual `workflow_dispatch`. Pushing a git tag does not trigger it at all.

Its tag-derivation section, verbatim (`:34-42`):

```yaml
      - name: Extract Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=sha,format=short
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}
```

For a push to `main` that yields exactly three tags:

| Rule | Tag produced |
|---|---|
| `type=ref,event=branch` | `main` |
| `type=sha,format=short` | `sha-<7 chars>` |
| `type=raw,value=latest` | `latest` |

**No semver tag is ever produced.** There is no `type=semver` rule, and no
version number is read from anywhere. The workflow has no notion of `1.1.0`.

Confirmed against the whole repo history — `type=semver` has never existed:

```
$ git log --oneline -S 'type=semver' --all -- .github/workflows/
(no output)
$ git log --oneline --follow -- .github/workflows/docker.yml
2073104 release: publish v0.6.0
f91aa2f ci: prevent stalled multi-platform Docker builds
2bd40b9 [feature] Add prebuilt docker images
```

### The other workflows

| Workflow | Trigger | Publishes an image? |
|---|---|---|
| `ci.yml` | `push`, `pull_request` (all branches) | No — typecheck and unit tests |
| `docker.yml` | push to `main`, `workflow_dispatch` | **Yes**, to GHCR, but never with a semver tag |
| `desktop-release.yml` | **`push: tags: - "v*.*.*"`**, `workflow_dispatch` | No — builds Windows/Linux/macOS desktop apps and a GitHub Release |
| `sanity-content-deploy.yml` | `repository_dispatch`, `workflow_dispatch` | No — Cloudflare Workers static deploy |

**A `v*.*.*` tag is not inert here.** Pushing `v1.1.0` would trigger
`desktop-release.yml` (`:4-8`), which builds desktop binaries across five
runners and publishes a GitHub Release. It would produce no Docker image.
That is an outward-facing side effect the brief did not intend, and is a
second reason not to improvise.

## Step 3 — version declarations and existing tags

```
$ git tag --list
(no output — no local tags)

$ git ls-remote --tags origin
(no output — no tags on origin)
```

**There are no git tags in this repository at all, local or remote.**

Version numbers in tracked files:

| Location | Value |
|---|---|
| `package.json:3` | `"version": "1.0.4"` |
| `apps/web/src/lib/skfProject.ts:15` | `SKF_CREATED_WITH_VERSION = "1.0.4"` |
| `docs/CHANGELOG.md:3` | `## 1.0.4` |
| `README.md:22` | version badge `v1.0.4` |
| `.github/workflows/desktop-release.yml:11` | dispatch input example `1.0.4` |
| `.github/SETUP.md:35` | "Push a tag such as `v1.0.4`" |
| `reference/SESSION-STATE.md:164` | Unraid pulls `ghcr.io/marlin1111ai/marlin-cad:1.0.0` |
| `reference/DECISIONS.md:17` | "Unraid pins a version tag (`1.0.0`), never `:latest`" |

No `package.json` (or any other tracked file) declares `1.0.0`. The repo's
own version is already `1.0.4`, four patches ahead of what Unraid pins.
`docker.yml` reads none of these values.

**Image-name drift, noted not acted on.** `docker.yml:38` publishes to
`ghcr.io/${{ github.repository }}`, which for remote
`git@github.com:marlin1111ai/marlin-cad.git` is
`ghcr.io/marlin1111ai/marlin-cad` — matching SESSION-STATE. But
`deploy/docker/compose-ghcr.yaml:3` and `README.md:155` both name a
different image, `ghcr.io/formsmith746/sketchforge-3d:latest`. Recorded as an
open question; no file was touched.

## Step 4 — STOP

Three of the four stated STOP conditions are met:

| Condition | Met? | Evidence |
|---|---|---|
| The workflow is not triggered by pushing a git version tag | **Yes** | `docker.yml:3-7` has no `tags:` filter |
| A version number must be edited in a tracked file for the tag to be correct | No | `docker.yml` reads no version at all |
| The tag naming convention differs from `1.1.0` / `v1.1.0` | **Yes** | it emits `main`, `sha-<short>`, `latest` |
| There is no publishing workflow at all | **Yes, in effect** | see below — it exists but has never run |

### The blocker none of those conditions covers

The repository is public, so its Actions history can be read without
credentials:

```
$ curl -s https://api.github.com/repos/marlin1111ai/marlin-cad
  private: false  visibility: public  default_branch: main

$ curl -s .../actions/workflows/docker.yml/runs
  total docker.yml runs: 0

$ curl -s .../actions/runs?per_page=10
  total runs across all workflows: 0

$ curl -s .../actions/workflows
  total: 4
    CI                          | .github/workflows/ci.yml                  | state: active
    Desktop Release             | .github/workflows/desktop-release.yml     | state: active
    Build and Push Docker Images| .github/workflows/docker.yml              | state: active
    Deploy Sanity content       | .github/workflows/sanity-content-deploy.yml | state: active
```

All four workflows are registered and `active`, and **zero runs have ever
occurred across all of them** — even though `ci.yml` triggers on every push
and six commits were pushed to `main` today alone:

```
  5866b10 2026-09-04 15:03:04 -0400 Bring reference/ session docs current with the Mounted Socket Tray
  c98cff5 2026-09-04 14:43:15 -0400 Add the Mounted Socket Tray: slotted Multiconnect plate + forward tray, one solid
  4eecc37 2026-09-04 13:44:10 -0400 Add read-only recon for a wall-mounted Socket Tray (tray + back plate)
  6ffc28c 2026-09-04 13:26:29 -0400 Bring reference/ session docs current with the Socket Tray UI registration
  fe3e829 2026-09-04 09:07:45 -0400 Register the Socket Tray in the editor (catalog entry + inspector)
  1827a84 2026-09-04 08:48:48 -0400 Add read-only recon report for Socket Tray UI registration
```

Even the manual escape hatch is unavailable: `workflow_dispatch` on
`docker.yml` would also be a workflow run, and none execute.

The `actions/permissions` endpoint needs authentication (`HTTP 401`), so the
cause cannot be confirmed from here. Candidates, none asserted: Actions
disabled at the repository or account level, an Actions entitlement or
billing state, or a runner restriction. **This needs the owner to look at the
Actions tab.**

### What the GHCR registry actually holds

Read anonymously from the public registry, no credentials used:

```
$ curl -s "https://ghcr.io/token?scope=repository:marlin1111ai/marlin-cad:pull&service=ghcr.io"
$ curl -s -H "Authorization: Bearer <anonymous pull token>" https://ghcr.io/v2/marlin1111ai/marlin-cad/tags/list
{
  "name": "marlin1111ai/marlin-cad",
  "tags": [
    "1.0.0",
    "latest"
  ]
}
```

Two tags: `1.0.0` and `latest`. **Both are untouched by this task.**

Note what is absent: no `main`, no `sha-*`. Those are exactly what
`docker.yml` would have created on every push to main. Their absence is
consistent with the zero-run finding — **the existing images were not built
by GitHub Actions.**

### So how did 1.0.0 get there

Not from this workflow, which has never run and cannot emit a semver tag.
The most consistent explanation in the repo's own records is a manual
`docker login ghcr.io` plus `docker push` from some machine:
`reference/OPEN-ITEMS.md` records "Rotate the GHCR personal access token — it
rendered in plaintext during a session (Docker stores it base64-encoded, not
encrypted, in `~/.docker/config.json`)", which only happens on a manual
`docker login`. This is inference from the record, not something proven here.

That path is unavailable on this box, and out of scope regardless:

```
$ command -v docker
  docker: NOT INSTALLED
$ command -v gh
  gh: not installed
```

`package.json` has `docker:build`, `docker:run`, `docker:up`, `docker:down`,
but every one needs a local Docker daemon, and `docker:build` tags
`sketchforge:local` — not a GHCR reference.

## Steps 5–8 — not performed

Step 5 is explicitly gated on step 4 finding the procedure to be "push a git
version tag and the workflow builds and publishes". It is not. **No tag was
created, nothing was pushed to origin beyond this report, no image was
built, and no existing tag or image was touched.** Steps 6, 7 and 8 depend on
step 5 and are therefore also not performed.

## What a 1.1.0 release would actually require

Recorded as findings for the owner's decision. **None of this was done**, and
each item would need its own approved task.

1. **Get Actions running.** Nothing else matters until a workflow can
   execute. This is a GitHub settings question, not a repo change.
2. **Decide how a semver tag is produced.** `docker.yml` would need a
   `type=semver` rule and a `tags:` push trigger, or the image would need to
   be built and pushed by hand as `1.0.0` apparently was. `deploy/docker/`
   and `.github/workflows/` are both do-not-touch, so neither edit was made
   or drafted.
3. **Reconcile the version number.** `package.json` says `1.0.4` while Unraid
   pins `1.0.0`. Whether "1.1.0" supersedes `1.0.4` or is a separate
   deployment line is the owner's call.
4. **Resolve the image-name drift** between `ghcr.io/marlin1111ai/marlin-cad`
   (what the workflow and Unraid use) and
   `ghcr.io/formsmith746/sketchforge-3d` (what `compose-ghcr.yaml` and the
   README use).

## Open questions

1. **Why has no workflow ever run?** Unanswerable from here; the permissions
   endpoint needs auth. The owner needs to open the repository's Actions tab.
2. **Was `1.0.0` pushed by hand?** The plaintext-PAT entry in OPEN-ITEMS
   points that way, but it is inference from the record, not proof.
3. **Which image name is correct?** Two different GHCR references are
   committed in this repo (see step 3).
4. **Is `1.0.4` or `1.1.0` the intended next version?** The repo says
   `1.0.4`; the brief asked for `1.1.0`; Unraid runs `1.0.0`.
5. **`latest` exists on GHCR** even though DECISIONS says Unraid pins a
   version and never `:latest`. Who or what consumes it is not recorded.

## Credential scan

Everything in this report was scanned for `ghp_`, `ghs_`, `github_pat_`,
`token=`, `secret`, `password` and Authorization header values before
inclusion: no credential appears. The anonymous GHCR pull token fetched
during the tag listing was used only within a single shell pipeline, never
printed, and unset immediately after; it is a short-lived public read token
tied to no account. No `docker login` was run, no PAT was read, and
`~/.docker/config.json` was never opened.

## SCOPE CHECK

```
$ git status              (before committing this report)
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

| Path | Action |
|---|---|
| `reference/reports/release-1.1.0.md` | **created — the only file created or modified** |
| `.github/workflows/*` (all four) | read only, not edited |
| `deploy/docker/*` | read only, not edited |
| `package.json`, `package-lock.json`, every config file | read only, not edited |
| `apps/web/src/lib/{multiconnect,socket,mountedSocket}*Geometry.ts` | not opened |
| `test-prints/` | not touched |
| Existing GHCR image and the `1.0.0` tag | **not touched** — read anonymously, nothing pushed, deleted or retagged |
| Git tags | **none created, moved or deleted** — the repo still has zero tags |

No code, test, doc, Dockerfile, workflow, or config edit. No `docker`
command was run (Docker is not installed). No force push. Nothing outside
steps 1–4.
