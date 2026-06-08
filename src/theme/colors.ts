/**
 * Design tokens — the neon/glow palette from ref/piano_ui.png.
 * Centralised so the look stays consistent and is easy to polish in Phase 5.
 */
export const colors = {
  bg: '#0c0a1a',
  panel: '#171331',
  panelBorder: '#2a2350',
  accent: '#ff4fd8', // neon pink (active instrument, C labels, highlights)
  accentDim: '#7a2f6b',
  text: '#f2eefb',
  textDim: '#b9b4d0',
  textFaint: '#6c6786',

  whiteKey: '#f4f1fb',
  whiteKeyActive: '#d9b6ff',
  whiteKeyShadow: '#bdb6d6',
  blackKey: '#1a1726',
  blackKeyActive: '#ff4fd8',
  keyboardBg: '#0a0816',
} as const;
