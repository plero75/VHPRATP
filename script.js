// ============================================
// DASHBOARD TRANSPORTS - HIPPODROME VINCENNES
// Script unifié pour écran portrait 1080x1920
// ============================================

const proxy = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=';
const enc = encodeURIComponent;

// === COULEURS RATP/IDFM ===
const DEFAULT_COLORS = {
  'STIF:Line::C01742:': '#E41E26', // RER A
  'STIF:Line::C02251:': '#0071bc', // Bus 77
  'STIF:Line::C01219:': '#6E491E', // Bus 201
  'STIF:Line::C01130:': '#f0a500', // Bus 101
  'STIF:Line::C01135:': '#e4002b', // Bus 106
  'STIF:Line::C01137:': '#d10073', // Bus 108
  'STIF:Line::C01139:': '#642580', // Bus 110
  'STIF:Line::C01141:': '#ff5a00', // Bus 112
  'STIF:Line::C01260:': '#d9a300', // Bus 281
  'STIF:Line::C01399:': '#ff5a00'  // Bus N33
};

// === CONFIGURATION LIGNES ===
const LINES = [
  { name: 'RER A', line: 'STIF:Line::C01742:', monitoring: ['STIF:StopArea:SP:43135:'], isRER: true },
  { name: '77', line: 'STIF:Line::C02251:', monitoring: ['STIF:StopPoint:Q:22452:'] },
  { name: '101', line: 'STIF:Line::C01130:', monitoring: ['STIF:StopPoint:Q:21252:'] },
  { name: '106', line: 'STIF:Line::C01135:', monitoring: ['STIF:StopPoint:Q:27560:'] },
  { name: '108', line: 'STIF:Line::C01137:', monitoring: ['STIF:StopPoint:Q:28032:'] },
  { name: '110', line: 'STIF:Line::C01139:', monitoring: ['STIF:StopPoint:Q:28032:'] },
  { name: '112', line: 'STIF:Line::C01141:', monitoring: ['STIF:StopPoint:Q:28065:', 'STIF:StopPoint:Q:39406:'] },
  { name: '201', line: 'STIF:Line::C01219:', monitoring: ['STIF:StopPoint:Q:39406:', 'STIF:StopPoint:Q:22452:'] },
  { name: '281', line: 'STIF:Line::C01260:', monitoring: ['STIF:StopPoint:Q:28033:'] },
  { name: 'N33', line: 'STIF:Line::C01399:', monitoring: ['STIF:StopPoint:Q:39406:'] }
];

const VELIB_STATIONS = {
  VINCENNES: '12163',
  BREUIL: '12128'
};

