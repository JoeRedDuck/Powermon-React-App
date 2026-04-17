import PlatformPicker from "../components/PlatformPicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { getApiUrl } from "../utils/apiConfig";

export default function AddVacMonitor() {
  const [monitor, setMonitor] = useState(null);
  const [monitorId, setMonitorId] = useState("");
  const [mac, setMac] = useState("");
  const [selectedSystem, setSelectedSystem] = useState("");
  const [systems, setSystems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const { id: idParam, mac: macParam } = useLocalSearchParams();
  const [apiBase, setApiBase] = useState('');

  // New system form
  const [showNewSystem, setShowNewSystem] = useState(false);
  const [newSystemName, setNewSystemName] = useState('');
  const [newSystemLocation, setNewSystemLocation] = useState('');
  const [creatingSystem, setCreatingSystem] = useState(false);

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
    setSelectedSystem("");
  }

  const fetchMonitor = async (idToGet) => {
    if (!base) return;
    const url = `${base}/vacuum/monitors`;
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

  function fetchSystems() {
    if (!base) return;
    fetch(`${base}/vacuum/systems`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const sorted = data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setSystems(sorted);
        } else {
          setSystems([]);
        }
      })
      .catch(() => setSystems([]));
  }

  useEffect(() => {
    fetchSystems();
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
    setSelectedSystem(monitor.name || monitor.system_name || '');
  }, [isEdit, monitor]);

  useEffect(() => {
    if (isEdit) return;
    clearForm();
  }, [isEdit]);

  useEffect(() => {
    if (macParam && !idParam) {
      setMac(String(macParam));
    }
  }, [macParam, idParam]);

  async function handleCreateSystem() {
    if (creatingSystem) return;
    if (!newSystemName.trim()) {
      Alert.alert("Error", "Please enter a system name");
      return;
    }
    setCreatingSystem(true);
    try {
      const res = await fetch(`${base}/vacuum/systems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSystemName.trim(),
          location: newSystemLocation.trim() || null
        })
      });
      if (!res.ok) {
        let msg;
        try {
          const body = await res.json();
          msg = body?.detail || body?.message || body?.error;
        } catch {
          msg = await res.text();
        }
        Alert.alert("Error", typeof msg === 'string' ? msg : JSON.stringify(msg));
        return;
      }
      const createdName = newSystemName.trim();
      setNewSystemName('');
      setNewSystemLocation('');
      setShowNewSystem(false);
      fetchSystems();
      setSelectedSystem(createdName);
      Alert.alert("Success", `System "${createdName}" created`);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setCreatingSystem(false);
    }
  }

  const submitButtonText = isEdit ? "Save Changes" : "Add Vacuum Monitor";

  async function handleSubmit() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      if (isEdit) {
        const originalSystem = monitor.name || monitor.system_name || '';

        if (selectedSystem !== originalSystem) {
          if (selectedSystem) {
            const reassignRes = await fetch(
              `${base}/vacuum/monitors/${monitor.id}/reassign?system_name=${encodeURIComponent(selectedSystem)}`,
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
              Alert.alert("Error", `Reassignment failed: ${errorMsg}`);
              throw new Error(errorMsg || `Reassignment failed (${reassignRes.status})`);
            }
          } else if (originalSystem) {
            const unassignRes = await fetch(`${base}/vacuum/monitors/${monitor.id}/unassign`, {
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
              Alert.alert("Error", `Unassignment failed: ${errorMsg}`);
              throw new Error(errorMsg || `Unassignment failed (${unassignRes.status})`);
            }
          }
        }

        Alert.alert("Success", "Vacuum monitor assignment updated");
        router.back();
        return;
      }

      if (!monitorId || !mac) {
        Alert.alert("Error", "Please fill in Monitor ID and MAC Address");
        setBusy(false);
        return;
      }

      const payload = {
        id: parseInt(monitorId, 10),
        mac: mac,
        system_name: selectedSystem || null
      };

      const res = await fetch(`${base}/vacuum/monitors`, {
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

      Alert.alert("Success", "Vacuum monitor added successfully");
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
          style={[styles.input, isEdit && styles.readOnlyInput]}
          placeholder="1"
          placeholderTextColor="#9CA3AF"
          value={monitorId}
          onChangeText={setMonitorId}
          keyboardType="numeric"
          editable={!isEdit}>
        </TextInput>
        {isEdit && <Text style={styles.hint}>Monitor ID cannot be changed</Text>}
      </View>

      <View>
        <Text style={styles.label}>MAC Address:</Text>
        <TextInput
          style={[styles.input, isEdit && styles.readOnlyInput]}
          placeholder="C8:C9:A3:1A:F2:DB"
          placeholderTextColor="#9CA3AF"
          value={mac}
          onChangeText={setMac}
          editable={!isEdit}>
        </TextInput>
        {isEdit && <Text style={styles.hint}>MAC Address cannot be changed</Text>}
      </View>

      <View>
        <Text style={styles.label}>Assign to Vacuum System:</Text>
        <PlatformPicker
          items={[{ label: 'No System (Leave Unassigned)', value: '' }, ...systems.map(s => ({ label: s.name, value: s.name }))]}
          selectedValue={selectedSystem}
          onValueChange={(v) => setSelectedSystem(v)}
          style={styles.pickerWrapper}
          selectorStyle={styles.selector}
        />

        <TouchableOpacity
          style={styles.newSystemToggle}
          onPress={() => setShowNewSystem(!showNewSystem)}>
          <Text style={styles.newSystemToggleText}>
            {showNewSystem ? "Cancel" : "+ Create New System"}
          </Text>
        </TouchableOpacity>

        {showNewSystem && (
          <View style={styles.newSystemForm}>
            <TextInput
              style={styles.input}
              placeholder="System name (e.g. Freeze Dryer 1)"
              placeholderTextColor="#9CA3AF"
              value={newSystemName}
              onChangeText={setNewSystemName}
            />
            <TextInput
              style={styles.input}
              placeholder="Location (optional)"
              placeholderTextColor="#9CA3AF"
              value={newSystemLocation}
              onChangeText={setNewSystemLocation}
            />
            <TouchableOpacity
              style={styles.createSystemButton}
              onPress={handleCreateSystem}
              disabled={creatingSystem}>
              <Text style={styles.createSystemText}>
                {creatingSystem ? "Creating..." : "Create System"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  readOnlyInput: {
    backgroundColor: "#F3F4F6",
    color: "#6B7280"
  },
  hint: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
    marginTop: 2,
    marginBottom: 5
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
  },
  newSystemToggle: {
    marginTop: 8,
  },
  newSystemToggleText: {
    fontSize: 15,
    color: "#2563EA",
    fontWeight: "600",
  },
  newSystemForm: {
    marginTop: 8,
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  createSystemButton: {
    backgroundColor: "#16A34A",
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  createSystemText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 15,
  },
});
