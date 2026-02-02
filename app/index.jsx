import { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import 'react-native-gesture-handler';
import MetricCard from "../components/MetricCard";
import { getApiUrl } from "../utils/apiConfig";

export default function Index() {
  const [deviceStats, setDeviceStats] = useState({})
  const [apiBase, setApiBase] = useState('')
  
  useEffect(() => {
    getApiUrl().then(setApiBase).catch(err => {
      console.error('Failed to load API URL:', err);
      setApiBase('');
    });
  }, []);
  
  const base = apiBase ? `${apiBase}/api/v1` : ''

  

  useEffect(() => {
    if (!base) return; // Don't fetch if API URL is not loaded yet
    
    const fetch_stats = () => {
      const url = `${base}/device_stats`
      fetch(url)
        .then(r => r.json())
        .then(setDeviceStats)   // populate dropdown
        .catch(() => setDeviceStats({}));
    }
    fetch_stats()
    const id = setInterval(fetch_stats, 5000);
    
    return () => {
      clearInterval(id);
    };
    }, [base]);

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

