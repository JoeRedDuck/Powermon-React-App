import { Text, View } from "react-native";

export default function StatusPill(status) {
  var statusPillStyle = {
    backgroundColor: "#22C55E",
    borderRadius: 15,
    height: 30,
    width: 94,
    alignItems: "center",
    justifyContent: "center"
  }

  var deviceStatus = "Online"
  if (status["status"] == "no power") {
    statusPillStyle["backgroundColor"] = "#EF4444"
    deviceStatus = "No Power"
  } else if (status["status"] == "low power") {
    statusPillStyle["backgroundColor"] = "#F59E0B"
    deviceStatus = "Low"
  } else if (status["status"] == "offline") {
    statusPillStyle["backgroundColor"] = "#EF4444"
    deviceStatus = "Monitor Offline"
    statusPillStyle["width"] = 135
  }

  return(
    <View style= {statusPillStyle}>
      <Text style={{fontSize: 16, color: "#FFFFFF", fontWeight: 600}}>{deviceStatus}</Text>
    </View>
  )
}
