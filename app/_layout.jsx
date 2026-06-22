import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { router, Stack, useGlobalSearchParams, usePathname } from "expo-router";
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
import LoginScreen from "../components/LoginScreen";
import PlatformPicker from "../components/PlatformPicker";
import { getApiUrl } from "../utils/apiConfig";
import { AuthProvider } from "../utils/AuthContext";
import { deleteAccount as authDeleteAccount, logout as authLogout, isLoggedIn } from "../utils/authService";
import useGetDevice from "../utils/getDevice.jsx";
import useGetVacDevice from "../utils/getVacDevice.jsx";
import { NotificationProvider } from "../utils/NotificationContext";
import { isTestMode as checkTestMode, mockFetch, resetMockDevices } from "../utils/testMode";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  // IBM Plex Mono for the vacuum gauge readout (matches the web app). The
  // error slot is load-bearing: without it, a missing/corrupt font file
  // would hang the whole app on the loading screen forever. We proceed once
  // fonts are loaded OR errored — on error RN falls back to a system font.
  const [fontsLoaded, fontError] = useFonts({
    "IBMPlexMono-Regular": require("../assets/fonts/IBMPlexMono-Regular.ttf"),
    "IBMPlexMono-SemiBold": require("../assets/fonts/IBMPlexMono-SemiBold.ttf"),
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [testMode, setTestModeState] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [machineTypes, setMachineTypes] = useState([])
  const [locations, setLocations] = useState([])
  const statuses = ["offline","online","no power", "low power"]

  const pathname = usePathname()
  const routerParams = useGlobalSearchParams()

  const [location, setLocation] = useState("")
  const [status, setStatus] = useState("")
  const [machine_type, setMachineType] = useState("")

  // Check auth on mount
  useEffect(() => {
    Promise.all([isLoggedIn(), checkTestMode()]).then(([loggedIn, isTesting]) => {
      setAuthenticated(loggedIn);
      setTestModeState(isTesting);
      setAuthChecked(true);
    });
  }, []);

  // Override global fetch when test mode is active
  useEffect(() => {
    if (testMode) {
      if (!global._originalFetch) global._originalFetch = global.fetch;
      global.fetch = (url, opts) => mockFetch(url, opts);
    }
    return () => {
      if (global._originalFetch) {
        global.fetch = global._originalFetch;
        delete global._originalFetch;
      }
    };
  }, [testMode]);

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

  // Show loading spinner while checking auth or loading fonts. Proceed once
  // fonts resolve either way (loaded or errored) so a font failure can't
  // brick startup.
  const fontsReady = fontsLoaded || fontError;
  if (!authChecked || !fontsReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ backgroundColor: "#0F1724", flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#2563EA" />
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  // Pre-auth flows (forgot/reset password) must render even when the user
  // isn't logged in — they're reached from the login screen or from an
  // emailed deep link `powermon://resetPassword?code=...`. Render them
  // through the Stack without the topbar/bottombar so the layout doesn't
  // imply they're inside the authenticated app.
  const isAuthFlow = pathname === "/forgotPassword" || pathname === "/resetPassword";

  if (!authenticated && !isAuthFlow) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ backgroundColor: "#0F1724", flex: 1 }}>
          <LoginScreen onLoginSuccess={() => {
            checkTestMode().then(isTesting => {
              setTestModeState(isTesting);
              if (isTesting) resetMockDevices();
            });
            setAuthenticated(true);
          }} />
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  if (isAuthFlow) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ backgroundColor: "#0F1724", flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  const handleLogout = async () => {
    await authLogout();
    await AsyncStorage.removeItem("powermon_notifications_v2");
    setTestModeState(false);
    setAuthenticated(false);
  };

  const handleDeleteAccount = async () => {
    await authDeleteAccount();
    await AsyncStorage.removeItem("powermon_notifications_v2");
    setAuthenticated(false);
  };

  const authContextValue = { logout: handleLogout, deleteAccount: handleDeleteAccount };

  return (
    <AuthProvider value={authContextValue}>
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
    </AuthProvider>
  );
}

