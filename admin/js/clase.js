import { initAdminPage, showAdminToast } from './shared.js';

const { db, fb } = await initAdminPage();

const claseId = new URLSearchParams(window.location.search).get('id');
if (!claseId) window.location.href = 'clases.html';

let claseActual = null;
let currentBloquesActivos = [];
let currentTandasModo = {};
let currentTandasIds = [];

await loadClase();

// Exponer funciones globales para onclick
window._syncPendingStudents = syncPendingStudents;
window._addAlumnoToClass = addAlumnoToClass;
window._removeFromClass = removeFromClass;
window._saveBloques = saveBloques;
window._saveTandas = saveTandas;
window._verResultados = verResultados;

// Variables para Classroom Sync (funcionalidad pendiente de portar completa, dejo esqueleto)
window._openClassroomSyncModal = () => { showAdminToast('info', 'Sincronización con Classroom en desarrollo para esta versión.'); };

async function loadClase() {
  const snap = await fb.getDoc(fb.doc(db, 'clases', claseId));
  if (!snap.exists()) {
    showAdminToast('❌', 'Clase no encontrada', 'error');
    setTimeout(() => window.location.href = 'clases.html', 1500);
    return;
  }
  
  claseActual = snap.data();
  currentBloquesActivos = claseActual.bloquesActivos || [];
  currentTandasModo = claseActual.tandasModo || {};
  currentTandasIds = claseActual.tandasIds || [];
  
  document.getElementById('clase-detalle-titulo').textContent = claseActual.nombre;
  document.getElementById('clase-detalle-id').value = claseId;

  await renderAlumnos(claseActual);
  renderBloques(claseActual);
  renderGrid(claseActual);
}

async function renderAlumnos(clase) {
  const container = document.getElementById('clase-detalle-alumnos');
  container.innerHTML = '';

  const registradosIds = clase.alumnosIds || [];
  if (registradosIds.length === 0 && (clase.alumnosEmails || []).length === 0) {
    container.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay alumnos en esta clase.</td></tr>';
    return;
  }

  const registradosEmails = [];
  
  for (const uid of registradosIds) {
    const alumnoSnap = await fb.getDoc(fb.doc(db, 'usuarios', uid));
    if (alumnoSnap.exists()) {
      const alumno = alumnoSnap.data();
      registradosEmails.push(alumno.email);
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="d-flex align-items-center gap-2">
            ${alumno.foto ? `<img src="${alumno.foto}" style="width:28px;height:28px;border-radius:50%">` : '<div style="width:28px;height:28px;border-radius:50%;background:#1e293b;display:flex;align-items:center;justify-content:center">👤</div>'}
            <div>
              <div class="small fw-bold text-info">${alumno.nombre || '—'}</div>
              <div class="text-muted" style="font-size:0.7rem">${alumno.email}</div>
            </div>
          </div>
        </td>
        <td><span class="badge bg-warning text-dark">⭐ ${alumno.puntosTotal || 0}</span></td>
        <td class="small"><span class="badge bg-success">${alumno.ejerciciosOK || 0} ej. superados</span></td>
        <td>
          <button class="btn btn-sm btn-outline-danger" onclick="window._removeFromClass('${uid}')"><i class="fas fa-times"></i></button>
        </td>
      `;
      container.appendChild(tr);
    }
  }

  const pendingEmails = (clase.alumnosEmails || []).filter(e => !registradosEmails.includes(e));
  if (pendingEmails.length > 0) {
    const pendingRow = document.createElement('tr');
    pendingRow.innerHTML = `<td colspan="4" class="bg-dark text-muted small fw-bold py-2"><i class="fas fa-envelope me-2"></i>Pendientes de registro:</td>`;
    container.appendChild(pendingRow);
    
    pendingEmails.forEach(email => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="4">
          <div class="d-flex align-items-center gap-2">
            <div style="width:28px;height:28px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.7rem"><i class="fas fa-envelope"></i></div>
            <div class="text-muted small">${email} <span class="badge bg-secondary ms-2">Pendiente</span></div>
          </div>
        </td>
      `;
      container.appendChild(tr);
    });
  }
}

