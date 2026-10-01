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

export async function initGradebook(claseActual, curriculum, currentTandasIds, currentTandasModo, currentBloquesActivos, currentExamenesActivos = []) {
  const admin = await initAdminPage();
  db = admin.db;
  fb = admin.fb;
  currentClase = claseActual;
  currentCurriculum = curriculum;
  examenesActivos = currentExamenesActivos;

  // 1. Identify active tasks
  activeTasks = [];
  
  // A) Tandas Interactivas
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

  // C) Custom Tasks / Exámenes Oficiales
  // The teacher maps custom tasks. If they mapped an Exam in the curriculum, we should show it here.
  // Wait, if an Exam is in the mapping, it means it's part of the curriculum. Should we always show it if it has weights?
  // Let's just show all mapped tasks from the curriculum that are "examen" or "custom".
  if (curriculum) {
    const allMapped = new Set();
    ['0372', '0377'].forEach(mod => {
      if (curriculum[mod] && curriculum[mod].mapeo) {
        for (const ra in curriculum[mod].mapeo) {
          for (const c in curriculum[mod].mapeo[ra]) {
            curriculum[mod].mapeo[ra][c].forEach(t => allMapped.add(t));
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
          label: `Examen RA${ra}`,
          type: 'examen'
        });
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
  try {
    const qTest = fb.query(fb.collection(db, 'examenes_test'), fb.where('claseId', '==', currentClase.id));
    const testSnap = await fb.getDocs(qTest);
    testSnap.forEach(snap => {
      const ex = snap.data();
      const exId = snap.id;
      const critSet = new Set();
      (ex.preguntas || []).forEach(p => { if (p.criterio && p.criterio !== 'N/A') critSet.add(p.criterio); });
      
      activeTasks.push({
        id: `test:${exId}`,
        mappedId: `test:${exId}`,
        label: `Examen: ${ex.titulo} (Global)`,
        type: 'examen_test_global',
        exId: exId,
        raHint: 1,
        estado: ex.estado,
        criteriosEvaluados: Array.from(critSet)
      });
      
      // Comentamos esto a petición del usuario: No quiere ver los criterios desglosados como columnas en la vista de Tareas.
      // Ya se ven en el modal del Resumen RA, y se calculan internamente.
      /*
      critSet.forEach(c => {
        const raNum = parseInt(c.charAt(0)) || 1;
        activeTasks.push({
          id: `test:${exId}:${c}`,
          mappedId: `test:${exId}:${c}`,
          label: `[Crit ${c}] Examen: ${ex.titulo}`,
          type: 'examen_test_crit',
          exId: exId,
          crit: c,
          raHint: raNum
        });
      });
      */

    });
  } catch (e) { console.error("Error loading test exams in gradebook:", e); }

  // 2. Fetch students
  students = [];
  const registradosIds = currentClase.alumnosIds || [];
  for (const uid of registradosIds) {
    const snap = await fb.getDoc(fb.doc(db, 'usuarios', uid));
    if (snap.exists()) {
      students.push({ uid, ...snap.data() });
    }
  }

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

      // Fetch Test Exam grades by criterion for this student
      testCriterioGrades[st.uid] = {};
      if (typeof testGradesGlobal === 'undefined') window.testGradesGlobal = {};
      if (typeof testGradesCrit === 'undefined') window.testGradesCrit = {};
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
          if (!data.entregadoEn || !data.notasCriterios) return;
          
          if (!bestAttempts[data.examenId] || data.nota > bestAttempts[data.examenId].nota) {
             bestAttempts[data.examenId] = data;
          }
        });
        
        for (const exId in bestAttempts) {
          // Ignorar intentos huérfanos de exámenes que han sido eliminados por el profesor
          const examExists = activeTasks.some(t => t.type === 'examen_test_global' && t.exId === exId);
          if (!examExists) continue;

          const data = bestAttempts[exId];
          window.testGradesGlobal[st.uid][`test:${data.examenId}`] = data.nota;
          
          for (const crit in data.notasCriterios) {
            const nota = data.notasCriterios[crit];
            if (nota === null) continue;
            
            window.testGradesCrit[st.uid][`test:${data.examenId}:${crit}`] = nota;
            
            if (!testCriterioGrades[st.uid][crit]) testCriterioGrades[st.uid][crit] = [];
            testCriterioGrades[st.uid][crit].push(nota);
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
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div class="btn-group btn-group-sm">
        <input type="radio" class="btn-check" name="entryMode" id="mode-student" ${entryMode === 'student' ? 'checked' : ''} onchange="window._setEntryMode('student')">
        <label class="btn btn-outline-primary" for="mode-student"><i class="fas fa-users me-1"></i>Por Alumno</label>

        <input type="radio" class="btn-check" name="entryMode" id="mode-task" ${entryMode === 'task' ? 'checked' : ''} onchange="window._setEntryMode('task')">
        <label class="btn btn-outline-primary" for="mode-task"><i class="fas fa-tasks me-1"></i>Por Tarea</label>
      </div>
  `;

  if (entryMode === 'task') {
    html += `<select class="form-select form-select-sm dark-input w-auto" onchange="window._setSelectedTask(this.value)">
      <option value="">-- Selecciona una tarea --</option>`;
    for (let i = 1; i <= 6; i++) {
      if (tasksByRA[i].length > 0) {
        html += `<optgroup label="Resultado de Aprendizaje ${i}">`;
        tasksByRA[i].forEach(t => {
          html += `<option value="${t.id}" ${selectedTaskId === t.id ? 'selected' : ''}>${t.label}</option>`;
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
    html += `<tr><th rowspan="2" style="width: 200px;" class="text-start sticky-left align-middle border-end">Alumno</th>`;
    for (let i = 1; i <= 6; i++) {
      if (tasksByRA[i].length > 0) {
        html += `<th colspan="${tasksByRA[i].length}" class="text-center bg-secondary bg-opacity-25 border-bottom-0">RA ${i}</th>`;
      }
    }
    html += `</tr><tr>`;
    // 2. Task headers
    for (let i = 1; i <= 6; i++) {
      tasksByRA[i].forEach(t => {
        const isVisible = visibilityConfig[t.id] === true;
        const eyeIcon = isVisible ? 'fa-eye text-success' : 'fa-eye-slash text-muted';
        const tooltip = taskOtherRAs[t.id] ? ` title="También evalúa RAs: ${taskOtherRAs[t.id]}"` : '';
        html += `
          <th style="min-width: 140px;" class="text-center align-middle bg-secondary bg-opacity-10">
            <div class="small fw-normal mb-1 text-wrap"${tooltip}>${t.label} ${taskOtherRAs[t.id] ? '<sup>*</sup>' : ''}</div>
            <button class="btn btn-sm btn-link p-0 text-decoration-none" onclick="window._toggleVisibility('${t.id}')">
              <i class="fas ${eyeIcon}" title="Alternar visibilidad"></i>
            </button>
          </th>
        `;
      });
    }
    html += `</tr></thead><tbody>`;

    students.forEach(st => {
      html += `<tr><td class="text-start sticky-left bg-dark text-nowrap border-end"><div class="text-info fw-bold small">${st.nombre || 'Sin Nombre'}</div></td>`;
      for (let i = 1; i <= 6; i++) {
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
                <input type="number" step="0.1" min="0" max="10" class="form-control form-control-sm text-center dark-input grade-input ${isManual ? 'border-warning' : ''}" placeholder="${placeholder}" data-uid="${st.uid}" data-tid="${t.id}" value="${score !== '' ? score : ''}" style="width: 60px;">
                <button class="btn btn-sm btn-outline-primary ms-1" onclick="window._openRubricaModal('${st.uid}', '${t.id}', '${escape(st.nombre || 'Sin Nombre')}')" title="Evaluar con Rúbrica">
                  <i class="fas fa-tasks"></i>
                </button>
              </div>
            </td>`;
          } else {
            html += `<td><input type="number" step="0.1" min="0" max="10" class="form-control form-control-sm text-center dark-input grade-input ${isManual ? 'border-warning' : ''}" placeholder="${placeholder}" data-uid="${st.uid}" data-tid="${t.id}" value="${score !== '' ? score : ''}" style="width: 70px; margin: 0 auto;"></td>`;
          }
        });
      }
      html += `</tr>`;
    });
    
    // Add Class Average Row
    html += `</tbody><tfoot><tr class="bg-black fw-bold border-top border-secondary">
               <td class="text-end pe-3 sticky-left bg-black border-end">MEDIA DE LA CLASE:</td>`;
    for (let i = 1; i <= 6; i++) {
      tasksByRA[i].forEach(t => {
        let sum = 0;
        let count = 0;
        students.forEach(st => {
          let val = undefined;
          if (t.type === 'tanda') {
            val = manualGrades[st.uid]?.[t.id];
            if (val === undefined) val = tandaGrades[st.uid]?.[t.id];
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
    html += `</tr></tfoot>`;
  } else {
    // Mode: Por Tarea
    const selectedTask = activeTasks.find(t => t.id === selectedTaskId);
    if (!selectedTask) {
      html += `<tr><th class="text-start">Selecciona una tarea para calificar</th></tr></thead><tbody><tr><td class="text-muted text-center py-4">Utiliza el desplegable superior para elegir una tarea.</td></tr>`;
    } else {
      const isVisible = visibilityConfig[selectedTask.id] === true;
      const eyeIcon = isVisible ? 'fa-eye text-success' : 'fa-eye-slash text-muted';
      html += `<tr><th style="width: 250px;" class="text-start sticky-left border-end">Alumno</th>
        <th class="text-center">
          ${selectedTask.label}
          <button class="btn btn-sm btn-link p-0 text-decoration-none ms-2" onclick="window._toggleVisibility('${selectedTask.id}')">
            <i class="fas ${eyeIcon}" title="Alternar visibilidad"></i>
          </button>
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
              <input type="number" step="0.1" min="0" max="10" class="form-control form-control-sm text-center dark-input grade-input ${isManual ? 'border-warning' : ''}" placeholder="${placeholder}" data-uid="${st.uid}" data-tid="${selectedTask.id}" value="${score !== '' ? score : ''}" style="width: 80px;">
              <button class="btn btn-sm btn-outline-primary ms-2" onclick="window._openRubricaModal('${st.uid}', '${selectedTask.id}', '${escape(st.nombre || 'Sin Nombre')}')" title="Evaluar con Rúbrica">
                <i class="fas fa-tasks"></i>
              </button>
            </div>
          </td></tr>`;
        } else {
          html += `<td><input type="number" step="0.1" min="0" max="10" class="form-control form-control-sm text-center dark-input grade-input ${isManual ? 'border-warning' : ''}" placeholder="${placeholder}" data-uid="${st.uid}" data-tid="${selectedTask.id}" value="${score !== '' ? score : ''}" style="width: 100px; margin: 0 auto;"></td></tr>`;
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
  entryMode = mode;
  renderGradebookTasks();
}

window._setSelectedTask = function(taskId) {
  selectedTaskId = taskId;
  renderGradebookTasks();
}

window._toggleVisibility = async function(id) {
  visibilityConfig[id] = !visibilityConfig[id];
  renderGradebookTasks();
  renderGradebookRAs();
  showAdminToast('info', 'Visibilidad cambiada. Recuerda Guardar Notas.');
}

async function saveGrades() {
  const btn = document.querySelector('#notas-pane .btn-danger');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  btn.disabled = true;

  try {
    // 1. Gather all manual inputs
    const inputs = document.querySelectorAll('.grade-input');
    const newManualGrades = {};
    students.forEach(st => newManualGrades[st.uid] = {});

    inputs.forEach(inp => {
      const val = inp.value.trim();
      if (val !== '') {
        const uid = inp.dataset.uid;
        const tid = inp.dataset.tid;
        newManualGrades[uid][tid] = parseFloat(val);
      }
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
       if (!raModules[t.raHint.toString()]) raModules[t.raHint.toString()] = currentCurriculum['0372'] ? '0372' : '0377';
    }
  });

  const sortedRAs = Array.from(activeRAs).sort((a, b) => parseInt(a) - parseInt(b));

  // 2. Build Header
  let thHtml = `<th style="width: 200px;" class="text-start sticky-left">Alumno</th>`;
  sortedRAs.forEach(ra => {
    const isVisible = visibilityConfig[`ra_${ra}`] === true;
    const eyeIcon = isVisible ? 'fa-eye text-success' : 'fa-eye-slash text-muted';
    thHtml += `
      <th class="text-center align-middle" style="min-width: 120px;">
        <div class="fw-bold mb-1">RA ${ra}</div>
        <button class="btn btn-sm btn-link p-0 text-decoration-none" onclick="window._toggleVisibility('ra_${ra}')">
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
            const manScore = manualGrades[st.uid]?.[t.id];
            
            if (t.type === 'examen_test_global') {
              if (manScore !== undefined && manScore !== '') {
                gradesForCrit.push(parseFloat(manScore));
              } else {
                const testCritId = ra + crit;
                const testNotas = testCriterioGrades[st.uid]?.[testCritId] || [];
                if (testNotas.length > 0) {
                  testNotas.forEach(n => gradesForCrit.push(n));
                } else if (t.estado === 'cerrado') {
                  gradesForCrit.push(0);
                }
              }
            } else {
              const autoScore = t.type === 'tanda' ? tandaGrades[st.uid]?.[t.id] : undefined;
              if (manScore !== undefined && manScore !== '') {
                gradesForCrit.push(parseFloat(manScore));
              } else if (autoScore !== undefined) {
                gradesForCrit.push(parseFloat(autoScore));
              }
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
