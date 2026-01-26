import * as Notifications from "expo-notifications";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";


// import { ScrollView } from "react-native-web";
import NotificationCard from "../components/NotificationCard";
import { useNotifications } from "../utils/NotificationContext";

export default function NotificationsScreen () {
  const { notifications, clearAllNotifications } = useNotifications();

  return (
      <View style={styles.container}>
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
            <Text style={styles.clear}>Clear All</Text>
          </TouchableOpacity>
        </View>
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
    flex: 1
  },
  scroll: {
    gap: 10
  },
  clear: {
    color: "#2563EA"
  },
  clearButton: {
    height: 20,
    width: 300,
    justifyContent: "center",
    alignItems: "center"
  },
  clearSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 0
  },
})