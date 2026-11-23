// Localization helpers shared by the build and the translation script.
//
// A "localized value" is an object keyed by locale code, e.g.
//   { "en": "Services", "ru": "Богослужения" }
// Any locale may be missing; rendering falls back to the source locale.

export function isLocalized(value, localeCodes) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => localeCodes.includes(k)) && keys.some((k) => typeof value[k] === 'string');
}

export function pickLocale(value, locale, sourceLocale) {
  if (value === null || value === undefined) return { text: '', lang: null, fallback: false };
  if (typeof value === 'string' || typeof value === 'number') return { text: String(value), lang: null, fallback: false };
  if (typeof value === 'object') {
    if (typeof value[locale] === 'string' && value[locale] !== '') return { text: value[locale], lang: locale, fallback: false };
    if (typeof value[sourceLocale] === 'string') return { text: value[sourceLocale], lang: sourceLocale, fallback: locale !== sourceLocale };
  }
  return { text: '', lang: null, fallback: false };
}

const capitalize = (s) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

const DATE_STYLES = {
  // Saturday, November 28 / Суббота, 28 ноября
  weekdayLong: { weekday: 'long', month: 'long', day: 'numeric' },
  // November 28, 2026 / 28 ноября 2026 г.
  long: { year: 'numeric', month: 'long', day: 'numeric' },
  // Saturday, November 28, 2026
  full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  monthYear: { year: 'numeric', month: 'long' },
  dayMonth: { month: 'long', day: 'numeric' },
  weekdayDay: { weekday: 'short', day: 'numeric' },
  short: { weekday: 'short', month: 'short', day: 'numeric' },
  monthShort: { month: 'short' },
  day: { day: 'numeric' },
  weekdayShort: { weekday: 'short' }
};

export function formatDate(iso, locale, style = 'long') {
  if (!iso) return '';
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  const opts = { ...DATE_STYLES[style], timeZone: 'UTC' };
  let out = new Intl.DateTimeFormat(locale, opts).format(date);
  if (style === 'monthShort') out = out.replace('.', '');
  return style === 'day' ? out : capitalize(out);
}

// "18:00" -> "6:00 pm" (en), "18:00" (ru), in each locale's own clock style.
export function formatTime(hhmm, locale) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const out = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
  return out.replace(/[\s\u202f]?([AP])M$/, (_, x) => `\u00a0${x.toLowerCase()}m`).replace(/\u202f/g, '\u00a0');
}

export function interpolate(template, vars = {}) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}
