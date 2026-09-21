import { initAdminPage, showAdminToast } from './shared.js';

let db, fb;
let currentClase = null;
let currentCurriculum = null;
let activeTasks = []; // list of { id, label, type, ra, maxScore }
let students = []; // list of { uid, name, email }
let manualGrades = {}; // uid -> { taskId: score }
let tandaGrades = {}; // uid -> { taskId: score }
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
          label: `Examen Oficial RA ${ra} (${mod})`,
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
    // If not mapped, put in RA 1 by default (or maybe Unmapped? We assume mapped)
    if (allRas.size === 0) primaryRa = 1;
    
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
          } else {
            const manScore = manualGrades[st.uid]?.[t.id];
            if (manScore !== undefined) score = manScore;
          }
          html += `<td><input type="number" step="0.1" min="0" max="10" class="form-control form-control-sm text-center dark-input grade-input ${isManual ? 'border-warning' : ''}" placeholder="${placeholder}" data-uid="${st.uid}" data-tid="${t.id}" value="${score !== '' ? score : ''}" style="width: 70px; margin: 0 auto;"></td>`;
        });
      }
      html += `</tr>`;
    });
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
        
        html += `<tr><td class="text-start sticky-left bg-dark border-end"><div class="text-info fw-bold small">${st.nombre || 'Sin Nombre'}</div></td>
          <td><input type="number" step="0.1" min="0" max="10" class="form-control form-control-sm text-center dark-input grade-input ${isManual ? 'border-warning' : ''}" placeholder="${placeholder}" data-uid="${st.uid}" data-tid="${selectedTask.id}" value="${score !== '' ? score : ''}" style="width: 100px; margin: 0 auto;"></td></tr>`;
      });
    }
  }

  html += `</tbody></table></div>`;
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
  thHtml += `<th class="text-center align-middle" style="min-width: 120px;">Nota Módulo</th>`;
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
      
      for (const crit in currentCurriculum[mod].mapeo[ra]) {
        const critWeight = critPesos[crit] || 0;
        
        // Find tasks that evaluate this criterion and get their grades
        const gradesForCrit = [];
        activeTasks.forEach(t => {
          if (currentCurriculum[mod].mapeo[ra][crit].includes(t.mappedId)) {
            const autoScore = t.type === 'tanda' ? tandaGrades[st.uid]?.[t.id] : undefined;
            const manScore = manualGrades[st.uid]?.[t.id];
            
            if (manScore !== undefined && manScore !== '') {
              gradesForCrit.push(parseFloat(manScore));
            } else if (autoScore !== undefined) {
              gradesForCrit.push(parseFloat(autoScore));
            }
          }
        });
        
        if (gradesForCrit.length > 0) {
          // Average the grades for this criterion
          const critAvg = gradesForCrit.reduce((a, b) => a + b, 0) / gradesForCrit.length;
          raScore += critAvg * (critWeight / 100);
          evaluatedWeightsSum += critWeight;
        }
      }
      
      // Re-normalize if not all criteria were evaluated
      let finalRaScore = null;
      if (evaluatedWeightsSum > 0) {
        finalRaScore = (raScore / (evaluatedWeightsSum / 100));
        globalScore += finalRaScore * (raPesoGlobal / 100);
        globalWeightTotal += raPesoGlobal;
      }
      
      if (finalRaScore === null) {
        tbHtml += `<td class="text-muted">-</td>`;
        // No marcamos allRAsPassed = false porque aún no tiene nota, no está suspenso.
      } else {
        const passClass = finalRaScore >= 5 ? 'text-success' : 'text-danger fw-bold';
        if (finalRaScore < 5) allRAsPassed = false;
        tbHtml += `<td class="${passClass}">${finalRaScore.toFixed(2)}</td>`;
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
      tbHtml += `<td><span class="badge bg-danger">Suspenso (${finalGlobal.toFixed(2)})</span></td>`;
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
