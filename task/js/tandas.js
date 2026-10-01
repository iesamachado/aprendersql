import { initTaskPage, showToast } from './auth.js';

const { user, userDoc, db, fb } = await initTaskPage();
window.currentBloquesFull = [];
window.currentTestExams = [];
window.userTestSubmissions = new Set();
window.currentClase = null;
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

    window.currentBloquesFull = bloquesActivosFull;
    window.currentClase = clase;
    renderAllTandasUI();

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
    
    // Add custom mapped tasks
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

    // Add Test Exams
    const activeTestExams = window.currentTestExams || [];
    activeTestExams.forEach(ex => {
       const critSet = new Set();
       (ex.preguntas || []).forEach(p => { if (p.criterio && p.criterio !== 'N/A') critSet.add(p.criterio); });
       activeTasks.push({
         id: `test:${ex.id}`,
         mappedId: `test:${ex.id}`,
         type: 'examen_test_global',
         estado: ex.estado,
         criteriosEvaluados: Array.from(critSet)
       });
    });

    // Fetch test grades for student
    const testCriterioGrades = {};
    const testQ = fb.query(
      fb.collection(db, 'respuestas_test'),
      fb.where('uid', '==', user.uid),
      fb.where('claseId', '==', claseId)
    );
    const testSnap = await fb.getDocs(testQ);
    const bestAttempts = {};
    testSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.entregadoEn || !data.notasCriterios) return;
      if (!bestAttempts[data.examenId] || data.nota > bestAttempts[data.examenId].nota) {
         bestAttempts[data.examenId] = data;
      }
    });
    for (const exId in bestAttempts) {
      const examExists = activeTestExams.some(t => t.id === exId);
      if (!examExists) continue;
      const data = bestAttempts[exId];
      for (const crit in data.notasCriterios) {
        const nota = data.notasCriterios[crit];
        if (nota === null) continue;
        if (!testCriterioGrades[crit]) testCriterioGrades[crit] = [];
        testCriterioGrades[crit].push(nota);
      }
    }
    
    // Compute RAs
    let html = '';
    let globalScore = 0;
    let globalWeightTotal = 0;
    let allRAsPassed = true;
    let evaluatedAnyRA = false;

    // Identify active RAs (like in gradebook)
    const activeRAs = new Set();
    ['0372', '0377'].forEach(mod => {
      if (curriculum[mod] && curriculum[mod].mapeo) {
        for (const ra in curriculum[mod].mapeo) {
          let hasActiveTaskForRA = false;
          for (const crit in curriculum[mod].mapeo[ra]) {
            const mappedTasks = curriculum[mod].mapeo[ra][crit];
            activeTasks.forEach(t => {
              if (mappedTasks.includes(t.mappedId)) {
                activeRAs.add(ra);
              }
            });
          }
        }
      }
    });
    activeTasks.forEach(t => {
       // Si es un test con preguntas asociadas a un RA
       if (t.type === 'examen_test_global' && t.criteriosEvaluados.length > 0) {
          const raHint = t.criteriosEvaluados[0].charAt(0);
          activeRAs.add(raHint);
       }
    });

    ['0372', '0377'].forEach(mod => {
      if (!curriculum[mod]) return;
      
      const pesosGenerales = curriculum[mod].pesos || {};
      const allModRAs = Object.keys(curriculum[mod].critPesos || {}).sort((a,b) => parseInt(a) - parseInt(b));
      
      for (const ra of allModRAs) {
        if (visConfig[`ra_${ra}`] !== true) continue; // Not visible
        
        // Make sure this RA belongs to this module (we check critPesos)
        const critPesos = curriculum[mod].critPesos ? curriculum[mod].critPesos[ra] : null;
        if (!critPesos) continue;
        
        let raPesoGlobal = parseFloat(pesosGenerales[ra]) || 0;
        if (raPesoGlobal === 0) {
          raPesoGlobal = 100 / (allModRAs.length || 1);
        }
        
        let raScore = 0;
        let evaluatedWeightsSum = 0;
        let st_critDetails = {};
        
        for (const crit in critPesos) {
          const critWeight = critPesos[crit] || 0;
          const gradesForCrit = [];
          
          activeTasks.forEach(t => {
            if (curriculum[mod].mapeo && curriculum[mod].mapeo[ra] && curriculum[mod].mapeo[ra][crit] && curriculum[mod].mapeo[ra][crit].includes(t.mappedId)) {
              const manScore = manualGrades[t.id];
              
              if (t.type === 'examen_test_global') {
                if (manScore !== undefined && manScore !== '') {
                  gradesForCrit.push(parseFloat(manScore));
                } else {
                  const testCritId = ra + crit;
                  const testNotas = testCriterioGrades[testCritId] || [];
                  if (testNotas.length > 0) {
                    testNotas.forEach(n => gradesForCrit.push(n));
                  } else if (t.estado === 'cerrado') {
                    gradesForCrit.push(0);
                  }
                }
              } else {
                const autoScore = t.type === 'tanda' ? tandaGrades[t.id] : undefined;
                if (manScore !== undefined && manScore !== '') gradesForCrit.push(parseFloat(manScore));
                else if (autoScore !== undefined) gradesForCrit.push(parseFloat(autoScore));
              }
            }
          });
          
          if (gradesForCrit.length > 0) {
            const critAvg = gradesForCrit.reduce((a, b) => a + b, 0) / gradesForCrit.length;
            raScore += critAvg * (critWeight / 100);
            evaluatedWeightsSum += critWeight;
            st_critDetails[crit] = critAvg;
          }
        }
        
        let finalRaScore = null;
        if (evaluatedWeightsSum > 0) {
          finalRaScore = (raScore / (evaluatedWeightsSum / 100));
          globalScore += finalRaScore * (raPesoGlobal / 100);
          globalWeightTotal += raPesoGlobal;
        } else {
          // Fallback
          let sumFallback = 0;
          let countFallback = 0;
          for (const c in st_critDetails) {
            sumFallback += st_critDetails[c];
            countFallback++;
          }
          if (countFallback > 0) {
            finalRaScore = sumFallback / countFallback;
            globalScore += finalRaScore * (raPesoGlobal / 100);
            globalWeightTotal += raPesoGlobal;
          }
        }
        
        let raTitle = `Resultado de Aprendizaje ${ra}`;
        if (window.BOJA_DATA && window.BOJA_DATA[mod]) {
           const raObj = window.BOJA_DATA[mod].ras.find(r => r.id == ra);
           if (raObj) raTitle = raObj.descripcion;
        }
        
        if (finalRaScore !== null) {
          evaluatedAnyRA = true;

          const isPassed = finalRaScore >= 5;
          if (!isPassed) allRAsPassed = false;
          
          const scoreDisplay = isPassed ? finalRaScore.toFixed(2) : Math.trunc(finalRaScore);
          const badgeClass = isPassed ? 'bg-success' : 'bg-danger';
          const passText = isPassed ? 'Superado' : 'No superado';
          
          html += `
            <div class="list-group-item bg-dark border-secondary p-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div class="fw-bold text-light mb-1"><span class="badge bg-secondary me-2">RA ${ra}</span>${raTitle}</div>
                  <div class="small text-muted">Módulo ${mod}</div>
                </div>
                <div class="text-end">
                  <div class="fs-5 fw-bold ${isPassed ? 'text-success' : 'text-danger'}">${scoreDisplay}</div>
                  <div class="badge ${badgeClass}">${passText}</div>
                </div>
              </div>
          `;
        } else {
          html += `
            <div class="list-group-item bg-dark border-secondary p-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div class="fw-bold text-light mb-1"><span class="badge bg-secondary me-2">RA ${ra}</span>${raTitle}</div>
                  <div class="small text-muted">Módulo ${mod}</div>
                </div>
                <div class="text-end">
                  <div class="fs-5 fw-bold text-muted">-</div>
                  <div class="badge bg-secondary">Pendiente de nota</div>
                </div>
              </div>
          `;
        }
          
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
            
            let taskDisplayName = t.id.replace('tanda:','').replace('bloque:','');
            let taskIcon = 'fa-tasks';
            if (t.id.startsWith('examen:')) {
              const raNum = t.id.split(':')[2];
              taskDisplayName = `Examen RA${raNum}`;
              taskIcon = 'fa-file-signature text-warning';
            } else if (t.id.startsWith('custom_')) {
              const custom = (claseData.curriculum?.customTasks || []).find(x => x.id === t.id);
              if (custom) taskDisplayName = custom.nombre;
            } else if (t.type === 'examen_test_global') {
              const testExam = (window.currentTestExams || []).find(x => `test:${x.id}` === t.id);
              if (testExam) {
                taskDisplayName = `Test: ${testExam.titulo}`;
                taskIcon = 'fa-list-check text-info';
              }
            }

            return `
              <div class="d-flex justify-content-between align-items-center small py-1 border-top border-secondary mt-1">
                <span class="text-secondary"><i class="fas ${taskIcon} me-1"></i> ${taskDisplayName}</span>
                <span class="text-light fw-bold">${displayScore}</span>
              </div>
            `;
          }).join('');
          
          html += visibleTasksHtml + `</div>`;
      }
    });
    
    if (html === '') {
      container.innerHTML = '<div class="p-4 text-center text-muted">Tu docente aún no ha publicado ninguna calificación de RA para ti.</div>';
    } else {
      let globalHtml = '';
      if (evaluatedAnyRA && globalWeightTotal > 0) {
        if (visConfig['global'] === true) {
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
        } else {
          globalHtml = `
            <div class="list-group-item bg-secondary bg-opacity-10 border-secondary p-3 mt-3 rounded-bottom border-top-0 border-bottom-0 border-start-0 border-end-0">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <div class="fw-bold text-info">Nota Final del Módulo</div>
                  <div class="small text-muted">El docente publicará la nota final cuando termine la evaluación.</div>
                </div>
                <div class="text-end">
                  <div class="fs-4 fw-bold text-muted"><i class="fas fa-lock" style="font-size: 1.2rem;"></i></div>
                </div>
              </div>
            </div>
          `;
        }
      }
      container.innerHTML = html + globalHtml;
    }
    
  } catch(e) {
    console.error(e);
    container.innerHTML = `<div class="p-4 text-center text-danger">Error al cargar notas: ${e.message}</div>`;
  }
};

