# Release 1.1.0 — banked (docs-only record of today's release fixes)

Records today's release fixes and the now-working release process in
reference/. Docs only: no app source, test, workflow, Dockerfile, or config
change; no git tag created or moved; nothing force-pushed.

## Step 1 — clean tree, HEAD == origin/main

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
$ git fetch origin
$ git rev-parse HEAD origin/main
23571b921b06f13460c5d0df1a33d2f2ac7c3e5e
23571b921b06f13460c5d0df1a33d2f2ac7c3e5e
```

## Facts recorded (owner-confirmed today)

- Docker runs on Unraid (`192.168.1.250`) only. It is not installed on the
  Linux dev box and the owner does not want it there. The `1.0.0` image was
  built and pushed from Unraid by hand.
- GitHub Actions had never run on this repo because it is a fork of
  `Formsmith746/SketchForge-3D` — GitHub disables workflows by default on a
  fork that already contained workflow files. The owner enabled it manually
  from the Actions tab and ran "Build and Push Docker Images" once
  (run #1, against commit `23571b9`).
- Run #1 failed at the push step: `denied: permission_denied: write_package`.
  Fixed by (a) Settings → Actions → General → Workflow permissions →
  "Read and write permissions", and (b) the package's own settings at
  `github.com/users/marlin1111ai/packages/container/marlin-cad/settings` →
  Manage Actions access → Add Repository `marlin-cad` → role Write. The
  re-run succeeded.
- `ghcr.io/marlin1111ai/marlin-cad:1.1.0` now exists. The owner created the
  `marlin-cad` container fresh on Unraid (host port 3001 → 3000, host path
  `/mnt/user/appdata/marlin-cad/projects` → `/data/projects`) from that tag
  and verified it in the browser. The prior container had been absent from
  the box; cause not recorded.
- Blinking Docker Manager icon fix re-applied:
  `cp /mnt/user/appdata/marlin-cad/freecad.png /usr/local/emhttp/plugins/dynamix.docker.manager/images/question.png`
  — RAM-only, lost on reboot.
- The Docker workflow now tags images with the `package.json` version on
  every push to `main`, in addition to `main` / `sha` / `latest`
  (`2c3767d`). Version is `1.1.0`.

## Step 2 — SESSION-STATE.md

**Production deployment** rewritten to the facts above: Docker runs on
Unraid only; the running image is now `1.1.0`; `1.0.0` was a hand-built
image predating Actions being enabled; the prior container's disappearance
and recreation; the icon fix re-applied.

**New "Release process" subsection**, three numbered steps: Claude Code
bumps the `package.json` version and pushes; GitHub Actions builds and
publishes `ghcr.io/marlin1111ai/marlin-cad:<version>`; the owner changes the
Unraid tag and applies. Followed by the fork-disable cause, the two
permission fixes for `write_package`, and pointers to all four release
reports (including this one).

**Dev environment** — the Docker line now states it is deliberately absent
from this box, per the owner's process (Claude Code publishes, owner pulls).

**Shipped work** gained two lines: the workflow-tagging + version-bump
change (`2c3767d` — the commit that actually edited
`.github/workflows/docker.yml` and bumped the version; not `23571b9`, which
only added a report file, see the note below), and the three release
investigation/diagnosis reports (`2e19746`, `2bde431`, `23571b9`).

**One correction made against the brief's wording.** The brief said to cite
`23571b9` for the workflow-tagging change. Checked against git history:

```
$ git show --stat --format='%h %s' 23571b9
23571b9 Record the 1.1.0 publish attempt: repo side done, Actions still disabled
 reference/reports/release-1.1.0-publish.md | 385 +++++++++++++++++++++++++++++
 1 file changed, 385 insertions(+)

$ git show --stat --format='%h %s' 2c3767d
2c3767d Tag Docker images with the package.json version; set version to 1.1.0
 .github/workflows/docker.yml | 11 +++++++++++
 package-lock.json            |  4 ++--
 package.json                 |  2 +-
 3 files changed, 14 insertions(+), 3 deletions(-)
