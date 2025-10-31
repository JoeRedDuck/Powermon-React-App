import { ScrollView, StyleSheet, View } from "react-native";

export default function Index() {

  return (
    <ScrollView>
      <View style={styles.cardContainer}>
        <View style={styles.onlineCard}/>
        <View style={styles.offlineCard}/>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: "row",
    padding: 16,
    height: 150,
    justifyContent: "space-evenly"
  },
  onlineCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 11,
    height: 150,
    flex: 3,
    marginRight: "10"
    },
  offlineCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 11,
    height: 150,
    flex: 2
  }
})