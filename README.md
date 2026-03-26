# Malatang—Offline-First Inventory PWA

Fast warehouse scanning PWA with offline-first architecture.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Features

- **Offline First**: Works without internet using IndexedDB
- **Fast Scanning**: Minimal UI, optimized for mobile
- **Modern Design**: Glassmorphism + Tailwind CSS
- **Real-time Sync**: Background sync when connection restored

## Project Structure

```
src/
├── components/    # Reusable UI components
├── features/      # Feature modules
├── pages/         # Page components
├── store/         # Zustand state stores
├── lib/           # Database & utilities
└── App.tsx        # Root component
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Key Dependencies

- **React Router**: Navigation
- **Zustand**: State management  
- **Dexie**: IndexedDB abstraction
- **Tailwind CSS**: Styling

## Architecture

### State Management
- Zustand stores in `/src/store`
- Persisted to browser storage

### Database
- Dexie with IndexedDB
- Two tables: `items` and `syncLog`
- Configuration in `/src/lib/db.ts`

### UI Components
- Tailwind CSS + Glassmorphism utilities
- Mobile-first responsive design

## Next Steps

1. Build scanning UI with barcode input
2. Implement inventory list view
3. Add barcode scanner integration
4. Configure sync strategy
5. Deploy as PWA
