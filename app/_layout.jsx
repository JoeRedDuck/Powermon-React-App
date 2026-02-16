import PlatformPicker from "../components/PlatformPicker";
import * as Notifications from "expo-notifications";
import { router, Stack, useGlobalSearchParams, usePathname } from "expo-router";
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import BackIcon from "../assets/icons/arrow-left.svg";
import Bell from "../assets/icons/bell.svg";
import DevicesIcon from "../assets/icons/grid.svg";
import HomeIcon from "../assets/icons/home.svg";
import MenuIcon from "../assets/icons/menu.svg";
import AddDeviceIcon from "../assets/icons/plus-circle.svg";
import ManageDevicesIcon from "../assets/icons/settings.svg";
import FilterIcon from "../assets/icons/sliders.svg";
import { getApiUrl } from "../utils/apiConfig";
import useGetDevice from "../utils/getDevice.jsx";
import { NotificationProvider } from "../utils/NotificationContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [machineTypes, setMachineTypes] = useState([])
  const [locations, setLocations] = useState([])
  const statuses = ["offline","online","no power", "low power"]

  const pathname = usePathname()
  const routerParams = useGlobalSearchParams()

  const [location, setLocation] = useState("")
  const [status, setStatus] = useState("")
  const [machine_type, setMachineType] = useState("")

  useEffect(() => {
    if (pathname !== "/status" && pathname !== "/manageDevices" && filterOpen) setFilterOpen(false)
  }, [pathname, filterOpen]);

  useEffect(() => {
    if (!filterOpen) return;
    
    // Load API URL asynchronously
    getApiUrl().then(apiBase => {
      const base = `${apiBase}/api/v1`;

      fetch(`${base}/machine_types`)
        .then(r => r.json())
        .then(setMachineTypes)
        .catch(() => setMachineTypes([]));

      fetch(`${base}/locations`)
        .then(r => r.json())
        .then(setLocations)
        .catch(() => setLocations([]));
    }).catch(err => {
      console.error('Failed to load API URL:', err);
      setMachineTypes([]);
      setLocations([]);
    });
  }, [filterOpen]);

  useEffect(() => {
    if (!filterOpen) return;
    setLocation(routerParams.location ? String(routerParams.location) : "")
    setStatus(routerParams.status ? String(routerParams.status) : "")
    setMachineType(routerParams.machine_type ? String(routerParams.machine_type) : "")
  }, [filterOpen, routerParams.location, routerParams.status, routerParams.machine_type]);

  const applyFilters = () => {
    const params = {
      location: location || undefined,
      machine_type: machine_type || undefined,
      status: status || undefined
    };
    if (pathname === "/status") router.setParams(params);
    else if (pathname === "/manageDevices") router.setParams(params);
    else router.push({pathname: "/status", params})
    setFilterOpen(false); 
  }

  return (
    <NotificationProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ backgroundColor: "#0F1724", flex: 1 }}>
          <Topbar filterOpen={filterOpen} setFilterOpen={setFilterOpen} />
            <View style={{ flex: 1}}>
              <Stack screenOptions={{ headerShown: false }} />
              {filterOpen && (
                <View style={styles.filterOverlay}>
                  <View style={styles.filterCard}>
                    <View style={styles.filterHeader}>
                      <Text style={styles.filterTitle}>Filter Options</Text>
                      <TouchableOpacity onPress={() => setFilterOpen(false)} style={styles.closeButton}>
                        <Text style={styles.closeButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  
                    <View style={styles.filterSection}>
                      <Text style={styles.label}>Status</Text>
                      <PlatformPicker
                        items={[{ label: 'All', value: '' }, ...statuses.map(s => ({ label: s, value: s }))]}
                        selectedValue={status}
                        onValueChange={(v) => setStatus(v)}
                        style={styles.pickerWrapper}
                        selectorStyle={styles.selector}
                      />
                    </View>

                    <View style={styles.filterSection}>
                      <Text style={styles.label}>Location</Text>
                      <PlatformPicker
                        items={[{ label: 'All', value: '' }, ...locations.map(l => ({ label: l, value: l }))]}
                        selectedValue={location}
                        onValueChange={(v) => setLocation(v)}
                        style={styles.pickerWrapper}
                        selectorStyle={styles.selector}
                      />
                    </View>

                    <View style={styles.filterSection}>
                      <Text style={styles.label}>Machine Type</Text>
                      <PlatformPicker
                        items={[{ label: 'All', value: '' }, ...machineTypes.map(t => ({ label: t, value: t }))]}
                        selectedValue={machine_type}
                        onValueChange={(v) => setMachineType(v)}
                        style={styles.pickerWrapper}
                        selectorStyle={styles.selector}
                      />
                    </View>

                    <TouchableOpacity 
                      style={styles.applyButton}
                      onPress={applyFilters}>
                      <Text style={styles.applyText}>Apply Filters</Text>
                    </TouchableOpacity>
                  
                  </View>
                </View>
              )}
            </View>
          <Bottombar />
        </SafeAreaView>
      </GestureHandlerRootView>
    </NotificationProvider>
  );
}

