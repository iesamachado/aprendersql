import { initAdminPage, showAdminToast } from './shared.js';

const { db, fb, user } = await initAdminPage(['admin', 'docente']);

let clases = [];
let currentContext = 'template'; 
let currentModule = '0372';
let curriculumData = { customTasks: [] };
let taskOptions = []; 

async function init() {
  document.getElementById('context-selector').addEventListener('change', async (e) => {
    currentContext = e.target.value;
    await loadCurriculum();
    renderAll();
  });

  document.getElementById('module-selector').addEventListener('change', (e) => {
    currentModule = e.target.value;
    renderAll();
  });

  document.getElementById('btn-save-curriculum').addEventListener('click', saveCurriculum);
  document.getElementById('btn-add-custom-task').addEventListener('click', addCustomTask);

  await loadClases();
  await loadCurriculum();
  renderAll();
}

function getModData() {
  if (!curriculumData[currentModule]) {
    curriculumData[currentModule] = { raPesos: {}, critPesos: {}, mapeo: {} };
  }
  return curriculumData[currentModule];
}

function buildTaskOptions() {
  taskOptions = [];
  
  const mData = window.BOJA_DATA[currentModule];
  if (mData) {
    mData.ras.forEach(ra => {
      taskOptions.push({ id: `examen:${currentModule}:${ra.id}`, label: `Examen Oficial RA ${ra.id}`, group: 'Exámenes', ra: ra.id });
    });
  }

  (window.BLOQUES || []).filter(b => b.tipo === 'tarea').forEach(b => {
    taskOptions.push({ id: `bloque:${b.id}`, label: `Tarea: ${b.nombre}`, group: 'Tareas Offline', ra: b.ra || null });
  });
  for (let b = 1; b <= 6; b++) {
    let raStr = b === 1 ? '3' : (b >= 2 && b <= 4 ? '4' : '5');
    let bLabel = '';
    if (b===1) bLabel = 'Creación de Tablas (DDL)';
    if (b===2) bLabel = 'Consultas Básicas (SELECT)';
    if (b===3) bLabel = 'Agrupación (GROUP BY)';
    if (b===4) bLabel = 'Subconsultas';
    if (b===5) bLabel = 'Modificación de Datos (DML)';
    if (b===6) bLabel = 'Programación SQL (Funciones/Procs)';
    taskOptions.push({ id: `tanda:${b}:practica`, label: `Bloque ${b} [MODO PRÁCTICA]: ${bLabel}`, group: 'Ejercicios Prácticos (Interactivos)', ra: raStr });
    taskOptions.push({ id: `tanda:${b}:examen`, label: `Bloque ${b} [MODO EXAMEN]: ${bLabel}`, group: 'Ejercicios Prácticos (Interactivos)', ra: raStr });
  }
  if (curriculumData.customTasks) {
    curriculumData.customTasks.forEach(t => {
      taskOptions.push({ id: t.id, label: `Personalizada: ${t.nombre}`, group: 'Tareas Personalizadas (Offline)', ra: null });
    });
  }
}

async function loadClases() {
  try {
    const q = fb.query(fb.collection(db, 'clases'), fb.where('docenteId', '==', user.uid));
    const snap = await fb.getDocs(q);
    const sel = document.getElementById('context-selector');
    snap.forEach(d => {
      clases.push({ id: d.id, ...d.data() });
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `🏫 Clase: ${d.data().nombre} (${d.data().curso || ''})`;
      sel.appendChild(opt);
    });
  } catch (e) { console.error('Error loading clases:', e); }
}

