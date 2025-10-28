// Add DIRECTION headers and minute 'min' labels
(function(){
  function makeMinuteColWithLabel(min, at, imm){
    const wrap = document.createElement('div');
    wrap.className='minute-col';
    const top=document.createElement('div'); top.style.display='flex'; top.style.alignItems='baseline'; top.style.gap='6px';
    const m=document.createElement('div'); m.className='m'; m.textContent=min; top.appendChild(m);
    const l=document.createElement('div'); l.className='label'; l.textContent='min'; top.appendChild(l);
    wrap.appendChild(top);
    const atEl=document.createElement('div'); atEl.className='at'; atEl.textContent=at; wrap.appendChild(atEl);
    if (imm){ const b=document.createElement('div'); b.className='badge-imm'; b.textContent='IMMINENT'; wrap.appendChild(b); }
    return wrap;
  }

  // Monkey patch render-idfm-layout fillMinutesRow if exists
  const prevFill = window.fillMinutesRow;
  window.fillMinutesRow = function(el, list){
    el.innerHTML='';
    const three = list.slice(0,3);
    three.forEach((v,i)=>{
      const at = new Date(v.at||Date.now()).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      const col = makeMinuteColWithLabel((v.minutes??0).toString(), at, (v.minutes!=null && v.minutes<=1));
      el.appendChild(col);
      if (i<Math.max(0,Math.min(2,three.length-1))){ const s=document.createElement('div'); s.className='split'; el.appendChild(s); }
    });
  };

  async function setHeaderFromStop(cardSel, label, stopId, lineRef){
    try{
      const data = await fetchJSON(primUrl('/stop-monitoring',{ MonitoringRef: stopId, LineRef: lineRef }));
      const v = (data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit||[])[0];
      const mv = v?.MonitoredVehicleJourney; const dest = (mv?.DestinationName?.[0]?.value || mv?.DirectionName?.[0]?.value || '').toString();
      if (!dest) return;
      const card = document.querySelector(cardSel); if (!card) return;
      const head = document.createElement('div'); head.className='dir-head';
      head.innerHTML = `<span class="pill">${label}</span><div><div class="dir-meta">DIRECTION</div><div class="dir-title">${dest}</div></div>`;
      const old = card.querySelector('.card-head'); if (old) old.replaceWith(head);
    }catch{}
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(()=>{
      setHeaderFromStop('#card-rer','A', STOP_IDS.RER_A, LINES_SIRI.RER_A);
      setHeaderFromStop('#card-hippo-77','77', STOP_IDS.HIPPODROME);
      setHeaderFromStop('#card-breuil-77201','77', STOP_IDS.BREUIL);
    }, 1000);
    setInterval(()=>{
      setHeaderFromStop('#card-rer','A', STOP_IDS.RER_A, LINES_SIRI.RER_A);
      setHeaderFromStop('#card-hippo-77','77', STOP_IDS.HIPPODROME);
      setHeaderFromStop('#card-breuil-77201','77', STOP_IDS.BREUIL);
    }, 120000);
  });
})();