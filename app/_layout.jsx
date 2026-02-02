import { Picker } from "@react-native-picker/picker";
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
              <View style={{position: "absolute", top: 0, bottom: 0, left: 0, right: 0,  backgroundColor: "#F3F4F6"}}>
                <View style={styles.form}>
                  <Text style={styles.menuTitle}>Filter Options</Text>
                  
                  <View>
                    <Text style={styles.label}>Status:</Text>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        style={styles.selector}
                        dropdownIconColor="#111827"
                        selectedValue={status}
                        onValueChange={(v) => setStatus(v)}>
                        <Picker.Item label="All" value="" />
                        {statuses.map((type) => ( <Picker.Item key={type} label={type} value={type} />))}
                      </Picker>
                    </View>
                  </View>

                  <View>
                    <Text style={styles.label}>Location:</Text>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        style={styles.selector}
                        dropdownIconColor="#111827"
                        selectedValue={location}
                        onValueChange={(v) => setLocation(v)}>
                        <Picker.Item label="All" value="" />
                        {locations.map((type) => ( <Picker.Item key={type} label={type} value={type} />))}
                      </Picker>
                    </View>
                  </View>

                  <View>
                    <Text style={styles.label}>Machine Type:</Text>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        style={styles.selector}
                        dropdownIconColor="#111827"
                        selectedValue = {machine_type}
                        onValueChange={(v) => setMachineType(v)}>

                        <Picker.Item label="All" value="" />
                        {machineTypes.map((type) => ( <Picker.Item key={type} label={type} value={type} /> ))}
                        
                      </Picker>
                    </View>
                  </View>

                  <View>
                    <TouchableOpacity 
                      style={styles.applyButton}
                      onPress={applyFilters}>
                      <Text style={styles.applyText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                  
                </View>
              </View>)}
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
  label: {
    fontSize: 20,
  },
  form: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    gap: 20,
  },
  pickerWrapper: {
    height: 45,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 5,
    paddingHorizontal: 6,
    marginTop: 10,
    justifyContent: "center"
  },
  menuTitle : {
    fontSize: 30,
    marginBottom: 10,
  },
  applyButton: {
    backgroundColor: "#2563EA",
    height: 45,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center"
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