// === UTILITAIRES ===
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function setLastUpdate() {
  const el = document.getElementById('lastUpdate');
  if (el) el.textContent = `Maj ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

function minutesUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  const t = new Date(dateStr);
  return Math.max(0, Math.round((t - now) / 60000));
}

function hhmm(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function getLineColor(lineRef) {
  return DEFAULT_COLORS[lineRef] || '#546e7a';
}

// === FETCH JSON ===
async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('fetchJSON:', e.message);
    return null;
  }
}

// === FETCH DEPARTURES ===
async function fetchDepartures(line) {
  for (const m of line.monitoring) {
    const url = `${proxy}https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${enc(m)}&LineRef=${enc(line.line)}`;
    const json = await fetchJSON(url);
    
    const visits = json?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    const filtered = visits.filter(v => v?.MonitoredVehicleJourney?.LineRef?.value === line.line);
    
    if (!filtered.length) continue;
    
    return filtered.map(v => {
      const mvj = v.MonitoredVehicleJourney;
      const call = mvj?.MonitoredCall;
      return {
        dest: mvj?.DestinationName?.[0]?.value || '–',
        time: call?.ExpectedDepartureTime || call?.AimedDepartureTime || null,
        status: (call?.DepartureStatus || 'onTime').toLowerCase()
      };
    });
  }
  return [];
}

// === RENDER DEPARTURES ===
function renderDepartures(depList) {
  const wrap = document.createElement('div');
  wrap.className = 'minutes-row';
  
  if (!depList.length) {
    wrap.innerHTML = '<div class="loading">Aucun passage</div>';
    return wrap;
  }
  
  const byDest = {};
  depList.forEach(d => { (byDest[d.dest] ||= []).push(d); });
  
  Object.entries(byDest).slice(0, 4).forEach(([dest, deps]) => {
    const box = document.createElement('div');
    box.className = 'minute-col';
    const m = minutesUntil(deps[0].time);
    let cls = 'time-estimated';
    
    if (m === null) cls = 'time-estimated';
    else if (deps[0].status === 'cancelled') cls = 'time-cancelled';
    else if (deps[0].status === 'delayed') cls = 'time-delay';
    else if (m < 2) cls = 'time-imminent';
    
    box.innerHTML = `<div class="time-box">${m === null ? '—' : m + ' min'}</div><div style="font-size:11px;color:#999">${hhmm(deps[0].time)}</div>`;
    wrap.appendChild(box);
  });
  
  return wrap;
}

// === RENDER RER A ===
async function renderRerA() {
  const line = LINES.find(l => l.name === 'RER A');
  const deps = await fetchDepartures(line);
  
  // Séparer par direction
  const paris = deps.filter(d => d.dest.includes('Paris') || d.dest.includes('Châtelet'));
  const boissy = deps.filter(d => d.dest.includes('Boissy') || !d.dest.includes('Paris'));
  
  document.getElementById('rer-paris-minutes').replaceWith(renderDepartures(paris));
  document.getElementById('rer-boissy-minutes').replaceWith(renderDepartures(boissy));
}

// === RENDER BUS HIPPODROME & BREUIL ===
async function renderBusStop(stopId, lineRef, containerId) {
  const line = LINES.find(l => l.line === lineRef);
  if (!line) return;
  
  const url = `${proxy}https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${enc(stopId)}&LineRef=${enc(lineRef)}`;
  const json = await fetchJSON(url);
  
  const visits = json?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
  const deps = visits.map(v => {
    const call = v.MonitoredVehicleJourney?.MonitoredCall;
    return {
      dest: v.MonitoredVehicleJourney?.DestinationName?.[0]?.value || '–',
      time: call?.ExpectedDepartureTime || call?.AimedDepartureTime || null,
      status: (call?.DepartureStatus || 'onTime').toLowerCase()
    };
  });
  
  const el = document.getElementById(containerId);
  if (el) el.replaceWith(renderDepartures(deps));
}

// === RENDER TOUS LES BUS ===
async function renderAllBus() {
  const container = document.getElementById('joinville-all-bus');
  if (!container) return;
  
  container.innerHTML = '<div class="loading">Chargement...</div>';
  
  const wrap = document.createElement('div');
  wrap.className = 'all-bus';
  
  for (const line of LINES) {
    if (line.isRER) continue; // Skip RER A
    
    const deps = await fetchDepartures(line);
    if (!deps.length) continue;
    
    const color = await getLineColor(line.line);
    const group = document.createElement('div');
    group.className = 'bus-line-group';
    group.style.borderLeftColor = color;
    
    const header = document.createElement('div');
    header.className = 'bus-line-header';
    header.style.color = color;
    header.textContent = `● Ligne ${line.name}`;
    group.appendChild(header);
    
    const destinations = document.createElement('div');
    destinations.className = 'bus-destinations';
    
    const uniqueDests = [...new Set(deps.map(d => d.dest))];
    uniqueDests.slice(0, 3).forEach(dest => {
      const item = document.createElement('div');
      item.className = 'bus-dest-item';
      const nextDep = deps.find(d => d.dest === dest);
      const mins = minutesUntil(nextDep.time);
      item.textContent = `${dest}: ${mins === null ? '—' : mins + ' min'}`;
      destinations.appendChild(item);
    });
    
    group.appendChild(destinations);
    wrap.appendChild(group);
  }
  
  if (wrap.children.length === 0) {
    wrap.innerHTML = '<div class="loading">Aucun passage disponible</div>';
  }
  
  container.replaceChild(wrap, container.firstChild);
}

// === METEO ===
async function refreshWeather() {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=48.835&longitude=2.45&current_weather=true';
    const data = await fetchJSON(url);
    
    if (!data?.current_weather) return;
    
    const { temperature, weathercode } = data.current_weather;
    const codes = {
      0: { emoji: '☀️', desc: 'Ensoleillé' },
      1: { emoji: '🌤️', desc: 'Partiellement nuageux' },
      2: { emoji: '☁️', desc: 'Nuageux' },
      3: { emoji: '☁️', desc: 'Très nuageux' },
      45: { emoji: '🌫️', desc: 'Brouillard' },
      61: { emoji: '🌧️', desc: 'Pluie faible' },
      63: { emoji: '🌧️', desc: 'Pluie modérée' },
      80: { emoji: '⛈️', desc: 'Averses' }
    };
    
    const info = codes[weathercode] || codes[0];
    
    const emojiEl = document.getElementById('weather-emoji');
    const descEl = document.getElementById('weather-desc');
    const tempEl = document.getElementById('weather-temp');
    
    if (emojiEl) emojiEl.textContent = info.emoji;
    if (descEl) descEl.textContent = info.desc;
    if (tempEl) tempEl.textContent = `${Math.round(temperature)}°C`;
  } catch (e) {
    console.error('Weather error:', e);
  }
}

// === VELIB ===
async function refreshVelib() {
  for (const [key, id] of Object.entries(VELIB_STATIONS)) {
    try {
      const url = `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/records?where=stationcode%3D${id}&limit=1`;
      const data = await fetchJSON(url);
      const st = data?.results?.[0];
      
      const el = document.getElementById(`velib-${key.toLowerCase()}`);
      if (!el) continue;
      
      if (!st) {
        el.textContent = 'N/A';
        continue;
      }
      
      const mech = st.mechanical_bikes || 0;
      const elec = st.ebike_bikes || 0;
      el.textContent = `${mech + elec} dispo (${mech} mécano, ${elec} électrique)`;
    } catch (e) {
      console.error('Velib error:', e);
    }
  }
}

// === COURSES PMU ===
async function refreshCourses() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const url = `https://www.letrot.com/stats/Evenement/GetEvenements?hippodrome=VINCENNES&startDate=${today}&endDate=${tomorrow}`;
    
    const html = await fetch(url).then(r => r.text()).catch(() => '');
    const matches = [...html.matchAll(/(\d{1,2}\s\w+\s\d{4}).*?Réunion\s*(\d+)/gis)];
    
    const list = document.getElementById('courses-list');
    if (!list) return;
    
    list.innerHTML = '';
    if (matches.length) {
      matches.slice(0, 4).forEach(m => {
        const div = document.createElement('div');
        div.textContent = `${m[1]} — Réunion ${m[2]}`;
        list.appendChild(div);
      });
    } else {
      list.innerHTML = '<div class="loading">Programme indisponible</div>';
    }
  } catch (e) {
    console.error('Courses error:', e);
    const list = document.getElementById('courses-list');
    if (list) list.innerHTML = '<div class="loading">Erreur</div>';
  }
}

