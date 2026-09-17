import { initTaskPage, showToast } from './auth.js';

const { user, userDoc, db, fb } = await initTaskPage();
const urlParams = new URLSearchParams(window.location.search);
const claseId = urlParams.get('claseId');
const claseNombre = urlParams.get('cName') || 'Clase';

if (!claseId) window.location.href = 'clases.html';
document.getElementById('tanda-clase-nombre').textContent = claseNombre;

loadTandas();

async function loadTandas() {
  const container = document.getElementById('tandas-container');

  try {
    const snap = await fb.getDoc(fb.doc(db, 'clases', claseId));
    if (!snap.exists()) {
      container.innerHTML = '<div class="col-12"><div class="alert alert-danger">La clase no existe.</div></div>';
      return;
    }
    
    const clase = snap.data();
    // Migración de tandasIds y tandasModo (legacy) y bloquesActivos
    const tandasModo = clase.tandasModo || {};
    (clase.tandasIds || []).forEach(tId => { if(!tandasModo[tId]) tandasModo[tId] = 'examen'; });
    const bloquesActivos = clase.bloquesActivos || [];

    // Tareas legacy por BD y bloque (modo grid de admin/clase.html)
    // Mostramos si están en tandasModo
    
    const bloquesMap = {};
    if (window.BLOQUES) {
      window.BLOQUES.forEach(b => {
        if (b.tipo === 'ejercicios') {
          let name = b.nombre.replace('Ejercicios: ', '');
          if (name === 'Modelo Físico (DDL)') name = 'DDL';
          bloquesMap[b.id] = `RA${b.ra}: ${name}`;
        }
      });
    }
    // Fallback
    if (!bloquesMap[1]) bloquesMap[1] = 'RA3: DDL';
    if (!bloquesMap[2]) bloquesMap[2] = 'RA4: Consultas Básicas';
    if (!bloquesMap[3]) bloquesMap[3] = 'RA4: Consultas Avanzadas';
    if (!bloquesMap[4]) bloquesMap[4] = 'RA4: Consultas Difíciles';

    const validBds = ['arepazo', 'nba', 'alquiler', 'pokemon'];
    const bdIcons = { arepazo: '🍽️', nba: '🏀', alquiler: '🚗', pokemon: '⚡' };
    const bdNames = { arepazo: 'Arepazo', nba: 'NBA', alquiler: 'Alquiler', pokemon: 'Pokémon' };

    let html = '';
    
    // Primero, si hay bloquesActivos (el nuevo sistema de temario general)
    if (bloquesActivos.length > 0) {
      html += '<div class="col-12 mt-4 mb-2"><h5 class="text-white border-bottom border-secondary pb-2"><i class="fas fa-layer-group text-primary me-2"></i>Temario General</h5></div>';
      
      BLOQUES.forEach(bloque => {
        if (bloquesActivos.includes(bloque.id)) {
          const isTheory = bloque.tipo === 'teoria';
          
          let buttonsHtml = '';
          if (isTheory) {
            buttonsHtml = `<button class="btn btn-sm btn-outline-info w-100" onclick="window.location.href='teoria.html?bloqueId=${bloque.id}&claseId=${claseId}'">
              <i class="fas fa-book-reader me-1"></i> Ver Teoría
            </button>`;
          } else {
            buttonsHtml = `<button class="btn btn-sm btn-primary text-dark fw-bold w-100" onclick="window.location.href='ejercicio.html?bloqueId=${bloque.id}&claseId=${claseId}&modo=practica'">
              <i class="fas fa-laptop-code me-1"></i> Practicar Ejercicios
            </button>`;
          }

          html += `
            <div class="col-md-6 col-lg-4">
              <div class="task-card h-100 d-flex flex-column" style="border-top: 3px solid ${isTheory ? '#0dcaf0' : '#0d6efd'}">
                <div class="icon-circle mb-3"><i class="fas ${isTheory ? 'fa-book-open text-info' : 'fa-laptop-code text-primary'}"></i></div>
                <h5 class="text-white fw-bold mb-1">${bloque.nombre}</h5>
                <div class="text-secondary small mb-3 flex-grow-1">RA${bloque.ra} - Módulo ${bloque.modulo}</div>
                <div class="mt-auto pt-3 border-top" style="border-color:rgba(255,255,255,0.1)!important">
                  ${buttonsHtml}
                </div>
              </div>
            </div>
          `;
        }
      });
    }

    // Segundo, las tareas legacy (examen/práctica de BD concretas)
    if (Object.keys(tandasModo).length > 0) {
      html += '<div class="col-12 mt-4 mb-2"><h5 class="text-white border-bottom border-secondary pb-2"><i class="fas fa-tasks text-warning me-2"></i>Tareas Asignadas</h5></div>';
      
      for (let b = 1; b <= 4; b++) {
        validBds.forEach(bd => {
          const tId = `${b}:${bd}`;
          if (tandasModo[tId]) {
            const modo = tandasModo[tId];
            const modoIcon = modo === 'examen' ? 'fas fa-stopwatch text-danger' : 'fas fa-dumbbell text-success';
            const badgeColor = modo === 'examen' ? 'bg-danger' : 'bg-success';
            
            html += `
              <div class="col-md-6 col-lg-4">
                <div class="task-card h-100 cursor-pointer" onclick="window.location.href='ejercicio.html?tandaId=${tId}&claseId=${claseId}&modo=${modo}'">
                  <div class="d-flex justify-content-between mb-3">
                    <span style="font-size:1.8rem">${bdIcons[bd] || '🗄️'}</span>
                    <span class="badge ${badgeColor}" style="align-self:flex-start">${modo.toUpperCase()}</span>
                  </div>
                  <h5 class="text-white fw-bold mb-1">${bloquesMap[b]}</h5>
                  <div class="text-secondary small mb-3">Base de datos: <strong>${bdNames[bd] || bd}</strong></div>
                  
                  <div class="d-flex justify-content-between align-items-center mt-auto pt-3 border-top" style="border-color:rgba(255,255,255,0.1)!important">
                    <span class="text-muted small"><i class="${modoIcon} me-1"></i>Modo ${modo}</span>
                    <i class="fas fa-arrow-right text-muted"></i>
                  </div>
                </div>
              </div>
            `;
          }
        });
      }
    }
    
    if (!html) {
      html = '<div class="col-12"><div class="empty-state"><div class="icon">📭</div><h5>No hay tareas</h5><p>Tu profesor no ha asignado ninguna tarea ni temario para esta clase todavía.</p></div></div>';
    }

    container.innerHTML = html;

  } catch (e) {
    container.innerHTML = `<div class="col-12"><div class="alert alert-danger">Error: ${e.message}</div></div>`;
  }
}
