// app/NotificationContext.jsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "powermon_notifications_v1";
const NotificationContext = createContext(null);

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

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
    (async () => {
      try {
        const settings = await Notifications.getPermissionsAsync();
        if (!settings.granted) {
          await Notifications.requestPermissionsAsync();
        }
      } catch (e) {
        console.warn("Notification permission request failed", e);
      }
    })();

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