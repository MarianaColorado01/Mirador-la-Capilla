// NativeWind v4: JSX con className y su preset. babel-preset-expo ya incluye expo-router,
// el React Compiler (app.json) y el plugin de reanimated/worklets.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
