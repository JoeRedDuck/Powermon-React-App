// TEMPORARY: utility screen for activating per-machine ML anomaly detection.
// Remove once every machine is activated and the workflow is stable.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getApiUrl } from "../utils/apiConfig";

const STATUS_META = {
  standby: { label: "Standby", color: "#9CA3AF", bg: "#F3F4F6", description: "ML disabled" },
  collecting: { label: "Collecting", color: "#D97706", bg: "#FEF3C7", description: "Gathering training data" },
  active: { label: "Active", color: "#059669", bg: "#D1FAE5", description: "Anomaly detection live" },
};

function ItemCard({ item, mlRow, busy, onActivate, onDeactivate }) {
  const status = mlRow?.status || "standby";
  const meta = STATUS_META[status] || STATUS_META.standby;
  const isActivatedOrCollecting = status === "collecting" || status === "active";

  return (
    <View style={styles.deviceCard}>
      <View style={styles.deviceInfo}>
        <View style={styles.deviceHeader}>
          <Ionicons
            name={item.kind === "vac" ? "water" : "hardware-chip"}
            size={20}
            color="#6B7280"
          />
          <Text style={styles.deviceName}>{item.name}</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={styles.statusHint}>{meta.description}</Text>
        </View>
        {mlRow?.last_trained && (
          <Text style={styles.deviceMeta}>
            Last trained: {new Date(mlRow.last_trained).toLocaleString()}
          </Text>
        )}
        {mlRow?.collection_start_time && status === "collecting" && (
          <Text style={styles.deviceMeta}>
            Collecting since: {new Date(mlRow.collection_start_time).toLocaleString()}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[
          styles.toggleButton,
          isActivatedOrCollecting ? styles.toggleButtonDeactivate : styles.toggleButtonActivate,
          busy && styles.buttonDisabled,
        ]}
        onPress={() => (isActivatedOrCollecting ? onDeactivate(item) : onActivate(item))}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.toggleButtonText}>
            {isActivatedOrCollecting ? "Deactivate" : "Activate"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function MlActivation() {
  const [items, setItems] = useState([]);          // { kind: "power"|"vac", name }
  const [mlByName, setMlByName] = useState({});    // name -> ml row
  const [loading, setLoading] = useState(true);
  const [busyKeys, setBusyKeys] = useState(new Set());

  const refresh = async () => {
    try {
      const apiBase = (await getApiUrl()).replace(/\/$/, "");
      const [powerRes, vacRes, mlRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/status`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${apiBase}/api/v1/vacuum/status`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${apiBase}/api/v1/ml/status`).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);

      // Deduplicate machine names (status returns one row per monitor; we want one per machine)
      const powerNames = Array.from(new Set((powerRes || []).map(d => d.name).filter(Boolean)));
      const vacNames = Array.from(new Set((vacRes || []).map(d => d.name).filter(Boolean)));

      const combined = [
        ...powerNames.map(name => ({ kind: "power", name })),
        ...vacNames.map(name => ({ kind: "vac", name })),
      ];
      setItems(combined);

      const byName = {};
      (mlRes || []).forEach(r => {
        const name = r.machine_name || r.system_name;
        if (name) byName[`${r.kind}:${name}`] = r;
      });
      setMlByName(byName);
    } catch (err) {
      console.error("Failed to load ML activation data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const keyFor = (item) => `${item.kind}:${item.name}`;

  const handleActivate = async (item) => {
    const key = keyFor(item);
    if (busyKeys.has(key)) return;
    setBusyKeys(prev => new Set(prev).add(key));
    try {
      const apiBase = (await getApiUrl()).replace(/\/$/, "");
      const path = item.kind === "power"
        ? `/api/v1/ml/machines/${encodeURIComponent(item.name)}/activate`
        : `/api/v1/ml/vacuum/${encodeURIComponent(item.name)}/activate`;
      const res = await fetch(`${apiBase}${path}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (err) {
      console.error("Activate failed:", err);
    } finally {
      setBusyKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleDeactivate = async (item) => {
    const key = keyFor(item);
    if (busyKeys.has(key)) return;
    setBusyKeys(prev => new Set(prev).add(key));
    try {
      const apiBase = (await getApiUrl()).replace(/\/$/, "");
      const path = item.kind === "power"
        ? `/api/v1/ml/machines/${encodeURIComponent(item.name)}/activate`
        : `/api/v1/ml/vacuum/${encodeURIComponent(item.name)}/activate`;
      const res = await fetch(`${apiBase}${path}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (err) {
      console.error("Deactivate failed:", err);
    } finally {
      setBusyKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Loading machines...</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="flask-outline" size={64} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>No Machines Found</Text>
        <Text style={styles.emptyText}>
          Add power devices or a vacuum system first.
        </Text>
      </View>
    );
  }

  const activeCount = Object.values(mlByName).filter(r => r.status === "active").length;
  const collectingCount = Object.values(mlByName).filter(r => r.status === "collecting").length;

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Experimental — temporary screen</Text>
        <Text style={styles.bannerText}>
          Activating a machine starts a ~7-day data collection window. Only
          activate when its monitor assignment is correct and stable. Anomaly
          pushes go only to phones that have opted in via Settings →
          Experimental.
        </Text>
      </View>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {activeCount} active · {collectingCount} collecting · {items.length} total
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {items.map((item) => {
          const key = keyFor(item);
          return (
            <ItemCard
              key={key}
              item={item}
              mlRow={mlByName[key]}
              busy={busyKeys.has(key)}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    gap: 12,
    padding: 20,
  },
  banner: {
    backgroundColor: "#EDE9FE",
    borderBottomWidth: 1,
    borderBottomColor: "#DDD6FE",
    padding: 14,
    gap: 4,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5B21B6",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bannerText: {
    fontSize: 13,
    color: "#4C1D95",
    lineHeight: 18,
  },
  header: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerText: {
    fontSize: 15,
    color: "#6B7280",
    fontWeight: "500",
  },
  scrollContent: {
    padding: 10,
    gap: 10,
  },
  deviceCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 11,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deviceInfo: {
    flex: 1,
    gap: 6,
  },
  deviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deviceName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusHint: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  deviceMeta: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    minWidth: 96,
    alignItems: "center",
    marginLeft: 10,
  },
  toggleButtonActivate: {
    backgroundColor: "#7C3AED",
    borderWidth: 1,
    borderColor: "#6D28D9",
  },
  toggleButtonDeactivate: {
    backgroundColor: "#9CA3AF",
    borderWidth: 1,
    borderColor: "#6B7280",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  toggleButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#111827",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    maxWidth: 300,
  },
});