function renderBloques(clase) {
  const container = document.getElementById('bloques-toggles-container');
  container.innerHTML = '';
  
  if (typeof BLOQUES === 'undefined') {
    container.innerHTML = '<div class="text-danger p-3">Error: data de bloques no cargada.</div>';
    return;
  }

  // Filtrar bloques por el módulo de la clase
  const mod = clase.modulo || '0372';
  
  // Si es 2º ASIR (0377), permitir mostrar también los de 1º (0372) como repaso.
  let modBloques = BLOQUES.filter(b => b.modulo === mod);
  if (mod === '0377') {
    const bloques1o = BLOQUES.filter(b => b.modulo === '0372');
    modBloques = modBloques.concat(bloques1o);
  }
  
  if (modBloques.length === 0) {
    container.innerHTML = '<div class="text-muted p-3">No hay bloques definidos para este módulo.</div>';
    return;
  }

  // Create theory container
  const theoryContainer = document.createElement('div');
  theoryContainer.className = 'row g-3 mb-5';
  // theoryContainer.innerHTML = '<h6 class="text-info border-bottom border-info pb-2 mb-3"><i class="fas fa-book-open me-2"></i>Bloques de Teoría</h6>';

  modBloques.forEach(bloque => {
    if (bloque.tipo !== 'teoria') return; // Solo renderizar teoría
    
    const isActive = currentBloquesActivos.includes(bloque.id);
    const disabled = !bloque.implementado ? 'disabled' : '';
    const badgeColor = bloque.implementado ? 'success' : 'secondary';
    const badgeText = bloque.implementado ? 'Implementado' : 'En desarrollo';
    
    const card = document.createElement('div');
    card.className = 'col-md-6 col-lg-4';
    
    const previewBtn = bloque.implementado ? 
      `<a href="../task/teoria.html?bloqueId=${bloque.id}&claseId=${claseId}" target="_blank" class="btn btn-sm btn-outline-info mt-3 w-100" style="font-size:0.8rem;">
         <i class="fas fa-eye me-1"></i> Previsualizar Teoría
       </a>` : '';

    card.innerHTML = `
      <div class="block-toggle-card ${disabled} h-100 d-flex flex-column" style="border-color: rgba(13,202,240,0.2)">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <div>
            <span class="badge bg-${badgeColor} mb-2">${badgeText}</span>
            <h6 class="mb-1 text-white">${bloque.nombre}</h6>
            <div class="text-secondary small">RA${bloque.ra}</div>
          </div>
          <div class="form-check form-switch" style="z-index: 10;">
            <input class="form-check-input block-toggle-input" type="checkbox" role="switch" 
                   value="${bloque.id}" id="toggle-${bloque.id}" ${isActive ? 'checked' : ''} ${disabled}>
          </div>
        </div>
        <p class="text-muted mb-0 flex-grow-1" style="font-size:0.8rem">${bloque.desc || 'Sin descripción'}</p>
        ${previewBtn}
      </div>
    `;
    
    theoryContainer.appendChild(card);
  });
  
  container.appendChild(theoryContainer);
}

async function saveBloques() {
  const checkboxes = document.querySelectorAll('.block-toggle-input:checked');
  const nuevosActivos = Array.from(checkboxes).map(cb => parseInt(cb.value));
  
  try {
    await fb.updateDoc(fb.doc(db, 'clases', claseId), { bloquesActivos: nuevosActivos });
    currentBloquesActivos = nuevosActivos;
    showAdminToast('✅', 'Bloques actualizados correctamente');
  } catch (e) {
    showAdminToast('❌', 'Error al guardar bloques: ' + e.message, 'error');
  }
}

async function addAlumnoToClass() {
  const email = document.getElementById('clase-modal-add-email').value.trim().toLowerCase();
  if (!email) return;

  try {
    const claseRef = fb.doc(db, 'clases', claseId);
    const q = fb.query(fb.collection(db, 'usuarios'), fb.where('email', '==', email));
    const snap = await fb.getDocs(q);

    if (!snap.empty) {
      const uid = snap.docs[0].id;
      if (!claseActual.alumnosIds?.includes(uid)) {
        const nuevosIds = [...(claseActual.alumnosIds || []), uid];
        await fb.updateDoc(claseRef, { alumnosIds: nuevosIds });
        await fb.updateDoc(fb.doc(db, 'usuarios', uid), { claseId });
        showAdminToast('✅', 'Alumno vinculado a la clase');
      }
    } else {
      if (!claseActual.alumnosEmails?.includes(email)) {
        const nuevosEmails = [...(claseActual.alumnosEmails || []), email];
        await fb.updateDoc(claseRef, { alumnosEmails: nuevosEmails });
        showAdminToast('📧', 'Invitación enviada por email');
      }
    }
    document.getElementById('clase-modal-add-email').value = '';
    loadClase();
  } catch (e) {
    showAdminToast('❌', e.message, 'error');
  }
}

