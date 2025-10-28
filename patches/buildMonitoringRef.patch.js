// Update MonitoringRef format per validated spec: STIF:StopArea:SP:{code}:
function buildMonitoringRef(stopId) {
  // stopId like 'IDFM:70640' -> code = 70640
  const code = stopId.replace('IDFM:', '');
  return `STIF:StopArea:SP:${code}:`;
}
