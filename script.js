// Dashboard Transports - Hippodrome de Vincennes
// Patched for robustness: proxy encoding, MonitoringRef format, GBFS discovery, PMU date

const CONFIG = {
  STOPS: {
    RER_A: { id: 'IDFM:70640', name: 'Joinville-le-Pont', line: 'line:IDFM:C01742', type: 'rer' },
    BUS_77: { id: 'IDFM:463641', name: 'Hippodrome de Vincennes', line: 'line:IDFM:C02251', type: 'bus' },
    BUS_201: { id: 'IDFM:463644', name: 'École du Breuil', line: 'line:IDFM:C02251', type: 'bus' }
  },
  VELIB_STATIONS: ['12163', '12128'],
  PROXY_PRIM: 'https://ratp-proxy.hippodrome-proxy42.workers.dev',
  WEATHER_API: 'https://api.open-meteo.com/v1/forecast?latitude=48.835&longitude=2.44&current_weather=true&hourly=temperature_2m,weathercode&timezone=Europe/Paris',
  RSS_FRANCEINFO: 'https://www.francetvinfo.fr/titres.rss',
  PMU_API: 'https://offline.turfinfo.api.pmu.fr/rest/client/7/programme',
  REFRESH: {
    STOP_MONITORING: 30000,
    GENERAL_MESSAGE: 120000,
    VELIB: 30000,
    WEATHER: 600000,
    NEWS: 3600000,
    COURSES: 600000
  }
};

let gtfsData = {};
let refreshIntervals = {};

