import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getApiUrl } from "../utils/apiConfig";

export default function ResetPassword() {
  // Deep-linked from the email as `powermon://resetPassword?code=...`.
  // The code may also be pasted manually from the email body, in which case
  // it'll be empty here and the user fills the Code field themselves.
  const params = useLocalSearchParams();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof params?.code === "string" && params.code) {
      setCode(params.code);
    }
  }, [params?.code]);

  const handleSubmit = async () => {
    setError("");
    if (!code.trim()) {
      setError("Please paste the reset code from the email.");
      return;
    }
    if (password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const apiBase = await getApiUrl();
      const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset_code: code.trim(), new_password: password }),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          detail = body?.detail?.status || body?.detail || detail;
        } catch {}
        if (String(detail).includes("invalid_or_expired")) {
          throw new Error("That reset code is invalid or has expired. Request a new one from the Forgot password screen.");
        }
        if (String(detail).includes("weak_password")) {
          throw new Error("That password doesn't meet the minimum strength (8+ chars).");
        }
        throw new Error(String(detail));
      }
      setSuccess(true);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.appName}>Reset Password</Text>
          <Text style={styles.subtitle}>
            {success ? "Password updated" : "Set a new password for your account"}
          </Text>
        </View>

        {success ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              Your password has been changed. Sign in with the new one.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace("/")}
            >
              <Text style={styles.primaryButtonText}>Back to login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Reset code</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="Paste the code from the email"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text style={styles.label}>New password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              editable={!loading}
            />

            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Type it again"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              editable={!loading}
            />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Set new password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace("/")} style={styles.secondaryLink}>
              <Text style={styles.secondaryLinkText}>Back to login</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F1724" },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  header: { alignItems: "center", marginBottom: 32 },
  appName: { fontSize: 32, fontWeight: "bold", color: "#FFFFFF", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#9CA3AF", textAlign: "center" },
  form: { gap: 12 },
  label: { fontSize: 14, fontWeight: "600", color: "#D1D5DB", marginTop: 4 },
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
  primaryButtonText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 17 },
  secondaryLink: { alignItems: "center", marginTop: 16, paddingVertical: 6 },
  secondaryLinkText: { color: "#60A5FA", fontSize: 14, textDecorationLine: "underline" },
  errorBox: { backgroundColor: "#FEE2E2", borderRadius: 8, padding: 12, marginBottom: 4 },
  errorText: { color: "#DC2626", fontSize: 14, textAlign: "center" },
  successBox: { gap: 16, alignItems: "center" },
  successText: { color: "#FFFFFF", fontSize: 16, textAlign: "center", lineHeight: 24 },
});