async function removeFromClass(uid) {
  if (!confirm('¿Quitar alumno de esta clase? Sus intentos no se borrarán, pero perderá acceso a la clase.')) return;
  try {
    const nuevosIds = (claseActual.alumnosIds || []).filter(id => id !== uid);
    await fb.updateDoc(fb.doc(db, 'clases', claseId), { alumnosIds: nuevosIds });
    await fb.updateDoc(fb.doc(db, 'usuarios', uid), { claseId: fb.deleteField() });
    showAdminToast('✅', 'Alumno quitado');
    loadClase();
  } catch (e) {
    showAdminToast('❌', e.message, 'error');
  }
}

async function syncPendingStudents() {
  if (!claseActual || !(claseActual.alumnosEmails?.length)) {
    showAdminToast('ℹ️', 'No hay correos pendientes', 'info');
    return;
  }
  
  showAdminToast('⏳', 'Buscando usuarios...', 'info');
  let count = 0;
  try {
    const registrados = claseActual.alumnosIds || [];
    for (const email of claseActual.alumnosEmails) {
      const q = fb.query(fb.collection(db, 'usuarios'), fb.where('email', '==', email));
      const snap = await fb.getDocs(q);
      if (!snap.empty) {
        const uid = snap.docs[0].id;
        if (!registrados.includes(uid)) {
          registrados.push(uid);
          await fb.updateDoc(fb.doc(db, 'usuarios', uid), { claseId });
          count++;
        }
      }
    }
    
    if (count > 0) {
      await fb.updateDoc(fb.doc(db, 'clases', claseId), { alumnosIds: registrados });
      showAdminToast('✅', `${count} alumnos vinculados`);
      loadClase();
    } else {
      showAdminToast('ℹ️', 'Ningún alumno nuevo ha accedido', 'info');
    }
  } catch (e) {
    showAdminToast('❌', e.message, 'error');
  }
}


function renderGrid(clase) {
  const thead = document.getElementById('grid-header');
  const tbody = document.getElementById('grid-body');
  if (!thead || !tbody) return;

  const bdsDisponibles = new Set();
  const matrizEjercicios = {};
  
  for (let i = 1; i <= 4; i++) {
    matrizEjercicios[i] = {};
  }

  if (window.EJERCICIOS) {
    window.EJERCICIOS.forEach(ex => {
      if (!ex.bloque_id || !ex.bd) return;
      bdsDisponibles.add(ex.bd);
      if (!matrizEjercicios[ex.bloque_id]) matrizEjercicios[ex.bloque_id] = {};
      if (!matrizEjercicios[ex.bloque_id][ex.bd]) matrizEjercicios[ex.bloque_id][ex.bd] = 0;
      matrizEjercicios[ex.bloque_id][ex.bd]++;
    });
  }

  const bds = Array.from(bdsDisponibles).sort();
  
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


  thead.innerHTML = '<th>Bloque</th>' + bds.map(bd => `<th>${bd.toUpperCase()}</th>`).join('');

  let tbodyHtml = '';
  for (let b = 1; b <= 4; b++) {
    tbodyHtml += `<tr><td class="fw-bold text-start text-nowrap">${bloquesMap[b]}</td>`;
    bds.forEach(bd => {
      const count = matrizEjercicios[b][bd] || 0;
      if (count > 0) {
        const tId = `${b}:${bd}`;
        const isActivo = currentTandasIds.includes(tId);
        const modo = currentTandasModo[tId] || 'practica';
        
        tbodyHtml += `
          <td style="min-width: 140px; padding: 0.75rem;">
            <div class="d-flex flex-column gap-2 align-items-center">
              <div class="form-check form-switch m-0 d-flex justify-content-center w-100">
                <input class="form-check-input tanda-toggle" type="checkbox" data-tid="${tId}" ${isActivo ? 'checked' : ''}>
              </div>
              <select class="form-select form-select-sm dark-input text-center w-100 tanda-modo" data-tid="${tId}" ${isActivo ? '' : 'disabled'}>
                <option value="practica" ${modo === 'practica' ? 'selected' : ''}>Práctica</option>
                <option value="examen" ${modo === 'examen' ? 'selected' : ''}>Examen</option>
              </select>
              <button class="btn btn-sm btn-outline-info w-100 mt-1" onclick="window._verResultados('${tId}')">
                <i class="fas fa-chart-bar"></i> Ver Notas
              </button>
            </div>
          </td>
        `;
      } else {
        tbodyHtml += `<td class="text-muted small align-middle">0 ej.</td>`;
      }
    });
    tbodyHtml += `</tr>`;
  }
  tbody.innerHTML = tbodyHtml;

  document.querySelectorAll('.tanda-toggle').forEach(el => {
    el.addEventListener('change', (e) => {
      const select = document.querySelector(`.tanda-modo[data-tid="${e.target.dataset.tid}"]`);
      if (select) select.disabled = !e.target.checked;
    });
  });
}

