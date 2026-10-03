# torrent-tv/.github

Shared CI for the repositories of the `torrent-tv` organization, and the
organization's default contribution files.

| Path | Purpose |
|---|---|
| `actions/checks` | Commit headers with a task reference, the branch name, line endings, workflow syntax, the pending changelog entry, install, lint and tests |
| `actions/release-prepare` | Decide the release from Conventional Commits; write the version and the changelog heading; commit and tag locally |
| `actions/release-finish` | Push the tag and the release commit after publishing; create the GitHub release |
| `actions/addon-install-proxy` | After a proxy release, set the add-on's `PROXY_VERSION`, add the changelog entry and push to the add-on |
| `actions/update-dependencies` | Daily update within ranges, non-breaking audit fixes, tests, push to `main` |
| `scripts/` | The Node scripts these actions run, with tests in `test/`; `check-audit.mjs` fails on an advisory not reviewed in `audit-exceptions.json` |
| `scripts/setup-ci-access.sh` | One-time grant of the access CI cannot grant itself: npm trusted publishing, and the GHCR step to do by hand |
| `githooks/commit-msg` | Local commit-message check (Conventional Commits header ending with `#ttv-<issue>`), copied into each repository as `.githooks/commit-msg` |
| `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE`, `.github/pull_request_template.md` | Organization defaults |

The release rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Secrets and variables

| Name | Kind | Where | Used for |
|---|---|---|---|
| `RELEASE_APP_ID` (5178045) | variable, environment `production` | `proxy`, `server` | The `torrent-tv-release` GitHub App, installed only on `ha-addon` and `infra` (contents write, actions read). Each job asks for a token limited to one repository: `proxy` → `ha-addon`, `server` → `infra`. A push made with it starts the target's workflow, which a push with `GITHUB_TOKEN` would not |
| `RELEASE_APP_PRIVATE_KEY` | secret, environment `production` | `proxy`, `server` | The private key of that app |
| `NPM_TOKEN` | secret, environment `production`, optional | `proxy` | Only until npm trusted publishing is enabled for `@torrent-tv/proxy`; afterwards publication uses OIDC and the secret is deleted |

The server image is published to GHCR with the workflow's own `GITHUB_TOKEN`.
An advisory that npm audit reports but that does not apply is listed in the
repository's `audit-exceptions.json` with the reason, after the code path has
been read; every other advisory at moderate or above fails the daily job.

The daily dependency update pushes with `GITHUB_TOKEN` and then starts the main
workflow with `workflow_dispatch`, so it needs no stored credential.
