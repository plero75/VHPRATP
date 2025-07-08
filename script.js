
async function loadStatic() {
  try {
    const res = await fetch('static/horaires_export.json');
    const data = await res.json();
    console.log('Horaires chargés', data);
  } catch (e) {
    console.error('Erreur de chargement', e);
  }
}
document.addEventListener("DOMContentLoaded", loadStatic);
