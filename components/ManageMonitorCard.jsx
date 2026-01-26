import Constants from "expo-constants";
import { useState } from "react";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ManageMonitorCard({monitor, onDelete}) {
  const [busy, setBusy] = useState(false);

  const apiBase =
    process.env.EXPO_PUBLIC_API_BASE ||
    Constants.expoConfig?.extra?.apiBase ||
    '';
  const base = `${apiBase.replace(/\/$/, '')}/api/v1`;

  // Handle remove/delete
  async function handleRemove() {
    if (busy) return;

    // Show confirmation with options
    const alertOptions = Platform.select({
      web: { text: "Unassign", onPress: () => unassignMonitor() },
      default: [
        { text: "Cancel", style: "cancel" },
        { text: "Unassign Only", onPress: () => unassignMonitor() },
        { text: "Delete Permanently", onPress: () => deleteMonitor(), style: "destructive" }
      ]
    });

    if (Platform.OS === 'web') {
      // Web doesn't support multiple buttons well
      const confirmed = confirm(
        `Do you want to unassign Monitor ${monitor.id}?\n\n` +
        `This will remove the monitor from ${monitor.name || 'the machine'} but keep it in the system.`
      );
      if (confirmed) await unassignMonitor();
    } else {
      Alert.alert(
        "Remove Monitor",
        `Monitor ${monitor.id} is assigned to ${monitor.name || 'a machine'}.\n\nWhat would you like to do?`,
        alertOptions
      );
    }
  }

  // Unassign monitor from machine
  async function unassignMonitor() {
    setBusy(true);
    try {
      const res = await fetch(`${base}/monitors/${monitor.id}/unassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!res.ok) {
        let errorMsg;
        try {
          const body = await res.json();
          errorMsg = body?.detail?.reason || body?.detail || body?.message || body?.error;
        } catch {
          errorMsg = await res.text();
        }
        throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
      }

      Alert.alert("Success", `Monitor ${monitor.id} has been unassigned`);
      
      // Call parent callback to refresh list
      if (onDelete) onDelete(monitor.id);
      
    } catch (err) {
      Alert.alert("Error", `Failed to unassign monitor: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  // Delete monitor permanently
  async function deleteMonitor() {
    setBusy(true);
    try {
      const res = await fetch(`${base}/monitors/${monitor.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });

      if (!res.ok) {
        let errorMsg;
        try {
          const body = await res.json();
          errorMsg = body?.detail?.reason || body?.detail || body?.message || body?.error;
        } catch {
          errorMsg = await res.text();
        }
        throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
      }

      Alert.alert("Success", `Monitor ${monitor.id} has been permanently deleted`);
      
      // Call parent callback to refresh list
      if (onDelete) onDelete(monitor.id);
      
    } catch (err) {
      Alert.alert("Error", `Failed to delete monitor: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
     <View style={styles.container}>
      <View style={styles.card}>

        <View>
          <Text style={styles.label}>Monitor ID</Text>
          <Text style={styles.attribute}>{monitor.id}</Text>
        </View>

        <View style={styles.line}></View>

        <View>
          <Text style={styles.label}>Mac Address</Text>
          <Text style={styles.attribute}>{monitor.mac}</Text>
        </View>

        <View style={styles.line}></View>

        <View>
          <Text style={styles.label}>Assigned Machine</Text>
          <Text style={styles.attribute}>{monitor.name || monitor.machine_name || "Unassigned"}</Text>
        </View>

        <View style={styles.line}></View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.removeButton, busy && styles.disabledButton]} 
            onPress={handleRemove}
            disabled={busy}>
            <Text style={styles.removeText}>{busy ? "Processing..." : "Remove"}</Text>
          </TouchableOpacity>
        </View>


      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    alignItems: "center"
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E6E9EC",
    borderWidth: 1,
    borderRadius: 10,
    width: "100%",
    flexDirection: "column",
    paddingVertical: 10,
    justifyContent: "space-around"
  },
  label: {
    color: "#6B7280",
    fontSize: 13,
    paddingHorizontal: 16
  },
  attribute: {
    fontSize: 19,
    paddingHorizontal: 16
  },
  line: {
    height: 0,
    borderColor: "#E6E9EC",
    borderWidth: 0.5
  },
  edit: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2563EA",
    paddingHorizontal: 30,
    marginTop: 10
  },
  disabledText: {
    color: "#9CA3AF",
    opacity: 0.5
  },
  removeButton: {
    backgroundColor: "#EF4444",
    borderRadius: 7,
    height: 40,
    width: 80,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3
  },
  disabledButton: {
    backgroundColor: "#F87171",
    opacity: 0.5
  },
  removeText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "bold"
  },
  buttonContainer: {
    flexDirection: "row"
  }
});