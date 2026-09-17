/** Canonical site locales (BCP-47 language codes), in priority order. */
export const LOCALES = ['en', 'si', 'ta'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
