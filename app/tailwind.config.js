// Mismos valores que src/theme.ts: los dos leen src/tokens.json (una sola fuente de verdad).
const t = require('./src/tokens.json');

const px = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, `${v}px`]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // La app es siempre oscura y no usa variantes dark:. Con 'media', NativeWind en la web lanza
  // «Cannot manually set color scheme» al cargar el CSS y la pantalla queda en error.
  darkMode: 'class',
  theme: {
    extend: {
      colors: t.colors,
      borderRadius: px(t.radius),
      spacing: px(t.space),
      fontFamily: {
        display: [t.fonts.display],
        body: [t.fonts.body],
        'body-semi': [t.fonts.bodySemi],
        'body-bold': [t.fonts.bodyBold],
      },
    },
  },
  plugins: [],
};
