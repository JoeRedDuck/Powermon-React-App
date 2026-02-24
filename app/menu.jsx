import { router } from "expo-router";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import RightIcon from "../assets/icons/chevron-right.svg";
import { useAuth } from "../utils/AuthContext";


export default function Menu () {
  const { logout, deleteAccount } = useAuth();

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
    <View style={styles.container}>
      <View style={styles.page_container}>
        <TouchableOpacity onPress={() => router.push({pathname: "/addMonitor"})}>
          <View style={styles.settings_container}>
            <Text style={styles.optionText}>Add New Monitor</Text>
            <RightIcon width = {24} height = {24 } stroke="#6B7280"/>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push({pathname: "/manageMonitors"})}>
          <View style={styles.settings_container}>
            <Text style={styles.optionText}>Manage Monitors</Text>
            <RightIcon width = {24} height = {24 } stroke="#6B7280"/>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push({pathname: "/apiSettings"})}>
          <View style={styles.settings_container}>
            <Text style={styles.optionText}>API Settings</Text>
            <RightIcon width = {24} height = {24 } stroke="#6B7280"/>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push({pathname: "/mutedDevices"})}>
          <View style={styles.settings_container}>
            <Text style={styles.optionText}>Manage Alert Notifications</Text>
            <RightIcon width = {24} height = {24 } stroke="#6B7280"/>
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
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
  }
})