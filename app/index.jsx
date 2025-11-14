import Constants from 'expo-constants';
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import MetricCard from "../components/MetricCard";


export default function Index() {
  const [deviceStats, setDeviceStats] = useState({})
  const apiBase =
      process.env.EXPO_PUBLIC_API_BASE ||
      Constants.expoConfig?.extra?.apiBase ||
      '';
    const base = `${apiBase.replace(/\/$/, '')}/api/v1`

  useEffect(() => {
      const url = `${base}/device_stats`
      fetch(url)
        .then(r => r.json())
        .then(setDeviceStats)   // populate dropdown
        .catch(() => setDeviceStats({}));
    }, []);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <MetricCard type="low power" value={deviceStats["low power"]}></MetricCard>
      <MetricCard type="no power" value={deviceStats["no power"]}></MetricCard>
      <MetricCard type="online" value={deviceStats["online"]}></MetricCard>
      <MetricCard type="offline" value={deviceStats["offline"]}></MetricCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  
  page: {
    paddingHorizontal: 16,
    flex: 1,
    justifyContent: "space-evenly"
  }
})