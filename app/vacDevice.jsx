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

const formatMbar = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "-";
};

// Hybrid linear/log y-axis config for the vacuum graph. Returns scale
// type, ticks, and domain together so they stay in sync.
//
// Rationale: pure log scale handles vacuum-loss spikes well (4 decades
// of dynamic range fit on one chart) but looks empty and badly-labelled
// during normal operation where data is in a narrow band like 0.68-0.69
// mbar. So:
//
//   • Data spans < 1 decade (yMax / yMin < 10) → LINEAR scale, tight
//     domain, linear nice-ticks. Looks like the pre-log graph.
//   • Data spans ≥ 1 decade (e.g. a real vacuum-loss event from 0.5 →
//     50 mbar in the same window) → LOG scale, decade-aligned ticks.
//
// The scale type swap happens automatically as the data range changes.
// In normal operation users always see the linear view; only during an
// actual spike does the chart switch to log so they can see both ends.
function buildVacGraphConfig(yMin, yMax) {
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)
      || yMin <= 0 || yMax <= 0) {
    return { scale: "linear", ticks: undefined, domain: [0, 1] };
  }
  const safeMin = Math.max(yMin, 0.01);
  const safeMax = Math.max(yMax, safeMin * 1.001);

  const dynamicRange = safeMax / safeMin;

  if (dynamicRange < 10) {
    // Normal-operation view. Linear scale, ticks from the existing
    // nice-tick algorithm, domain padded ~10% of the data span. This
    // is what the user sees 99% of the time.
    const span = safeMax - safeMin;
    const pad = Math.max(span * 0.1, 0.005);
    return {
      scale: "linear",
      ticks: buildLinearTicks(safeMin, safeMax),
      domain: [safeMin - pad, safeMax + pad],
    };
  }

  // Spike-event view. Log scale, decade-aligned ticks (plus 2x / 5x
  // intermediates when ≤ 2 decades are visible). Floor is locked at 0.1
  // mbar (a decade below normal steady-state ~0.5 mbar) so the operating
  // band has visual headroom above the axis floor — without this, the
  // band sits squashed against the bottom of the graph during a vent.
  const VAC_LOG_FLOOR = 0.1;
  const logFloor = Math.min(Math.floor(Math.log10(safeMin)), -1);
  const logCeil  = Math.ceil(Math.log10(safeMax));
  const includeMinors = (logCeil - logFloor) <= 2;

  const decadeTicks = [];
  for (let p = logFloor; p <= logCeil; p++) {
    const decade = Math.pow(10, p);
    decadeTicks.push(decade);
    if (includeMinors) {
      decadeTicks.push(2 * decade);
      decadeTicks.push(5 * decade);
    }
  }
  const ticksInRange = decadeTicks.filter(
    (t) => t >= VAC_LOG_FLOOR && t <= safeMax * 2,
  );
  const tickMin = ticksInRange.length ? Math.min(...ticksInRange) : safeMin;
  const tickMax = ticksInRange.length ? Math.max(...ticksInRange) : safeMax;
  return {
    scale: "log",
    ticks: ticksInRange.length ? ticksInRange : undefined,
    domain: [
      Math.min(tickMin, safeMin * 0.95),
      Math.max(tickMax, safeMax * 1.05),
    ],
  };
}

