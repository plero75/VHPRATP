// Mapping couleurs étendu et rendu visuel amélioré des pastilles/rows
(function(){
  // Couleurs inspirées chartes (indicatives)
  const LINE_COLORS = {
    // RER
    'C01742': { bg:'#d52b1e', fg:'#ffffff', label:'A' },
    'A':      { bg:'#d52b1e', fg:'#ffffff', label:'A' },

    // BUS RATP (exemples communs) – ajustez si besoin
    'C02251': { bg:'#2450a4', fg:'#ffffff', label:'77/201' },
    '77':     { bg:'#2450a4', fg:'#ffffff', label:'77' },
    '201':    { bg:'#0a8f5a', fg:'#ffffff', label:'201' },

    // Extensions possibles si autres lignes Cxxxxx apparaissent
    'C01001': { bg:'#0064b0', fg:'#ffffff', label:'Bus' },
    'C01002': { bg:'#8430ce', fg:'#ffffff', label:'Bus' },
    'C01003': { bg:'#e67e22', fg:'#ffffff', label:'Bus' },
    'C01004': { bg:'#16a085', fg:'#ffffff', label:'Bus' },
    'C01005': { bg:'#2c3e50', fg:'#ffffff', label:'Bus' }
  };

  function colorizePill(pill){
    const codeRaw = (pill.textContent||'').trim();
    // Essayer: code texte direct (e.g. 77) → code Cxxxxx dans dataset (si présent)
    const codeAttr = pill.getAttribute('data-lineref') || '';
    const cMatch = codeAttr.match(/C\d{5}/) || codeRaw.match(/C\d{5}/);
    const key = LINE_COLORS[codeRaw] ? codeRaw : (cMatch ? cMatch[0] : codeRaw);
    const col = LINE_COLORS[key];
    if (col){
      pill.style.background = col.bg;
      pill.style.color = col.fg;
      pill.style.borderRadius = '10px';
      pill.style.padding = '2px 10px';
      pill.style.fontWeight = '600';
      pill.style.letterSpacing = '0.3px';
      pill.style.boxShadow = '0 1px 2px rgba(0,0,0,0.15)';
      if (col.label && /^[AC0-9]/.test(codeRaw)) pill.textContent = col.label; // uniformiser label si besoin
    }
  }

  function enhanceRow(row){
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '60px 1fr 140px 160px';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    row.style.padding = '8px 12px';
    row.style.margin = '6px 0';
    row.style.background = '#f8f9fb';
    row.style.borderRadius = '8px';
    row.style.border = '1px solid #e7ecf3';
  }

  function enhanceTimeBox(el){
    el.querySelectorAll('.time-box').forEach(tb => {
      tb.style.display = 'inline-block';
      tb.style.minWidth = '62px';
      tb.style.textAlign = 'center';
      tb.style.padding = '6px 8px';
      tb.style.margin = '2px 4px';
      tb.style.borderRadius = '6px';
      tb.style.background = '#ffffff';
      tb.style.border = '1px solid #e1e7ef';
      tb.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
      tb.style.fontVariantNumeric = 'tabular-nums';
    });
  }

  function apply(){
    // RER pastilles
    document.querySelectorAll('.rer-a').forEach(colorizePill);
    // Bus cards pastilles
    document.querySelectorAll('.bus-card .line-pill').forEach(colorizePill);
    // Rows (RER)
    document.querySelectorAll('#rer-body .row').forEach(enhanceRow);
    // Time boxes
    document.querySelectorAll('.times').forEach(enhanceTimeBox);
    // Destinations
    document.querySelectorAll('.dest').forEach(d => { d.style.fontWeight='600'; d.style.color='#22324d'; });
    // Status col
    document.querySelectorAll('.status').forEach(s => { s.style.textAlign='right'; s.style.color='#4b5563'; });
  }

  // Appliquer périodiquement (contenu dynamique)
  setInterval(apply, 1200);
})();
