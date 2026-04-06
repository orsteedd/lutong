# Malatang

Offline-first inventory app for fast warehouse and kitchen scanning.

## Stack

### Frontend Stack

- React 19
- Vite
- TypeScript
- React Router
- Zustand
- Dexie
- Tailwind CSS 4
- jsQR
- qrcode

### Backend Stack

- Laravel API in [laravel-backend](laravel-backend)

## What It Does

- Stores inventory and scan data locally with IndexedDB through Dexie
- Uses Zustand stores for app state and offline queue management
- Supports scan workflows for inventory, delivery, audit, transfer, and wastage flows
- Syncs queued records to the Laravel API when connectivity is available
- Supports login and persisted user sessions via Zustand auth store
- Enforces role-based frontend route access for admin-only pages
- Uses a custom component library with shadcn-style utilities, not the shadcn/ui package

## Quick Start

### Frontend Setup

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Backend Setup

See [laravel-backend/README.md](laravel-backend/README.md) for the Laravel setup instructions.

Local development is SQLite-first. Docker and MySQL are optional and not required for the main development workflow.

## Login

- Login page route: `/login`
- Demo credentials:
  - Admin: `admin` / `admin1234`
  - Staff: `staff` / `staff1234`

If backend login is available at `/api/v1/auth/login`, the frontend uses it.
If backend auth is unavailable, the frontend falls back to local demo credentials.

## Scripts

- `npm run dev` - Start the Vite dev server
- `npm run build` - Type-check and build for production
- `npm run preview` - Preview the production build
- `npm run lint` - Run ESLint

## Project Structure

```text
src/
├── components/    # Reusable UI components
├── pages/         # Page components
├── store/         # Zustand state stores
├── lib/           # Database, sync, and utility code
└── App.tsx        # Root component
```

## Architecture Notes

### State Management

- Zustand stores live in [src/store](src/store)
- Offline queue state is persisted locally

### Database

- Dexie wraps IndexedDB in [src/lib/db.ts](src/lib/db.ts)
- Tables currently include `items`, `syncLog`, `scanLogs`, `pendingSyncItems`, and `scanQueue`

### Sync

- Queue sync logic lives in [src/lib/syncApi.ts](src/lib/syncApi.ts)
- Sync depends on `VITE_API_BASE_URL` being set for the Laravel backend
- Transient sync failures auto-retry with exponential backoff
- Unresolved conflicts remain manual review items

### Offline Queue Pipeline

- Zustand queue state lives in [src/store/useOfflineQueueStore.ts](src/store/useOfflineQueueStore.ts)
- Dexie persistence lives in [src/lib/db.ts](src/lib/db.ts)
- Startup hydration restores queue from Dexie scan queue and pending sync records
- Reconnect and periodic online checks trigger queue sync to Laravel SQLite backend

### UI

- Tailwind CSS powers the styling system
- Components are custom and grouped under [src/components](src/components)
- The design leans glassmorphism, but it is not a packaged shadcn/ui setup

### Access Control

- Auth state lives in [src/store/useAuthStore.ts](src/store/useAuthStore.ts)
- Admin-only routes are guarded in [src/App.tsx](src/App.tsx)
- Admin-only navigation items are hidden for staff users in [src/components/Layout.tsx](src/components/Layout.tsx)

### PWA

- Manifest: [public/manifest.webmanifest](public/manifest.webmanifest)
- Service worker: [public/sw.js](public/sw.js)
- Offline fallback page: [public/offline.html](public/offline.html)
- Registration bootstrap: [src/lib/registerServiceWorker.ts](src/lib/registerServiceWorker.ts)

## Current Scope

The app is offline-first, has manifest + service worker support, and includes auth + route-level role gating. Backend route-level authorization middleware is still recommended as a hardening step.

## Next Steps

1. Add backend role middleware to enforce admin/staff access server-side
2. Expand barcode scanning flows in the scan page
3. Harden end-to-end auth (real token/session revocation)
