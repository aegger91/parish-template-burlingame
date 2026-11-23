// Stable JSON formatting for content files written by scripts (and by a
// builder that saves back to the repository): 2-space indent, with small
// objects and arrays kept on one line so localized pairs stay readable:
//   "title": { "en": "Services", "ru": "Богослужения" }
const INLINE_MAX = 100;

function inline(value) {
  if (Array.isArray(value)) return value.length ? `[${value.map(inline).join(', ')}]` : '[]';
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    return entries.length ? `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
}

const hasNestedObjects = (value) => Object.values(value).some((v) => v && typeof v === 'object' && (Array.isArray(v) ? v.some((x) => x && typeof x === 'object') : true));

function format(value, indent, keyLength) {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  const one = inline(value);
  if (!one.includes('\n') && indent.length + keyLength + one.length <= INLINE_MAX && !hasNestedObjects(value)) return one;
  const next = `${indent}  `;
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return `[\n${value.map((v) => `${next}${format(v, next, 0)}`).join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(value);
  if (!entries.length) return '{}';
  return `{\n${entries.map(([k, v]) => `${next}${JSON.stringify(k)}: ${format(v, next, JSON.stringify(k).length + 2)}`).join(',\n')}\n${indent}}`;
}

export function formatJson(value) {
  return `${format(value, '', 0)}\n`;
}
