import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { clearApiUrl, getApiUrl, getDefaultApiUrl, setApiUrl } from "../utils/apiConfig";

export default function ApiSettings() {
  const [apiUrl, setApiUrlState] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultUrl, setDefaultUrl] = useState("");

  useEffect(() => {
    loadCurrentUrl();
  }, []);

  const loadCurrentUrl = async () => {
    setLoading(true);
    try {
      const currentUrl = await getApiUrl();
      const defUrl = getDefaultApiUrl();
      setApiUrlState(currentUrl || defUrl);
      setDefaultUrl(defUrl);
    } catch (error) {
      console.error("Failed to load API URL:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiUrl.trim()) {
      Alert.alert("Error", "Please enter a valid API URL");
      return;
    }

    // Basic URL validation
    if (!apiUrl.startsWith("http://") && !apiUrl.startsWith("https://")) {
      Alert.alert("Error", "URL must start with http:// or https://");
      return;
    }

    setSaving(true);
    try {
      const result = await setApiUrl(apiUrl);
      if (result.success) {
        Alert.alert(
          "Success",
          "API URL has been updated. Please restart the app for changes to take full effect.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      } else {
        Alert.alert("Error", "Failed to save API URL. Please try again.");
      }
    } catch (error) {
      console.error("Failed to save API URL:", error);
      Alert.alert("Error", "Failed to save API URL. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    Alert.alert(
      "Reset to Default",
      "Are you sure you want to reset to the default API URL?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              await clearApiUrl();
              setApiUrlState(defaultUrl);
              Alert.alert("Success", "API URL has been reset to default.");
            } catch (error) {
              Alert.alert("Error", "Failed to reset API URL.");
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <View>
        <Text style={styles.label}>API Base URL:</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrlState}
          placeholder="https://api.example.com"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!saving}
        />
      </View>

      <View>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Save</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleResetToDefault}
          disabled={saving}
        >
          <Text style={styles.cancelText}>Reset to Default</Text>
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
    color: "#111827"
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
});