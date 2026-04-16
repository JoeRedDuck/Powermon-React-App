import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import ManageVacMonitorCard from "../components/ManageVacMonitorCard";
import { getApiUrl } from "../utils/apiConfig";

export default function ManageVacMonitors()  {
  const [monitors, setMonitors] = useState([])
  const [apiBase, setApiBase] = useState('')

  useEffect(() => {
    getApiUrl().then(setApiBase).catch(err => {
      console.error('Failed to load API URL:', err);
      setApiBase('');
    });
  }, []);

  useEffect(() => {
    if (!apiBase) return;

    const url = `${apiBase}/api/v1/vacuum/monitors`;
    let mounted = true

    const fetchMonitors = () => {
      fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!mounted) return;
        if (Array.isArray(data)) setMonitors(data);
        else setMonitors([]);
      })
      .catch(err => {
        if (!mounted) return;
        console.error('vacuum monitors fetch failed', err);
        setMonitors([]);
      });
    }

    fetchMonitors()
    const id = setInterval(fetchMonitors, 5000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [apiBase])

  const handleMonitorDelete = (monitorId) => {
    if (!apiBase) return;

    const url = `${apiBase}/api/v1/vacuum/monitors`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMonitors(data);
        else setMonitors([]);
      })
      .catch(err => console.error('refresh failed', err));
  }

  return (
    <ScrollView>
      {monitors.map(m => (
        <ManageVacMonitorCard
          key={m.mac}
          monitor={m}
          onDelete={handleMonitorDelete}
        />
      ))}
    </ScrollView>
  )
}