function buildLinearTicks(yMin, yMax, targetCount = 5) {
  if (yMin === yMax) return [Math.round(yMin * 100) / 100];
  const span = yMax - yMin;
  const rawStep = span / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let step;
  if (normalized < 1.5) step = 1 * magnitude;
  else if (normalized < 3) step = 2 * magnitude;
  else if (normalized < 7) step = 5 * magnitude;
  else step = 10 * magnitude;
  step = Math.max(step, 0.01);
  const tickMin = Math.floor(yMin / step) * step;
  const tickMax = Math.ceil(yMax / step) * step;
  const ticks = [];
  for (let v = tickMin; v <= tickMax + step / 2; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return ticks;
}

// Format ticks: sub-1 values get 2dp (0.10, 0.20, 0.44, 0.50);
// integers ≥1 stay as integers (1, 2, 10, 100); other ≥1 values get 2dp.
function formatLogTick(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  if (n < 1) return n.toFixed(2);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

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
  // For the log-scale axis we only consider strictly positive values. Any
  // zero or negative entries (shouldn't happen with calibrated readings but
  // defend anyway) are excluded from both the line and the domain.
  const positiveYValues = graphPoints
    .map((point) => point.value)
    .filter((v) => Number.isFinite(v) && v > 0);
  const hasNonZeroData = positiveYValues.length > 0;
  const yMin = hasNonZeroData ? Math.min(...positiveYValues) : null;
  const yMax = hasNonZeroData ? Math.max(...positiveYValues) : null;
  // buildVacGraphConfig returns scale type, ticks, and domain together
  // so they stay in sync. Normal operation = linear scale; only switches
  // to log when the data spans ≥ 1 decade (i.e. a spike is present).
  const graphConfig = hasNonZeroData
    ? buildVacGraphConfig(yMin, yMax)
    : { scale: "linear", ticks: undefined, domain: [0, 1] };
  const yTicks = graphConfig.ticks;
  const [min, setMin] = useState("-")
  const [max, setMax] = useState("-")
  const [average, setAverage] = useState("-")
  const [now, setNow] = useState(Date.now())
  const [pauseBusy, setPauseBusy] = useState(false)
  // Optimistic override: takes effect the instant the user taps so the UI
  // doesn't wait up to 5s for the next useGetVacDevice poll to reflect the
  // new alerts_paused_until value. Cleared once the server-confirmed value
  // catches up.
  const [optimisticPausedUntil, setOptimisticPausedUntil] = useState(null)
  const serverPausedUntil = device?.alerts_paused_until
    ? new Date(device.alerts_paused_until.endsWith("Z")
        ? device.alerts_paused_until
        : device.alerts_paused_until + "Z").getTime()
    : null
  const pausedUntil = optimisticPausedUntil !== null
    ? optimisticPausedUntil
    : serverPausedUntil
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
  // Domain comes from buildVacGraphConfig so it's always sized to match
  // the ticks (and pads in log space, not via fixed multipliers, so narrow
  // data ranges don't get squashed flat by a constant ~0.13 log-units of
  // padding that the old ×0.85 / ×1.15 approach added).
  const chartDomain = { y: graphConfig.domain };

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

  // Clear the optimistic override once the polled device state catches up
  // (or contradicts us). Without this, a stale optimistic value would stick
  // forever after the server-confirmed timestamp arrives.
  useEffect(() => {
    if (optimisticPausedUntil === null) return;
    if (optimisticPausedUntil === 0) {
      if (serverPausedUntil === null || serverPausedUntil <= Date.now()) {
        setOptimisticPausedUntil(null);
      }
    } else if (serverPausedUntil !== null
               && Math.abs(serverPausedUntil - optimisticPausedUntil) < 5000) {
      setOptimisticPausedUntil(null);
    }
  }, [serverPausedUntil, optimisticPausedUntil]);

  const togglePause = async () => {
    if (!apiBase || !mac || pauseBusy) return;
    const willPause = !isPaused;
    // Optimistic update — flip the UI immediately, before the network call.
    setOptimisticPausedUntil(
      willPause ? Date.now() + PAUSE_DURATION_MINUTES * 60 * 1000 : 0
    );
    setPauseBusy(true);
    const url = `${apiBase.replace(/\/$/, "")}/api/v1/vacuum/${encodeURIComponent(mac)}/pause-alerts`;
    try {
      if (willPause) {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minutes: PAUSE_DURATION_MINUTES }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } else {
        const r = await fetch(url, { method: "DELETE" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      }
    } catch (err) {
      console.error("toggle pause-alerts failed", err);
      // Revert the optimistic flip on error so the UI stays truthful.
      setOptimisticPausedUntil(null);
    } finally {
      setPauseBusy(false);
    }
  };

  const extendPause = async () => {
    if (!apiBase || !mac || pauseBusy || !isPaused) return;
    // Stack the extension on top of whatever target is currently displayed.
    const newTarget = pausedUntil + PAUSE_DURATION_MINUTES * 60 * 1000;
    setOptimisticPausedUntil(newTarget);
    setPauseBusy(true);
    const url = `${apiBase.replace(/\/$/, "")}/api/v1/vacuum/${encodeURIComponent(mac)}/pause-alerts/extend`;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: PAUSE_DURATION_MINUTES }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (err) {
      console.error("extend pause-alerts failed", err);
      setOptimisticPausedUntil(null);
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

  // Filter out non-positive points before rendering — log scale can't
  // represent zero or negative values and would silently drop them anyway,
  // but excluding them up front avoids Victory throwing warnings.
  const victoryPoints = graphPoints
    .filter((p) => Number.isFinite(p.value) && p.value > 0)
    .map((p) => ({ x: p.date, y: p.value }));

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
            scale={{ x: "time", y: graphConfig.scale }}
          >
            <VictoryAxis
              dependentAxis
              tickValues={yTicks}
              tickFormat={formatLogTick}
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
              <Text style={styles.power}>{formatMbar(min)} mbar</Text>
            </View>
            <View style={styles.statisticsColumn}>
              <Text style={styles.data}>Max</Text>
              <Text style={styles.power}>{formatMbar(max)} mbar</Text>
            </View>
            <View style={styles.statisticsColumn}>
              <Text style={styles.data}>Average</Text>
              <Text style={styles.power}>{formatMbar(average)} mbar</Text>
            </View>
          </View>
        </View>
        <View style={styles.pauseSection}>
          <TouchableOpacity
            style={[styles.pauseButton,
              isPaused ? styles.pauseButtonResume : styles.pauseButtonIdle,
              pauseBusy && styles.pauseButtonBusy]}
            onPress={togglePause}
            activeOpacity={0.8}
            disabled={pauseBusy}
          >
            <Text style={styles.pauseButtonText}>
              {isPaused
                ? `Resume Alerts  ·  ${remainingLabel}`
                : `Pause Alerts for ${PAUSE_DURATION_MINUTES} Minutes`}
            </Text>
          </TouchableOpacity>
          {isPaused && (
            <TouchableOpacity
              style={[styles.extendButton, pauseBusy && styles.pauseButtonBusy]}
              onPress={extendPause}
              activeOpacity={0.8}
              disabled={pauseBusy}
            >
              <Text style={styles.extendButtonText}>
                + {PAUSE_DURATION_MINUTES} Minutes
              </Text>
            </TouchableOpacity>
          )}
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
  pauseSection: {
    marginTop: 10,
  },
  pauseButton: {
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  pauseButtonIdle: {
    backgroundColor: "#2563EA",
  },
  pauseButtonResume: {
    backgroundColor: "#DC2626",
  },
  pauseButtonBusy: {
    opacity: 0.6,
  },
  pauseButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  pauseHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
    marginHorizontal: 4,
  },
  extendButton: {
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DC2626",
  },
  extendButtonText: {
    color: "#DC2626",
    fontWeight: "bold",
    fontSize: 16,
  },
});
