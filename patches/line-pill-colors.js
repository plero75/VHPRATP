// Styles dynamiques: couleurs de lignes pour pastilles RER A / 77 / 201
(function(){
  const LINE_COLORS = {
    'A': { bg:'#d52b1e', fg:'#fff' },
    'C01742': { bg:'#d52b1e', fg:'#fff' },
    '77': { bg:'#2450a4', fg:'#fff' },
    '201': { bg:'#0a8f5a', fg:'#fff' },
    'C02251': { bg:'#2450a4', fg:'#fff' }
  };
  function patchBusCards(){
    document.querySelectorAll('.bus-card .line-pill').forEach(pill=>{
      const code = (pill.textContent||'').trim();
      const match = (code.match(/C\d{5}/) || [null])[0];
      const key = LINE_COLORS[code] ? code : (match || code);
      const col = LINE_COLORS[key];
      if (col){ pill.style.background = col.bg; pill.style.color = col.fg; }
    });
  }
  function patchRERPills(){
    document.querySelectorAll('.rer-a').forEach(pill=>{ pill.style.background = '#d52b1e'; pill.style.color = '#fff'; });
  }
  setInterval(()=>{ patchBusCards(); patchRERPills(); }, 1500);
})();