function Topbar({ filterOpen, setFilterOpen }) {
  const { mac, id, name } = useGlobalSearchParams();
  const pathname = usePathname()
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);

  // Only fetch device by MAC for /device route, not for /addDevice (which uses machine name)
  const device = useGetDevice(pathname === "/device" ? mac : null);
  const deviceName = pathname === "/device" ? (device?.name || null) : null;
  const vacDevice = useGetVacDevice(pathname === "/vacDevice" ? mac : null);
  const vacDeviceName = pathname === "/vacDevice" ? (vacDevice?.name || null) : null;
  const titles = {
    "/": "Dashboard",
    "/status": "Devices",
    "/manageDevices": "Manage Devices",
    "/addDevice": (typeof mac === "string" && mac.length) ? "Edit Device" : "Add Device",
    "/manageMonitors": "Manage Power Monitors",
    "/addMonitor": (typeof id === "string" && id.length) ? "Edit Power Monitor" : "Add Power Monitor",
    "/menu": "Settings",
    "/mlActivation": "ML Activation",
    "/notifications": "Notifications",
    "/vacStatus": "Vacuum Systems",
    "/manageVacSystems": "Manage Vacuum Systems",
    "/manageVacMonitors": "Manage Vacuum Monitors",
    "/addVacMonitor": (typeof id === "string" && id.length) ? "Edit Vacuum Monitor" : "Add Vacuum Monitor",
    "/addVacSystem": (typeof name === "string" && name.length) ? "Edit Vacuum System" : "Add Vacuum System",
  }

  let title
  if (pathname === "/device" && deviceName) {
    title = deviceName;
  } else if (pathname === "/vacDevice" && vacDeviceName) {
    title = vacDeviceName;
  } else {
  title = titles[pathname] || "App";
  }

  // Show dropdown on add screens (but not edit mode)
  const isAddScreen = (pathname === "/addDevice" && !(typeof mac === "string" && mac.length))
    || (pathname === "/addVacSystem" && !(typeof name === "string" && name.length));

  // Show dropdown on view-switch screens (Devices ↔ Vacuum Systems, Manage Devices ↔ Manage Vacuum Systems)
  const isViewSwitchScreen = ["/status", "/vacStatus", "/manageDevices", "/manageVacSystems"].includes(pathname);

  // View switch dropdown options per screen pair
  const viewSwitchOptions = {
    "/status": [
      { label: "Devices", route: "/status" },
      { label: "Vacuum Systems", route: "/vacStatus" },
    ],
    "/vacStatus": [
      { label: "Devices", route: "/status" },
      { label: "Vacuum Systems", route: "/vacStatus" },
    ],
    "/manageDevices": [
      { label: "Manage Devices", route: "/manageDevices" },
      { label: "Manage Vacuum Systems", route: "/manageVacSystems" },
    ],
    "/manageVacSystems": [
      { label: "Manage Devices", route: "/manageDevices" },
      { label: "Manage Vacuum Systems", route: "/manageVacSystems" },
    ],
  };

  const hasDropdown = isAddScreen || isViewSwitchScreen;
  const dropdownOpen = isAddScreen ? addDropdownOpen : viewDropdownOpen;
  const setDropdownOpen = isAddScreen ? setAddDropdownOpen : setViewDropdownOpen;

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
        alignItems: "center",
        zIndex: 100,
}}
    >
      {(title != "Dashboard") &&(
      <TouchableOpacity style = {topBarStyle} onPress={() => {router.back()}}>
        <BackIcon width = {32} height = {32} stroke="#FFFFFF"/>
      </TouchableOpacity>)}

      <View style = {{...topBarStyle, flex: 1, zIndex: 100}}>
        {hasDropdown ? (
          <TouchableOpacity
            onPress={() => setDropdownOpen(!dropdownOpen)}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <Text style={textStyle}>{title}</Text>
            <Text style={{ color: "#FFFFFF", fontSize: 14, marginLeft: 6, marginBottom: 2 }}>
              {dropdownOpen ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={textStyle}>{title}</Text>
        )}
        {dropdownOpen && isAddScreen && (
          <View style={styles.addDropdown}>
            <TouchableOpacity
              style={styles.addDropdownItem}
              onPress={() => { setAddDropdownOpen(false); router.replace("/addDevice"); }}
            >
              <Text style={[styles.addDropdownText, pathname === "/addDevice" && styles.addDropdownTextActive]}>
                Add Device
              </Text>
            </TouchableOpacity>
            <View style={styles.addDropdownDivider} />
            <TouchableOpacity
              style={styles.addDropdownItem}
              onPress={() => { setAddDropdownOpen(false); router.replace("/addVacSystem"); }}
            >
              <Text style={[styles.addDropdownText, pathname === "/addVacSystem" && styles.addDropdownTextActive]}>
                Add Vacuum System
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {dropdownOpen && isViewSwitchScreen && (
          <View style={styles.addDropdown}>
            {viewSwitchOptions[pathname]?.map((opt, i) => (
              <View key={opt.route}>
                {i > 0 && <View style={styles.addDropdownDivider} />}
                <TouchableOpacity
                  style={styles.addDropdownItem}
                  onPress={() => { setViewDropdownOpen(false); router.replace(opt.route); }}
                >
                  <Text style={[styles.addDropdownText, pathname === opt.route && styles.addDropdownTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
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
  },
  addDropdown: {
    position: "absolute",
    top: 40,
    left: 0,
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 100,
  },
  addDropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  addDropdownText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  addDropdownTextActive: {
    color: "#2563EA",
    fontWeight: "bold",
  },
  addDropdownDivider: {
    height: 1,
    backgroundColor: "#334155",
  },
})