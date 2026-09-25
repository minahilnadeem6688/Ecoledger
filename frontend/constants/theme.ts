/**
 * EcoLedger design tokens, from the project palette:
 * Rose Pompadour #E27396 · Amaranth Pink #EA9AB2 · Mimi Pink #FFDBE5
 * Asparagus #6D9F71 · Dark Spring Green #337357
 */
import { Platform } from 'react-native';

export const C = {
  bg: '#FFF3F6',
  blush: '#FFDBE5',
  pink: '#EA9AB2',
  rose: '#E27396',
  roseDeep: '#C4587B',
  sage: '#6D9F71',
  green: '#337357',
  greenDeep: '#23513D',
  ink: '#1B2B24',
  text: '#33423B',
  muted: '#6E7C75',
  line: '#F1D6DF',
  lineStrong: '#E6BFCC',
  card: '#FFFFFF',
  greenTint: '#E7F1E8',
  roseTint: '#FDEAF0',
  amber: '#A8680C',
  amberTint: '#FFF1D6',
  red: '#B4432A',
  redTint: '#FCE3DC',
};

export const R = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 };

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const font = Platform.select({
  web: "Inter, 'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif",
  default: undefined,
});

export const mono = Platform.select({
  web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  ios: 'Menlo',
  default: 'monospace',
});

export const shadow: any = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(51,115,87,0.06), 0 10px 28px -14px rgba(51,115,87,0.22)' },
  default: {
    shadowColor: '#337357',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
});

/** Breakpoints used by useLayout() */
export const BP = { tablet: 700, desktop: 1024 };
