import { initAdminPage, showAdminToast } from './shared.js';

let db, fb;
let currentClase = null;
let currentCurriculum = null;
let activeTasks = []; // list of { id, label, type, ra, maxScore }
let students = []; // list of { uid, name, email }
let manualGrades = {}; // uid -> { taskId: score }
let tandaGrades = {}; // uid -> { taskId: score }
let testCriterioGrades = {}; // uid -> { criterio: [nota1, nota2, ...] } (de exámenes test online)
let visibilityConfig = {};
let examenesActivos = []; // "RA1": true, "tanda:1:arepazo": true
let collapsedRAs = new Set(); // Conjunto de números de RA plegados horizontalmente

function getTestExamenTema(ex) {
  if (ex.tema && !isNaN(parseInt(ex.tema))) return parseInt(ex.tema);
  if (ex.ra && !isNaN(parseInt(ex.ra))) return parseInt(ex.ra);
  
  if (Array.isArray(ex.preguntas) && ex.preguntas.length > 0) {
    const counts = {};
    ex.preguntas.forEach(p => {
      const t = parseInt(p.ra || p.tema);
      if (!isNaN(t) && t >= 1 && t <= 6) {
        counts[t] = (counts[t] || 0) + 1;
      }
    });
    let bestTema = null;
    let maxCount = 0;
    for (const t in counts) {
      if (counts[t] > maxCount) {
        maxCount = counts[t];
        bestTema = parseInt(t);
      }
    }
    if (bestTema) return bestTema;
  }
  
  const match = (ex.titulo || '').match(/(?:Tema|RA|T)\s*(\d+)/i);
  if (match) {
    const t = parseInt(match[1]);
    if (!isNaN(t) && t >= 1 && t <= 6) return t;
  }
  
  return 1;
}

export async function initGradebook(claseActual, curriculum, currentTandasIds, currentTandasModo, currentBloquesActivos, currentExamenesActivos = []) {
  const admin = await initAdminPage();
  db = admin.db;
  fb = admin.fb;
  currentClase = claseActual;
  currentCurriculum = curriculum;
  examenesActivos = currentExamenesActivos;

  // 1. Identify active tasks
  activeTasks = [];
  
  // A) Tandas Interactivas (Disponibles ÚNICAMENTE para 0372 - 1º de Gestión de BBDD)
  if (currentClase?.modulo !== '0377') {
    currentTandasIds.forEach(tId => {
      // tId is "b:bd" e.g. "1:arepazo"
      const [b, bd] = tId.split(':');
      const modo = currentTandasModo[tId] || 'practica';
      const mappedId = `tanda:${b}:${modo}`;
      
      let bLabel = '';
      if (b==='1') bLabel = 'Creación Tablas';
      if (b==='2') bLabel = 'Consultas Básicas';
      if (b==='3') bLabel = 'Agrupación';
      if (b==='4') bLabel = 'Subconsultas';
      if (b==='5') bLabel = 'Modificación (DML)';
      if (b==='6') bLabel = 'Programación';

      activeTasks.push({
        id: `tanda:${tId}`, // Unique ID for this specific run
        mappedId: mappedId, // ID used in curriculum mapping
        label: `Tanda ${bLabel} (${bd}) [${modo}]`,
        type: 'tanda',
        b: b,
        bd: bd,
        modo: modo
      });
    });
  }

  // B) Tareas Offline
  if (window.BLOQUES) {
    window.BLOQUES.filter(b => b.tipo === 'tarea' && currentBloquesActivos.includes(b.id)).forEach(b => {
      activeTasks.push({
        id: `bloque:${b.id}`,
        mappedId: `bloque:${b.id}`,
        label: `Tarea: ${b.nombre}`,
        type: 'offline'
      });
    });
  }

  // C) Custom Tasks / Exámenes Oficiales / Exámenes Test
  const allMapped = new Set();
  if (curriculum) {
    const mod = currentClase?.modulo || '0372';
    const targetMods = [mod];
    targetMods.forEach(m => {
      if (curriculum[m] && curriculum[m].mapeo) {
        for (const ra in curriculum[m].mapeo) {
          for (const c in curriculum[m].mapeo[ra]) {
            (curriculum[m].mapeo[ra][c] || []).forEach(t => allMapped.add(t));
          }
        }
      }
    });
    
    allMapped.forEach(taskId => {
      if (taskId.startsWith('examen:')) {
        const [_, mod, ra] = taskId.split(':');
        activeTasks.push({
          id: taskId,
          mappedId: taskId,
          label: `Examen Oficial RA${ra}`,
          type: 'examen',
          raHint: parseInt(ra)
        });
      }
      if (taskId.startsWith('test:')) {
        const parts = taskId.split(':');
        if (parts.length === 3) {
          const [_, mod, tema] = parts;
          activeTasks.push({
            id: taskId,
            mappedId: taskId,
            label: `Examen Test Tema ${tema}`,
            type: 'test_tema',
            tema: parseInt(tema),
            mod: mod,
            raHint: parseInt(tema)
          });
        }
      }
      if (taskId.startsWith('custom_')) {
        const custom = (curriculum.customTasks || []).find(t => t.id === taskId);
        activeTasks.push({
          id: taskId,
          mappedId: taskId,
          label: custom ? custom.nombre : taskId,
          type: 'custom'
        });
      }
    });
  }

  // D) Exámenes Test Activos (creados específicamente para esta clase)
  // Agrupados por tema (1 a 6) para calcular una única nota por tema mediante media aritmética
  window.classTestsByTema = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  window.classTestExams = [];
  try {
    const qTest = fb.query(fb.collection(db, 'examenes_test'), fb.where('claseId', '==', currentClase.id));
    const testSnap = await fb.getDocs(qTest);
    testSnap.forEach(snap => {
      const ex = snap.data();
      const exId = snap.id;
      const tema = getTestExamenTema(ex);
      const item = { id: exId, tema, ...ex };
      window.classTestExams.push(item);
      if (window.classTestsByTema[tema]) {
        window.classTestsByTema[tema].push(item);
      }
    });
  } catch (e) {
    console.error("Error loading test exams in gradebook:", e);
  }

  // Si hay exámenes test de un tema en esta clase o mapeados en el currículum, asegurar que el slot unificado existe en activeTasks
  const modActual = currentClase?.modulo || '0372';
  for (let tema = 1; tema <= 6; tema++) {
    const testTaskId = `test:${modActual}:${tema}`;
    const isMapped = allMapped.has(testTaskId);
    const hasExamsInClass = (window.classTestsByTema[tema] && window.classTestsByTema[tema].length > 0);
    if (isMapped || hasExamsInClass) {
      if (!activeTasks.some(t => t.id === testTaskId)) {
        activeTasks.push({
          id: testTaskId,
          mappedId: testTaskId,
          label: `Examen Test Tema ${tema}`,
          type: 'test_tema',
          tema: tema,
          mod: modActual,
          raHint: tema
        });
      }
    }
  }

  // 2. Fetch students
  students = [];
  const registradosIds = currentClase.alumnosIds || [];
  for (const uid of registradosIds) {
    const snap = await fb.getDoc(fb.doc(db, 'usuarios', uid));
    if (snap.exists()) {
      students.push({ uid, ...snap.data() });
    }
  }

  // Ordenar alumnos por orden alfabético
  students.sort((a, b) => {
    const nameA = (a.nombre || a.email || '').trim();
    const nameB = (b.nombre || b.email || '').trim();
    return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
  });

  // 3. Fetch Grades
  await fetchGrades();
  
  // 4. Render
  renderGradebookTasks();
  renderGradebookRAs();
  
  // Attach event listeners
  window._toggleGradebookView = toggleGradebookView;
  window._saveGrades = saveGrades;
}

