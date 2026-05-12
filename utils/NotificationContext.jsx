import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { getApiUrl } from "./apiConfig";
import { fetchWithAuth, isLoggedIn } from "./authService";
import { getDeviceId } from "./deviceId";

const STORAGE_KEY = "powermon_notifications_v2";
const POLL_INTERVAL_MS = 5 * 60 * 1000;

const NotificationContext = createContext(null);

export function useNotifications() {
  return useContext(NotificationContext);
}

function routeForPayload(data) {
  if (data?.type === "new_monitor" && data?.notification_mac) {
    router.push({ pathname: "/addMonitor", params: { mac: data.notification_mac } });
  } else if (data?.type === "vac_monitor_discovered" && data?.notification_mac) {
    router.push({ pathname: "/addVacMonitor", params: { mac: data.notification_mac } });
  } else if (data?.mac) {
    router.push({ pathname: "/device", params: { mac: data.mac } });
  } else {
    router.push("/notifications");
  }
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const pollTimerRef = useRef(null);
  const dismissedIdsRef = useRef(new Set());

  // Register push token with backend
  useEffect(() => {
    registerForPushNotificationsAsync().then(async token => {
      if (!token) return;
      console.log("EXPO PUSH TOKEN:", token);
      try {
        const apiBase = await getApiUrl();
        const deviceName = await getDeviceId();
        const res = await fetch(`${apiBase}/api/v1/notifications/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, device_name: deviceName }),
        });
        if (!res.ok) console.error("Failed to register token:", res.status, await res.text());
      } catch (error) {
        console.error("Error registering token:", error);
      }
    });
  }, []);

  // Hydrate from AsyncStorage immediately for snappy first paint
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setNotifications(JSON.parse(raw));
      } catch (e) {
        console.warn("Failed to load notifications cache", e);
      }
    })();
  }, []);

  // Persist whenever notifications change
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifications)).catch(e =>
      console.warn("Failed to save notifications cache", e)
    );
  }, [notifications]);

  // Server fetch — source of truth, but always honor any locally pending dismissals
  // so a slow dismiss POST + a concurrent refresh can't bring back a tapped-X notification.
  const refreshFromServer = useCallback(async () => {
    if (!(await isLoggedIn())) return;
    try {
      const apiBase = await getApiUrl();
      const deviceId = await getDeviceId();
      const url = `${apiBase}/api/v1/notifications/history?device_id=${encodeURIComponent(deviceId || "")}`;
      const res = await fetchWithAuth(url);
      if (!res || !res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      const filtered = data.filter(n => !dismissedIdsRef.current.has(n.id));
      // Once the server confirms a dismissal (id no longer in response), stop tracking it locally.
      const stillPresent = new Set(data.map(n => n.id));
      for (const id of Array.from(dismissedIdsRef.current)) {
        if (!stillPresent.has(id)) dismissedIdsRef.current.delete(id);
      }
      setNotifications(filtered);
    } catch (e) {
      console.warn("Notification history fetch failed", e);
    }
  }, []);

  // Initial fetch + 5min polling + foreground refresh
  useEffect(() => {
    refreshFromServer();
    pollTimerRef.current = setInterval(refreshFromServer, POLL_INTERVAL_MS);

    const sub = AppState.addEventListener("change", state => {
      if (state === "active") refreshFromServer();
    });

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      sub.remove();
    };
  }, [refreshFromServer]);

  // OS listeners — optimistic add then reconcile with server
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      const data = response.notification.request.content.data || {};
      routeForPayload(data);
      refreshFromServer();
    });

    const receiveSub = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data || {};
      const id = data?.notification_id;
      if (id && !dismissedIdsRef.current.has(id)) {
        setNotifications(prev => {
          if (prev.some(n => n.id === id)) return prev;
          return [{
            id,
            title: notification.request.content.title || "",
            body: notification.request.content.body || "",
            createdAt: data.createdAt || new Date().toISOString(),
            data,
          }, ...prev];
        });
      }
      refreshFromServer();
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data || {};
      routeForPayload(data);
      refreshFromServer();
    });

    return () => {
      receiveSub.remove();
      responseSub.remove();
    };
  }, [refreshFromServer]);

  async function clearNotification(id) {
    dismissedIdsRef.current.add(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      const apiBase = await getApiUrl();
      await fetchWithAuth(`${apiBase}/api/v1/notifications/${id}/dismiss`, {
        method: "POST",
      });
    } catch (e) {
      console.warn("Dismiss POST failed (will retry next refresh)", e);
    }
  }

  async function clearAllNotifications() {
    notifications.forEach(n => dismissedIdsRef.current.add(n.id));
    setNotifications([]);
    try {
      const apiBase = await getApiUrl();
      await fetchWithAuth(`${apiBase}/api/v1/notifications/dismiss-all`, {
        method: "POST",
      });
    } catch (e) {
      console.warn("Dismiss-all POST failed (will retry next refresh)", e);
    }
  }

  function clearLocalCache() {
    setNotifications([]);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }

  const value = {
    notifications,
    refreshFromServer,
    clearAllNotifications,
    clearNotification,
    clearLocalCache,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('critical', {
      name: 'Critical Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      sound: 'critical.wav',
      bypassDnd: true,
      lightColor: '#DC2626',
    });
    await Notifications.setNotificationChannelAsync('warning', {
      name: 'Warnings',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'warning.wav',
      lightColor: '#F59E0B',
    });
    await Notifications.setNotificationChannelAsync('anomaly', {
      name: 'ML Anomaly Detections',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200, 100, 200],
      sound: 'warning.wav',
      lightColor: '#8B5CF6',
    });
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Info',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      lightColor: '#3B82F6',
    });
  }

  if (!Device.isDevice) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  try {
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      console.error('No EAS project ID found — cannot get push token');
      return;
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return token;
  } catch (error) {
    console.error('Failed to get push token:', error);
  }
}
