// Fusion helpers & modules robustes dans le script principal

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

// ===== Constantes & PROXY =====
const PROXY = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=';
const API_BASE = 'https://prim.iledefrance-mobilites.fr/marketplace';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=48.835&longitude=2.45&current_weather=true';
const RSS_URL = 'https://www.francetvinfo.fr/titres.rss';
const STOP_IDS = {
  RER_A: 'STIF:StopArea:SP:43135:',
  HIPPODROME: 'STIF:StopArea:SP:463641:',
  BREUIL: 'STIF:StopArea:SP:463644:',
  JOINVILLE_BUSES: 'STIF:StopArea:SP:43135:'
};
const LINES_SIRI = {
  RER_A: 'STIF:Line::C01742:',
  BUS_77: 'STIF:Line::C02251:',
  BUS_201: 'STIF:Line::C02251:'
};
const VELIB_STATIONS = { VINCENNES: '12163', BREUIL: '12128' };
function primUrl(path, params = {}) {
  const u = new URL(API_BASE + (path.startsWith('/') ? path : `/${path}`));
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v); });
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

// ===== RER A =====
async function renderRer() {
  const cont = document.getElementById('rer-body');
  if (!cont) return; cont.textContent = 'Chargement…';
  const data = await fetchJSON(primUrl('/stop-monitoring', { MonitoringRef: STOP_IDS.RER_A, LineRef: LINES_SIRI.RER_A }));
  const visits = parseStop(data).slice(0, 6);
  cont.innerHTML = '';
  if (!visits.length) { cont.textContent = 'Aucun passage'; return; }
  for (const v of visits) {
    const row = document.createElement('div'); row.className = 'row';
    const pill = document.createElement('span'); pill.className = 'line-pill rer-a'; pill.textContent = 'A'; row.appendChild(pill);
    const destEl = document.createElement('div'); destEl.className = 'dest'; destEl.textContent = v.dest || '—'; row.appendChild(destEl);
    const timesEl = document.createElement('div'); timesEl.className = 'times'; timesEl.innerHTML = formatTimeBox(v); row.appendChild(timesEl);
    const statusEl = document.createElement('div'); statusEl.className = 'status'; statusEl.innerHTML = renderStatus(v.status, v.minutes); row.appendChild(statusEl);
    cont.appendChild(row);
  }
}

// ===== Bus (par arrêt) =====
async function renderBusForStop(stopId, bodyId, trafficId) {
  const cont = document.getElementById(bodyId);
  const tEl  = document.getElementById(trafficId);
  if (!cont) return; cont.classList.remove('bus-grid'); cont.textContent = 'Chargement…'; if (tEl) { tEl.style.display = 'none'; tEl.className = 'traffic-sub ok'; tEl.textContent = ''; }
  if (!stopId) { cont.innerHTML = '<div class="traffic-sub alert">⚠️ Aucun arrêt configuré</div>'; return; }
  const data = await fetchJSON(primUrl('/stop-monitoring', { MonitoringRef: stopId }));
  const visits = parseStop(data); cont.innerHTML = '';
  if (!visits.length) { cont.innerHTML = '<div class="traffic-sub alert">🚧 Aucun passage prévu</div>'; return; }
  cont.classList.add('bus-grid');
  const byLine = {}; for (const v of visits) (byLine[v.lineId] ||= []).push(v);
  const sortedLines = Object.entries(byLine).sort(([a],[b]) => (a||'').localeCompare(b||''));
  for (const [lineId, rows] of sortedLines) {
    const meta = { code: lineId || '?', color: '#2450a4', textColor: '#fff' };
    const byDest = {}; for (const r of rows) (byDest[r.dest] ||= []).push(r);
    const sortedDest = Object.entries(byDest).sort(([a],[b]) => a.localeCompare(b,'fr',{sensitivity:'base'}));
    for (const [dest, list] of sortedDest) {
      const card = document.createElement('div'); card.className = 'bus-card';
      const header = document.createElement('div'); header.className = 'bus-card-header'; header.innerHTML = `<span class="line-pill" style="background:${meta.color};color:${meta.textColor}">${meta.code}</span> <span class="bus-card-dest">${dest}</span>`; card.appendChild(header);
      const timesEl = document.createElement('div'); timesEl.className = 'times';
      list.sort((a,b)=> (a.minutes??9e9)-(b.minutes??9e9)).slice(0,4).forEach(it => timesEl.insertAdjacentHTML('beforeend', formatTimeBox(it)));
      card.appendChild(timesEl); cont.appendChild(card);
    }
  }
  if (tEl) { tEl.textContent = 'Trafic normal'; tEl.className = 'traffic-sub ok'; tEl.style.display = 'inline-block'; }
}

