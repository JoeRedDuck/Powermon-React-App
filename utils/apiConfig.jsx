import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL_KEY = '@powermon_api_url';

/**
 * Get the API base URL from AsyncStorage or fallback to environment/config
 */
export async function getApiUrl() {
  try {
    const storedUrl = await AsyncStorage.getItem(API_URL_KEY);
    if (storedUrl) {
      return storedUrl.replace(/\/$/, ''); // Remove trailing slash
    }
  } catch (error) {
    console.error('Failed to get API URL from storage:', error);
  }
  
  // Fallback to environment or config
  const defaultUrl = process.env.EXPO_PUBLIC_API_BASE || Constants.expoConfig?.extra?.apiBase || '';
  return defaultUrl.replace(/\/$/, '');
}

/**
 * Save the API base URL to AsyncStorage
 */
export async function setApiUrl(url) {
  try {
    const cleanUrl = url.trim().replace(/\/$/, ''); // Remove trailing slash
    await AsyncStorage.setItem(API_URL_KEY, cleanUrl);
    return { success: true };
  } catch (error) {
    console.error('Failed to save API URL:', error);
    return { success: false, error };
  }
}

/**
 * Get the default API URL from environment/config
 */
export function getDefaultApiUrl() {
  const defaultUrl = process.env.EXPO_PUBLIC_API_BASE || Constants.expoConfig?.extra?.apiBase || '';
  return defaultUrl.replace(/\/$/, '');
}

/**
 * Clear the stored API URL (will revert to default)
 */
export async function clearApiUrl() {
  try {
    await AsyncStorage.removeItem(API_URL_KEY);
    return { success: true };
  } catch (error) {
    console.error('Failed to clear API URL:', error);
    return { success: false, error };
  }
}
