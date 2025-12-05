import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MenuDownIcon from "../assets/icons/chevron-down.svg";

export default function GraphDropdown ({
  options,
  selectedValue,
  onChange,
  getLabel,
  getValue,
  }){
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options?.find(
  (opt) => getValue(opt) === selectedValue
  );

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
      style={styles.header}
      onPress={() => setIsOpen((prev) => !(prev))}
      >
        <Text style={styles.headerText}>
          {selectedOption ? getLabel(selectedOption) : "Select..."}
        </Text>
        <MenuDownIcon width={24} height={24} stroke="#111827" />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.dropdown}>
          {options.map((opt) => (
            <TouchableOpacity
              key={getValue(opt)}
              style={styles.item}
              onPress={() => {
                onChange(opt);
                setIsOpen(false);
              }}
            >
              <Text style={styles.itemText}>{getLabel(opt)}</Text>
            </TouchableOpacity>
          ))}
    </View>
)}
    </View>

  )}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    zIndex: 1000,                  // ensures dropdown floats above chart
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },

  headerText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },

  dropdown: {
    position: "absolute",
    top: 48,                      // dropdown starts under header
    left: 0,
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  itemText: {
    fontSize: 16,
    color: "#111827",
  },
});
