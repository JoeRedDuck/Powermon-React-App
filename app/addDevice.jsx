import { Picker } from "@react-native-picker/picker";
import Constants from "expo-constants";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function AddDevice () {
  const [device,setDevice] = useState(null)
  const [mac, setMac] = useState("");
  const [id, setID] = useState("")
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [location, setLocation] = useState("");
  const [machineType, setMachineType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null)
  const [isEdit, setIsEdit] = useState(false);
  const { mac: macParam } = useLocalSearchParams();
  const [machineTypes, setMachineTypes] = useState([])

  const apiBase =
      process.env.EXPO_PUBLIC_API_BASE ||
      Constants.expoConfig?.extra?.apiBase ||
      '';
    const base = `${apiBase.replace(/\/$/, '')}/api/v1`
  
  function clearForm() {
  setMac("");
  setName("");
  setID("")
  setIp("");
  setLocation("");
  setMachineType("");
  }

  const fetchDevice = async (macToGet) => {
    const url = `${base}/devices/${macToGet}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDevice(data[0] || data);
    } catch (err) {
      console.error("fetchDevice failed", err);
      setDevice(null);
    }
  };

  useEffect(() => {
      const url = `${base}/machine_types`
      fetch(url)
        .then(r => r.json())
        .then(setMachineTypes)   // populate dropdown
        .catch(() => setMachineTypes([])); // fallback empty
    }, []);

  
  useEffect(() => {
    if (typeof macParam === "string" && macParam.length) {
      setMac(macParam)
      setIsEdit(true)
      fetchDevice(macParam)
    }
  }, [macParam])

  useEffect(() => {
    if (!isEdit || !device) return;
    setMac(device.mac || '');
    setName(device.name || '');
    setID(String(device.id || ''));
    setIp(device.ip || '');
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

    const payload = {
      name: name,
      id: parseInt(id, 10) || 0,
      mac: mac,
      machine_type: machineType,
      location: location,
      ip: ip
    }

    const api_call = isEdit ? `${base}/devices/${mac}` : `${base}/devices`;
    const method = isEdit ? "PUT" : "POST";

    try {
      
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
      <View>
        <Text style={styles.label}
        >Mac Address:</Text>
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
      <View>
        <Text style={styles.label}>Machine Type:</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            style={styles.selector}
            dropdownIconColor="#111827"
            selectedValue = {machineType}
            onValueChange={(v) => setMachineType(v)}>

            <Picker.Item label="Select..." value="" enabled={false} />
            {machineTypes.map((type) => ( <Picker.Item key={type} label={type} value={type} /> ))}
            
          </Picker>
        </View>

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
      <View>
        <Text style={styles.label}>IP Address:</Text>
        <TextInput 
          style={styles.input} 
          placeholder="192.168.9.125"
          placeholderTextColor="#9CA3AF"
          value={ip}
          onChangeText={setIp}>
        </TextInput>
      </View>
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
  }
})

