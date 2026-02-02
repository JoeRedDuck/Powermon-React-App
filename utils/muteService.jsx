import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './apiConfig';
import { getDeviceId } from './deviceId';

const MUTED_CACHE_KEY = '@muted_machines_cache';

// Get muted machines from server
export async function getMutedMachines() {
  try {
    const deviceId = await getDeviceId();
    const apiUrl = await getApiUrl();
    
    const response = await fetch(`${apiUrl}/devices/${deviceId}/muted-machines`);
    
    if (!response.ok) {
      // Try to use cached data if server request fails
      const cached = await AsyncStorage.getItem(MUTED_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    }
    
    const data = await response.json();
    const mutedMachines = data.mutedMachines || [];
    
    // Cache the result
    await AsyncStorage.setItem(MUTED_CACHE_KEY, JSON.stringify(mutedMachines));
    
    return mutedMachines;
  } catch (error) {
    console.error('Failed to get muted machines:', error);
    // Return cached data on error
    try {
      const cached = await AsyncStorage.getItem(MUTED_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }
}

// Mute a machine
export async function muteMachine(machineId) {
  try {
    const deviceId = await getDeviceId();
    const apiUrl = await getApiUrl();
    
    const response = await fetch(`${apiUrl}/devices/${deviceId}/muted-machines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId })
    });
    
    if (!response.ok) throw new Error('Failed to mute machine');
    
    // Update cache
    const mutedMachines = await getMutedMachines();
    if (!mutedMachines.includes(machineId)) {
      mutedMachines.push(machineId);
      await AsyncStorage.setItem(MUTED_CACHE_KEY, JSON.stringify(mutedMachines));
    }
    
    return true;
  } catch (error) {
    console.error('Failed to mute machine:', error);
    return false;
  }
}

// Unmute a machine
export async function unmuteMachine(machineId) {
  try {
    const deviceId = await getDeviceId();
    const apiUrl = await getApiUrl();
    
    const response = await fetch(
      `${apiUrl}/devices/${deviceId}/muted-machines/${machineId}`,
      { method: 'DELETE' }
    );
    
    if (!response.ok) throw new Error('Failed to unmute machine');
    
    // Update cache
    const mutedMachines = await getMutedMachines();
    const filtered = mutedMachines.filter(id => id !== machineId);
    await AsyncStorage.setItem(MUTED_CACHE_KEY, JSON.stringify(filtered));
    
    return true;
  } catch (error) {
    console.error('Failed to unmute machine:', error);
    return false;
  }
}

// Check if a specific machine is muted
export async function isMachineMuted(machineId) {
  try {
    const mutedMachines = await getMutedMachines();
    return mutedMachines.includes(machineId);
  } catch (error) {
    console.error('Failed to check mute status:', error);
    return false;
  }
}
