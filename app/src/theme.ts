import { StyleSheet } from 'react-native';

/* Paleta «Mirador · tablero» (documentacion/wireframes/wireframes-mirador-tablero.html). */
export const colors = {
  shell: '#111214', // barra superior: negro solapa
  shell2: '#1C1D20',
  trim: '#FFC53D', // franja ámbar del letrero
  bg: '#0D0D0F',
  face: '#18181B',
  face2: '#121214',
  line: '#2F3136',
  line2: '#24262A',
  ink: '#F2F2F2',
  ink2: '#BCC1C8',
  ink3: '#9298A1',
  steel: '#B6BBC2',
  // estados (RF-16 y RF-30)
  libre: '#45D483',
  ocupada: '#FF8F33',
  porCobrar: '#FF6B63',
  amber: '#FFC53D',
  green: '#45D483',
  red: '#FF6B63',
  greenBg: 'rgba(69,212,131,0.13)',
  redBg: 'rgba(255,107,99,0.14)',
  amberBg: 'rgba(255,197,61,0.13)',
  orangeBg: 'rgba(255,143,51,0.14)',
  onLight: '#0D0D0F',
} as const;

export const radius = { sm: 6, md: 10, lg: 14 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const type = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', letterSpacing: 1.2, color: colors.ink },
  h: { fontSize: 17, fontWeight: '700', letterSpacing: 0.6, color: colors.ink },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: colors.ink3 },
  body: { fontSize: 15, color: colors.ink },
  small: { fontSize: 13, color: colors.ink3 },
  figure: { fontSize: 30, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
});

/** Barra superior: negro solapa, como el letrero. */
export const headerOptions = {
  headerStyle: { backgroundColor: colors.shell },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontWeight: '800' as const },
  headerShadowVisible: false,
};
