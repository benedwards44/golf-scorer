import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Golf Scorer",
  slug: "golf-scorer",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#108010"
  },
  userInterfaceStyle: "light",
  extra: {
    eas: {
      projectId: "7ac74aa1-e770-424e-8f79-072447fb4672"
    }
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.cubs.golfscorer",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false
    }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#1a5c38",
    },
    package: "com.cubs.golfscorer",
  },
  plugins: [
    "expo-router",
  ],
  scheme: "golf-scorer",
});
