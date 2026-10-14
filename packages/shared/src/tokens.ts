export const DesignTokens = {
  colors: {
    // Brand & Corporate Navy palette (Executive GCC Theme)
    primary: {
      50: '#F0F5FA',
      100: '#E1EBF5',
      500: '#1A56DB',
      600: '#1E429F',
      700: '#0F275A',
      800: '#0B1A3D',
      900: '#060E22',
    },
    // Neutral Slate
    neutral: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
    // Accessible State Indicators (WCAG AA Compliant contrast on white/dark)
    status: {
      available: {
        bg: '#DCFCE7',
        border: '#86EFAC',
        text: '#166534',
        fill: '#22C55E',
      },
      booked: {
        bg: '#FEE2E2',
        border: '#FCA5A5',
        text: '#991B1B',
        fill: '#EF4444',
      },
      restricted: {
        bg: '#FEF3C7',
        border: '#FCD34D',
        text: '#92400E',
        fill: '#F59E0B',
      },
      maintenance: {
        bg: '#F1F5F9',
        border: '#CBD5E1',
        text: '#475569',
        fill: '#64748B',
      },
      selected: {
        bg: '#DBEAFE',
        border: '#3B82F6',
        text: '#1D4ED8',
        fill: '#2563EB',
      },
    },
    accent: {
      teal: '#0D9488',
      purple: '#7E22CE',
      amber: '#D97706',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radii: {
    sm: 6,
    md: 10,
    lg: 16,
    full: 9999,
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    heading1: { fontSize: 28, fontWeight: 700, lineHeight: 1.2 },
    heading2: { fontSize: 22, fontWeight: 600, lineHeight: 1.3 },
    heading3: { fontSize: 18, fontWeight: 600, lineHeight: 1.4 },
    body: { fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
    caption: { fontSize: 12, fontWeight: 500, lineHeight: 1.4 },
  },
  qrConfig: {
    urlPrefix: 'gcc://book/',
    webUrlPrefix: 'https://gcc.internal/scan?code=',
  },
};
