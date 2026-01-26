import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import RightIcon from "../assets/icons/chevron-right.svg";


export default function Menu () {
  return (
    <View style={styles.page_container}>
      <TouchableOpacity onPress={() => router.push({pathname: "/manageMonitors"})}>
        <View style={styles.settings_container}>
          <Text style={styles.optionText}>Add New Monitor</Text>
          <RightIcon width = {24} height = {24 } stroke="#6B7280"/>
        </View>
      </TouchableOpacity>
      <View style={styles.settings_container}>
        <Text style={styles.optionText}>Manage Monitors</Text>
        <RightIcon width = {24} height = {24 } stroke="#6B7280"/>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  settings_container: {
    height: 55,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 5,
    fontSize: 16,
    padding: 10,
    color: "#111827",
    marginVertical: 2,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row"
  },
  page_container: {
    margin: 10
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

  }
})