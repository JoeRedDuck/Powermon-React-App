export function byOrder(a, b, order) {
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia !== -1 || ib !== -1) {
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  }
  return a.localeCompare(b);
}

export function sortDevices(devices, TYPE_ORDER, LOCATION_ORDER) {
  return devices.slice().sort((a, b) => {
    const ta = String(a.type || 'Unknown').trim();
    const tb = String(b.type || 'Unknown').trim();
    if (ta !== tb) return byOrder(ta, tb, TYPE_ORDER);

    const la = String(a.location || 'Unknown').trim();
    const lb = String(b.location || 'Unknown').trim();
    if (la !== lb) return byOrder(la, lb, LOCATION_ORDER);

    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

export default sortDevices;
