import { router } from "expo-router";
import { useState } from "react";
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

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      const apiBase = await getApiUrl();
      const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      // We deliberately treat any 2xx as success and show the same message
      // regardless — the server returns {status: "ok"} whether or not the
      // email exists in the DB (anti-enumeration). The reset code is sent
      // via email, never in the response.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitted(true);
    } catch (e) {
      setError(`Could not reach the server: ${String(e).slice(0, 200)}`);
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
            {submitted
              ? "Check your email"
              : "Enter your email and we'll send you a reset link."}
          </Text>
        </View>

        {submitted ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              If an account exists for{"\n"}
              <Text style={{ fontWeight: "bold" }}>{email}</Text>
              {"\n"}we&apos;ve sent you an email with a link to reset your password. The link expires in 1 hour.
            </Text>
            <Text style={styles.successHint}>
              Tap the link in the email, or paste the code into the reset screen if the link doesn&apos;t open the app.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push({ pathname: "/resetPassword" })}
            >
              <Text style={styles.primaryButtonText}>I have a code</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} style={styles.secondaryLink}>
              <Text style={styles.secondaryLinkText}>Back to login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your.name@example.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
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
                <Text style={styles.primaryButtonText}>Send reset email</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} style={styles.secondaryLink}>
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
  successHint: { color: "#9CA3AF", fontSize: 13, textAlign: "center", lineHeight: 18 },
});
