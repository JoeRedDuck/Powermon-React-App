import { StyleSheet, Text, View } from "react-native";
import PowerIcon from "../assets/icons/zap.svg";

export default function NotificationCard ({notification}) {
  const title = notification?.title
  const message = notification?.body

  const dateObject = notification?.data?.createdAt ? new Date(notification.data.createdAt) : new Date
  const dateString = dateObject.toLocaleDateString("en-US", { month:"short", day:"numeric"})
  const timeString = dateObject.toLocaleTimeString("en-US", {hour:"2-digit", minute: "2-digit"})

  return (
    <View style={styles.card}>
      <View style={[styles.section, styles.iconSection]}>
        <View style={styles.circleBadge}>
          <PowerIcon {...styles.iconStyle}/>
        </View>
      </View>
      <View style={[styles.section,styles.contentSection]}>
        <Text style={styles.title}>{title}:</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      <View style={[styles.section,styles.timeSection]}>
        <Text style={styles.time}>{dateString} {timeString}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderColor: "#E5E7EB",
    borderRadius: 11,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 11,
    paddingHorizontal: 11,
    height: 100,
    justifyContent: "space-evenly",
    flexDirection: "row"
  },
  circleBadge: {
    borderColor: "#F59E0B",
    borderWidth: 2,
    borderRadius: 999,
    height: 30,
    width: 30,
    alignItems: "center",
    justifyContent: "center"
  },
  section: {
    // borderColor: "#000000",
    // borderWidth: 1,
    flex: 1
  },
  timeSection: {
    paddingVertical: 8,
    flex: 2
  },
  iconSection: {
    // justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    paddingRight: 10
  },
  contentSection: {
    flex: 5,
    justifyContent: "center",
    gap: 5,
  },
  title: {
    fontWeight: "600",
    fontSize: 18
  },
  message: {
    fontSize: 18
  },
  iconStyle: {
    stroke: "#F59E0B",
    fill: "#FFFFFF",
    strokeWidth: 2,
    height: 20,
    width: 20
  },
  time: {
    color: "#6B7280",
  }
})