import { StyleSheet, type TextStyle } from 'react-native';
import tokens from './tokens.json';

/*
 * Paleta «Mirador · tablero» (documentacion/wireframes/wireframes-mirador-tablero.html).
 * Los valores viven en tokens.json, que también lee tailwind.config.js (clases de NativeWind).
 * shell: barra superior (negro solapa) · trim: franja ámbar del letrero ·
 * libre/ocupada/porCobrar: estados de mesa (RF-16 y RF-30) · danger: fondo del botón peligroso.
 */
export const colors = tokens.colors;
export const radius = tokens.radius;
export const space = tokens.space;

/**
 * Familias cargadas en el layout raíz. Cada peso es un archivo propio: no se combina con
 * `fontWeight`, porque Android engrosaría la fuente otra vez (negrita sintética).
 */
export const fonts = tokens.fonts;

export const type = StyleSheet.create({
  title: { fontSize: 22, fontFamily: fonts.display, letterSpacing: 1.2, color: colors.ink },
  h: { fontSize: 17, fontFamily: fonts.display, letterSpacing: 0.6, color: colors.ink },
  label: { fontSize: 12, fontFamily: fonts.display, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.ink3 },
  body: { fontSize: 15, fontFamily: fonts.body, color: colors.ink },
  small: { fontSize: 13, fontFamily: fonts.body, color: colors.ink3 },
  figure: { fontSize: 30, fontFamily: fonts.display, color: colors.ink, fontVariant: ['tabular-nums'] },
});

/** La misma escala de `type` como clases de NativeWind, para las pantallas ya migradas a className. */
export const text = {
  title: 'font-display text-[22px] tracking-[1.2px] text-ink',
  h: 'font-display text-[17px] tracking-[0.6px] text-ink',
  label: 'font-display text-[12px] tracking-[1.4px] uppercase text-ink3',
  body: 'font-body text-[15px] text-ink',
  small: 'font-body text-[13px] text-ink3',
  figure: 'font-display text-[30px] text-ink',
};

// NativeWind no traduce font-variant-numeric: las cifras alineadas van por style.
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** Barra superior: negro solapa, como el letrero. */
export const headerOptions = {
  headerStyle: { backgroundColor: colors.shell },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontFamily: fonts.display },
  headerShadowVisible: false,
};
