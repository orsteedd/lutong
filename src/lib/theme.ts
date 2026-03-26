import { create } from 'zustand'

/**
 * Design System Theme Configuration
 * Central source of truth for all design tokens
 */

export const theme = {
  colors: {
    // Primary Brand Color
    primary: '#DA251D',
    primary_hover: '#C71F16',
    primary_active: '#B01910',
    
    // Secondary Color
    secondary: '#8B2F31',
    secondary_hover: '#7B2829',
    secondary_active: '#6B2121',
    
    // Error/Danger
    error: '#5A0F0B',
    error_light: '#FEE2E2',
    
    // Success
    success: '#16A34A',
    success_light: '#DCFCE7',
    
    // Warning
    warning: '#F59E0B',
    warning_light: '#FEF3C7',
    
    // Neutrals
    black: '#000000',
    white: '#FFFFFF',
    
    // Gray Scale
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
  },
  
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  },
  
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
  },
} as const

/**
 * Design System Store (for runtime theme switching if needed)
 */
export const useThemeStore = create(() => ({
  theme,
  getColor: (colorKey: keyof typeof theme.colors) => theme.colors[colorKey],
}))
