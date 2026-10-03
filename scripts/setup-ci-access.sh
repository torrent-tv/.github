#!/usr/bin/env bash
# One-time setup of the access CI needs and cannot grant itself. Run it in Git Bash
# as an owner of the torrent-tv organization, logged in to gh as that owner and to
# npm as an owner of @torrent-tv/proxy. Every step can be re-run.
#
#   bash scripts/setup-ci-access.sh
#
# 1. gh scopes: project (the organization project), admin:org (deploy keys).
# 2. Organization: allow deploy keys; give ha-addon a write deploy key whose
#    private half is the proxy's ADDON_DEPLOY_KEY secret (production).
# 3. Droplet: a deploy key restricted to one forced command, and the secrets and
#    variable the infra deploy job reads (production).
# 4. npm: trusted publishing of @torrent-tv/proxy from proxy/.github/workflows/main.yml
#    in the production environment (asks for the npm second factor).
# 5. The organization project "Torrent TV", linked to every repository.
# 6. GHCR: printed, because GitHub offers no API for it.
set -euo pipefail

ORG=torrent-tv
DROPLET=${DROPLET:-root@206.189.97.152}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo "== 1. gh scopes"
gh auth refresh -h github.com -s project,admin:org

echo "== 2. add-on deploy key"
gh api -X PATCH "orgs/$ORG" -F deploy_keys_enabled_for_repositories=true --silent
ssh-keygen -q -t ed25519 -N "" -C "ci: proxy release installs into the add-on" -f "$work/addon"
gh api "repos/$ORG/ha-addon/keys" -f title="CI: proxy release installs into the add-on" \
  -f key="$(cat "$work/addon.pub")" -F read_only=false --silent
gh secret set ADDON_DEPLOY_KEY -R "$ORG/proxy" --env production < "$work/addon"

echo "== 3. droplet deploy key"
ssh-keygen -q -t ed25519 -N "" -C "ci deploy (torrent-tv/infra)" -f "$work/droplet"
line="restrict,command=\"cd /websites/infra && git pull --ff-only -q && ./prod.sh\" $(cat "$work/droplet.pub")"
ssh "$DROPLET" "printf '%s\n' '$line' >> ~/.ssh/authorized_keys"
host=${DROPLET#*@}
ssh-keyscan -t ed25519,ecdsa,rsa "$host" 2>/dev/null > "$work/known_hosts"
gh secret set DROPLET_SSH_KEY -R "$ORG/infra" --env production < "$work/droplet"
gh secret set DROPLET_KNOWN_HOSTS -R "$ORG/infra" --env production < "$work/known_hosts"
gh variable set DROPLET_HOST -R "$ORG/infra" --env production --body "$host"

echo "== 4. npm trusted publishing"
# A token that bypasses the second factor (the one in ~/.npmrc) may not change
# trust, so this step signs in for itself, in the browser, into a throwaway
# config; ~/.npmrc is not touched.
export NPM_CONFIG_USERCONFIG="$work/npmrc"
npx -y npm@latest login --auth-type=web
npx -y npm@latest trust github @torrent-tv/proxy --file main.yml --repo "$ORG/proxy" --env production --allow-publish --yes
unset NPM_CONFIG_USERCONFIG

echo "== 5. organization project"
number=$(gh project list --owner "$ORG" --format json --jq '.projects[] | select(.title == "Torrent TV") | .number')
if [ -z "$number" ]; then
  number=$(gh project create --owner "$ORG" --title "Torrent TV" --format json --jq .number)
fi
for repo in .github meta server proxy ha-addon infra; do
  gh project link "$number" --owner "$ORG" --repo "$ORG/$repo" || true
done
if [ "$number" != 1 ]; then
  echo "The issue forms in $ORG/.github name project $ORG/1; change them to $ORG/$number."
fi

echo "== 6. GHCR (by hand)"
echo "Open https://github.com/orgs/$ORG/packages/container/server/settings,"
echo "'Manage Actions access' -> 'Add repository' -> server, role Write."
echo "Then re-run the failed Release job of the latest server and proxy runs."
