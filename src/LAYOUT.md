# Layout Structure - Step 4

## Overview

The application now features a **mobile-first layout** with a sticky header and context-aware navigation. All 6 main screens have been implemented with placeholder content ready for real data integration.

## Architecture

### `src/components/Layout.tsx`

Main layout wrapper component with:

- **Sticky Header** (top-0, z-40)
  - Logo + brand name
  - Desktop navigation (hidden on mobile)
  - Mobile hamburger menu toggle
  
- **Main Content** (flex-1, grows to fill space)
  - Max-width container (7xl on desktop)
  - Responsive padding (px-4 on mobile, auto on desktop)
  
- **Bottom Navigation** (mobile only)
  - 6 nav items: Dashboard, Scan, Delivery, Audit, Reports, Admin
  - Active state with background highlight
  - Icon + label for quick recognition

### Navigation Modes

**Desktop (md breakpoint and up):**
- Horizontal nav in header
- Bottom nav hidden
- Full screen width for content

**Mobile (below md):**
- Hamburger menu in header
- Collapsible mobile menu (border-l highlight for active)
- Bottom tab navigation for quick access
- Full-height layout with content scrolling

## Screen Pages

### 1. **Dashboard** (`/`)
- Quick stats grid (Items in Stock, Pending Scans, Synced Today)
- Recent activity card
- Quick action buttons (Start Scanning, View Inventory, Generate Report)
- Purpose: Home page overview

### 2. **Scan Screen** (`/scan`) ⭐ PRIORITY
- Large barcode input field (autofocused for immediate scanning)
- Submit button + Clear button
- Format hint: "SKU:QUANTITY" (e.g., "PROD123:5")
- Scan stats display (count, total items, sync status)
- Recent scans list with timestamps
- Offline mode indicator
- Purpose: Fast barcode/QR scanning with minimal taps

### 3. **Delivery (Gatekeeper)** (`/delivery`)
- Start new delivery button
- Pending deliveries list
- Delivery stats (pending, completed, verified)
- Section buttons for quick nav
- How-to guide section
- Purpose: Receive/verify incoming shipments

### 4. **Audit** (`/audit`)
- Start new audit button
- Admin reports button
- Audit accuracy metrics
- Recent audits list
- Section grid (Freezer, Dry Storage, Cooler, etc.)
- Best practices guide
- Purpose: Physical inventory verification

### 5. **Reports** (`/reports`)
- Date range selector
- 6 report types available:
  - Inventory Summary
  - Movement Report
  - Audit Report
  - Delivery Report
  - Expiration Report
  - Variance Report
- Quick stats (this month metrics)
- Accuracy metrics display
- Export options (PDF, CSV, Email)
- Purpose: Data analysis and reporting

### 6. **Admin** (`/admin`)
- 6 admin sections:
  - Users (account management)
  - Settings (configuration)
  - Data Sync (offline sync options)
  - Database (storage management)
  - Backup (backup/restore)
  - System Info (version details)
- System status display (storage used, cache, pending sync)
- Danger zone (clear cache, reset app)
- About section
- Purpose: System configuration and maintenance

## Navigation Structure

```
/                     → Dashboard (home)
/scan                 → Scan Screen (PRIORITY)
/delivery             → Delivery (Gatekeeper)
/audit                → Audit
/reports              → Reports
/admin                → Admin (Settings)
```

## Mobile-First Design Considerations

1. **Touch Targets:**
   - All buttons 44px+ height
   - Bottom nav tabs 60px height
   - Input fields 48px height

2. **Layout Spacing:**
   - Mobile: px-4 padding
   - Tablet/Desktop: auto-center with max-w-7xl

3. **Navigation Priority:**
   - Bottom nav tabs always visible on mobile
   - Most-used screen (Scan) prominent in nav
   - Hamburger menu for secondary options

4. **Content Flow:**
   - Single column on mobile
   - 2-3 columns on tablet/desktop
   - Cards instead of tables for data display

## Styling & Colors

- **Primary Action:** bg-primary (#DA251D) for main buttons
- **Secondary:** bg-secondary (#8B2F31)
- **Success:** Green badges for completed items
- **Warning:** Orange badges for pending items
- **Borders:** gray-200 for subtle dividers
- **Backgrounds:** White primary, gray-50 for content sections

## Key Features

✅ Sticky header visible at all times  
✅ Context-aware navigation (active state highlights)  
✅ Bottom tab nav for mobile quick access  
✅ Responsive grid layouts  
✅ Card-based UI for consistency  
✅ Offline-first ready (indicator on Scan page)  
✅ Mobile-first from ground up  

## Next Steps

1. **Integrate Real Data:**
   - Connect screens to Zustand store
   - Fetch items from Dexie database
   - Real barcode scanning logic

2. **Implement Forms:**
   - Item creation/update dialogs
   - Filter/search functionality

3. **Add PWA Features:**
   - Service worker
   - Install prompts
   - Offline caching

4. **Performance Optimization:**
   - Lazy load pages
   - Optimize bundle size
   - Add loading states

## File Structure

```
/src
  /components
    Layout.tsx              ← Main wrapper with header + nav
    /components.tsx         ← All components (re-exports)
  /pages
    index.ts               ← All page exports
    DashboardPage.tsx      ← Home/dashboard
    ScanPage.tsx           ← Barcode scanning (PRIORITY)
    DeliveryPage.tsx       ← Receiving
    AuditPage.tsx          ← Verification
    ReportsPage.tsx        ← Analytics
    AdminPage.tsx          ← Configuration
  App.tsx                  ← Routes + Layout wrapper
```

## Current Build Status

- ✅ 39 modules
- ✅ 260.19 KB JS (gzipped: 79.26 KB)
- ✅ 23.98 KB CSS (gzipped: 5.25 KB)
- ✅ Build time: 190ms
- ✅ Zero TypeScript errors

## Testing the Layout

Open [http://localhost:5176](http://localhost:5176) and:

1. **Desktop:** See full header nav + content
2. **Mobile:** See hamburger menu + bottom nav
3. **Click nav items:** Verify active state highlights
4. **Visit /scan:** See the priority scanning interface
5. **Resize browser:** Observe responsive layout changes at md breakpoint
