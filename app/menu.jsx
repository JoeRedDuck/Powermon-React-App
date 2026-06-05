import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import RightIcon from "../assets/icons/chevron-right.svg";
import { useAuth } from "../utils/AuthContext";
import { getApiUrl } from "../utils/apiConfig";
import { getDeviceId } from "../utils/deviceId";


export default function Menu () {
  const { logout, deleteAccount } = useAuth();
  const [muteCritical, setMuteCritical] = useState(false);
  const [muteWarning, setMuteWarning] = useState(false);
  const [anomalyOptin, setAnomalyOptin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const deviceName = await getDeviceId();
        const apiBase = await getApiUrl();
        const res = await fetch(`${apiBase}/api/v1/notifications/preferences?device_name=${encodeURIComponent(deviceName)}`);
        if (res.ok) {
          const data = await res.json();
          setMuteCritical(data.mute_critical);
          setMuteWarning(data.mute_warning);
          setAnomalyOptin(!!data.anomaly_optin);
        }
      } catch {}
    })();
  }, []);

  async function togglePreference(field, value) {
    try {
      const deviceName = await getDeviceId();
      const apiBase = await getApiUrl();
      await fetch(`${apiBase}/api/v1/notifications/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_name: deviceName, [field]: value }),
      });
    } catch {}
  }

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: () => logout(),
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you absolutely sure? This will permanently delete your account and all data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: () => {
            // Second confirmation
            Alert.alert(
              "Final Confirmation",
              "This is your last chance. Your account will be permanently deleted.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete My Account",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteAccount();
                    } catch (error) {
                      Alert.alert("Error", error.message || "Failed to delete account");
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.page_container}>
        <TouchableOpacity onPress={() => router.push({pathname: "/addMonitor"})}>
          <View style={styles.settings_container}>
            <Text style={styles.optionText}>Add Power Monitor</Text>
            <RightIcon width = {24} height = {24 } stroke="#6B7280"/>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push({pathname: "/manageMonitors"})}>
          <View style={styles.settings_container}>
            <Text style={styles.optionText}>Manage Power Monitors</Text>
            <RightIcon width = {24} height = {24 } stroke="#6B7280"/>
          </View>
        </TouchableOpacity>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Vacuum Monitors</Text>
        </View>
        <TouchableOpacity onPress={() => router.push({pathname: "/addVacMonitor"})}>
          <View style={styles.settings_container}>
            <Text style={styles.optionText}>Add Vacuum Monitor</Text>
            <RightIcon width = {24} height = {24 } stroke="#6B7280"/>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push({pathname: "/manageVacMonitors"})}>
          <View style={styles.settings_container}>
            <Text style={styles.optionText}>Manage Vacuum Monitors</Text>
            <RightIcon width = {24} height = {24 } stroke="#6B7280"/>
          </View>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>General</Text>
        </View>
        <TouchableOpacity onPress={() => router.push({pathname: "/apiSettings"})}>
          <View style={styles.settings_container}>
            <Text style={styles.optionText}>API Settings</Text>
            <RightIcon width = {24} height = {24 } stroke="#6B7280"/>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push({pathname: "/mutedDevices"})}>
          <View style={styles.settings_container}>
            <Text style={styles.optionText}>Mute Devices</Text>
            <RightIcon width = {24} height = {24 } stroke="#6B7280"/>
          </View>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Notification Levels</Text>
        </View>
        <View style={styles.toggleContainer}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <View style={[styles.severityDot, { backgroundColor: "#DC2626" }]} />
              <Text style={styles.optionText}>Critical Alerts</Text>
            </View>
            <Switch
              value={!muteCritical}
              onValueChange={(val) => {
                setMuteCritical(!val);
                togglePreference("mute_critical", !val);
              }}
              trackColor={{ false: "#D1D5DB", true: "#BFDBFE" }}
              thumbColor={!muteCritical ? "#2563EB" : "#9CA3AF"}
            />
          </View>
          <Text style={styles.toggleHint}>UPS power loss, multiple devices down</Text>
          <View style={styles.toggleDivider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <View style={[styles.severityDot, { backgroundColor: "#F59E0B" }]} />
              <Text style={styles.optionText}>Warning Alerts</Text>
            </View>
            <Switch
              value={!muteWarning}
              onValueChange={(val) => {
                setMuteWarning(!val);
                togglePreference("mute_warning", !val);
              }}
              trackColor={{ false: "#D1D5DB", true: "#BFDBFE" }}
              thumbColor={!muteWarning ? "#2563EB" : "#9CA3AF"}
            />
          </View>
          <Text style={styles.toggleHint}>Single device offline or low power</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Experimental</Text>
        </View>
        <View style={styles.toggleContainer}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <View style={[styles.severityDot, { backgroundColor: "#8B5CF6" }]} />
              <Text style={styles.optionText}>ML Anomaly Alerts</Text>
            </View>
            <Switch
              value={anomalyOptin}
              onValueChange={(val) => {
                setAnomalyOptin(val);
                togglePreference("anomaly_optin", val);
              }}
              trackColor={{ false: "#D1D5DB", true: "#DDD6FE" }}
              thumbColor={anomalyOptin ? "#7C3AED" : "#9CA3AF"}
            />
          </View>
          <Text style={styles.toggleHint}>
            Opt in to early anomaly-detection pushes from the new ML models.
            Default off; standard critical / warning alerts are unaffected.
          </Text>
        </View>
        {/* TEMPORARY: activation rollout UI. Remove once every machine is */}
        {/* activated and the workflow is stable. */}
        <TouchableOpacity onPress={() => router.push({pathname: "/mlActivation"})}>
          <View style={styles.settings_container}>
            <Text style={styles.optionText}>ML Activation (temporary)</Text>
            <RightIcon width={24} height={24} stroke="#6B7280"/>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.logoutWrapper}>
        <View style={styles.divider} />
        <TouchableOpacity onPress={handleLogout}>
          <View style={styles.logoutContainer}>
            <Text style={styles.logoutText}>Logout</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteAccount}>
          <View style={styles.deleteAccountContainer}>
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingBottom: 20,
  },
  settings_container: {
    height: 55,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 5,
    fontSize: 16,
    padding: 10,
    color: "#111827",
    marginVertical: 5,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row"
  },
  page_container: {
    margin: 10
  },
  logoutWrapper: {
    margin: 10,
  },
  line: {
    height: 0,
    borderColor: "#E6E9EC", 
    borderWidth: 0.5
  },
  optionText: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "400"
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 15,
  },
  logoutContainer: {
    height: 55,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 5,
    fontSize: 16,
    padding: 10,
    color: "#111827",
    marginVertical: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    fontSize: 16,
    color: "#DC2626",
    fontWeight: "500",
  },
  deleteAccountContainer: {
    height: 55,
    borderColor: "#DC2626",
    borderWidth: 1,
    backgroundColor: "#FEF2F2",
    borderRadius: 5,
    fontSize: 16,
    padding: 10,
    marginVertical: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteAccountText: {
    fontSize: 16,
    color: "#991B1B",
    fontWeight: "600",
  },
  sectionHeader: {
    marginTop: 15,
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  toggleContainer: {
    borderColor: "#E5E7EB",
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 5,
    padding: 14,
    marginVertical: 5,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  toggleHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginLeft: 20,
    marginTop: 2,
  },
  toggleDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 12,
  },
})