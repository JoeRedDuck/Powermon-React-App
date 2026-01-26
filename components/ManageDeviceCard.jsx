import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ManageDeviceCard({ device, onDelete }) {
  const [busy, setBusy] = useState(false)

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
    <View style={styles.container}>
      <View style={styles.card}>

        <View>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.attribute}>{device.name}</Text>
        </View>

        <View style={styles.line}></View>

        <View>
          <Text style={styles.label}>Machine Type</Text>
          <Text style={styles.attribute}>{device.machine_type}</Text>
        </View>

        <View style={styles.line}></View>

        <View>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.attribute}>{device.location}</Text>
        </View>

        <View style={styles.line}></View>

        <View>
          <Text style={styles.label}>Assigned Monitor ID</Text>
          <Text style={styles.attribute}>{device.id}</Text>
        </View>

        <View style={styles.line}></View>

        <View>
          <Text style={styles.label}>Mac Address</Text>
          <Text style={styles.attribute}>{device.mac}</Text>
        </View>

        <View style={styles.line}></View>

        {/* <View>
          <Text style={styles.label}>IP Address</Text>
          <Text style={styles.attribute}>{device.ip}</Text>
        </View>

        <View style={styles.line}></View> */}

        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={() => router.push({ pathname: "addDevice", params: { mac: device.name } })}>
            <Text style={styles.edit}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.removeButton} onPress={() => handleDelete(device.mac)}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    alignItems: "center"
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E6E9EC",
    borderWidth: 1,
    borderRadius: 10,
    height: 309,
    width: "100%",
    flexDirection: "column",
    paddingVertical: 10,
    justifyContent: "space-around"
  },
  label: {
    color: "#6B7280",
    fontSize: 13,
    paddingHorizontal: 16
  },
  attribute: {
    fontSize: 19,
    paddingHorizontal: 16
  },
  line: {
    height: 0,
    borderColor: "#E6E9EC",
    borderWidth: 0.5
  },
  edit: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2563EA",
    paddingHorizontal: 30,
    marginTop: 10
  },
  removeButton: {
    backgroundColor: "#EF4444",
    borderRadius: 7,
    height: 40,
    width: 80,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3
  },
  removeText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "bold"
  },
  buttonContainer: {
    flexDirection: "row"
  }
});