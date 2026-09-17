import { initAdminPage, showAdminToast, getBadgeForDB } from './shared.js';

const { db, user, userDoc, fb } = await initAdminPage();
const isAdmin = userDoc.rol === 'admin';



// Zona admin
if (isAdmin) {
  document.getElementById('propuestas-section').style.display = 'block';
  loadPropuestasAdmin();
}

loadEjerciciosAdmin();

// ── Catálogo de ejercicios ───────────────────────────────────
function loadEjerciciosAdmin() {
  const container = document.getElementById('ejercicios-admin-list');
  container.innerHTML = '';

  if (typeof EJERCICIOS === 'undefined' || !EJERCICIOS.length) {
    container.innerHTML = '<div class="alert bg-dark border-secondary text-muted">No hay ejercicios en el catálogo local.</div>';
    return;
  }

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
  if (!bloquesMap[1]) bloquesMap[1] = 'RA3: DDL';
  if (!bloquesMap[2]) bloquesMap[2] = 'RA4: Consultas Básicas';
  if (!bloquesMap[3]) bloquesMap[3] = 'RA4: Consultas Avanzadas';
  if (!bloquesMap[4]) bloquesMap[4] = 'RA4: Consultas Difíciles';

  const bloques = {};
  EJERCICIOS.forEach(e => {
    const grupo = (e.bloque_id && bloquesMap[e.bloque_id]) ? bloquesMap[e.bloque_id] : (e.grupo || 'Otros');
    const tanda = e.tanda || e.bd || 'General';
    if (!bloques[grupo]) bloques[grupo] = {};
    if (!bloques[grupo][tanda]) bloques[grupo][tanda] = [];
    bloques[grupo][tanda].push(e);
  });

  let bIdx = 0;
  Object.entries(bloques).forEach(([bloque, tandas]) => {
    const blockId = `collapse-block-${bIdx++}`;
    const section = document.createElement('div');
    section.className = 'mb-3';
    let html = `
      <button class="btn btn-outline-info w-100 text-start fw-bold" type="button"
              data-bs-toggle="collapse" data-bs-target="#${blockId}">
        <i class="fas fa-layer-group me-2"></i>${bloque}
      </button>
      <div class="collapse mt-2" id="${blockId}">
        <div class="card card-body bg-transparent border-info p-2">`;

    let tIdx = 0;
    Object.entries(tandas).forEach(([tanda, exs]) => {
      const tandaId = `${blockId}-tanda-${tIdx++}`;
      html += `
        <div class="mb-2">
          <button class="btn btn-sm btn-outline-secondary w-100 text-start" type="button"
                  data-bs-toggle="collapse" data-bs-target="#${tandaId}">
            <i class="fas fa-folder-open me-2"></i>${tanda.charAt(0).toUpperCase() + tanda.slice(1)}
            <span class="badge bg-secondary ms-2">${exs.length} ej.</span>
          </button>
          <div class="collapse mt-2" id="${tandaId}">
            <div class="row g-2 p-2">`;
      exs.forEach(ex => {
        html += `
          <div class="col-md-6 col-lg-4">
            <div class="card bg-dark border-secondary h-100">
              <div class="card-body p-3 d-flex flex-column">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <span class="badge bg-secondary">#${ex.id}</span>
                  ${getBadgeForDB(ex.bd)}
                </div>
                <h6 class="card-title text-white small mb-1">${ex.titulo}</h6>
                <div class="text-muted small text-truncate mb-3" style="font-size:0.75rem">${ex.tema}</div>
                <div class="mt-auto d-flex gap-2">
                  <button class="btn btn-sm btn-outline-info flex-grow-1" onclick="window._previewEx(${ex.id})">
                    <i class="fas fa-eye"></i> Ver
                  </button>
                  <button class="btn btn-sm btn-${isAdmin ? 'warning' : 'primary'} flex-grow-1" onclick="window._openEditEx(${ex.id})">
                    <i class="fas fa-${isAdmin ? 'edit' : 'lightbulb'}"></i> ${isAdmin ? 'Editar' : 'Proponer'}
                  </button>
                </div>
              </div>
            </div>
          </div>`;
      });
      html += `</div></div></div>`;
    });
    html += `</div></div>`;
    section.innerHTML = html;
    container.appendChild(section);
  });
}