function Topbar({ filterOpen, setFilterOpen }) {
  const filterOptions = {}
  const { mac, id } = useGlobalSearchParams();
  const pathname = usePathname()

  // Only fetch device by MAC for /device route, not for /addDevice (which uses machine name)
  const device = useGetDevice(pathname === "/device" ? mac : null);
  const deviceName = pathname === "/device" ? (device?.name || null) : null;
  const titles = {
    "/": "Dashboard",
    "/status": "Devices",
    "/manageDevices": "Manage Devices",
    "/addDevice": (typeof mac === "string" && mac.length) ? "Edit Device" : "Add Device",
    "/manageMonitors": "Manage Monitors",
    "/addMonitor": (typeof id === "string" && id.length) ? "Edit Monitor" : "Add Monitor",
    "/menu": "Settings",
    "/notifications": "Notifications"
  }

  let title
  if (pathname === "/device" && deviceName) {
    title = deviceName;
  } else {
  title = titles[pathname] || "App";
  }

  const textStyle = {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "bold",
    marginBottom: 3
  }

  const topBarStyle = {
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 16

  }

  return (
    <View
      style={{
        height: 56,
        backgroundColor: "#0F1724",
        flexDirection: "row",
        alignItems: "center"
}}
    >  
      {(title != "Dashboard") &&(
      <TouchableOpacity style = {topBarStyle} onPress={() => {router.back()}}>
        <BackIcon width = {32} height = {32} stroke="#FFFFFF"/>
      </TouchableOpacity>)}

      <View style = {{...topBarStyle, flex: 1}}>
      <Text style = {textStyle}>{title}</Text>
      </View>

      {(title == "Devices" || title == "Manage Devices") &&(
      <TouchableOpacity style = {topBarStyle} onPress={() => {setFilterOpen(!filterOpen)}}>
        <FilterIcon width = {28} height = {28} stroke="#FFFFFF"/>
      </TouchableOpacity>)}
    
      {(title == "Dashboard") && (
      <TouchableOpacity style = {topBarStyle} onPress={() => {router.push("/notifications")}}>
        <Bell width = {28} height = {28} stroke="#FFFFFF"/>
      </TouchableOpacity>)}


    </View>
  )
}

function Bottombar() {

  const iconStyle = {
    stroke: "#FFFFFF"
  }

  const addStyle = {
    stroke: "#FFFFFF",
    width: 28,
    height: 28
  }

  const iconBoxStyle = {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    height: 64
  }

  return (
    <View
      style={{
        
        height: 64,
        width: "100%",
        backgroundColor: "#0F1724",
        flexDirection: "row",
        alignItems: "center"
      }}
    >
      <TouchableOpacity style = {iconBoxStyle} onPress={() => router.push("/")}>
        <HomeIcon {...iconStyle}/>
      </TouchableOpacity>

      <TouchableOpacity style = {iconBoxStyle} onPress={() => router.push( "/status")}>
        <DevicesIcon {...iconStyle}/>
      </TouchableOpacity>

      <TouchableOpacity style = {iconBoxStyle} onPress={() => router.push("/addDevice")}>
        <AddDeviceIcon {...addStyle}/>
      </TouchableOpacity>

      <TouchableOpacity style = {iconBoxStyle} onPress={() => router.push("/manageDevices")}>
        <ManageDevicesIcon {...iconStyle}/>
      </TouchableOpacity>

      <TouchableOpacity style = {iconBoxStyle} onPress={() => router.push("/menu")}>
        <MenuIcon {...iconStyle}/>
      </TouchableOpacity>

    </View>
  )
}

const styles = StyleSheet.create({
  filterOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 36, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  filterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxWidth: 500,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24
  },
  filterTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827"
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center"
  },
  closeButtonText: {
    fontSize: 20,
    color: "#6B7280",
    fontWeight: "bold"
  },
  filterSection: {
    marginBottom: 20
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8
  },
  pickerWrapper: {
    height: 45,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 6,
    justifyContent: "center"
  },
  applyButton: {
    backgroundColor: "#2563EA",
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8
  },
  applyText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16
  },
  selector: {
    color: "#111827"
  }
})