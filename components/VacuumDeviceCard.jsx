import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import StatusPill from "../components/StatusPill";

export default function VacuumDeviceCard ({ device }) {
  if (!device) { console.warn('VacuumDeviceCard: missing device prop'); return null; }

  const cardStyle = {
    height: 130,
    flexDirection: "column",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 11,
    backgroundColor: "#FFFFFF"
  }

  const pressure = device.status !== "offline" && device.last_pressure != null
    ? `${device.last_pressure.toFixed(2)}`
    : "-"

  return (
    <TouchableOpacity
    style = {{width: "100%", height: "130", paddingHorizontal: 10, marginTop: 5, marginBottom: 5}}
    onPress={() => router.push({pathname: "/vacDevice", params: {mac: device.mac}})}>
      <View style={cardStyle}>

        <View style={{flexDirection: "row", alignItems: "center", justifyContent: "space-between"}}>
          <Text style={{fontSize: 22, fontWeight: "600"}}>{device.name}</Text>
          <StatusPill status={device.status}/>
        </View>

        <Text style={{color: "#6B7280", marginTop:4}}>{device.mac}</Text>

        <View style={{flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "flex-start"}}>
          <Text style={{color: "#6B7280", fontSize: 18}}>Current Pressure:</Text>
          <Text style={{fontSize: 22, paddingHorizontal: 5}}>{pressure} mbar</Text>
        </View>

      </View>
    </TouchableOpacity>
  )
}
