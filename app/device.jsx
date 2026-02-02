import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { VictoryAxis, VictoryChart, VictoryLine } from "victory-native";
import GraphDropdown from "../components/graphDropdown.jsx";
import StatusPill from "../components/StatusPill";
import useGetDevice from "../utils/getDevice.jsx";
import { isMachineMuted, muteMachine, unmuteMachine } from "../utils/muteService.jsx";
import { Ionicons } from '@expo/vector-icons';

export default function Device () {
  const {mac} = useLocalSearchParams();
  const [graphPoints, setGraphPoints] = useState([]);
  const device = useGetDevice(mac);
  const currentPower = (device?.last_power != "offline") ? device?.last_power : "-"
  const [timeRange,setTimeRange] = useState("3h")
  const [bucket, setBucket] = useState("1m");
  const yValues = graphPoints.map((point) => point.value);
  const hasNonZeroData = yValues.some((value) => value !== 0);
  const [min, setMin] = useState("-")
  const [max, setMax] = useState("-")
  const [average, setAverage] = useState("-")
  const [isMuted, setIsMuted] = useState(false);
  const [muteBusy, setMuteBusy] = useState(false);
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
    });
  }, []);

  useEffect(() => {
    if (mac) {
      isMachineMuted(mac).then(setIsMuted);
    }
  }, [mac]);

  const handleMuteToggle = async () => {
    if (muteBusy || !mac) return;
    setMuteBusy(true);
    try {
      if (isMuted) {
        const success = await unmuteMachine(mac);
        if (success) {
          setIsMuted(false);
          Alert.alert("Success", "Notifications unmuted for this device");
        } else {
          Alert.alert("Error", "Failed to unmute device");
        }
      } else {
        const success = await muteMachine(mac);
        if (success) {
          setIsMuted(true);
          Alert.alert("Success", "Notifications muted for this device");
        } else {
          Alert.alert("Error", "Failed to mute device");
        }
      }
    } finally {
      setMuteBusy(false);
    }
  };

  useEffect(() => {
  if (typeof mac !== "string" || mac.length === 0) return;

  const apiBase =
    process.env.EXPO_PUBLIC_API_BASE ||
    Constants.expoConfig?.extra?.apiBase ||
    "";
  const base = `${apiBase.replace(/\/$/, "")}/api/v1`;
  const url = `${base}/power?mac=${encodeURIComponent(
    mac
  )}&time_range=${timeRange}&bucket=${bucket}`;

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      const backendPoints = Array.isArray(data.points) ? data.points : [];
      const mapped = backendPoints.map((backendPoint) => ({
        value: Number(backendPoint.value),
        date: new Date(backendPoint.date),
      }));
      mapped.sort((a, b) => a.date - b.date);
      setGraphPoints(mapped);
      setMin(data.min);
      setMax(data.max);
      setAverage(data.average);
    })
    .catch((error) => {
      console.error("power fetch failed", error);
      setGraphPoints([]);
      
    });
  }, [mac, timeRange, bucket]);

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
          <TouchableOpacity 
            style={[styles.muteButton, isMuted && styles.muteButtonActive]}
            onPress={handleMuteToggle}
            disabled={muteBusy}
          >
            {muteBusy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons 
                  name={isMuted ? "notifications-off" : "notifications"} 
                  size={18} 
                  color="#FFFFFF" 
                />
                <Text style={styles.muteButtonText}>
                  {isMuted ? "Unmute Alerts" : "Mute Alerts"}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <View style={styles.line}></View>
          <View style={styles.row}>
            <Text style={styles.label}>Current Power:</Text>
            <Text style={styles.power}>{currentPower} W</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Monitor ID:</Text>
            <Text style={styles.power}>{device?.id}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Machine Type:</Text>
            <Text style={styles.data}>{device?.machine_type}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Location:</Text>
            <Text style={styles.data}>{device?.location}</Text>
          </View>
        </View>
        <View style={styles.graphCard}>
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
            padding={{ top: 10, bottom: 20, left: 50, right: 45 }}
            domainPadding={{ y: 20 }}
            scale={{ x: "time" }}
          >
            <VictoryAxis
              dependentAxis
              tickFormat={(tickValue) => {
                if (tickValue >= 1000) {
                  const kilowatts = (tickValue/ 1000).toFixed(1);
                  return `${kilowatts} kW`
                }
                return `${tickValue} W`}}
              style={{
                tickLabels: { fontSize: 12, fill: "#4B5563" },
              }}
            />

            <VictoryAxis
              fixLabelOverlap={true}
              style={{
                tickLabels: { fontSize: 10, fill: "#4B5563" },
              }}
            />

            <VictoryLine
              data={victoryPoints}
              interpolation="linear"
              style={{
                data: { stroke: "#2563EA", strokeWidth: 1 },
              }}
            />
          </VictoryChart>
          <View style={styles.line}></View>
          <View style={styles.statisticsRow}>
            <View style={styles.statisticsColumn}>
              <Text style={styles.data}>Min</Text>
              <Text style={styles.power}>{min} W</Text>
            </View>
            <View style={styles.statisticsColumn}>
              <Text style={styles.data}>Max</Text>
              <Text style={styles.power}>{max} W</Text>
            </View>
            <View style={styles.statisticsColumn}>
              <Text style={styles.data}>Average</Text>
              <Text style={styles.power}>{average} W</Text>
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
  title: {
    fontSize: 22,
    marginBottom: 12,
  },
  graph: {
    flex: 1,
  },
  axisLabel: {
    fontSize: 12,
    color: "#4B5563",
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
  graphCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 11,
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 10
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
    fontWeight: "450"
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
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 5,
    height: 40,
    justifyContent: "center"
  },
  rangePicker: {
  fontSize: 22,
  fontWeight: "600",
  color: "#111827"
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
    gap: 10,
    paddingVertical: 10
  },
  muteButton: {
    backgroundColor: "#6B7280",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10
  },
  muteButtonActive: {
    backgroundColor: "#EF4444"
  },
  muteButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600"
  },
}); 