```

`23571b9` is report-only; `2c3767d` is the actual workflow and version
change. Cited `2c3767d` for "the workflow tags images" fact and kept
`23571b9` only for the owner-stated fact that run #1 targeted that commit
(a fact about which commit was on `main` when the owner clicked Run
workflow, not about which commit changed the file).

## Step 3 — KNOWN-FIXES.md

Four entries added:

- Actions never runs on this fork → fork-disable banner / Settings path.
- Workflow fails with `denied: permission_denied: write_package` → the two
  settings above.
- `marlin-cad` container missing from Unraid → recreate from the settings
  recorded in SESSION-STATE's Production deployment section.
- Blinking Docker icon → the `cp` one-liner, noted RAM-only with the
  permanent fix (a web-hosted Icon URL) named per the brief.

## Step 4 — DECISIONS.md

Added: "Images are built by GitHub Actions and tagged with the
`package.json` version; the Linux dev box never runs Docker." Reason: the
owner's process — Claude Code publishes to GitHub, the owner pulls on
Unraid.

Amended the existing "Unraid pins a version tag, never `:latest`" entry
with one factual sentence: since `2c3767d` the version tag is re-pushed on
every push to `main`, so the tag name itself is not immutable; Unraid still
only moves when the owner changes the tag or applies an update. (Same
SHA correction as step 2 — `2c3767d` is the commit that made the tag
re-pushed, not `23571b9`.) Also updated the tag example from `1.0.0` to
"currently `1.1.0`" since the pinned tag changed today.

## Step 5 — OPEN-ITEMS.md

Two lines added, nothing removed:

- Version tag re-pushed on every push to `main` — the pinned tag's contents
  can change without a version bump; owner to decide whether that matters.
- Docker icon fix is RAM-only; permanent fix is a web-hosted Icon URL.

## Step 6 — commit and push

SHAs recorded in the closing summary and step 6 verification below, since
this report is part of that commit and cannot contain its own SHA in
advance.

## Per-file diff summary

```
$ git diff --stat
 reference/DECISIONS.md     |  3 ++-
 reference/KNOWN-FIXES.md   |  4 ++++
 reference/OPEN-ITEMS.md    |  2 ++
 reference/SESSION-STATE.md | 52 ++++++++++++++++++++++++++++++++++++++++------
 4 files changed, 54 insertions(+), 7 deletions(-)
```

## Open questions

1. **The `23571b9` vs `2c3767d` attribution.** The brief's own wording named
   `23571b9` for the workflow-tagging fact. Git history shows that change
   landed in `2c3767d`. Recorded the verifiable SHA rather than the one
   given, since the four docs are meant to be an accurate record, not a
   transcript of the brief.
2. **Cause of the missing Unraid container** was not recorded by the owner
   and is stated as unrecorded in SESSION-STATE and KNOWN-FIXES, not
   guessed at.
3. **Whether the version-tag-moves-without-a-bump behavior is acceptable**
   is left as an open item per the brief, not resolved here.

## Credential scan

Every command output and every edited line was scanned for `ghp_`, `ghs_`,
`github_pat_`, `password:`, `secret`: no hits (see the diff scan above). No
token appears anywhere in this report or the four edited docs.

## SCOPE CHECK

```
$ git status --short          (after writing this report, before commit)
 M reference/DECISIONS.md
 M reference/KNOWN-FIXES.md
 M reference/OPEN-ITEMS.md
 M reference/SESSION-STATE.md
?? reference/reports/release-1.1.0-banked.md
```

| Path | Action |
|---|---|
| `reference/SESSION-STATE.md` | edited |
| `reference/OPEN-ITEMS.md` | edited |
| `reference/DECISIONS.md` | edited |
| `reference/KNOWN-FIXES.md` | edited |
| `reference/reports/release-1.1.0-banked.md` | created (this report) |
| `reference/reports/release-1.1.0.md`, `release-1.1.0-actions.md`, `release-1.1.0-publish.md` | read only |
| All app source, all tests | not touched |
| `test-prints/`, `deploy/docker/`, `.github/workflows/` | not touched |
| `package.json`, `package-lock.json` | not touched |
| Git tags | none created or moved |

No proposals or recommendations were added to any doc; every entry records
what happened or what the owner already decided.
