/**
 * keyboardScroll — the live horizontal scroll position shared between the
 * mini-keyboard (which writes it during a drag) and the main keyboard (which
 * reads it to translate its keys). It's a Reanimated shared value, so the keys
 * slide on the UI thread with no React re-render.
 *
 * `scrollIndex` is the fractional leftmost-visible white-key index (into
 * FULL_WHITE_KEYS). `scrollActive` is true while the user is dragging, so the
 * store→scroll sync below doesn't fight the drag.
 *
 * The canonical integer window still lives in keyboardStore (for hit-testing
 * fallbacks + persistence); this just mirrors it for smooth motion.
 */
import { makeMutable } from 'react-native-reanimated';
import { useKeyboardStore } from './keyboardStore';

export const scrollIndex = makeMutable(useKeyboardStore.getState().windowStart);
export const scrollActive = makeMutable(false);

// Keep the scroll position in sync when the window moves from something other
// than an active drag: zoom, tap-to-jump, or persisted rehydrate.
useKeyboardStore.subscribe((s) => {
  if (!scrollActive.value) {
    scrollIndex.value = s.windowStart;
  }
});
