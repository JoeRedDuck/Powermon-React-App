export default ({ config }) => ({
  ...config,
  extra: {
    // CHANGED: use EXPO_PUBLIC_ on web, fallback to API_BASE
    apiBase: process.env.EXPO_PUBLIC_API_BASE ?? process.env.API_BASE,
  },
});