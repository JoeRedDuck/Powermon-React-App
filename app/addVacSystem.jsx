import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { getApiUrl } from "../utils/apiConfig";

export default function AddVacSystem() {
  const { name: nameParam } = useLocalSearchParams();
  const isEdit = typeof nameParam === "string" && nameParam.length > 0;

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [apiBase, setApiBase] = useState('');
  const [originalName, setOriginalName] = useState(isEdit ? nameParam : '');

  useEffect(() => {
    getApiUrl().then(setApiBase).catch(err => {
      console.error('Failed to load API URL:', err);
      setApiBase('');
    });
  }, []);

  const base = apiBase ? `${apiBase}/api/v1` : '';

  // Load existing system data in edit mode
  useEffect(() => {
    if (!isEdit || !base) return;

    fetch(`${base}/vacuum/systems`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const found = data.find(s => s.name === nameParam);
        if (found) {
          setName(found.name);
          setLocation(found.location || '');
          setOriginalName(found.name);
        }
      })
      .catch(err => console.error('Failed to load vacuum system:', err));
  }, [isEdit, nameParam, base]);

  async function handleSubmit() {
    if (busy) return;
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a system name");
      return;
    }
    setBusy(true);
    try {
      if (isEdit) {
        const res = await fetch(`${base}/vacuum/systems/${encodeURIComponent(originalName)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), location: location.trim() || null })
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
        Alert.alert("Success", `Vacuum system updated`);
        router.back();
      } else {
        const res = await fetch(`${base}/vacuum/systems`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), location: location.trim() || null })
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
        Alert.alert("Success", `Vacuum system "${name.trim()}" created`);
        router.back();
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <View>
        <Text style={styles.label}>System Name:</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Freeze Dryer 1"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={setName}
        />
      </View>

      <View>
        <Text style={styles.label}>Location (Optional):</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Lab A"
          placeholderTextColor="#9CA3AF"
          value={location}
          onChangeText={setLocation}
        />
      </View>

      <View>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={busy}>
          <Text style={styles.submitText}>
            {busy ? "Processing..." : isEdit ? "Save Changes" : "Add System"}
          </Text>
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
  form: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    gap: 20,
  },
  label: {
    fontSize: 20,
  },
  input: {
    height: 45,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 5,
    fontSize: 16,
    marginTop: 10,
    padding: 10,
    color: "#111827",
  },
  submitButton: {
    backgroundColor: "#2563EA",
    height: 45,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 10,
    borderColor: "#E5E7EB",
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginTop: 10,
  },
  cancelText: {
    fontSize: 16,
  },
});
