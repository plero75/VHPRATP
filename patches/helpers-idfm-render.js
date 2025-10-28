// Define helpers locally to avoid dependency on inline index helpers
(function(){
  function makeMinuteCol(min, at, imm){
    const wrap = document.createElement('div');
    wrap.className='minute-col';
    const m = document.createElement('div'); m.className='m'; m.textContent=min; wrap.appendChild(m);
    const atEl = document.createElement('div'); atEl.className='at'; atEl.textContent=at; wrap.appendChild(atEl);
    if (imm){ const b=document.createElement('div'); b.className='badge-imm'; b.textContent='IMMINENT'; wrap.appendChild(b); }
    return wrap;
  }
  function insertSplit(parent){ const s=document.createElement('div'); s.className='split'; parent.appendChild(s); }
  window.__idfm_helpers__ = { makeMinuteCol, insertSplit };
})();
