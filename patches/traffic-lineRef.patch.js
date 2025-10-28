// Patch: use LineRef=STIF:Line::Cxxxxx: for general-message
async function fetchTrafficAlerts(lineId, bannerElement) {
  try {
    // Convert a line like 'line:IDFM:C01742' into STIF:Line::C01742:
    const code = (lineId || '').split(':').pop(); // C01742
    const stifLineRef = `STIF:Line::${code}:`;

    const url = `https://prim.iledefrance-mobilites.fr/marketplace/general-message?LineRef=${encodeURIComponent(stifLineRef)}`;
    let resp = await safeFetch(url);

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    const msgs = data?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.GeneralMessage || [];

    const severe = msgs.find(m => {
      const sev = m?.Severity || 'normal';
      return ['severe','verySevere','noService'].includes(sev);
    });

    if (severe) {
      const message = severe?.Content?.Message?.[0]?.MessageText?.[0]?.value || 'Perturbation en cours';
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
