import { initAdminPage, showAdminToast } from './shared.js';

const { db, fb, user } = await initAdminPage(['admin', 'docente']);

let clases = [];
let currentContext = 'template'; 
let currentModule = '0372';
let curriculumData = { customTasks: [] };
let taskOptions = []; 
let testExamsGlobal = [];
let currentGroupBy = 'tema'; // 'tema' | 'type'

function getTemaTitle(temaNum, mod) {
  const temas0372 = {
    1: 'Tema 1: Sistemas de almacenamiento',
    2: 'Tema 2: Diseño Conceptual y Lógico',
    3: 'Tema 3: Modelo físico (DDL)',
    4: 'Tema 4: Consultas SQL (DML SELECT)',
    5: 'Tema 5: Modificación y Programación SQL',
    6: 'Tema 6: Aseguramiento de la Información'
  };
  const temas0377 = {
    1: 'Tema 1: Instalación de SGBD',
    2: 'Tema 2: Configuración y Arquitectura',
    3: 'Tema 3: Seguridad y Control de Acceso',
    4: 'Tema 4: Automatización (Triggers y Cursores)',
    5: 'Tema 5: Optimización de Rendimiento',
    6: 'Tema 6: Distribución y Alta Disponibilidad'
  };
  const map = mod === '0377' ? temas0377 : temas0372;
  return map[temaNum] || `Tema ${temaNum}`;
}

async function loadTestExams() {
  testExamsGlobal = [];
  try {
    if (currentContext !== 'template') {
      // 1. Si estamos en una clase concreta: SOLO cargar los exámenes realizados en ESA clase
      const qClass = fb.query(
        fb.collection(db, 'examenes_test'), 
        fb.where('claseId', '==', currentContext)
      );
      const testSnap = await fb.getDocs(qClass);
      testSnap.forEach(d => {
        testExamsGlobal.push({ id: d.id, ...d.data() });
      });
    } else {
      // 2. Si estamos en la Plantilla Global:
      // Solo cargar exámenes que pertenezcan a la plantilla del módulo actual
      let qUser;
      if (userDoc?.rol === 'docente') {
        qUser = fb.query(fb.collection(db, 'examenes_test'), fb.where('creadoPor', '==', user.uid));
      } else {
        qUser = fb.collection(db, 'examenes_test');
      }
      const testSnap = await fb.getDocs(qUser);
      testSnap.forEach(d => {
        const data = d.data();
        const examClass = clases.find(c => c.id === data.claseId);
        const examModulo = data.modulo || examClass?.modulo || (data.preguntas && data.preguntas.find(p => p.modulo)?.modulo);
        if (examModulo === currentModule && (!data.claseId || data.claseId === 'template')) {
          testExamsGlobal.push({ id: d.id, ...data });
        }
      });
    }
  } catch (e) {
    console.error('Error al cargar examenes_test:', e);
  }
}

