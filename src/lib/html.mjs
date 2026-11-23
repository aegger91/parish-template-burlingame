// Tiny HTML templating: `html` is a tagged template that escapes every
// interpolated value unless it is already marked safe with `raw()`.
// Arrays are joined, and null/undefined/false render as nothing.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const raw = (value) => (value instanceof SafeHtml ? value : new SafeHtml(String(value ?? '')));

const renderValue = (value) => {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(renderValue).join('');
  if (value instanceof SafeHtml) return value.value;
  return esc(value);
};

export function html(strings, ...values) {
  let out = '';
  strings.forEach((chunk, i) => {
    out += chunk;
    if (i < values.length) out += renderValue(values[i]);
  });
  return new SafeHtml(out);
}

// attrs({ class: ['a', cond && 'b'], hidden: true, href: url }) -> safe attribute string
export function attrs(map) {
  const parts = [];
  for (const [key, value] of Object.entries(map)) {
    if (value === null || value === undefined || value === false) continue;
    if (value === true) {
      parts.push(key);
      continue;
    }
    const v = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
    // alt="" is meaningful (decorative image); every other empty attribute is dropped.
    if (v === '' && key !== 'alt') continue;
    parts.push(`${key}="${esc(v)}"`);
  }
  return raw(parts.length ? ' ' + parts.join(' ') : '');
}

export const cx = (...names) => names.flat().filter(Boolean).join(' ');

export const toString = (value) => renderValue(value);
