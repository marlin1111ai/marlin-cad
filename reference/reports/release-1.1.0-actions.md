# Actions diagnosis for the 1.1.0 release — STOPPED, owner action required

**Cause found and confirmed: this repository is a fork, and GitHub disables
workflows on a fork that already contained workflow files when it was
forked. Nothing is wrong with the workflow definitions.**

The fix is a single button in the repository's own Actions tab. It cannot be
done from this box: the GitHub CLI is not installed and this session has no
authenticated GitHub access, so step 2 of the brief sent this straight to
step 6. **No file was modified, no git tag was created, no workflow was
edited, and the existing GHCR image is untouched.**

Exact owner instructions are in "What the owner must click" below.

## Step 1 — clean tree, HEAD == origin/main

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
$ git fetch origin
$ git rev-parse HEAD origin/main
2e19746ca4a8b1e1a683d5fe58d595be62b06293
2e19746ca4a8b1e1a683d5fe58d595be62b06293
```

## Step 2 — the GitHub CLI is not installed

```
$ command -v gh
  gh: NOT FOUND on PATH

$ for p in /usr/bin/gh /usr/local/bin/gh ~/.local/bin/gh /snap/bin/gh /opt/homebrew/bin/gh; do [ -x "$p" ] && echo "found: $p"; done
  (no output — not installed anywhere obvious)

$ apt-cache policy gh
gh:
  Installed: (none)
  Candidate: 2.45.0-1ubuntu0.3
```

`gh auth status` could not be run because `gh` does not exist. It is
available from apt but installing it is a system change this task does not
authorise, so it was not installed.

Per the brief ("If gh is not installed or not authenticated, skip to step
6"), steps 3–5 and 7 could not be performed as written. What follows is the
step-3 diagnosis carried out by the only means available: unauthenticated
reads of the public GitHub API. No credential was used or needed.

## Step 3 — diagnosis (by unauthenticated API, since gh is unavailable)

**Cause, in one sentence: `marlin1111ai/marlin-cad` is a fork of
`Formsmith746/SketchForge-3D`, and GitHub disables Actions by default on any
fork that contained workflow files at the time it was forked — so all four
workflows are registered and valid but have never been allowed to run.**

### The evidence

```
$ curl -s https://api.github.com/repos/marlin1111ai/marlin-cad
  full_name       : "marlin1111ai/marlin-cad"
  private         : false
  visibility      : "public"
  fork            : true                      <-- the cause
  archived        : false
  disabled        : false
  default_branch  : "main"
  created_at      : "2026-08-21T17:50:42Z"
  pushed_at       : "2026-09-04T19:26:19Z"
  owner           : "marlin1111ai (type: User)"
  parent          : Formsmith746/SketchForge-3D
  source          : Formsmith746/SketchForge-3D
```

```
$ curl -s .../actions/workflows
   active   .github/workflows/ci.yml
   active   .github/workflows/desktop-release.yml
   active   .github/workflows/docker.yml
   active   .github/workflows/sanity-content-deploy.yml

$ curl -s ".../actions/runs?per_page=1"
  total runs (all workflows, all time): 0
```

### The control case that isolates it

The upstream repository this was forked from runs the **same workflow files**
successfully:

```
$ curl -s "https://api.github.com/repos/Formsmith746/SketchForge-3D/actions/runs?per_page=1"
  total runs on upstream: 139
```

Same files, same triggers, 139 runs upstream versus 0 here. That rules out
the workflow definitions, the trigger syntax, and the YAML as causes, and
isolates the difference to this repository's own Actions state.

### Why every observation fits

| Observation | Explained by the fork disable? |
|---|---|
| All four workflows `state: active` | Yes — the workflow *files* are registered and valid; the fork-level block is separate from per-workflow state |
| 0 runs ever, across all workflows | Yes — the block applies to every workflow in the fork |
| `ci.yml` fires on every push, yet never ran, across 7 pushes to `main` today | Yes |
| Repo is neither `archived` nor `disabled` | Yes — those are different flags, both false |
| `1.0.0` and `latest` exist on GHCR with no `main` or `sha-*` tags | Yes — consistent with the prior finding that those images were not built by Actions |

Confidence is high but not absolute: the authoritative endpoint,
`GET /repos/marlin1111ai/marlin-cad/actions/permissions`, requires
authentication and returned `HTTP 401`, so the disabled state could not be
read directly. The fork status plus the 0-vs-139 control is strong
circumstantial evidence for the standard fork behaviour, and I could not
distinguish it from an account-level Actions disable without auth. Both are
resolved from the same settings area, and the instructions below cover the
common case first.

### A side finding this also explains

The previous report flagged that two different GHCR image names are committed
here: `ghcr.io/marlin1111ai/marlin-cad` (what `docker.yml` and Unraid use)
versus `ghcr.io/formsmith746/sketchforge-3d` (in
`deploy/docker/compose-ghcr.yaml:3` and `README.md:155`). **The fork explains
it**: those two files are inherited upstream files naming the upstream's own
image, while `docker.yml` publishes to
`ghcr.io/${{ github.repository }}`, which resolves to the fork's own name.
Not a defect to fix here, and nothing was edited.

`.github/SETUP.md` is likewise an inherited upstream document — it names
`Formsmith746/SketchForge-3D` as the release owner (`:5`, `:12-13`).

## Step 4 — not fixable from this box

The fix is a repository setting. It requires either the GitHub web UI or an
authenticated API call, and this box has neither `gh` nor any GitHub
credential. Nothing was attempted or guessed at.

## Steps 5 and 7 — not performed

Step 5 (dispatch `docker.yml`) and step 7 (report pushed tags) both depend on
Actions being able to run. They were not attempted. **No git tag was created
or pushed** — the desktop release workflow triggers on `v*` tags and would
publish a public GitHub Release, which the brief forbids.

## Step 6 — STOP: what the owner must click

### 1. Enable workflows on the fork

Open:

```
https://github.com/marlin1111ai/marlin-cad/actions
```

The page should show a yellow banner reading roughly *"Workflows aren't being
run on this forked repository. Because this repository contained workflow
files when it was forked, we have disabled them on this fork."*

Click the button on that banner:

```
I understand my workflows, go ahead and enable them
```

That is the whole fix for the expected cause.

### 2. If there is no such banner

Then the block is at the repository or account level instead. Open:

```
https://github.com/marlin1111ai/marlin-cad/settings/actions
```

Under **Actions permissions**, select:

```
Allow all actions and reusable workflows
```

and Save. If that section is missing or greyed out, the block is at the
account level: check `https://github.com/settings/actions` and the account's
billing/spending limits, since Actions minutes are metered even though public
repositories are free.

