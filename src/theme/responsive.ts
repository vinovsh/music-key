/**
 * responsive — size helpers so the UI fits phones of any size (and tablets).
 *
 * The app is locked to landscape (see AndroidManifest), so the SHORT side is the
 * height and is what constrains the chrome. We scale sizes relative to a baseline
 * landscape phone and clamp, so a near-baseline device looks exactly as designed
 * while small phones shrink and big screens / tablets grow — proportionally.
 *
 * Read once at module load: with a fixed landscape orientation the window size is
 * stable for the session, so StyleSheet.create() can call these directly.
 */
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const screen = {
  width: Math.max(width, height), // long side (landscape)
  height: Math.min(width, height), // short side (landscape) — the limiting one
};

// Baseline = a common landscape phone (~360dp tall). Ratio drives the scaling.
const BASE_SHORT = 360;
const ratio = screen.height / BASE_SHORT;

/**
 * Scale a size by the screen ratio, but only partway (`factor`) so the UI doesn't
 * balloon on large screens, and clamp the multiplier to a sane range. factor 0 =
 * no scaling, 1 = fully proportional. Default 0.5 = gentle.
 */
export function rs(size: number, factor = 0.5): number {
  const mult = Math.min(1.6, Math.max(0.82, 1 + (ratio - 1) * factor));
  return Math.round(size * mult);
}

/** Clamp helper for sizes derived from a measured dimension (e.g. key width). */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
