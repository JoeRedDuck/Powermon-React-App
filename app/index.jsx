import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import 'react-native-gesture-handler';
import MetricCard from "../components/MetricCard";
import { getApiUrl } from "../utils/apiConfig";

export default function Index() {
  const [deviceStats, setDeviceStats] = useState({})
  const [apiBase, setApiBase] = useState('')
  const [hasError, setHasError] = useState(false)
  
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
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(data => {
          setHasError(false);
          setDeviceStats(data);
        })
        .catch(err => {
          console.error('stats fetch failed', err);
          setHasError(true);
          setDeviceStats({});
        });
    }
    fetch_stats()
    const id = setInterval(fetch_stats, 5000);
    
    return () => {
      clearInterval(id);
    };
    }, [base]);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {hasError ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Connection</Text>
          <Text style={styles.emptyText}>Unable to reach the server</Text>
        </View>
      ) : (
        <>
          <MetricCard type="low power" value={deviceStats["low power"]}></MetricCard>
          <MetricCard type="no power" value={deviceStats["no power"]}></MetricCard>
          <MetricCard type="online" value={deviceStats["online"]}></MetricCard>
          <MetricCard type="offline" value={deviceStats["offline"]}></MetricCard>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    flexGrow: 1,
    justifyContent: "center"
  },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 40
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111827"
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280"
  }
})

