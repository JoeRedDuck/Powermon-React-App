import Constants from "expo-constants";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LineGraph } from "react-native-graph";


export default function device () {
  const {mac} = useLocalSearchParams();
  const [graphPoints, setGraphPoints] = useState([]);

  const timeRange = "24h";
  const bucket = "10s";

  useEffect(() => {
  if (typeof mac !== "string" || mac.length === 0) return;

  const apiBase =
    process.env.EXPO_PUBLIC_API_BASE ||
    Constants.expoConfig?.extra?.apiBase ||
    "";
  const base = `${apiBase.replace(/\/$/, "")}/api/v1`;
  const url = `${base}/power?mac=${encodeURIComponent(
    mac
  )}&time_range=${timeRange}&bucket=${bucket}`;

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      const backendPoints = Array.isArray(data.points) ? data.points : [];
      const mapped = backendPoints.map((backendPoint) => ({
        value: Number(backendPoint.value),
        date: new Date(backendPoint.date),
      }));
      setGraphPoints(mapped);
    })
    .catch((error) => {
      console.error("power fetch failed", error);
      setGraphPoints([]);
    });
  }, [mac, timeRange, bucket]);

  return (
    <View style={styles.container}>
      <Text>Device Page</Text>
      <LineGraph
        style={styles.graph}
        points={graphPoints}
        color="#FF0000"
        lineThickness={2}
        animated={true}
        enablePanGesture={true}
        sm
      />
      <View style={styles.graph}></View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    padding: 16
  },
  title: {
    fontSize: 22,
    marginBottom: 12,
  },
  graph: {
    flex: 1,
  },
});