import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AlertCircleIcon from "../assets/icons/alert-circle.svg";
import PlusCircleIcon from "../assets/icons/plus-circle.svg";
import BellIcon from "../assets/icons/bell.svg";
import ChevronRight from "../assets/icons/chevron-right.svg";

function getRelativeTime(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getNotificationType(data) {
  if (data?.type === "new_monitor") return "new_monitor";
  if (data?.severity === "critical") return "critical";
  if (data?.severity === "warning") return "warning";
  if (data?.mac) return "warning";
  return "info";
}

const TYPE_CONFIG = {
  new_monitor: {
    Icon: PlusCircleIcon,
    iconColor: "#3B82F6",
    bgColor: "#DBEAFE",
    borderColor: "#3B82F6",
    accentColor: "#3B82F6",
  },
  critical: {
    Icon: AlertCircleIcon,
    iconColor: "#DC2626",
    bgColor: "#FEE2E2",
    borderColor: "#DC2626",
    accentColor: "#DC2626",
  },
  warning: {
    Icon: AlertCircleIcon,
    iconColor: "#F59E0B",
    bgColor: "#FEF3C7",
    borderColor: "#F59E0B",
    accentColor: "#F59E0B",
  },
  info: {
    Icon: BellIcon,
    iconColor: "#6B7280",
    bgColor: "#F3F4F6",
    borderColor: "#9CA3AF",
    accentColor: null,
  },
};

export default function NotificationCard({ notification, onDismiss }) {
  const data = notification?.data || {};
  const type = getNotificationType(data);
  const config = TYPE_CONFIG[type];
  const mac = data?.notification_mac || data?.mac;

  const navigable =
    (type === "new_monitor" && data?.notification_mac) || (type === "device_alert" && data?.mac);

  function handlePress() {
    if (type === "new_monitor" && data?.notification_mac) {
      router.push({ pathname: "/addMonitor", params: { mac: data.notification_mac } });
    } else if (data?.mac) {
      router.push({ pathname: "/device", params: { mac: data.mac } });
    }
  }

  const Wrapper = navigable ? TouchableOpacity : View;
  const wrapperProps = navigable ? { onPress: handlePress, activeOpacity: 0.7 } : {};

  return (
    <Wrapper style={[styles.card, config.accentColor && { borderLeftWidth: 3, borderLeftColor: config.accentColor }]} {...wrapperProps}>
      {/* Row 1: icon + title + time + dismiss */}
      <View style={styles.topRow}>
        <View style={[styles.badge, { backgroundColor: config.bgColor, borderColor: config.borderColor }]}>
          <config.Icon width={16} height={16} stroke={config.iconColor} strokeWidth={2} fill="none" />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {notification?.title}
        </Text>
        <Text style={styles.time}>{getRelativeTime(notification?.createdAt)}</Text>
        {onDismiss && (
          <TouchableOpacity onPress={() => onDismiss(notification.id)} hitSlop={8} style={styles.dismissBtn}>
            <Ionicons name="close" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Row 2: message body */}
      <Text style={styles.body}>{notification?.body}</Text>

      {/* Row 3: MAC tag + chevron */}
      {(mac || navigable) && (
        <View style={styles.bottomRow}>
          {mac ? <Text style={styles.macTag}>{mac}</Text> : <View />}
          {navigable && (
            <ChevronRight width={16} height={16} stroke="#9CA3AF" strokeWidth={2} />
          )}
        </View>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  time: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  dismissBtn: {
    marginLeft: 4,
  },
  body: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
    paddingLeft: 42,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 42,
  },
  macTag: {
    fontSize: 12,
    color: "#9CA3AF",
    fontFamily: "monospace",
  },
});
