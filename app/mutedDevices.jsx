import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { getMutedMachines, unmuteMachine } from "../utils/muteService.jsx";
import useGetDevice from "../utils/getDevice.jsx";

function MutedDeviceItem({ mac, onUnmute }) {
  const device = useGetDevice(mac);
  const [busy, setBusy] = useState(false);

  const handleUnmute = async () => {
    setBusy(true);
    const success = await unmuteMachine(mac);
    if (success) {
      onUnmute(mac);
    } else {
      Alert.alert("Error", "Failed to unmute device");
    }
    setBusy(false);
  };

  return (
    <View style={styles.deviceCard}>
      <View style={styles.deviceInfo}>
        <View style={styles.deviceHeader}>
          <Ionicons name="notifications-off" size={20} color="#EF4444" />
          <Text style={styles.deviceName}>{device?.name || "Loading..."}</Text>
        </View>
        <Text style={styles.deviceMac}>{mac}</Text>
      </View>
      <TouchableOpacity 
        style={[styles.unmuteButton, busy && styles.buttonDisabled]}
        onPress={handleUnmute}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#2563EA" />
        ) : (
          <Text style={styles.unmuteButtonText}>Unmute</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function MutedDevices() {
  const [mutedMacs, setMutedMacs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMutedDevices = async () => {
    setLoading(true);
    const muted = await getMutedMachines();
    setMutedMacs(muted);
    setLoading(false);
  };

  useEffect(() => {
    loadMutedDevices();
  }, []);

  const handleUnmute = (mac) => {
    setMutedMacs(prev => prev.filter(m => m !== mac));
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EA" />
        <Text style={styles.loadingText}>Loading muted devices...</Text>
      </View>
    );
  }

  if (mutedMacs.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="notifications" size={64} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>No Muted Devices</Text>
        <Text style={styles.emptyText}>
          You haven't muted any device alerts
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {mutedMacs.length} {mutedMacs.length === 1 ? "device" : "devices"} muted
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {mutedMacs.map((mac) => (
          <MutedDeviceItem 
            key={mac} 
            mac={mac} 
            onUnmute={handleUnmute}
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
    fontSize: 14,
    color: "#6B7280"
  },
  unmuteButton: {
    backgroundColor: "#EFF6FF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2563EA",
    minWidth: 80,
    alignItems: "center"
  },
  buttonDisabled: {
    opacity: 0.5
  },
  unmuteButtonText: {
    color: "#2563EA",
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
