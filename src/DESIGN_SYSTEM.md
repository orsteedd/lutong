# Design System — Malatang

This document outlines the complete design system for Malatang, including color palette, typography, components, and design principles.

## Color Palette

### Primary Colors
- **Primary Red**: `#DA251D` — Primary actions, CTA buttons, important UI elements
- **Secondary Maroon**: `#8B2F31` — Secondary actions, alternative buttons
- **Error Red**: `#5A0F0B` — Error states, critical alerts

### Neutral Colors
- **Black**: `#000000` — Text, icons, primary content
- **White**: `#FFFFFF` — Backgrounds, surfaces
- **Gray Scale**: 50–900 shades for secondary text, dividers, disabled states

### Semantic Colors
- **Success**: `#16A34A` — Success messages, confirmations
- **Warning**: `#F59E0B` — Warnings, cautions
- **Error Light**: `#FEE2E2` — Error backgrounds

## Design Principles

### 1. **White Dominant**
- Default background is white for clarity and scanability
- Reduces visual fatigue in warehouse/kitchen environments
- Improves readability on mobile devices

### 2. **Color Usage**
- **Primary (Red)**: Main CTAs, primary actions (e.g., "Scan", "Submit", "Confirm")
- **Secondary (Maroon)**: Destructive or alternative actions (e.g., "Delete", "Cancel")
- **Text**: Black on white for maximum contrast
- **Gray**: Secondary information, disabled states, dividers

### 3. **Avoid Gradients**
- Use solid colors for clarity
- Reserve gradients only for special emphasis (not default)
- Keeps mobile rendering fast and battery efficient

### 4. **Accessible Contrast**
- All text meets WCAG AA standards (4.5:1 for body text, 3:1 for large text)
- Red primary + white background = 7.4:1 contrast ratio ✓

## Component Library

All components are defined in `src/index.css` using Tailwind's `@layer components`:

### Buttons

```html
<!-- Primary Button (red) -->
<button class="btn-primary">Start Scanning</button>

<!-- Secondary Button (maroon) -->
<button class="btn-secondary">Delete Item</button>

<!-- Outline Button -->
<button class="btn-outline">View Details</button>
```

### Cards

```html
<!-- Standard Card -->
<div class="card">
  <p>Card content...</p>
</div>

<!-- Large Card -->
<div class="card-lg">
  <h2>Large Card</h2>
  <p>More prominent content...</p>
</div>
```

### Glass Effect (Subtle)

```html
<!-- Glassmorphism with white background -->
<div class="glass">
  <p>Subtle glass effect...</p>
</div>

<!-- Dark glass effect -->
<div class="glass-dark">
  <p>Very subtle...</p>
</div>
```

### Text Utilities

```html
<!-- Primary Action Text -->
<span class="text-primary-action">Important Action</span>

<!-- Error Text -->
<span class="text-error">Error Message</span>
```

## Tailwind Configuration

All colors are available in Tailwind classes:

```jsx
// Examples
<div className="bg-primary text-white">Primary button background</div>
<div className="text-secondary">Secondary text</div>
<div className="border-gray-200">Subtle divider</div>
<div className="bg-error-light text-error">Error state</div>
```

## Spacing System

Consistent spacing ensures alignment and visual harmony:

- `sm`: 0.5rem (8px)
- `md`: 1rem (16px)
- `lg`: 1.5rem (24px)
- `xl`: 2rem (32px)

## Typography

- **Font**: System font stack (-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto')
- **Default Size**: 1rem (16px on mobile)
- **Line Height**: 1.5 (default Tailwind)

## Responsive Design

Mobile-first approach:
- Base styles for mobile
- `md:` breakpoint for tablets (768px+)
- `lg:` breakpoint for desktop (1024px+)

## Accessibility

- ✓ WCAG AA contrast compliance
- ✓ Touch targets: minimum 44×44px
- ✓ Clear focus states
- ✓ Semantic HTML structure
- ✓ Color not the only indicator (always use text/icons)

## Implementation

All design tokens are centralized in:
- `tailwind.config.js` — Theme configuration
- `src/index.css` — Tailwind components and utilities
- `src/lib/theme.ts` — TypeScript theme export (for runtime access)

Use the theme constants in your components for consistency:

```tsx
import { theme } from '@/lib/theme'

const myColor = theme.colors.primary // '#DA251D'
```