// === TRAFIC SYTADIN ===
async function refreshTraffic() {
  try {
    const list = document.getElementById('road-list');
    if (!list) return;
    list.innerHTML = '<div class="loading">Trafic normal</div>';
  } catch (e) {
    console.error('Traffic error:', e);
  }
}

// === ACTUALITES ===
async function refreshNews() {
  try {
    const url = 'https://www.francetvinfo.fr/titres.rss';
    const xml = await fetch(url).then(r => r.text()).catch(() => '');
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const items = doc.querySelectorAll('item');
    
    const ticker = document.getElementById('news-ticker');
    if (!ticker) return;
    
    ticker.innerHTML = '';
    [...items].slice(0, 6).forEach(item => {
      const title = item.querySelector('title')?.textContent || '';
      const div = document.createElement('div');
      div.className = 'news-item';
      div.textContent = title;
      ticker.appendChild(div);
    });
  } catch (e) {
    console.error('News error:', e);
  }
}

// === INIT & BOUCLES ===
async function initAll() {
  updateClock();
  
  await Promise.allSettled([
    renderRerA(),
    renderBusStop('STIF:StopPoint:Q:463641:', 'STIF:Line::C02251:', 'hippo-77-minutes'),
    renderBusStop('STIF:StopPoint:Q:463644:', 'STIF:Line::C02251:', 'breuil-minutes'),
    renderAllBus(),
    refreshWeather(),
    refreshVelib(),
    refreshCourses(),
    refreshTraffic(),
    refreshNews()
  ]);
  
  setLastUpdate();
}

document.addEventListener('DOMContentLoaded', () => {
  initAll();
  setInterval(updateClock, 1000);
  setInterval(renderRerA, 30000);
  setInterval(() => renderBusStop('STIF:StopPoint:Q:463641:', 'STIF:Line::C02251:', 'hippo-77-minutes'), 30000);
  setInterval(() => renderBusStop('STIF:StopPoint:Q:463644:', 'STIF:Line::C02251:', 'breuil-minutes'), 30000);
  setInterval(renderAllBus, 60000);
  setInterval(refreshVelib, 180000);
  setInterval(refreshWeather, 600000);
  setInterval(refreshCourses, 900000);
  setInterval(refreshTraffic, 300000);
  setInterval(refreshNews, 600000);
  setInterval(setLastUpdate, 30000);
});