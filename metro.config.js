const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('srt');
config.resolver.assetExts.push('mp3');

module.exports = config;