async function loadCurriculum() {
  document.getElementById('context-info').innerHTML = '<span class="text-info"><i class="fas fa-spinner fa-spin"></i> Cargando...</span>';
  try {
    let docRef = currentContext === 'template' 
      ? fb.doc(db, 'usuarios', user.uid, 'curriculum', 'plantilla')
      : fb.doc(db, 'clases', currentContext);
    
    const snap = await fb.getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      let curr = currentContext === 'template' ? data : data.curriculum;
      
      if (!curr && currentContext !== 'template') {
        const tSnap = await fb.getDoc(fb.doc(db, 'usuarios', user.uid, 'curriculum', 'plantilla'));
        if (tSnap.exists()) curr = tSnap.data();
      }
      
      curriculumData = curr || { customTasks: [] };
    } else {
      if (currentContext !== 'template') {
         const tSnap = await fb.getDoc(fb.doc(db, 'usuarios', user.uid, 'curriculum', 'plantilla'));
         if (tSnap.exists()) curriculumData = tSnap.data();
         else curriculumData = { customTasks: [] };
      } else {
         curriculumData = { customTasks: [] };
      }
    }
    
    // Convert old single module structure to multi-module
    if (curriculumData.modulo && !curriculumData['0372']) {
      const oldMod = curriculumData.modulo;
      curriculumData[oldMod] = { raPesos: curriculumData.pesos || {}, critPesos: {}, mapeo: curriculumData.mapeo || {} };
      delete curriculumData.modulo;
      delete curriculumData.pesos;
      delete curriculumData.mapeo;
    }
    
    document.getElementById('context-info').innerHTML = '<span class="text-success"><i class="fas fa-check"></i> Cargado</span>';
  } catch (e) {
    document.getElementById('context-info').innerHTML = `<span class="text-danger"><i class="fas fa-times"></i> Error</span>`;
  }
}

