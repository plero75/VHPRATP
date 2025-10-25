// 📁 script.js

// --- CONFIG ---
const STOPS = [
  { id: "IDFM:463645", name: "École du Breuil", line: "C02251", type: "bus" },
  { id: "IDFM:463642", name: "Hippodrome de Vincennes", line: "C02251", type: "bus" },
  { id: "IDFM:70640", name: "Joinville-le-Pont", line: "C01742", type: "rer" },
];

const VELIB_STATION_ID = "12123";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast?latitude=48.82&longitude=2.45&current_weather=true";
const TRAFFIC_API = "https://prim.iledefrance-mobilites.fr/marketplace/v2/general-message";
const PROXY_PRIM = "https://ratp-proxy.hippodrome-proxy42.workers.dev";

// --- HELPERS ---
function createBlock(title) {
  const block = document.createElement("div");
  block.className = "data-block";
  block.innerHTML = `<h2>${title}</h2><div class="content"></div>`;
  document.body.appendChild(block);
  return block.querySelector(".content");
}

function formatTime(t) {
  return t < 10 ? "0" + t : t;
}

// --- RER / BUS ---
async function fetchTransport(stop) {
  const url = `${PROXY_PRIM}/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:${stop.id}`;
  const content = createBlock(`${stop.name} – ${stop.type.toUpperCase()}`);

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.MonitoredStopVisit) {
      data.MonitoredStopVisit.slice(0, 4).forEach((visit) => {
        const aimed = visit.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime;
        const est = visit.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime;
        const dest = visit.MonitoredVehicleJourney.DestinationName;
        const status = visit.MonitoredVehicleJourney.MonitoredCall.DepartureStatus;

        const aimedTime = new Date(aimed);
        const estTime = new Date(est);
        const now = new Date();
        const diffMin = Math.floor((estTime - now) / 60000);

        const line = document.createElement("div");
        line.className = "line";
        line.innerHTML = `${formatTime(estTime.getHours())}h${formatTime(estTime.getMinutes())} → ${dest} (${diffMin} min)` + (status === "delayed" ? " ⚠️" : "");
        content.appendChild(line);
      });
    } else {
      content.innerHTML = "Pas d'information en temps réel";
    }
  } catch (e) {
    content.innerHTML = "Erreur API";
  }
}

// --- MÉTÉO ---
async function fetchWeather() {
  const content = createBlock("Météo actuelle");
  try {
    const res = await fetch(WEATHER_API);
    const data = await res.json();
    const weather = data.current_weather;
    content.innerHTML = `${weather.temperature}°C, ${weather.windspeed} km/h – ${weather.weathercode}`;
  } catch (e) {
    content.innerHTML = "Erreur météo";
  }
}

// --- VÉLIB ---
async function fetchVelib() {
  const content = createBlock("Vélib’ disponibles");
  try {
    const res = await fetch(`https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_information.json`);
    const infos = await res.json();
    const res2 = await fetch(`https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_status.json`);
    const status = await res2.json();

    const info = infos.data.stations.find((s) => s.station_id === VELIB_STATION_ID);
    const stat = status.data.stations.find((s) => s.station_id === VELIB_STATION_ID);
    if (info && stat) {
      content.innerHTML = `${info.name} : ${stat.num_bikes_available} vélos, ${stat.num_docks_available} bornes libres`;
    }
  } catch (e) {
    content.innerHTML = "Erreur Vélib’";
  }
}

// --- TRAFIC ---
async function fetchTraffic() {
  const content = createBlock("Perturbations RATP");
  try {
    const res = await fetch(`${PROXY_PRIM}/marketplace/general-message`);
    const data = await res.json();
    const messages = data.generalMessages.filter((m) => m.messageType === "INFO_TRAFFIC");
    messages.slice(0, 5).forEach((msg) => {
      const line = document.createElement("div");
      line.innerHTML = msg.title || msg.message.text;
      content.appendChild(line);
    });
  } catch (e) {
    content.innerHTML = "Erreur trafic";
  }
}

// --- MAIN ---
document.addEventListener("DOMContentLoaded", () => {
  STOPS.forEach(fetchTransport);
  fetchWeather();
  fetchVelib();
  fetchTraffic();
};


/* 📁 style.css */

body {
  font-family: "Segoe UI", sans-serif;
  background: #f4f6f9;
  color: #222;
  padding: 20px;
}

h1 {
  text-align: center;
  margin-bottom: 40px;
}

.data-block {
  background: white;
  margin-bottom: 30px;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}

.data-block h2 {
  font-size: 1.4em;
  margin-bottom: 10px;
  color: #1b2494;
}

.line {
  padding: 6px 0;
  border-bottom: 1px solid #eee;
}
