import { initTaskPage } from './auth.js';

let user, userDoc, db, fb;

initTaskPage().then(res => {
  user = res.user; userDoc = res.userDoc; db = res.db; fb = res.fb;
  loadTeoria();
}).catch(console.error);

function loadTeoria() {
  const params = new URLSearchParams(window.location.search);
  const claseId = params.get('claseId');
  const bloqueId = parseInt(params.get('bloqueId'));
  
  // Allow teachers/admins to preview theory without a specific class
  if (!claseId && !(userDoc && ['admin', 'docente'].includes(userDoc.rol))) { 
      window.location.href = 'clases.html'; 
      return; 
  }
  
  const btnVolver = document.getElementById('btn-volver-tandas');
  btnVolver.onclick = () => {
    if (userDoc && ['admin', 'docente'].includes(userDoc.rol)) {
      if (claseId) {
          window.location.href = `../admin/clase.html?id=${claseId}`;
      } else {
          window.location.href = `../admin/roadmap.html`;
      }
    } else {
      window.location.href = `tandas.html?claseId=${claseId}`;
    }
  };
  
  const bloqueData = window.BLOQUES?.find(b => b.id === bloqueId);
  if (!bloqueData) {
    document.getElementById('teoria-wrapper').innerHTML = '<div class="alert alert-danger">Bloque no encontrado.</div>';
    return;
  }
  
  document.getElementById('header-bloque-nombre').textContent = 'Teoría: ' + bloqueData.nombre;
  
  // Fetch the HTML file for the block
  const url = `teoria/tema${bloqueId}.html?v=${new Date().getTime()}`;
  
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('No hay contenido teórico disponible aún para este bloque.');
      }
      return response.text();
    })
    .then(htmlContent => {
      document.getElementById('teoria-wrapper').innerHTML = htmlContent;
      if (typeof window.initInteractiveTheory === 'function') {
        window.initInteractiveTheory();
      }
      if (window.mermaid) {
        window.mermaid.run().catch(e => console.error("Mermaid error:", e));
      }
    })
    .catch(error => {
      document.getElementById('teoria-wrapper').innerHTML = `
        <div class="alert alert-warning">
          <i class="fas fa-tools me-2"></i> ${error.message}
        </div>
      `;
    });
}


window.imprimirTema = function() {
  window.print();
};
