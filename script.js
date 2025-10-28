// Dashboard Transports - Hippodrome de Vincennes
// Conforme cahier des charges v5 Fixed+ Octobre 2025

// === CONFIGURATION ===
const CONFIG = {
  // Identifiants corrects selon cahier des charges
  STOPS: {
    RER_A: { id: 'IDFM:70640', name: 'Joinville-le-Pont', line: 'line:IDFM:C01742', type: 'rer' },
    BUS_77: { id: 'IDFM:463641', name: 'Hippodrome de Vincennes', line: 'line:IDFM:C02251', type: 'bus' },
    BUS_201: { id: 'IDFM:463644', name: 'École du Breuil', line: 'line:IDFM:C02251', type: 'bus' }
  },
  
  // Stations Vélib corrigées
  VELIB_STATIONS: ['12163', '12128'],
  
  // APIs
  PROXY_PRIM: 'https://ratp-proxy.hippodrome-proxy42.workers.dev',
  WEATHER_API: 'https://api.open-meteo.com/v1/forecast?latitude=48.835&longitude=2.44&current_weather=true&hourly=temperature_2m,weathercode&timezone=Europe/Paris',
  RSS_FRANCEINFO: 'https://www.francetvinfo.fr/titres.rss',
  PMU_API: 'https://offline.turfinfo.api.pmu.fr/rest/client/7/programme',
  
  // Fréquences de rafraîchissement (en millisecondes)
  REFRESH: {
    STOP_MONITORING: 30000,    // 30s
    GENERAL_MESSAGE: 120000,   // 120s
    VELIB: 30000,             // 30s
    WEATHER: 600000,          // 10min
    NEWS: 3600000,            // 60min
    COURSES: 600000           // 10min
  }
};

// === VARIABLES GLOBALES ===
let gtfsData = {};
let refreshIntervals = {};

// === UTILITAIRES ===

// Fonction d'encodage unique pour le proxy (conforme cahier des charges)
function safeFetch(url) {
  const encodedUrl = encodeURIComponent(url);
  return fetch(`${CONFIG.PROXY_PRIM}/?url=${encodedUrl}`);
}

