import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ManageMonitorCard({monitor, onDelete}) {
  return (
     <View style={styles.container}>
      <View style={styles.card}>

        <View>
          <Text style={styles.label}>Monitor ID</Text>
          <Text style={styles.attribute}>{monitor.id}</Text>
        </View>

        <View style={styles.line}></View>

        <View>
          <Text style={styles.label}>Mac Address</Text>
          <Text style={styles.attribute}>{monitor.mac}</Text>
        </View>

        <View style={styles.line}></View>

        <View>
          <Text style={styles.label}>Assigned Machine</Text>
          <Text style={styles.attribute}>{monitor.name}</Text>
        </View>

        <View style={styles.line}></View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity>
            <Text style={styles.edit}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.removeButton}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>


      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    alignItems: "center"
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E6E9EC",
    borderWidth: 1,
    borderRadius: 10,
    width: "100%",
    flexDirection: "column",
    paddingVertical: 10,
    justifyContent: "space-around"
  },
  label: {
    color: "#6B7280",
    fontSize: 13,
    paddingHorizontal: 16
  },
  attribute: {
    fontSize: 19,
    paddingHorizontal: 16
  },
  line: {
    height: 0,
    borderColor: "#E6E9EC",
    borderWidth: 0.5
  },
  edit: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2563EA",
    paddingHorizontal: 30,
    marginTop: 10
  },
  removeButton: {
    backgroundColor: "#EF4444",
    borderRadius: 7,
    height: 40,
    width: 80,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3
  },
  removeText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "bold"
  },
  buttonContainer: {
    flexDirection: "row"
  }
});