async function saveTandas() {
  const toggles = document.querySelectorAll('.tanda-toggle:checked');
  const nuevosIds = [];
  const nuevosModos = {};
  
  toggles.forEach(t => {
    const tId = t.dataset.tid;
    nuevosIds.push(tId);
    const select = document.querySelector(`.tanda-modo[data-tid="${tId}"]`);
    nuevosModos[tId] = select ? select.value : 'practica';
  });
  
  try {
    await fb.updateDoc(fb.doc(db, 'clases', claseId), { 
      tandasIds: nuevosIds,
      tandasModo: nuevosModos
    });
    currentTandasIds = nuevosIds;
    currentTandasModo = nuevosModos;
    showAdminToast('✅', 'Tandas guardadas correctamente');
  } catch(e) {
    showAdminToast('❌', 'Error al guardar tandas: ' + e.message, 'error');
  }
}

async function verResultados(tId) {
  const [b, bd] = tId.split(':');
  document.getElementById('resultados-tanda-title').textContent = `Resultados - Bloque ${b} (${bd.toUpperCase()})`;
  document.getElementById('resultados-tanda-body').innerHTML = '<div class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin"></i> Cargando notas...</div>';
  
  const modalEl = document.getElementById('modal-resultados');
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  modal.show();

  try {
    const q = fb.query(fb.collection(db, 'intentos_tandas'), 
      fb.where('claseId', '==', claseId),
      fb.where('tandaId', '==', tId)
    );
    const snap = await fb.getDocs(q);
    
    const usersResults = {};
    snap.forEach(d => {
      const r = d.data();
      if (!usersResults[r.uid]) usersResults[r.uid] = [];
      usersResults[r.uid].push(r);
    });

    let html = `
      <table class="table table-dark table-sm table-striped table-hover mb-0">
        <thead><tr><th>Alumno</th><th>Email</th><th>Mejor Nota</th><th>Intentos</th></tr></thead>
        <tbody>
    `;
    
    if (Object.keys(usersResults).length === 0) {
      html += '<tr><td colspan="4" class="text-center text-muted py-4">No hay intentos registrados aún para esta tanda.</td></tr>';
    } else {
      for (const [uid, intentos] of Object.entries(usersResults)) {
        const sorted = intentos.sort((a,b) => (b.nota || 0) - (a.nota || 0));
        const best = sorted[0];
        html += `
          <tr>
            <td>${best.nombre || '—'}</td>
            <td><span class="text-secondary small">${best.email || '—'}</span></td>
            <td><span class="badge ${best.nota >= 5 ? 'bg-success' : 'bg-danger'}" style="font-size:0.9rem">${(best.nota || 0).toFixed(2)}</span></td>
            <td><span class="badge bg-secondary">${intentos.length}</span></td>
          </tr>
        `;
      }
    }
    html += '</tbody></table>';
    
    document.getElementById('resultados-tanda-body').innerHTML = html;
  } catch (e) {
    document.getElementById('resultados-tanda-body').innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
  }
}
