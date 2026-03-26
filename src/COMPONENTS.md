# shadcn-style Component Library

Complete set of TypeScript components for Malatang, customized with your design system colors and styling.

## Components Overview

All components are designed with:
- **Large border radius** (`rounded-xl`) for modern feel
- **Soft but visible shadows** for depth
- **Red/Maroon color scheme** matching your design system
- **Accessible focus states**
- **Full TypeScript support**

## Component Inventory

### Button

Interactive button component with multiple variants and sizes.

**Variants:**
- `default` — Primary red button (CTA)
- `secondary` — Maroon button (alternative/destructive)
- `destructive` — Dark red for dangerous actions
- `outline` — Red outline button
- `ghost` — Transparent button
- `link` — Text link button

**Sizes:**
- `sm` — Small (32px height)
- `md` — Medium (40px height, default)
- `lg` — Large (48px height)
- `icon` — Icon button (40×40px square)

**Usage:**
```tsx
import { Button } from '@/components'

<Button variant="default">Click me</Button>
<Button variant="secondary" size="lg">Large button</Button>
<Button disabled>Disabled</Button>
```

### Card

Container component for organizing content.

**Sub-components:**
- `Card` — Main container
- `CardHeader` — Header section (with border)
- `CardTitle` — Header title (configurable HTML element)
- `CardContent` — Body content
- `CardFooter` — Footer section (with border)

**Usage:**
```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components'

<Card>
  <CardHeader>
    <CardTitle as="h2">Title</CardTitle>
  </CardHeader>
  <CardContent>Content here</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

### Input

Text input field with focus states and accessibility.

**Usage:**
```tsx
import { Input } from '@/components'

<Input placeholder="Enter text..." />
<Input type="email" placeholder="Email..." />
<Input disabled placeholder="Disabled..." />
```

### Badge

Small label component for status, categories, or tags.

**Variants:**
- `default` — Primary red background
- `secondary` — Maroon background
- `destructive` — Error red background
- `outline` — Bordered badge
- `success` — Green background
- `warning` — Orange background

**Usage:**
```tsx
import { Badge } from '@/components'

<Badge variant="default">Active</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
```

### Dialog

Modal dialog for user actions and confirmations.

**Sub-components:**
- `Dialog` — Wrapper and context provider
- `DialogTrigger` — Trigger button
- `DialogContent` — Modal content container
- `DialogHeader` — Modal header
- `DialogTitle` — Modal title
- `DialogBody` — Modal body content
- `DialogFooter` — Modal footer (right-aligned)
- `DialogClose` — Close button/trigger

**Features:**
- Click-outside to close
- Backdrop overlay with blur
- Keyboard support (ESC to close)
- Controlled or uncontrolled state

**Usage:**
```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from '@/components'
import { Button } from '@/components'

<Dialog>
  <DialogTrigger>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm</DialogTitle>
    </DialogHeader>
    <DialogBody>Are you sure?</DialogBody>
    <DialogFooter>
      <DialogClose><Button variant="ghost">Cancel</Button></DialogClose>
      <DialogClose><Button>Confirm</Button></DialogClose>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Toast

Non-blocking notification component.

**Variants:**
- `default` — Dark gray background
- `success` — Green background
- `destructive` — Red background

**Usage:**
```tsx
import { Toast } from '@/components'
import { useState } from 'react'

const [show, setShow] = useState(false)

{show && (
  <Toast
    title="Success"
    description="Operation completed!"
    variant="success"
    onClose={() => setShow(false)}
  />
)}
```

## Design Customizations

### Colors Used

- **Primary Red**: `#DA251D` — Button backgrounds, outlines, badges
- **Secondary Maroon**: `#8B2F31` — Alternative buttons
- **Error Red**: `#5A0F0B` — Destructive actions
- **Text**: `#000000` (black) — All text content
- **Background**: `#FFFFFF` (white) — Card, button backgrounds
- **Gray Scale**: `#F9FAFB` → `#111827` — Borders, dividers, secondary content

### Border Radius

All components use `rounded-xl` (16px) for a modern, large-radius feel:
- Buttons
- Cards  
- Dialogs
- Inputs
- Badges

### Shadows

Layered, soft shadows for depth:
- Small cards: `shadow-sm`
- Large cards: `shadow-md` 
- Modal dialogs: `shadow-lg`

### Focus States

All interactive elements support keyboard navigation with visible focus rings:
```css
focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary
```

## Import Paths

Use TypeScript path aliases for clean imports:

```tsx
// ✅ Recommended
import { Button, Card, Input } from '@/components'
import { cn } from '@/lib/cn'

// ❌ Avoid
import { Button } from './src/components/Button'
```

## Utility Functions

### `cn()` - Merge Tailwind Classes

Utility for combining Tailwind classes conditionally:

```tsx
import { cn } from '@/lib/cn'

const classes = cn(
  'base-class',
  isActive && 'active-class', 
  false && 'never-included'
) // Result: "base-class active-class"
```

## Accessibility

All components meet WCAG AA standards:
- ✅ Keyboard navigation support
- ✅ Focus indicators visible
- ✅ Semantic HTML structure
- ✅ ARIA labels where appropriate
- ✅ Color + text indicators (not color alone)
- ✅ Touch targets ≥44×44px

## TypeScript Support

Full TypeScript types exported for all components:

```tsx
import { ButtonProps, InputProps, ToastProps } from '@/components'

interface MyComponentProps extends ButtonProps {
  customProp?: string
}
```

## Component Life ✨

Each component is:
- **Reusable** — Use anywhere in your app
- **Composable** — Combine with other components
- **Themable** — Colors via design system
- **Accessible** — Built-in WCAG compliance
- **Type-safe** — Full TypeScript support
- **Documented** — Self-documenting props

## Next Steps

Ready to use these components in your features:

1. **ScannerUI** — Barcode input with Button + Input + Badge
2. **InventoryList** — Card + Badge components for items
3. **ItemDialog** — Dialog + Form components for editing
4. **Notifications** — Toast for user feedback
5. **Confirmations** — Dialog + Button for actions

## Reference

- 📁 Location: `/src/components/`
- 📦 Export: `/src/components/index.ts`
- 🎨 Styling: CSS + Tailwind utilities
- 🔗 Path aliases: `@/components`, `@/lib`
