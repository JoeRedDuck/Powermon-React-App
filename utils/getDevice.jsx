import { useEffect, useState } from 'react';
import { getApiUrl } from './apiConfig';

export default function useGetDevice (mac) {
  const [device, setDevice] = useState(null)

  useEffect(() => {

    if (!mac) {
      setDevice(null);
      return;
    }

    getApiUrl().then(apiBase => {
      const base = `${apiBase}/api/v1`;

      fetch(`${base}/devices/${mac}`)
        .then(res => res.json())
        .then(data => {
          // API returns either array or single object depending on route
          const device = Array.isArray(data) ? data[0] : data;
          setDevice(device || null);
        })
        .catch(() => setDevice(null));
    }).catch(err => {
      console.error('Failed to load API URL:', err);
      setDevice(null);
    });
    }, [mac]);

  return device

}