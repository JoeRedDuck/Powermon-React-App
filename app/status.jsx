import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import DeviceCard from '../components/DeviceCard';
import { getApiUrl } from "../utils/apiConfig";
import sortDevices from '../utils/sortDevices';


export default function Status() {

  const [devices, setDevices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [selectedMachineType, setSelectedMachineType] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [hasError, setHasError] = useState(false)
  const TYPE_ORDER = ['IPM'];
  const LOCATION_ORDER = ['Production line'];

  const { status, location, machine_type } = useLocalSearchParams()

  useEffect(() => {
    setSelectedLocation(location ? String(location) : null)
    setSelectedStatus(status ? String(status) : null)
    setSelectedMachineType(machine_type ? String(machine_type) : null)
  }, [location,machine_type,status])

  useEffect(() => {
    let mounted = true;
    
    getApiUrl().then(apiBase => {
      if (!mounted) return;
      const base = `${apiBase}/api/v1/status`;

      const fetchDevices = () => {
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
            if (!mounted) return;
            setHasError(false);
            if (Array.isArray(data)) setDevices(data);
            else if (data && Array.isArray(data.devices)) setDevices(data.devices);
            else setDevices([]);
          })
          .catch(err => {
            if (!mounted) return;
            console.error('status fetch failed', err);
            setHasError(true);
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
  }, [selectedLocation, selectedStatus, selectedMachineType]);

  const orderedDevices = sortDevices(devices, TYPE_ORDER, LOCATION_ORDER)

  return (
    <ScrollView
      contentContainerStyle={{
        flexDirection: "column",
        justifyContent: orderedDevices.length === 0 ? "center" : "flex-start",
        alignItems: "center",
        paddingVertical: 5,
        flex: orderedDevices.length === 0 ? 1 : undefined
      }}
      style={{flex: 1, backgroundColor: "#F9FAFB"}}
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
        orderedDevices.map(d => <DeviceCard key={d.mac} device={d} />)
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