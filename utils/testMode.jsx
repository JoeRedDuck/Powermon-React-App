import AsyncStorage from '@react-native-async-storage/async-storage';

const TEST_MODE_KEY = '@powermon_test_mode';

// ---------------------------------------------------------------------------
// Test mode flag helpers
// ---------------------------------------------------------------------------

export async function isTestMode() {
  return (await AsyncStorage.getItem(TEST_MODE_KEY)) === 'true';
}

export async function setTestMode() {
  await AsyncStorage.setItem(TEST_MODE_KEY, 'true');
}

export async function clearTestMode() {
  await AsyncStorage.removeItem(TEST_MODE_KEY);
}

// ---------------------------------------------------------------------------
// In-memory mock device list (mutated by add/edit/delete during the session)
// ---------------------------------------------------------------------------

let mockDevices = buildInitialDevices();
let mockVacSystems = buildInitialVacSystems();
let mockVacMonitors = buildInitialVacMonitors();
let mockVacDevices = buildInitialVacDevices();

function buildInitialDevices() {
  const now = new Date().toISOString();
  const fiveAgo = new Date(Date.now() - 5 * 60000).toISOString();
  const tenAgo  = new Date(Date.now() - 10 * 60000).toISOString();

  return [
    { name: "Condenser 1", mac: "AA:BB:CC:11:22:01", id: 7, status: "online",    last_power: 450,  machine_type: "IPM", location: "Production Line", last_seen: now },
    { name: "Condenser 2", mac: "AA:BB:CC:11:22:02", id: 5, status: "offline",   last_power: null, machine_type: "IPM", location: "Production Line", last_seen: fiveAgo },
    { name: "Condenser 3", mac: "AA:BB:CC:11:22:03", id: 4, status: "offline",   last_power: null, machine_type: "IPM", location: "Production Line", last_seen: tenAgo },
    { name: "Condenser 4", mac: "AA:BB:CC:11:22:04", id: 3, status: "online",    last_power: 380,  machine_type: "IPM", location: "Production Line", last_seen: now },
    { name: "Pump 1",      mac: "AA:BB:CC:11:22:05", id: 1, status: "online",    last_power: 120,  machine_type: "IPM", location: "Production Line", last_seen: now },
    { name: "Pump 2",      mac: "AA:BB:CC:11:22:06", id: 2, status: "low power", last_power: 30,   machine_type: "IPM", location: "Production Line", last_seen: now },
    { name: "Minus 80",    mac: "AA:BB:CC:11:22:07", id: 6, status: "online",    last_power: 1800, machine_type: "IPM", location: "Production Line", last_seen: now },
  ];
}

function buildInitialVacSystems() {
  return [
    { name: "Freeze Dryer 1", location: "Lab A", monitor_count: 1 },
    { name: "Freeze Dryer 2", location: "Lab A", monitor_count: 1 },
    { name: "Freeze Dryer 3", location: "Lab B", monitor_count: 0 },
  ];
}

function buildInitialVacMonitors() {
  return [
    { id: 101, mac: "DD:EE:FF:00:01:01", system_name: "Freeze Dryer 1" },
    { id: 102, mac: "DD:EE:FF:00:01:02", system_name: "Freeze Dryer 2" },
  ];
}

function buildInitialVacDevices() {
  const now = new Date().toISOString();
  const tenAgo = new Date(Date.now() - 10 * 60000).toISOString();
  return [
    {
      name: "Freeze Dryer 1",
      mac: "DD:EE:FF:00:01:01",
      id: 101,
      status: "online",
      last_pressure: 0.794,    // static gauge value in the green zone
      location: "Lab A",
      last_seen: now,
    },
    {
      name: "Freeze Dryer 2",
      mac: "DD:EE:FF:00:01:02",
      id: 102,
      status: "offline",
      last_pressure: null,
      location: "Lab A",
      last_seen: tenAgo,
    },
  ];
}

