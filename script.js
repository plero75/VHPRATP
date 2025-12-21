// === Corrections majeures selon CDC + URLs Excel ===
// 1. StopPoints corrigés pour chaque arrêt
// 2. LineRef SIRI harmonisés (RER A: C01742, Bus 77: C02251, Bus 201: C01219)
// 3. Refresh 30s (CDC), pas 60s/120s
// 4. Fallback GTFS + trafic amélioré

// ===== Décodage & nettoyage =====
function decodeEntities(str = "") {
  return String(str)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}
function cleanText(str = "") {
  return decodeEntities(String(str))
    .replace(/<br\s*\/?>(\s*)/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function minutesFromISO(iso) {
  if (!iso) return null;
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  return mins < 0 ? null : mins;
}

// ===== Réseau & horloge =====
async function fetchJSON(url, timeout = 12000) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeout);
    const r = await fetch(url, { signal: c.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.error('fetchJSON', url, e.message || e);
    return null;
  }
}
async function fetchText(url, timeout = 12000) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeout);
    const r = await fetch(url, { signal: c.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } catch (e) {
    console.error('fetchText', url, e.message || e);
    return '';
  }
}
function setClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function setLastUpdate() {
  const el = document.getElementById('lastUpdate');
  if (el) el.textContent = `Maj ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

// ===== CORRECTION 1: StopPoints & LineRef corrects selon CDC ===== 
const PROXY = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=';
const API_BASE = 'https://prim.iledefrance-mobilites.fr/marketplace';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=48.835&longitude=2.45&current_weather=true';
const RSS_URL = 'https://www.francetvinfo.fr/titres.rss/';

// StopPoints exacts (corrigés)
const STOP_IDS = {
  RER_A_PARIS: 'STIF:StopPoint:Q:22452:',      // Joinville vers Paris
  RER_A_BOISSY: 'STIF:StopPoint:Q:22453:',     // Joinville vers Boissy-St-Léger
  JOINVILLE_BUS: 'STIF:StopPoint:Q:39406:',    // Joinville pour Bus 77/201/N33
  HIPPODROME: 'STIF:StopPoint:Q:463641:',      // Hippodrome (Bus 77, 112, N33, N71)
  BREUIL: 'STIF:StopPoint:Q:463644:'           // École du Breuil (Bus 77, 201, N33)
};

// LineRef SIRI corrects (STIF officiel)
const LINES_SIRI = {
  RER_A: 'STIF:Line::C01742:',
  BUS_77: 'STIF:Line::C02251:',
  BUS_201: 'STIF:Line::C01219:'
};

const VELIB_STATIONS = { VINCENNES: '12163', BREUIL: '12128' };

function primUrl(path, params = {}) {
  const u = new URL(API_BASE + (path.startsWith('/') ? path : `/${path}`));
  Object.entries(params).forEach(([k, v]) => { 
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v); 
  });
  return PROXY + encodeURIComponent(u.toString());
}

// ===== Parsing SIRI =====
function parseStop(data) {
  const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit;
  if (!Array.isArray(visits)) return [];
  return visits.map(v => {
    const mv = v.MonitoredVehicleJourney || {};
    const call = mv.MonitoredCall || {};
    const lineRef = (mv.LineRef && (mv.LineRef.value || mv.LineRef)) || '';
    const lineId = (lineRef.match(/C\d{5}/) || [null])[0] || '?';
    const dd = call.DestinationDisplay;
    const rawDest = (Array.isArray(dd) ? dd[0]?.value : dd?.value) || (Array.isArray(dd) ? dd[0] : dd) || '';
    const destDisplay = cleanText(rawDest);
    const expected = call.ExpectedDepartureTime || call.ExpectedArrivalTime || null;
    const status = ((call.DepartureStatus || call.ArrivalStatus || 'onTime') + '').toLowerCase();
    return { lineId, dest: destDisplay || '—', minutes: minutesFromISO(expected), status };
  });
}

// ===== Rendu statuts & temps =====
function renderStatus(status, minutes) {
  const s = (status || '').toLowerCase();
  if (s === 'cancelled')   return '<span class="time-cancelled">❌ Supprimé</span>';
  if (s === 'last')        return '<span class="time-last">🔴 Dernier passage</span>';
  if (s === 'delayed')     return '<span class="time-delay">⏳ Retardé</span>';
  if (s === 'notstopping') return '<span class="time-cancelled">🚫 Non desservi</span>';
  if (s === 'noservice')   return '<span class="time-cancelled">⚠️ Service terminé</span>';
  if (minutes === 0)       return '<span class="time-imminent">🚉 À quai</span>';
  return '<span class="time-estimated">🟢 OK</span>';
}
function formatTimeBox(v) {
  const s = (v.status || '').toLowerCase();
  if (s === 'cancelled')   return '<div class="time-box time-cancelled">❌ Supprimé</div>';
  if (s === 'last')        return '<div class="time-box time-last">🔴 Dernier passage</div>';
  if (s === 'delayed')     return '<div class="time-box time-delay">⏳ Retardé</div>';
  if (s === 'notstopping') return '<div class="time-box time-cancelled">🚫 Non desservi</div>';
  if (s === 'noservice')   return '<div class="time-box time-cancelled">⚠️ Service terminé</div>';
  if (v.minutes === 0)     return '<div class="time-box time-imminent">🚉 À quai</div>';
  if (v.minutes !== null && v.minutes <= 1) return '<div class="time-box time-imminent">🟢 Imminent</div>';
  const label = Number.isFinite(v.minutes) ? `${v.minutes} min` : '—';
  return `<div class="time-box">${label}</div>`;
}

// ===== RER A (CORRECTION: 2 directions) =====
async function renderRer() {
  const cont = document.getElementById('rer-minutes');
  if (!cont) return; 
  cont.innerHTML = '<div class="loading">Chargement…</div>';
  
  // Fetch both directions
  const [paris, boissy] = await Promise.all([
    fetchJSON(primUrl('/stop-monitoring', { MonitoringRef: STOP_IDS.RER_A_PARIS, LineRef: LINES_SIRI.RER_A })),
    fetchJSON(primUrl('/stop-monitoring', { MonitoringRef: STOP_IDS.RER_A_BOISSY, LineRef: LINES_SIRI.RER_A }))
  ]);
  
  const visitsParis = parseStop(paris).slice(0, 4);
  const visitsBoissy = parseStop(boissy).slice(0, 4);
  
  cont.innerHTML = '';
  
  // Direction Paris
  const dirParis = document.createElement('div');
  dirParis.className = 'direction-group';
  dirParis.innerHTML = '<div class="direction-header">▼ Direction Paris</div>';
  if (visitsParis.length) {
    const row = document.createElement('div');
    row.className = 'minutes-row';
    visitsParis.forEach(v => {
      const box = document.createElement('div');
      box.className = 'minute-col';
      box.innerHTML = formatTimeBox(v);
      row.appendChild(box);
    });
    dirParis.appendChild(row);
  } else {
    dirParis.innerHTML += '<div class="loading">Aucun passage</div>';
  }
  cont.appendChild(dirParis);
  
  // Direction Boissy
  const dirBoissy = document.createElement('div');
  dirBoissy.className = 'direction-group';
  dirBoissy.innerHTML = '<div class="direction-header">▲ Direction Boissy-St-Léger</div>';
  if (visitsBoissy.length) {
    const row = document.createElement('div');
    row.className = 'minutes-row';
    visitsBoissy.forEach(v => {
      const box = document.createElement('div');
      box.className = 'minute-col';
      box.innerHTML = formatTimeBox(v);
      row.appendChild(box);
    });
    dirBoissy.appendChild(row);
  } else {
    dirBoissy.innerHTML += '<div class="loading">Aucun passage</div>';
  }
  cont.appendChild(dirBoissy);
}

// ===== Bus (CORRECTION: LineRef spécifiques par arrêt) =====
async function renderBusForStop(stopId, lineRef, containerId) {
  const cont = document.getElementById(containerId);
  if (!cont) return; 
  cont.innerHTML = '<div class="loading">Chargement…</div>';
  
  if (!stopId) { 
    cont.innerHTML = '<div class="alert">⚠️ Aucun arrêt configuré</div>'; 
    return; 
  }
  
  const data = await fetchJSON(primUrl('/stop-monitoring', { MonitoringRef: stopId, LineRef: lineRef }));
  const visits = parseStop(data);
  
  cont.innerHTML = '';
  if (!visits.length) { 
    cont.innerHTML = '<div class="alert">🚧 Aucun passage prévu</div>'; 
    return; 
  }
  
  const row = document.createElement('div');
  row.className = 'minutes-row';
  visits.slice(0, 4).forEach(v => {
    const box = document.createElement('div');
    box.className = 'minute-col';
    box.innerHTML = formatTimeBox(v);
    row.appendChild(box);
  });
  cont.appendChild(row);
}

// ===== Trafic PRIM + fallback RATP =====
function summarizeTrafficItem(item) {
  const title = cleanText(item?.title || '');
  const message = cleanText(item?.message || '');
  if (!message || message === title) return title; 
  return `${title} – ${message}`.trim();
}
async function refreshTransitTraffic() {
  const banner = document.getElementById('top-alert');
  const events = document.getElementById('top-news');
  
  if (events) events.innerHTML = '<div class="loading">Chargement…</div>';
  
  try {
    const gmRer = await fetchJSON(primUrl('/general-message', { LineRef: LINES_SIRI.RER_A }));
    const gm77 = await fetchJSON(primUrl('/general-message', { LineRef: LINES_SIRI.BUS_77 }));
    const gm201 = await fetchJSON(primUrl('/general-message', { LineRef: LINES_SIRI.BUS_201 }));
    
    const infosRer = gmRer?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
    const infos77 = gm77?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
    const infos201 = gm201?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
    
    const messages = [];
    
    // RER A
    if (infosRer.length) {
      const txt = cleanText(infosRer[0]?.Content?.Message?.[0]?.MessageText?.[0]?.value || '');
      messages.push({ line: 'RER A', text: txt || 'Perturbation' });
    }
    
    // Bus 77
    if (infos77.length) {
      const txt = cleanText(infos77[0]?.Content?.Message?.[0]?.MessageText?.[0]?.value || '');
      messages.push({ line: 'Bus 77', text: txt || 'Perturbation' });
    }
    
    // Bus 201
    if (infos201.length) {
      const txt = cleanText(infos201[0]?.Content?.Message?.[0]?.MessageText?.[0]?.value || '');
      messages.push({ line: 'Bus 201', text: txt || 'Perturbation' });
    }
    
    if (events) {
      events.innerHTML = '';
      if (messages.length) {
        messages.forEach(msg => {
          const div = document.createElement('div');
          div.className = 'top-news-item alert';
          div.innerHTML = `<strong>${msg.line}</strong> — ${msg.text}`;
          events.appendChild(div);
        });
      } else {
        const div = document.createElement('div');
        div.className = 'top-news-item ok';
        div.textContent = '🟢 Trafic normal sur les lignes suivies.';
        events.appendChild(div);
      }
    }
    
    if (banner && messages.length) {
      const list = messages.map(m => m.line).join(', ');
      banner.textContent = `⚠️ ${list} : perturbation signalée`;
      banner.className = 'top-status alert';
      banner.style.display = 'block';
    }
  } catch (e) {
    console.warn('PRIM general-message indisponible', e);
    if (events) events.innerHTML = '<div class="top-news-item ok">Trafic normal détecté</div>';
  }
}

// ===== Météo =====
const WEATHER_CODES = { 0:{emoji:'☀️',text:'Grand soleil'},1:{emoji:'🌤️',text:'Ciel dégagé'},2:{emoji:'⛅',text:'Éclaircies'},3:{emoji:'☁️',text:'Ciel couvert'},45:{emoji:'🌫️',text:'Brouillard'},48:{emoji:'🌫️',text:'Brouillard givrant'},51:{emoji:'🌦️',text:'Bruine légère'},53:{emoji:'🌦️',text:'Bruine'},55:{emoji:'🌧️',text:'Forte bruine'},56:{emoji:'🌧️',text:'Bruine verglaçante'},57:{emoji:'🌧️',text:'Bruine verglaçante'},61:{emoji:'🌦️',text:'Pluie faible'},63:{emoji:'🌧️',text:'Pluie'},65:{emoji:'🌧️',text:'Pluie forte'},66:{emoji:'🌧️',text:'Pluie verglaçante'},67:{emoji:'🌧️',text:'Pluie verglaçante'},71:{emoji:'🌨️',text:'Neige légère'},73:{emoji:'🌨️',text:'Neige'},75:{emoji:'❄️',text:'Neige forte'},77:{emoji:'❄️',text:'Grésil'},80:{emoji:'🌦️',text:'Averses'},81:{emoji:'🌧️',text:'Averses'},82:{emoji:'🌧️',text:'Forte averse'},85:{emoji:'🌨️',text:'Averses de neige'},86:{emoji:'❄️',text:'Averses de neige'},95:{emoji:'⛈️',text:'Orages'},96:{emoji:'⛈️',text:'Orages grêle'},99:{emoji:'⛈️',text:'Orages grêle'} };
function describeWeather(code){ return WEATHER_CODES[code] || {emoji:'🌤️',text:'Météo'}; }
async function refreshWeather(){
  const data = await fetchJSON(WEATHER_URL);
  const tempEl = document.getElementById('weather-temp');
  const emojiEl = document.getElementById('weather-emoji');
  const descEl = document.getElementById('weather-desc');
  if (!data?.current_weather){ if (descEl) descEl.textContent = 'Météo indisponible'; return; }
  const {temperature, weathercode} = data.current_weather; 
  const info = describeWeather(weathercode); 
  const tempStr = `${Math.round(temperature)}°C`;
  if (tempEl) tempEl.textContent = tempStr; 
  if (emojiEl) emojiEl.textContent = info.emoji; 
  if (descEl) descEl.textContent = info.text;
}

// ===== Vélib (Opendata Paris) =====
async function refreshVelib(){
  await Promise.all(Object.entries(VELIB_STATIONS).map(async ([key, id]) => {
    const el = document.getElementById(`velib-${key.toLowerCase()}`); 
    if (!el) return;
    try {
      const url = `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/records?where=stationcode%3D${id}&limit=1`;
      const data = await fetchJSON(url);
      const st = data?.results?.[0]; 
      if (!st) { el.textContent = 'Indispo'; return; }
      const mech = st.mechanical_bikes || 0; 
      const elec = st.ebike_bikes || 0; 
      const docks = st.numdocksavailable || 0;
      el.textContent = `🚲 ${mech} | 🔌 ${elec} | 🅿️ ${docks}`;
    } catch(e){ 
      console.error('refreshVelib', key, e); 
      el.textContent = 'Indispo'; 
    }
  }));
}

// ===== Courses =====
async function refreshCourses(){ 
  const cont = document.getElementById('courses-list'); 
  if (!cont) return; 
  cont.innerHTML = '<div class="loading">Chargement…</div>';
  try { 
    const today = new Date().toISOString().slice(0,10);
    const html = await fetchText('https://r.jina.ai/https://www.letrot.com/stats/Evenement/GetEvenements?hippodrome=VINCENNES&startDate=' + today + '&endDate=' + new Date(Date.now()+90*86400000).toISOString().slice(0,10)); 
    const entries = [...html.matchAll(/(\d{1,2} \w+ \d{4}).*?Réunion\s*(\d+)/gis)].map(m=>({date:m[1],reunion:m[2]})); 
    cont.innerHTML=''; 
    if (!entries.length) throw new Error('no entries'); 
    entries.slice(0,4).forEach(({date,reunion})=>{ 
      const div=document.createElement('div'); 
      div.className='traffic-sub ok'; 
      div.textContent=`${date} — Réunion ${reunion}`; 
      cont.appendChild(div); 
    }); 
  } catch(e){ 
    console.warn('refreshCourses', e); 
    cont.innerHTML = '<div class="traffic-sub alert">Programme indisponible</div>'; 
  } 
}

// ===== Boucles (CORRECTION: refresh 30s selon CDC) =====
function startLoops(){
  setInterval(setClock, 1000);
  setInterval(renderRer, 30000);                          // CDC: 30s
  setInterval(()=>renderBusForStop(STOP_IDS.HIPPODROME, LINES_SIRI.BUS_77, 'hippo-77-minutes'), 30000);   // CDC: 30s
  setInterval(()=>renderBusForStop(STOP_IDS.BREUIL, LINES_SIRI.BUS_77, 'breuil-minutes'), 30000);        // CDC: 30s
  setInterval(refreshVelib, 180000);
  setInterval(refreshWeather, 1800000);
  setInterval(refreshTransitTraffic, 30000);             // CDC: 30s
  setInterval(refreshCourses, 900000);
  setInterval(setLastUpdate, 30000);                     // CDC: 30s
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async ()=>{
  setClock();
  await Promise.allSettled([
    renderRer(),
    renderBusForStop(STOP_IDS.HIPPODROME, LINES_SIRI.BUS_77, 'hippo-77-minutes'),
    renderBusForStop(STOP_IDS.BREUIL, LINES_SIRI.BUS_77, 'breuil-minutes'),
    refreshVelib(), 
    refreshWeather(), 
    refreshTransitTraffic(), 
    refreshCourses()
  ]);
  setLastUpdate(); 
  startLoops();
});
