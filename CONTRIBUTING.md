# Contributing to Torrent TV

These rules apply to every repository of the `torrent-tv` organization unless a
repository states otherwise.

## Tasks

All planning and tracking happen on GitHub: every task is an issue in
[`torrent-tv/meta`](https://github.com/torrent-tv/meta/issues), and the
organization project [Torrent TV](https://github.com/orgs/torrent-tv/projects/1)
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
explicit `patch` or `minor` step. It still needs an entry under `## Unreleased`.

Every release job runs one at a time (a queue, never cancelled), and publication
happens before anything is pushed. A failed release job can be re-run: once the
`v<version>` tag exists on GitHub, publication is skipped and only the steps not
yet done run.

## How a release reaches its users

**Proxy → add-on → Home Assistant.**

1. `proxy` publishes `@torrent-tv/proxy` to npm through npm trusted publishing:
   npmjs.com accepts the workflow's OIDC token for `torrent-tv/proxy`,
   `main.yml`, environment `production`. No npm token is stored anywhere.
2. npm serves a new version only after it has processed it (6.5 minutes for
   2.89.8). The release waits for that.
3. It then pushes `fix(proxy)`/`feat(proxy): install proxy <version>` to
   `ha-addon` with the `torrent-tv-release` app. That push starts the add-on's
   workflow, which checks that npm serves the version, builds the image and
   releases the add-on.
4. The proxy release ends when the add-on release carrying that proxy exists.
5. The add-on is updated on each Home Assistant host by its owner: `ha store
   reload`, then `ha apps update b34a1737_torrent_tv_proxy`.

**Server → infra → droplet.**

1. `server` builds and pushes `ghcr.io/torrent-tv/server:<version>`.
2. It writes `server:<version>@<digest>` into `infra`'s `docker-compose.yml` with
   the `torrent-tv-release` app. A version is never lowered.
3. That push starts `infra`'s workflow. Its checks run, then its serial deploy job
   moves the `production` branch to the commit and sends a signed webhook to
   doco-cd on the droplet. doco-cd pulls the image, recreates the server and
   removes the server's previous image.
4. The deploy job checks the site and the page from outside. The server release
   ends when `https://webauth.courses/env.js` reports the new version.

Measured on 2026-10-04 for server 0.36.15: image built in 13 s, written into
`infra` 29 s after the job started, applied by doco-cd in 3.5 minutes (most of
it pulling the image on the droplet), site checks passed in 6 s.

CI never logs in to the droplet. doco-cd also polls `production` every five
minutes, so a lost webhook delays a deployment instead of losing it.

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
