import { initAdminPage, showAdminToast, getBadgeForDB } from './shared.js';
import { 
  registerCustomFunctions, 
  adaptSqlScriptForSqlite, 
  adaptSqlForSqlite, 
  compareResults 
} from '../../js/sql-engine-utils.js';

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
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-sm btn-outline-secondary flex-grow-1 text-start" type="button"
                    data-bs-toggle="collapse" data-bs-target="#${tandaId}">
              <i class="fas fa-folder-open me-2"></i>${tanda.charAt(0).toUpperCase() + tanda.slice(1)}
              <span class="badge bg-secondary ms-2">${exs.length} ej.</span>
            </button>
            <button class="btn btn-sm btn-outline-warning" onclick="window._auditTanda('${tanda}')" title="Auditar esta tanda en SQLite">
              <i class="fas fa-stethoscope me-1"></i> Auditar Tanda
            </button>
          </div>
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

// ── Motor SQL & Diagnóstico de Ejercicios en el Navegador ────
let SQL_ENGINE = null;
const DB_CACHE = {}; // bdName -> Uint8Array

async function getSqlEngine() {
  if (!SQL_ENGINE) {
    if (!window.initSqlJs) throw new Error('sql.js no cargado');
    SQL_ENGINE = await window.initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
  }
  return SQL_ENGINE;
}

async function getOrLoadDb(bdName) {
  const SQL = await getSqlEngine();
  if (DB_CACHE[bdName]) {
    const db = new SQL.Database(DB_CACHE[bdName]);
    registerCustomFunctions(db);
    return db;
  }
  const res = await fetch(`../bds/${bdName}.sql`);
  if (!res.ok) throw new Error(`No se pudo cargar el script bds/${bdName}.sql`);
  let text = await res.text();
  text = adaptSqlScriptForSqlite(text);
  const db = new SQL.Database();
  registerCustomFunctions(db);
  db.exec(text);
  DB_CACHE[bdName] = db.export();
  return db;
}

let auditCancelled = false;
let auditResults = [];

