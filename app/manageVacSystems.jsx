import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import ManageVacSystemCard from "../components/ManageVacSystemCard";
import { getApiUrl } from "../utils/apiConfig";


export default function ManageVacSystems() {
  const [systems, setSystems] = useState([]);
  const [apiBase, setApiBase] = useState('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    getApiUrl().then(setApiBase).catch(err => {
      console.error('Failed to load API URL:', err);
      setApiBase('');
    });
  }, []);

  const base = apiBase ? `${apiBase}/api/v1` : '';

  const fetchSystems = useCallback(() => {
    if (!base) return;

    fetch(`${base}/vacuum/systems`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setHasError(false);
        if (Array.isArray(data)) {
          const sorted = data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setSystems(sorted);
        } else {
          setSystems([]);
        }
      })
      .catch(err => {
        console.error('vacuum systems fetch failed', err);
        setHasError(true);
        setSystems([]);
      });
  }, [base]);

  useEffect(() => {
    let mounted = true;

    const wrappedFetch = () => {
      if (mounted) fetchSystems();
    };

    wrappedFetch();
    const id = setInterval(wrappedFetch, 5000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [fetchSystems]);

  useFocusEffect(
    useCallback(() => {
      fetchSystems();
    }, [fetchSystems])
  );

  const handleDeleted = (name) =>
    setSystems(list => list.filter(s => s.name !== name));

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: systems.length === 0 ? "center" : "flex-start"
      }}
    >
      {hasError ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Connection</Text>
          <Text style={styles.emptyText}>Unable to reach the server</Text>
        </View>
      ) : systems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Vacuum Systems</Text>
          <Text style={styles.emptyText}>Add a vacuum system to get started</Text>
        </View>
      ) : (
        systems.map(s => <ManageVacSystemCard key={s.name} system={s} onDelete={handleDeleted} />)
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#F9FAFB"
  },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 40
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111827"
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280"
  }
})
