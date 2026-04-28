import { useEffect, useState } from 'react';
import { getApiUrl } from './apiConfig';

export default function useGetVacDevice (mac) {
  const [device, setDevice] = useState(null)

  useEffect(() => {

    if (!mac) {
      setDevice(null);
      return;
    }

    let cancelled = false;
    let intervalId = null;

    getApiUrl().then(apiBase => {
      if (cancelled) return;
      const base = `${apiBase}/api/v1`;

      const fetchDevice = () => {
        fetch(`${base}/vacuum/devices/${mac}`)
          .then(res => res.json())
          .then(data => {
            if (cancelled) return;
            const device = Array.isArray(data) ? data[0] : data;
            setDevice(device || null);
          })
          .catch(() => {
            if (!cancelled) setDevice(null);
          });
      };

      fetchDevice();
      intervalId = setInterval(fetchDevice, 5000);
    }).catch(err => {
      console.error('Failed to load API URL:', err);
      if (!cancelled) setDevice(null);
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
    }, [mac]);

  return device

}
