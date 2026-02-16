import PlatformPicker from "../components/PlatformPicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { getApiUrl } from "../utils/apiConfig";

export default function AddDevice () {
  const [device,setDevice] = useState(null)
  const [mac, setMac] = useState("");
  const [id, setID] = useState("")
  const [originalId, setOriginalId] = useState("");
  const [name, setName] = useState("");
  // const [ip, setIp] = useState("");
  const [location, setLocation] = useState("");
  const [machineType, setMachineType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null)
  const [isEdit, setIsEdit] = useState(false);
  const { mac: macParam } = useLocalSearchParams();  // Actually receives machine name for editing
  const [availableMonitors, setAvailableMonitors] = useState([])
  const [apiBase, setApiBase] = useState('')
  
  useEffect(() => {
    getApiUrl().then(setApiBase).catch(err => {
      console.error('Failed to load API URL:', err);
      setApiBase('');
    });
  }, []);
  
  const base = apiBase ? `${apiBase}/api/v1` : ''
  
  function clearForm() {
  setMac("");
  setName("");
  setID("")
  // setIp("");
  setLocation("");
  setMachineType("");
  }

  const fetchDevice = async (machineNameToGet) => {
    if (!base) {
      console.warn('API base URL not loaded yet');
      return;
    }
    const url = `${base}/machines/${encodeURIComponent(machineNameToGet)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDevice(data);
    } catch (err) {
      console.error("fetchDevice failed", err);
      setDevice(null);
    }
  };

  // Fetch available monitors for assignment
  useEffect(() => {
    if (!isEdit || mac || !base) return; // Only fetch if editing and no monitor assigned
    
    const url = `${base}/monitors`;
    fetch(url)
      .then(r => r.json())
      .then(monitors => {
        // Sort monitors by ID
        const sorted = monitors.sort((a, b) => a.id - b.id);
        setAvailableMonitors(sorted);
      })
      .catch(() => setAvailableMonitors([]));
  }, [isEdit, mac, base]);

  
  useEffect(() => {
    if (typeof macParam === "string" && macParam.length && base) {
      // macParam is actually the machine name when editing
      // Don't set mac state yet - wait for fetchDevice to populate it
      setIsEdit(true)
      fetchDevice(macParam)
    }
  }, [macParam, base])

  useEffect(() => {
    if (!isEdit || !device) return;
    setMac(device.mac || '');
    setName(device.name || '');
    // Handle null/undefined monitor IDs for devices without monitors
    const deviceId = (device.id !== null && device.id !== undefined) ? String(device.id) : '';
    setID(deviceId);
    setOriginalId(deviceId);
    // setIp(device.ip || '');
    setLocation(device.location || '');
    setMachineType(device.machine_type || '');
  }, [isEdit, device]);

  useEffect(() => {
    if (isEdit) return;
    clearForm()
  }, [isEdit]);

  const submitButtonText = isEdit ? "Save Changes" : "Add Device"

  async function handleSubmit() {
    if (busy) return
    setBusy(true)
    setError(null)

    try {
      // If editing a machine WITHOUT a monitor, only allow monitor assignment
      if (isEdit && !mac) {
        if (!id) {
          Alert.alert("Info", "Please select a monitor to assign to this machine");
          setBusy(false);
          return;
        }
        
        // Only call reassign endpoint - no device update needed
        const reassignRes = await fetch(`${base}/monitors/${id}/reassign?machine_name=${encodeURIComponent(name)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        
        if (!reassignRes.ok) {
          let msg;
          try {
            const body = await reassignRes.json();
            msg = body?.detail?.reason || body?.detail || body?.message || body?.error;
          } catch {
            msg = await reassignRes.text();
          }
          const errorMsg = typeof msg === 'string' ? msg : JSON.stringify(msg);
          Alert.alert("Error", `Monitor assignment failed: ${errorMsg}`);
          throw new Error(errorMsg || `Reassignment failed (${reassignRes.status})`);
        }
        
        Alert.alert("Success", `Monitor ${id} assigned to ${name}`);
        router.back();
        return;
      }

      // For edit: exclude id from payload, for new device: include it
      const payload = isEdit ? {
        name: name,
        mac: mac,
        machine_type: machineType,
        location: location
      } : {
        name: name,
        id: parseInt(id, 10) || 0,
        mac: mac,
        machine_type: machineType,
        location: location
      };

      const api_call = isEdit ? `${base}/devices/${mac}` : `${base}/devices`;
      const method = isEdit ? "PUT" : "POST";

      console.log(`Submitting ${method} to ${api_call}`, { payload, mac });

      const res = await fetch(api_call, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Try JSON first, fall back to text
        let msg;
        try {
          const body = await res.json();
          // Prefer a clear message from your API shape
          msg = body?.detail?.reason || body?.detail || body?.message || body?.error;
        } catch {
          msg = await res.text();
        }
        // Ensure msg is a string before passing to Alert
        const errorMsg = typeof msg === 'string' ? msg : JSON.stringify(msg);
        Alert.alert("Error", errorMsg);
        throw new Error(errorMsg || `Request failed (${res.status})`);
      }

      const data = await res.json();
      
      // If editing and monitor ID changed to a new value (adding or swapping), call reassign endpoint
      // Don't call if removing monitor (going from value to empty)
      if (isEdit && id !== originalId && id !== "") {
        const reassignRes = await fetch(`${base}/monitors/${id}/reassign?machine_name=${encodeURIComponent(name)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        
        if (!reassignRes.ok) {
          let msg;
          try {
            const body = await reassignRes.json();
            msg = body?.detail?.reason || body?.detail || body?.message || body?.error;
          } catch {
            msg = await reassignRes.text();
          }
          const errorMsg = typeof msg === 'string' ? msg : JSON.stringify(msg);
          Alert.alert("Error", `Device updated but reassignment failed: ${errorMsg}`);
          throw new Error(errorMsg || `Reassignment failed (${reassignRes.status})`);
        }
      }
      
      // Navigate back to manage devices after successful edit
      if (isEdit) {
        router.back();
      }
      
      setMachineType("");
    } catch (err) {
      setError(`${String(err).slice(0, 300)}`);
    } finally {
      clearForm()
      setBusy(false);
      
    }
  }

  return (

    <View style={styles.form}>

      
      <View>
        <Text style={styles.label}>Device Name:</Text>
        <TextInput 
          style={styles.input}
          placeholder="Condenser 1"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={setName}>
        </TextInput>
      </View>

    <View>
        <Text style={styles.label}>Machine Type:</Text>
        <TextInput 
          style={styles.input}
          placeholder="Pump"
          placeholderTextColor="#9CA3AF"
          value={machineType}
          onChangeText={setMachineType}>
        </TextInput>
      </View>

      <View>
        <Text style={styles.label}>Location:</Text>
        <TextInput 
          style={styles.input}
          placeholder="Production Line"
          placeholderTextColor="#9CA3AF"
          value={location}
          onChangeText={setLocation}>
        </TextInput>
      </View>


      {/* Show monitor selector if editing and no monitor assigned, otherwise show Monitor ID field */}
      {isEdit && !mac ? (
        <View>
          <Text style={styles.label}>Select Monitor:</Text>
          <PlatformPicker
            items={[{ label: 'No Monitor (Leave Unassigned)', value: '' }, ...availableMonitors.map(m => ({ label: m.machine_name ? `Monitor ${m.id} (on ${m.machine_name})` : `Monitor ${m.id}`, value: String(m.id) }))]}
            selectedValue={id}
            onValueChange={(v) => setID(v)}
            style={styles.pickerWrapper}
            selectorStyle={styles.selector}
          />
        </View>
      ) : (
        <View>
          <Text style={styles.label}>Monitor ID:</Text>
          <TextInput 
            style={styles.input}
            placeholder="1"
            placeholderTextColor="#9CA3AF"
            value={id}
            onChangeText={setID}
            keyboardType="numeric">
          </TextInput>
        </View>
      )}

      <View>
        <Text style={styles.label}>Mac Address:</Text>
        <TextInput 
          style={styles.input}
          placeholder="C8:C9:A3:1A:F2:DB"
          placeholderTextColor="#9CA3AF"
          value={mac}
          onChangeText={setMac}
          editable={!isEdit}
          selectTextOnFocus={!isEdit}>
        </TextInput>
      </View>
      
      {/* <View>
        <Text style={styles.label}>IP Address:</Text>
        <TextInput 
          style={styles.input} 
          placeholder="192.168.9.125"
          placeholderTextColor="#9CA3AF"
          value={ip}
          onChangeText={setIp}>
        </TextInput>
      </View> */}
      <View>
        <TouchableOpacity style={styles.submitButton} onPress={() => handleSubmit()}>
          <Text style={styles.submitText}>{submitButtonText}</Text>
        </TouchableOpacity>

        {isEdit && (
          <TouchableOpacity style={styles.cancelButton} onPress={() => {router.back()}}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>)}
      </View>

    </View>
  )
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
    justifyContent: "space-evenly",
    paddingHorizontal: 20,
    height: "100%"
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
})

