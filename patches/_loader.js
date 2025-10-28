// Inject traffic LineRef patch after main script
(function(){
  const code = (window.CONFIG?.STOPS?.RER_A?.line || 'line:IDFM:C01742').split(':').pop();
  // no-op: just ensure file loads
})();