async function init() {
  // Recuperar pestaña activa desde la URL
  const hash = window.location.hash;
  if (hash) {
    const tabTrigger = document.querySelector(`button[data-bs-target="${hash}"]`);
    if (tabTrigger) {
      new bootstrap.Tab(tabTrigger).show();
    }
  }

  // Guardar la pestaña activa en la URL sin recargar
  const tabEls = document.querySelectorAll('button[data-bs-toggle="tab"]');
  tabEls.forEach(el => {
    el.addEventListener('shown.bs.tab', function (event) {
      const targetPane = event.target.getAttribute('data-bs-target');
      if (history.replaceState) {
        history.replaceState(null, null, targetPane);
      } else {
        window.location.hash = targetPane;
      }
    });
  });

  document.getElementById('context-selector').addEventListener('change', async (e) => {
    currentContext = e.target.value;
    if (currentContext !== 'template') {
      const selectedClass = clases.find(c => c.id === currentContext);
      if (selectedClass && selectedClass.modulo) {
        currentModule = selectedClass.modulo;
        const modSel = document.getElementById('module-selector');
        if (modSel) modSel.value = currentModule;
      }
    }
    await loadTestExams();
    await loadCurriculum();
    renderAll();
  });

  document.getElementById('module-selector').addEventListener('change', async (e) => {
    currentModule = e.target.value;
    await loadTestExams();
    renderAll();
  });

  document.getElementById('btn-save-curriculum').addEventListener('click', saveCurriculum);
  document.getElementById('btn-add-custom-task').addEventListener('click', addCustomTask);

  document.getElementById('btn-open-clone-modal').addEventListener('click', () => {
    populateCloneModal();
    new bootstrap.Modal(document.getElementById('modal-clone-curriculum')).show();
  });

  document.getElementById('btn-execute-clone').addEventListener('click', executeClone);

  document.querySelectorAll('input[name="cloneDirection"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isToClass = e.target.value === 'templateToClass';
      document.getElementById('clone-class-label').textContent = isToClass 
        ? 'Seleccionar Clase Destino:' 
        : 'Seleccionar Clase Origen:';
    });
  });

  await loadClases();

  // Comprobar si viene claseId por parámetro URL
  const urlParams = new URLSearchParams(window.location.search);
  const paramClaseId = urlParams.get('claseId');
  if (paramClaseId && clases.some(c => c.id === paramClaseId)) {
    currentContext = paramClaseId;
    const sel = document.getElementById('context-selector');
    if (sel) sel.value = paramClaseId;
    const selectedClass = clases.find(c => c.id === currentContext);
    if (selectedClass && selectedClass.modulo) {
      currentModule = selectedClass.modulo;
      const modSel = document.getElementById('module-selector');
      if (modSel) modSel.value = currentModule;
    }
  }

  await loadTestExams();
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

  // 1. Tandas de Ejercicios Web (Plataforma AprenderSQL)
  // Disponibles ÚNICAMENTE para 0372 (1º de Gestión de BBDD)
  if (currentModule === '0372') {
    const tandasConfig = [
      { b: 1, name: 'Modelo Físico (DDL)', ra: 3, tema: 3 },
      { b: 2, name: 'Consultas Básicas (SELECT/WHERE/ORDER)', ra: 4, tema: 4 },
      { b: 3, name: 'Consultas Avanzadas (GROUP BY/JOIN)', ra: 4, tema: 4 },
      { b: 4, name: 'Subconsultas y Consultas Complejas', ra: 4, tema: 4 },
      { b: 5, name: 'Modificación de Datos (DML)', ra: 5, tema: 5 },
      { b: 6, name: 'Programación SQL (Procedimientos/Triggers)', ra: 5, tema: 5 }
    ];

    tandasConfig.forEach(t => {
      const temaTitle = getTemaTitle(t.tema, currentModule);
      taskOptions.push({
        id: `tanda:${t.b}:practica`,
        label: `Ejercicio Web: ${t.name} [PRÁCTICA]`,
        typeGroup: `Ejercicios Web (Plataforma)`,
        temaGroup: temaTitle,
        group: currentGroupBy === 'tema' ? temaTitle : `Ejercicios Web (Plataforma)`,
        category: 'web_ejercicio',
        typeIcon: 'fas fa-laptop-code text-info',
        badgeText: 'Web Práctica'
      });
      taskOptions.push({
        id: `tanda:${t.b}:examen`,
        label: `Ejercicio Web: ${t.name} [EXAMEN / CALIFICABLE]`,
        typeGroup: `Ejercicios Web (Plataforma)`,
        temaGroup: temaTitle,
        group: currentGroupBy === 'tema' ? temaTitle : `Ejercicios Web (Plataforma)`,
        category: 'web_ejercicio',
        typeIcon: 'fas fa-laptop-code text-primary',
        badgeText: 'Web Examen'
      });
    });
  }

  // 2. Examen Tipo Test (Uno solo por cada tema del módulo actual)
  const mData = window.BOJA_DATA[currentModule];
  if (mData) {
    mData.ras.forEach(ra => {
      const raNum = parseInt(ra.id);
      const temaTitle = (!isNaN(raNum) && raNum >= 1 && raNum <= 6)
        ? getTemaTitle(raNum, currentModule)
        : 'Otras Actividades / Sin Tema';

      taskOptions.push({
        id: `test:${currentModule}:${ra.id}`,
        label: `Examen Test: Tema ${ra.id}`,
        typeGroup: `Exámenes Tipo Test`,
        temaGroup: temaTitle,
        group: currentGroupBy === 'tema' ? temaTitle : `Exámenes Tipo Test`,
        category: 'test_exam',
        typeIcon: 'fas fa-list-check text-info',
        badgeText: 'Tipo Test'
      });
    });
  }

  // 3. Exámenes Oficiales (BOJA)
  if (mData) {
    mData.ras.forEach(ra => {
      const raNum = parseInt(ra.id);
      const temaTitle = (!isNaN(raNum) && raNum >= 1 && raNum <= 6)
        ? getTemaTitle(raNum, currentModule)
        : 'Otras Actividades / Sin Tema';

      taskOptions.push({
        id: `examen:${currentModule}:${ra.id}`,
        label: `Examen Oficial RA${ra.id}`,
        typeGroup: `Exámenes Oficiales (BOJA)`,
        temaGroup: temaTitle,
        group: currentGroupBy === 'tema' ? temaTitle : `Exámenes Oficiales (BOJA)`,
        category: 'examen_boja',
        typeIcon: 'fas fa-file-signature text-warning',
        badgeText: 'Examen Oficial'
      });
    });
  }

  // 4. Tareas Offline
  (window.BLOQUES || []).filter(b => b.tipo === 'tarea' && (b.modulo === currentModule || !b.modulo)).forEach(b => {
    let bTema = null;
    const m = (b.nombre || '').match(/^Tema\s+(\d+)/i);
    if (m) {
      bTema = parseInt(m[1]);
    } else if (b.temaRef) {
      const parent = (window.BLOQUES || []).find(x => x.id === b.temaRef);
      if (parent) {
        const pm = (parent.nombre || '').match(/^Tema\s+(\d+)/i);
        if (pm) bTema = parseInt(pm[1]);
      }
    }
    if (!bTema && b.ra) {
      const raNum = parseInt(b.ra.toString().split(',')[0]);
      if (!isNaN(raNum) && raNum >= 1 && raNum <= 6) bTema = raNum;
    }

    const temaTitle = (bTema && bTema >= 1 && bTema <= 6)
      ? getTemaTitle(bTema, currentModule)
      : 'Otras Actividades / Sin Tema';

    taskOptions.push({
      id: `bloque:${b.id}`,
      label: `Tarea Offline: ${b.nombre}`,
      typeGroup: `Tareas Offline / Entregables`,
      temaGroup: temaTitle,
      group: currentGroupBy === 'tema' ? temaTitle : `Tareas Offline / Entregables`,
      category: 'tarea_offline',
      typeIcon: 'fas fa-file-pdf text-danger',
      badgeText: 'Tarea'
    });
  });

  // 5. Tareas Personalizadas
  if (curriculumData.customTasks) {
    curriculumData.customTasks.forEach(t => {
      const tm = (t.nombre || '').match(/(?:Tema|T)\s*(\d+)/i);
      const cTema = tm ? parseInt(tm[1]) : null;
      const temaTitle = (cTema && cTema >= 1 && cTema <= 6)
        ? getTemaTitle(cTema, currentModule)
        : 'Otras Actividades / Personalizadas';

      taskOptions.push({
        id: t.id,
        label: `Personalizada: ${t.nombre}`,
        typeGroup: `Tareas Personalizadas`,
        temaGroup: temaTitle,
        group: currentGroupBy === 'tema' ? temaTitle : `Tareas Personalizadas`,
        category: 'custom',
        typeIcon: 'fas fa-user-edit text-success',
        badgeText: 'Personalizada'
      });
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
    
    // Migrar mapeos antiguos de tests individuales (test:id) a formato por tema (test:mod:ra)
    ['0372', '0377'].forEach(mod => {
      const cData = curriculumData[mod];
      if (cData && cData.mapeo) {
        for (const rId in cData.mapeo) {
          for (const cId in cData.mapeo[rId]) {
            const list = cData.mapeo[rId][cId];
            if (Array.isArray(list)) {
              const newList = [];
              list.forEach(item => {
                if (item.startsWith('test:') && item.split(':').length === 2) {
                  const newId = `test:${mod}:${rId}`;
                  if (!newList.includes(newId)) newList.push(newId);
                } else {
                  newList.push(item);
                }
              });
              cData.mapeo[rId][cId] = newList;
            }
          }
        }
      }
    });

    document.getElementById('context-info').innerHTML = '<span class="text-success"><i class="fas fa-check"></i> Cargado</span>';
  } catch (e) {
    document.getElementById('context-info').innerHTML = `<span class="text-danger"><i class="fas fa-times"></i> Error</span>`;
  }
}

function syncCurrentDomToCurriculumData() {
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
}

function populateCloneModal() {
  const sel = document.getElementById('clone-class-selector');
  sel.innerHTML = '';
  
  if (!clases || clases.length === 0) {
    sel.innerHTML = '<option value="">No tienes clases creadas</option>';
    document.getElementById('btn-execute-clone').disabled = true;
    return;
  }
  
  document.getElementById('btn-execute-clone').disabled = false;
  clases.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `🏫 ${c.nombre} (${c.curso || 'Sin curso'})`;
    sel.appendChild(opt);
  });

  // Si estamos en una clase concreta, la preseleccionamos
  if (currentContext !== 'template') {
    sel.value = currentContext;
  }
}

