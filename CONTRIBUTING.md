# Contributing to Torrent TV

These rules apply to every repository of the `torrent-tv` organization unless a
repository states otherwise.

## Commits

Every commit header follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>)!: <subject>
```

- `type` is one of `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`,
  `ci`, `chore`, `style`, `revert`.
- `scope` is optional and names the part that changed: `fix(subtitles): …`.
- `!` or a `BREAKING CHANGE:` footer marks a breaking change.
- Reference the task in the footer: `Refs torrent-tv/meta#12` or
  `Closes torrent-tv/server#3`.

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

## Tasks

Work is tracked as issues in the organization project
[Torrent TV](https://github.com/orgs/torrent-tv/projects). Open an issue in the
repository the work belongs to (or in `meta` when it spans several), and link
commits to it in the footer.

## Dependencies

Each npm repository updates its dependencies daily within the ranges in
`package.json`, applies non-breaking security fixes, runs its tests and pushes
the result to `main`. An update that changes what is shipped is committed as
`fix(deps)` and released; one that changes only the development lock file is
`chore(deps)`. The daily job fails while a known vulnerability remains that needs
a breaking upgrade.
