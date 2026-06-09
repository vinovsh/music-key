module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated 4 ships its Babel plugin via react-native-worklets. It MUST be
  // listed last so it can transform worklets after everything else.
  plugins: ['react-native-worklets/plugin'],
};