async function executeClone() {
  const direction = document.querySelector('input[name="cloneDirection"]:checked')?.value;
  const targetClassSelect = document.getElementById('clone-class-selector');
  const selectedClassId = targetClassSelect?.value;
  
  if (!selectedClassId) {
    showAdminToast('⚠️', 'Debes seleccionar una clase', 'warning');
    return;
  }
  
  const selectedClass = clases.find(c => c.id === selectedClassId);
  const className = selectedClass ? selectedClass.nombre : 'la clase seleccionada';

  const confirmMsg = direction === 'templateToClass'
    ? `¿Estás seguro de copiar la Plantilla Global a la clase "${className}"? Esta acción sobrescribirá su currículum actual.`
    : `¿Estás seguro de copiar el currículum de la clase "${className}" a tu Plantilla Global? Esta acción sobrescribirá tu plantilla maestra.`;

  if (!confirm(confirmMsg)) return;

  // Sincronizar inputs actuales por si hay cambios en pantalla
  syncCurrentDomToCurriculumData();

  const btn = document.getElementById('btn-execute-clone');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Clonando...';

  try {
    if (direction === 'templateToClass') {
      // 1. Plantilla Global ➔ Clase
      let sourceData = null;
      if (currentContext === 'template') {
        sourceData = curriculumData;
      } else {
        const tSnap = await fb.getDoc(fb.doc(db, 'usuarios', user.uid, 'curriculum', 'plantilla'));
        if (tSnap.exists()) {
          sourceData = tSnap.data();
        }
      }
      
      if (!sourceData || (!sourceData['0372'] && !sourceData['0377'] && (!sourceData.customTasks || sourceData.customTasks.length === 0))) {
        showAdminToast('⚠️', 'Tu Plantilla Global está vacía. Configúrala y guárdala antes de clonar.', 'warning');
        return;
      }

      const cloned = JSON.parse(JSON.stringify(sourceData));
      await fb.updateDoc(fb.doc(db, 'clases', selectedClassId), { curriculum: cloned });
      
      // Si tenemos abierta en pantalla la clase receptora, actualizamos la vista de inmediato
      if (currentContext === selectedClassId) {
        curriculumData = cloned;
        renderAll();
      }
      
      const modalEl = document.getElementById('modal-clone-curriculum');
      bootstrap.Modal.getInstance(modalEl)?.hide();
      showAdminToast('✅', `Plantilla global clonada con éxito en ${className}`, 'success');

    } else if (direction === 'classToTemplate') {
      // 2. Clase ➔ Plantilla Global
      let sourceData = null;
      if (currentContext === selectedClassId) {
        sourceData = curriculumData;
      } else {
        const cSnap = await fb.getDoc(fb.doc(db, 'clases', selectedClassId));
        if (cSnap.exists()) {
          sourceData = cSnap.data()?.curriculum;
        }
      }
      
      if (!sourceData || (!sourceData['0372'] && !sourceData['0377'] && (!sourceData.customTasks || sourceData.customTasks.length === 0))) {
        showAdminToast('⚠️', `La clase "${className}" no tiene un currículum configurado para clonar.`, 'warning');
        return;
      }

      const cloned = JSON.parse(JSON.stringify(sourceData));
      await fb.setDoc(fb.doc(db, 'usuarios', user.uid, 'curriculum', 'plantilla'), cloned);
      
      // Si tenemos abierta la plantilla en pantalla, actualizamos la vista de inmediato
      if (currentContext === 'template') {
        curriculumData = cloned;
        renderAll();
      }
      
      const modalEl = document.getElementById('modal-clone-curriculum');
      bootstrap.Modal.getInstance(modalEl)?.hide();
      showAdminToast('✅', `Currículum de "${className}" guardado como Plantilla Global`, 'success');
    }
  } catch (err) {
    console.error('Error al clonar:', err);
    showAdminToast('❌', 'Error al clonar: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-copy me-1"></i> Clonar Ahora';
  }
}

async function saveCurriculum() {
  const btn = document.getElementById('btn-save-curriculum');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

  syncCurrentDomToCurriculumData();

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
          <input type="number" id="peso-ra-${ra.id}" class="form-control text-center bg-black text-light border-secondary peso-ra-input" min="0" max="100" step="any" value="${val}">
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
    const mediaPercent = ra.criterios && ra.criterios.length > 0 
      ? parseFloat((100 / ra.criterios.length).toFixed(2)) 
      : 0;

    html += `
      <div class="accordion-item bg-dark border-secondary mb-2 rounded">
        <h2 class="accordion-header d-flex align-items-center bg-black border-secondary rounded pe-2" id="flush-heading${ra.id}">
          <button class="accordion-button collapsed bg-black text-light border-0 rounded flex-grow-1 shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#flush-collapse${ra.id}">
            <strong>RA ${ra.id}</strong> &nbsp; - <span class="ms-2 small text-muted text-truncate" style="max-width:380px;">${ra.descripcion}</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline-info text-nowrap ms-2 btn-calc-media-crit" data-ra="${ra.id}" title="Repartir media aritmética (100% equitativo entre ${ra.criterios.length} criterios)">
            <i class="fas fa-calculator me-1"></i> Media RA ${ra.id} (${mediaPercent}%)
          </button>
        </h2>
        <div id="flush-collapse${ra.id}" class="accordion-collapse collapse" data-bs-parent="#accordionCriteria">
          <div class="accordion-body p-3">
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-black bg-opacity-25 rounded border border-secondary border-opacity-25">
              <span class="small text-muted"><i class="fas fa-layer-group me-1 text-info"></i> <strong>${ra.criterios.length}</strong> criterios en este RA</span>
              <button type="button" class="btn btn-sm btn-outline-info btn-calc-media-crit" data-ra="${ra.id}">
                <i class="fas fa-calculator me-1"></i> Asignar media equitativa (${mediaPercent}%)
              </button>
            </div>
    `;
    
    ra.criterios.forEach(c => {
      const cVal = cData.critPesos?.[ra.id]?.[c.id] || 0;
      html += `
        <div class="d-flex justify-content-between align-items-center p-2 border-bottom border-secondary border-opacity-25">
          <div class="small text-secondary me-3"><strong class="text-info">${c.id})</strong> ${c.descripcion}</div>
          <div class="input-group input-group-sm" style="width: 120px; flex-shrink: 0;">
            <input type="number" id="peso-crit-${ra.id}-${c.id}" class="form-control text-center bg-black text-light border-secondary peso-crit-input" data-ra="${ra.id}" min="0" max="100" step="any" value="${cVal}">
            <span class="input-group-text bg-secondary text-light border-secondary">%</span>
          </div>
        </div>
      `;
    });
    
    html += `
            <div class="d-flex justify-content-between align-items-center mt-3 pt-2 px-1 border-top border-secondary border-opacity-25">
              <button type="button" class="btn btn-sm btn-outline-secondary btn-calc-media-crit" data-ra="${ra.id}">
                <i class="fas fa-balance-scale me-1"></i> Recalcular media equitativa
              </button>
              <div class="small fw-bold" id="total-crit-${ra.id}">Suma Criterios: 0%</div>
            </div>
          </div>
        </div>
      </div>
    `;
  });
  html += `</div></div>`;

  container.innerHTML = html;

  document.querySelectorAll('.peso-ra-input').forEach(el => el.addEventListener('input', updateWeightsTotal));
  document.querySelectorAll('.peso-crit-input').forEach(el => el.addEventListener('input', updateWeightsTotal));
  document.querySelectorAll('.btn-calc-media-crit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const raId = btn.getAttribute('data-ra');
      distributeEqualCriteriaWeights(raId);
    });
  });
  updateWeightsTotal();
}

