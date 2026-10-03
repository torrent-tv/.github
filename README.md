# torrent-tv/.github

Shared CI for the repositories of the `torrent-tv` organization, and the
organization's default contribution files.

| Path | Purpose |
|---|---|
| `actions/checks` | Commit headers, line endings, workflow syntax, the pending changelog entry, install, lint and tests |
| `actions/release-prepare` | Decide the release from Conventional Commits; write the version and the changelog heading; commit and tag locally |
| `actions/release-finish` | Push the tag and the release commit after publishing; create the GitHub release |
| `actions/addon-install-proxy` | After a proxy release, set the add-on's `PROXY_VERSION`, add the changelog entry and push to the add-on |
| `actions/update-dependencies` | Daily update within ranges, non-breaking audit fixes, tests, push to `main` |
| `scripts/` | The Node scripts these actions run, with tests in `test/` |
| `githooks/commit-msg` | Local commit-message check, copied into each repository as `.githooks/commit-msg` |
| `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE`, `.github/pull_request_template.md` | Organization defaults |

The release rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Secrets and variables

| Name | Kind | Where | Used for |
|---|---|---|---|
| `ADDON_DEPLOY_KEY` | secret, environment `production` | `proxy` | Pushing the proxy version into `ha-addon` after the proxy is published; the matching public key is a write deploy key of `ha-addon`. A push with a deploy key starts the add-on's workflow, which a push with `GITHUB_TOKEN` would not |
| `NPM_TOKEN` | secret, environment `production`, optional | `proxy` | Only until npm trusted publishing is enabled for `@torrent-tv/proxy`; afterwards publication uses OIDC and the secret is deleted |
| `DROPLET_SSH_KEY` | secret, environment `production` | `infra` | Deploying the compose stack; the key is restricted on the droplet to one forced command |
| `DROPLET_KNOWN_HOSTS` | secret, environment `production` | `infra` | The droplet's host key |
| `DROPLET_HOST` | variable, environment `production` | `infra` | The droplet's address |

The server image is published to GHCR with the workflow's own `GITHUB_TOKEN`.
An advisory that npm audit reports but that does not apply is listed in the
repository's `audit-exceptions.json` with the reason, after the code path has
been read; every other advisory at moderate or above fails the daily job.

The daily dependency update pushes with `GITHUB_TOKEN` and then starts the main
workflow with `workflow_dispatch`, so it needs no stored credential.