// ===== Trafic (PRIM + fallback RATP) =====
function summarizeTrafficItem(item) {
  const title = cleanText(item?.title || '');
  const message = cleanText(item?.message || '');
  if (!message || message === title) return title; return `${title} – ${message}`.trim();
}
async function refreshTransitTraffic() {
  const banner = document.getElementById('traffic-banner');
  const rerInfo = document.getElementById('rer-traffic');
  const events = document.getElementById('events-list');
  if (events) events.innerHTML = 'Chargement…';
  try {
    const impacted = []; let appended = false;
    const gmRer = await fetchJSON(primUrl('/general-message', { LineRef: LINES_SIRI.RER_A }));
    const infosRer = gmRer?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
    if (rerInfo) {
      if (infosRer.length) {
        const txt = cleanText(infosRer[0]?.Content?.Message?.[0]?.MessageText?.[0]?.value || infosRer[0]?.Content?.Message?.[0]?.MessageText?.value || '');
        rerInfo.style.display = 'block'; rerInfo.textContent = txt || 'Information trafic disponible'; rerInfo.className = 'traffic-sub alert';
        impacted.push({ label: 'RER A', detail: txt || 'Perturbation' });
      } else { rerInfo.style.display = 'block'; rerInfo.textContent = 'Trafic normal'; rerInfo.className = 'traffic-sub ok'; }
    }
    if (events) events.innerHTML = '';
    for (const [lbl, lineRef] of [['77', LINES_SIRI.BUS_77], ['201', LINES_SIRI.BUS_201]]) {
      const gm = await fetchJSON(primUrl('/general-message', { LineRef: lineRef }));
      const infos = gm?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
      const div = document.createElement('div');
      if (infos.length) {
        const txt = cleanText(infos[0]?.Content?.Message?.[0]?.MessageText?.[0]?.value || infos[0]?.Content?.Message?.[0]?.MessageText?.value || '');
        div.className = 'traffic-sub alert'; div.innerHTML = `<strong>Bus ${lbl}</strong> — ${txt || 'Perturbation'}`;
        impacted.push({ label: `Bus ${lbl}`, detail: txt || 'Perturbation' });
      } else { div.className = 'traffic-sub ok'; div.textContent = `Bus ${lbl} — Trafic normal`; }
      if (events) { events.appendChild(div); appended = true; }
    }
    if (events && !appended) { const div = document.createElement('div'); div.className = 'traffic-sub ok'; div.textContent = 'Trafic normal sur les bus suivis.'; events.appendChild(div); }
    if (banner) {
      if (impacted.length) { const list = impacted.map(i => i.label).join(', '); const detail = impacted[0].detail; banner.textContent = `⚠️ ${list} : ${detail}`; banner.className = 'traffic-banner alert'; }
      else { banner.textContent = '🟢 Trafic normal sur les lignes suivies.'; banner.className = 'traffic-banner ok'; }
    }
    return;
  } catch (e) { console.warn('PRIM general-message indisponible, fallback RATP…', e); }
  try {
    const data = await fetchJSON('https://api-ratp.pierre-grimaud.fr/v4/traffic', 10000);
    const result = data?.result; if (!result) throw new Error('no result');
    const impacted = [];
    const rerA = result.rers?.find(r => r.line === 'A');
    if (rerInfo) {
      if (rerA) { rerInfo.style.display = 'block'; rerInfo.textContent = summarizeTrafficItem(rerA); rerInfo.className = `traffic-sub ${rerA.slug === 'normal' ? 'ok' : 'alert'}`; if (rerA.slug !== 'normal') impacted.push({ label: 'RER A', detail: summarizeTrafficItem(rerA) }); }
      else { rerInfo.style.display = 'none'; }
    }
    const linesToWatch = ['77','201'];
    const busItems = linesToWatch.map(code => result.buses?.find(b => b.line === code)).filter(Boolean);
    if (events) { events.innerHTML = ''; if (!busItems.length) { const div = document.createElement('div'); div.className = 'traffic-sub ok'; div.textContent = 'Aucune information bus.'; events.appendChild(div); } else { let appended = false; busItems.forEach(item => { const div = document.createElement('div'); const alert = item.slug !== 'normal'; div.className = `traffic-sub ${alert ? 'alert' : 'ok'}`; div.innerHTML = `<strong>Bus ${item.line}</strong> — ${summarizeTrafficItem(item)}`; events.appendChild(div); appended = true; if (alert) impacted.push({ label: `Bus ${item.line}`, detail: summarizeTrafficItem(item) }); }); if (!appended) { const div = document.createElement('div'); div.className = 'traffic-sub ok'; div.textContent = 'Trafic normal sur les bus suivis.'; events.appendChild(div); } } }
    if (banner) { if (impacted.length) { const list = impacted.map(i => i.label).join(', '); const detail = impacted[0].detail; banner.textContent = `⚠️ ${list} : ${detail}`; banner.className = 'traffic-banner alert'; } else { banner.textContent = '🟢 Trafic normal sur les lignes suivies.'; banner.className = 'traffic-banner ok'; } }
  } catch (e) {
    console.error('refreshTransitTraffic fallback RATP', e);
    const banner = document.getElementById('traffic-banner'); if (banner) { banner.textContent = '⚠️ Trafic indisponible'; banner.className = 'traffic-banner alert'; }
    const rerInfo = document.getElementById('rer-traffic'); if (rerInfo) rerInfo.style.display = 'none';
    const events = document.getElementById('events-list'); if (events) { events.innerHTML = '<div class="traffic-sub alert">Données trafic indisponibles</div>'; }
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
  const {temperature, weathercode} = data.current_weather; const info = describeWeather(weathercode); const tempStr = `${Math.round(temperature)}°C`;
  if (tempEl) tempEl.textContent = tempStr; if (emojiEl) emojiEl.textContent = info.emoji; if (descEl) descEl.textContent = info.text;
}

// ===== Vélib (Opendata Paris, robuste DNS) =====
async function refreshVelib(){
  await Promise.all(Object.entries(VELIB_STATIONS).map(async ([key, id]) => {
    const el = document.getElementById(`velib-${key.toLowerCase()}`); if (!el) return;
    try {
      const url = `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/records?where=stationcode%3D${id}&limit=1`;
      const data = await fetchJSON(url);
      const st = data?.results?.[0]; if (!st) { el.textContent = 'Indispo'; return; }
      const mech = st.mechanical_bikes || 0; const elec = st.ebike_bikes || 0; const docks = st.numdocksavailable || 0;
      el.textContent = `🚲${mech} 🔌${elec} 🅿️${docks}`;
    } catch(e){ console.error('refreshVelib', key, e); el.textContent = 'Indispo'; }
  }));
}

// ===== News =====
async function refreshNews(){
  const xml = await fetchText(PROXY + encodeURIComponent(RSS_URL));
  let items = [];
  if (xml){
    try{
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      items = [...doc.querySelectorAll('item')].slice(0,5).map(node=>({
        title: cleanText(node.querySelector('title')?.textContent || ''),
        desc: cleanText(node.querySelector('description')?.textContent || '')
      }));
    }catch(e){ console.error('refreshNews', e); }
  }
  const cont = document.getElementById('news-carousel');
  if (!cont) return; cont.innerHTML = '';
  if (!items.length){ cont.textContent = 'Aucune actualité'; return; }
  items.forEach((item, idx)=>{
    const card = document.createElement('div'); card.className = 'news-card' + (idx===0 ? ' active' : '');
    card.innerHTML = `<div>${item.title}</div><div>${item.desc}</div>`; cont.appendChild(card);
  });
}

// ===== Ticker, Horoscope, Saint =====
let tickerIndex = 0; let tickerData = { timeWeather:'', saint:'', horoscope:'', traffic:'' }; let signIdx = 0;
const SIGNS = [{fr:'Bélier',en:'Aries'},{fr:'Taureau',en:'Taurus'},{fr:'Gémeaux',en:'Gemini'},{fr:'Cancer',en:'Cancer'},{fr:'Lion',en:'Leo'},{fr:'Vierge',en:'Virgo'},{fr:'Balance',en:'Libra'},{fr:'Scorpion',en:'Scorpio'},{fr:'Sagittaire',en:'Sagittarius'},{fr:'Capricorne',en:'Capricorn'},{fr:'Verseau',en:'Aquarius'},{fr:'Poissons',en:'Pisces'}];
async function fetchHoroscope(signEn){ try{ const url = `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${signEn}&day=today`; const data = await fetchJSON(PROXY + encodeURIComponent(url)); return data?.data?.horoscope_data || 'Horoscope indisponible.'; }catch{ return 'Horoscope indisponible.'; } }
async function refreshHoroscopeCycle(){ const {fr,en} = SIGNS[signIdx]; const text = await fetchHoroscope(en); tickerData.horoscope = `🔮 ${fr} : ${text}`; signIdx = (signIdx+1)%SIGNS.length; }
async function refreshSaint(){ try{ const data = await fetchJSON('https://nominis.cef.fr/json/nominis.php'); const name = data?.response?.prenoms; tickerData.saint = name ? `🎂 Ste ${name}` : '🎂 Fête du jour'; }catch{ tickerData.saint = '🎂 Fête du jour indisponible'; } }
function updateTicker(){ const slot = document.getElementById('ticker-slot'); if (!slot) return; const clock = `${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`; const entries = [`${clock} • ${tickerData.timeWeather}`]; if (tickerData.saint) entries.push(tickerData.saint); if (tickerData.horoscope) entries.push(tickerData.horoscope); if (tickerData.traffic) entries.push(tickerData.traffic); const pool = entries.filter(Boolean); if (!pool.length){ slot.textContent = 'Chargement…'; return; } slot.textContent = pool[tickerIndex % pool.length]; tickerIndex++; }

// ===== Courses (fallback letrot) =====
async function refreshCourses(){ const cont = document.getElementById('courses-list'); if (!cont) return; cont.textContent = 'Chargement…'; try { const html = await fetchText('https://r.jina.ai/https://www.letrot.com/stats/Evenement/GetEvenements?hippodrome=VINCENNES&startDate=' + new Date().toISOString().slice(0,10) + '&endDate=' + new Date(Date.now()+90*86400000).toISOString().slice(0,10)); const entries = [...html.matchAll(/(\d{1,2} \w+ \d{4}).*?Réunion\s*(\d+)/gis)].map(m=>({date:m[1],reunion:m[2]})); cont.innerHTML=''; if (!entries.length) throw new Error('no entries'); entries.slice(0,4).forEach(({date,reunion})=>{ const div=document.createElement('div'); div.className='traffic-sub ok'; div.textContent=`${date} — Réunion ${reunion}`; cont.appendChild(div); }); } catch(e){ console.warn('refreshCourses', e); cont.innerHTML = '<div class="traffic-sub alert">Programme indisponible. Consultez le site officiel.</div>'; } }

// ===== Boucles =====
function startLoops(){
  setInterval(setClock, 1000);
  setInterval(renderRer, 60000);
  setInterval(()=>renderBusForStop(STOP_IDS.HIPPODROME, 'bus-hippodrome-body', 'bus-hippodrome-traffic'), 60000);
  setInterval(()=>renderBusForStop(STOP_IDS.BREUIL, 'bus-breuil-body', 'bus-breuil-traffic'), 60000);
  setInterval(refreshVelib, 180000);
  setInterval(refreshWeather, 1800000);
  setInterval(refreshNews, 900000);
  setInterval(refreshHoroscopeCycle, 60000);
  setInterval(refreshSaint, 3600000);
  setInterval(refreshTransitTraffic, 120000);
  setInterval(refreshCourses, 900000);
  setInterval(()=>{ updateTicker(); setLastUpdate(); }, 10000);
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async ()=>{
  setClock();
  await Promise.allSettled([
    renderRer(),
    renderBusForStop(STOP_IDS.HIPPODROME, 'bus-hippodrome-body', 'bus-hippodrome-traffic'),
    renderBusForStop(STOP_IDS.BREUIL, 'bus-breuil-body', 'bus-breuil-traffic'),
    refreshVelib(), refreshWeather(), refreshNews(), refreshHoroscopeCycle(), refreshSaint(), refreshTransitTraffic(), refreshCourses()
  ]);
  updateTicker(); setLastUpdate(); startLoops();
});