function distributeEqualCriteriaWeights(raId) {
  const mData = window.BOJA_DATA[currentModule];
  if (!mData) return;
  const ra = mData.ras.find(r => String(r.id) === String(raId));
  if (!ra || !ra.criterios || ra.criterios.length === 0) return;

  const count = ra.criterios.length;
  const base = Math.floor((100 / count) * 100) / 100;
  let remainderCents = Math.round((100 - (base * count)) * 100);

  ra.criterios.forEach((c, idx) => {
    let val = base;
    if (idx < remainderCents) {
      val = parseFloat((val + 0.01).toFixed(2));
    }
    const input = document.getElementById(`peso-crit-${ra.id}-${c.id}`);
    if (input) {
      input.value = val;
    }
  });

  updateWeightsTotal();
  showAdminToast('⚖️', `Pesos del RA ${ra.id} repartidos equitativamente (${parseFloat((100 / count).toFixed(2))}% de media)`);
}

function updateWeightsTotal() {
  let totalRa = 0;
  document.querySelectorAll('.peso-ra-input').forEach(el => {
    totalRa += parseFloat(el.value) || 0;
  });
  const totEl = document.getElementById('weights-total');
  const isRaOk = Math.abs(totalRa - 100) < 0.05;
  totEl.textContent = `Total Módulo: ${parseFloat(totalRa.toFixed(2))}%`;
  totEl.className = `mt-3 text-end fw-bold ${isRaOk ? 'text-success' : 'text-warning'}`;
  
  const mData = window.BOJA_DATA[currentModule];
  if (mData) {
    mData.ras.forEach(ra => {
      let totCrit = 0;
      document.querySelectorAll(`.peso-crit-input[data-ra="${ra.id}"]`).forEach(el => {
        totCrit += parseFloat(el.value) || 0;
      });
      const cEl = document.getElementById(`total-crit-${ra.id}`);
      if (cEl) {
        const isCritOk = Math.abs(totCrit - 100) < 0.05;
        cEl.textContent = `Suma Criterios: ${parseFloat(totCrit.toFixed(2))}%`;
        cEl.className = `small fw-bold ${isCritOk ? 'text-success' : 'text-warning'}`;
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

  // Pre-calcular qué criterios están seleccionados para cada tarea
  const taskSelectedCriteria = {};
  if (cData.mapeo) {
    for (const rId in cData.mapeo) {
      for (const cId in cData.mapeo[rId]) {
        (cData.mapeo[rId][cId] || []).forEach(tId => {
          if (!taskSelectedCriteria[tId]) taskSelectedCriteria[tId] = [];
          taskSelectedCriteria[tId].push(`${rId}.${cId}`);
        });
      }
    }
  }

  // Sincronizar el grupo activo de cada tarea según el selector currentGroupBy
  taskOptions.forEach(t => {
    t.group = currentGroupBy === 'tema' ? t.temaGroup : t.typeGroup;
  });

  let groups = [];
  if (currentGroupBy === 'tema') {
    // 1. Los 6 temas oficiales del módulo (Tema 1 al 6 SIEMPRE presentes y estrictamente en orden)
    const allTemas = [1, 2, 3, 4, 5, 6].map(num => getTemaTitle(num, currentModule));
    
    // 2. Cualquier otro grupo que exista (ej. Personalizadas o sin tema)
    const otherGroups = [...new Set(taskOptions.map(t => t.group))]
      .filter(g => !allTemas.includes(g));

    otherGroups.sort((a, b) => {
      const ma = a.match(/(?:Tema|T)\s*(\d+)/i);
      const mb = b.match(/(?:Tema|T)\s*(\d+)/i);
      if (ma && mb) return parseInt(ma[1]) - parseInt(mb[1]);
      if (ma) return -1;
      if (mb) return 1;
      return a.localeCompare(b);
    });

    groups = [...allTemas, ...otherGroups];
  } else {
    const typeOrder = [
      'Ejercicios Web (Plataforma)',
      'Exámenes Tipo Test',
      'Exámenes Oficiales (BOJA)',
      'Tareas Offline / Entregables',
      'Tareas Personalizadas'
    ];
    const existingGroups = [...new Set(taskOptions.map(t => t.group))];
    groups = typeOrder.filter(g => existingGroups.includes(g))
      .concat(existingGroups.filter(g => !typeOrder.includes(g)));
  }

  const totalTasks = taskOptions.length;
  const mappedTasksCount = taskOptions.filter(t => (taskSelectedCriteria[t.id] || []).length > 0).length;
  const unmappedTasksCount = totalTasks - mappedTasksCount;

  // Barra de herramientas superior (Búsqueda, Filtros, Agrupación y Plegado)
  let html = `
    <div class="card bg-black bg-opacity-40 border-secondary mb-3 shadow-sm">
      <div class="card-body p-3">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-4 col-xl-4">
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-dark border-secondary text-secondary"><i class="fas fa-search"></i></span>
              <input type="text" id="mapping-search-input" class="form-control bg-dark text-light border-secondary" placeholder="Buscar tarea por nombre o tipo...">
              <button class="btn btn-outline-secondary" type="button" id="btn-clear-mapping-search" title="Limpiar"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="col-12 col-sm-6 col-md-4 col-xl-3">
            <div class="btn-group btn-group-sm w-100" role="group">
              <button type="button" class="btn btn-outline-light active filter-mapping-btn" data-filter="all">
                Todas <span class="badge bg-secondary ms-1" id="badge-total-tasks">${totalTasks}</span>
              </button>
              <button type="button" class="btn btn-outline-danger filter-mapping-btn" data-filter="unmapped">
                <i class="fas fa-exclamation-triangle me-1"></i>Sin criterios <span class="badge bg-danger ms-1" id="badge-unmapped-tasks">${unmappedTasksCount}</span>
              </button>
              <button type="button" class="btn btn-outline-success filter-mapping-btn" data-filter="mapped">
                <i class="fas fa-check me-1"></i>Con criterios <span class="badge bg-success ms-1" id="badge-mapped-tasks">${mappedTasksCount}</span>
              </button>
            </div>
          </div>
          <div class="col-12 col-sm-6 col-md-4 col-xl-3">
            <div class="btn-group btn-group-sm w-100" role="group">
              <button type="button" class="btn btn-outline-warning ${currentGroupBy === 'tema' ? 'active' : ''} group-mapping-btn" data-group-by="tema" title="Agrupar actividades por Temas curriculares">
                <i class="fas fa-book-open me-1"></i>Por Temas
              </button>
              <button type="button" class="btn btn-outline-warning ${currentGroupBy === 'type' ? 'active' : ''} group-mapping-btn" data-group-by="type" title="Agrupar actividades por Tipo">
                <i class="fas fa-layer-group me-1"></i>Por Tipo
              </button>
            </div>
          </div>
          <div class="col-12 col-xl-2 d-flex justify-content-xl-end gap-1">
            <button type="button" class="btn btn-sm btn-outline-secondary flex-grow-1 flex-xl-grow-0" id="btn-expand-all-mapping">
              <i class="fas fa-angles-down me-1"></i>Desplegar
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary flex-grow-1 flex-xl-grow-0" id="btn-collapse-all-mapping">
              <i class="fas fa-angles-up me-1"></i>Plegar
            </button>
          </div>
        </div>
      </div>
    </div>
    <div id="mapping-groups-list">
  `;

  groups.forEach((g, gIndex) => {
    const tasksInGroup = taskOptions.filter(t => t.group === g);
    
    // Si no hay tareas en el grupo
    if (!tasksInGroup.length) {
      if (currentGroupBy !== 'tema') return;
      
      // En modo 'tema', mostramos la tarjeta del tema vacía para que la lista 1 al 6 quede siempre completa y visible
      html += `
        <div class="card bg-dark border-secondary mb-3 shadow-sm mapping-group-card opacity-75" id="group-card-${gIndex}">
          <div class="card-header bg-black bg-opacity-75 border-secondary d-flex justify-content-between align-items-center py-2 px-3"
               style="cursor: pointer;"
               data-bs-toggle="collapse"
               data-bs-target="#group-collapse-${gIndex}">
            <div class="d-flex align-items-center gap-2">
              <i class="fas fa-chevron-right group-toggle-icon text-muted"></i>
              <i class="fas fa-book-open text-warning ms-1"></i>
              <strong class="text-light fs-6">${g}</strong>
              <span class="badge bg-secondary ms-1">0 actividades</span>
            </div>
            <div class="d-flex align-items-center gap-2" id="group-status-${gIndex}">
              <span class="badge bg-secondary-subtle text-muted border border-secondary small">Sin actividades</span>
            </div>
          </div>
          <div id="group-collapse-${gIndex}" class="collapse">
            <div class="card-body p-3 text-center text-muted small bg-black bg-opacity-25">
              <i class="fas fa-info-circle me-1 text-secondary"></i>No hay actividades asignadas a este tema todavía.
            </div>
          </div>
        </div>
      `;
      return;
    }

    if (currentGroupBy === 'tema') {
      const categoryPriority = {
        'web_ejercicio': 1,
        'tarea_offline': 2,
        'test_exam': 3,
        'examen_boja': 4,
        'custom': 5
      };
      tasksInGroup.sort((a, b) => {
        const pA = categoryPriority[a.category] || 99;
        const pB = categoryPriority[b.category] || 99;
        if (pA !== pB) return pA - pB;
        return a.label.localeCompare(b.label, undefined, { numeric: true });
      });
    }

    const groupUnmappedCount = tasksInGroup.filter(t => !(taskSelectedCriteria[t.id] && taskSelectedCriteria[t.id].length)).length;

    html += `
      <div class="card bg-dark border-secondary mb-3 shadow-sm mapping-group-card" id="group-card-${gIndex}">
        <div class="card-header bg-black bg-opacity-75 border-secondary d-flex justify-content-between align-items-center py-2 px-3"
             style="cursor: pointer;"
             data-bs-toggle="collapse"
             data-bs-target="#group-collapse-${gIndex}">
          <div class="d-flex align-items-center gap-2">
            <i class="fas fa-chevron-down group-toggle-icon text-warning"></i>
            <i class="${currentGroupBy === 'tema' ? 'fas fa-book-open text-warning' : 'fas fa-layer-group text-info'} ms-1"></i>
            <strong class="text-light fs-6">${g}</strong>
            <span class="badge bg-secondary ms-1">${tasksInGroup.length} actividades</span>
          </div>
          <div class="d-flex align-items-center gap-2" id="group-status-${gIndex}">
            ${groupUnmappedCount > 0 
              ? `<span class="badge bg-danger-subtle text-danger border border-danger small"><i class="fas fa-exclamation-triangle me-1"></i>${groupUnmappedCount} sin criterios</span>` 
              : `<span class="badge bg-success-subtle text-success border border-success small"><i class="fas fa-check me-1"></i>Todas asignadas</span>`}
          </div>
        </div>
        <div id="group-collapse-${gIndex}" class="collapse show">
          <div class="card-body p-2 d-flex flex-column gap-2">
    `;

    tasksInGroup.forEach(task => {
      const safeId = task.id.replace(/:/g, '-');
      const selected = taskSelectedCriteria[task.id] || [];
      const hasCriteria = selected.length > 0;

      html += `
        <div class="card bg-dark border-secondary border-start border-4 ${hasCriteria ? 'border-success' : 'border-danger'} task-card shadow-sm"
             id="task-card-${safeId}"
             data-task-id="${task.id}"
             data-task-label="${task.label.toLowerCase()}"
             data-group-index="${gIndex}"
             data-has-criteria="${hasCriteria ? 'true' : 'false'}">
          <div class="card-header bg-black bg-opacity-30 border-0 d-flex justify-content-between align-items-center py-2 px-3"
               style="cursor: pointer;"
               data-bs-toggle="collapse"
               data-bs-target="#task-collapse-${safeId}">
            <div class="d-flex align-items-center gap-2 flex-grow-1 text-truncate pe-2">
              <i class="fas fa-chevron-right task-toggle-icon text-muted" id="task-icon-${safeId}"></i>
              <i class="${task.typeIcon} me-1"></i>
              <span class="fw-bold text-light text-truncate">${task.label}</span>
              ${task.badgeText ? `<span class="badge bg-secondary-subtle text-light border border-secondary small d-none d-md-inline">${task.badgeText}</span>` : ''}
            </div>
            <div class="d-flex align-items-center gap-2 flex-shrink-0" id="task-badge-${safeId}">
              ${hasCriteria 
                ? `<span class="badge bg-success text-white"><i class="fas fa-check-circle me-1"></i>${selected.length} criterio${selected.length > 1 ? 's' : ''}</span>`
                : `<span class="badge bg-danger text-white"><i class="fas fa-exclamation-triangle me-1"></i>Sin criterios</span>`}
            </div>
          </div>

          <div id="task-collapse-${safeId}" class="collapse task-collapse-body">
            <div class="card-body p-3 border-top border-secondary border-opacity-25 bg-black bg-opacity-30">
              <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 pb-2 border-bottom border-secondary border-opacity-25">
                <div class="small text-muted">
                  <i class="fas fa-info-circle me-1 text-info"></i>Selecciona qué criterios del BOJA se evalúan en esta actividad:
                </div>
                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-xs btn-outline-secondary btn-fold-task-ras" data-safe-id="${safeId}">
                    <i class="fas fa-compress-alt me-1"></i>Plegar RAs
                  </button>
                  <button type="button" class="btn btn-xs btn-outline-secondary btn-unfold-task-ras" data-safe-id="${safeId}">
                    <i class="fas fa-expand-alt me-1"></i>Desplegar RAs
                  </button>
                </div>
              </div>

              <!-- Lista de RAs dentro de la tarea -->
              <div class="d-flex flex-column gap-2">
      `;

      mData.ras.forEach(ra => {
        const raCriteriaKeys = ra.criterios.map(c => `${ra.id}.${c.id}`);
        const raSelectedCount = selected.filter(val => raCriteriaKeys.includes(val)).length;
        const isRaOpen = raSelectedCount > 0;

        html += `
          <div class="card bg-dark border-secondary border-opacity-50 ra-card">
            <div class="card-header bg-black bg-opacity-40 py-2 px-3 d-flex justify-content-between align-items-center"
                 style="cursor: pointer;"
                 data-bs-toggle="collapse"
                 data-bs-target="#ra-collapse-${safeId}-${ra.id}">
              <div class="d-flex align-items-center gap-2 text-truncate pe-2">
                <i class="fas ${isRaOpen ? 'fa-chevron-down' : 'fa-chevron-right'} ra-toggle-icon text-muted small" id="ra-icon-${safeId}-${ra.id}"></i>
                <span class="badge bg-warning text-dark fw-bold">RA ${ra.id}</span>
                <span class="small text-light text-truncate">${ra.descripcion}</span>
              </div>
              <div class="d-flex align-items-center gap-2 flex-shrink-0">
                <span class="badge ${raSelectedCount > 0 ? 'bg-info text-dark' : 'bg-secondary text-light'} small" id="ra-badge-${safeId}-${ra.id}">
                  ${raSelectedCount} / ${ra.criterios.length}
                </span>
              </div>
            </div>

            <div id="ra-collapse-${safeId}-${ra.id}" class="collapse ra-collapse-body ${isRaOpen ? 'show' : ''}">
              <div class="card-body p-2 ps-3 bg-black bg-opacity-20">
                <div class="d-flex justify-content-end gap-2 mb-2 pb-1 border-bottom border-secondary border-opacity-25">
                  <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none text-info small btn-select-all-crit" data-safe-id="${safeId}" data-ra-id="${ra.id}">
                    <i class="fas fa-check-double me-1"></i>Seleccionar todos
                  </button>
                  <span class="text-secondary small">|</span>
                  <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none text-muted small btn-deselect-all-crit" data-safe-id="${safeId}" data-ra-id="${ra.id}">
                    Deseleccionar
                  </button>
                </div>

                <div class="row g-2">
        `;

        ra.criterios.forEach(c => {
          const val = `${ra.id}.${c.id}`;
          const isChecked = selected.includes(val) ? 'checked' : '';
          html += `
            <div class="col-12 col-md-6">
              <div class="form-check d-flex align-items-start m-0 p-1 rounded hover-bg">
                <input class="form-check-input crit-checkbox map-checkbox-${safeId} mt-1 me-2 flex-shrink-0"
                       type="checkbox"
                       value="${val}"
                       id="chk-${safeId}-${val}"
                       data-safe-id="${safeId}"
                       data-ra-id="${ra.id}"
                       ${isChecked}>
                <label class="form-check-label text-light small" for="chk-${safeId}-${val}" style="cursor: pointer;">
                  <strong class="text-info">${ra.id}.${c.id})</strong> ${c.descripcion}
                </label>
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

      html += `
              </div>
            </div>
          </div>
        </div>
      `;
    });

    html += `
          </div>
        </div>
      </div>
    `;
  });

  html += '</div></div>';
  container.innerHTML = html;

  // Enlazar eventos de la barra de herramientas y acordeones
  attachMappingEvents();
}

function updateTaskUi(safeId, raId) {
  const card = document.getElementById(`task-card-${safeId}`);
  if (!card) return;

  const allChecked = document.querySelectorAll(`.map-checkbox-${safeId}:checked`);
  const count = allChecked.length;
  const hasCriteria = count > 0;

  // Actualizar atributo data-has-criteria
  card.setAttribute('data-has-criteria', hasCriteria ? 'true' : 'false');

  // Actualizar borde de la tarjeta
  if (hasCriteria) {
    card.classList.remove('border-danger');
    card.classList.add('border-success');
  } else {
    card.classList.remove('border-success');
    card.classList.add('border-danger');
  }

  // Actualizar badge de la cabecera de la tarea
  const badgeContainer = document.getElementById(`task-badge-${safeId}`);
  if (badgeContainer) {
    badgeContainer.innerHTML = hasCriteria
      ? `<span class="badge bg-success text-white"><i class="fas fa-check-circle me-1"></i>${count} criterio${count > 1 ? 's' : ''}</span>`
      : `<span class="badge bg-danger text-white"><i class="fas fa-exclamation-triangle me-1"></i>Sin criterios</span>`;
  }

  // Actualizar badge del RA si se pasó raId
  if (raId) {
    const raChecked = document.querySelectorAll(`.map-checkbox-${safeId}[data-ra-id="${raId}"]:checked`).length;
    const raAll = document.querySelectorAll(`.map-checkbox-${safeId}[data-ra-id="${raId}"]`).length;
    const raBadge = document.getElementById(`ra-badge-${safeId}-${raId}`);
    if (raBadge) {
      raBadge.textContent = `${raChecked} / ${raAll}`;
      raBadge.className = `badge ${raChecked > 0 ? 'bg-info text-dark' : 'bg-secondary text-light'} small`;
    }
  }

  // Actualizar contadores globales en la barra superior
  const allCards = document.querySelectorAll('.task-card');
  const mappedCount = document.querySelectorAll('.task-card[data-has-criteria="true"]').length;
  const unmappedCount = allCards.length - mappedCount;

  const bMapped = document.getElementById('badge-mapped-tasks');
  const bUnmapped = document.getElementById('badge-unmapped-tasks');
  if (bMapped) bMapped.textContent = mappedCount;
  if (bUnmapped) bUnmapped.textContent = unmappedCount;

  // Actualizar contador del grupo correspondiente
  const gIndex = card.getAttribute('data-group-index');
  if (gIndex !== null) {
    const groupCard = document.getElementById(`group-card-${gIndex}`);
    if (groupCard) {
      const gUnmapped = groupCard.querySelectorAll('.task-card[data-has-criteria="false"]').length;
      const gStatus = document.getElementById(`group-status-${gIndex}`);
      if (gStatus) {
        gStatus.innerHTML = gUnmapped > 0
          ? `<span class="badge bg-danger-subtle text-danger border border-danger small"><i class="fas fa-exclamation-triangle me-1"></i>${gUnmapped} sin criterios</span>`
          : `<span class="badge bg-success-subtle text-success border border-success small"><i class="fas fa-check me-1"></i>Todas asignadas</span>`;
      }
    }
  }
}

function attachMappingEvents() {
  const searchInput = document.getElementById('mapping-search-input');
  const btnClearSearch = document.getElementById('btn-clear-mapping-search');
  const filterBtns = document.querySelectorAll('.filter-mapping-btn');
  let currentFilter = 'all';

  function filterTasks() {
    const q = (searchInput?.value || '').trim().toLowerCase();
    const taskCards = document.querySelectorAll('.task-card');

    taskCards.forEach(card => {
      const title = card.getAttribute('data-task-label') || '';
      const hasCriteria = card.getAttribute('data-has-criteria') === 'true';

      let matchesFilter = true;
      if (currentFilter === 'unmapped') matchesFilter = !hasCriteria;
      if (currentFilter === 'mapped') matchesFilter = hasCriteria;

      let matchesSearch = !q || title.includes(q);

      if (matchesFilter && matchesSearch) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });

    // Ocultar grupos si ninguna tarea está visible
    document.querySelectorAll('.mapping-group-card').forEach(gCard => {
      const allTaskCards = gCard.querySelectorAll('.task-card');
      if (allTaskCards.length > 0) {
        const visibleTasks = gCard.querySelectorAll('.task-card:not([style*="display: none"])');
        gCard.style.display = visibleTasks.length ? '' : 'none';
      } else {
        // Para tarjetas de tema sin actividades (0 actividades): si hay búsqueda o filtro activo, ocultarlas
        if (q || currentFilter !== 'all') {
          gCard.style.display = 'none';
        } else {
          gCard.style.display = '';
        }
      }
    });
  }

  if (searchInput) searchInput.addEventListener('input', filterTasks);
  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      filterTasks();
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter') || 'all';
      filterTasks();
    });
  });

  // Botones desplegar / plegar todo
  document.getElementById('btn-expand-all-mapping')?.addEventListener('click', () => {
    document.querySelectorAll('#mapping-groups-list .collapse').forEach(el => {
      new bootstrap.Collapse(el, { show: true });
    });
  });

  document.getElementById('btn-collapse-all-mapping')?.addEventListener('click', () => {
    document.querySelectorAll('.task-collapse-body, .ra-collapse-body').forEach(el => {
      const inst = bootstrap.Collapse.getInstance(el) || new bootstrap.Collapse(el, { toggle: false });
      inst.hide();
    });
  });

  // Plegar / Desplegar RAs por tarea
  document.querySelectorAll('.btn-fold-task-ras').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const safeId = btn.getAttribute('data-safe-id');
      document.querySelectorAll(`[id^="ra-collapse-${safeId}-"]`).forEach(el => {
        const inst = bootstrap.Collapse.getInstance(el) || new bootstrap.Collapse(el, { toggle: false });
        inst.hide();
      });
    });
  });

  document.querySelectorAll('.btn-unfold-task-ras').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const safeId = btn.getAttribute('data-safe-id');
      document.querySelectorAll(`[id^="ra-collapse-${safeId}-"]`).forEach(el => {
        new bootstrap.Collapse(el, { show: true });
      });
    });
  });

  // Seleccionar / Deseleccionar todos los criterios de un RA
  document.querySelectorAll('.btn-select-all-crit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const safeId = btn.getAttribute('data-safe-id');
      const raId = btn.getAttribute('data-ra-id');
      document.querySelectorAll(`.map-checkbox-${safeId}[data-ra-id="${raId}"]`).forEach(chk => {
        chk.checked = true;
      });
      updateTaskUi(safeId, raId);
      renderSummary();
    });
  });

  document.querySelectorAll('.btn-deselect-all-crit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const safeId = btn.getAttribute('data-safe-id');
      const raId = btn.getAttribute('data-ra-id');
      document.querySelectorAll(`.map-checkbox-${safeId}[data-ra-id="${raId}"]`).forEach(chk => {
        chk.checked = false;
      });
      updateTaskUi(safeId, raId);
      renderSummary();
    });
  });

  // Checkboxes individuales
  taskOptions.forEach(task => {
    const safeId = task.id.replace(/:/g, '-');
    document.querySelectorAll(`.map-checkbox-${safeId}`).forEach(chk => {
      chk.addEventListener('change', () => {
        const raId = chk.getAttribute('data-ra-id');
        updateTaskUi(safeId, raId);
        renderSummary();
      });
    });
  });

  // Iconos de flechas chevron en acordeones
  document.querySelectorAll('.task-collapse-body').forEach(el => {
    const safeId = el.id.replace('task-collapse-', '');
    el.addEventListener('show.bs.collapse', () => {
      const icon = document.getElementById(`task-icon-${safeId}`);
      if (icon) { icon.classList.remove('fa-chevron-right'); icon.classList.add('fa-chevron-down'); }
    });
    el.addEventListener('hide.bs.collapse', () => {
      const icon = document.getElementById(`task-icon-${safeId}`);
      if (icon) { icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-right'); }
    });
  });

  document.querySelectorAll('.ra-collapse-body').forEach(el => {
    const idParts = el.id.replace('ra-collapse-', '').split('-');
    const safeId = idParts[0];
    const raId = idParts[1];
    el.addEventListener('show.bs.collapse', () => {
      const icon = document.getElementById(`ra-icon-${safeId}-${raId}`);
      if (icon) { icon.classList.remove('fa-chevron-right'); icon.classList.add('fa-chevron-down'); }
    });
    el.addEventListener('hide.bs.collapse', () => {
      const icon = document.getElementById(`ra-icon-${safeId}-${raId}`);
      if (icon) { icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-right'); }
    });
  });

  // Botones para alternar agrupación (Temas / Tipo)
  document.querySelectorAll('.group-mapping-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetGroup = btn.getAttribute('data-group-by');
      if (targetGroup && targetGroup !== currentGroupBy) {
        // Sincronizar checkboxes marcados al vuelo en cData.mapeo antes de redibujar
        const cData = getModData();
        taskOptions.forEach(task => {
          const safeId = task.id.replace(/:/g, '-');
          const checked = document.querySelectorAll(`.map-checkbox-${safeId}:checked`);
          if (checked.length > 0 || document.querySelector(`.map-checkbox-${safeId}`)) {
            if (cData.mapeo) {
              for (const r in cData.mapeo) {
                for (const c in cData.mapeo[r]) {
                  cData.mapeo[r][c] = (cData.mapeo[r][c] || []).filter(id => id !== task.id);
                }
              }
            } else {
              cData.mapeo = {};
            }
            checked.forEach(chk => {
              const [rId, cId] = chk.value.split('.');
              if (!cData.mapeo[rId]) cData.mapeo[rId] = {};
              if (!cData.mapeo[rId][cId]) cData.mapeo[rId][cId] = [];
              if (!cData.mapeo[rId][cId].includes(task.id)) cData.mapeo[rId][cId].push(task.id);
            });
          }
        });

        currentGroupBy = targetGroup;
        renderMapping();
      }
    });
  });

  // Chevrons para colapsar/desplegar grupos principales
  document.querySelectorAll('[id^="group-collapse-"]').forEach(el => {
    const gIndex = el.id.replace('group-collapse-', '');
    el.addEventListener('show.bs.collapse', () => {
      const icon = document.querySelector(`#group-card-${gIndex} .group-toggle-icon`);
      if (icon) { icon.classList.remove('fa-chevron-right'); icon.classList.add('fa-chevron-down'); }
    });
    el.addEventListener('hide.bs.collapse', () => {
      const icon = document.querySelector(`#group-card-${gIndex} .group-toggle-icon`);
      if (icon) { icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-right'); }
    });
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
