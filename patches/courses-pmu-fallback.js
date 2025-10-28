// PMU fallback officiel (JJMMYYYY) en plus de letrot
async function refreshCoursesPMU(){
  const cont = document.getElementById('courses-list'); if (!cont) return;
  try{
    const d=new Date(); const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const yyyy=d.getFullYear();
    const datePmu = `${dd}${mm}${yyyy}`; // JJMMYYYY
    const url = `https://offline.turfinfo.api.pmu.fr/rest/client/7/programme/${datePmu}?specialisation=INTERNET`;
    const data = await fetchJSON(PROXY + encodeURIComponent(url));
    const reunions = data?.programme?.reunions || [];
    const vinc = reunions.find(r => (r.hippodrome?.libelleCourt || '').toLowerCase().includes('vincennes'));
    if (vinc?.courses?.length){
      cont.innerHTML = '';
      vinc.courses.slice(0,5).forEach(c=>{
        const div=document.createElement('div');
        div.className='traffic-sub ok';
        div.textContent = `${c.heureDepart || '--:--'} — ${c.libelle || 'Course'} (${c.discipline || 'TROT'})`;
        cont.appendChild(div);
      });
      return true;
    }
  }catch(e){ console.warn('refreshCoursesPMU', e); }
  return false;
}

async function refreshCoursesCombined(){
  const ok = await refreshCoursesPMU();
  if (!ok) await refreshCourses();
}

// Brancher le combiné: remplacer startLoops et init usages de refreshCourses par refreshCoursesCombined
(function(){
  const origStartLoops = window.startLoops;
  window.startLoops = function(){
    setInterval(refreshCoursesCombined, 900000);
    origStartLoops();
  };
  document.addEventListener('DOMContentLoaded', ()=>{
    refreshCoursesCombined();
  });
})();