export function resetMockDevices() {
  mockDevices = buildInitialDevices();
  mockVacSystems = buildInitialVacSystems();
  mockVacMonitors = buildInitialVacMonitors();
  mockVacDevices = buildInitialVacDevices();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function computeStats() {
  const counts = { online: 0, offline: 0, 'low power': 0, 'no power': 0 };
  for (const d of mockDevices) {
    if (counts[d.status] !== undefined) counts[d.status]++;
  }
  return counts;
}

const RANGE_MS = {
  '5m': 5 * 60000, '10m': 10 * 60000, '30m': 30 * 60000,
  '1h': 3600000, '3h': 3 * 3600000, '6h': 6 * 3600000,
  '12h': 12 * 3600000, '24h': 24 * 3600000,
};

function generatePowerPoints(mac, timeRange) {
  const device = mockDevices.find(d => d.mac === mac);
  const basePower = device?.last_power ?? 100;
  const rangeMs = RANGE_MS[timeRange] || 24 * 3600000;

  const numPoints = 50;
  const now = Date.now();
  const step = rangeMs / numPoints;
  const points = [];
  let min = Infinity, max = -Infinity, sum = 0;

  for (let i = 0; i < numPoints; i++) {
    const t = now - rangeMs + i * step;
    const value = Math.max(0, Math.round(basePower + basePower * 0.15 * Math.sin(i * 0.4)));
    points.push({ date: new Date(t).toISOString(), value });
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }

  return { points, min, max, average: Math.round(sum / numPoints) };
}

function generatePressurePoints(mac, timeRange) {
  const device = mockVacDevices.find(d => d.mac === mac);
  // gentle log-ish wobble around the static gauge value
  const base = device?.last_pressure ?? 0.8;
  const rangeMs = RANGE_MS[timeRange] || 24 * 3600000;

  const numPoints = 50;
  const now = Date.now();
  const step = rangeMs / numPoints;
  const points = [];
  let min = Infinity, max = -Infinity, sum = 0;

  for (let i = 0; i < numPoints; i++) {
    const t = now - rangeMs + i * step;
    // ±15% wobble plus a slow trend, clamped to keep it in the green/yellow zones
    const wobble = base * 0.15 * Math.sin(i * 0.35);
    const trend  = base * 0.05 * Math.sin(i * 0.1);
    const value = Math.max(0.1, Number((base + wobble + trend).toFixed(3)));
    points.push({ date: new Date(t).toISOString(), value });
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }

  return {
    points,
    min: Number(min.toFixed(3)),
    max: Number(max.toFixed(3)),
    average: Number((sum / numPoints).toFixed(3)),
  };
}

function vacDeviceStats() {
  const stats = { online: 0, offline: 0, vacuum_loss: 0 };
  for (const d of mockVacDevices) {
    if (d.status === "vacuum loss") stats.vacuum_loss++;
    else if (stats[d.status] !== undefined) stats[d.status]++;
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Mock fetch — pattern-matches URL and returns fake Response
// ---------------------------------------------------------------------------

export function mockFetch(url, options = {}) {
  const urlStr = typeof url === 'string' ? url : url.toString();
  const method = (options.method || 'GET').toUpperCase();
  const urlObj = new URL(urlStr, 'http://mock');
  const path = urlObj.pathname;

  // --- Auth ---
  if (path.includes('/auth/')) {
    return Promise.resolve(jsonResponse({
      access_token: 'test_access_token',
      refresh_token: 'test_refresh_token',
      token_type: 'bearer',
      username: 'tester',
    }));
  }

  // --- Device stats ---
  if (path.endsWith('/device_stats')) {
    return Promise.resolve(jsonResponse(computeStats()));
  }

  // --- Machine types ---
  if (path.endsWith('/machine_types')) {
    const types = [...new Set(mockDevices.map(d => d.machine_type))];
    return Promise.resolve(jsonResponse(types));
  }

  // --- Locations ---
  if (path.endsWith('/locations')) {
    const locs = [...new Set(mockDevices.map(d => d.location))];
    return Promise.resolve(jsonResponse(locs));
  }

  // --- Power data ---
  if (path.endsWith('/power')) {
    const mac = urlObj.searchParams.get('mac');
    const timeRange = urlObj.searchParams.get('time_range') || '24h';
    return Promise.resolve(jsonResponse(generatePowerPoints(mac, timeRange)));
  }

  // --- Monitors ---
  if (path.endsWith('/monitors') && method === 'GET') {
    const monitors = mockDevices.map(d => ({
      id: d.id,
      mac_address: d.mac,
      machine_name: d.name,
    }));
    return Promise.resolve(jsonResponse(monitors));
  }

  // --- Monitor reassign ---
  if (path.match(/\/monitors\/\d+\/reassign/) && method === 'POST') {
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }

  // --- Monitor unassign ---
  if (path.match(/\/monitors\/\d+\/unassign/) && method === 'POST') {
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }

  // --- Single machine by name (for edit form) ---
  if (path.match(/\/machines\//) && method === 'GET') {
    const name = decodeURIComponent(path.split('/machines/')[1]);
    const device = mockDevices.find(d => d.name === name);
    return Promise.resolve(device ? jsonResponse(device) : jsonResponse({ detail: "Not found" }, 404));
  }

  // --- Single device by MAC ---
  if (path.match(/\/devices\//) && method === 'GET') {
    const mac = decodeURIComponent(path.split('/devices/')[1]);
    const device = mockDevices.find(d => d.mac === mac);
    return Promise.resolve(device ? jsonResponse(device) : jsonResponse({ detail: "Not found" }, 404));
  }

  // --- Create device ---
  if (path.endsWith('/devices') && method === 'POST') {
    try {
      const body = JSON.parse(options.body);
      const newDevice = {
        name: body.name || 'New Device',
        mac: body.mac || `AA:BB:CC:${String(Date.now()).slice(-6).match(/.{2}/g).join(':')}`,
        id: body.id || mockDevices.length + 1,
        status: 'online',
        last_power: 0,
        machine_type: body.machine_type || '',
        location: body.location || '',
        last_seen: new Date().toISOString(),
      };
      mockDevices.push(newDevice);
      return Promise.resolve(jsonResponse({ status: "created", device: newDevice }));
    } catch {
      return Promise.resolve(jsonResponse({ detail: "Invalid body" }, 400));
    }
  }

  // --- Update device ---
  if (path.match(/\/devices\//) && method === 'PUT') {
    const mac = decodeURIComponent(path.split('/devices/')[1]);
    const idx = mockDevices.findIndex(d => d.mac === mac);
    if (idx === -1) return Promise.resolve(jsonResponse({ detail: "Not found" }, 404));
    try {
      const body = JSON.parse(options.body);
      if (body.name) mockDevices[idx].name = body.name;
      if (body.machine_type !== undefined) mockDevices[idx].machine_type = body.machine_type;
      if (body.location !== undefined) mockDevices[idx].location = body.location;
      return Promise.resolve(jsonResponse({ status: "updated", device: mockDevices[idx] }));
    } catch {
      return Promise.resolve(jsonResponse({ detail: "Invalid body" }, 400));
    }
  }

  // --- Delete device ---
  if (path.match(/\/devices\//) && method === 'DELETE') {
    const mac = decodeURIComponent(path.split('/devices/')[1]);
    mockDevices = mockDevices.filter(d => d.mac !== mac);
    return Promise.resolve(jsonResponse({ status: "deleted" }));
  }

  // --- Status (device list) ---
  if (path.endsWith('/status') && method === 'GET') {
    let filtered = [...mockDevices];
    const statusFilter = urlObj.searchParams.get('status');
    const locationFilter = urlObj.searchParams.get('location');
    const typeFilter = urlObj.searchParams.get('machine_type');
    if (statusFilter) filtered = filtered.filter(d => d.status === statusFilter);
    if (locationFilter) filtered = filtered.filter(d => d.location === locationFilter);
    if (typeFilter) filtered = filtered.filter(d => d.machine_type === typeFilter);
    return Promise.resolve(jsonResponse(filtered));
  }

  // --- Vacuum: device stats ---
  if (path.endsWith('/vacuum/device_stats')) {
    return Promise.resolve(jsonResponse(vacDeviceStats()));
  }

  // --- Vacuum: status (device list with computed status) ---
  if (path.endsWith('/vacuum/status') && method === 'GET') {
    let filtered = [...mockVacDevices];
    const statusFilter = urlObj.searchParams.get('status');
    const locationFilter = urlObj.searchParams.get('location');
    if (statusFilter) filtered = filtered.filter(d => d.status === statusFilter);
    if (locationFilter) filtered = filtered.filter(d => d.location === locationFilter);
    return Promise.resolve(jsonResponse(filtered));
  }

  // --- Vacuum: pressure data ---
  if (path.endsWith('/vacuum/pressure')) {
    const mac = urlObj.searchParams.get('mac');
    const timeRange = urlObj.searchParams.get('time_range') || '24h';
    return Promise.resolve(jsonResponse(generatePressurePoints(mac, timeRange)));
  }

  // --- Vacuum: single device by MAC ---
  if (path.match(/\/vacuum\/devices\/[^/]+$/) && method === 'GET') {
    const mac = decodeURIComponent(path.split('/vacuum/devices/')[1]);
    const device = mockVacDevices.find(d => d.mac === mac);
    return Promise.resolve(device ? jsonResponse(device) : jsonResponse({ detail: "Not found" }, 404));
  }

  // --- Vacuum: list devices ---
  if (path.endsWith('/vacuum/devices') && method === 'GET') {
    return Promise.resolve(jsonResponse(mockVacDevices));
  }

  // --- Vacuum: systems list/CRUD ---
  if (path.endsWith('/vacuum/systems') && method === 'GET') {
    return Promise.resolve(jsonResponse(mockVacSystems));
  }
  if (path.endsWith('/vacuum/systems') && method === 'POST') {
    try {
      const body = JSON.parse(options.body);
      const newSystem = { name: body.name, location: body.location || '', monitor_count: 0 };
      mockVacSystems.push(newSystem);
      return Promise.resolve(jsonResponse(newSystem));
    } catch {
      return Promise.resolve(jsonResponse({ detail: "Invalid body" }, 400));
    }
  }
  if (path.match(/\/vacuum\/systems\/[^/]+$/) && method === 'PUT') {
    const name = decodeURIComponent(path.split('/vacuum/systems/')[1]);
    const idx = mockVacSystems.findIndex(s => s.name === name);
    if (idx === -1) return Promise.resolve(jsonResponse({ detail: "Not found" }, 404));
    try {
      const body = JSON.parse(options.body);
      if (body.name) mockVacSystems[idx].name = body.name;
      if (body.location !== undefined) mockVacSystems[idx].location = body.location;
      return Promise.resolve(jsonResponse({ status: "updated", system: mockVacSystems[idx] }));
    } catch {
      return Promise.resolve(jsonResponse({ detail: "Invalid body" }, 400));
    }
  }
  if (path.match(/\/vacuum\/systems\/[^/]+$/) && method === 'DELETE') {
    const name = decodeURIComponent(path.split('/vacuum/systems/')[1]);
    mockVacSystems = mockVacSystems.filter(s => s.name !== name);
    return Promise.resolve(jsonResponse({ status: "deleted" }));
  }

  // --- Vacuum: monitors ---
  if (path.endsWith('/vacuum/monitors') && method === 'GET') {
    return Promise.resolve(jsonResponse(mockVacMonitors));
  }
  if (path.endsWith('/vacuum/monitors') && method === 'POST') {
    try {
      const body = JSON.parse(options.body);
      const newMonitor = { id: body.id, mac: body.mac, system_name: body.system_name || null };
      mockVacMonitors.push(newMonitor);
      return Promise.resolve(jsonResponse({ status: "created", monitor: newMonitor }));
    } catch {
      return Promise.resolve(jsonResponse({ detail: "Invalid body" }, 400));
    }
  }
  if (path.match(/\/vacuum\/monitors\/[^/]+$/) && method === 'DELETE') {
    const idStr = decodeURIComponent(path.split('/vacuum/monitors/')[1]);
    mockVacMonitors = mockVacMonitors.filter(m => String(m.id) !== idStr);
    return Promise.resolve(jsonResponse({ status: "deleted" }));
  }
  if (path.match(/\/vacuum\/monitors\/\d+\/reassign/) && method === 'POST') {
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }
  if (path.match(/\/vacuum\/monitors\/\d+\/unassign/) && method === 'POST') {
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }

  // --- Muted machines ---
  if (path.includes('/muted-machines')) {
    if (method === 'GET') return Promise.resolve(jsonResponse({ muted_machines: [] }));
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }

  // --- Notifications: history (must return an array) ---
  if (path.endsWith('/notifications/history') && method === 'GET') {
    return Promise.resolve(jsonResponse([]));
  }
  // --- Notifications: dismiss / dismiss-all / register / preferences / tokens ---
  if (path.includes('/notifications/')) {
    if (method === 'GET') return Promise.resolve(jsonResponse([]));
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }

  // --- Fallback ---
  return Promise.resolve(jsonResponse({ status: "ok" }));
}