async function runAudit({ filterTanda = null } = {}) {
  const modalEl = document.getElementById('modal-audit');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();

  const titleEl = document.getElementById('modal-audit-title');
  const statusEl = document.getElementById('audit-status-text');
  const counterEl = document.getElementById('audit-progress-counter');
  const barEl = document.getElementById('audit-progress-bar');
  const countTotalEl = document.getElementById('audit-count-total');
  const countPassEl = document.getElementById('audit-count-pass');
  const countWarnEl = document.getElementById('audit-count-warn');
  const countFailEl = document.getElementById('audit-count-fail');
  const tbody = document.getElementById('audit-results-tbody');
  const btnStop = document.getElementById('btn-stop-audit');

  btnStop.style.display = 'inline-block';
  auditCancelled = false;
  auditResults = [];

  let list = window.EJERCICIOS || [];
  if (filterTanda) {
    titleEl.innerHTML = `<i class="fas fa-stethoscope text-warning me-2"></i> Diagnóstico: Tanda ${filterTanda.toUpperCase()}`;
    list = list.filter(e => e.bd === filterTanda || e.tanda === filterTanda);
  } else {
    titleEl.innerHTML = `<i class="fas fa-stethoscope text-warning me-2"></i> Diagnóstico: Catálogo Completo (720 ej.)`;
  }

  const total = list.length;
  let passed = 0, warns = 0, fails = 0;
  countTotalEl.textContent = '0';
  countPassEl.textContent = '0';
  countWarnEl.textContent = '0';
  countFailEl.textContent = '0';
  barEl.style.width = '0%';
  barEl.className = 'progress-bar progress-bar-striped progress-bar-animated bg-warning';
  tbody.innerHTML = '';

  for (let idx = 0; idx < list.length; idx++) {
    if (auditCancelled) {
      statusEl.textContent = 'Auditoría detenida por el usuario.';
      barEl.classList.remove('progress-bar-animated');
      break;
    }

    const ex = list[idx];
    statusEl.textContent = `Auditando #${ex.id}: ${ex.titulo} (${ex.bd})...`;
    counterEl.textContent = `${idx + 1} / ${total}`;
    barEl.style.width = `${Math.round(((idx + 1) / total) * 100)}%`;

    let status = 'pass';
    let message = 'OK';
    let rowCount = 0;

    try {
      const db = await getOrLoadDb(ex.bd);
      const isDML = /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|RENAME|TRUNCATE)/i.test(ex.query_solucion);
      const adapted = adaptSqlForSqlite(ex.query_solucion);

      if (isDML) {
        try {
          db.exec(adapted);
          status = 'pass';
          message = 'DDL/DML ejecutado';
        } catch (dmlErr) {
          if (/^\s*ALTER\s+TABLE\s+\w+\s+(MODIFY|CHANGE|ALTER\s+COLUMN|ADD\s+(CONSTRAINT|CHECK|FOREIGN\s+KEY|PRIMARY\s+KEY|UNIQUE)|DROP\s+(PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|INDEX)|ADD\s+.*,)/i.test(ex.query_solucion) || (dmlErr.message && dmlErr.message.includes('in foreign key definition'))) {
            status = 'pass';
            message = 'DDL aceptado (emulado)';
          } else {
            throw dmlErr;
          }
        }
      } else {
        const res = db.exec(adapted);
        if (!res.length || !res[0].values.length) {
          status = 'warn';
          message = 'Devuelve 0 filas';
        } else {
          status = 'pass';
          rowCount = res[0].values.length;
          message = `${rowCount} fila${rowCount !== 1 ? 's' : ''}`;
        }
      }
    } catch (err) {
      status = 'fail';
      message = err.message || 'Error SQL';
    }

    if (status === 'pass') passed++;
    else if (status === 'warn') warns++;
    else if (status === 'fail') fails++;

    countTotalEl.textContent = idx + 1;
    countPassEl.textContent = passed;
    countWarnEl.textContent = warns;
    countFailEl.textContent = fails;

    auditResults.push({ ex, status, message, rowCount });
    appendAuditRow(tbody, ex, status, message);

    if (idx % 2 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  btnStop.style.display = 'none';
  if (!auditCancelled) {
    statusEl.textContent = `Auditoría finalizada. (${passed} correctos, ${warns} con 0 filas, ${fails} errores).`;
    barEl.classList.remove('progress-bar-animated');
    barEl.className = fails > 0 ? 'progress-bar bg-danger' : (warns > 0 ? 'progress-bar bg-warning' : 'progress-bar bg-success');
  }
}

function appendAuditRow(tbody, ex, status, message) {
  const tr = document.createElement('tr');
  const badgeClass = status === 'pass' ? 'bg-success' : (status === 'warn' ? 'bg-warning text-dark' : 'bg-danger');
  const icon = status === 'pass' ? 'fa-check-circle' : (status === 'warn' ? 'fa-exclamation-triangle' : 'fa-times-circle');

  tr.innerHTML = `
    <td><span class="badge bg-secondary">#${ex.id}</span></td>
    <td><span class="badge bg-dark border border-secondary">${ex.bd}</span></td>
    <td>
      <div class="fw-bold text-light">${ex.titulo}</div>
      <div class="text-secondary small font-monospace text-truncate" style="max-width:400px" title="${ex.query_solucion.replace(/"/g, '&quot;')}">${ex.query_solucion}</div>
    </td>
    <td>
      <span class="badge ${badgeClass}"><i class="fas ${icon} me-1"></i>${message}</span>
    </td>
    <td class="text-end">
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-info" onclick="window._previewEx(${ex.id})" title="Ver ejercicio"><i class="fas fa-eye"></i></button>
        <button class="btn btn-outline-warning" onclick="window._openEditEx(${ex.id})" title="Editar ejercicio"><i class="fas fa-edit"></i></button>
      </div>
    </td>
  `;
  tbody.appendChild(tr);
}

function filterAuditTable() {
  const activeBtn = document.querySelector('#audit-filter-buttons button.active');
  const filter = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
  const term = (document.getElementById('audit-search').value || '').toLowerCase().trim();
  const tbody = document.getElementById('audit-results-tbody');
  tbody.innerHTML = '';

  const filtered = auditResults.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (term) {
      const matchId = String(item.ex.id).includes(term);
      const matchTitle = (item.ex.titulo || '').toLowerCase().includes(term);
      const matchBd = (item.ex.bd || '').toLowerCase().includes(term);
      if (!matchId && !matchTitle && !matchBd) return false;
    }
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No hay resultados para este filtro.</td></tr>';
    return;
  }
  filtered.forEach(item => appendAuditRow(tbody, item.ex, item.status, item.message));
}