// Fetch Active Test Exams
import { query, where, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function loadActiveTestExams() {
  if (!userDoc || !userDoc.claseId) return;

  const exQuery = query(
    collection(db, "examenes_test"), 
    where("claseId", "==", userDoc.claseId),
    
  );

  onSnapshot(exQuery, (snap) => {
    let exams = [];
    if (!snap.empty) {
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.estado !== "oculto") {
          exams.push({ id: docSnap.id, ...d });
        }
      });
    }
    window.currentTestExams = exams;
    
    // Fetch submissions to know if the user already took the exams
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(module => {
      const { query, collection, where, getDocs } = module;
      const subQuery = query(collection(db, "respuestas_test"), where("uid", "==", user.uid), where("claseId", "==", userDoc.claseId));
      getDocs(subQuery).then(async subSnap => {
        window.userTestSubmissions.clear();
        subSnap.forEach(s => window.userTestSubmissions.add(s.data().examenId));
        
        try {
          const { doc, getDoc } = module;
          const visSnap = await getDoc(doc(db, 'clases', userDoc.claseId, 'config', 'visibilidad'));
          window.visConfig = visSnap.exists() ? visSnap.data() : {};
        } catch(err) {
          console.error("Error loading visibility config", err);
          window.visConfig = {};
        }
        
        renderAllTandasUI();
      }).catch(e => {
        console.error("Error cargando entregas de tests", e);
        renderAllTandasUI(); // render anyway
      });
    });
  });
}
// Run it after auth is ready
loadActiveTestExams();

