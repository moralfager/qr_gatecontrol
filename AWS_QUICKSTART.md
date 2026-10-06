# AWS quick start

## Recommended first test

For the first online check, run the full app on one EC2 VM:

- Next.js app in Docker
- PostgreSQL in Docker
- uploads in a Docker volume
- public access via `http://SERVER_PUBLIC_IP`

This keeps cookies, API routes, file uploads, QR links, and PostgreSQL networking simple while the product is still changing.

## EC2

Use Ubuntu 24.04 LTS or Ubuntu 22.04 LTS.

Security group inbound rules:

- SSH: TCP 22 from your IP
- HTTP: TCP 80 from your IP or `0.0.0.0/0` for temporary testing

## Install Docker on VM

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker --version
docker compose version
```

## Deploy from GitHub repository source

```bash
cd /opt
sudo mkdir -p gatecontrol
sudo chown "$USER:$USER" gatecontrol
cd gatecontrol

git clone https://github.com/moralfager/qr_system.git .
cp .env.docker.example .env
nano .env
```

Set `.env`:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=replace_with_strong_database_password
DATABASE_URL=postgresql://postgres:replace_with_strong_database_password@postgres:5432/gatecontrol
SESSION_SECRET=replace_with_64_plus_random_characters
APP_URL=http://SERVER_PUBLIC_IP
APP_IMAGE=unused-for-local-build
```

Start with local build on AWS:

```bash
docker compose -f docker-compose.aws.yml up --build -d
docker compose -f docker-compose.aws.yml logs -f app
```

Open:

```text
http://SERVER_PUBLIC_IP
```

## Deploy from GitHub Container Registry image

Use this after GitHub Actions builds the image:

```bash
cd /opt/gatecontrol
docker login ghcr.io
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

For registry deploy, `.env` must contain:

```env
APP_IMAGE=ghcr.io/moralfager/qr_system:latest
```

## Useful commands

```bash
docker compose -f docker-compose.aws.yml ps
docker compose -f docker-compose.aws.yml logs -f app
docker compose -f docker-compose.aws.yml logs -f postgres
docker compose -f docker-compose.aws.yml restart app
docker compose -f docker-compose.aws.yml down
```

Data is stored in Docker volumes:

- `postgres_data`
- `uploads`
