import { useFocusEffect } from '@react-navigation/native';
import { useGlobalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import ManageDeviceCard from "../components/ManageDeviceCard";
import { getApiUrl } from "../utils/apiConfig";
import sortDevices from "../utils/sortDevices";


export default function ManageDevices () {
  const [devices, setDevices] = useState([])
  const [apiBase, setApiBase] = useState('')
  const [hasError, setHasError] = useState(false)
  const TYPE_ORDER = ["IPM"]
  const LOCATION_ORDER = ["Production line"]
  
  const routerParams = useGlobalSearchParams()
  const selectedLocation = routerParams.location ? String(routerParams.location) : "";
  const selectedMachineType = routerParams.machine_type ? String(routerParams.machine_type) : "";
  const selectedStatus = routerParams.status ? String(routerParams.status) : "";
  
  // Load API URL on mount
  useEffect(() => {
    getApiUrl().then(setApiBase).catch(err => {
      console.error('Failed to load API URL:', err);
      setApiBase('');
    });
  }, []);

  const base = apiBase ? `${apiBase}/api/v1/status` : '';

  const fetchDevices = useCallback(() => {
    if (!base) return; // Don't fetch if API URL is not loaded yet
    
    const params = new URLSearchParams();
    if (selectedLocation) params.append('location', selectedLocation);
    if (selectedStatus) params.append('status', selectedStatus);
    if (selectedMachineType) params.append('machine_type', selectedMachineType);

    const url = `${base}${params.toString() ? `?${params}` : ''}`;

    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setHasError(false);
        if (Array.isArray(data)) setDevices(data);
        else if (data && Array.isArray(data.devices)) setDevices(data.devices);
        else setDevices([]);
      })
      .catch(err => {
        console.error('status fetch failed', err);
        setHasError(true);
        setDevices([]);
      });
  }, [selectedLocation, selectedStatus, selectedMachineType, base]);
  
  useEffect(() => {
    let mounted = true;

    const wrappedFetch = () => {
      if (mounted) fetchDevices();
    };

    wrappedFetch();
    const id = setInterval(wrappedFetch, 5000);
    
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [fetchDevices]);

  // Refresh when screen comes into focus (after editing a device)
  useFocusEffect(
    useCallback(() => {
      fetchDevices();
    }, [fetchDevices])
  );

  const handleDeleted = (mac) =>
    setDevices(list => list.filter(d => d.mac !== mac));

  const orderedDevices = sortDevices(devices, TYPE_ORDER, LOCATION_ORDER)

  return (
    <ScrollView 
      style={styles.scrollView}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: orderedDevices.length === 0 ? "center" : "flex-start"
      }}
    >
      {hasError ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Connection</Text>
          <Text style={styles.emptyText}>Unable to reach the server</Text>
        </View>
      ) : orderedDevices.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Devices</Text>
          <Text style={styles.emptyText}>No devices match your filters</Text>
        </View>
      ) : (
        orderedDevices.map(d => <ManageDeviceCard key={d.mac} device={d} onDelete={handleDeleted} />)
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#F9FAFB"
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