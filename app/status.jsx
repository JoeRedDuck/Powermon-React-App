import Constants from 'expo-constants';
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import DeviceCard from '../components/DeviceCard';
import sortDevices from '../utils/sortDevices';


export default function Status() {

  const [devices, setDevices] = useState([]);
  const [locations, setLocations] = useState([]);
  const selectedLocation = null;
  const TYPE_ORDER = ['IPM'];
  const LOCATION_ORDER = ['Production line'];

  useEffect(() => {
    const apiBase =
      process.env.EXPO_PUBLIC_API_BASE ||
      Constants.expoConfig?.extra?.apiBase ||
      '';
    const base = `${apiBase.replace(/\/$/, '')}/api/v1/status`;


    let mounted = true;

    const fetchDevices = () => {
      const url = selectedLocation 
        ? `${base}?location=${encodeURIComponent(selectedLocation)}` 
        : base;

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
  }, [selectedLocation]);

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