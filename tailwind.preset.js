module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary, #14b8a6)', // Default to new green (teal-500)
        work: '#f97316', // orange-500 (timer work interval)
        rest: '#14b8a6', // teal-500 (timer rest interval)
        record: '#f59e0b', // amber-500 (PB / favorites)
        danger: '#dc2626', // red-600 (delete / cancel / no-show)
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        logo: ['Satisfy', 'cursive'],
        handwriting: ['Caveat', 'cursive'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace']
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        'full': '9999px'
      }
    }
  }
}
