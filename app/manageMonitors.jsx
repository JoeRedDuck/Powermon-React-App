import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import ManageMonitorCard from "../components/ManageMonitorCard";
import { getApiUrl } from "../utils/apiConfig";

export default function ManageMonitors()  {
  const [monitors, setMonitors] = useState([])
  const [apiBase, setApiBase] = useState('')
  
  useEffect(() => {
    getApiUrl().then(setApiBase).catch(err => {
      console.error('Failed to load API URL:', err);
      setApiBase('');
    });
  }, []);

  useEffect(() => {
    if (!apiBase) return; // Don't fetch if API URL is not loaded yet
    
    const url = `${apiBase}/api/v1/monitors`;
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
  }, [apiBase])

  // Handler to refresh list after delete/unassign
  const handleMonitorDelete = (monitorId) => {
    console.log(`Monitor ${monitorId} deleted/unassigned - refreshing list`);
    // The useEffect will handle the refresh via the interval
    // But we can also trigger immediate refresh
    if (!apiBase) return;
    
    const url = `${apiBase}/api/v1/monitors`;
    
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMonitors(data);
        else if (data && Array.isArray(data.monitors)) setMonitors(data.monitors);
        else setMonitors([]);
      })
      .catch(err => console.error('refresh failed', err));
  }

  return (
    <ScrollView>
      {monitors.map(m => (
        <ManageMonitorCard 
          key={m.mac} 
          monitor={m}
          onDelete={handleMonitorDelete}
        />
      ))}
    </ScrollView>
  )
}