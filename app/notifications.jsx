import * as Notifications from "expo-notifications";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";


// import { ScrollView } from "react-native-web";
import NotificationCard from "../components/NotificationCard";
import { useNotifications } from "../utils/NotificationContext";

export default function NotificationsScreen () {
  const { notifications, clearAllNotifications } = useNotifications();

  return (
      <View style={styles.container}>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyText}>You're all caught up!</Text>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.scroll}>
              {notifications.map((notif) => (
                <NotificationCard key={notif.id} notification={notif} />
              ))}
            </ScrollView>
            <View style={styles.clearSection}>
              <TouchableOpacity 
                style={styles.clearButton}
                onPress = {() => {clearAllNotifications()}}
              >
                <Text style={styles.clearText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
  )
}

async function sendTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Low Power Alert",
      body: "Pump 3 is low power",
      data: { 
        from: "test",
        createdAt: new Date().toISOString()
      },
    },
    trigger: { seconds: 1 },
    
  });
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 10,
    flex: 1,
    backgroundColor: "#F9FAFB"
  },
  scroll: {
    gap: 12,
    paddingBottom: 10
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111827"
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280"
  },
  clearText: {
    color: "#2563EA",
    fontSize: 16,
    fontWeight: "500"
  },
  clearButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  clearSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10
  },
})