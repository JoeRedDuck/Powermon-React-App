import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import DeviceCard from '../components/DeviceCard';
import sortDevices from '../utils/sortDevices';


export default function Status() {

  const [devices, setDevices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [selectedMachineType, setSelectedMachineType] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const TYPE_ORDER = ['IPM'];
  const LOCATION_ORDER = ['Production line'];

  const { status, location, machine_type } = useLocalSearchParams()

  useEffect(() => {
    setSelectedLocation(location ? String(location) : null)
    setSelectedStatus(status ? String(status) : null)
    setSelectedMachineType(machine_type ? String(machine_type) : null)
  }, [location,machine_type,status])

  useEffect(() => {
    const apiBase =
      process.env.EXPO_PUBLIC_API_BASE ||
      Constants.expoConfig?.extra?.apiBase ||
      '';
    const base = `${apiBase.replace(/\/$/, '')}/api/v1/status`;


    let mounted = true;

    const fetchDevices = () => {
      const params = new URLSearchParams();
      if (selectedLocation) params.append('location', selectedLocation);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedMachineType) params.append('machine_type', selectedMachineType);

      
      const url = `${base}${params.toString() ? `?${params}` : ''}`;
      fetch(url)
        .then(r => r.json())
        .then(data => {
          if (!mounted) return;
          if (Array.isArray(data)) setDevices(data);
          else if (data && Array.isArray(data.devices)) setDevices(data.devices);
          else setDevices([]);
        })
        .catch(err => {
          if (!mounted) return;
          console.error('status fetch failed', err);
          setDevices([]);
        });
    };

    fetchDevices();
    const id = setInterval(fetchDevices, 5000);
    
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [selectedLocation, selectedStatus, selectedMachineType]);

  const orderedDevices = sortDevices(devices, TYPE_ORDER, LOCATION_ORDER)

  return (
    <ScrollView
      contentContainerStyle={{
        
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "center",
        paddingVertical: 5
      }}
      style={{flex: 1}}
    >
      {orderedDevices.map(d => <DeviceCard key={d.mac} device={d} />)}
    </ScrollView>
  )
} 