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
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 100,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  circleBadge: {
    borderColor: "#F59E0B",
    borderWidth: 2,
    borderRadius: 999,
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF3C7"
  },
  section: {
    flex: 1
  },
  timeSection: {
    paddingVertical: 8,
    flex: 2,
    alignItems: "flex-end"
  },
  iconSection: {
    alignItems: "center",
    paddingVertical: 8,
    paddingRight: 12,
    justifyContent: "center"
  },
  contentSection: {
    flex: 5,
    justifyContent: "center",
    gap: 6,
  },
  title: {
    fontWeight: "600",
    fontSize: 16,
    color: "#111827"
  },
  message: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 20
  },
  iconStyle: {
    stroke: "#F59E0B",
    fill: "#FEF3C7",
    strokeWidth: 2,
    height: 20,
    width: 20
  },
  time: {
    color: "#6B7280",
    fontSize: 13
  }
})