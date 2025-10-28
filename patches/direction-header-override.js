// Ensure DIRECTION header wins (delayed re-apply) and increase initial delay
(function(){
  function setHeaderFromStop(cardSel, label, stopId, lineRef){
    return (async ()=>{
      try{
        const data = await fetchJSON(primUrl('/stop-monitoring',{ MonitoringRef: stopId, LineRef: lineRef }));
        const v = (data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit||[])[0];
        const mv = v?.MonitoredVehicleJourney; const dest = (mv?.DestinationName?.[0]?.value || mv?.DirectionName?.[0]?.value || '').toString();
        if (!dest) return;
        const card = document.querySelector(cardSel); if (!card) return;
        const head = document.createElement('div'); head.className='dir-head';
        head.innerHTML = `<span class="pill">${label}</span><div><div class="dir-meta">DIRECTION</div><div class="dir-title">${dest}</div></div>`;
        const old = card.querySelector('.card-head, .dir-head'); if (old) old.replaceWith(head); else card.prepend(head);
      }catch{}
    })();
  }

  function applyAll(){
    setHeaderFromStop('#card-rer','A', STOP_IDS.RER_A, LINES_SIRI.RER_A);
    setHeaderFromStop('#card-hippo-77','77', STOP_IDS.HIPPODROME);
    setHeaderFromStop('#card-breuil-77201','77', STOP_IDS.BREUIL);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(applyAll, 1500); // increased
    setTimeout(applyAll, 3000); // second pass to win over other renders
    setInterval(applyAll, 120000);
  });
})();
