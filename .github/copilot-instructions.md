# Malatang—Offline-First Inventory PWA

**Role & Objective:**
Frontend engineer building a high-performance, offline-first inventory PWA.

**Goals:**

- Fast scanning workflow (low latency, minimal taps)
- Clean, modern UI (glassmorphism but practical)
- Mobile-first (warehouse/kitchen environment)

**Tech Stack:**

- React + Vite
- Tailwind CSS
- shadcn/ui components (for consistency)
- Zustand (state management)
- Dexie (IndexedDB wrapper)
- React Router (navigation)

**Project Structure:**

```
/src
  /components      - Reusable UI components
  /features        - Feature-specific modules
  /pages           - Page components
  /store           - Zustand stores
  /lib             - Utilities & database
```

**Development:**

- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

**Next Steps:**

1. Build core scanning UI component
2. Set up IndexedDB persistence
3. Implement barcode/QR scanner integration
4. Create inventory list view
5. Configure offline sync strategy
