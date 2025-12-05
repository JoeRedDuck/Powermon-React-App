import Constants from 'expo-constants';
import { useEffect, useState } from 'react';

export default function useGetDevice (mac) {
  const [device, setDevice] = useState(null)

  useEffect(() => {

    if (!mac) {
      setDevice(null);
      return;
    }

    const apiBase =
      process.env.EXPO_PUBLIC_API_BASE ||
      Constants.expoConfig?.extra?.apiBase ||
      "";
    const base = `${apiBase.replace(/\/$/, "")}/api/v1`;

    fetch(`${base}/devices/${mac}`)
      .then(res => res.json())
      .then(data => {
        // API returns either array or single object depending on route
        const device = Array.isArray(data) ? data[0] : data;
        setDevice(device || null);
      })
      .catch(() => setDevice(null));
    }, [mac]);

  return device

}