// Use single encoding at call site only
function safeFetch(rawUrl) {
  // Encode once here; Worker must decode exactly once
  return fetch(`${CONFIG.PROXY_PRIM}/?url=${encodeURIComponent(rawUrl)}`);
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function getMinutesRemaining(targetTime) {
  const now = new Date();
  const target = new Date(targetTime);
  return Math.floor((target - now) / 60000);
}
function parseTime(timeStr) {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  return h * 60 + m;
}

function getDepartureState(departure, gtfsLastTimes) {
  const call = departure.MonitoredVehicleJourney?.MonitoredCall || {};
  const aimed = new Date(call.AimedDepartureTime);
  const expected = new Date(call.ExpectedDepartureTime || call.AimedDepartureTime);
  const minutesRemaining = getMinutesRemaining(expected);

  if (departure.MonitoredVehicleJourney?.Cancellation) {
    return { priority: 1, state: 'supprime', badge: 'supprimé' };
  }
  if (expected > aimed) {
    const delayMin = Math.floor((expected - aimed) / 60000);
    return { priority: 4, state: 'delayed', badge: `+${delayMin} min`, delay: delayMin };
  }
  if (minutesRemaining < 2) {
    return { priority: 5, state: 'imminent', badge: 'imminent' };
  }
  const aimedTimeStr = formatTime(aimed);
  if (gtfsLastTimes && (aimedTimeStr === gtfsLastTimes.dirA_last || aimedTimeStr === gtfsLastTimes.dirB_last)) {
    return { priority: 6, state: 'normal', badge: 'dernier' };
  }
  return { priority: 6, state: 'normal', badge: null };
}

function updateClock() {
  const el = document.getElementById('horloge');
  if (el) el.textContent = formatTime(new Date());
}

async function loadGTFSData() {
  try {
    const v = new Date().toISOString().slice(0, 13).replace(/[-T:]/g, '');
    const res = await fetch(`static/horaires_export.json?v=${v}`);
    gtfsData = await res.json();
  } catch (e) {
    gtfsData = {};
  }
}

function buildMonitoringRef(stopId) {
  // stopId is like 'IDFM:70640' -> MonitoringRef expects 'IDFM:StopArea:70640'
  const raw = stopId.replace('IDFM:', '');
  return `IDFM:StopArea:${raw}`;
}

async function fetchTransport(stopConfig, elementId) {
  const container = document.getElementById(`${elementId}-departs`);
  const alertBanner = document.getElementById(`${elementId}-alert`);
  const servedStops = document.getElementById(`${elementId}-stops`);
  try {
    const monitoringRef = buildMonitoringRef(stopConfig.id);
    const url = `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${monitoringRef}`;
    const response = await safeFetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    // Alerts
    await fetchTrafficAlerts(stopConfig.line, alertBanner);

    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    if (visits.length) {
      container.innerHTML = '';
      const departures = visits.slice(0, 4);
      const gtfsStop = gtfsData[stopConfig.id]?.[stopConfig.line];

      departures.forEach((dep, idx) => {
        const mvj = dep.MonitoredVehicleJourney || {};
        const call = mvj.MonitoredCall || {};
        const aimed = call.AimedDepartureTime;
        const expected = call.ExpectedDepartureTime || aimed;
        const destination = (mvj.DestinationName?.[0]?.value) || (mvj.DirectionName?.[0]?.value) || '—';
        const state = getDepartureState(dep, gtfsStop);
        const minutesRemaining = getMinutesRemaining(expected);

        const item = document.createElement('div');
        item.className = `depart-item ${state.state}`;
        const timeHtml = state.state === 'delayed'
          ? `<span class="time-cancelled">${formatTime(aimed)}</span> ${formatTime(expected)}`
          : `${formatTime(expected)}`;
        const badgeHtml = state.badge ? `<span class="badge ${state.state}">${state.badge}</span>` : '';
        item.innerHTML = `
          <div class="depart-left">
            <div class="depart-time">${timeHtml}</div>
            <div class="depart-destination">${destination}</div>
          </div>
          <div class="depart-info">${minutesRemaining} min ${badgeHtml}</div>
        `;
        container.appendChild(item);

        if (idx === 0 && mvj.DatedVehicleJourneyRef) {
          fetchServedStops(mvj.DatedVehicleJourneyRef, servedStops).catch(()=>{});
        }
      });
    } else {
      // No realtime: service ended or no data
      const now = new Date();
      const gtfsStop = gtfsData[stopConfig.id]?.[stopConfig.line];
      if (gtfsStop && (now.getHours()*60 + now.getMinutes()) >= parseTime(gtfsStop.dirA_last || '23:59')) {
        container.innerHTML = `<div class="service-ended-message">🟡 Service terminé – prochain départ demain à ${gtfsStop.dirA_first || '05:30'}</div>`;
      } else {
        container.innerHTML = '<div class="no-data">Aucune information temps réel disponible</div>';
      }
    }
  } catch (e) {
    container.innerHTML = `<div class="error">Erreur de connexion transport – ${e.message}</div>`;
    const gtfsStop = gtfsData[stopConfig.id]?.[stopConfig.line];
    if (gtfsStop) {
      container.innerHTML += `<div class="fallback-info"><small>Horaires théoriques: 1er ${gtfsStop.dirA_first || 'N/A'} – Dernier ${gtfsStop.dirA_last || 'N/A'}</small></div>`;
    }
  }
}

async function fetchTrafficAlerts(lineId, bannerElement) {
  try {
    let url = `https://prim.iledefrance-mobilites.fr/marketplace/general-message?line=${encodeURIComponent(lineId)}`;
    let resp = await safeFetch(url);
    if (!resp.ok) {
      // retry without line filter
      url = 'https://prim.iledefrance-mobilites.fr/marketplace/general-message';
      resp = await safeFetch(url);
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const msgs = data?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.GeneralMessage || [];
    const relevant = msgs.find(m => {
      const refs = (m?.InfoMessageIdentifier || '').toString();
      const sev = m?.Severity || 'normal';
      return sev === 'severe' || sev === 'noService' || sev === 'verySevere';
    });
    if (relevant) {
      const message = relevant?.Content?.Message?.[0]?.MessageText?.[0]?.value || 'Perturbation en cours';
      bannerElement.textContent = `⛔ ${message}`;
      bannerElement.style.display = 'block';
      bannerElement.className = 'alert-banner';
    } else {
      bannerElement.style.display = 'none';
    }
  } catch (e) {
    bannerElement.style.display = 'none';
  }
}

async function fetchServedStops(vehicleJourneyRef, container) {
  try {
    const url = `https://prim.iledefrance-mobilites.fr/marketplace/vehicle_journeys/${vehicleJourneyRef}`;
    const res = await safeFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const stops = data?.VehicleJourney?.JourneyPattern?.StopPointInJourneyPattern || [];
    const names = stops.map(s => s.StopPoint?.StopName || s.ScheduledStopPoint?.StopName).filter(Boolean).slice(0, 8);
    if (names.length) {
      container.innerHTML = `<strong>Arrêts desservis:</strong> ${names.join(' → ')}`;
      container.style.display = 'block';
    }
  } catch (e) {
    container.style.display = 'none';
  }
}

async function fetchVelib() {
  const container = document.getElementById('velib-info');
  try {
    // Discover GBFS endpoints then proxy them
    const rootRes = await safeFetch('https://gbfs.velib-metropole.fr/gbfs/gbfs.json');
    if (!rootRes.ok) throw new Error('GBFS root HTTP ' + rootRes.status);
    const root = await rootRes.json();
    const frFeeds = root?.data?.fr?.feeds || [];
    const infoUrl = frFeeds.find(f => f.name === 'station_information')?.url;
    const statusUrl = frFeeds.find(f => f.name === 'station_status')?.url;
    if (!infoUrl || !statusUrl) throw new Error('GBFS feeds not found');

    const [infoRes, statusRes] = await Promise.all([safeFetch(infoUrl), safeFetch(statusUrl)]);
    if (!infoRes.ok || !statusRes.ok) throw new Error('GBFS HTTP error');
    const infoData = await infoRes.json();
    const statusData = await statusRes.json();

    container.innerHTML = '';
    CONFIG.VELIB_STATIONS.forEach(id => {
      const info = infoData?.data?.stations?.find(s => s.station_id === id);
      const st = statusData?.data?.stations?.find(s => s.station_id === id);
      if (info && st) {
        const div = document.createElement('div');
        div.className = 'velib-station';
        div.innerHTML = `
          <div class="station-name">${info.name}</div>
          <div class="station-status">
            <span class="status-item status-bikes">🚲 ${st.num_bikes_available}</span>
            <span class="status-item status-ebikes">⚡ ${st.num_ebikes_available || 0}</span>
            <span class="status-item status-docks">⛔ ${st.num_docks_available}</span>
          </div>`;
        container.appendChild(div);
      }
    });
    if (!container.innerHTML) {
      container.innerHTML = '<div class="no-data">Aucune station Vélib\' trouvée</div>';
    }
  } catch (e) {
    container.innerHTML = '<div class="error">Stations Vélib\' indisponibles</div>';
  }
}

async function fetchWeather() {
  const container = document.getElementById('meteo-info');
  try {
    const res = await fetch(CONFIG.WEATHER_API);
    const data = await res.json();
    const current = data.current_weather;
    const nowDiv = document.createElement('div');
    nowDiv.className = 'meteo-current';
    nowDiv.innerHTML = `<div class="meteo-temp">${Math.round(current.temperature)}°C</div>
      <div class="meteo-details">Vent: ${current.windspeed} km/h<br>Code: ${current.weathercode}</div>`;
    container.innerHTML = '';
    container.appendChild(nowDiv);
  } catch (e) {
    container.innerHTML = '<div class="error">Météo indisponible</div>';
  }
}

async function fetchNews() {
  const container = document.getElementById('news-info');
  try {
    const res = await safeFetch(CONFIG.RSS_FRANCEINFO);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const xmlText = await res.text();
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const items = Array.from(doc.querySelectorAll('item')).slice(0, 3);
    container.innerHTML = '';
    items.forEach(it => {
      const title = it.querySelector('title')?.textContent || '';
      const pubDate = it.querySelector('pubDate')?.textContent || '';
      const div = document.createElement('div');
      div.className = 'news-item';
      div.innerHTML = `<div class="news-title">${title}</div><div class="news-time">${new Date(pubDate).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>`;
      container.appendChild(div);
    });
  } catch (e) {
    container.innerHTML = '<div class="error">Actualités indisponibles</div>';
  }
}

async function fetchCourses() {
  const container = document.getElementById('courses-info');
  try {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    const datePmu = `${dd}${mm}${yyyy}`; // JJMMYYYY
    const url = `${CONFIG.PMU_API}/${datePmu}?specialisation=INTERNET`;
    const res = await safeFetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    container.innerHTML = '';
    const reunion = data?.programme?.reunions?.find(r => (r.hippodrome?.libelleCourt || '').toLowerCase().includes('vincennes'));
    if (reunion?.courses?.length) {
      reunion.courses.slice(0,5).forEach(c => {
        const div = document.createElement('div');
        div.className = 'course-item';
        div.innerHTML = `<div class="course-time">${c.heureDepart || '—'}</div>
          <div class="course-name">${c.libelle || 'Course'}</div>
          <div class="course-type">${c.discipline || 'TROT'}</div>`;
        container.appendChild(div);
      });
    } else {
      container.innerHTML = '<div class="no-data">Aucune course prévue aujourd\'hui à Vincennes</div>';
    }
  } catch (e) {
    container.innerHTML = '<div class="error">Données courses indisponibles</div>';
  }
}

function setupRefreshIntervals() {
  refreshIntervals.transport = setInterval(() => {
    fetchTransport(CONFIG.STOPS.RER_A, 'rer-a');
    fetchTransport(CONFIG.STOPS.BUS_77, 'bus-77');
    fetchTransport(CONFIG.STOPS.BUS_201, 'bus-201');
  }, CONFIG.REFRESH.STOP_MONITORING);
  refreshIntervals.velib = setInterval(fetchVelib, CONFIG.REFRESH.VELIB);
  refreshIntervals.weather = setInterval(fetchWeather, CONFIG.REFRESH.WEATHER);
  refreshIntervals.news = setInterval(fetchNews, CONFIG.REFRESH.NEWS);
  refreshIntervals.courses = setInterval(fetchCourses, CONFIG.REFRESH.COURSES);
  refreshIntervals.clock = setInterval(updateClock, 1000);
}

document.addEventListener('DOMContentLoaded', async () => {
  updateClock();
  await loadGTFSData();
  setTimeout(() => fetchTransport(CONFIG.STOPS.RER_A, 'rer-a'), 0);
  setTimeout(() => fetchTransport(CONFIG.STOPS.BUS_77, 'bus-77'), 100);
  setTimeout(() => fetchTransport(CONFIG.STOPS.BUS_201, 'bus-201'), 200);
  setTimeout(fetchVelib, 300);
  setTimeout(fetchWeather, 2000);
  setTimeout(fetchNews, 2500);
  setTimeout(fetchCourses, 3000);
  setupRefreshIntervals();
});

window.addEventListener('beforeunload', () => Object.values(refreshIntervals).forEach(clearInterval));
