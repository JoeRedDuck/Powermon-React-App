import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { getMutedMachines, muteMachine, unmuteMachine } from "../utils/muteService.jsx";
import useGetDevice from "../utils/getDevice.jsx";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

function DeviceToggleItem({ device, isMuted, onToggle, busy }) {
  return (
    <View style={styles.deviceCard}>
      <View style={styles.deviceInfo}>
        <View style={styles.deviceHeader}>
          <Ionicons 
            name={isMuted ? "notifications-off" : "notifications"} 
            size={20} 
            color={isMuted ? "#EF4444" : "#10B981"} 
          />
          <Text style={styles.deviceName}>{device?.name || "Loading..."}</Text>
        </View>
        <Text style={styles.deviceMac}>{device?.mac}</Text>
        <Text style={styles.deviceLocation}>{device?.location || "No location"}</Text>
      </View>
      <TouchableOpacity 
        style={[
          styles.toggleButton, 
          isMuted ? styles.toggleButtonMuted : styles.toggleButtonActive,
          busy && styles.buttonDisabled
        ]}
        onPress={() => onToggle(device.mac)}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.toggleButtonText}>
            {isMuted ? "Unmute" : "Mute"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function MutedDevices() {
  const [allDevices, setAllDevices] = useState([]);
  const [mutedMacs, setMutedMacs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyMacs, setBusyMacs] = useState(new Set());

  const loadDevices = async () => {
    setLoading(true);
    try {
      // Fetch all devices
      const apiBase = process.env.EXPO_PUBLIC_API_BASE || Constants.expoConfig?.extra?.apiBase || '';
      const url = `${apiBase.replace(/\/$/, '')}/api/v1/status`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setAllDevices(data || []);
      }
      
      // Fetch muted machines
      const muted = await getMutedMachines();
      setMutedMacs(muted);
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleToggle = async (mac) => {
    if (busyMacs.has(mac)) return;
    
    setBusyMacs(prev => new Set(prev).add(mac));
    
    try {
      const isMuted = mutedMacs.includes(mac);
      
      if (isMuted) {
        const success = await unmuteMachine(mac);
        if (success) {
          setMutedMacs(prev => prev.filter(m => m !== mac));
        }
      } else {
        const success = await muteMachine(mac);
        if (success) {
          setMutedMacs(prev => [...prev, mac]);
        }
      }
    } finally {
      setBusyMacs(prev => {
        const next = new Set(prev);
        next.delete(mac);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EA" />
        <Text style={styles.loadingText}>Loading devices...</Text>
      </View>
    );
  }

  if (allDevices.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="notifications" size={64} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>No Devices Found</Text>
        <Text style={styles.emptyText}>
          Add some devices to manage alerts
        </Text>
      </View>
    );
  }

  const mutedCount = mutedMacs.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {mutedCount} of {allDevices.length} {allDevices.length === 1 ? "device" : "devices"} muted
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {allDevices.map((device) => (
          <DeviceToggleItem 
            key={device.mac} 
            device={device}
            isMuted={mutedMacs.includes(device.mac)}
            onToggle={handleToggle}
            busy={busyMacs.has(device.mac)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6"
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    gap: 12,
    padding: 20
  },
  header: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  headerText: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500"
  },
  scrollContent: {
    padding: 10,
    gap: 10
  },
  deviceCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 11,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  deviceInfo: {
    flex: 1,
    gap: 6
  },
  deviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  deviceName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827"
  },
  deviceMac: {
    fontSize: 13,
    color: "#6B7280"
  },
  deviceLocation: {
    fontSize: 13,
    color: "#9CA3AF",
    fontStyle: "italic"
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center"
  },
  toggleButtonActive: {
    backgroundColor: "#EF4444",
    borderWidth: 1,
    borderColor: "#DC2626"
  },
  toggleButtonMuted: {
    backgroundColor: "#10B981",
    borderWidth: 1,
    borderColor: "#059669"
  },
  buttonDisabled: {
    opacity: 0.5
  },
  toggleButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600"
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 8
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#111827",
    marginTop: 12
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    maxWidth: 300
  }
});
