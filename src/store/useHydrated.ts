/**
 * useAppHydrated — true once the persisted stores that drive the first paint have
 * loaded from AsyncStorage. Until then the UI is showing DEFAULT values (key
 * size, labels, instrument, volume…) and would visibly "jump" when storage
 * resolves; the startup cover uses this to hold a clean screen until we can paint
 * the real, saved state in one go.
 */
import { useEffect, useState } from 'react';
import { useSettingsStore } from './settingsStore';
import { useKeyboardStore } from './keyboardStore';
import { useInstrumentStore } from './instrumentStore';

// Stores whose persisted state changes the initial on-screen layout.
const gated = [useSettingsStore, useKeyboardStore, useInstrumentStore] as const;

function allHydrated(): boolean {
  return gated.every((s) => s.persist.hasHydrated());
}

export function useAppHydrated(): boolean {
  const [hydrated, setHydrated] = useState(allHydrated);

  useEffect(() => {
    if (hydrated) return;
    const check = () => {
      if (allHydrated()) setHydrated(true);
    };
    const unsubs = gated.map((s) => s.persist.onFinishHydration(check));
    check(); // in case hydration finished between render and effect
    return () => unsubs.forEach((u) => u());
  }, [hydrated]);

  return hydrated;
}
