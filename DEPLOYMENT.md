# VPS Deployment

This guide deploys the public portfolio demo behind Caddy with automatic HTTPS.
ArangoDB, PostgreSQL, and Node.js remain on the private Docker network; only
ports 80 and 443 are public.

## Prerequisites

- Ubuntu 24.04 VPS with 2 GB RAM minimum (4 GB recommended)
- a domain with an `A` record pointing to the VPS IPv4 address
- Docker Engine, Docker Compose plugin, Git, and a non-root sudo user
- inbound firewall rules for SSH, HTTP, and HTTPS only

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

## First deployment

```bash
git clone https://github.com/ToroRossoLGD/kotva-nosql-insurance.git
cd kotva-nosql-insurance
cp .env.production.example .env.production
nano .env.production
chmod 600 .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Replace every placeholder secret. Generate the JWT secret with
`openssl rand -hex 32`. `DOMAIN` must contain only the hostname, without
`https://`. Caddy requests and renews the TLS certificate automatically after
DNS resolves and ports 80/443 reach the VPS.

The public login page shows only the analyst credentials. The analyst can view
dashboards, filters, Data Quality, CSV exports, and warehouse status, but public
demo mode blocks ETL and warehouse mutations. Admin and agent credentials stay
private.

## Update and rollback

Create a backup before every update:

```bash
set -a; . ./.env.production; set +a
sh ops/backup.sh
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
```

For rollback, check out the previous known-good commit and rebuild. Database
volumes are not deleted by `docker compose down`; never use `down -v` on the
VPS. Test restoring backups on a separate machine before relying on them.

## Manual GitHub Actions deployment

`.github/workflows/deploy.yml` adds a deliberately manual CD path. It can run
only from `main`, reruns the existing CI checks, then waits for the `production`
environment approval before accessing its SSH secrets. The VPS script refuses
dirty or non-`main` checkouts and stale commits. It makes a private backup,
fast-forwards the checkout, rebuilds Compose services, waits for health checks,
and checks the public readiness, landing and sign-in URLs. A separate workflow
step confirms the VPS reached the requested commit, so a prematurely ended
remote script cannot appear as a successful deployment. A failed deployment
stops with an error; it does **not** automatically roll back a database change.

One-time setup, performed by the VPS owner:

1. Verify that the existing `deploy` user owns `/opt/kotva`, can read
   `/opt/kotva/.env.production`, and can run `docker info` and Compose. If Docker
   access is missing, an administrator can add `deploy` to the `docker` group,
   then start a new login session. **Docker group membership is effectively
   root-level access**; protect this account and its SSH key accordingly. Keep
   the production env file out of Git and readable only by the deployment user.
2. Generate a *new, dedicated* Ed25519 SSH key for GitHub Actions. Add only its
   public key to the `deploy` user's `~/.ssh/authorized_keys` on the VPS. Never
   reuse the root password or paste the private key into an issue, PR, or chat.
3. Verify the VPS SSH host fingerprint through an existing trusted SSH session
   (for example, `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`). Capture
   the matching `ssh-keyscan -t ed25519` known-hosts line for the VPS IP or
   hostname. Do not trust an unverified scan result.
4. In GitHub **Settings → Environments**, create `production`. Restrict it to
   `main` and add a required reviewer. Set environment variables `DEPLOY_HOST`
   (the VPS IP or SSH hostname) and `DEPLOY_USER` (`deploy`). Set environment
   secrets `DEPLOY_SSH_KEY` (the entire private key) and `DEPLOY_KNOWN_HOSTS`
   (the verified known-hosts line). Public repositories support environment
   reviewers on GitHub Free; check the repository's current plan/settings.
5. Confirm the key works from an authorized machine and that the deploy user
   can run Docker. There is no need to copy `.env.production` into GitHub.

To release: merge the PR into `main`, open **Actions → Deploy public demo → Run
workflow**, select `main`, and approve the waiting `production` job. Watch the
workflow result and visit `https://demo.kotva2.com/`. Never start two manual
deployments for competing commits; the workflow serializes them and rejects an
outdated SHA. Backups are written to `/opt/kotva/backups`, excluded from Git and
the Docker build context. Copy them to protected off-server storage regularly.

If a deployment fails, inspect the Actions log and VPS Compose logs. Do not use
`docker compose down -v`. Restore from the backup only after identifying whether
the failure involved a database migration; reversing code alone may not reverse
data changes.

## Operations

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=200 app caddy
curl -fsS https://your-domain.example/api/health/ready
```

Copy encrypted backups to storage outside the VPS and define a retention
policy. A cron entry can run `ops/backup.sh`, but first load `.env.production`
as shown above. Monitor disk usage, certificate renewal, container health, HTTP
5xx responses, and backup success.

## LinkedIn launch checklist

- verify HTTPS with no browser warning;
- verify the analyst password shown on the login page works;
- verify admin credentials are not displayed;
- confirm analyst POST requests receive HTTP 403;
- test desktop and mobile layouts;
- add the live URL and repository URL to the README;
- never expose ports 8529 or 5432 in the VPS firewall;
- do not store `.env.production` or backups in Git.
