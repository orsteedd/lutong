# MySQL + phpMyAdmin Setup

This project currently runs with SQLite by default. Use this guide to switch to MySQL and inspect data via phpMyAdmin.

## 1) Prerequisites

- Docker Desktop installed and running
- PHP + Composer already installed (already true in this workspace)

## 2) Start MySQL and phpMyAdmin

From `laravel-backend/`:

```bash
docker-compose -f docker-compose.mysql.yml up -d
```

Services:

- MySQL: `127.0.0.1:3306`
- phpMyAdmin: `http://127.0.0.1:8081`

phpMyAdmin login:

- Server: `mysql` (if accessing from container network) OR `127.0.0.1` from host setup
- Username: `root`
- Password: `root`

## 3) Switch Laravel to MySQL

Copy environment template and set app key if needed:

```bash
cp .env.mysql.example .env
php artisan key:generate --force
```

## 4) Run migrations

```bash
php artisan migrate --force
```

## 5) Verify connection quickly

```bash
php artisan migrate:status
```

## 6) Open phpMyAdmin

Go to:

`http://127.0.0.1:8081`

Database should include tables such as:

- `items`
- `inventory_logs`
- `deliveries`
- `audit_items`
- `activity_logs`

## 7) Stop containers

```bash
docker-compose -f docker-compose.mysql.yml down
```

To remove DB data volume too:

```bash
docker-compose -f docker-compose.mysql.yml down -v
```
