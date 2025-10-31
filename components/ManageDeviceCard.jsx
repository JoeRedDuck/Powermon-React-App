import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, Text, TouchableOpacity, View } from "react-native";

export default function ManageDeviceCard({ device, onDelete }) {
  const [busy, setBusy] = useState(false)

  const cardStyle = {
    backgroundColor: "#FFFFFF",
    borderColor: "#E6E9EC",
    borderWidth: 1,
    borderRadius: 10,
    height: 360,
    width: "100%",
    flexDirection: "column",
    paddingVertical: 10,
    justifyContent: "space-around"
  }

  const labelStyle = {
    color: "#6B7280",
    fontSize: 13,
    paddingHorizontal: 16
  }

  const attributeStyle = {
    fontSize: 19,
    paddingHorizontal: 16
  }

  const lineStyle = {
    height: 0,
    borderColor: "#E6E9EC", 
    borderWidth: 0.5
  }

  const editStyle = {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2563EA",
    paddingHorizontal: 30,
    marginTop: 10
  }

  const removeButtonStyle = {
    backgroundColor: "#EF4444",
    borderRadius: 7,
    height: 40,
    width: 80,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3

  }

  const removeTextStyle = {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "bold"
  }

  async function checkPolls(mac) {
     const base =
    (process.env.EXPO_PUBLIC_API_BASE ??
      Constants.expoConfig?.extra?.apiBase ??
      '').replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/api/v1/checkPoll/${mac}`, { method: 'POST' });
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data.count === 'number' ? data.count : null;
    } catch {
      return null; 
    }
  }

  async function handleDelete(mac) {
    if (busy) return;
    setBusy(true);

    try {
      const count = await checkPolls(mac);

      if (count !== null && count > 0) {
        const ok = Platform.OS === "web"
        ? window.confirm(
          `This device has existing polls (${count}). .Are you sure you want to delete it?`)
        : await new Promise(resolve =>
          Alert.alert(
            "Confirm Delete",
            `This device has existing polls (${count}). Are you sure you want to delete it?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]
          )
        )
        if (!ok) return;
      }

    const apiBase =
      process.env.EXPO_PUBLIC_API_BASE ||
      Constants.expoConfig?.extra?.apiBase ||
      '';
    const url = `${apiBase.replace(/\/$/, '')}/api/v1/devices/${mac}`;
    const response = await fetch(url, { method: "DELETE" });

    if (!response.ok) {
      Alert.alert("Delete failed")
      console.log(response)
      return
    }
    const data = await response.json();
    console.log(data);
    if (data.status === "deleted") {
      onDelete?.(mac);
      }
    }
    finally {setBusy(false);}
  }


  return (
    <View style = {{padding: 10, allignItems: "center"}}>
      <View style = {cardStyle}>

        <View>
          <Text style = {labelStyle}>Name</Text>
          <Text style = {attributeStyle}>{device.name}</Text>
        </View>

        <View style={lineStyle}></View>

        <View>
          <Text style = {labelStyle}>Mac Address</Text>
          <Text style = {attributeStyle}>{device.mac}</Text>
        </View>

        <View style={lineStyle}></View>

        <View>
          <Text style= {labelStyle}>Monitor ID</Text>
          <Text style = {attributeStyle}>{device.id}</Text>
        </View>

        <View style={lineStyle}></View>

        <View>
          <Text style = {labelStyle}>Machine Type</Text>
          <Text style = {attributeStyle}>{device.type}</Text>
        </View>

        <View style={lineStyle}></View>

        <View>
          <Text style = {labelStyle}>Location</Text>
          <Text style = {attributeStyle}>{device.location}</Text>
        </View>

        <View style={lineStyle}></View>

        <View>
          <Text style = {labelStyle}>IP Address</Text>
          <Text style = {attributeStyle}>{device.ip}</Text>
        </View>

        <View style={lineStyle}></View>

        <View style={{flexDirection: "row"}}>
          <TouchableOpacity onPress = {() => router.push({ pathname: "addDevice", params: { mac: device.mac } })}>
            <Text style={editStyle}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={removeButtonStyle} onPress={() => handleDelete(device.mac)}>
            <Text style={removeTextStyle}>Remove</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  )
}