# Stack Decisions (Current)

## Active

- Frontend app: `./` (React + Vite + TypeScript + Zustand + Dexie)
- Backend app: `./laravel-backend` (Laravel API)
- Frontend sync target: `VITE_API_BASE_URL=http://127.0.0.1:8000`

## Archived

- Legacy partial backend: `./laravel-api-archive`

## Optional (Not required for current run)

- MySQL + phpMyAdmin Docker setup in `laravel-backend/docker-compose.mysql.yml`

## Keep

- Node.js + npm
- PHP + Composer
- SQLite for local run (or MySQL once Docker is available)

## Removed from active scripts

- Root `mock-api` script removed from `package.json`
