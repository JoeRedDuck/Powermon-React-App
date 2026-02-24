import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getApiUrl, setApiUrl } from "../utils/apiConfig";
import { login, register } from "../utils/authService";

export default function LoginScreen({ onLoginSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // API URL setting
  const [showApiUrl, setShowApiUrl] = useState(false);
  const [apiUrl, setApiUrlLocal] = useState("");
  const [apiUrlLoaded, setApiUrlLoaded] = useState(false);

  const loadApiUrl = async () => {
    if (!apiUrlLoaded) {
      const url = await getApiUrl();
      setApiUrlLocal(url);
      setApiUrlLoaded(true);
    }
    setShowApiUrl(!showApiUrl);
  };

  const saveApiUrl = async () => {
    if (!apiUrl.trim()) {
      Alert.alert("Error", "Please enter a valid API URL");
      return;
    }
    if (!apiUrl.startsWith("http://") && !apiUrl.startsWith("https://")) {
      Alert.alert("Error", "URL must start with http:// or https://");
      return;
    }
    const result = await setApiUrl(apiUrl);
    if (result.success) {
      Alert.alert("Saved", "API URL updated.");
      setShowApiUrl(false);
    } else {
      Alert.alert("Error", "Failed to save API URL.");
    }
  };

  const handleLogin = async () => {
    setError("");
    const currentApiUrl = await getApiUrl();
    if (!currentApiUrl) {
      setError("No server URL configured. Tap 'Server Settings' below to set one.");
      return;
    }
    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password.");
      return;
    }

    setLoading(true);
    try {
      await login(username.trim(), password);
      onLoginSuccess();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError("");
    const currentApiUrl = await getApiUrl();
    if (!currentApiUrl) {
      setError("No server URL configured. Tap 'Server Settings' below to set one.");
      return;
    }
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      // Auto-login after successful registration
      await login(username.trim(), password);
      onLoginSuccess();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.appName}>Powermon</Text>
          <Text style={styles.subtitle}>
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, mode === "login" && styles.activeTab]}
            onPress={() => { setMode("login"); setError(""); }}
          >
            <Text style={[styles.tabText, mode === "login" && styles.activeTabText]}>
              Login
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === "register" && styles.activeTab]}
            onPress={() => { setMode("register"); setError(""); }}
          >
            <Text style={[styles.tabText, mode === "register" && styles.activeTabText]}>
              Register
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error Message */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          {mode === "register" && (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!loading}
              />
            </>
          )}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            editable={!loading}
          />

          {mode === "register" && (
            <>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                editable={!loading}
              />
            </>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={mode === "login" ? handleLogin : handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === "login" ? "Sign In" : "Create Account"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* API URL Section */}
        <TouchableOpacity onPress={loadApiUrl} style={styles.apiToggle}>
          <Text style={styles.apiToggleText}>
            {showApiUrl ? "Hide Server Settings" : "Server Settings"}
          </Text>
        </TouchableOpacity>

        {showApiUrl && (
          <View style={styles.apiSection}>
            <Text style={styles.apiLabel}>API Base URL</Text>
            <TextInput
              style={styles.input}
              value={apiUrl}
              onChangeText={setApiUrlLocal}
              placeholder="https://api.example.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity style={styles.apiSaveButton} onPress={saveApiUrl}>
              <Text style={styles.apiSaveText}>Save URL</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1724",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  appName: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#9CA3AF",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    marginBottom: 24,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#2563EA",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#D1D5DB",
    marginTop: 4,
  },
  input: {
    height: 48,
    borderColor: "#374151",
    borderWidth: 1,
    backgroundColor: "#1E293B",
    borderRadius: 8,
    fontSize: 16,
    paddingHorizontal: 14,
    color: "#FFFFFF",
  },
  primaryButton: {
    backgroundColor: "#2563EA",
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 17,
  },
  apiToggle: {
    alignItems: "center",
    marginTop: 28,
    paddingVertical: 8,
  },
  apiToggleText: {
    color: "#6B7280",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  apiSection: {
    marginTop: 12,
    gap: 10,
  },
  apiLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#D1D5DB",
  },
  apiSaveButton: {
    backgroundColor: "#374151",
    height: 42,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  apiSaveText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
});
