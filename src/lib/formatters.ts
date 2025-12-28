import { format } from 'date-fns';
import { enUS, hi } from 'date-fns/locale';

// Get date-fns locale from i18n language code
export const getDateLocale = (lang: string) => {
  switch (lang) {
    case 'hi':
    case 'mr':
      return hi; // Hindi locale works for Marathi too
    default:
      return enUS;
  }
};

// Format number with locale
export const formatLocalizedNumber = (num: number, lang: string): string => {
  const locale = lang === 'hi' || lang === 'mr' ? 'hi-IN' : 'en-IN';
  return new Intl.NumberFormat(locale).format(num);
};

// Format currency with locale
export const formatLocalizedCurrency = (amount: number, lang: string): string => {
  const locale = lang === 'hi' || lang === 'mr' ? 'hi-IN' : 'en-IN';
  
  if (amount >= 10000000) {
    return `₹${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount / 10000000)}Cr`;
  }
  if (amount >= 100000) {
    return `₹${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount / 100000)}L`;
  }
  if (amount >= 1000) {
    return `₹${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(amount / 1000)}K`;
  }
  return `₹${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)}`;
};

// Format percentage with locale
export const formatLocalizedPercent = (percent: number, lang: string): string => {
  const locale = lang === 'hi' || lang === 'mr' ? 'hi-IN' : 'en-IN';
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(percent)}%`;
};

// Format date with locale
export const formatLocalizedDate = (date: Date | string, formatStr: string, lang: string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, formatStr, { locale: getDateLocale(lang) });
};
