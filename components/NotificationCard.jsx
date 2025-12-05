import { StyleSheet, View } from "react-native";
import PowerIcon from "../assets/icons/zap.svg";

export default function NotificationCard () {
  return (
    <View style={styles.card}>
      <View style={styles.circleBadge}><PowerIcon {...iconStyle}/></View>
    </View>
  )
}

const iconStyle = {
    stroke: "#FFFFFF"
  }
const styles = StyleSheet.create({
  card: {
    borderColor: "#E5E7EB",
    borderRadius: 11,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 11,
    paddingHorizontal: 11,
    height: 150
  },
  circleBadge: {
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    height: 30
  },
  
})