import { router, Stack, useGlobalSearchParams, usePathname } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BackIcon from "../assets/icons/arrow-left.svg";
import DevicesIcon from "../assets/icons/grid.svg";
import HomeIcon from "../assets/icons/home.svg";
import MenuIcon from "../assets/icons/menu.svg";
import AddDeviceIcon from "../assets/icons/plus-circle.svg";
import ManageDevicesIcon from "../assets/icons/settings.svg";
import FilterIcon from "../assets/icons/sliders.svg";

export default function RootLayout() {
  return (
    <SafeAreaView style={{ backgroundColor: "#0F1724", flex: 1 }}>
      <Topbar />
      <Stack screenOptions={{ headerShown: false }} />
      <Bottombar />
    </SafeAreaView>
  );
}

function Topbar() {
  const filterOpen = false;
  const filterOptions = {}
  const { mac } = useGlobalSearchParams();

  const titles = {
    "/": "Dashboard",
    "/status": "Devices",
    "/manageDevices": "Manage Devices",
    "/addDevice": (typeof mac === "string" && mac.length) ? "Edit Device" : "Add Device",
    "/menu": "Menu"
  }

  const title = titles[usePathname()] || "App";

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

    {(title == "Devices") &&(
    <TouchableOpacity style = {topBarStyle} onPress={() => {router.back()}}>
      <FilterIcon width = {28} height = {28} stroke="#FFFFFF"/>
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

      <TouchableOpacity style = {iconBoxStyle} onPress={() => router.push("/status")}>
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