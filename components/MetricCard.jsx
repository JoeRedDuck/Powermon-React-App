import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function MetricCard ( {type="offline", value = 0} ) {
  const palette = {
    "no power": {accentColour: "#EF4444", pillColour: "#DC2626", title: "No Power", pillText: "No Power"},
    "low power": {accentColour: "#F59E0B", pillColour: "#D97706", title: "Low Power", pillText: "Low Power"},
    "offline": {accentColour: "#9CA3AF", pillColour: "#6B7280", title: "Offline Monitors", pillText: "Offline"},
    "online": {accentColour: "#22C55E", pillColour: "#16A34A", title: "Online", pillText: "Online"}
  }[type]
  
  const cardStyles = StyleSheet.create({
    metricCard: {
    borderColor: "#E5E7EB",
    borderRadius: 11,
    height: 160,
    backgroundColor: "#FFFFFF",
    flexDirection: "row"
    },
    accent: {
      width: 8,
      height: 160,
      backgroundColor: palette.accentColour,
      borderTopLeftRadius: 11,
      borderBottomLeftRadius: 11
    },
    pill: {
      borderRadius: 9999,
      backgroundColor: palette.pillColour,
      height: 28,
      width: 70,
      alignItems: "center",
      justifyContent: "center"
    },
    pillText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#FFFFFF"
    },
    titleText: {
      fontSize: 20,
      fontWeight: "800"
    },
    informationContainer: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      justifyContent: "space-evenly",
      flexDirection: "column",
      flex: 1,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between"
    },
    value: {
      fontSize: 56,
      fontWeight: "900",
      textAlign: "center"
    },
    deviceText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#6B7280",
      textAlign: "center"
    }
  })

  return (
    <TouchableOpacity style={cardStyles.metricCard} onPress={() => router.push({ pathname: "/status", params: {status: type}})}>
      <View style={cardStyles.accent}></View>
      <View style={cardStyles.informationContainer}>
        <View style={cardStyles.row}>
          <Text style={cardStyles.titleText}>{palette.title}:</Text>
          <View style={cardStyles.pill}>
            <Text style={cardStyles.pillText}>{palette.pillText}</Text>
          </View>
        </View>
        <Text style={cardStyles.value}>{value}</Text>
        <Text style={cardStyles.deviceText}>Devices</Text>
      </View>
    </TouchableOpacity>
  )
}