// Format time helper
function formatTime(date) {
  return date.toLocaleTimeString('fr-FR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// Calcul minutes restantes
function getMinutesRemaining(targetTime) {
  const now = new Date();
  const target = new Date(targetTime);
  return Math.floor((target - now) / 60000);
}

// Détermination de l'état prioritaire selon cahier des charges
function getDepartureState(departure, gtfsLastTimes) {
  const now = new Date();
  const aimed = new Date(departure.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime);
  const expected = new Date(departure.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime);
  const minutesRemaining = getMinutesRemaining(expected);
  
  // 1. SUPPRIMÉ
  if (departure.MonitoredVehicleJourney.Cancellation) {
    return { priority: 1, state: 'supprime', badge: 'supprimé' };
  }
  
  // 4. RETARDÉ (Expected > Aimed)
  if (expected > aimed) {
    const delayMin = Math.floor((expected - aimed) / 60000);
    return { priority: 4, state: 'delayed', badge: `+${delayMin} min`, delay: delayMin };
  }
  
  // 5. IMMINENT (< 90s)
  if (minutesRemaining < 1.5) {
    return { priority: 5, state: 'imminent', badge: 'imminent' };
  }
  
  // Badge "dernier" si correspond au dernier horaire GTFS
  const aimedTimeStr = formatTime(aimed);
  if (gtfsLastTimes && aimedTimeStr === gtfsLastTimes.dirA_last || aimedTimeStr === gtfsLastTimes.dirB_last) {
    return { priority: 6, state: 'normal', badge: 'dernier' };
  }
  
  // 6. À L'HEURE
  return { priority: 6, state: 'normal', badge: null };
}

// === MODULES PRINCIPAUX ===

// Horloge temps réel
function updateClock() {
  const now = new Date();
  document.getElementById('horloge').textContent = formatTime(now);
}

// Chargement des données GTFS locales
async function loadGTFSData() {
  try {
    const cacheBuster = new Date().toISOString().slice(0, 13).replace(/[-T:]/g, ''); // YYYYMMDDHH
    const response = await fetch(`static/horaires_export.json?v=${cacheBuster}`);
    gtfsData = await response.json();
    console.log('GTFS data loaded:', Object.keys(gtfsData).length, 'stops');
  } catch (error) {
    console.warn('Failed to load GTFS data:', error);
    gtfsData = {};
  }
}

// Transport: RER A, Bus 77, Bus 201
async function fetchTransport(stopConfig, elementId) {
  const container = document.getElementById(`${elementId}-departs`);
  const alertBanner = document.getElementById(`${elementId}-alert`);
  const servedStops = document.getElementById(`${elementId}-stops`);
  
  try {
    const url = `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopConfig.id}`;
    const response = await safeFetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Vérifier les alertes de trafic
    await fetchTrafficAlerts(stopConfig.line, alertBanner);
    
    if (data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit?.length) {
      const departures = data.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit.slice(0, 4);
      
      container.innerHTML = '';
      
      for (let i = 0; i < departures.length; i++) {
        const departure = departures[i];
        const mvj = departure.MonitoredVehicleJourney;
        const call = mvj.MonitoredCall;
        
        const aimed = new Date(call.AimedDepartureTime);
        const expected = new Date(call.ExpectedDepartureTime);
        const destination = mvj.DestinationName?.[0]?.value || mvj.DirectionName?.[0]?.value || 'Destination inconnue';
        
        // Déterminer l'état selon priorités
        const gtfsStop = gtfsData[stopConfig.id]?.[stopConfig.line];
        const state = getDepartureState(departure, gtfsStop);
        
        // Créer l'élément de départ
        const departItem = document.createElement('div');
        departItem.className = `depart-item ${state.state}`;
        
        let timeDisplay = formatTime(expected);
        if (state.state === 'delayed') {
          timeDisplay = `<span class="time-cancelled">${formatTime(aimed)}</span> ${formatTime(expected)}`;
        }
        
        let badgeHtml = '';
        if (state.badge) {
          badgeHtml = `<span class="badge ${state.state}">${state.badge}</span>`;
        }
        
        const minutesRemaining = getMinutesRemaining(expected);
        
        departItem.innerHTML = `
          <div class="depart-left">
            <div class="depart-time">${timeDisplay}</div>
            <div class="depart-destination">${destination}</div>
          </div>
          <div class="depart-info">
            ${minutesRemaining} min${badgeHtml}
          </div>
        `;
        
        container.appendChild(departItem);
        
        // Arrêts desservis pour le premier départ
        if (i === 0 && mvj.DatedVehicleJourneyRef) {
          fetchServedStops(mvj.DatedVehicleJourneyRef, servedStops);
        }
      }
      
    } else {
      // Pas de données temps réel, vérifier service terminé
      const now = new Date();
      const gtfsStop = gtfsData[stopConfig.id]?.[stopConfig.line];
      
      if (gtfsStop && (now.getHours() * 60 + now.getMinutes()) >= parseTime(gtfsStop.dirA_last || '23:59')) {
        container.innerHTML = `
          <div class="service-ended-message">
            🟡 Service terminé – prochain départ demain à ${gtfsStop.dirA_first || '05:30'}
          </div>
        `;
      } else {
        container.innerHTML = '<div class="no-data">Aucune information temps réel disponible</div>';
      }
    }
    
  } catch (error) {
    console.error(`Erreur transport ${elementId}:`, error);
    container.innerHTML = `<div class="error">Erreur de connexion - ${error.message}</div>`;
    
    // Fallback GTFS si disponible
    const gtfsStop = gtfsData[stopConfig.id]?.[stopConfig.line];
    if (gtfsStop) {
      container.innerHTML += `
        <div class="fallback-info">
          <small>Horaires théoriques: Premier ${gtfsStop.dirA_first || 'N/A'} - Dernier ${gtfsStop.dirA_last || 'N/A'}</small>
        </div>
      `;
    }
  }
}

// Alertes de trafic par ligne
async function fetchTrafficAlerts(lineId, bannerElement) {
  try {
    const url = `https://prim.iledefrance-mobilites.fr/marketplace/general-message?line=${lineId}`;
    const response = await safeFetch(url);
    const data = await response.json();
    
    if (data.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.GeneralMessage?.length) {
      const alerts = data.Siri.ServiceDelivery.GeneralMessageDelivery[0].GeneralMessage;
      const activeAlert = alerts.find(alert => {
        const severity = alert.Severity || 'normal';
        return severity === 'severe' || severity === 'noService';
      });
      
      if (activeAlert) {
        const message = activeAlert.Content?.Message?.[0]?.MessageText?.[0]?.value || 'Perturbation en cours';
        bannerElement.textContent = `⛔ ${message}`;
        bannerElement.style.display = 'block';
        bannerElement.className = 'alert-banner';
      } else {
        bannerElement.style.display = 'none';
      }
    } else {
      bannerElement.style.display = 'none';
    }
  } catch (error) {
    console.warn('Traffic alerts error:', error);
    bannerElement.style.display = 'none';
  }
}

// Arrêts desservis (premier départ)
async function fetchServedStops(vehicleJourneyRef, container) {
  try {
    const url = `https://prim.iledefrance-mobilites.fr/marketplace/vehicle_journeys/${vehicleJourneyRef}`;
    const response = await safeFetch(url);
    const data = await response.json();
    
    if (data.VehicleJourney?.JourneyPattern?.StopPointInJourneyPattern?.length) {
      const stops = data.VehicleJourney.JourneyPattern.StopPointInJourneyPattern
        .map(stop => stop.StopPoint?.StopName || stop.ScheduledStopPoint?.StopName)
        .filter(name => name)
        .slice(0, 8); // Limiter l'affichage
      
      container.innerHTML = `<strong>Arrêts desservis:</strong> ${stops.join(' → ')}`;
      container.style.display = 'block';
    }
  } catch (error) {
    console.warn('Served stops error:', error);
    container.style.display = 'none';
  }
}

// Vélib' (stations 12163, 12128)
async function fetchVelib() {
  const container = document.getElementById('velib-info');
  
  try {
    const [infoResponse, statusResponse] = await Promise.all([
      fetch('https://gbfs.velib-metropole.fr/gbfs/en/station_information.json'),
      fetch('https://gbfs.velib-metropole.fr/gbfs/en/station_status.json')
    ]);
    
    const infoData = await infoResponse.json();
    const statusData = await statusResponse.json();
    
    container.innerHTML = '';
    
    CONFIG.VELIB_STATIONS.forEach(stationId => {
      const info = infoData.data.stations.find(s => s.station_id === stationId);
      const status = statusData.data.stations.find(s => s.station_id === stationId);
      
      if (info && status) {
        const stationDiv = document.createElement('div');
        stationDiv.className = 'velib-station';
        
        stationDiv.innerHTML = `
          <div class="station-name">${info.name}</div>
          <div class="station-status">
            <span class="status-item status-bikes">🚲 ${status.num_bikes_available}</span>
            <span class="status-item status-ebikes">⚡ ${status.num_ebikes_available || 0}</span>
            <span class="status-item status-docks">⛔ ${status.num_docks_available}</span>
          </div>
        `;
        
        container.appendChild(stationDiv);
      }
    });
    
  } catch (error) {
    console.error('Velib error:', error);
    container.innerHTML = '<div class="error">Stations Vélib\'  temporairement indisponibles</div>';
  }
}

// Météo avec prévisions 3-6h
async function fetchWeather() {
  const container = document.getElementById('meteo-info');
  
  try {
    const response = await fetch(CONFIG.WEATHER_API);
    const data = await response.json();
    
    const current = data.current_weather;
    const hourly = data.hourly;
    
    // Météo actuelle
    const currentDiv = document.createElement('div');
    currentDiv.className = 'meteo-current';
    currentDiv.innerHTML = `
      <div class="meteo-temp">${Math.round(current.temperature)}°C</div>
      <div class="meteo-details">
        Vent: ${current.windspeed} km/h<br>
        Code: ${current.weathercode}
      </div>
    `;
    
    // Prévisions 3-6h
    const forecastDiv = document.createElement('div');
    forecastDiv.className = 'meteo-forecast';
    
    const now = new Date();
    const forecast3h = hourly.temperature_2m[now.getHours() + 3] || 'N/A';
    const forecast6h = hourly.temperature_2m[now.getHours() + 6] || 'N/A';
    
    forecastDiv.innerHTML = `
      <div class="forecast-item">
        <div>+3h</div>
        <div>${Math.round(forecast3h)}°C</div>
      </div>
      <div class="forecast-item">
        <div>+6h</div>
        <div>${Math.round(forecast6h)}°C</div>
      </div>
    `;
    
    container.innerHTML = '';
    container.appendChild(currentDiv);
    container.appendChild(forecastDiv);
    
  } catch (error) {
    console.error('Weather error:', error);
    container.innerHTML = '<div class="error">Météo indisponible</div>';
  }
}

// Actualités France Info RSS
async function fetchNews() {
  const container = document.getElementById('news-info');
  
  try {
    const response = await safeFetch(CONFIG.RSS_FRANCEINFO);
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    const items = xmlDoc.querySelectorAll('item');
    container.innerHTML = '';
    
    Array.from(items).slice(0, 3).forEach(item => {
      const title = item.querySelector('title')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      
      const newsDiv = document.createElement('div');
      newsDiv.className = 'news-item';
      newsDiv.innerHTML = `
        <div class="news-title">${title}</div>
        <div class="news-time">${new Date(pubDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
      `;
      
      container.appendChild(newsDiv);
    });
    
  } catch (error) {
    console.error('News error:', error);
    container.innerHTML = '<div class="error">Actualités temporairement indisponibles</div>';
  }
}

// Courses PMU Vincennes
async function fetchCourses() {
  const container = document.getElementById('courses-info');
  
  try {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '').slice(2); // DDMMYYYY
    const url = `${CONFIG.PMU_API}/${today}?specialisation=INTERNET`;
    const response = await safeFetch(url);
    const data = await response.json();
    
    container.innerHTML = '';
    
    if (data.programme?.reunions?.length) {
      const vincennesReunion = data.programme.reunions.find(r => 
        r.hippodrome?.libelleCourt?.toLowerCase().includes('vincennes')
      );
      
      if (vincennesReunion?.courses?.length) {
        vincennesReunion.courses.slice(0, 5).forEach(course => {
          const courseDiv = document.createElement('div');
          courseDiv.className = 'course-item';
          
          courseDiv.innerHTML = `
            <div class="course-time">${course.heureDepart || 'N/A'}</div>
            <div class="course-name">${course.libelle || 'Course'}</div>
            <div class="course-type">${course.discipline || 'TROT'}</div>
          `;
          
          container.appendChild(courseDiv);
        });
      } else {
        container.innerHTML = '<div class="no-data">Aucune course prévue aujourd\'hui à Vincennes</div>';
      }
    } else {
      container.innerHTML = '<div class="no-data">Programme des courses indisponible</div>';
    }
    
  } catch (error) {
    console.error('Courses error:', error);
    container.innerHTML = '<div class="error">Données courses temporairement indisponibles</div>';
  }
}

// Helper: conversion heure string vers minutes
function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// === INITIALISATION ===

function setupRefreshIntervals() {
  // Transport (30s)
  refreshIntervals.transport = setInterval(() => {
    fetchTransport(CONFIG.STOPS.RER_A, 'rer-a');
    fetchTransport(CONFIG.STOPS.BUS_77, 'bus-77');
    fetchTransport(CONFIG.STOPS.BUS_201, 'bus-201');
  }, CONFIG.REFRESH.STOP_MONITORING);
  
  // Vélib' (30s)
  refreshIntervals.velib = setInterval(fetchVelib, CONFIG.REFRESH.VELIB);
  
  // Météo (10min)
  refreshIntervals.weather = setInterval(fetchWeather, CONFIG.REFRESH.WEATHER);
  
  // Actualités (60min)
  refreshIntervals.news = setInterval(fetchNews, CONFIG.REFRESH.NEWS);
  
  // Courses (10min)
  refreshIntervals.courses = setInterval(fetchCourses, CONFIG.REFRESH.COURSES);
  
  // Horloge (1s)
  refreshIntervals.clock = setInterval(updateClock, 1000);
}

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Dashboard Transports - Hippodrome de Vincennes');
  console.log('📋 Cahier des charges v5 Fixed+ - Octobre 2025');
  
  // Chargement initial
  updateClock();
  await loadGTFSData();
  
  // Chargement données avec throttling
  setTimeout(() => fetchTransport(CONFIG.STOPS.RER_A, 'rer-a'), 0);
  setTimeout(() => fetchTransport(CONFIG.STOPS.BUS_77, 'bus-77'), 100);
  setTimeout(() => fetchTransport(CONFIG.STOPS.BUS_201, 'bus-201'), 200);
  setTimeout(fetchVelib, 300);
  setTimeout(fetchWeather, 2000);   // Throttle météo
  setTimeout(fetchNews, 2500);      // Throttle actualités
  setTimeout(fetchCourses, 3000);   // Throttle courses
  
  // Configuration des intervalles de rafraîchissement
  setupRefreshIntervals();
  
  console.log('✅ Dashboard initialisé avec succès');
});

// Nettoyage des intervalles avant fermeture
window.addEventListener('beforeunload', () => {
  Object.values(refreshIntervals).forEach(clearInterval);
});