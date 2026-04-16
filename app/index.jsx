import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import MetricCard from "../components/MetricCard";
import { getApiUrl } from "../utils/apiConfig";

export default function Index() {
  const [deviceStats, setDeviceStats] = useState({})
  const [vacStats, setVacStats] = useState({})
  const [apiBase, setApiBase] = useState('')
  const [hasError, setHasError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getApiUrl().then(setApiBase).catch(err => {
      console.error('Failed to load API URL:', err);
      setApiBase('');
    });
  }, []);

  const base = apiBase ? `${apiBase}/api/v1` : ''

  useEffect(() => {
    if (!base) return;

    const fetch_stats = () => {
      const powerUrl = `${base}/device_stats`
      const vacUrl = `${base}/vacuum/device_stats`

      Promise.all([
        fetch(powerUrl).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }),
        fetch(vacUrl).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }).catch(() => ({}))
      ])
        .then(([powerData, vacData]) => {
          setHasError(false);
          setLoading(false);
          setDeviceStats(powerData);
          setVacStats(vacData);
        })
        .catch(err => {
          console.error('stats fetch failed', err);
          setHasError(true);
          setLoading(false);
          setDeviceStats({});
          setVacStats({});
        });
    }
    fetch_stats()
    const id = setInterval(fetch_stats, 5000);

    return () => {
      clearInterval(id);
    };
    }, [base]);

  const hasVacData = vacStats.online > 0 || vacStats.offline > 0 || vacStats.high_pressure > 0;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {loading ? null : hasError ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Connection</Text>
          <Text style={styles.emptyText}>Unable to reach the server</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Power Monitoring</Text>
          <MetricCard type="low power" value={deviceStats["low power"]} />
          <MetricCard type="no power" value={deviceStats["no power"]} />
          <MetricCard type="online" value={deviceStats["online"]} />
          <MetricCard type="offline" value={deviceStats["offline"]} />

          {hasVacData && (
            <>
              <Text style={[styles.sectionTitle, {marginTop: 16}]}>Vacuum Monitoring</Text>
              <MetricCard
                type="high pressure"
                value={vacStats.high_pressure || 0}
                onPress={() => router.push({ pathname: "/vacStatus", params: {status: "high pressure"}})}
              />
              <MetricCard
                type="vac_online"
                value={vacStats.online || 0}
                onPress={() => router.push({ pathname: "/vacStatus", params: {status: "online"}})}
              />
              <MetricCard
                type="vac_offline"
                value={vacStats.offline || 0}
                onPress={() => router.push({ pathname: "/vacStatus", params: {status: "offline"}})}
              />
            </>
          )}
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
    color: "#F9FAFB"
  },
  emptyText: {
    fontSize: 16,
    color: "#9CA3AF"
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  }
})

