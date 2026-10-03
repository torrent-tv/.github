#!/usr/bin/env bash
# One-time setup of the access CI needs and cannot grant itself. Run it in Git Bash
# as an owner of @torrent-tv/proxy on npm. Every step can be re-run.
#
#   bash scripts/setup-ci-access.sh
#
# 1. npm: trusted publishing of @torrent-tv/proxy from proxy/.github/workflows/main.yml
#    in the production environment (asks for the npm second factor in the browser).
# 2. GHCR: printed, because GitHub offers no API for it.
#
# Writing from one repository into another is done by the torrent-tv-release GitHub
# App (installed on ha-addon and infra); its key is in the production environments of
# proxy and server. Deploy keys are not used.
set -euo pipefail

ORG=torrent-tv
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo "== 1. npm trusted publishing"
# A token that bypasses the second factor (the one in ~/.npmrc) may not change
# trust, so this step signs in for itself, in the browser, into a throwaway
# config; ~/.npmrc is not touched.
export NPM_CONFIG_USERCONFIG="$work/npmrc"
npx -y npm@latest login --auth-type=web
npx -y npm@latest trust github @torrent-tv/proxy --file main.yml --repo "$ORG/proxy" --env production --allow-publish --yes
unset NPM_CONFIG_USERCONFIG

echo "== 2. GHCR (by hand)"
echo "Open https://github.com/orgs/$ORG/packages/container/server/settings,"
echo "'Manage Actions access': keep only the repository server, role Write."
