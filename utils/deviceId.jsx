import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@device_id';

export async function getDeviceId() {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      // Generate unique device ID using device info + timestamp
      const uniqueId = Device.modelId || Device.deviceName || 'unknown';
      deviceId = `${Device.osName}-${uniqueId}-${Date.now()}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('Failed to get device ID:', error);
    // Fallback to a temporary ID
    return `temp-${Date.now()}`;
  }
}
