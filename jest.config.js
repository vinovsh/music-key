module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  // These ship untranspiled ESM; let Babel transform them (default ignores node_modules).
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|react-native-gesture-handler|react-native-reanimated|react-native-worklets)/)',
  ],
};
