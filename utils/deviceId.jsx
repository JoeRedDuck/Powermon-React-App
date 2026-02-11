import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

const DEVICE_ID_KEY = '@device_id';

// IMPORTANT: This must match the device_name used in notification registration!
// See NotificationContext.jsx - it uses Constants.deviceName || Device.modelName
export async function getDeviceId() {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      // Use the same logic as notification registration to ensure they match
      const deviceName = Constants.deviceName || Device.modelName || 'unknown';
      // Don't add timestamp - keep it consistent across app reinstalls
      deviceId = deviceName;
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      console.log('Generated device ID for mute preferences:', deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('Failed to get device ID:', error);
    // Fallback - use device name without storage
    return Constants.deviceName || Device.modelName || 'unknown';
  }
}
