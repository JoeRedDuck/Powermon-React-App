import { Text, View } from "react-native";
import StatusPill from "../components/StatusPill";

export default function DeviceCard ({ device }) {

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
    <View style = {{width: "100%", height: "130", paddingHorizontal: 10, marginTop: 5, marginBottom: 5}}>
      <View style={cardStyle}>

        <View style={{flexDirection: "row", alignItems: "center", justifyContent: "space-between"}}>
          <Text style={{fontSize: 22, fontWeight: 600}}>{device.name}</Text>

          <StatusPill status={device.status}/>
        </View>

        <Text style={{color: "#6B7280", marginTop:4}}>{device.mac}</Text>

        <View style={{flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "flex-start"}}>
          <Text style={{color: "#6B7280", fontSize: 18}}>Current Power:</Text>
          <Text style={{fontSize: 22, paddingHorizontal: 5}}>{power}W</Text>
        </View>

      </View>
    </View>
  )
}