export interface ReaderSettings {
  mode: 'scroll' | 'paged' | 'double';
  direction: 'ltr' | 'rtl';
  theme: 'light' | 'paper' | 'night';
  width: number;
  gap: number;
  numbers: boolean;
}
export const defaultReaderSettings: ReaderSettings = {
  mode: 'scroll',
  direction: 'ltr',
  theme: 'night',
  width: 980,
  gap: 12,
  numbers: false,
};
export function readerSettings(input: unknown): ReaderSettings {
  const value = (input && typeof input === 'object' ? input : {}) as Partial<ReaderSettings>;
  const number = (input: unknown, fallback: number, min: number, max: number) =>
    Number.isFinite(Number(input)) ? Math.max(min, Math.min(max, Number(input))) : fallback;
  return {
    mode: ['scroll', 'paged', 'double'].includes(value.mode || '') ? value.mode! : 'scroll',
    direction: value.direction === 'rtl' ? 'rtl' : 'ltr',
    theme: ['light', 'paper', 'night'].includes(value.theme || '') ? value.theme! : 'night',
    width: number(value.width, 980, 560, 1400),
    gap: number(value.gap, 12, 0, 40),
    numbers: typeof value.numbers === 'boolean' ? value.numbers : false,
  };
}