// ── Preview ──────────────────────────────────────────────────
window._previewEx = function(id) {
  const ex = window.EJERCICIOS?.find(e => e.id === id);
  if (!ex) return;
  document.getElementById('preview-modal-titulo').innerHTML = `<span class="text-secondary">#${ex.id}</span> ${ex.titulo}`;
  document.getElementById('preview-modal-test-practica-btn').href = `../task/ejercicio.html?testExId=${ex.id}&modo=practica`;
  document.getElementById('preview-modal-test-examen-btn').href = `../task/ejercicio.html?testExId=${ex.id}&modo=examen`;
  let html = `
    <div class="mb-3 border-bottom border-secondary pb-3">
      ${getBadgeForDB(ex.bd)}
      <div style="font-size:0.9rem">${ex.enunciado}</div>
    </div>
    <div class="mb-2"><strong class="text-info">Pista:</strong> <span class="text-secondary small">${ex.pista || 'Sin pista'}</span></div>
    <div><strong class="text-success">Solución:</strong>
      <pre class="bg-dark p-3 rounded mt-2 text-success" style="font-size:0.82rem">${ex.query_solucion}</pre>
    </div>`;
  if (ex.variaciones?.length) {
    html += `<div class="mt-4"><strong class="text-warning"><i class="fas fa-random"></i> ${ex.variaciones.length} Variaciones:</strong>
      <div class="mt-2" style="max-height:300px;overflow-y:auto">`;
    ex.variaciones.forEach((v, i) => {
      html += `<div class="card bg-dark border-secondary mb-2">
        <div class="card-header py-1 px-2 text-secondary" style="font-size:0.75rem">Variante ${i+1}</div>
        <div class="card-body py-2 px-3">
          <div style="font-size:0.85rem" class="mb-2">${v.enunciado}</div>
          <pre class="bg-black p-2 rounded mb-0 text-success" style="font-size:0.8rem">${v.query_solucion}</pre>
        </div>
      </div>`;
    });
    html += `</div></div>`;
  }
  document.getElementById('preview-modal-body').innerHTML = html;
  new bootstrap.Modal(document.getElementById('preview-modal')).show();
};

// ── Editar / Proponer ────────────────────────────────────────
window._openEditEx = function(id) {
  const ex = window.EJERCICIOS?.find(e => e.id === id);
  if (!ex) return;
  document.getElementById('edit-ex-id').value         = ex.id;
  document.getElementById('edit-ex-titulo').value     = ex.titulo;
  document.getElementById('edit-ex-enunciado').value  = ex.enunciado;
  document.getElementById('edit-ex-solucion').value   = ex.query_solucion;
  document.getElementById('edit-ex-variaciones').value = ex.variaciones ? JSON.stringify(ex.variaciones, null, 2) : '[]';
  document.getElementById('modal-edit-ex-title').textContent = (isAdmin ? 'Editar Ejercicio #' : 'Proponer Mejora #') + ex.id;
  document.getElementById('btn-save-ex').onclick = () => saveExercise(ex.id);
  new bootstrap.Modal(document.getElementById('modal-edit-ex')).show();
};