function renderAllTandasUI() {
  const container = document.getElementById('tandas-container');
  if (!container || !window.currentClase) return;
  const clase = window.currentClase;
  
  let html = '';
  const groups = {};
  
  const getFriendlyTopicName = (temaStr, isRepasoGroup = false) => {
    const numMatch = temaStr.match(/Tema\s+(\d+)/i);
    const raMatch = temaStr.match(/RA\s*(\d+)/i);
    const isSegundo = clase.modulo === '0377';
    
    let numStr = null;
    if (numMatch) numStr = numMatch[1];
    else if (raMatch) numStr = raMatch[1];
    else return temaStr;
    
    const effectiveIsSegundo = isRepasoGroup ? false : isSegundo;
    let result = '';
    
    if (!effectiveIsSegundo) {
      if (numStr === '1') result = 'U1: Introducción a los SGBD';
      else if (numStr === '2') result = 'U2: Diseño Lógico y Conceptual';
      else if (numStr === '3') result = 'U3: Modelo Físico de Datos (DDL)';
      else if (numStr === '4') result = 'U4: Consultas en SQL (DML)';
      else if (numStr === '5') result = 'U5: Programación y Modificación de Datos';
      else result = `U${numStr}: Bases de Datos`;
    } else {
      if (numStr === '1') result = 'U1: Instalación de SGBD';
      else if (numStr === '2') result = 'U2: Configuración y Arquitectura';
      else if (numStr === '3') result = 'U3: Seguridad y Control de Acceso';
      else if (numStr === '4') result = 'U4: Automatización Avanzada';
      else if (numStr === '5') result = 'U5: Optimización de Rendimiento';
      else if (numStr === '6') result = 'U6: Alta Disponibilidad';
      else result = `U${numStr}: Administración SGBD`;
    }
    return isRepasoGroup ? `REPASO - ${result}` : result;
  };

  if (window.currentBloquesFull) {
    window.currentBloquesFull.forEach(bloque => {
      let groupName = 'Otros';
      let isRepasoGroup = false;
      if (clase.modulo && bloque.modulo && clase.modulo !== bloque.modulo) {
        isRepasoGroup = true;
      }
      
      let baseNombre = bloque.nombre || '';

      const match = baseNombre.match(/^(Tema\s+\d+|RA\s*\d+)/i);
      if (match) {
        groupName = match[1];
      } else if (bloque.temaRef) {
        const temaBloque = window.BLOQUES ? window.BLOQUES.find(b => b.id === bloque.temaRef) : null;
        if (temaBloque) {
           let refNombre = temaBloque.nombre || '';
           const m2 = refNombre.match(/^(Tema\s+\d+|RA\s*\d+)/i);
           if (m2) groupName = m2[1];
        }
      } else if (bloque.tipo === 'tarea' && baseNombre.toLowerCase().includes('tarea')) {
        groupName = 'Tareas Prácticas';
      }
      
      const friendlyName = getFriendlyTopicName(groupName, isRepasoGroup);
      if (!groups[friendlyName]) groups[friendlyName] = [];
      bloque.isRepasoBlock = isRepasoGroup;
      groups[friendlyName].push(bloque);
    });
  }

  if (window.currentTestExams) {
    window.currentTestExams.forEach(ex => {
      let groupName = 'Exámenes';
      let isRepasoGroup = false;
      
      let titulo = ex.titulo || '';
      if (titulo.toUpperCase().startsWith('REPASO_')) {
        isRepasoGroup = true;
      }

      if (ex.preguntas && ex.preguntas.length > 0 && ex.preguntas[0].ra) {
        groupName = `RA ${ex.preguntas[0].ra}`;
      } else {
        const titleMatch = titulo.match(/(RA\s*\d+|Tema\s*\d+)/i);
        if (titleMatch) groupName = titleMatch[1];
      }
      const friendlyName = getFriendlyTopicName(groupName, isRepasoGroup);
      if (!groups[friendlyName]) groups[friendlyName] = [];
      groups[friendlyName].push({ isNewTestExam: true, isRepasoBlock: isRepasoGroup, ...ex });
    });
  }

  // Inject Official Exams
  const visConfig = window.visConfig || {};
  if (clase.examenesActivos) {
    clase.examenesActivos.forEach(exId => {
      if (exId.startsWith('examen:')) {
        const [_, mod, ra] = exId.split(':');
        let groupName = `RA ${ra}`;
        const friendlyName = getFriendlyTopicName(groupName, false);
        if (!groups[friendlyName]) groups[friendlyName] = [];
        
        const fecha = (clase.examenesFechas && clase.examenesFechas[exId]) ? clase.examenesFechas[exId] : null;
        groups[friendlyName].push({
          isOfficialExam: true,
          id: exId,
          nombre: `Examen RA${ra}`,
          fecha: fecha,
          ra: ra,
          gradePublished: visConfig[exId] === true
        });
      }
    });
  }

  const groupKeys = Object.keys(groups).sort((a, b) => {
    const isRepasoA = a.startsWith('REPASO');
    const isRepasoB = b.startsWith('REPASO');
    if (isRepasoA && !isRepasoB) return 1;
    if (!isRepasoA && isRepasoB) return -1;

    if (a === 'Otros') return 1;
    if (b === 'Otros') return -1;
    if (a === 'Tareas Prácticas') return 1;
    if (b === 'Tareas Prácticas') return -1;
    if (a === 'Exámenes') return 1;
    if (b === 'Exámenes') return -1;
    const numA = parseInt(a.replace(/[^\d]/g, '')) || 0;
    const numB = parseInt(b.replace(/[^\d]/g, '')) || 0;
    return numA - numB;
  });

  if (groupKeys.length > 0) {
    html = `
      <div class="col-12 d-flex justify-content-end mb-3 gap-2">
        <button class="btn btn-sm btn-outline-secondary" onclick="document.querySelectorAll('.group-collapse').forEach(el => bootstrap.Collapse.getOrCreateInstance(el, {toggle: false}).show())">
          <i class="fas fa-expand-alt me-1"></i>Expandir todos
        </button>
        <button class="btn btn-sm btn-outline-secondary" onclick="document.querySelectorAll('.group-collapse').forEach(el => bootstrap.Collapse.getOrCreateInstance(el, {toggle: false}).hide())">
          <i class="fas fa-compress-alt me-1"></i>Comprimir todos
        </button>
      </div>
    ` + html;
  }

  groupKeys.forEach((groupName, idx) => {
    const groupIsRepaso = groupName.startsWith('REPASO');
    const headerTitleClass = groupIsRepaso ? 'text-warning' : 'text-white';
    const collapseId = `collapse-group-${idx}`;
    
    html += `<div class="col-12 mt-4 mb-3">
               <h5 class="${headerTitleClass} border-bottom border-secondary pb-2 cursor-pointer" data-bs-toggle="collapse" data-bs-target="#${collapseId}" style="cursor: pointer; user-select: none;">
                 <i class="fas fa-layer-group text-primary me-2"></i>${groupName}
                 <i class="fas fa-chevron-down float-end text-muted small mt-1"></i>
               </h5>
               <div id="${collapseId}" class="collapse show group-collapse">
                 <div class="list-group list-group-flush w-100">`;
               
    groups[groupName].forEach(bloque => {
      if (bloque.isNewTestExam) {
        const isClosed = bloque.estado === 'cerrado';
        const hasSubmitted = window.userTestSubmissions.has(bloque.id);
        
        let cardClass = 'bg-dark border-warning border-start border-4 mb-2 rounded p-3';
        let iconClass = 'fa-exclamation-triangle text-warning';
        let btnText = 'Comenzar Examen';
        let btnClass = 'btn-dark';
        let badge = '<span class="badge bg-danger blink" style="font-size:0.7rem">Activo</span>';
        let btnDisabled = '';
        let titleColor = 'text-warning';

        if (isClosed) {
           cardClass = 'bg-dark border-secondary border-start border-4 mb-2 rounded p-3 text-light';
           iconClass = 'fa-lock text-secondary';
           badge = '<span class="badge bg-secondary" style="font-size:0.7rem">Cerrado</span>';
           titleColor = 'text-light';
           if (hasSubmitted) {
             btnText = 'Ver Resultados';
             btnClass = 'btn-outline-info';
           } else {
             btnText = 'No Entregado (0)';
             btnClass = 'btn-outline-danger';
             btnDisabled = 'disabled';
           }
        } else if (hasSubmitted) {
           cardClass = 'bg-dark border-success border-start border-4 mb-2 rounded p-3';
           iconClass = 'fa-check-circle text-success';
           badge = '<span class="badge bg-success" style="font-size:0.7rem">Entregado</span>';
           titleColor = 'text-success';
           btnText = 'Examen Realizado';
           btnClass = 'btn-outline-success';
           btnDisabled = 'disabled';
        }
        
        html += `
          <div class="list-group-item d-flex flex-column flex-md-row justify-content-between align-items-md-center ${cardClass}" style="transition: all 0.2s;">
            <div class="flex-grow-1 pe-3 mb-3 mb-md-0">
              <div class="d-flex align-items-center gap-2 mb-1">
                <i class="fas ${iconClass} me-1 d-none d-md-inline"></i>
                ${badge}
                <h6 class="mb-0 ${titleColor}">${bloque.titulo}</h6>
              </div>
              <div class="text-muted small ms-md-4">Preguntas: <strong>${bloque.preguntas ? bloque.preguntas.length : 0}</strong> &nbsp;|&nbsp; Tiempo: <strong>${bloque.tiempoMinutos} min</strong></div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <button class="btn btn-sm ${btnClass} text-nowrap" ${btnDisabled} onclick="window.location.href='examen.html?id=${bloque.id}'">
                <i class="fas ${hasSubmitted && !isClosed ? 'fa-check' : 'fa-eye'}"></i> ${btnText}
              </button>
            </div>
          </div>
        `;
        return;
      }
      
      if (bloque.isOfficialExam) {
        const titleColor = 'text-warning';
        const cardClass = 'bg-dark border-warning border-start border-4 mb-2 rounded p-3 text-light';
        const badge = '<span class="badge bg-warning text-dark" style="font-size:0.7rem">Examen</span>';
        const iconClass = 'fa-file-signature text-warning';
        const fechaHtml = bloque.fecha ? `<div class="text-muted small ms-md-4"><i class="fas fa-calendar-alt me-1"></i>${new Date(bloque.fecha).toLocaleString()}</div>` : '';
        
        let buttonHtml = '';
        if (bloque.gradePublished) {
          buttonHtml = `
            <button class="btn btn-sm btn-warning text-nowrap fw-bold" onclick="window._showMyGrades()">
              <i class="fas fa-star me-1"></i> Ver Nota
            </button>
          `;
        } else {
          buttonHtml = `
            <button class="btn btn-sm btn-outline-warning text-nowrap disabled">
              <i class="fas fa-chalkboard-teacher me-1"></i> Presencial / Entregable
            </button>
          `;
        }

        html += `
          <div class="list-group-item d-flex flex-column flex-md-row justify-content-between align-items-md-center ${cardClass}" style="transition: all 0.2s;">
            <div class="flex-grow-1 pe-3 mb-3 mb-md-0">
              <div class="d-flex align-items-center gap-2 mb-1">
                <i class="fas ${iconClass} me-1 d-none d-md-inline"></i>
                ${badge}
                <h6 class="mb-0 ${titleColor}">${bloque.nombre}</h6>
              </div>
              ${fechaHtml}
            </div>
            <div class="d-flex align-items-center gap-2">
              ${buttonHtml}
            </div>
          </div>
        `;
        return;
      }

      const isTheory = bloque.tipo === 'teoria';
      const isTask = bloque.tipo === 'tarea';
      const isRepasoBlock = bloque.isRepasoBlock;
      
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
        namePrefixHtml = `<span style="font-size:1.1rem" class="d-none d-md-inline me-2">${{ arepazo: '🍽️', nba: '🏀', alquiler: '🚗', pokemon: '⚡', futbol: '⚽', refugio: '☢️', heroes: '🦸', hogwarts: '🧙', arkham: '🦇', dnd: '🎲', mmorpg: '⚔️', dungeon: '🐉', baloncesto: '🏀', cosmere: '🌌' }[bloque.bd] || '🗄️'}</span>`;
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

      if (isRepasoBlock) {
        badgeClass = 'bg-warning text-dark';
        borderColor = 'border-warning';
      }

      const bgClass = isRepasoBlock ? 'bg-black' : 'bg-dark';
      const textClass = isRepasoBlock ? 'text-warning' : 'text-white';
      const opacityStyle = isRepasoBlock ? 'opacity: 0.85; font-size: 0.95rem;' : '';

      html += `
        <div class="list-group-item ${bgClass} border-secondary border-start border-4 ${borderColor} mb-2 rounded d-flex flex-column flex-md-row justify-content-between align-items-md-center p-3" style="transition: all 0.2s; ${opacityStyle}">
          <div class="flex-grow-1 pe-3 mb-3 mb-md-0">
            <div class="d-flex align-items-center gap-2 mb-1">
              ${namePrefixHtml}
              <i class="fas ${iconClass} me-1 d-none d-md-inline"></i>
              ${isRepasoBlock ? '<span class="badge bg-secondary text-light" style="font-size:0.6rem">REPASO</span>' : ''}
              <span class="badge ${badgeClass}" style="font-size:0.7rem">${badgeText}</span>
              <h6 class="mb-0 ${textClass}">${bloque.nombre}</h6>
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
    
    html += `</div></div></div>`;
  });

  if (!html) {
    html = '<div class="col-12"><div class="empty-state"><div class="icon">📭</div><h5>No hay tareas</h5><p>Tu profesor no ha asignado ninguna tarea ni temario para esta clase todavía.</p></div></div>';
  }
  container.innerHTML = html;
}
