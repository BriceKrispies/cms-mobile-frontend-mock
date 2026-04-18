// Declarative axis registry for the theme module. Pure data.
// Each option's `vars` object is a set of CSS custom properties applied
// inline on <html>. Options with an empty `vars: {}` mean "use the
// baseline tokens defined in /src/tokens/*.css".

export const AXES = [
  {
    id: 'palette',
    label: 'Palette',
    default: 'indigo',
    options: [
      { id: 'indigo', label: 'Indigo', vars: {} },
      {
        id: 'ocean',
        label: 'Ocean',
        vars: {
          '--color-primary': '#0369a1',
          '--color-primary-hover': '#075985',
          '--color-primary-soft': '#e0f2fe',
          '--color-on-primary': '#ffffff',
          '--color-focus-ring': '#0ea5e9',
          '--color-accent': '#14b8a6',
          '--color-accent-soft': '#ccfbf1',
        },
      },
      {
        id: 'sunset',
        label: 'Sunset',
        vars: {
          '--color-primary': '#ea580c',
          '--color-primary-hover': '#c2410c',
          '--color-primary-soft': '#ffedd5',
          '--color-on-primary': '#ffffff',
          '--color-focus-ring': '#f97316',
          '--color-accent': '#e11d48',
          '--color-accent-soft': '#ffe4e6',
        },
      },
      {
        id: 'forest',
        label: 'Forest',
        vars: {
          '--color-primary': '#15803d',
          '--color-primary-hover': '#166534',
          '--color-primary-soft': '#dcfce7',
          '--color-on-primary': '#ffffff',
          '--color-focus-ring': '#22c55e',
          '--color-accent': '#ca8a04',
          '--color-accent-soft': '#fef9c3',
        },
      },
      {
        id: 'mono',
        label: 'Mono',
        vars: {
          '--color-primary': '#1f2937',
          '--color-primary-hover': '#0f172a',
          '--color-primary-soft': '#e5e7eb',
          '--color-on-primary': '#ffffff',
          '--color-focus-ring': '#6b7280',
          '--color-accent': '#4b5563',
          '--color-accent-soft': '#e5e7eb',
        },
      },
      {
        id: 'plum',
        label: 'Plum',
        vars: {
          '--color-primary': '#9333ea',
          '--color-primary-hover': '#7e22ce',
          '--color-primary-soft': '#f3e8ff',
          '--color-on-primary': '#ffffff',
          '--color-focus-ring': '#a855f7',
          '--color-accent': '#db2777',
          '--color-accent-soft': '#fce7f3',
        },
      },
    ],
  },

  {
    id: 'mode',
    label: 'Mode',
    default: 'auto',
    // Dark vars live in /src/theme/theme.css and are activated by the
    // data-theme-mode attribute; no inline overrides are needed here.
    options: [
      { id: 'auto', label: 'Auto', vars: {} },
      { id: 'light', label: 'Light', vars: {} },
      { id: 'dark', label: 'Dark', vars: {} },
    ],
  },

  {
    id: 'density',
    label: 'Density',
    default: 'comfortable',
    options: [
      {
        id: 'compact',
        label: 'Compact',
        vars: {
          '--space-1': '0.125rem',
          '--space-2': '0.375rem',
          '--space-3': '0.5rem',
          '--space-4': '0.75rem',
          '--space-5': '1rem',
          '--space-6': '1.25rem',
          '--space-8': '1.5rem',
          '--space-10': '2rem',
          '--space-12': '2.5rem',
          '--size-touch': '36px',
          '--size-nav-height': '48px',
          '--size-header-height': '48px',
        },
      },
      { id: 'comfortable', label: 'Comfortable', vars: {} },
      {
        id: 'cozy',
        label: 'Cozy',
        vars: {
          '--space-1': '0.375rem',
          '--space-2': '0.625rem',
          '--space-3': '1rem',
          '--space-4': '1.25rem',
          '--space-5': '1.5rem',
          '--space-6': '2rem',
          '--space-8': '2.5rem',
          '--space-10': '3rem',
          '--space-12': '3.5rem',
          '--size-touch': '48px',
          '--size-nav-height': '64px',
          '--size-header-height': '64px',
        },
      },
    ],
  },

  {
    id: 'roundness',
    label: 'Roundness',
    default: 'rounded',
    options: [
      {
        id: 'sharp',
        label: 'Sharp',
        vars: {
          '--radius-xs': '0',
          '--radius-sm': '0',
          '--radius-md': '0',
          '--radius-lg': '0',
          '--radius-xl': '0',
          '--radius-2xl': '0',
        },
      },
      { id: 'rounded', label: 'Rounded', vars: {} },
      {
        id: 'soft',
        label: 'Soft',
        vars: {
          '--radius-xs': '4px',
          '--radius-sm': '8px',
          '--radius-md': '12px',
          '--radius-lg': '18px',
          '--radius-xl': '24px',
          '--radius-2xl': '32px',
        },
      },
      {
        id: 'pill',
        label: 'Pill',
        vars: {
          '--radius-xs': '999px',
          '--radius-sm': '999px',
          '--radius-md': '999px',
          '--radius-lg': '999px',
          '--radius-xl': '999px',
          '--radius-2xl': '999px',
        },
      },
    ],
  },

  {
    id: 'font',
    label: 'Typeface',
    default: 'system',
    options: [
      { id: 'system', label: 'System', vars: {} },
      {
        id: 'serif',
        label: 'Serif',
        vars: {
          '--font-sans':
            'Georgia, "Iowan Old Style", "Times New Roman", Times, serif',
        },
      },
      {
        id: 'mono',
        label: 'Mono',
        vars: { '--font-sans': 'var(--font-mono)' },
      },
      {
        id: 'rounded',
        label: 'Rounded',
        vars: {
          '--font-sans':
            'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manjari, "Arial Rounded MT Bold", Calibri, source-sans-pro, sans-serif',
        },
      },
    ],
  },

  {
    id: 'contrast',
    label: 'Contrast',
    default: 'normal',
    options: [
      { id: 'normal', label: 'Normal', vars: {} },
      {
        id: 'high',
        label: 'High',
        vars: {
          '--color-text-muted': 'var(--color-text)',
          '--color-text-subtle': 'var(--color-text-muted)',
          '--color-border': 'var(--color-border-strong)',
        },
      },
    ],
  },
];

export const AXIS_BY_ID = Object.fromEntries(AXES.map((a) => [a.id, a]));

// Union of every CSS property that any option in any axis might set.
// The engine uses this to clear stale overrides cleanly on every apply.
export const TRACKED_PROPS = (() => {
  const set = new Set();
  for (const axis of AXES) {
    for (const opt of axis.options) {
      for (const prop of Object.keys(opt.vars || {})) set.add(prop);
    }
  }
  return [...set];
})();
