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

export function resetMockDevices() {
  mockDevices = buildInitialDevices();
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

function generatePowerPoints(mac, timeRange) {
  const device = mockDevices.find(d => d.mac === mac);
  const basePower = device?.last_power ?? 100;

  const rangeMs = {
    '5m': 5 * 60000, '10m': 10 * 60000, '30m': 30 * 60000,
    '1h': 3600000, '3h': 3 * 3600000, '6h': 6 * 3600000,
    '12h': 12 * 3600000, '24h': 24 * 3600000,
  }[timeRange] || 24 * 3600000;

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

  // --- Muted machines ---
  if (path.includes('/muted-machines')) {
    if (method === 'GET') return Promise.resolve(jsonResponse({ muted_machines: [] }));
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }

  // --- Notifications ---
  if (path.includes('/notifications/')) {
    if (method === 'GET') return Promise.resolve(jsonResponse({ tokens: [] }));
    return Promise.resolve(jsonResponse({ status: "ok" }));
  }

  // --- Fallback ---
  return Promise.resolve(jsonResponse({ status: "ok" }));
}