### 3. Then trigger the Docker build

Once workflows are enabled, `docker.yml` still needs an event. Either:

- **Actions tab → "Build and Push Docker Images" → "Run workflow" → branch
  `main` → Run workflow**, or
- push any commit to `main` (a later session can do this).

Do **not** push a git tag: `v*.*.*` triggers `Desktop Release`, which builds
desktop binaries and publishes a public GitHub Release.

### 4. Optional, same page, not confirmed necessary

`.github/SETUP.md:22-24` says the Desktop Release workflow needs **Settings →
Actions → General → Workflow permissions → Read and write permissions**.
`docker.yml` declares its own `permissions: packages: write, contents: read`
(`:16-18`), so it should not need the repo default changed. Worth a glance
while on that page; not part of this fix.

## The thing that still will not work, even after all of the above

**`ghcr.io/marlin1111ai/marlin-cad:1.1.0` will still not exist.**

`docker.yml:39-42` emits exactly three tags and none is a version:

```yaml
          tags: |
            type=ref,event=branch
            type=sha,format=short
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}
```

A successful run on `main` will publish `main`, `sha-<short>`, and `latest` —
no `1.1.0`. Producing a `1.1.0` tag requires adding a `type=semver` rule (and
a tag trigger, or a dispatch input) to `docker.yml`. **Editing that workflow
is explicitly out of scope for this task, so it was not touched and no
patch was drafted.** This is the one open question for the owner: whether to
change the workflow so it emits version tags, or to pin Unraid to a
digest or to `latest` instead.

## GHCR state right now — unchanged

Read anonymously from the public registry, no credentials:

```
$ curl -s "https://ghcr.io/token?scope=repository:marlin1111ai/marlin-cad:pull&service=ghcr.io"
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

`1.0.0` is present and untouched. Unraid should stay on
`ghcr.io/marlin1111ai/marlin-cad:1.0.0` until a new image actually exists.

## Open questions

1. **Whether the banner is actually there.** The authoritative permissions
   endpoint needs auth (`HTTP 401`), so the fork-disable is inferred from
   `fork: true` plus the 0-vs-139 control rather than read directly. If there
   is no banner, instruction 2 above covers the alternative.
2. **Whether `docker.yml` should gain a `type=semver` rule.** Out of scope
   here; the owner decides. Without it there will never be a `1.1.0` tag.
3. **Whether `1.1.0` is even the right number.** `package.json` says `1.0.4`,
   Unraid pins `1.0.0`. Unresolved from the previous report.
4. **Whether installing `gh` on this box is wanted.** It is in apt
   (`2.45.0-1ubuntu0.3`) and would make future release work self-service, but
   it is a system change plus an auth flow the owner would have to complete.
5. **Whether the two inherited upstream files** (`compose-ghcr.yaml`,
   `README.md`) that name the upstream image should be corrected for this
   fork. Not touched.

## Credential scan

No token, PAT, or credential appears in this report. `gh auth status` was
never run because `gh` is absent. The anonymous GHCR pull token used for the
tag listing was confined to one shell pipeline, never printed, and unset
immediately; it is a short-lived public read token tied to no account. No
`docker login` was run, no PAT was read, `~/.docker/config.json` was never
opened, and every GitHub API call was unauthenticated.

## SCOPE CHECK

```
$ git status              (before committing this report)
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean

$ git tag --list
(empty)
$ git ls-remote --tags origin
(empty)
```

| Path | Action |
|---|---|
| `reference/reports/release-1.1.0-actions.md` | **created — the only file created or modified** |
| `.github/workflows/*` | read only, **not edited** |
| `.github/SETUP.md` | read only |
| `deploy/docker/*` including the Dockerfile | read only, not edited |
| `package.json`, every config file | not touched |
| `apps/web/src/lib/{multiconnect,socket,mountedSocket}*Geometry.ts` | not opened |
| `test-prints/` | not touched |
| Existing GHCR `1.0.0` image and tag | **not touched** — read anonymously only |
| Git tags | **none created, pushed, moved or deleted** — repo still has zero tags |
| Unraid | not touched |

No workflow, Dockerfile, or config edit. No `docker` command (none
installed). No `gh` installed. No git tag. No force push. Nothing outside
steps 1–7.
