// getDefaultConfig ya detecta el monorepo (node_modules de la raíz y @mirador/shared).
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

module.exports = withNativeWind(getDefaultConfig(__dirname), { input: './global.css' });
