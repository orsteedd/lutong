# Laravel Backend

API backend for the Malatang inventory app.

## Purpose

This service handles inventory, scan, delivery, audit, approval, report, and sync endpoints for the frontend app.

## Requirements

- PHP and Composer
- A configured database connection
- Node.js if you are building frontend assets through Vite

## Setup

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed
php artisan serve
```

If you are also running the frontend, configure `VITE_API_BASE_URL` in the frontend environment so it can reach this API.

## Authentication

- Login endpoint: `POST /api/v1/auth/login`
- Seeded credentials:
  - Admin: `admin` / `admin1234`
  - Staff: `staff` / `staff1234`

If `SESSION_DRIVER=database`, make sure the `sessions` table exists:

```bash
php artisan session:table
php artisan migrate
```

## API Routes

All API endpoints are versioned under `/api/v1`.

- `GET /api/v1/health` - Health check
- `POST /api/v1/auth/login` - Login and user profile payload
- `GET /api/v1/logs` - Activity logs
- `POST /api/v1/approvals/{type}/{id}` - Handle approvals
- `POST /api/v1/audits` - Create an audit
- `POST /api/v1/audits/{id}/submit` - Submit an audit
- `GET /api/v1/deliveries` - List deliveries
- `POST /api/v1/deliveries` - Create a delivery record
- `POST /api/v1/deliveries/{id}/verify` - Verify a delivery
- `GET /api/v1/inventory/{item_id}` - Fetch an inventory item
- `GET /api/v1/reports/low-stock` - Low stock report
- `GET /api/v1/reports/daily-summary` - Daily summary report
- `GET /api/v1/reports/shrinkage` - Shrinkage report
- `POST /api/v1/scan/submit` - Submit a scan
- `POST /api/v1/sync` - Sync queued offline records

## Configuration

- Inventory cache settings live in [config/inventory.php](config/inventory.php)
- The backend is designed to support offline-first queue sync from the frontend

## Notes

- This README is specific to the Malatang project, not the default Laravel boilerplate.
- See the root [README.md](../README.md) for the frontend overview.
