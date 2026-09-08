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