async function saveExercise(id) {
  const titulo     = document.getElementById('edit-ex-titulo').value;
  const enunciado  = document.getElementById('edit-ex-enunciado').value;
  const solucion   = document.getElementById('edit-ex-solucion').value;
  let variaciones;
  try {
    variaciones = JSON.parse(document.getElementById('edit-ex-variaciones').value);
    if (!Array.isArray(variaciones)) throw new Error('Debe ser un array JSON');
  } catch(e) { alert('JSON inválido: ' + e.message); return; }

  const btn = document.getElementById('btn-save-ex');
  btn.disabled = true; btn.textContent = 'Guardando...';

  try {
    if (isAdmin) {
      await fb.updateDoc(fb.doc(db, 'banco_ejercicios', String(id)), { titulo, enunciado, query_solucion: solucion, variaciones });
      const local = window.EJERCICIOS?.find(e => e.id === id);
      if (local) { local.titulo = titulo; local.enunciado = enunciado; local.query_solucion = solucion; local.variaciones = variaciones; }
      showAdminToast('✅', 'Ejercicio actualizado');
      loadEjerciciosAdmin();
    } else {
      await fb.addDoc(fb.collection(db, 'propuestas_ejercicios'), {
        ejercicioId: id, docenteUid: user.uid, docenteEmail: user.email,
        titulo, enunciado, query_solucion: solucion, variaciones,
        estado: 'pendiente', createdAt: fb.serverTimestamp()
      });
      showAdminToast('📬', 'Propuesta enviada para revisión', 'info');
    }
    bootstrap.Modal.getInstance(document.getElementById('modal-edit-ex')).hide();
  } catch(e) {
    showAdminToast('❌', 'Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

// ── Propuestas (admin) ───────────────────────────────────────
async function loadPropuestasAdmin() {
  const container = document.getElementById('propuestas-admin-list');
  container.innerHTML = '<div class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin"></i></div>';

  try {
    const snap = await fb.getDocs(
      fb.query(fb.collection(db, 'propuestas_ejercicios'), fb.where('estado', '==', 'pendiente'))
    );
    if (snap.empty) {
      container.innerHTML = '<div class="alert bg-dark text-muted text-center border-secondary">No hay propuestas pendientes.</div>';
      return;
    }
    container.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const card = document.createElement('div');
      card.className = 'card bg-dark border-secondary mb-3';
      card.innerHTML = `
        <div class="card-body">
          <div class="d-flex justify-content-between">
            <h6 class="text-warning">Propuesta para Ejercicio #${data.ejercicioId}</h6>
            <span class="badge bg-secondary">${data.docenteEmail}</span>
          </div>
          <div class="row mt-3">
            <div class="col-md-6">
              <div class="small text-muted mb-1 fw-bold">Enunciado propuesto:</div>
              <div class="p-2 border border-secondary rounded" style="font-size:0.85rem">${data.enunciado}</div>
            </div>
            <div class="col-md-6">
              <div class="small text-muted mb-1 fw-bold">Solución propuesta:</div>
              <pre class="p-2 border border-secondary rounded text-success" style="font-size:0.85rem">${data.query_solucion}</pre>
            </div>
          </div>
          <div class="mt-3 d-flex gap-2">
            <button class="btn btn-sm btn-success" onclick="window._reviewPropuesta('${d.id}', true)"><i class="fas fa-check"></i> Aprobar</button>
            <button class="btn btn-sm btn-danger" onclick="window._reviewPropuesta('${d.id}', false)"><i class="fas fa-times"></i> Rechazar</button>
          </div>
        </div>`;
      container.appendChild(card);
    });
  } catch(e) {
    container.innerHTML = `<div class="alert bg-danger text-white">Error: ${e.message}</div>`;
  }
}

window._reviewPropuesta = async function(propuestaId, aprobar) {
  if (!confirm(`¿${aprobar ? 'Aprobar' : 'Rechazar'} esta propuesta?`)) return;
  try {
    const propRef  = fb.doc(db, 'propuestas_ejercicios', propuestaId);
    if (aprobar) {
      const propSnap = await fb.getDoc(propRef);
      const data     = propSnap.data();
      await fb.updateDoc(fb.doc(db, 'banco_ejercicios', String(data.ejercicioId)), {
        titulo: data.titulo, enunciado: data.enunciado,
        query_solucion: data.query_solucion, variaciones: data.variaciones
      });
    }
    await fb.updateDoc(propRef, { estado: aprobar ? 'aprobada' : 'rechazada' });
    showAdminToast('✅', `Propuesta ${aprobar ? 'aprobada' : 'rechazada'}`);
    loadPropuestasAdmin();
  } catch(e) {
    showAdminToast('❌', e.message, 'error');
  }
};

// ── Migrar ejercicios a Firebase ─────────────────────────────
// (Código de migración inicial borrado)
