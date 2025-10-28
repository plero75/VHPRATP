// Define insertSplit globally to satisfy render-idfm-layout references
(function(){
  if (!window.insertSplit){
    window.insertSplit = function(parent){
      const s=document.createElement('div'); s.className='split'; parent.appendChild(s);
    };
  }
})();
