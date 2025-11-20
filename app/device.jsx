import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

export default function device () {
  const {mac} = useLocalSearchParams();
  const [graphPoints, setGraphPoints] = useState([]);

  const timeRange = "3h";
  const bucket = "30s";

  useEfeect(() => {
    
    const apiBase =
      process.env.EXPO_PUBLIC_API_BASE ||
      Constants.expoConfig?.extra?.apiBase ||
      '';
    const base = `${apiBase.replace(/\/$/, '')}/api/v1`

    const url = `${base}/power?mac=${encodeURIComponent(
      mac
    )}&time_range=${timeRange}&bucket=${bucket}`;

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        const backendPoints = Array.isArray(data.points) ? data.points : []})
        const mapped = backendPoints
          .map((backendPoint) => ({
            value: Number(backendPoint.value),
            date: new Date(backendPoint.date).getTime()
          }))
          .filter(
            (point) =>
              Number.isFinite(point.value) && Number.isFinite(point.date)
          );
          setGraphPoints(mapped)
      })
      .catch((error) => {
        console.error("power fetch failed", error);
        setGraphPoints([]);
      }), [mac, timeRange, bucket];

  return (
    <View style={styles.conainter}>
      <Text>Device Page</Text>
      <AnimatedLineGraph
        style={styles.graph}
        points={graphPoints}
        color="#2563EA"
        lineThickness={3}
        enableFadeInMask
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F3F4F6",
  },
  title: {
    fontSize: 22,
    marginBottom: 12,
  },
  graph: {
    flex: 1,
  },
});