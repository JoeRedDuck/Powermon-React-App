import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import VacuumDeviceCard from '../components/VacuumDeviceCard';
import { getApiUrl } from "../utils/apiConfig";


export default function VacStatus() {

  const [devices, setDevices] = useState([]);
  const [hasError, setHasError] = useState(false)
  const [loading, setLoading] = useState(true)

  const { status, location } = useLocalSearchParams()
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)

  useEffect(() => {
    setSelectedLocation(location ? String(location) : null)
    setSelectedStatus(status ? String(status) : null)
  }, [location, status])

  useEffect(() => {
    let mounted = true;

    getApiUrl().then(apiBase => {
      if (!mounted) return;
      const base = `${apiBase}/api/v1/vacuum/status`;

      const fetchDevices = () => {
        const params = new URLSearchParams();
        if (selectedLocation) params.append('location', selectedLocation);
        if (selectedStatus) params.append('status', selectedStatus);

        const url = `${base}${params.toString() ? `?${params}` : ''}`;
        fetch(url)
          .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          })
          .then(data => {
            if (!mounted) return;
            setHasError(false);
            setLoading(false);
            if (Array.isArray(data)) setDevices(data);
            else setDevices([]);
          })
          .catch(err => {
            if (!mounted) return;
            console.error('vacuum status fetch failed', err);
            setHasError(true);
            setLoading(false);
            setDevices([]);
          });
      };

      fetchDevices();
      const id = setInterval(fetchDevices, 5000);

      return () => {
        mounted = false;
        clearInterval(id);
      };
    }).catch(err => {
      console.error('Failed to load API URL:', err);
      setHasError(true);
      setDevices([]);
    });

    return () => {
      mounted = false;
    };
  }, [selectedLocation, selectedStatus]);

  return (
    <ScrollView
      contentContainerStyle={{
        flexDirection: "column",
        justifyContent: devices.length === 0 ? "center" : "flex-start",
        alignItems: "center",
        paddingVertical: 5,
        flex: devices.length === 0 ? 1 : undefined
      }}
      style={{flex: 1, backgroundColor: "#F9FAFB"}}
    >
      {loading ? null : hasError ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Connection</Text>
          <Text style={styles.emptyText}>Unable to reach the server</Text>
        </View>
      ) : devices.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Vacuum Systems</Text>
          <Text style={styles.emptyText}>No vacuum systems match your filters</Text>
        </View>
      ) : (
        devices.map(d => <VacuumDeviceCard key={d.mac} device={d} />)
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
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
