import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { VictoryAxis, VictoryChart, VictoryLine } from "victory-native";
import GraphDropdown from "../components/graphDropdown.jsx";
import StatusPill from "../components/StatusPill";
import VacuumGauge from "../components/VacuumGauge";
import { getApiUrl } from "../utils/apiConfig.jsx";
import useGetVacDevice from "../utils/getVacDevice.jsx";

const PAUSE_DURATION_MINUTES = 5;

export default function VacDevice () {
  const {mac} = useLocalSearchParams();
  const [graphPoints, setGraphPoints] = useState([]);
  const device = useGetVacDevice(mac);
  const currentPressure = device?.last_pressure != null && device.status !== "offline"
    ? `${device.last_pressure.toFixed(2)}`
    : "-"
  const [timeRange,setTimeRange] = useState("24h")
  const [bucket, setBucket] = useState("10m");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [apiBase, setApiBase] = useState('');
  const yValues = graphPoints.map((point) => point.value);
  const hasNonZeroData = yValues.some((value) => value !== 0);
  const [min, setMin] = useState("-")
  const [max, setMax] = useState("-")
  const [average, setAverage] = useState("-")
  const [now, setNow] = useState(Date.now())
  const [pauseBusy, setPauseBusy] = useState(false)
  const pausedUntil = device?.alerts_paused_until
    ? new Date(device.alerts_paused_until.endsWith("Z")
        ? device.alerts_paused_until
        : device.alerts_paused_until + "Z").getTime()
    : null
  const isPaused = pausedUntil != null && pausedUntil > now
  const remainingMs = isPaused ? pausedUntil - now : 0
  const remainingMin = Math.floor(remainingMs / 60000)
  const remainingSec = Math.floor((remainingMs % 60000) / 1000)
  const remainingLabel = `${remainingMin}:${String(remainingSec).padStart(2, "0")}`
  const TIME_OPTIONS = [
      {label: "Last 5 minutes", value: "5m", bucket: "10s"},
      {label: "Last 10 minutes", value: "10m", bucket: "10s"},
      {label: "Last 30 minutes", value: "30m", bucket: "20s"},
      {label: "Last hour", value: "1h", bucket: "30s"},
      {label: "Last 3 hours", value: "3h", bucket: "1m"},
      {label: "Last 6 hours", value: "6h", bucket: "2m"},
      {label: "Last 12 hours", value: "12h", bucket: "5m"},
      {label: "Last 24 hours", value: "24h", bucket: "10m"},
    ]
  let chartDomain;
  if (!hasNonZeroData) {
    chartDomain = { y: [0, 1] };
  } else {
    chartDomain = undefined;
  }

  useEffect(() => {
    AsyncStorage.getItem("graph_time_range").then((saved) => {
      if (saved) {
        setTimeRange(saved);
        const opt = TIME_OPTIONS.find(o => o.value === saved);
        if (opt) setBucket(opt.bucket);
      }
      setPreferencesLoaded(true);
    });
  }, []);

  useEffect(() => {
    getApiUrl().then(setApiBase).catch(err => {
      console.error('Failed to load API URL:', err);
      setApiBase('');
    });
  }, []);

  useEffect(() => {
    if (!isPaused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  const togglePause = async () => {
    if (!apiBase || !mac || pauseBusy) return;
    setPauseBusy(true);
    const url = `${apiBase.replace(/\/$/, "")}/api/v1/vacuum/${encodeURIComponent(mac)}/pause-alerts`;
    try {
      if (isPaused) {
        const r = await fetch(url, { method: "DELETE" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } else {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minutes: PAUSE_DURATION_MINUTES }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      }
    } catch (err) {
      console.error("toggle pause-alerts failed", err);
    } finally {
      setPauseBusy(false);
    }
  };

  useEffect(() => {
  if (!preferencesLoaded) return;
  if (!apiBase) return;
  if (typeof mac !== "string" || mac.length === 0) return;

  const base = `${apiBase.replace(/\/$/, "")}/api/v1`;
  const url = `${base}/vacuum/pressure?mac=${encodeURIComponent(
    mac
  )}&time_range=${timeRange}&bucket=${bucket}`;

  const fetchPressure = () => {
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        const backendPoints = data && Array.isArray(data.points) ? data.points : [];

        const mapped = backendPoints.map((backendPoint) => ({
          value: Number(backendPoint.value),
          date: new Date(backendPoint.date),
        }));
        mapped.sort((a, b) => a.date - b.date);
        setGraphPoints(mapped);
        setMin(typeof data?.min !== 'undefined' ? data.min : "-");
        setMax(typeof data?.max !== 'undefined' ? data.max : "-");
        setAverage(typeof data?.average !== 'undefined' ? data.average : "-");
      })
      .catch((error) => {
        console.error("vacuum pressure fetch failed", error);
        setGraphPoints([]);
      });
  };

  fetchPressure();
  const id = setInterval(fetchPressure, 5000);
  return () => clearInterval(id);
  }, [mac, timeRange, bucket, preferencesLoaded, apiBase]);

  const victoryPoints = graphPoints.map((p) => ({
        x: p.date,
        y: p.value,
  }));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.name}>{device?.name}</Text>
            <StatusPill status={device?.status}/>
          </View>
          <Text style={styles.mac}>{device?.mac}</Text>
          <View style={styles.line}></View>
          <View style={styles.row}>
            <Text style={styles.label}>Current Pressure:</Text>
            <Text style={styles.power}>{currentPressure} mbar</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Monitor ID:</Text>
            <Text style={styles.power}>{device?.id}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Location:</Text>
            <Text style={styles.data}>{device?.location}</Text>
          </View>
        </View>
        <View style={styles.gaugeCard}>
          <VacuumGauge pressure={device?.status !== "offline" ? device?.last_pressure : null} />
        </View>
        <TouchableOpacity
          style={[styles.pauseButton, isPaused ? styles.pauseButtonActive : null]}
          onPress={togglePause}
          activeOpacity={0.7}
          disabled={pauseBusy}
        >
          <Text style={styles.pauseButtonTitle}>
            {isPaused ? `Alerts paused · ${remainingLabel}` : `Pause alerts (${PAUSE_DURATION_MINUTES} min)`}
          </Text>
          <Text style={styles.pauseButtonSubtitle}>
            {isPaused ? "Tap to resume now" : "Use when working on the system"}
          </Text>
        </TouchableOpacity>
        <View style={styles.graphCard}>
          <Text style={styles.axisLabel}>Pressure (mbar)</Text>
          <GraphDropdown
            options={TIME_OPTIONS}
            selectedValue={timeRange}
            getLabel={(opt) => opt.label}
            getValue={(opt) => opt.value}
            onChange={(opt) => {
              setTimeRange(opt.value);
              setBucket(opt.bucket);
              AsyncStorage.setItem("graph_time_range", opt.value);
            }}
          />
          <VictoryChart
            domain={chartDomain}
            style={{ parent: { width: "100%"} }}
            padding={{ top: 10, bottom: 20, left: 45, right: 45 }}
            domainPadding={{ y: 20 }}
            scale={{ x: "time" }}
          >
            <VictoryAxis
              dependentAxis
              tickFormat={(tickValue) => {
                if (tickValue >= 1) return tickValue.toFixed(1);
                return tickValue.toFixed(3);
              }}
              style={{
                tickLabels: { fontSize: 10, fill: "#4B5563" },
              }}
            />

            <VictoryAxis
              fixLabelOverlap={true}
              tickFormat={(date) => {
                const d = new Date(date);
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                return `${hours}:${minutes}`;
              }}
              style={{
                tickLabels: { fontSize: 10, fill: "#4B5563" },
              }}
            />

            <VictoryLine
              data={victoryPoints}
              interpolation="linear"
              style={{
                data: { stroke: "#7C3AED", strokeWidth: 1 },
              }}
            />
          </VictoryChart>
          <View style={styles.line}></View>
          <View style={styles.statisticsRow}>
            <View style={styles.statisticsColumn}>
              <Text style={styles.data}>Min</Text>
              <Text style={styles.power}>{min} mbar</Text>
            </View>
            <View style={styles.statisticsColumn}>
              <Text style={styles.data}>Max</Text>
              <Text style={styles.power}>{max} mbar</Text>
            </View>
            <View style={styles.statisticsColumn}>
              <Text style={styles.data}>Average</Text>
              <Text style={styles.power}>{average} mbar</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <View style={styles.graph}></View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
  },
  graph: {
    flex: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 11,
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  gaugeCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 11,
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginTop: 10,
    alignItems: "center",
  },
  graphCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 11,
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  axisLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
    marginBottom: 4,
    marginLeft: 10,
  },
  name: {
    fontWeight: "600",
    fontSize: 22
  },
  mac: {
    color: "#6B7280",
    marginTop:4
  },
  label: {
    fontSize: 18,
    marginBottom: 10,
    fontWeight: "500"
  },
  data: {
    fontSize: 18,
    color: "#6B7280",
  },
  power: {
    fontSize: 18,
    fontWeight: "600"
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  line: {
    height: 0,
    borderColor: "#E6E9EC",
    borderWidth: 0.5,
    marginTop: 20,
    marginBottom: 10
  },
  statisticsRow: {
    flexDirection: "row",
    justifyContent: "center"
  },
  statisticsColumn: {
    flex: 1,
    alignItems: "center"
  },
  content: {
    paddingVertical: 10
  },
  pauseButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 11,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 10,
    alignItems: "center",
  },
  pauseButtonActive: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
  },
  pauseButtonTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  pauseButtonSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
});
