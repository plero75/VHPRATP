// Inject rendering logic for the new layout
(function(){
  // Fill top alert/news
  async function fillTopBars(){
    try{
      // RER A general message
      const code = 'C01742';
      const stif = `STIF:Line::${code}:`;
      const url = `https://prim.iledefrance-mobilites.fr/marketplace/general-message?LineRef=${encodeURIComponent(stif)}`;
      const res = await fetch(`${PROXY}${encodeURIComponent(url)}`);
      if (res.ok){
        const data = await res.json();
        const info = data?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage?.[0];
        const msg = cleanText(info?.Content?.Message?.[0]?.MessageText?.[0]?.value || '');
        if (msg){ const el=document.getElementById('top-alert'); el.style.display='block'; el.textContent = msg; }
      }
    }catch{}
    try{
      const xml = await fetchText(`${PROXY}${encodeURIComponent(RSS_URL)}`);
      if (xml){
        const doc = new DOMParser().parseFromString(xml,'application/xml');
        const item = doc.querySelector('item > title');
        if (item){ const el=document.getElementById('top-news'); el.style.display='block'; el.textContent = `Fil actu — ${cleanText(item.textContent)}`; }
      }
    }catch{}
  }

  function fmtTime(d){ return new Date(d).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }

  function fillMinutesRow(el, list){
    el.innerHTML='';
    const three = list.slice(0,3);
    three.forEach((v,i)=>{
      const col = makeMinuteCol((v.minutes??0).toString(), fmtTime(v.at||new Date()), (v.minutes!=null && v.minutes<=1));
      el.appendChild(col); if (i<twoSplits(three.length)) insertSplit(el);
    });
    function twoSplits(n){ return Math.max(0, Math.min(2, n-1)); }
  }

  async function renderUpper(){
    // RER minutes (take two next any directions merged)
    const data = await fetchJSON(primUrl('/stop-monitoring',{ MonitoringRef: STOP_IDS.RER_A, LineRef: LINES_SIRI.RER_A }));
    const visits = (data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit||[]).map(v=>{
      const call=v?.MonitoredVehicleJourney?.MonitoredCall||{}; return { minutes: minutesFromISO(call.ExpectedDepartureTime||call.ExpectedArrivalTime), at: call.ExpectedDepartureTime||call.ExpectedArrivalTime };
    }).filter(v=>v.minutes!=null).sort((a,b)=>a.minutes-b.minutes);
    fillMinutesRow(document.getElementById('rer-minutes'), visits);

    // Hippodrome 77
    const hip = await fetchJSON(primUrl('/stop-monitoring',{ MonitoringRef: STOP_IDS.HIPPODROME }));
    const hipv = parseStop(hip).filter(x=>x.minutes!=null).sort((a,b)=>a.minutes-b.minutes);
    fillMinutesRow(document.getElementById('hippo-77-minutes'), hipv);

    // Breuil (77 & 201 merged)
    const br = await fetchJSON(primUrl('/stop-monitoring',{ MonitoringRef: STOP_IDS.BREUIL }));
    const brv = parseStop(br).filter(x=>x.minutes!=null).sort((a,b)=>a.minutes-b.minutes);
    fillMinutesRow(document.getElementById('breuil-minutes'), brv);
  }

  async function renderJoinvilleAllBus(){
    const cont = document.getElementById('joinville-all-bus'); if (!cont) return; cont.innerHTML='';
    const data = await fetchJSON(primUrl('/stop-monitoring',{ MonitoringRef: STOP_IDS.JOINVILLE_BUSES }));
    const visits = parseStop(data);
    // group by line then dest; take 2 minutes
    const byLine = {};
    visits.forEach(v=>{ if(!v.lineId) return; (byLine[v.lineId] ||= []).push(v); });
    Object.entries(byLine).sort(([a],[b])=>a.localeCompare(b)).forEach(([line,rows])=>{
      const byDest = {}; rows.forEach(r=>{ (byDest[r.dest] ||= []).push(r); });
      Object.entries(byDest).forEach(([dest,list])=>{
        const card=document.createElement('div'); card.className='tile';
        const head=document.createElement('div'); head.className='tile-head';
        head.innerHTML = `<span class="pill" data-lineref="${line}">${line}</span><span>${dest}</span>`; card.appendChild(head);
        const mins=document.createElement('div'); mins.className='mins';
        list.filter(x=>x.minutes!=null).sort((a,b)=>a.minutes-b.minutes).slice(0,2).forEach(x=>{
          const m=document.createElement('div'); m.className='min'; m.textContent=`${x.minutes}`; mins.appendChild(m);
        });
        if (mins.children.length===0){ const e=document.createElement('div'); e.className='ended'; e.textContent='Service terminé'; mins.appendChild(e); }
        card.appendChild(mins); cont.appendChild(card);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    fillTopBars(); renderUpper(); renderJoinvilleAllBus();
    setInterval(fillTopBars, 120000);
    setInterval(renderUpper, 60000);
    setInterval(renderJoinvilleAllBus, 60000);
  });
})();
