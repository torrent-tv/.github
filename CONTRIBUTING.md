# Contributing to Torrent TV

These rules apply to every repository of the `torrent-tv` organization unless a
repository states otherwise.

## Tasks

All planning and tracking happen on GitHub: every task is an issue in
[`torrent-tv/meta`](https://github.com/torrent-tv/meta/issues), and the
organization project [Torrent TV](https://github.com/orgs/torrent-tv/projects)
is the board that orders and tracks them. Work spanning several repositories is
still one issue in `meta`. There is no other list of planned work.

Start work only from an issue. Its number, written `ttv-<number>`, names the
branch and every commit of that work; each repository links `ttv-<number>` to
the issue.

## Branches

Every working branch is created from `main` for one task and named

```
<type>/ttv-<issue>-<description>
```

- `type` is a commit type from the list below.
- `issue` is the issue number in `torrent-tv/meta`.
- `description` is lower case: `a-z`, `0-9`, `.` and `-`.

Example: `fix/ttv-12-keep-subtitle-track`. CI rejects a pull request from a
branch that does not conform.

## Commits

Every commit header follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
and ends with the task it belongs to:

```
<type>(<scope>)!: <subject> #ttv-<issue>
```

- `type` is one of `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`,
  `ci`, `chore`, `style`, `revert`.
- `scope` is optional and names the part that changed: `fix(subtitles): …`.
- `!` or a `BREAKING CHANGE:` footer marks a breaking change.
- `#ttv-<issue>` is the issue number in `torrent-tv/meta`:
  `fix(subtitles): keep the chosen track across episodes #ttv-12`.

Commits made by the organization's own workflows (releases, dependency updates,
installing a proxy release into the add-on) carry no task reference.

CI rejects a pushed commit whose header does not conform. To check before
committing, enable the repository's hook once per clone:

```bash
git config core.hooksPath .githooks
```

## Versions and releases

Nobody bumps a version by hand and nobody publishes from a workstation. A push
or merge to `main` runs the checks and, when they pass, the release:

| Commits since the last `v*` tag | Release |
|---|---|
| any `feat`, or any breaking change | minor |
| `fix`, `perf` or `revert` only | patch |
| anything else (`docs`, `test`, `ci`, `chore`, `refactor`, …) | none |

Breaking changes give a minor release because the project does not publish
major versions for now.

The release job writes the version into the version file, renames the
`## Unreleased` section of `CHANGELOG.md` to that version, commits
`chore(release): <version>`, tags `v<version>`, publishes, and creates the
GitHub release from the changelog section.

A releasable change therefore adds its entry under `## Unreleased` at the top of
the changelog, in the existing format (`- **New**/**Fix**/**Chore**: …`). CI
fails a push that makes a release without such an entry, or that adds a version
heading by hand.

A release can also be started from the Actions tab (`workflow_dispatch`) with an
explicit `patch` or `minor` step.

## Environments

There is one environment, `production`. Release jobs run in it, and the secrets
they need are stored on it.

## Dependencies

Each npm repository updates its dependencies daily within the ranges in
`package.json`, applies non-breaking security fixes, runs its tests and pushes
the result to `main`. An update that changes what is shipped is committed as
`fix(deps)` and released; one that changes only the development lock file is
`chore(deps)`. The daily job fails while a known vulnerability remains that needs
a breaking upgrade.
