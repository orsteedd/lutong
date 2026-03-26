/**
 * Utility functions for the inventory PWA
 */

/**
 * Generate a unique ID
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Format a date to a readable string
 */
export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Debounce a function
 */
export const debounce = <TArgs extends unknown[], TResult>(
  func: (...args: TArgs) => TResult,
  wait: number
): ((...args: TArgs) => void) => {
  let timeout: ReturnType<typeof setTimeout>
  return function executeFunc(...args: TArgs) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Parse barcode or QR code data
 */
export const parseBarcodeData = (data: string): { sku: string; quantity?: number } => {
  // Support formats: SKU or SKU:QUANTITY
  const parts = data.split(':')
  return {
    sku: parts[0],
    quantity: parts[1] ? parseInt(parts[1], 10) : 1,
  }
}
