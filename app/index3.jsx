import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

export default function Index() {
  const { width } = useWindowDimensions();

  // full-width card height scales with screen width
  const cardH = clamp(Math.round(width * 0.34), 150, 220);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F1F5F9" }}>
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: 16 }]}>
        <MetricCard title="Low Power"          value={2} severity="warning" height={cardH} />
        <MetricCard title="No Power"           value={1} severity="danger"  height={cardH} />
        <MetricCard title="Online"             value={8} severity="success" height={cardH} />
        <MetricCard title="Offline Monitors"   value={3} severity="offline" height={cardH} />
      </ScrollView>
    </SafeAreaView>
  );
}

/** severity: "neutral" | "success" | "warning" | "danger" | "offline" */
function MetricCard({ title, value, severity = "neutral", height = 180 }) {
  const palette = {
    neutral: { accent: "#D1D5DB", pillBg: "#6B7280", pillText: "#FFFFFF", text: "#111827", sub: "#6B7280", label: "—" },
    success: { accent: "#22C55E", pillBg: "#16A34A", pillText: "#FFFFFF", text: "#111827", sub: "#6B7280", label: "Online" },
    warning: { accent: "#F59E0B", pillBg: "#D97706", pillText: "#FFFFFF", text: "#111827", sub: "#6B7280", label: "Low Power" },
    danger:  { accent: "#EF4444", pillBg: "#DC2626", pillText: "#FFFFFF", text: "#111827", sub: "#6B7280", label: "No Power" },
    offline: { accent: "#9CA3AF", pillBg: "#6B7280", pillText: "#FFFFFF", text: "#111827", sub: "#6B7280", label: "Offline" },
  }[severity];

  const valueSize = clamp(Math.round(height * 0.38), 40, 64);
  const titleSize = clamp(Math.round(height * 0.13), 18, 24);
  const subSize   = clamp(Math.round(height * 0.10), 14, 18);

  return (
    <View style={[styles.card, styles.shadow, { height }]}>
      <View style={[styles.accent, { backgroundColor: palette.accent }]} />
      <View style={styles.cardInner}>
        <View style={styles.headerRow}>
          <Text
            style={[styles.title, { fontSize: titleSize, color: palette.text }]}
            numberOfLines={2} // allow wrapping
          >
            {title}:
          </Text>
          <View style={[styles.pill, { backgroundColor: palette.pillBg }]}>
            <Text style={[styles.pillText, { color: palette.pillText }]} numberOfLines={1}>
              {palette.label}
            </Text>
          </View>
        </View>

        <View style={styles.valueWrap}>
          <Text style={[styles.value, { fontSize: valueSize, color: palette.text }]}>
            {String(value)}
          </Text>
        </View>

        <Text style={[styles.sub, { fontSize: subSize, color: palette.sub }]}>Devices</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
  },
  shadow: {
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  accent: {
    width: 8,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  cardInner: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "space-between",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: { fontWeight: "800", flexShrink: 1, flex: 1, paddingRight: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start", maxWidth: "50%" },
  pillText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.2, textAlign: "center" },
  valueWrap: { alignItems: "center", marginTop: 2, marginBottom: 2 },
  value: { fontWeight: "900" },
  sub: { textAlign: "center", fontWeight: "600" },
});

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
