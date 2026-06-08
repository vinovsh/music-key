/**
 * Jest setup. Native-only modules are stubbed for the JS test environment.
 */
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
