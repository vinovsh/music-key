/**
 * Jest setup. Native-only modules are stubbed for the JS test environment.
 */

// Reanimated + Gesture Handler are UI-thread/native. Reanimated 4's bundled mock
// drags in native worklets code that can't load under Jest, so stub the small
// surface the app actually uses.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c) => c },
    View,
    useSharedValue: (v) => ({ value: v }),
    makeMutable: (v) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedProps: () => ({}),
    withTiming: (v) => v,
    runOnJS: (fn) => fn,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const chainable = () => {
    const b = {};
    for (const m of ['enabled', 'minDistance', 'onBegin', 'onUpdate', 'onFinalize']) {
      b[m] = () => b;
    }
    return b;
  };
  return {
    __esModule: true,
    Gesture: { Pan: chainable },
    GestureDetector: ({ children }) => children,
    GestureHandlerRootView: View,
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
  },
}));


jest.mock('./src/specs/NativeAudioEngine', () => ({
  __esModule: true,
  default: {
    noteOn: jest.fn(),
    noteOff: jest.fn(),
    setMasterGain: jest.fn(),
    setProgram: jest.fn(),
    setSustain: jest.fn(),
  },
}));
