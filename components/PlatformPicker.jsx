import React from 'react';
import { Platform, TouchableOpacity, Text, ActionSheetIOS, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export default function PlatformPicker({ items = [], selectedValue, onValueChange, style, selectorStyle }) {
  const selectedItem = items.find(i => i.value === selectedValue) || items[0] || { label: '', value: '' };

  if (Platform.OS === 'android') {
    // Android: render native Picker directly (no extra wrapper)
    return (
      <Picker
        style={selectorStyle}
        dropdownIconColor="#111827"
        selectedValue={selectedValue}
        onValueChange={onValueChange}
      >
        {items.map((it) => (
          <Picker.Item key={String(it.value)} label={it.label} value={it.value} />
        ))}
      </Picker>
    );
  }

  // iOS: use ActionSheet for selection to avoid native wheel overlay issues
  const openActionSheet = () => {
    const options = items.map(i => i.label);
    options.push('Cancel');
    const cancelButtonIndex = options.length - 1;
    ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex }, (buttonIndex) => {
      if (buttonIndex === cancelButtonIndex) return;
      const picked = items[buttonIndex];
      if (picked) onValueChange(picked.value);
    });
  };

  return (
    <TouchableOpacity style={[styles.iosWrapper, style]} onPress={openActionSheet} accessibilityRole="button">
      <Text style={[styles.iosText, selectorStyle]} numberOfLines={1}>{selectedItem.label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iosWrapper: {
    height: 45,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  iosText: {
    color: '#111827',
    fontSize: 16,
  }
});
