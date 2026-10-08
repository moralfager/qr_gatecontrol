# VPS Deploy

## 1. Before Server Deploy

Use an AWS Elastic IP. If the IP is `16.16.219.115`, the temporary HTTPS host can be:

```text
16-16-219-115.sslip.io
```

Open EC2 Security Group ports:

```text
22/tcp
80/tcp
443/tcp
```

Do not expose PostgreSQL or app port 3000 to the internet.

## 2. Server Packages

Install Docker Engine and Docker Compose plugin on Ubuntu, then check:

```bash
docker --version
docker compose version
```

Install Caddy on the host. Caddy will terminate HTTPS and proxy to the app.

## 3. Clone And Configure

```bash
git clone <repo-url> gatecontrol
cd gatecontrol
cp .env.production.example .env
nano .env
```

Set real values:

```env
APP_URL=https://16-16-219-115.sslip.io
POSTGRES_PASSWORD=<strong-db-password>
DATABASE_URL=postgresql://gatecontrol_user:<same-strong-db-password>@postgres:5432/gatecontrol
SESSION_SECRET=<long-random-secret>
SEED_ADMIN_PASSWORD=<initial-admin-password>
```

For a first local test you may set `SEED_ADMIN_PASSWORD=admin123`, but change it after login.

## 4. Start App

```bash
docker compose up -d --build
docker compose exec app npm run db:setup
docker compose ps
```

Logs:

```bash
docker compose logs -f app
docker compose logs -f postgres
```

## 5. Caddy HTTPS

Edit Caddyfile:

```bash
sudo nano /etc/caddy/Caddyfile
```

Example:

```caddyfile
16-16-219-115.sslip.io {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Apply:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Check:

```bash
curl -I https://16-16-219-115.sslip.io
```

## 6. Update App Later

```bash
cd gatecontrol
git pull
docker compose up -d --build
docker compose exec app npm run db:setup
```

Uploaded files live in the `uploads` Docker volume. PostgreSQL data lives in the `postgres-data` Docker volume.
