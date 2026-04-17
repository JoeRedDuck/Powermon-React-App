import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getApiUrl } from "../utils/apiConfig";

export default function ManageVacSystemCard({system, onDelete}) {
  const [busy, setBusy] = useState(false);

  function handleEdit() {
    if (busy) return;
    router.push({ pathname: "/addVacSystem", params: { name: system.name } });
  }

  async function handleRemove() {
    if (busy) return;

    const monitorWarning = system.monitor_count > 0
      ? ` It has ${system.monitor_count} monitor(s) assigned — they will be unlinked.`
      : "";
    const message = `This will permanently delete vacuum system "${system.name}".${monitorWarning}`;

    if (Platform.OS === 'web') {
      const confirmed = confirm(`Delete Vacuum System?\n\n${message}`);
      if (confirmed) await deleteSystem();
    } else {
      Alert.alert(
        "Delete Vacuum System",
        message,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", onPress: () => deleteSystem(), style: "destructive" }
        ]
      );
    }
  }

  async function deleteSystem() {
    setBusy(true);
    try {
      const apiBase = await getApiUrl();
      const base = `${apiBase.replace(/\/$/, '')}/api/v1`;
      const res = await fetch(`${base}/vacuum/systems/${encodeURIComponent(system.name)}`, {
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

      Alert.alert("Success", `Vacuum system "${system.name}" has been deleted`);
      if (onDelete) onDelete(system.name);

    } catch (err) {
      Alert.alert("Error", `Failed to delete system: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
     <View style={styles.container}>
      <View style={styles.card}>

        <View>
          <Text style={styles.label}>System Name</Text>
          <Text style={styles.attribute}>{system.name}</Text>
        </View>

        <View style={styles.line}></View>

        <View>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.attribute}>{system.location || "—"}</Text>
        </View>

        <View style={styles.line}></View>

        <View>
          <Text style={styles.label}>Assigned Monitors</Text>
          <Text style={styles.attribute}>{system.monitor_count ?? 0}</Text>
        </View>

        <View style={styles.line}></View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={handleEdit} disabled={busy}>
            <Text style={[styles.edit, busy && styles.disabledText]}>Edit</Text>
          </TouchableOpacity>

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
