export default ({ config }) => ({
  ...config,

  name: "Powermon",
  slug: "Powermon",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "powermon",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,

  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
  ],

  sdkVersion: "54.0.0",
  platforms: ["ios", "android", "web"],

  ios: {
    bundleIdentifier: "com.prozomix.powermon",
    supportsTablet: true,
  },

  android: {
    ...(config.android ?? {}),
    package: "com.prozomix.powermon",
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/icon.png",
    },
    usesCleartextTraffic: true, // ✅ allows http://192.168.x.x API calls
  },

  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  androidStatusBar: {
    backgroundColor: "#ffffff",
  },

  extra: {
    apiBase: process.env.EXPO_PUBLIC_API_BASE ?? process.env.API_BASE ?? "http://192.168.11.175:8000",
  },
});