async function saveCurriculum() {
  const btn = document.getElementById('btn-save-curriculum');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

  const cData = getModData();
  const moduleBoja = window.BOJA_DATA[currentModule];
  
  if (moduleBoja) {
    moduleBoja.ras.forEach(ra => {
      const el = document.getElementById(`peso-ra-${ra.id}`);
      if (el) cData.raPesos[ra.id] = parseFloat(el.value) || 0;
      
      if (!cData.critPesos[ra.id]) cData.critPesos[ra.id] = {};
      ra.criterios.forEach(c => {
        const critEl = document.getElementById(`peso-crit-${ra.id}-${c.id}`);
        if (critEl) cData.critPesos[ra.id][c.id] = parseFloat(critEl.value) || 0;
      });
    });
    
    // Rebuild mapeo from task checkboxes
    cData.mapeo = {};
    taskOptions.forEach(task => {
      const safeId = task.id.replace(/:/g, '-');
      const checkboxes = document.querySelectorAll(`.map-checkbox-${safeId}:checked`);
      checkboxes.forEach(chk => {
        const [rId, cId] = chk.value.split('.');
        if (!cData.mapeo[rId]) cData.mapeo[rId] = {};
        if (!cData.mapeo[rId][cId]) cData.mapeo[rId][cId] = [];
        if (!cData.mapeo[rId][cId].includes(task.id)) {
           cData.mapeo[rId][cId].push(task.id);
        }
      });
    });
  }

  try {
    if (currentContext === 'template') {
      await fb.setDoc(fb.doc(db, 'usuarios', user.uid, 'curriculum', 'plantilla'), curriculumData);
    } else {
      await fb.updateDoc(fb.doc(db, 'clases', currentContext), { curriculum: curriculumData });
    }
    showAdminToast('✅', 'Curriculum guardado con éxito', 'success');
  } catch(e) {
    showAdminToast('❌', 'Error al guardar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save me-1"></i> Guardar Cambios';
  }
}

function renderAll() {
  buildTaskOptions();
  renderWeights();
  renderMapping();
  renderSummary();
}

function renderWeights() {
  const container = document.getElementById('weights-container');
  const mData = window.BOJA_DATA[currentModule];
  if (!mData) { container.innerHTML = 'Sin datos'; return; }

  const cData = getModData();
  let html = `
    <div class="mb-5">
      <h5 class="text-warning border-bottom border-secondary pb-2 mb-3"><i class="fas fa-chart-pie me-2"></i>1. Ponderación Global del Módulo</h5>
      <p class="text-muted small mb-3">Establece el peso de cada RA sobre la nota final del módulo (deben sumar 100%).</p>
      <div class="list-group mb-3">
  `;
  
  // Section 1: RAs
  mData.ras.forEach(ra => {
    const val = cData.raPesos?.[ra.id] || 0;
    html += `
      <div class="list-group-item bg-dark border-secondary d-flex justify-content-between align-items-center">
        <div><strong class="text-accent">RA ${ra.id}:</strong> <span class="text-light small ms-2">${ra.descripcion}</span></div>
        <div class="input-group input-group-sm ms-3" style="width: 140px; flex-shrink: 0;">
          <input type="number" id="peso-ra-${ra.id}" class="form-control text-center bg-black text-light border-secondary peso-ra-input" min="0" max="100" value="${val}">
          <span class="input-group-text bg-secondary text-light border-secondary">%</span>
        </div>
      </div>
    `;
  });
  html += `
      </div>
      <div class="text-end fw-bold" id="weights-total">Total Módulo: 0%</div>
    </div>
  `;

  // Section 2: Criteria
  html += `
    <div class="mt-4">
      <h5 class="text-info border-bottom border-secondary pb-2 mb-3"><i class="fas fa-list-ol me-2"></i>2. Ponderación Interna de Criterios</h5>
      <p class="text-muted small mb-3">Para cada RA, establece el peso de sus criterios (deben sumar 100% dentro de cada RA).</p>
      <div class="accordion accordion-flush" id="accordionCriteria">
  `;

  mData.ras.forEach(ra => {
    html += `
      <div class="accordion-item bg-dark border-secondary mb-2 rounded">
        <h2 class="accordion-header" id="flush-heading${ra.id}">
          <button class="accordion-button collapsed bg-black text-light border-secondary rounded" type="button" data-bs-toggle="collapse" data-bs-target="#flush-collapse${ra.id}">
            <strong>RA ${ra.id}</strong> &nbsp; - <span class="ms-2 small text-muted text-truncate" style="max-width:400px;">${ra.descripcion}</span>
          </button>
        </h2>
        <div id="flush-collapse${ra.id}" class="accordion-collapse collapse" data-bs-parent="#accordionCriteria">
          <div class="accordion-body p-2">
    `;
    
    ra.criterios.forEach(c => {
      const cVal = cData.critPesos?.[ra.id]?.[c.id] || 0;
      html += `
        <div class="d-flex justify-content-between align-items-center p-2 border-bottom border-secondary border-opacity-25">
          <div class="small text-secondary me-3"><strong class="text-info">${c.id})</strong> ${c.descripcion}</div>
          <div class="input-group input-group-sm" style="width: 120px; flex-shrink: 0;">
            <input type="number" id="peso-crit-${ra.id}-${c.id}" class="form-control text-center bg-black text-light border-secondary peso-crit-input" data-ra="${ra.id}" min="0" max="100" value="${cVal}">
            <span class="input-group-text bg-secondary text-light border-secondary">%</span>
          </div>
        </div>
      `;
    });
    
    html += `
            <div class="text-end mt-2 me-2 small fw-bold" id="total-crit-${ra.id}">Suma criterios: 0%</div>
          </div>
        </div>
      </div>
    `;
  });
  html += `</div></div>`;

  container.innerHTML = html;

  document.querySelectorAll('.peso-ra-input').forEach(el => el.addEventListener('input', updateWeightsTotal));
  document.querySelectorAll('.peso-crit-input').forEach(el => el.addEventListener('input', updateWeightsTotal));
  updateWeightsTotal();
}

function updateWeightsTotal() {
  let totalRa = 0;
  document.querySelectorAll('.peso-ra-input').forEach(el => {
    totalRa += parseFloat(el.value) || 0;
  });
  const totEl = document.getElementById('weights-total');
  totEl.textContent = `Total Módulo: ${totalRa}%`;
  totEl.className = `mt-3 text-end fw-bold ${totalRa === 100 ? 'text-success' : 'text-warning'}`;
  
  const mData = window.BOJA_DATA[currentModule];
  if (mData) {
    mData.ras.forEach(ra => {
      let totCrit = 0;
      document.querySelectorAll(`.peso-crit-input[data-ra="${ra.id}"]`).forEach(el => {
        totCrit += parseFloat(el.value) || 0;
      });
      const cEl = document.getElementById(`total-crit-${ra.id}`);
      if (cEl) {
        cEl.textContent = `Suma Criterios: ${totCrit}%`;
        cEl.className = `text-end mt-2 me-1 small fw-bold ${totCrit === 100 ? 'text-success' : 'text-warning'}`;
      }
    });
  }
}

function renderMapping() {
  const container = document.getElementById('mapping-container');
  const customList = document.getElementById('custom-tasks-list');
  const mData = window.BOJA_DATA[currentModule];
  if (!mData) { container.innerHTML = 'Sin datos'; return; }
  const cData = getModData();

  if (curriculumData.customTasks && curriculumData.customTasks.length > 0) {
    customList.innerHTML = curriculumData.customTasks.map(t => 
      `<span class="badge bg-secondary p-2 d-flex align-items-center gap-2">
         ${t.nombre}
         <i class="fas fa-times text-danger ms-2" style="cursor:pointer;" onclick="window._deleteCustomTask('${t.id}')"></i>
       </span>`
    ).join('');
  } else {
    customList.innerHTML = '<span class="text-muted small">No has añadido tareas personalizadas.</span>';
  }

  // Pre-calculate which criteria are selected for each task to populate the selects
  const taskSelectedCriteria = {};
  if (cData.mapeo) {
    for (const rId in cData.mapeo) {
      for (const cId in cData.mapeo[rId]) {
        cData.mapeo[rId][cId].forEach(tId => {
          if (!taskSelectedCriteria[tId]) taskSelectedCriteria[tId] = [];
          taskSelectedCriteria[tId].push(`${rId}.${cId}`);
        });
      }
    }
  }

  const groups = [...new Set(taskOptions.map(t => t.group))];
  
  let html = '<div class="accordion accordion-flush" id="accordionMapping">';
  
  groups.forEach((g, gIndex) => {
    html += `
      <div class="accordion-item bg-dark border-secondary mb-3 rounded">
        <h2 class="accordion-header" id="mapping-heading-${gIndex}">
          <button class="accordion-button bg-black text-light border-secondary rounded" type="button" data-bs-toggle="collapse" data-bs-target="#mapping-collapse-${gIndex}">
            <strong><i class="fas fa-folder-open me-2 text-warning"></i>${g}</strong>
          </button>
        </h2>
        <div id="mapping-collapse-${gIndex}" class="accordion-collapse collapse show" data-bs-parent="#accordionMapping">
          <div class="accordion-body p-0">
            <div class="list-group list-group-flush rounded-bottom">
    `;
    
    taskOptions.filter(t => t.group === g).forEach(task => {
      const safeId = task.id.replace(/:/g, '-');
      const selected = taskSelectedCriteria[task.id] || [];
      
      let optionsHtml = '';
      mData.ras.forEach(ra => {
        if (task.ra && !String(task.ra).split(',').includes(String(ra.id))) return;
        
        optionsHtml += `<div class="mb-2">
          <div class="small fw-bold text-warning mb-1">RA ${ra.id}: ${ra.descripcion.substring(0, 80)}...</div>`;
        
        ra.criterios.forEach(c => {
          const val = `${ra.id}.${c.id}`;
          const isChecked = selected.includes(val) ? 'checked' : '';
          optionsHtml += `
            <div class="form-check small mb-1 ms-2">
              <input class="form-check-input crit-checkbox map-checkbox-${safeId}" type="checkbox" value="${val}" id="chk-${safeId}-${val}" ${isChecked}>
              <label class="form-check-label text-light" for="chk-${safeId}-${val}">
                <strong class="text-info">${ra.id}.${c.id})</strong> ${c.descripcion}
              </label>
            </div>
          `;
        });
        optionsHtml += `</div>`;
      });

      html += `
        <div class="list-group-item bg-dark border-secondary d-flex flex-column p-3">
          <div class="mb-2 border-bottom border-secondary pb-2">
            <h6 class="text-info mb-1">${task.label}</h6>
            <div class="small text-muted">Selecciona qué criterios se evalúan en esta tarea.</div>
          </div>
          <div class="mt-2 ps-2" style="max-height: 250px; overflow-y: auto;">
            ${optionsHtml}
          </div>
        </div>
      `;
    });
    
    html += `
            </div>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;

  // Bind live summary updates
  taskOptions.forEach(task => {
    const safeId = task.id.replace(/:/g, '-');
    const checkboxes = document.querySelectorAll(`.map-checkbox-${safeId}`);
    checkboxes.forEach(chk => chk.addEventListener('change', renderSummary));
  });
}

function renderSummary() {
  const container = document.getElementById('summary-container');
  const mData = window.BOJA_DATA[currentModule];
  if (!mData) return;
  const cData = getModData();

  // Re-calculate covered criteria on the fly from the UI checkboxes
  const liveCoverage = {}; // e.g. "1.a": true
  taskOptions.forEach(task => {
    const safeId = task.id.replace(/:/g, '-');
    const checkboxes = document.querySelectorAll(`.map-checkbox-${safeId}:checked`);
    const allCheckboxes = document.querySelectorAll(`.map-checkbox-${safeId}`);
    
    if (allCheckboxes.length > 0) {
      // UI is rendered
      checkboxes.forEach(chk => {
        liveCoverage[chk.value] = true;
      });
    } else {
      // If UI is not fully rendered yet, fallback to saved data
      if (cData.mapeo) {
        for (const rId in cData.mapeo) {
          for (const cId in cData.mapeo[rId]) {
            if (cData.mapeo[rId][cId].includes(task.id)) {
              liveCoverage[`${rId}.${cId}`] = true;
            }
          }
        }
      }
    }
  });

  let html = '';
  mData.ras.forEach(ra => {
    const totalCrit = ra.criterios.length;
    let coveredCrit = 0;
    
    ra.criterios.forEach(c => {
      if (liveCoverage[`${ra.id}.${c.id}`]) {
        coveredCrit++;
      }
    });

    const pct = totalCrit === 0 ? 0 : Math.round((coveredCrit / totalCrit) * 100);
    const color = pct === 100 ? 'bg-success' : (pct > 0 ? 'bg-warning' : 'bg-danger');
    const pesoRa = document.getElementById(`peso-ra-${ra.id}`)?.value || cData.raPesos?.[ra.id] || 0;

    html += `
      <div class="col-md-6 col-lg-4">
        <div class="card bg-dark border-secondary h-100">
          <div class="card-body">
            <h6 class="card-title text-light d-flex justify-content-between">
              <span>RA ${ra.id}</span>
              <span class="badge bg-secondary">${pesoRa}%</span>
            </h6>
            <div class="d-flex justify-content-between small text-muted mb-1">
              <span>Cobertura de Criterios</span>
              <span>${coveredCrit} / ${totalCrit}</span>
            </div>
            <div class="progress" style="height: 8px;">
              <div class="progress-bar ${color}" style="width: ${pct}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function addCustomTask() {
  const input = document.getElementById('custom-task-name');
  const name = input.value.trim();
  if (!name) return;
  if (!curriculumData.customTasks) curriculumData.customTasks = [];
  curriculumData.customTasks.push({ id: 'custom_' + Date.now(), nombre: name });
  input.value = '';
  buildTaskOptions(); 
  renderMapping(); 
}

window._deleteCustomTask = (id) => {
  if (confirm('¿Eliminar esta tarea personalizada? También se quitará de los criterios asignados.')) {
    curriculumData.customTasks = curriculumData.customTasks.filter(t => t.id !== id);
    for (const mod in curriculumData) {
      if (curriculumData[mod] && curriculumData[mod].mapeo) {
        for (const ra in curriculumData[mod].mapeo) {
          for (const crit in curriculumData[mod].mapeo[ra]) {
            curriculumData[mod].mapeo[ra][crit] = curriculumData[mod].mapeo[ra][crit].filter(mappedId => mappedId !== id);
          }
        }
      }
    }
    buildTaskOptions();
    renderMapping();
    renderSummary();
  }
};

init();