async function fetchGrades() {
  manualGrades = {};
  tandaGrades = {};
  testCriterioGrades = {};
  visibilityConfig = {};

  try {
    // Fetch manual grades
    for (const st of students) {
      const snap = await fb.getDoc(fb.doc(db, 'clases', currentClase.id, 'notas', st.uid));
      if (snap.exists()) {
        manualGrades[st.uid] = snap.data();
      } else {
        manualGrades[st.uid] = {};
      }
      
      // Fetch Tanda grades for this student
      const q = fb.query(fb.collection(db, 'intentos_tandas'), fb.where('uid', '==', st.uid));
      const querySnapshot = await fb.getDocs(q);
      tandaGrades[st.uid] = {};
      
      // We want the BEST score for a given b, bd, and modo
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const tId = `tanda:${data.bloque}:${data.bd}`;
        if (activeTasks.some(t => t.id === tId && t.modo === data.modo)) {
          if (!tandaGrades[st.uid][tId] || data.nota > tandaGrades[st.uid][tId]) {
            tandaGrades[st.uid][tId] = data.nota;
          }
        }
      });

      // Fetch Test Exam grades by criterion and theme for this student
      testCriterioGrades[st.uid] = {};
      if (typeof window.testTemaGrades === 'undefined') window.testTemaGrades = {};
      if (typeof window.testGradesGlobal === 'undefined') window.testGradesGlobal = {};
      if (typeof window.testGradesCrit === 'undefined') window.testGradesCrit = {};
      window.testTemaGrades[st.uid] = {};
      window.testGradesGlobal[st.uid] = {};
      window.testGradesCrit[st.uid] = {};
      
      try {
        const testQ = fb.query(
          fb.collection(db, 'respuestas_test'),
          fb.where('uid', '==', st.uid),
          fb.where('claseId', '==', currentClase.id)
        );
        const testSnap = await fb.getDocs(testQ);
        
        // Group by examenId to handle multiple attempts (keep highest grade)
        const bestAttempts = {};
        
        testSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (!data.entregadoEn) return;
          
          if (!bestAttempts[data.examenId] || (data.nota !== undefined && data.nota > (bestAttempts[data.examenId].nota || 0))) {
             bestAttempts[data.examenId] = data;
          }
        });
        
        // 1. Calcular media aritmética para la columna unificada de Examen Test por Tema
        const modActual = currentClase?.modulo || '0372';
        for (let tema = 1; tema <= 6; tema++) {
          const examsInTema = window.classTestsByTema?.[tema] || [];
          const scores = [];
          examsInTema.forEach(ex => {
            const att = bestAttempts[ex.id];
            if (att && att.nota !== undefined && att.nota !== null) {
              scores.push(att.nota);
            }
          });

          const testTaskId = `test:${modActual}:${tema}`;
          if (scores.length > 0) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            window.testTemaGrades[st.uid][testTaskId] = avg;
          }
        }

        // 2. Compatibilidad con exámenes individuales y notas por criterios
        for (const exId in bestAttempts) {
          const data = bestAttempts[exId];
          window.testGradesGlobal[st.uid][`test:${data.examenId}`] = data.nota;
          
          if (data.notasCriterios) {
            for (const crit in data.notasCriterios) {
              const nota = data.notasCriterios[crit];
              if (nota === null) continue;
              
              window.testGradesCrit[st.uid][`test:${data.examenId}:${crit}`] = nota;
              
              if (!testCriterioGrades[st.uid][crit]) testCriterioGrades[st.uid][crit] = [];
              testCriterioGrades[st.uid][crit].push(nota);
            }
          }
        }
      } catch (e) {
        console.warn("No se pudieron cargar notas de exámenes test:", e);
      }
    }

    // Fetch visibility config
    const visSnap = await fb.getDoc(fb.doc(db, 'clases', currentClase.id, 'config', 'visibilidad'));
    if (visSnap.exists()) {
      visibilityConfig = visSnap.data();
    }
  } catch (e) {
    console.error("Error fetching grades", e);
  }
}

let entryMode = 'student'; // 'student' or 'task'
let selectedTaskId = null;

function getTaskWeightInRA(task, raId, currentCurriculum, activeTasks, tasksByRA) {
  if (!currentCurriculum) return 0;

  let mod = '0372';
  if (currentCurriculum['0377']?.critPesos?.[raId] || currentCurriculum['0377']?.mapeo?.[raId]) {
    mod = '0377';
  } else if (currentCurriculum['0372']?.critPesos?.[raId] || currentCurriculum['0372']?.mapeo?.[raId]) {
    mod = '0372';
  }

  const modData = currentCurriculum[mod];
  if (!modData || !modData.mapeo || !modData.mapeo[raId]) {
    const countInRa = (tasksByRA && tasksByRA[raId]) ? tasksByRA[raId].length : 0;
    if (countInRa > 0) return Math.round((100 / countInRa) * 10) / 10;
    return 0;
  }

  const mapeoRa = modData.mapeo[raId]; // crit -> [mappedTaskIds]
  const critPesos = modData.critPesos?.[raId] || {};

  const allCritKeys = Object.keys(mapeoRa);
  if (allCritKeys.length === 0) {
    const countInRa = (tasksByRA && tasksByRA[raId]) ? tasksByRA[raId].length : 0;
    if (countInRa > 0) return Math.round((100 / countInRa) * 10) / 10;
    return 0;
  }

  let hasConfiguredCritPesos = false;
  for (const c in critPesos) {
    if (parseFloat(critPesos[c]) > 0) {
      hasConfiguredCritPesos = true;
      break;
    }
  }

  let taskWeightSum = 0;
  let totalEvaluatedCritWeights = 0;

  allCritKeys.forEach(crit => {
    const mappedTaskIds = mapeoRa[crit] || [];
    const activeTasksForCrit = activeTasks.filter(at => mappedTaskIds.includes(at.mappedId));
    if (activeTasksForCrit.length === 0) return;

    let critWeight = 0;
    if (hasConfiguredCritPesos) {
      critWeight = parseFloat(critPesos[crit]) || 0;
    } else {
      critWeight = 100 / allCritKeys.length;
    }

    totalEvaluatedCritWeights += critWeight;

    const isThisTaskEvaluatingCrit = activeTasksForCrit.some(at => at.id === task.id || at.mappedId === task.mappedId);
    if (isThisTaskEvaluatingCrit) {
      taskWeightSum += (critWeight / activeTasksForCrit.length);
    }
  });

  if (totalEvaluatedCritWeights > 0) {
    const normalizedPct = (taskWeightSum / totalEvaluatedCritWeights) * 100;
    const rounded = Math.round(normalizedPct * 10) / 10;
    return (rounded % 1 === 0) ? rounded : rounded.toFixed(1);
  }

  const countInRa = (tasksByRA && tasksByRA[raId]) ? tasksByRA[raId].length : 0;
  if (countInRa > 0) return Math.round((100 / countInRa) * 10) / 10;
  return 0;
}

function getRaWeightInModule(raId, currentCurriculum, currentClase) {
  if (!currentCurriculum) return 0;
  const mod = currentClase?.modulo || (currentCurriculum['0377']?.raPesos?.[raId] !== undefined ? '0377' : '0372');
  const modData = currentCurriculum[mod];
  if (!modData || !modData.raPesos) return 0;
  const peso = parseFloat(modData.raPesos[raId]);
  return isNaN(peso) ? 0 : peso;
}

function syncCurrentInputsToMemory() {
  const inputs = document.querySelectorAll('.grade-input');
  inputs.forEach(inp => {
    const val = inp.value.trim();
    const uid = inp.dataset.uid;
    const tid = inp.dataset.tid;
    if (uid && tid) {
      if (!manualGrades[uid]) manualGrades[uid] = {};
      if (val !== '') {
        manualGrades[uid][tid] = parseFloat(val);
      } else {
        delete manualGrades[uid][tid];
      }
    }
  });
}

function getTaskScoreForStudent(t, stUid) {
  const manScore = manualGrades[stUid]?.[t.id];
  if (manScore !== undefined && manScore !== '') {
    const parsed = parseFloat(manScore);
    if (!isNaN(parsed)) return parsed;
  }
  if (t.type === 'tanda') {
    const auto = tandaGrades[stUid]?.[t.id];
    if (auto !== undefined && auto !== '') return parseFloat(auto);
  } else if (t.type === 'test_tema') {
    const auto = window.testTemaGrades?.[stUid]?.[t.id];
    if (auto !== undefined && auto !== '') return parseFloat(auto);
  } else if (t.type === 'examen_test_global') {
    const auto = window.testGradesGlobal?.[stUid]?.[t.id];
    if (auto !== undefined && auto !== '') return parseFloat(auto);
  } else if (t.type === 'examen_test_crit') {
    const auto = window.testGradesCrit?.[stUid]?.[t.id];
    if (auto !== undefined && auto !== '') return parseFloat(auto);
  }
  return null;
}

