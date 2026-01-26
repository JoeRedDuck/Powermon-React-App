import { Picker } from "@react-native-picker/picker";
import Constants from "expo-constants";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function EditMonitor() {
  const [monitor, setMonitor] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState("");
  const [machines, setMachines] = useState([]);
  const [busy, setBusy] = useState(false);
  const { monitorId } = useLocalSearchParams();
  
  const apiBase =
    process.env.EXPO_PUBLIC_API_BASE ||
    Constants.expoConfig?.extra?.apiBase ||
    '';
  const base = `${apiBase.replace(/\/$/, '')}/api/v1`;

  // Fetch monitor details
  useEffect(() => {
    if (!monitorId) return;
    
    const url = `${base}/monitors`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const found = data.find(m => String(m.id) === String(monitorId));
        if (found) {
          setMonitor(found);
          setSelectedMachine(found.name || found.machine_name || "");
        }
      })
      .catch(err => {
        console.error("Failed to fetch monitor", err);
        Alert.alert("Error", "Failed to load monitor details");
      });
  }, [monitorId]);

  // Fetch available machines
  useEffect(() => {
    const url = `${base}/machines`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        // Sort machines by name
        const sorted = data.sort((a, b) => {
          const nameA = a.name || '';
          const nameB = b.name || '';
          return nameA.localeCompare(nameB);
        });
        setMachines(sorted);
      })
      .catch(err => {
        console.error("Failed to fetch machines", err);
        setMachines([]);
      });
  }, []);

  async function handleSave() {
    if (busy) return;
    
    if (!selectedMachine) {
      Alert.alert("Error", "Please select a machine");
      return;
    }

    setBusy(true);
    
    try {
      const url = `${base}/monitors/${monitorId}/reassign?machine_name=${encodeURIComponent(selectedMachine)}`;
      const res = await fetch(url, {
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

      Alert.alert("Success", `Monitor ${monitorId} reassigned to ${selectedMachine}`);
      router.back();
      
    } catch (err) {
      Alert.alert("Error", `Failed to reassign monitor: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    router.back();
  }

  if (!monitor) {
    return (
      <View style={styles.form}>
        <Text style={styles.label}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      
      <View>
        <Text style={styles.label}>Monitor ID:</Text>
        <View style={styles.displayBox}>
          <Text style={styles.displayText}>{monitor.id}</Text>
        </View>
      </View>

      <View>
        <Text style={styles.label}>MAC Address:</Text>
        <View style={styles.displayBox}>
          <Text style={styles.displayText}>{monitor.mac}</Text>
        </View>
      </View>

      <View>
        <Text style={styles.label}>Current Assignment:</Text>
        <View style={styles.displayBox}>
          <Text style={styles.displayText}>
            {monitor.name || monitor.machine_name || "Unassigned"}
          </Text>
        </View>
      </View>

      <View>
        <Text style={styles.label}>Reassign to Machine:</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            style={styles.selector}
            dropdownIconColor="#111827"
            selectedValue={selectedMachine}
            onValueChange={(v) => setSelectedMachine(v)}>
            
            <Picker.Item label="Select a machine..." value="" enabled={false} />
            {machines.map((machine) => (
              <Picker.Item 
                key={machine.name} 
                label={machine.name} 
                value={machine.name} 
              />
            ))}
          </Picker>
        </View>
      </View>

      <View>
        <TouchableOpacity 
          style={[styles.submitButton, busy && styles.disabledButton]} 
          onPress={handleSave}
          disabled={busy}>
          <Text style={styles.submitText}>
            {busy ? "Saving..." : "Save Changes"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={handleCancel}
          disabled={busy}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    justifyContent: "space-evenly",
    paddingHorizontal: 20,
    height: "100%"
  },
  label: {
    fontSize: 20,
  },
  displayBox: {
    height: 45,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 5,
    fontSize: 16,
    marginTop: 10,
    padding: 10,
    justifyContent: "center"
  },
  displayText: {
    fontSize: 16,
    color: "#6B7280"
  },
  pickerWrapper: {
    height: 45,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 5,
    paddingHorizontal: 6,
    marginTop: 10,
    justifyContent: "center"
  },
  selector: {
    color: "#111827"
  },
  submitButton: {
    backgroundColor: "#2563EA",
    height: 45,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center"
  },
  disabledButton: {
    backgroundColor: "#93C5FD",
    opacity: 0.6
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 10,
    borderColor: "#E5E7EB",
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginTop: 10
  },
  cancelText: {
    fontSize: 16
  }
});
