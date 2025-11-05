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
          backgroundColor: "#000000"
        }
      }
    ]
  ],

  sdkVersion: "54.0.0",
  platforms: ["ios", "android", "web"],

  ios: {
    supportsTablet: true
  },

  android: {
    ...(config.android ?? {}),
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/icon.png",
    },
    package: "com.prozomix.powermon" // ✅ required unique package name
  },

  web: {
    output: "static",
    favicon: "./assets/images/favicon.png"
  },

  experiments: {
    typedRoutes: true,
    reactCompiler: true
  },

  extra: {
    ...(config.extra ?? {}),
    apiBase: process.env.EXPO_PUBLIC_API_BASE ?? process.env.API_BASE,
    eas: {
      projectId: "5a5b70c9-12c1-4609-aed3-d0249d7c2b6f"
    }
  },

  androidStatusBar: {
    backgroundColor: "#ffffff"
  }
});