function getStudentRaGrade(st, raNum, tasksByRA) {
  const raStr = String(raNum);
  const mod = currentClase?.modulo || (currentCurriculum?.['0377']?.raPesos?.[raStr] !== undefined ? '0377' : '0372');
  const modData = currentCurriculum?.[mod];
  let finalRaScore = null;

  if (modData && modData.critPesos && modData.mapeo && modData.mapeo[raStr]) {
    const critPesos = modData.critPesos[raStr] || {};
    let raScore = 0;
    let evaluatedWeightsSum = 0;
    let fallbackSum = 0;
    let fallbackCount = 0;

    for (const crit in critPesos) {
      const critWeight = critPesos[crit] || 0;
      const gradesForCrit = [];

      activeTasks.forEach(t => {
        if (modData.mapeo[raStr]?.[crit]?.includes(t.mappedId)) {
          const score = getTaskScoreForStudent(t, st.uid);
          if (score !== null && !isNaN(score)) {
            gradesForCrit.push(score);
          } else if (t.type === 'examen_test_global' && t.estado === 'cerrado') {
            gradesForCrit.push(0);
          }
        }
      });

      if (gradesForCrit.length > 0) {
        const critAvg = gradesForCrit.reduce((a, b) => a + b, 0) / gradesForCrit.length;
        if (critWeight > 0) {
          raScore += critAvg * (critWeight / 100);
          evaluatedWeightsSum += critWeight;
        }
        fallbackSum += critAvg;
        fallbackCount++;
      }
    }

    if (evaluatedWeightsSum > 0) {
      finalRaScore = raScore / (evaluatedWeightsSum / 100);
    } else if (fallbackCount > 0) {
      finalRaScore = fallbackSum / fallbackCount;
    }
  }

  // Fallback: media de tareas de este RA si no hay criterios configurados
  if (finalRaScore === null && tasksByRA && tasksByRA[raNum]) {
    let taskSum = 0;
    let taskCount = 0;
    tasksByRA[raNum].forEach(t => {
      const score = getTaskScoreForStudent(t, st.uid);
      if (score !== null && !isNaN(score)) {
        taskSum += score;
        taskCount++;
      }
    });
    if (taskCount > 0) {
      finalRaScore = taskSum / taskCount;
    }
  }

  return finalRaScore;
}

