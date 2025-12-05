import * as Notifications from "expo-notifications";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import NotificationCard from "../components/NotificationCard";
import { useNotifications } from "../utils/NotificationContext";

export default function NotificationsScreen () {
  const { notifications } = useNotifications();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress = {() => sendTestNotification()}><Text>SEND THE TEST NOTIFCATION</Text></TouchableOpacity>
      
      {/* {notifications.map((notif) => (
        <NotificationCard key={notif.id} notification={notif} />
      ))} */}
       <NotificationCard/>
    </View>
  )
}

async function sendTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Test notification",
      body: "This is a test notification from Powermon",
      data: { from: "test" },
    },
    trigger: { seconds: 1 },
    
  });
}

const styles = StyleSheet.create({
  container: {
    padding: 16
  },
})