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

    const validBds = window.EJERCICIOS_DB ? Object.keys(window.EJERCICIOS_DB) : ['arepazo', 'nba', 'alquiler', 'pokemon'];
    const bdIcons = { arepazo: '🍽️', nba: '🏀', alquiler: '🚗', pokemon: '⚡', futbol: '⚽', refugio: '☢️', heroes: '🦸', hogwarts: '🧙', arkham: '🦇', dnd: '🎲', mmorpg: '⚔️', dungeon: '🐉', baloncesto: '🏀', cosmere: '🌌' };
    
    let html = '';
    
    // Primero, todos los bloques activos agrupados por Tema
    const bloquesActivosFull = window.BLOQUES ? window.BLOQUES.filter(b => bloquesActivos.includes(b.id)) : [];
    
    // Inyectar tareas legacy en la lista para que se agrupen por Tema
    for (let b = 1; b <= 4; b++) {
      validBds.forEach(bd => {
        const tId = `${b}:${bd}`;
        if (tandasModo[tId]) {
          const modo = tandasModo[tId];
          const bloqueRef = window.BLOQUES ? window.BLOQUES.find(bl => bl.id === b) : null;
          
          bloquesActivosFull.push({
            isLegacyTanda: true,
            tId: tId,
            modo: modo,
            bd: bd,
            nombre: bloquesMap[b],
            desc: `Base de datos: <strong>${bd.charAt(0).toUpperCase() + bd.slice(1)}</strong>`,
            temaRef: bloqueRef ? bloqueRef.temaRef : null,
            tipo: 'ejercicios_legacy'
          });
        }
      });
    }

    if (bloquesActivosFull.length > 0) {
      const groups = {};
      
      const getFriendlyTopicName = (temaStr) => {
        const numMatch = temaStr.match(/Tema\s+(\d+)/i);
        if (!numMatch) return temaStr;
        const numStr = numMatch[1];
        const isSegundo = clase.modulo === '0377';
        if (!isSegundo) {
          if (numStr === '1') return 'U1: Introducción a los SGBD';
          if (numStr === '2') return 'U2: Diseño Lógico y Conceptual';
          if (numStr === '3') return 'U3: Modelo Físico de Datos (DDL)';
          if (numStr === '4') return 'U4: Consultas en SQL (DML)';
          if (numStr === '5') return 'U5: Programación y Modificación de Datos';
          return `U${numStr}: Bases de Datos`;
        } else {
          if (numStr === '1') return 'U1: Instalación de SGBD';
          if (numStr === '2') return 'U2: Configuración y Arquitectura';
          if (numStr === '3') return 'U3: Seguridad y Control de Acceso';
          if (numStr === '4') return 'U4: Automatización Avanzada';
          if (numStr === '5') return 'U5: Optimización de Rendimiento';
          if (numStr === '6') return 'U6: Alta Disponibilidad';
          return `U${numStr}: Administración SGBD`;
        }
      };

      bloquesActivosFull.forEach(bloque => {
        let groupName = 'Otros';
        const match = bloque.nombre.match(/^(Tema\s+\d+)/i);
        if (match) {
          groupName = match[1];
        } else if (bloque.temaRef) {
          const temaBloque = window.BLOQUES ? window.BLOQUES.find(b => b.id === bloque.temaRef) : null;
          if (temaBloque) {
             const m2 = temaBloque.nombre.match(/^(Tema\s+\d+)/i);
             if (m2) groupName = m2[1];
          }
        } else if (bloque.tipo === 'tarea' && bloque.nombre.toLowerCase().includes('tarea')) {
          groupName = 'Tareas Prácticas';
        }
        
        const friendlyName = getFriendlyTopicName(groupName);
        if (!groups[friendlyName]) groups[friendlyName] = [];
        groups[friendlyName].push(bloque);
      });

      const groupKeys = Object.keys(groups).sort((a, b) => {
        if (a === 'Otros') return 1;
        if (b === 'Otros') return -1;
        if (a === 'Tareas Prácticas') return 1;
        if (b === 'Tareas Prácticas') return -1;
        const numA = parseInt(a.replace(/[^\d]/g, '')) || 0;
        const numB = parseInt(b.replace(/[^\d]/g, '')) || 0;
        return numA - numB;
      });

      groupKeys.forEach(groupName => {
        html += `<div class="col-12 mt-4 mb-3">
                   <h5 class="text-white border-bottom border-secondary pb-2">
                     <i class="fas fa-layer-group text-primary me-2"></i>${groupName}
                   </h5>
                   <div class="list-group list-group-flush w-100">`;
                   
        groups[groupName].forEach(bloque => {
          const isTheory = bloque.tipo === 'teoria';
          const isTask = bloque.tipo === 'tarea';
          
          let btnClass, btnText, iconClass, badgeClass, badgeText, borderColor;
          let linkHref = `teoria.html?bloqueId=${bloque.id}&claseId=${claseId}`;
          let namePrefixHtml = '';
          
          if (bloque.isLegacyTanda) {
            const isExamen = bloque.modo === 'examen';
            btnClass = isExamen ? 'btn-danger' : 'btn-success';
            btnText = 'Iniciar';
            iconClass = isExamen ? 'fa-stopwatch text-danger' : 'fa-dumbbell text-success';
            badgeClass = isExamen ? 'bg-danger' : 'bg-success';
            badgeText = bloque.modo.toUpperCase();
            borderColor = isExamen ? 'border-danger' : 'border-success';
            linkHref = `ejercicio.html?tandaId=${bloque.tId}&claseId=${claseId}&modo=${bloque.modo}`;
            namePrefixHtml = `<span style="font-size:1.1rem" class="d-none d-md-inline me-2">${bdIcons[bloque.bd] || '🗄️'}</span>`;
          } else if (isTheory) {
            btnClass = 'btn-outline-info';
            btnText = 'Ver Teoría';
            iconClass = 'fa-book-open text-info';
            badgeClass = 'bg-info';
            badgeText = 'Teoría';
            borderColor = 'border-info';
          } else if (isTask) {
            btnClass = 'btn-outline-warning';
            btnText = 'Ver Instrucciones';
            iconClass = 'fa-clipboard-list text-warning';
            badgeClass = 'bg-warning text-dark';
            badgeText = 'Tarea Offline';
            borderColor = 'border-warning';
          } else { // ejercicios
            btnClass = 'btn-primary text-dark fw-bold';
            btnText = 'Practicar';
            iconClass = 'fa-laptop-code text-primary';
            badgeClass = 'bg-primary';
            badgeText = 'Ejercicios';
            borderColor = 'border-primary';
            linkHref = `ejercicio.html?bloqueId=${bloque.id}&claseId=${claseId}&modo=practica`;
          }

          html += `
            <div class="list-group-item bg-dark border-secondary border-start border-4 ${borderColor} mb-2 rounded d-flex flex-column flex-md-row justify-content-between align-items-md-center p-3" style="transition: all 0.2s;">
              <div class="flex-grow-1 pe-3 mb-3 mb-md-0">
                <div class="d-flex align-items-center gap-2 mb-1">
                  ${namePrefixHtml}
                  <i class="fas ${iconClass} me-1 d-none d-md-inline"></i>
                  <span class="badge ${badgeClass}" style="font-size:0.7rem">${badgeText}</span>
                  <h6 class="mb-0 text-white">${bloque.nombre}</h6>
                </div>
                <div class="text-muted small ms-md-4">${bloque.desc || ''}</div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm ${btnClass} text-nowrap" onclick="window.location.href='${linkHref}'">
                  <i class="fas fa-eye"></i> ${btnText}
                </button>
              </div>
            </div>
          `;
        });
        
        html += `</div></div>`;
      });
    }

    
    
    if (!html) {
      html = '<div class="col-12"><div class="empty-state"><div class="icon">📭</div><h5>No hay tareas</h5><p>Tu profesor no ha asignado ninguna tarea ni temario para esta clase todavía.</p></div></div>';
    }

    container.innerHTML = html;

  } catch (e) {
    container.innerHTML = `<div class="col-12"><div class="alert alert-danger">Error: ${e.message}</div></div>`;
  }
}

