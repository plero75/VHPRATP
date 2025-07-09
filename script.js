// 📁 script.js – Dashboard RATP Vincennes

document.addEventListener("DOMContentLoaded", async () => {
  await loadRER();
  await loadBus();
  await loadVelib();
  await loadMeteo();
  await loadTrafic();
});

async function loadRER() {
  const rerContainer = document.getElementById("rer-block");
  try {
    const res = await fetch("https://ratp-proxy.hippodrome-proxy42.workers.dev/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:43135:");
    const data = await res.json();
    displayDepartures(data, rerContainer, "RER A");
  } catch (err) {
    rerContainer.textContent = "Erreur chargement RER.";
  }
}

async function loadBus() {
  const busContainer = document.getElementById("bus-block");
  const stops = ["STIF:StopArea:SP:463641:", "STIF:StopArea:SP:463644:"];
  for (const stop of stops) {
    try {
      const res = await fetch(`https://ratp-proxy.hippodrome-proxy42.workers.dev/marketplace/stop-monitoring?MonitoringRef=${stop}`);
      const data = await res.json();
      displayDepartures(data, busContainer, stop.includes("641") ? "Bus 77" : "Bus 201");
    } catch (err) {
      const div = document.createElement("div");
      div.textContent = `Erreur chargement ${stop}`;
      busContainer.appendChild(div);
    }
  }
}

async function loadVelib() {
  const velibBlock = document.getElementById("velib-block");
  try {
    const res = await fetch("https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_information.json");
    const data = await res.json();
    const station = data.data.stations.find(s => s.stationCode === "12100525");
    velibBlock.innerHTML = `<strong>Vélib'</strong><br>${station.name}<br>Capacité : ${station.capacity}`;
  } catch (err) {
    velibBlock.textContent = "Erreur chargement Vélib'.";
  }
}

async function loadMeteo() {
  const meteoBlock = document.getElementById("meteo-block");
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.82&longitude=2.45&current=temperature_2m,weathercode&timezone=auto");
    const data = await res.json();
    const t = data.current.temperature_2m;
    meteoBlock.innerHTML = `🌡 Température : ${t}°C`;
  } catch (err) {
    meteoBlock.textContent = "Erreur météo.";
  }
}

async function loadTrafic() {
  const traficBlock = document.getElementById("trafic-block");
  try {
    const res = await fetch("https://data.cleverapps.io/etat_circulation" /* proxy à mettre si besoin */);
    const data = await res.json();
    traficBlock.innerHTML = `<strong>Circulation</strong><br>${data.message}`;
  } catch (err) {
    traficBlock.textContent = "Erreur trafic routier.";
  }
}

function displayDepartures(data, container, label) {
  const header = document.createElement("h3");
  header.textContent = label;
  container.appendChild(header);

  (data?.Siri?.ServiceDelivery?.StopMonitoringDelivery || []).forEach(delivery => {
    delivery.MonitoredStopVisit?.slice(0, 4).forEach(visit => {
      const d = visit.MonitoredVehicleJourney;
      const li = document.createElement("div");
      li.textContent = `${d.LineRef} ➜ ${d.DestinationName} à ${d.MonitoredCall.ExpectedDepartureTime.slice(11, 16)}`;
      container.appendChild(li);
    });
  });
}