function renderGradebookTasks() {
  const container = document.getElementById('gradebook-tasks-view');
  
  if (!currentCurriculum) {
    container.innerHTML = '<div class="alert alert-warning m-4"><i class="fas fa-exclamation-triangle me-2"></i><strong>No has configurado el Mapeo Curricular.</strong><br>El Cuaderno de Notas necesita saber qué tareas evalúan qué Resultados de Aprendizaje. Ve a la pestaña "Criterios Evaluación" en el menú lateral y guarda tu plantilla curricular.</div>';
    return;
  }

  if (students.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4">No hay alumnos para calificar.</div>';
    return;
  }

  // Agrupar tareas por RA principal (el más bajo)
  const tasksByRA = {};
  for (let i = 1; i <= 6; i++) tasksByRA[i] = [];
  const taskOtherRAs = {}; // taskId -> string of other RAs

  activeTasks.forEach(t => {
    let primaryRa = 6;
    let allRas = new Set();
    if (currentCurriculum) {
      ['0372', '0377'].forEach(mod => {
        if (currentCurriculum[mod] && currentCurriculum[mod].mapeo) {
          for (const ra in currentCurriculum[mod].mapeo) {
            for (const crit in currentCurriculum[mod].mapeo[ra]) {
              if (currentCurriculum[mod].mapeo[ra][crit].includes(t.mappedId)) {
                allRas.add(parseInt(ra));
                if (parseInt(ra) < primaryRa) primaryRa = parseInt(ra);
              }
            }
          }
        }
      });
    }
    // Si no está mapeada y no tiene un RA implícito (como los tests), NO la mostramos (petición del usuario)
    if (allRas.size === 0) {
      if (t.raHint) {
        primaryRa = t.raHint;
      } else {
        return; // ¡Ocultar tarea no mapeada!
      }
    }
    
    allRas.delete(primaryRa);
    if (allRas.size > 0) {
      taskOtherRAs[t.id] = Array.from(allRas).sort().join(', ');
    }
    tasksByRA[primaryRa].push(t);
  });

  // Selector HTML
  let html = `
    <style>
      .ra-collapsible-th {
        cursor: pointer;
        user-select: none;
        transition: background-color 0.15s ease-in-out;
      }
      .ra-collapsible-th:hover {
        background-color: rgba(255, 193, 7, 0.25) !important;
      }
      /* Quitar flechitas (spinners) de inputs de notas y permitir números de dos decimales sin corte */
      input.grade-input::-webkit-outer-spin-button,
      input.grade-input::-webkit-inner-spin-button {
        -webkit-appearance: none !important;
        margin: 0 !important;
      }
      input.grade-input[type="number"] {
        -moz-appearance: textfield !important;
        appearance: textfield !important;
      }
      input.grade-input {
        padding-left: 4px !important;
        padding-right: 4px !important;
        font-variant-numeric: tabular-nums;
      }
    </style>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div class="d-flex align-items-center gap-2">
        <div class="btn-group btn-group-sm">
          <input type="radio" class="btn-check" name="entryMode" id="mode-student" ${entryMode === 'student' ? 'checked' : ''} onchange="window._setEntryMode('student')">
          <label class="btn btn-outline-primary" for="mode-student"><i class="fas fa-users me-1"></i>Por Alumno</label>

          <input type="radio" class="btn-check" name="entryMode" id="mode-task" ${entryMode === 'task' ? 'checked' : ''} onchange="window._setEntryMode('task')">
          <label class="btn btn-outline-primary" for="mode-task"><i class="fas fa-tasks me-1"></i>Por Tarea</label>
        </div>

        ${entryMode === 'student' ? `
          <div class="btn-group btn-group-sm ms-2">
            <button class="btn btn-outline-secondary" onclick="window._collapseAllRAs()" title="Plegar todos los RAs para vista compacta">
              <i class="fas fa-compress-alt me-1"></i>Plegar todos
            </button>
            <button class="btn btn-outline-secondary" onclick="window._expandAllRAs()" title="Desplegar todas las tareas de todos los RAs">
              <i class="fas fa-expand-alt me-1"></i>Desplegar todos
            </button>
          </div>
        ` : ''}
      </div>
  `;

  if (entryMode === 'task') {
    html += `<select class="form-select form-select-sm dark-input w-auto" onchange="window._setSelectedTask(this.value)">
      <option value="">-- Selecciona una tarea --</option>`;
    for (let i = 1; i <= 6; i++) {
      if (tasksByRA[i].length > 0) {
        const raPeso = getRaWeightInModule(i, currentCurriculum, currentClase);
        const raPesoText = raPeso > 0 ? ` (${raPeso}% del módulo)` : '';
        html += `<optgroup label="Resultado de Aprendizaje ${i}${raPesoText}">`;
        tasksByRA[i].forEach(t => {
          const taskPct = getTaskWeightInRA(t, i, currentCurriculum, activeTasks, tasksByRA);
          html += `<option value="${t.id}" ${selectedTaskId === t.id ? 'selected' : ''}>${t.label} — [${taskPct}% de RA ${i}]</option>`;
        });
        html += `</optgroup>`;
      }
    }
    html += `</select>`;
  }
  html += `</div>`;

  html += `<div class="table-responsive">
    <table class="table table-dark table-sm mb-0 table-bordered text-center align-middle" id="gradebook-table">
      <thead>`;

  if (entryMode === 'student') {
    // 1. Super headers
    html += `<tr><th rowspan="2" style="width: 200px;" class="text-start sticky-left align-middle border-end">Alumno <i class="fas fa-sort-alpha-down text-info ms-1" style="font-size: 0.8rem;" title="Alumnos ordenados alfabéticamente"></i></th>`;
    for (let i = 1; i <= 6; i++) {
      if (tasksByRA[i].length > 0) {
        const isCollapsed = collapsedRAs.has(i);
        const colSpan = isCollapsed ? 1 : tasksByRA[i].length;
        const raPeso = getRaWeightInModule(i, currentCurriculum, currentClase);
        const raPesoBadge = raPeso > 0 
          ? `<span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-50 ms-1 fw-semibold" style="font-size: 0.72rem;" title="El RA ${i} vale un ${raPeso}% de la nota final del módulo">${raPeso}%</span>`
          : '';
        const chevronIcon = isCollapsed 
          ? '<i class="fas fa-chevron-right text-warning me-1"></i>' 
          : '<i class="fas fa-chevron-down text-warning me-1"></i>';
        const tasksBadge = isCollapsed 
          ? `<span class="badge bg-secondary ms-1 fw-normal" style="font-size: 0.65rem;" title="${tasksByRA[i].length} tareas plegadas">${tasksByRA[i].length} t.</span>` 
          : '';
        const titleTooltip = isCollapsed 
          ? `RA ${i} plegado (${tasksByRA[i].length} tareas). Haz clic para desplegar horizontalmente.` 
          : `Haz clic para plegar horizontalmente las tareas del RA ${i}`;

        html += `
          <th colspan="${colSpan}" 
              class="text-center align-middle bg-secondary ${isCollapsed ? 'bg-opacity-50 border border-warning border-opacity-50' : 'bg-opacity-25'} border-bottom-0 ra-collapsible-th" 
              onclick="window._toggleCollapseRA(${i})" 
              title="${titleTooltip}">
            <div class="d-inline-flex align-items-center justify-content-center">
              ${chevronIcon}
              <span class="fw-bold">RA ${i}</span>
              ${raPesoBadge}
              ${tasksBadge}
            </div>
          </th>`;
      }
    }
    html += `</tr><tr>`;

    // 2. Task headers
    for (let i = 1; i <= 6; i++) {
      if (tasksByRA[i].length === 0) continue;

      const isCollapsed = collapsedRAs.has(i);
      if (isCollapsed) {
        html += `
          <th style="min-width: 85px; width: 85px;" 
              class="text-center align-middle bg-secondary bg-opacity-25 ra-collapsible-th border-bottom"
              onclick="window._toggleCollapseRA(${i})"
              title="RA ${i} plegado. Haz clic para desplegar sus ${tasksByRA[i].length} tareas">
            <div class="text-warning small fw-bold"><i class="fas fa-layer-group me-1"></i>Nota RA</div>
            <div class="text-muted" style="font-size: 0.65rem;"><i class="fas fa-chevron-right me-1"></i>(Plegado)</div>
          </th>
        `;
      } else {
        tasksByRA[i].forEach(t => {
          const isVisible = visibilityConfig[t.id] === true;
          const eyeIcon = isVisible ? 'fa-eye text-success' : 'fa-eye-slash text-muted';
          const taskPct = getTaskWeightInRA(t, i, currentCurriculum, activeTasks, tasksByRA);
          const raPeso = getRaWeightInModule(i, currentCurriculum, currentClase);
          const globalContrib = raPeso > 0 ? ` (${Math.round((parseFloat(taskPct) * raPeso / 100) * 10) / 10}% del módulo global)` : '';
          const otherRasInfo = taskOtherRAs[t.id] ? ` · También evalúa: RA ${taskOtherRAs[t.id]}` : '';
          const tooltip = `title="Pondera ${taskPct}% en la nota del RA ${i}${globalContrib}${otherRasInfo}"`;
          html += `
            <th style="min-width: 140px;" class="text-center align-middle bg-secondary bg-opacity-10">
              <div class="small fw-normal mb-1 text-wrap"${tooltip}>${t.label} ${taskOtherRAs[t.id] ? '<sup>*</sup>' : ''}</div>
              <div class="d-flex justify-content-center align-items-center gap-2 mb-1">
                <span class="badge bg-info bg-opacity-25 text-info border border-info border-opacity-50 fw-semibold" style="font-size: 0.72rem;" ${tooltip}>
                  ${taskPct}% del RA
                </span>
                <button class="btn btn-sm btn-link p-0 text-decoration-none" onclick="window._toggleVisibility('${t.id}')">
                  <i class="fas ${eyeIcon}" title="Alternar visibilidad"></i>
                </button>
              </div>
            </th>
          `;
        });
      }
    }
    html += `</tr></thead><tbody>`;

    students.forEach(st => {
      html += `<tr><td class="text-start sticky-left bg-dark text-nowrap border-end"><div class="text-info fw-bold small">${st.nombre || 'Sin Nombre'}</div></td>`;
      for (let i = 1; i <= 6; i++) {
        if (tasksByRA[i].length === 0) continue;

        const isCollapsed = collapsedRAs.has(i);
        if (isCollapsed) {
          const raGrade = getStudentRaGrade(st, i, tasksByRA);
          let gradeHtml = '<span class="text-muted small">-</span>';
          if (raGrade !== null && !isNaN(raGrade)) {
            const pass = raGrade >= 5;
            const badgeClass = pass ? 'bg-success bg-opacity-75 text-white' : 'bg-danger bg-opacity-75 text-white';
            const displayScore = pass ? raGrade.toFixed(2) : Math.trunc(raGrade);
            gradeHtml = `<span class="badge ${badgeClass} font-monospace fs-6" title="Nota calculada del RA ${i}: ${raGrade.toFixed(2)}">${displayScore}</span>`;
          }
          html += `<td class="text-center align-middle bg-black bg-opacity-25 border-secondary" style="width: 85px;">${gradeHtml}</td>`;
        } else {
          tasksByRA[i].forEach(t => {
            let score = '';
            let isManual = false;
            let placeholder = '-';
            if (t.type === 'tanda') {
              const autoScore = tandaGrades[st.uid]?.[t.id];
              const manScore = manualGrades[st.uid]?.[t.id];
              if (manScore !== undefined) { score = manScore; isManual = true; }
              else if (autoScore !== undefined) { score = autoScore; }
              placeholder = 'Auto';
            } else if (t.type === 'test_tema') {
              const autoScore = window.testTemaGrades?.[st.uid]?.[t.id];
              const manScore = manualGrades[st.uid]?.[t.id];
              if (manScore !== undefined) { score = manScore; isManual = true; }
              else if (autoScore !== undefined) { score = autoScore.toFixed(2); }
              placeholder = autoScore !== undefined ? 'Auto' : '-';
            } else if (t.type === 'examen_test_global') {
              const autoScore = window.testGradesGlobal[st.uid]?.[t.id];
              const manScore = manualGrades[st.uid]?.[t.id];
              if (manScore !== undefined) { score = manScore; isManual = true; }
              else if (autoScore !== undefined) { score = autoScore.toFixed(2); }
              placeholder = 'Auto';
            } else if (t.type === 'examen_test_crit') {
              const autoScore = window.testGradesCrit[st.uid]?.[t.id];
              const manScore = manualGrades[st.uid]?.[t.id];
              if (manScore !== undefined) { score = manScore; isManual = true; }
              else if (autoScore !== undefined) { score = autoScore.toFixed(2); }
              placeholder = 'Auto';
            } else {
              const manScore = manualGrades[st.uid]?.[t.id];
              if (manScore !== undefined) score = manScore;
            }
            
            let hasRubrica = false;
            if (t.type === 'offline' && window.BLOQUES) {
              const bId = t.id.split(':')[1];
              const bDef = window.BLOQUES.find(x => x.id == bId);
              if (bDef && bDef.rubricaDocente && bDef.rubricaDocente.length > 0) {
                hasRubrica = true;
              }
            }
            
            if (hasRubrica) {
              html += `<td>
                <div class="d-flex align-items-center justify-content-center">
                  <input type="number" step="0.01" min="0" max="10" class="form-control form-control-sm text-center dark-input grade-input ${isManual ? 'border-warning' : ''}" placeholder="${placeholder}" data-uid="${st.uid}" data-tid="${t.id}" value="${score !== '' ? score : ''}" style="width: 75px;">
                  <button class="btn btn-sm btn-outline-primary ms-1" onclick="window._openRubricaModal('${st.uid}', '${t.id}', '${escape(st.nombre || 'Sin Nombre')}')" title="Evaluar con Rúbrica">
                    <i class="fas fa-tasks"></i>
                  </button>
                </div>
              </td>`;
            } else {
              html += `<td><input type="number" step="0.01" min="0" max="10" class="form-control form-control-sm text-center dark-input grade-input ${isManual ? 'border-warning' : ''}" placeholder="${placeholder}" data-uid="${st.uid}" data-tid="${t.id}" value="${score !== '' ? score : ''}" style="width: 78px; margin: 0 auto;"></td>`;
            }
          });
        }
      }
      html += `</tr>`;
    });
    
    // Add Class Average Row
    html += `</tbody><tfoot><tr class="bg-black fw-bold border-top border-secondary">
               <td class="text-end pe-3 sticky-left bg-black border-end">MEDIA DE LA CLASE:</td>`;
    for (let i = 1; i <= 6; i++) {
      if (tasksByRA[i].length === 0) continue;

      const isCollapsed = collapsedRAs.has(i);
      if (isCollapsed) {
        let raSum = 0;
        let raCount = 0;
        students.forEach(st => {
          const g = getStudentRaGrade(st, i, tasksByRA);
          if (g !== null && !isNaN(g)) {
            raSum += g;
            raCount++;
          }
        });
        const avg = raCount > 0 ? (raSum / raCount).toFixed(2) : '-';
        const color = avg === '-' ? 'text-muted' : (parseFloat(avg) >= 5 ? 'text-success' : 'text-danger');
        html += `<td class="text-center align-middle font-monospace fs-6 ${color}" style="width: 85px;" title="Media de la clase en RA ${i}: ${avg}">${avg}</td>`;
      } else {
        tasksByRA[i].forEach(t => {
          let sum = 0;
          let count = 0;
          students.forEach(st => {
            let val = undefined;
            if (t.type === 'tanda') {
              val = manualGrades[st.uid]?.[t.id];
              if (val === undefined) val = tandaGrades[st.uid]?.[t.id];
            } else if (t.type === 'test_tema') {
              val = manualGrades[st.uid]?.[t.id];
              if (val === undefined) val = window.testTemaGrades?.[st.uid]?.[t.id];
            } else if (t.type === 'examen_test_global') {
              val = manualGrades[st.uid]?.[t.id];
              if (val === undefined) val = window.testGradesGlobal[st.uid]?.[t.id];
            } else if (t.type === 'examen_test_crit') {
              val = manualGrades[st.uid]?.[t.id];
              if (val === undefined) val = window.testGradesCrit[st.uid]?.[t.id];
            } else {
              val = manualGrades[st.uid]?.[t.id];
            }
            if (val !== undefined && val !== '') {
              sum += parseFloat(val);
              count++;
            }
          });
          const avg = count > 0 ? (sum / count).toFixed(2) : '-';
          const color = avg === '-' ? 'text-muted' : (avg >= 5 ? 'text-success' : 'text-danger');
          html += `<td class="text-center align-middle fs-6 ${color}">${avg}</td>`;
        });
      }
    }
    html += `</tr></tfoot>`;
  } else {
    // Mode: Por Tarea
    const selectedTask = activeTasks.find(t => t.id === selectedTaskId);
    if (!selectedTask) {
      html += `<tr><th class="text-start">Selecciona una tarea para calificar</th></tr></thead><tbody><tr><td class="text-muted text-center py-4">Utiliza el desplegable superior para elegir una tarea.</td></tr>`;
    } else {
      const isVisible = visibilityConfig[selectedTask.id] === true;
      let taskRa = 1;
      for (let i = 1; i <= 6; i++) {
        if (tasksByRA[i].some(t => t.id === selectedTask.id)) {
          taskRa = i;
          break;
        }
      }
      const taskPct = getTaskWeightInRA(selectedTask, taskRa, currentCurriculum, activeTasks, tasksByRA);
      const otherRasInfo = taskOtherRAs[selectedTask.id] ? ` · También en RA: ${taskOtherRAs[selectedTask.id]}` : '';
      const tooltip = `title="Pondera ${taskPct}% en el RA ${taskRa}${otherRasInfo}"`;
      html += `<tr><th style="width: 250px;" class="text-start sticky-left border-end">Alumno <i class="fas fa-sort-alpha-down text-info ms-1" style="font-size: 0.8rem;" title="Alumnos ordenados alfabéticamente"></i></th>
        <th class="text-center">
          <div class="mb-1">${selectedTask.label}</div>
          <div class="d-flex justify-content-center align-items-center gap-2">
            <span class="badge bg-info bg-opacity-25 text-info border border-info border-opacity-50" ${tooltip}>
              ${taskPct}% del RA ${taskRa}
            </span>
            <button class="btn btn-sm btn-link p-0 text-decoration-none" onclick="window._toggleVisibility('${selectedTask.id}')">
              <i class="fas ${eyeIcon}" title="Alternar visibilidad"></i>
            </button>
          </div>
        </th></tr></thead><tbody>`;

      
      students.forEach(st => {
        let score = '';
        let isManual = false;
        let placeholder = '-';
        if (selectedTask.type === 'tanda') {
          const autoScore = tandaGrades[st.uid]?.[selectedTask.id];
          const manScore = manualGrades[st.uid]?.[selectedTask.id];
          if (manScore !== undefined) { score = manScore; isManual = true; }
          else if (autoScore !== undefined) { score = autoScore; }
          placeholder = 'Autocalc.';
        } else if (selectedTask.type === 'test_tema') {
          const autoScore = window.testTemaGrades?.[st.uid]?.[selectedTask.id];
          const manScore = manualGrades[st.uid]?.[selectedTask.id];
          if (manScore !== undefined) { score = manScore; isManual = true; }
          else if (autoScore !== undefined) { score = autoScore.toFixed(2); }
          placeholder = autoScore !== undefined ? 'Auto' : '-';
        } else {
          const manScore = manualGrades[st.uid]?.[selectedTask.id];
          if (manScore !== undefined) score = manScore;
        }
        
        let hasRubrica = false;
        if (selectedTask.type === 'offline' && window.BLOQUES) {
          const bId = selectedTask.id.split(':')[1];
          const bDef = window.BLOQUES.find(x => x.id == bId);
          if (bDef && bDef.rubricaDocente && bDef.rubricaDocente.length > 0) {
            hasRubrica = true;
          }
        }

        html += `<tr><td class="text-start sticky-left bg-dark border-end"><div class="text-info fw-bold small">${st.nombre || 'Sin Nombre'}</div></td>`;
        if (hasRubrica) {
          html += `<td>
            <div class="d-flex align-items-center justify-content-center">
              <input type="number" step="0.01" min="0" max="10" class="form-control form-control-sm text-center dark-input grade-input ${isManual ? 'border-warning' : ''}" placeholder="${placeholder}" data-uid="${st.uid}" data-tid="${selectedTask.id}" value="${score !== '' ? score : ''}" style="width: 85px;">
              <button class="btn btn-sm btn-outline-primary ms-2" onclick="window._openRubricaModal('${st.uid}', '${selectedTask.id}', '${escape(st.nombre || 'Sin Nombre')}')" title="Evaluar con Rúbrica">
                <i class="fas fa-tasks"></i>
              </button>
            </div>
          </td></tr>`;
        } else {
          html += `<td><input type="number" step="0.01" min="0" max="10" class="form-control form-control-sm text-center dark-input grade-input ${isManual ? 'border-warning' : ''}" placeholder="${placeholder}" data-uid="${st.uid}" data-tid="${selectedTask.id}" value="${score !== '' ? score : ''}" style="width: 90px; margin: 0 auto;"></td></tr>`;
        }
      });
      
      // Calculate average for the selected task
      let sum = 0;
      let count = 0;
      students.forEach(st => {
        let val = undefined;
        if (selectedTask.type === 'tanda') {
          val = manualGrades[st.uid]?.[selectedTask.id];
          if (val === undefined) val = tandaGrades[st.uid]?.[selectedTask.id];
        } else if (selectedTask.type === 'test_tema') {
          val = manualGrades[st.uid]?.[selectedTask.id];
          if (val === undefined) val = window.testTemaGrades?.[st.uid]?.[selectedTask.id];
        } else if (selectedTask.type === 'examen_test_global') {
          val = manualGrades[st.uid]?.[selectedTask.id];
          if (val === undefined) val = window.testGradesGlobal[st.uid]?.[selectedTask.id];
        } else if (selectedTask.type === 'examen_test_crit') {
          val = manualGrades[st.uid]?.[selectedTask.id];
          if (val === undefined) val = window.testGradesCrit[st.uid]?.[selectedTask.id];
        } else {
          val = manualGrades[st.uid]?.[selectedTask.id];
        }
        if (val !== undefined && val !== '') {
          sum += parseFloat(val);
          count++;
        }
      });
      const avg = count > 0 ? (sum / count).toFixed(2) : '-';
      const color = avg === '-' ? 'text-muted' : (avg >= 5 ? 'text-success' : 'text-danger');
      
      html += `</tbody><tfoot><tr class="bg-black fw-bold border-top border-secondary">
                 <td class="text-end pe-3 sticky-left bg-black border-end">MEDIA DE LA TAREA:</td>
                 <td class="text-center fs-5 ${color}">${avg}</td>
               </tr></tfoot>`;
    }
  }

  if (entryMode === 'student') {
     html += `</table></div>`;
  } else {
     html += `</table></div>`;
  }

  container.innerHTML = html;
}

