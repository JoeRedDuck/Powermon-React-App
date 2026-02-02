import { Picker } from "@react-native-picker/picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { getApiUrl } from "../utils/apiConfig";

export default function AddMonitor() {
  const [monitor, setMonitor] = useState(null);
  const [monitorId, setMonitorId] = useState("");
  const [mac, setMac] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [machines, setMachines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const { id: idParam } = useLocalSearchParams();
  const [apiBase, setApiBase] = useState('')
  
  useEffect(() => {
    getApiUrl().then(setApiBase).catch(err => {
      console.error('Failed to load API URL:', err);
      setApiBase('');
    });
  }, []);
  
  const base = apiBase ? `${apiBase}/api/v1` : '';

  function clearForm() {
    setMonitorId("");
    setMac("");
    setSelectedMachine("");
  }

  const fetchMonitor = async (idToGet) => {
    if (!base) {
      console.warn('API base URL not loaded yet');
      return;
    }
    const url = `${base}/monitors`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const found = data.find(m => String(m.id) === String(idToGet));
      setMonitor(found || null);
    } catch (err) {
      console.error("fetchMonitor failed", err);
      setMonitor(null);
    }
  };

  // Fetch available machines
  useEffect(() => {
    if (!base) return;
    
    const url = `${base}/machines`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const sorted = data.sort((a, b) => {
          const nameA = a.name || '';
          const nameB = b.name || '';
          return nameA.localeCompare(nameB);
        });
        setMachines(sorted);
      })
      .catch(() => setMachines([]));
  }, [base]);

  useEffect(() => {
    if (typeof idParam === "string" && idParam.length && base) {
      setIsEdit(true);
      fetchMonitor(idParam);
    }
  }, [idParam, base]);

  useEffect(() => {
    if (!isEdit || !monitor) return;
    setMonitorId(String(monitor.id || ''));
    setMac(monitor.mac || '');
    setSelectedMachine(monitor.name || monitor.machine_name || '');
  }, [isEdit, monitor]);

  useEffect(() => {
    if (isEdit) return;
    clearForm();
  }, [isEdit]);

  const submitButtonText = isEdit ? "Save Changes" : "Add Monitor";

  async function handleSubmit() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      if (isEdit) {
        // For editing, validate required fields
        if (!monitorId || !mac) {
          Alert.alert("Error", "Please fill in Monitor ID and MAC Address");
          setBusy(false);
          return;
        }

        // Update monitor ID and MAC if changed
        const payload = {
          id: parseInt(monitorId, 10),
          mac: mac
        };

        const updateRes = await fetch(`${base}/monitors/${monitor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!updateRes.ok) {
          let msg;
          try {
            const body = await updateRes.json();
            msg = body?.detail?.reason || body?.detail || body?.message || body?.error;
          } catch {
            msg = await updateRes.text();
          }
          const errorMsg = typeof msg === 'string' ? msg : JSON.stringify(msg);
          Alert.alert("Error", `Update failed: ${errorMsg}`);
          throw new Error(errorMsg || `Update failed (${updateRes.status})`);
        }

        // If machine assignment changed, call reassign endpoint
        const originalMachine = monitor.name || monitor.machine_name || '';
        if (selectedMachine !== originalMachine) {
          if (selectedMachine) {
            // Reassign to a machine
            const reassignRes = await fetch(
              `${base}/monitors/${parseInt(monitorId, 10)}/reassign?machine_name=${encodeURIComponent(selectedMachine)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" }
              }
            );

            if (!reassignRes.ok) {
              let msg;
              try {
                const body = await reassignRes.json();
                msg = body?.detail?.reason || body?.detail || body?.message || body?.error;
              } catch {
                msg = await reassignRes.text();
              }
              const errorMsg = typeof msg === 'string' ? msg : JSON.stringify(msg);
              Alert.alert("Warning", `Monitor updated but reassignment failed: ${errorMsg}`);
            }
          } else if (originalMachine) {
            // Unassign from machine
            const unassignRes = await fetch(`${base}/monitors/${parseInt(monitorId, 10)}/unassign`, {
              method: "POST",
              headers: { "Content-Type": "application/json" }
            });

            if (!unassignRes.ok) {
              let msg;
              try {
                const body = await unassignRes.json();
                msg = body?.detail?.reason || body?.detail || body?.message || body?.error;
              } catch {
                msg = await unassignRes.text();
              }
              const errorMsg = typeof msg === 'string' ? msg : JSON.stringify(msg);
              Alert.alert("Warning", `Monitor updated but unassignment failed: ${errorMsg}`);
            }
          }
        }

        Alert.alert("Success", "Monitor updated successfully");
        router.back();
        return;
      }

      // For adding new monitor
      if (!monitorId || !mac) {
        Alert.alert("Error", "Please fill in Monitor ID and MAC Address");
        setBusy(false);
        return;
      }

      const payload = {
        id: parseInt(monitorId, 10),
        mac: mac,
        machine_name: selectedMachine || null
      };

      const res = await fetch(`${base}/monitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let msg;
        try {
          const body = await res.json();
          msg = body?.detail?.reason || body?.detail || body?.message || body?.error;
        } catch {
          msg = await res.text();
        }
        const errorMsg = typeof msg === 'string' ? msg : JSON.stringify(msg);
        Alert.alert("Error", errorMsg);
        throw new Error(errorMsg || `Request failed (${res.status})`);
      }

      Alert.alert("Success", "Monitor added successfully");
      clearForm();
      
    } catch (err) {
      setError(`${String(err).slice(0, 300)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      
      <View>
        <Text style={styles.label}>Monitor ID:</Text>
        <TextInput 
          style={styles.input}
          placeholder="1"
          placeholderTextColor="#9CA3AF"
          value={monitorId}
          onChangeText={setMonitorId}
          keyboardType="numeric">
        </TextInput>
      </View>

      <View>
        <Text style={styles.label}>MAC Address:</Text>
        <TextInput 
          style={styles.input}
          placeholder="C8:C9:A3:1A:F2:DB"
          placeholderTextColor="#9CA3AF"
          value={mac}
          onChangeText={setMac}>
        </TextInput>
      </View>

      <View>
        <Text style={styles.label}>Assign to Machine (Optional):</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            style={styles.selector}
            dropdownIconColor="#111827"
            selectedValue={selectedMachine}
            onValueChange={(v) => setSelectedMachine(v)}>
            
            <Picker.Item label="No Machine (Leave Unassigned)" value="" />
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
          style={styles.submitButton} 
          onPress={handleSubmit}
          disabled={busy}>
          <Text style={styles.submitText}>{busy ? "Processing..." : submitButtonText}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={() => router.back()}
          disabled={busy}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 45,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 5,
    fontSize: 16,
    marginTop: 10,
    padding: 10,
    color: "#111827"
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
  form: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    gap: 20,
  },
  label: {
    fontSize: 20,
  },
  submitButton: {
    backgroundColor: "#2563EA",
    height: 45,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center"
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
  },
  selector: {
    color: "#111827"
  }
});
