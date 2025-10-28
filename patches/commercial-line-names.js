// Commercial line name utilities and UI overrides
(function(){
  function deriveCommercialName(mvj){
    // Prefer PublishedLineName from SIRI
    const pub = mvj?.PublishedLineName?.[0]?.value || mvj?.PublishedLineName || '';
    if (pub && /[A-Za-z0-9]/.test(pub)) return pub.trim();

    // Fallback from LineRef or lineId
    const lr = (mvj?.LineRef && (mvj.LineRef.value || mvj.LineRef)) || '';
    const code = (lr.match(/C\d{5}/) || [mvj?.LineRef || ''])[0];

    // Heuristics
    // RER letter
    const dirName = mvj?.RouteRef || '';
    const letter = (pub || dirName || '').match(/\b([A-E])\b/);
    if (letter) return `RER ${letter[1]}`;

    // Noctilien Nxx
    const noct = (pub || lr || '').match(/\bN\d{2,3}\b/i);
    if (noct) return noct[0].toUpperCase();

    // Tram Txx
    const tram = (pub || lr || '').match(/\bT\d{1,2}\b/i);
    if (tram) return tram[0].toUpperCase();

    // Métro
    if (/METRO/i.test(pub) || /METRO/i.test(lr)){
      const m = (pub || lr).match(/\d+/);
      return m ? `Métro ${m[0]}` : 'Métro';
    }

    // Bus plain number from DestinationDisplay or PublishedLineName
    const num = (pub || '').match(/\b\d{2,3}\b/);
    if (num) return `Bus ${num[0]}`;

    // Default to code tail if nothing else
    return (pub || code || 'Ligne').toString();
  }

  function applyCommercialNames(){
    // Upper cards pills
    document.querySelectorAll('#card-rer .pill').forEach(p=> p.textContent='A');
    document.querySelectorAll('#card-hippo-77 .pill').forEach(p=> p.textContent='77');
    const pills = document.querySelectorAll('#card-breuil-77201 .pill');
    if (pills[0]) pills[0].textContent='77';
    if (pills[1]) pills[1].textContent='201';

    // All-bus tiles: convert pill labels from Cxxxxx to Bus NN if needed
    document.querySelectorAll('#joinville-all-bus .tile .tile-head .pill').forEach(p=>{
      const code = (p.textContent||'').trim();
      const match = code.match(/^C\d{5}$/);
      if (match){ p.textContent = 'Bus'; }
    });
  }

  // Expose for renderers
  window.__idfm_line_name__ = { deriveCommercialName, applyCommercialNames };

  // Periodic to catch dynamic content
  setInterval(applyCommercialNames, 1200);
})();
