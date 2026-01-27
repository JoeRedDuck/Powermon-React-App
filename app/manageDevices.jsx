import Constants from 'expo-constants';
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import ManageDeviceCard from "../components/ManageDeviceCard";
import sortDevices from "../utils/sortDevices";


export default function ManageDevices () {
  const [devices, setDevices] = useState([])
  const selectedLocation = null;
  const TYPE_ORDER = ["IPM"]
  const LOCATION_ORDER = ["Production line"]
  
  const apiBase =
    process.env.EXPO_PUBLIC_API_BASE ||
    Constants.expoConfig?.extra?.apiBase ||
    '';
  const base = `${apiBase.replace(/\/$/, '')}/api/v1/status`;

  const fetchDevices = useCallback(() => {
    const url = selectedLocation 
      ? `${base}?location=${encodeURIComponent(selectedLocation)}` 
      : base;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setDevices(data);
        else if (data && Array.isArray(data.devices)) setDevices(data.devices);
        else setDevices([]);
      })
      .catch(err => {
        console.error('status fetch failed', err);
        setDevices([]);
      });
  }, [selectedLocation, base]);
  
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
    <ScrollView>
      {orderedDevices.map(d => <ManageDeviceCard key={d.mac} device={d} onDelete={handleDeleted} />)}
    </ScrollView>
  )
}