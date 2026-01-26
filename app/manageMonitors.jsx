import Constants from 'expo-constants';
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import ManageMonitorCard from "../components/ManageMonitorCard";

export default function ManageMonitors()  {
  const [monitors, setMonitors] = useState([])

  useEffect(() => {
    const apiBase =
      process.env.EXPO_PUBLIC_API_BASE ||
      Constants.expoConfig?.extra?.apiBase ||
      '';
    const url = `${apiBase.replace(/\/$/, '')}/api/v1/monitors`;
    let mounted = true

    const fetchDevices = () => {
      fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!mounted) return;
        console.log('API Response:', data);
        if (Array.isArray(data)) setMonitors(data);
        else if (data && Array.isArray(data.monitors)) setMonitors(data.monitors);
        else setMonitors([]);
      })
      .catch(err => {
        if (!mounted) return;
        console.error('status fetch failed', err);
        setMonitors([]);
      });
    }

    fetchDevices()
    console.log(monitors)
    const id = setInterval(fetchDevices, 5000);
    
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [])

  return (
    <ScrollView>
      {monitors.map(m => <ManageMonitorCard key={m.mac} monitor={m}></ManageMonitorCard>)}
    </ScrollView>
  )
}