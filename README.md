# Malatang

Offline-first inventory app for fast warehouse and kitchen scanning.

## Stack

### Frontend

- React 19
- Vite
- TypeScript
- React Router
- Zustand
- Dexie
- Tailwind CSS 4
- jsQR
- qrcode

### Backend

- Laravel API in [laravel-backend](laravel-backend)

## What It Does

- Stores inventory and scan data locally with IndexedDB through Dexie
- Uses Zustand stores for app state and offline queue management
- Supports scan workflows for inventory, delivery, audit, transfer, and wastage flows
- Syncs queued records to the Laravel API when connectivity is available
- Uses a custom component library with shadcn-style utilities, not the shadcn/ui package

## Quick Start

### Frontend

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Backend

See [laravel-backend/README.md](laravel-backend/README.md) for the Laravel setup instructions.

## Scripts

- `npm run dev` - Start the Vite dev server
- `npm run build` - Type-check and build for production
- `npm run preview` - Preview the production build
- `npm run lint` - Run ESLint

## Project Structure

```
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

### UI

- Tailwind CSS powers the styling system
- Components are custom and grouped under [src/components](src/components)
- The design leans glassmorphism, but it is not a packaged shadcn/ui setup

## Current Scope

The app is offline-first and API-synced, but it is not yet a fully packaged PWA. There is no service worker or web manifest checked in yet.

## Next Steps

1. Add manifest and service worker support if you want full PWA installation
2. Expand barcode scanning flows in the scan page
3. Harden Laravel sync and conflict resolution paths