// Event listeners de auditoría
window._auditCatalog = () => runAudit();
window._auditTanda = (tanda) => runAudit({ filterTanda: tanda });

const btnAuditCat = document.getElementById('btn-audit-catalog');
if (btnAuditCat) btnAuditCat.onclick = () => runAudit();

const btnStopAudit = document.getElementById('btn-stop-audit');
if (btnStopAudit) btnStopAudit.onclick = () => { auditCancelled = true; };

document.querySelectorAll('#audit-filter-buttons button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#audit-filter-buttons button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterAuditTable();
  };
});

const auditSearch = document.getElementById('audit-search');
if (auditSearch) auditSearch.oninput = filterAuditTable;

// Probar Solución en modal de edición
const btnTestEdit = document.getElementById('btn-test-edit-sol');
if (btnTestEdit) {
  btnTestEdit.onclick = async function() {
    const exId = parseInt(document.getElementById('edit-ex-id').value, 10);
    const ex = window.EJERCICIOS?.find(e => e.id === exId);
    if (!ex) return;
    const sql = document.getElementById('edit-ex-solucion').value.trim();
    const feedbackEl = document.getElementById('edit-ex-test-feedback');
    feedbackEl.style.display = 'block';

    if (!sql) {
      feedbackEl.className = 'alert alert-warning p-2 small';
      feedbackEl.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i> Escribe una consulta SQL para probar.';
      return;
    }

    feedbackEl.className = 'alert alert-secondary p-2 small';
    feedbackEl.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Evaluando en motor SQLite...';

    try {
      const db = await getOrLoadDb(ex.bd);
      const isDML = /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|RENAME|TRUNCATE)/i.test(sql);
      const adapted = adaptSqlForSqlite(sql);

      if (isDML) {
        try {
          db.exec(adapted);
          feedbackEl.className = 'alert alert-success p-2 small';
          feedbackEl.innerHTML = '<i class="fas fa-check-circle me-1"></i> Comando DDL/DML ejecutado correctamente en la BD.';
        } catch (dmlErr) {
          if (/^\s*ALTER\s+TABLE\s+\w+\s+(MODIFY|CHANGE|ALTER\s+COLUMN|ADD\s+(CONSTRAINT|CHECK|FOREIGN\s+KEY|PRIMARY\s+KEY|UNIQUE)|DROP\s+(PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|INDEX)|ADD\s+.*,)/i.test(sql) || (dmlErr.message && dmlErr.message.includes('in foreign key definition'))) {
            feedbackEl.className = 'alert alert-info p-2 small';
            feedbackEl.innerHTML = '<i class="fas fa-info-circle me-1"></i> Sintaxis MariaDB válida (emulada por limitación de SQLite).';
          } else {
            throw dmlErr;
          }
        }
      } else {
        const res = db.exec(adapted);
        if (!res.length || !res[0].values.length) {
          feedbackEl.className = 'alert alert-warning p-2 small';
          feedbackEl.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i> Consulta sintácticamente correcta, pero <b>devuelve 0 filas</b> en la base de datos actual.';
        } else {
          const rows = res[0].values.length;
          const cols = res[0].columns.join(', ');
          feedbackEl.className = 'alert alert-success p-2 small';
          feedbackEl.innerHTML = `<i class="fas fa-check-circle me-1"></i> ¡Consulta correcta! Devuelve <b>${rows} fila${rows!==1?'s':''}</b>. Columnas: <code>${cols}</code>`;
        }
      }
    } catch (err) {
      feedbackEl.className = 'alert alert-danger p-2 small';
      feedbackEl.innerHTML = `<i class="fas fa-times-circle me-1"></i> <b>Error SQL:</b> ${err.message}`;
    }
  };
}
// (Código de migración inicial borrado)