window._setEntryMode = function(mode) {
  syncCurrentInputsToMemory();
  entryMode = mode;
  renderGradebookTasks();
};

window._setSelectedTask = function(taskId) {
  syncCurrentInputsToMemory();
  selectedTaskId = taskId;
  renderGradebookTasks();
};

window._toggleCollapseRA = function(raNum) {
  syncCurrentInputsToMemory();
  const num = parseInt(raNum);
  if (collapsedRAs.has(num)) {
    collapsedRAs.delete(num);
  } else {
    collapsedRAs.add(num);
  }
  renderGradebookTasks();
};

window._collapseAllRAs = function() {
  syncCurrentInputsToMemory();
  for (let i = 1; i <= 6; i++) {
    collapsedRAs.add(i);
  }
  renderGradebookTasks();
};

window._expandAllRAs = function() {
  syncCurrentInputsToMemory();
  collapsedRAs.clear();
  renderGradebookTasks();
};

window._toggleVisibility = async function(id) {
  visibilityConfig[id] = !visibilityConfig[id];
  renderGradebookTasks();
  renderGradebookRAs();
  showAdminToast('info', 'Visibilidad cambiada. Recuerda Guardar Notas.');
};

async function saveGrades() {
  const btn = document.querySelector('#notas-pane .btn-danger');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  btn.disabled = true;

  try {
    // 1. Gather all manual inputs and preserve existing manual grades
    syncCurrentInputsToMemory();
    const newManualGrades = {};
    students.forEach(st => {
      newManualGrades[st.uid] = { ...(manualGrades[st.uid] || {}) };
    });

    // 2. Save per student
    for (const st of students) {
      await fb.setDoc(fb.doc(db, 'clases', currentClase.id, 'notas', st.uid), newManualGrades[st.uid]);
    }
    manualGrades = newManualGrades;

    // 3. Save visibility
    await fb.setDoc(fb.doc(db, 'clases', currentClase.id, 'config', 'visibilidad'), visibilityConfig);

    showAdminToast('✅', 'Notas guardadas correctamente');
    
    // Re-render to update highlights and calc RAs
    renderGradebookTasks();
    renderGradebookRAs();
  } catch (e) {
    console.error(e);
    showAdminToast('❌', 'Error al guardar notas', 'error');
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

function renderGradebookRAs() {
  const header = document.getElementById('ra-summary-header');
  const body = document.getElementById('ra-summary-body');
  
  if (!currentCurriculum) {
    body.innerHTML = '<tr><td colspan="10" class="text-center text-warning py-4"><i class="fas fa-exclamation-triangle me-2"></i>No hay currículum configurado para calcular RAs.</td></tr>';
    return;
  }

  if (students.length === 0) {
    body.innerHTML = '<tr><td class="text-center text-muted py-4">No hay alumnos para calificar.</td></tr>';
    return;
  }

  // 1. Identify which RAs are active based on the mapped active tasks
  const activeRAs = new Set();
  const raModules = {}; // RA -> Mod (0372 or 0377)
  const taskToRAs = {}; // taskId -> list of { mod, ra, crit }
  
  if (currentCurriculum) {
    ['0372', '0377'].forEach(mod => {
      if (currentCurriculum[mod] && currentCurriculum[mod].mapeo) {
        for (const ra in currentCurriculum[mod].mapeo) {
          let hasActiveTaskForRA = false;
          for (const crit in currentCurriculum[mod].mapeo[ra]) {
            const mappedTasks = currentCurriculum[mod].mapeo[ra][crit];
            activeTasks.forEach(t => {
              if (mappedTasks.includes(t.mappedId)) {
                hasActiveTaskForRA = true;
                activeRAs.add(ra);
                raModules[ra] = mod;
                if (!taskToRAs[t.id]) taskToRAs[t.id] = [];
                taskToRAs[t.id].push({ mod, ra, crit });
              }
            });
          }
        }
      }
    });
  }
  
  // Incluir RAs implícitos de exámenes test y otras tareas
  activeTasks.forEach(t => {
    if (t.raHint) {
       activeRAs.add(t.raHint.toString());
       if (!raModules[t.raHint.toString()]) raModules[t.raHint.toString()] = currentClase?.modulo || (currentCurriculum?.['0377'] ? '0377' : '0372');
    }
  });

  const sortedRAs = Array.from(activeRAs).sort((a, b) => parseInt(a) - parseInt(b));

  // 2. Build Header
  let thHtml = `<th style="width: 200px;" class="text-start sticky-left">Alumno <i class="fas fa-sort-alpha-down text-info ms-1" style="font-size: 0.8rem;" title="Alumnos ordenados alfabéticamente"></i></th>`;
  sortedRAs.forEach(ra => {
    const mod = raModules[ra];
    const raPesoGlobal = currentCurriculum[mod]?.raPesos?.[ra] || 0;
    const isVisible = visibilityConfig[`ra_${ra}`] === true;
    const eyeIcon = isVisible ? 'fa-eye text-success' : 'fa-eye-slash text-muted';
    const pesoHtml = raPesoGlobal > 0 ? `<div class="small text-muted fw-normal" style="font-size: 0.72rem;">(${raPesoGlobal}% del módulo)</div>` : '';
    thHtml += `
      <th class="text-center align-middle" style="min-width: 120px;">
        <div class="fw-bold mb-1">RA ${ra}</div>
        ${pesoHtml}
        <button class="btn btn-sm btn-link p-0 text-decoration-none mt-1" onclick="window._toggleVisibility('ra_${ra}')">
          <i class="fas ${eyeIcon}" title="Alternar visibilidad del RA ${ra}"></i>
        </button>
      </th>
    `;
  });

  const isGlobalVisible = visibilityConfig['global'] === true;
  const globalEyeIcon = isGlobalVisible ? 'fa-eye text-success' : 'fa-eye-slash text-muted';
  thHtml += `
    <th class="text-center align-middle" style="min-width: 120px;">
      <div class="fw-bold mb-1">Nota Módulo</div>
      <button class="btn btn-sm btn-link p-0 text-decoration-none" onclick="window._toggleVisibility('global')">
        <i class="fas ${globalEyeIcon}" title="Alternar visibilidad de la Nota Módulo"></i>
      </button>
    </th>
  `;
  header.innerHTML = thHtml;

  // 3. Build Body and Calculate Grades
  let tbHtml = '';
  students.forEach(st => {
    tbHtml += `<tr><td class="text-start sticky-left bg-dark text-nowrap"><div class="text-info fw-bold small">${st.nombre || 'Sin Nombre'}</div></td>`;
    
    let allRAsPassed = true;
    let globalScore = 0;
    let globalWeightTotal = 0;

    sortedRAs.forEach(ra => {
      const mod = raModules[ra];
      const critPesos = currentCurriculum[mod].critPesos[ra] || {};
      const raPesoGlobal = currentCurriculum[mod].raPesos[ra] || 0;
      
      // Calculate each criterion score
      let raScore = 0;
      let evaluatedWeightsSum = 0;
      
      for (const crit in critPesos) {
        const critWeight = critPesos[crit] || 0;
        
        // Find tasks that evaluate this criterion and get their grades
        const gradesForCrit = [];
        activeTasks.forEach(t => {
          if (currentCurriculum[mod].mapeo[ra] && currentCurriculum[mod].mapeo[ra][crit] && currentCurriculum[mod].mapeo[ra][crit].includes(t.mappedId)) {
            const score = getTaskScoreForStudent(t, st.uid);
            if (score !== null && !isNaN(score)) {
              gradesForCrit.push(score);
            }
          }
        });
        
        if (gradesForCrit.length > 0) {
          // Average the grades for this criterion
          const critAvg = gradesForCrit.reduce((a, b) => a + b, 0) / gradesForCrit.length;
          raScore += critAvg * (critWeight / 100);
          evaluatedWeightsSum += critWeight;
          if (typeof st._critDetails === 'undefined') st._critDetails = {};
          if (typeof st._critDetails[ra] === 'undefined') st._critDetails[ra] = {};
          st._critDetails[ra][ra + crit] = critAvg;
        }
      }
      
      // Re-normalize if not all criteria were evaluated
      let finalRaScore = null;
      if (evaluatedWeightsSum > 0) {
        finalRaScore = (raScore / (evaluatedWeightsSum / 100));
        globalScore += finalRaScore * (raPesoGlobal / 100);
        globalWeightTotal += raPesoGlobal;
      } else {
        // Fallback: Si el profe no ha configurado pesos, hacemos media aritmética simple de los criterios evaluados
        let sumFallback = 0;
        let countFallback = 0;
        if (st._critDetails && st._critDetails[ra]) {
          for (const c in st._critDetails[ra]) {
            sumFallback += st._critDetails[ra][c];
            countFallback++;
          }
        }
        if (countFallback > 0) {
          finalRaScore = sumFallback / countFallback;
          globalScore += finalRaScore * (raPesoGlobal > 0 ? raPesoGlobal / 100 : 1 / sortedRAs.length);
          globalWeightTotal += (raPesoGlobal > 0 ? raPesoGlobal : 100 / sortedRAs.length);
        }
      }
      
      if (finalRaScore === null) {
        tbHtml += `<td class="text-muted text-center">-</td>`;
      } else {
        const passClass = finalRaScore >= 5 ? 'btn-outline-success' : 'btn-outline-danger fw-bold';
        if (finalRaScore < 5) allRAsPassed = false;
        
        const displayScore = finalRaScore >= 5 ? finalRaScore.toFixed(2) : Math.trunc(finalRaScore);
        const critDataJson = encodeURIComponent(JSON.stringify(st._critDetails[ra] || {}));
        tbHtml += `<td class="text-center">
                     <button class="btn btn-sm ${passClass} w-100 fw-bold" onclick="window._showRaDetails('${st.nombre}', '${ra}', '${displayScore}', '${critDataJson}')">
                       ${displayScore}
                     </button>
                   </td>`;
      }
    });
    
    // Global Score
    let finalGlobal = null;
    if (globalWeightTotal > 0) {
      finalGlobal = (globalScore / (globalWeightTotal / 100));
    }
    
    if (finalGlobal === null) {
      tbHtml += `<td class="text-muted">-</td>`;
    } else if (!allRAsPassed) {
      const displayGlobal = finalGlobal >= 5 ? finalGlobal.toFixed(2) : Math.trunc(finalGlobal);
      tbHtml += `<td><span class="badge bg-danger">Suspenso (${displayGlobal})</span></td>`;
    } else {
      tbHtml += `<td class="text-success fw-bold">${finalGlobal.toFixed(2)}</td>`;
    }

    tbHtml += `</tr>`;
  });
  
  body.innerHTML = tbHtml;
}

function toggleGradebookView() {
  const tView = document.getElementById('gradebook-tasks-view');
  const rView = document.getElementById('gradebook-ras-view');
  const btn = document.querySelector('button[onclick="window._toggleGradebookView()"]');
  if (tView.style.display === 'none') {
    tView.style.display = 'block';
    rView.style.display = 'none';
    btn.innerHTML = '<i class="fas fa-exchange-alt me-1"></i>Ver Resumen RAs';
  } else {
    tView.style.display = 'none';
    rView.style.display = 'block';
    btn.innerHTML = '<i class="fas fa-exchange-alt me-1"></i>Ver Matriz de Tareas';
    renderGradebookRAs(); // Ensure fresh calc
  }
}

window._refreshGradebookTasks = async function() {
  if (currentClase) {
    const snap = await fb.getDoc(fb.doc(db, 'clases', currentClase.id));
    if (snap.exists()) {
      const data = snap.data();
      // Re-init Gradebook with fresh data
      await initGradebook(currentClase, currentCurriculum, data.tandasIds || [], data.tandasModo || {}, data.bloquesActivos || [], data.examenesActivos || []);
    }
  }
};


window._showRaDetails = function(studentName, ra, raScore, critDataStr) {
  const critData = JSON.parse(decodeURIComponent(critDataStr));
  let modal = document.getElementById('ra-details-modal');
  if (!modal) {
    const html = `
    <div class="modal fade" id="ra-details-modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark text-light border-info">
          <div class="modal-header border-info bg-black">
            <h5 class="modal-title text-info"><i class="fas fa-search-plus me-2"></i>Detalle RA <span id="modal-ra-id"></span></h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <h6 class="text-white mb-3" id="modal-ra-student"></h6>
            <div class="table-responsive">
              <table class="table table-dark table-sm table-striped border-secondary text-center align-middle">
                <thead>
                  <tr>
                    <th class="text-start">Criterio</th>
                    <th>Nota</th>
                  </tr>
                </thead>
                <tbody id="modal-ra-body">
                </tbody>
                <tfoot>
                  <tr class="table-active border-top border-secondary">
                    <td class="text-start fw-bold">Nota Final RA</td>
                    <td class="fw-bold fs-5" id="modal-ra-score"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p class="small text-muted mt-2 mb-0"><i class="fas fa-info-circle me-1"></i>Las notas por criterio se ponderan según los pesos configurados en tu Mapeo Curricular para calcular la nota final del RA.</p>
          </div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    modal = document.getElementById('ra-details-modal');
  }
  
  document.getElementById('modal-ra-id').innerText = ra;
  document.getElementById('modal-ra-student').innerText = studentName;
  document.getElementById('modal-ra-score').innerText = raScore;
  
  let tb = '';
  const crits = Object.keys(critData).sort();
  if (crits.length === 0) {
    tb = '<tr><td colspan="2" class="text-muted py-3">No hay datos de criterios evaluados.</td></tr>';
  } else {
    crits.forEach(c => {
      const v = critData[c];
      const color = v >= 5 ? 'text-success' : 'text-danger fw-bold';
      tb += `<tr><td class="text-start fw-bold">Crit ${c}</td><td class="${color}">${v.toFixed(2)}</td></tr>`;
    });
  }
  document.getElementById('modal-ra-body').innerHTML = tb;
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};


window._updateRubricaTotal = function() {
  const inputs = document.querySelectorAll('.rubrica-pt-input');
  let total = 0;
  inputs.forEach(inp => {
    const v = parseFloat(inp.value);
    if (!isNaN(v)) total += v;
  });
  // Cap at 10 just in case
  if (total > 10) total = 10;
  document.getElementById('rubrica-nota-final').value = parseFloat(total.toFixed(2));
};

window._saveRubricaGrade = async function() {
  const ctx = window.currentRubricaContext;
  if (!ctx) return;
  const finalScore = document.getElementById('rubrica-nota-final').value;
  if (!finalScore) return;
  
  const inputEl = document.querySelector(`input.grade-input[data-uid="${ctx.uid}"][data-tid="${ctx.taskId}"]`);
  if (inputEl) {
    inputEl.value = finalScore;
    inputEl.classList.add('border-warning');
  }
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalRubrica'));
  modal.hide();
};
window.currentRubricaContext = null;

window._openRubricaModal = function(uid, taskId, stNombre) {
  stNombre = unescape(stNombre);
  const bId = taskId.split(':')[1];
  const bDef = window.BLOQUES.find(x => x.id == bId);
  if (!bDef || !bDef.rubricaDocente) return;
  
  window.currentRubricaContext = { uid, taskId };
  document.getElementById('rubrica-alumno-name').innerText = `Alumno: ${stNombre} | Tarea: ${bDef.nombre}`;
  
  const container = document.getElementById('rubrica-criterios-container');
  let html = '';
  bDef.rubricaDocente.forEach((r, idx) => {
    let maxPts = 10;
    const match = r.match(/\((\d+(?:\.\d+)?)\s*pts?\)/i);
    if (match) {
      maxPts = parseFloat(match[1]);
    }
    
    const numBoxes = Math.round(maxPts / 0.25);
    
    let boxesHtml = '';
    // Un box inicial para nota 0
    boxesHtml += `<div class="rubrica-box text-muted border border-secondary rounded-1 d-inline-block text-center me-1 mb-1" 
                       style="width: 30px; height: 30px; line-height: 28px; cursor: pointer; font-size: 0.8rem;"
                       onclick="window._setRubricaRowGrade(${idx}, 0, this)" title="0 pts">0</div>`;
                       
    for(let i=1; i<=numBoxes; i++) {
      const val = i * 0.25;
      boxesHtml += `<div class="rubrica-box text-muted border border-secondary rounded-1 d-inline-block text-center me-1 mb-1" 
                         style="width: 35px; height: 30px; line-height: 28px; cursor: pointer; font-size: 0.8rem;"
                         data-val="${val}"
                         onclick="window._setRubricaRowGrade(${idx}, ${val}, this)" title="${val} pts">${val}</div>`;
    }
    
    html += `
      <div class="mb-3 border-bottom border-secondary pb-2 rubrica-row" id="rubrica-row-${idx}">
        <label class="form-label text-light mb-1">${r}</label>
        <div class="d-flex flex-wrap align-items-center mt-1">
          ${boxesHtml}
          <input type="hidden" class="rubrica-pt-input" id="rubrica-val-${idx}" value="0">
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  // No podemos saber los subtotales individuales porque solo guardamos la nota final, 
  // así que por defecto empezarán en 0 a no ser que implementemos almacenamiento por criterio de rúbrica.
  // Pero dejaremos la nota final tal como estaba, aunque si tocan un botón se recalculará desde 0.
  const existingGrade = document.querySelector(`input.grade-input[data-uid="${uid}"][data-tid="${taskId}"]`).value;
  document.getElementById('rubrica-nota-final').value = existingGrade || '';
  
  const modal = new bootstrap.Modal(document.getElementById('modalRubrica'));
  modal.show();
};

window._setRubricaRowGrade = function(rowIdx, val, clickedBox) {
  const rowEl = document.getElementById(`rubrica-row-${rowIdx}`);
  const inputEl = document.getElementById(`rubrica-val-${rowIdx}`);
  inputEl.value = val;
  
  // Estilizar boxes
  const boxes = rowEl.querySelectorAll('.rubrica-box');
  boxes.forEach(box => {
    const boxVal = parseFloat(box.getAttribute('data-val') || 0);
    if (boxVal <= val && boxVal > 0) {
      box.classList.remove('text-muted', 'border-secondary', 'bg-dark');
      box.classList.add('bg-primary', 'text-white', 'border-primary');
    } else if (boxVal === 0 && val === 0) {
      box.classList.remove('text-muted', 'border-secondary', 'bg-dark');
      box.classList.add('bg-danger', 'text-white', 'border-danger');
    } else {
      box.classList.add('text-muted', 'border-secondary');
      box.classList.remove('bg-primary', 'bg-danger', 'text-white', 'border-primary', 'border-danger');
    }
  });
  
  window._updateRubricaTotal();
};

window._updateRubricaTotal = function() {
  const inputs = document.querySelectorAll('.rubrica-pt-input');
  let total = 0;
  inputs.forEach(inp => {
    const v = parseFloat(inp.value);
    if (!isNaN(v)) total += v;
  });
  // Cap at 10 just in case
  if (total > 10) total = 10;
  document.getElementById('rubrica-nota-final').value = parseFloat(total.toFixed(2));
};

window._saveRubricaGrade = async function() {
  const ctx = window.currentRubricaContext;
  if (!ctx) return;
  const finalScore = document.getElementById('rubrica-nota-final').value;
  if (!finalScore) return;
  
  const inputEl = document.querySelector(`input.grade-input[data-uid="${ctx.uid}"][data-tid="${ctx.taskId}"]`);
  if (inputEl) {
    inputEl.value = finalScore;
    inputEl.classList.add('border-warning');
    if (window._saveManualGrade) {
       window._saveManualGrade(inputEl);
    } else {
       inputEl.dispatchEvent(new Event('change'));
    }
  }
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('modalRubrica'));
  modal.hide();
};

// ============================================================================
// NAVEGACIÓN Y COMPORTAMIENTO DE INPUTS DE NOTAS (TABULADOR VERTICAL ENTRE ALUMNOS)
// ============================================================================
function handleGradeInputNavigation(currentInput, isShift = false) {
  if (!currentInput) return;

  // 1. Sincronizar inmediatamente el valor en memoria y destacar visualmente si es manual
  const val = currentInput.value.trim();
  const uid = currentInput.dataset.uid;
  const tid = currentInput.dataset.tid;
  if (uid && tid) {
    if (!manualGrades[uid]) manualGrades[uid] = {};
    if (val !== '') {
      manualGrades[uid][tid] = parseFloat(val);
      currentInput.classList.add('border-warning');
    } else {
      delete manualGrades[uid][tid];
      currentInput.classList.remove('border-warning');
    }
  }

  // 2. Localizar todos los inputs de la misma columna (misma tarea) en orden visual (top-down)
  const colInputs = Array.from(document.querySelectorAll(`input.grade-input[data-tid="${CSS.escape(tid)}"]`));
  if (colInputs.length === 0) return;

  const currentIndex = colInputs.indexOf(currentInput);
  if (currentIndex === -1) return;

  let targetInput = null;

  if (!isShift) {
    // Tabulador o Enter: BAJAR al siguiente alumno en la misma columna
    if (currentIndex + 1 < colInputs.length) {
      targetInput = colInputs[currentIndex + 1];
    } else {
      // Si llegó al último alumno de la columna:
      // Si estamos en la vista 'Por Alumno', pasar al primer alumno de la siguiente columna/tarea
      const firstRow = document.querySelector('#gradebook-tasks-container tbody tr');
      const firstRowInputs = Array.from(firstRow ? firstRow.querySelectorAll('input.grade-input') : []);
      const taskIds = firstRowInputs.map(inp => inp.dataset.tid);
      const curTaskIdx = taskIds.indexOf(tid);
      if (curTaskIdx !== -1 && curTaskIdx + 1 < taskIds.length) {
        const nextTid = taskIds[curTaskIdx + 1];
        const nextColInputs = Array.from(document.querySelectorAll(`input.grade-input[data-tid="${CSS.escape(nextTid)}"]`));
        if (nextColInputs.length > 0) targetInput = nextColInputs[0];
      }
      if (!targetInput) {
        targetInput = colInputs[0]; // volver al inicio de la columna
      }
    }
  } else {
    // Shift + Tabulador: SUBIR al alumno anterior en la misma columna
    if (currentIndex - 1 >= 0) {
      targetInput = colInputs[currentIndex - 1];
    } else {
      // Si está en el primer alumno, subir al último alumno de la columna anterior
      const firstRow = document.querySelector('#gradebook-tasks-container tbody tr');
      const firstRowInputs = Array.from(firstRow ? firstRow.querySelectorAll('input.grade-input') : []);
      const taskIds = firstRowInputs.map(inp => inp.dataset.tid);
      const curTaskIdx = taskIds.indexOf(tid);
      if (curTaskIdx > 0) {
        const prevTid = taskIds[curTaskIdx - 1];
        const prevColInputs = Array.from(document.querySelectorAll(`input.grade-input[data-tid="${CSS.escape(prevTid)}"]`));
        if (prevColInputs.length > 0) targetInput = prevColInputs[prevColInputs.length - 1];
      }
      if (!targetInput) {
        targetInput = colInputs[colInputs.length - 1]; // ir al final de la columna
      }
    }
  }

  if (targetInput) {
    targetInput.focus();
    targetInput.select();
    targetInput.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

if (!window._gradebookKeydownAttached) {
  window._gradebookKeydownAttached = true;

  // Interceptar Tabulador y Enter para bajar al siguiente alumno
  document.addEventListener('keydown', (e) => {
    if (!e.target || !e.target.matches('input.grade-input')) return;
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      handleGradeInputNavigation(e.target, e.shiftKey);
    }
  });

  // Evitar que la rueda del ratón cambie la nota accidentalmente al hacer scroll
  document.addEventListener('wheel', (e) => {
    if (e.target && e.target.matches('input.grade-input') && document.activeElement === e.target) {
      e.preventDefault();
    }
  }, { passive: false });

  // Sincronizar en memoria y marcar borde amarillo al teclear
  document.addEventListener('input', (e) => {
    if (!e.target || !e.target.matches('input.grade-input')) return;
    const inp = e.target;
    const val = inp.value.trim();
    const uid = inp.dataset.uid;
    const tid = inp.dataset.tid;
    if (uid && tid) {
      if (!manualGrades[uid]) manualGrades[uid] = {};
      if (val !== '') {
        manualGrades[uid][tid] = parseFloat(val);
        inp.classList.add('border-warning');
      } else {
        delete manualGrades[uid][tid];
        inp.classList.remove('border-warning');
      }
    }
  });
}

