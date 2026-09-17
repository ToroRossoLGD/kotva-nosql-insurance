#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR=/opt/kotva
EXPECTED_SHA="${1:-}"
COMPOSE=(docker compose --env-file .env.production -f docker-compose.prod.yml)

if [[ ! "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Expected a full Git commit SHA.' >&2
  exit 1
fi

cd "$DEPLOY_DIR"
if [[ "$(git branch --show-current)" != main ]]; then
  echo 'Deployment checkout must be on main.' >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Deployment checkout contains local changes; refusing to overwrite them.' >&2
  exit 1
fi
if [[ ! -r .env.production ]]; then
  echo 'Production environment file is missing or unreadable.' >&2
  exit 1
fi
docker info >/dev/null
git fetch origin main
if [[ "$(git rev-parse origin/main)" != "$EXPECTED_SHA" ]]; then
  echo 'Main moved since this deployment started; run the workflow again.' >&2
  exit 1
fi

PREVIOUS_SHA="$(git rev-parse HEAD)"
if ! git merge-base --is-ancestor "$PREVIOUS_SHA" "$EXPECTED_SHA"; then
  echo 'The current checkout cannot fast-forward to the requested commit.' >&2
  exit 1
fi

umask 077
set -a
source ./.env.production
set +a
if [[ -z "${DOMAIN:-}" || -z "${ARANGO_PASSWORD:-}" ]]; then
  echo 'DOMAIN or ARANGO_PASSWORD is missing from .env.production.' >&2
  exit 1
fi
export BACKUP_DIR="$DEPLOY_DIR/backups"
sh ops/backup.sh </dev/null

git merge --ff-only "$EXPECTED_SHA"
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" up --build --wait --wait-timeout 240 -d
"${COMPOSE[@]}" ps
curl --fail --silent --show-error --max-time 20 --retry 5 --retry-delay 3 "https://$DOMAIN/api/health/ready" >/dev/null
curl --fail --silent --show-error --max-time 20 "https://$DOMAIN/" >/dev/null
curl --fail --silent --show-error --max-time 20 "https://$DOMAIN/app.html" >/dev/null
echo "Deployed $EXPECTED_SHA (previous: $PREVIOUS_SHA)"
