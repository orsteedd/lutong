/**
 * shadcn-style utility for merging Tailwind classes
 */
export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
