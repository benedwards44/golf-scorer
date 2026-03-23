import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Golf Scorer',
  slug: 'golf-scorer',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    backgroundColor: '#1a5c38',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.golfscorer.app',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#1a5c38',
    },
    package: 'com.golfscorer.app',
  },
  plugins: ['expo-router'],
  scheme: 'golf-scorer',
});
