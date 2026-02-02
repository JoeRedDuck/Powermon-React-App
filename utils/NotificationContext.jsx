// app/NotificationContext.jsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { getApiUrl } from "./apiConfig";

const STORAGE_KEY = "powermon_notifications_v1";
const NotificationContext = createContext(null);

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    registerForPushNotificationsAsync().then(async token => {
      if (token) {
        console.log("EXPO PUSH TOKEN:", token);
        
        // Register token with your API
        try {
          const apiBase = await getApiUrl();
          const base = `${apiBase}/api/v1`;
          
          const deviceName = Constants.deviceName || Device.modelName || "Unknown Device";
          const url = `${base}/notifications/register`;
          
          console.log("Registering token at:", url);
          console.log("Device name:", deviceName);
          
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token: token,
              device_name: deviceName,
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log("Token registered:", data.status);
          } else {
            const errorText = await response.text();
            console.error("Failed to register token:", response.status);
            console.error("Response:", errorText);
          }
        } catch (error) {
          console.error("Error registering token:", error);
        }
      }
    });
  }, [])

  // load from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setNotifications(JSON.parse(raw));
      } catch (e) {
        console.warn("Failed to load notifications", e);
      }
    })();
  }, []);

  // persist on change
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
      } catch (e) {
        console.warn("Failed to save notifications", e);
      }
    })();
  }, [notifications]);

  // Helpers
  function addNotification(notification) {
    setNotifications((prev) => {
      if (!notification || !notification.id) return prev;
      if (prev.some((n) => n.id === notification.id)) return prev;
      return [notification, ...prev];
    });
  }

  function clearAllNotifications() {
    setNotifications([]);
  }

  function clearNotification(id) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  // Centralised permission + listeners
  useEffect(() => {
    const receiveSub = Notifications.addNotificationReceivedListener((notification) => {
      const payload = notification.request.content;
      const newNotification = {
        id: notification.request.identifier,
        title: payload.title || "",
        body: payload.body || "",
        data: payload.data || {},
        createdAt: new Date().toISOString(),
      };
      addNotification(newNotification);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      // Example deep-link: if push includes { mac: '...' } it opens device
      if (data?.mac) {
        router.push({ pathname: "/device", params: { mac: data.mac } });
      } else {
        router.push("/notifications");
      }
    });

    return () => {
      receiveSub.remove();
      responseSub.remove();
    };
  }, []);

  const value = {
    notifications,
    addNotification,
    clearAllNotifications,
    clearNotification,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (!Device.isDevice) return; // Handle simulator vs real device

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') return;

  // Get the token
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  
  return token;
}