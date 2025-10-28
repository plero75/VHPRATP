// Apply MonitoringRef format switch in main script.js
// Replaces buildMonitoringRef to return STIF:StopArea:SP:{code}:
(function(){
  const original = window.buildMonitoringRef;
  window.buildMonitoringRef = function(stopId){
    const code = (stopId||'').replace('IDFM:','');
    return `STIF:StopArea:SP:${code}:`;
  }
})();
