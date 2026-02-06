import { Ionicons } from '@expo/vector-icons';
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import StatusPill from "../components/StatusPill";
import { isMachineMuted } from "../utils/muteService.jsx";

export default function DeviceCard ({ device }) {
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (device?.name) {
      // Check mute status using device name, not MAC
      isMachineMuted(device.name).then(setIsMuted);
    }
  }, [device?.name]);

  if (!device) { console.warn('DeviceCard: missing device prop'); return null; }

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

  const statusPillStyle = {
    backgroundColor: "#22C55E",
    borderRadius: 15,
    height: 30,
    width: 94,
    alignItems: "center",
    justifyContent: "center"
  }

  if (device.status != "offline") {
    var power = device.last_power 
  } else {
    var power ="- "
  }
  return (
    <TouchableOpacity 
    style = {{width: "100%", height: "130", paddingHorizontal: 10, marginTop: 5, marginBottom: 5}}
    onPress={() => router.push({pathname: "/device", params: {mac: device.mac}})}>
      <View style={cardStyle}>

        <View style={{flexDirection: "row", alignItems: "center", justifyContent: "space-between"}}>
          <View style={{flexDirection: "row", alignItems: "center", gap: 8}}>
            <Text style={{fontSize: 22, fontWeight: "600"}}>{device.name}</Text>
            {isMuted && (
              <Ionicons name="notifications-off" size={20} color="#EF4444" />
            )}
          </View>

          <StatusPill status={device.status}/>
        </View>

        <Text style={{color: "#6B7280", marginTop:4}}>{device.mac}</Text>

        <View style={{flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "flex-start"}}>
          <Text style={{color: "#6B7280", fontSize: 18}}>Current Power:</Text>
          <Text style={{fontSize: 22, paddingHorizontal: 5}}>{power}W</Text>
        </View>

      </View>
    </TouchableOpacity>
  )
}