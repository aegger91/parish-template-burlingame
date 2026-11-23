// theme/tokens.json -> CSS custom properties on :root.
//
//   color.navy          -> --color-navy
//   semantic.brand      -> --brand          (references like "{color.navy}"
//                                            become var(--color-navy))
//   font-size.lg        -> --font-size-lg
//   layout.container    -> --layout-container
const UNPREFIXED = new Set(['semantic']);
const SKIP = new Set(['$schema', 'meta', 'fontFaces', 'fontImports']);

const varName = (group, key) => (UNPREFIXED.has(group) ? `--${key}` : `--${group}-${key}`);

function resolve(value) {
  return String(value).replace(/\{([\w-]+)\.([\w-]+)\}/g, (_, group, key) => `var(${varName(group, key)})`);
}

export function tokensToCss(tokens) {
  const lines = [];
  for (const [group, values] of Object.entries(tokens)) {
    if (SKIP.has(group) || typeof values !== 'object') continue;
    for (const [key, value] of Object.entries(values)) lines.push(`  ${varName(group, key)}: ${resolve(value)};`);
  }
  return `:root {\n${lines.join('\n')}\n}\n`;
}

// tokens.fontImports (hosted font stylesheets, e.g. Google Fonts) and
// tokens.fontFaces (self-hosted files) -> @import / @font-face rules, so a
// theme swaps its fonts together with its colors.
export function fontsToCss(tokens) {
  const imports = (tokens.fontImports || []).map((url) => `@import url("${url}");`);
  const faces = (tokens.fontFaces || []).map((f) =>
    [
      '@font-face {',
      `  font-family: "${f.family}";`,
      `  font-style: ${f.style || 'normal'};`,
      `  font-weight: ${f.weight || 400};`,
      `  font-display: ${f.display || 'swap'};`,
      `  src: url("${f.src}") format("${f.format || 'woff2'}");`,
      f.unicodeRange ? `  unicode-range: ${f.unicodeRange};` : null,
      '}'
    ]
      .filter(Boolean)
      .join('\n')
  );
  return [...imports, ...faces].join('\n');
}

export const preloadFonts = (tokens) => (tokens.fontFaces || []).filter((f) => f.preload).map((f) => f.src);