window._showMyGrades = async function() {
  const modal = new bootstrap.Modal(document.getElementById('modal-my-grades'));
  modal.show();
  
  const container = document.getElementById('my-grades-list');
  container.innerHTML = '<div class="p-4 text-center text-muted"><i class="fas fa-spinner fa-spin"></i> Calculando...</div>';
  
  try {
    // We need the class curriculum and visibility config
    const claseSnap = await fb.getDoc(fb.doc(db, 'clases', claseId));
    if (!claseSnap.exists()) throw new Error("Clase no encontrada");
    const claseData = claseSnap.data();
    
    let curriculum = claseData.curriculum;
    if (!curriculum) {
      const tmplSnap = await fb.getDoc(fb.doc(db, 'usuarios', claseData.docenteId, 'curriculum', 'plantilla'));
      if (tmplSnap.exists()) curriculum = tmplSnap.data();
    }
    if (!curriculum) {
      container.innerHTML = '<div class="p-4 text-center text-muted">Tu profesor aún no ha configurado el currículum.</div>';
      return;
    }
    
    const visSnap = await fb.getDoc(fb.doc(db, 'clases', claseId, 'config', 'visibilidad'));
    const visConfig = visSnap.exists() ? visSnap.data() : {};
    
    // Fetch manual grades
    const manualSnap = await fb.getDoc(fb.doc(db, 'clases', claseId, 'notas', user.uid));
    const manualGrades = manualSnap.exists() ? manualSnap.data() : {};
    
    // Fetch tanda grades
    const tandaGrades = {};
    const q = fb.query(fb.collection(db, 'intentos_tandas'), fb.where('uid', '==', user.uid));
    const querySnapshot = await fb.getDocs(q);
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const tId = `tanda:${data.bloque}:${data.bd}`;
      // For student view, we just take the max score they got across modes
      if (!tandaGrades[tId] || data.nota > tandaGrades[tId]) tandaGrades[tId] = data.nota;
    });

    // Determine active tasks (similar to gradebook)
    const activeTasks = [];
    const currentTandasIds = claseData.tandasIds || [];
    const currentTandasModo = claseData.tandasModo || {};
    currentTandasIds.forEach(tId => {
      const [b, bd] = tId.split(':');
      const modo = currentTandasModo[tId] || 'practica';
      activeTasks.push({ id: `tanda:${tId}`, mappedId: `tanda:${b}:${modo}`, type: 'tanda' });
    });
    
    const currentBloquesActivos = claseData.bloquesActivos || [];
    if (window.BLOQUES) {
      window.BLOQUES.filter(b => b.tipo === 'tarea' && currentBloquesActivos.includes(b.id)).forEach(b => {
        activeTasks.push({ id: `bloque:${b.id}`, mappedId: `bloque:${b.id}`, type: 'offline' });
      });
    }
    
    ['0372', '0377'].forEach(mod => {
      if (curriculum[mod] && curriculum[mod].mapeo) {
        for (const ra in curriculum[mod].mapeo) {
          for (const c in curriculum[mod].mapeo[ra]) {
            curriculum[mod].mapeo[ra][c].forEach(taskId => {
              if ((taskId.startsWith('examen:') || taskId.startsWith('custom_')) && (claseData.examenesActivos || []).includes(taskId)) {
                if (!activeTasks.some(t => t.id === taskId)) {
                  activeTasks.push({ id: taskId, mappedId: taskId, type: 'other' });
                }
              }
            });
          }
        }
      }
    });
    
    // Compute RAs
    let html = '';
    let globalScore = 0;
    let globalWeightTotal = 0;
    let allRAsPassed = true;
    let evaluatedAnyRA = false;

    ['0372', '0377'].forEach(mod => {
      if (!curriculum[mod] || !curriculum[mod].mapeo) return;
      
      const pesosGenerales = curriculum[mod].pesos || {};
      
      for (const ra in curriculum[mod].mapeo) {
        if (visConfig[`ra_${ra}`] !== true) continue; // Not visible
        
        const critPesos = curriculum[mod].critPesos[ra] || {};
        const raPesoGlobal = pesosGenerales[ra] || 0;
        let raScore = 0;
        let evaluatedWeightsSum = 0;
        
        for (const crit in curriculum[mod].mapeo[ra]) {
          const critWeight = critPesos[crit] || 0;
          const gradesForCrit = [];
          
          activeTasks.forEach(t => {
            if (curriculum[mod].mapeo[ra][crit].includes(t.mappedId)) {
              const autoScore = t.type === 'tanda' ? tandaGrades[t.id] : undefined;
              const manScore = manualGrades[t.id];
              
              if (manScore !== undefined && manScore !== '') gradesForCrit.push(parseFloat(manScore));
              else if (autoScore !== undefined) gradesForCrit.push(parseFloat(autoScore));
            }
          });
          
          if (gradesForCrit.length > 0) {
            const critAvg = gradesForCrit.reduce((a, b) => a + b, 0) / gradesForCrit.length;
            raScore += critAvg * (critWeight / 100);
            evaluatedWeightsSum += critWeight;
          }
        }
        
        if (evaluatedWeightsSum > 0) {
          evaluatedAnyRA = true;
          const finalRaScore = (raScore / (evaluatedWeightsSum / 100));
          globalScore += finalRaScore * (raPesoGlobal / 100);
          globalWeightTotal += raPesoGlobal;
          
          const isPassed = finalRaScore >= 5;
          if (!isPassed) allRAsPassed = false;
          
          const scoreDisplay = isPassed ? finalRaScore.toFixed(2) : Math.round(finalRaScore);
          const badgeClass = isPassed ? 'bg-success' : 'bg-danger';
          const passText = isPassed ? 'Superado' : 'No superado';
          
          html += `
            <div class="list-group-item bg-dark border-secondary p-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div class="fw-bold text-light">Resultado de Aprendizaje ${ra}</div>
                  <div class="small text-muted">Módulo ${mod}</div>
                </div>
                <div class="text-end">
                  <div class="fs-5 fw-bold ${isPassed ? 'text-success' : 'text-danger'}">${scoreDisplay}</div>
                  <div class="badge ${badgeClass}">${passText}</div>
                </div>
              </div>
          `;
          
          // Render visible tasks
          const visibleTasksHtml = activeTasks.map(t => {
            if (visConfig[t.id] !== true) return '';
            const autoScore = t.type === 'tanda' ? tandaGrades[t.id] : undefined;
            const manScore = manualGrades[t.id];
            let displayScore = '-';
            if (manScore !== undefined && manScore !== '') displayScore = parseFloat(manScore).toFixed(2);
            else if (autoScore !== undefined) displayScore = parseFloat(autoScore).toFixed(2);
            
            // Only show tasks that evaluate THIS RA
            let evaluatesThisRa = false;
            for (const crit in curriculum[mod].mapeo[ra]) {
              if (curriculum[mod].mapeo[ra][crit].includes(t.mappedId)) evaluatesThisRa = true;
            }
            if (!evaluatesThisRa) return '';
            
            return `
              <div class="d-flex justify-content-between align-items-center small py-1 border-top border-secondary mt-1">
                <span class="text-secondary"><i class="fas fa-tasks me-1"></i> Tarea: ${t.id.replace('tanda:','').replace('bloque:','')}</span>
                <span class="text-light fw-bold">${displayScore}</span>
              </div>
            `;
          }).join('');
          
          html += visibleTasksHtml + `</div>`;
        }
      }
    });
    
    if (html === '') {
      container.innerHTML = '<div class="p-4 text-center text-muted">Tu docente aún no ha publicado ninguna calificación de RA para ti.</div>';
    } else {
      let globalHtml = '';
      if (evaluatedAnyRA && globalWeightTotal > 0) {
        const finalGlobal = (globalScore / (globalWeightTotal / 100));
        let globalDisplay = '-';
        let globalClass = 'text-warning';
        let globalLabel = 'Evaluación en Curso';
        
        if (allRAsPassed) {
          globalDisplay = finalGlobal.toFixed(2);
          globalClass = 'text-success';
          globalLabel = 'Media Global (Aprobado)';
        } else {
          globalDisplay = 'Suspenso';
          globalClass = 'text-danger';
          globalLabel = 'Módulo Suspenso (Requiere RAs)';
        }
        
        globalHtml = `
          <div class="list-group-item bg-secondary bg-opacity-10 border-secondary p-3 mt-3 rounded-bottom border-top-0 border-bottom-0 border-start-0 border-end-0">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-bold text-info">${globalLabel}</div>
                <div class="small text-muted">Todos los RAs deben estar superados</div>
              </div>
              <div class="text-end">
                <div class="fs-4 fw-bold ${globalClass}">${globalDisplay}</div>
              </div>
            </div>
          </div>
        `;
      }
      container.innerHTML = html + globalHtml;
    }
    
  } catch(e) {
    console.error(e);
    container.innerHTML = `<div class="p-4 text-center text-danger">Error al cargar notas: ${e.message}</div>`;
  }
};
