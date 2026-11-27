import { initTaskPage, showToast } from './auth.js';
import { evaluarLogros } from './medal-logic.js';
import { 
  registerCustomFunctions, 
  adaptSqlScriptForSqlite, 
  adaptSqlForSqlite, 
  compareResults 
} from '../../js/sql-engine-utils.js?v=5';


let user, userDoc, db, fb;
let currentClase = null;
let currentClaseId = null;
let currentTanda = null;
let currentModo = 'practica'; // o 'examen'
let currentEjercicios = [];
let currentDatabaseName = '';
let currentExId = null;

let isExamSubmitted = false;
let isConfirmingSubmit = false;
let isWarningModalOpen = false;
let antiCheatInitialized = false;

let sqlDb = null;
let sqlWorker = null;
let SQL_ENGINE = null;
const DB_CACHE = {};

// Referencias DOM
const exListEl = document.getElementById('ex-list');
const titleBadge = document.getElementById('ex-title-badge');
const modoBadge = document.getElementById('header-modo-badge');
const exTitleEl = document.getElementById('current-ex-title');
const exTextEl = document.getElementById('current-ex-text');
const exBadgeEl = document.getElementById('current-ex-badge');
const sqlEditor = document.getElementById('sql-editor');
const btnRun = document.getElementById('btn-run');
const resultsContainer = document.getElementById('results-container');
const rowCountBadge = document.getElementById('row-count');

// Init
initTaskPage().then(res => {
  user = res.user; userDoc = res.userDoc; db = res.db; fb = res.fb;
  initEditorPage();
}).catch(console.error);

async function initEditorPage() {
  const params = new URLSearchParams(window.location.search);
  const claseId = params.get('claseId');
  currentClaseId = claseId;
  const tandaId = params.get('tandaId');
  const bloqueId = params.get('bloqueId'); // Si viene por bloque (nuevo sistema)
  const testExId = params.get('testExId') || params.get('testId');
  currentModo = params.get('modo') || 'practica';

  if (testExId && userDoc.rol !== 'alumno') {
    const ex = window.EJERCICIOS.find(e => e.id == testExId);
    if (!ex) { alert('Ejercicio no encontrado'); return; }
    
    const tandaName = ex.tanda || ex.bd;
    currentEjercicios = window.EJERCICIOS.filter(e => (e.tanda || e.bd) === tandaName && e.bloque_id === ex.bloque_id);
    
    currentTanda = 'Test Docente - ' + (tandaName || 'Tanda');
    titleBadge.textContent = currentTanda;
    
    document.getElementById('btn-volver-tandas').onclick = () => window.close();
    
    modoBadge.textContent = currentModo === 'examen' ? 'TEST (EXAMEN)' : 'TEST (PRÁCTICA)';
    modoBadge.className = currentModo === 'examen' ? 'badge bg-danger text-white' : 'badge bg-warning text-dark';
    
    if (currentModo === 'examen') {
      document.getElementById('btn-submit-tanda').style.display = 'block';
      document.getElementById('btn-submit-tanda').onclick = () => { alert('En un examen real, aquí se entregarían las respuestas.'); window.close(); };
      document.getElementById('btn-hint').style.display = 'none';
    }
    
    await updateProgressUI();
    loadExercise(ex.id);
    
    btnRun.onclick = runQuery;
    document.getElementById('btn-show-schema').onclick = showSchema;
    const nomnomlBtnTest = document.getElementById('btn-show-nomnoml');
    if (nomnomlBtnTest) nomnomlBtnTest.onclick = showSchema;
    const btnResetTest = document.getElementById('btn-reset-db');
    if (btnResetTest) btnResetTest.onclick = resetCurrentDatabase;
    return;
  }
  
  if (!claseId) { window.location.href = 'clases.html'; return; }
  if (!tandaId && !bloqueId) { window.location.href = `tandas.html?claseId=${claseId}`; return; }

  // Cargar clase
  try {
    const snap = await fb.getDoc(fb.doc(db, 'clases', claseId));
    if (!snap.exists()) throw new Error('Clase no encontrada');
    currentClase = snap.data();
    
    // Validar acceso (si es alumno, debe estar en la clase)
    if (userDoc.rol === 'alumno' && !currentClase.alumnosIds?.includes(user.uid)) {
      throw new Error('No estás en esta clase');
    }
  } catch(e) {
    alert(e.message); window.location.href = 'clases.html'; return;
  }

  // Setup UI general
  document.getElementById('btn-volver-tandas').onclick = () => window.location.href = `tandas.html?claseId=${claseId}`;
  modoBadge.textContent = currentModo.toUpperCase();
  modoBadge.className = `badge ${currentModo === 'examen' ? 'bg-danger' : 'bg-success'}`;
  
  if (currentModo === 'examen') {
    document.getElementById('btn-submit-tanda').style.display = 'block';
    document.getElementById('btn-submit-tanda').onclick = () => submitExam(false);
    document.getElementById('btn-hint').style.display = 'none';
  }

  // Cargar Ejercicios
  if (bloqueId) {
    // Nuevo sistema: por bloque entero
    const bloque = window.BLOQUES?.find(b => b.id == parseInt(bloqueId));
    if(!bloque) { alert('Bloque no encontrado'); return; }
    currentTanda = bloque.nombre;
    titleBadge.textContent = bloque.nombre;
    currentEjercicios = window.EJERCICIOS.filter(e => 
      e.bloque_id == parseInt(bloqueId) || 
      e.grupo === bloque.nombre || 
      (bloque.nombre && bloque.nombre.includes(e.grupo))
    );
  } else if (tandaId) {
    // Sistema legacy: por bd (ej: "1:nba")
    const [bId, bd] = tandaId.split(':');
    currentTanda = `Bloque ${bId} - ${bd.toUpperCase()}`;
    titleBadge.textContent = currentTanda;
    currentEjercicios = window.EJERCICIOS.filter(e => e.bloque_id == parseInt(bId) && (e.bd === bd || e.tanda === bd));
  }

  if (currentEjercicios.length === 0) {
    exListEl.innerHTML = '<div class="p-3 text-warning">No hay ejercicios para esta selección.</div>';
    return;
  }
  
  if (currentModo === 'examen' && userDoc.rol === 'alumno') {
    try {
      const qEx = fb.query(fb.collection(db, 'usuarios', user.uid, 'examenes'), fb.where('tandaId', '==', currentTanda));
      const snapEx = await fb.getDocs(qEx);
      if (!snapEx.empty) {
        // Ya lo entregó -> Modo revisión permanente (un examen NUNCA puede repetirse)
        isExamSubmitted = true;
        const lastExam = snapEx.docs.sort((a,b) => b.data().fecha.localeCompare(a.data().fecha))[0].data();
        window.examAnswers = lastExam.respuestas || {};
        const btnSubmit = document.getElementById('btn-submit-tanda');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-lock"></i> Examen Entregado';
        btnSubmit.classList.replace('btn-success', 'btn-secondary');
        showToast('ℹ️', 'Estás revisando un examen ya entregado.', 'info');
      } else {
        // Examen activo sin entregar -> activar detector anti-trampas
        setupExamAntiCheat(claseId, currentTanda);
      }
    } catch(e) { console.error('Error cargando examen previo:', e); }
  }

  // El reinicio SOLO está disponible en modo práctica
  const btnReiniciar = document.getElementById('btn-reiniciar-tanda');
  if (btnReiniciar) {
    if (currentModo === 'practica') {
      btnReiniciar.style.display = 'inline-block';
      const btnReiniciarText = document.getElementById('btn-reiniciar-tanda-text');
      if (btnReiniciarText) btnReiniciarText.textContent = 'Reiniciar Tanda';
      btnReiniciar.onclick = reiniciarTandaPractica;
    } else {
      btnReiniciar.style.display = 'none';
    }
  }

  if (currentModo === 'examen') {
    // Si son ejercicios de DDL (bloque 1), el orden es estricto porque unas tablas dependen de otras.
    const isDDL = currentEjercicios.some(e => e.bloque_id == 1 || e.grupo === 'DDL');
    if (!isDDL) {
      // Barajar aleatoriamente los ejercicios en modo examen
      for (let i = currentEjercicios.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [currentEjercicios[i], currentEjercicios[j]] = [currentEjercicios[j], currentEjercicios[i]];
      }
    }
  }

  // Comprobar estado del usuario en estos ejercicios (si ya superó alguno)
  await updateProgressUI();
  
  // Seleccionar el primero o el primer no superado
  let firstPending = currentEjercicios.find(e => !e._superado);
  loadExercise(firstPending ? firstPending.id : currentEjercicios[0].id);

  btnRun.onclick = runQuery;
  document.getElementById('btn-show-schema').onclick = showSchema;
  
  const nomnomlBtn = document.getElementById('btn-show-nomnoml');
  if(nomnomlBtn) nomnomlBtn.onclick = showSchema;

  const btnReset = document.getElementById('btn-reset-db');
  if (btnReset) btnReset.onclick = resetCurrentDatabase;
}

async function reiniciarTandaPractica() {
  const tieneProgreso = currentEjercicios.some(e => e._superado);
  const msg = tieneProgreso
    ? '¿Deseas volver a iniciar esta tanda de práctica desde cero? Tu progreso anterior quedará guardado en tu historial.'
    : '¿Deseas reiniciar esta tanda de ejercicios de práctica?';

  if (!confirm(msg)) return;

  const btnReiniciar = document.getElementById('btn-reiniciar-tanda');
  if (btnReiniciar) btnReiniciar.disabled = true;

  try {
    // 1. Guardar constancia del intento anterior en el historial si es alumno y tenía progreso
    if (userDoc.rol === 'alumno' && tieneProgreso) {
      const snapEjercicios = currentEjercicios.map(e => ({
        id: e.id,
        titulo: e.titulo,
        superado: !!e._superado,
        respuesta_sql: e._respuesta_sql || ''
      }));
      const completados = currentEjercicios.filter(e => e._superado).length;
      const total = currentEjercicios.length;
      const nowIso = new Date().toISOString();

      const attemptDocId = `practica_${Date.now()}`;
      const snapshotData = {
        claseId: currentClaseId || null,
        tandaId: currentTanda,
        fecha: nowIso,
        modo: 'practica',
        tipoRegistro: 'practica',
        completados,
        total,
        ejercicios: snapEjercicios
      };

      // Guardar en la subcolección 'examenes' (que tiene 'allow write: if isSelf(uid)' en Firestore Rules garantizado)
      try {
        await fb.setDoc(fb.doc(db, 'usuarios', user.uid, 'examenes', attemptDocId), snapshotData);
      } catch (eExam) {
        console.warn('No se pudo guardar en usuarios/.../examenes:', eExam);
      }

      // Intentar también en tandas_historial e intentos_tandas de forma no bloqueante
      try {
        await fb.addDoc(fb.collection(db, 'usuarios', user.uid, 'tandas_historial'), snapshotData);
      } catch (eHist) {
        console.warn('tandas_historial no disponible en cloud:', eHist?.message);
      }

      try {
        await fb.addDoc(fb.collection(db, 'intentos_tandas'), {
          uid: user.uid,
          email: user.email,
          tandaId: currentTanda,
          claseId: currentClaseId || null,
          modo: 'practica',
          fecha: nowIso,
          completados,
          total
        });
      } catch (eIntentos) {
        console.warn('intentos_tandas no disponible en cloud:', eIntentos?.message);
      }
    }

    // 2. Limpiar superado y respuesta_sql en Firestore para los ejercicios de esta tanda
    if (userDoc.rol === 'alumno') {
      for (const ex of currentEjercicios) {
        try {
          const exRef = fb.doc(db, 'usuarios', user.uid, 'ejercicios', String(ex.id));
          await fb.setDoc(exRef, { superado: false, respuesta_sql: '' }, { merge: true });
        } catch (eEx) {
          console.warn(`No se pudo resetear el ejercicio ${ex.id} en Firestore:`, eEx?.message);
        }
      }
    }

    // 3. Resetear memoria y estado local
    currentEjercicios.forEach(e => {
      e._superado = false;
      e._respuesta_sql = '';
    });

    if (sqlEditor) sqlEditor.value = '';
    await resetCurrentDatabase();
    await updateProgressUI();

    // Asegurar que la interfaz muestre el reinicio inmediatamente en memoria
    currentEjercicios.forEach(e => {
      e._superado = false;
      e._respuesta_sql = '';
      const btn = document.getElementById(`btn-ex-${e.id}`);
      if (btn) {
        btn.classList.remove('opacity-75');
        const icon = btn.querySelector('.fa-check-circle');
        if (icon) {
          icon.className = 'far fa-circle text-secondary me-2';
        }
      }
    });
    const counterEl = document.getElementById('tanda-counter');
    if (counterEl) counterEl.textContent = `0/${currentEjercicios.length}`;
    const barEl = document.getElementById('tanda-progress-bar');
    if (barEl) barEl.style.width = '0%';

    if (currentEjercicios.length > 0) {
      await loadExercise(currentEjercicios[0].id);
    }

    showToast('🔄', 'Tanda reiniciada. Se ha registrado tu progreso anterior en el historial.', 'success');
  } catch (err) {
    console.error('Error al reiniciar tanda:', err);
    alert('Error al reiniciar la tanda: ' + err.message);
  } finally {
    if (btnReiniciar) btnReiniciar.disabled = false;
  }
}

async function updateProgressUI() {
  const q = fb.query(fb.collection(db, 'usuarios', user.uid, 'ejercicios'));
  const snap = await fb.getDocs(q);
  const userExs = {};
  snap.forEach(d => userExs[d.id] = d.data());

  let completados = 0;
  exListEl.innerHTML = '';
  
  currentEjercicios.forEach((ex, idx) => {
    const estado = userExs[ex.id];
    ex._superado = estado?.superado || false;
    ex._respuesta_sql = estado?.respuesta_sql || '';
    if (ex._superado) completados++;
    
    // Agrupar por BD (útil si vienen varios en modo bloque)
    if (idx === 0 || currentEjercicios[idx-1].bd !== ex.bd) {
      const header = document.createElement('div');
      header.className = 'text-uppercase text-secondary small fw-bold px-3 py-2 mt-2 bg-black';
      header.textContent = `BD: ${ex.bd}`;
      exListEl.appendChild(header);
    }
    
    const btn = document.createElement('button');
    btn.className = `list-group-item list-group-item-action bg-transparent text-white border-bottom border-secondary p-3 ${ex._superado ? 'opacity-75' : ''}`;
    btn.id = `btn-ex-${ex.id}`;
    btn.onclick = () => loadExercise(ex.id);
    
    const displayTitle = currentModo === 'examen' ? `Ejercicio ${idx + 1}` : `#${ex.id} - ${ex.titulo}`;
    const subtitleHtml = currentModo === 'examen' ? '' : `<div class="text-muted" style="font-size:0.7rem">${ex.tema || ''}</div>`;
    const icon = ex._superado ? '<i class="fas fa-check-circle text-success me-2"></i>' : '<i class="far fa-circle text-secondary me-2"></i>';
    btn.innerHTML = `
      <div class="d-flex align-items-center">
        ${icon}
        <div>
          <div class="small fw-bold ${currentModo === 'examen' ? '' : 'mb-1'}">${displayTitle}</div>
          ${subtitleHtml}
        </div>
      </div>
    `;
    exListEl.appendChild(btn);
  });

  const total = currentEjercicios.length;
  document.getElementById('tanda-counter').textContent = `${completados}/${total}`;
  document.getElementById('tanda-progress-bar').style.width = `${(completados/total)*100}%`;
  
  const totalPts = userDoc.puntosTotal || 0;
  document.getElementById('puntos-actuales').textContent = totalPts;
  
  const rank = getUserRank(totalPts);
  const rankIcon = document.getElementById('user-rank-icon');
  const rankText = document.getElementById('user-rank-text');
  if(rankIcon && rankText) {
    rankIcon.textContent = rank.icon;
    rankText.textContent = rank.name;
    rankText.style.color = rank.color;
  }
  
  if (userDoc.gremio) {
    document.getElementById('user-gremio-icon').textContent = userDoc.gremioIcono || '🛡️';
    document.getElementById('user-gremio-text').textContent = userDoc.gremio;
  }
  
  renderLigasUI(totalPts);
  renderLogrosUI();
}

function getUserRank(points) {
  if (points >= 1500) return { name: 'Diamante', icon: '💎', color: '#0dcaf0', min: 1500, max: 99999 };
  if (points >= 1000) return { name: 'Platino', icon: '🌟', color: '#20c997', min: 1000, max: 1500 };
  if (points >= 600)  return { name: 'Oro', icon: '🥇', color: '#ffc107', min: 600, max: 1000 };
  if (points >= 300)  return { name: 'Plata', icon: '🥈', color: '#adb5bd', min: 300, max: 600 };
  if (points >= 100)  return { name: 'Bronce', icon: '🥉', color: '#fd7e14', min: 100, max: 300 };
  return { name: 'Hierro', icon: '⚪', color: '#6c757d', min: 0, max: 100 };
}

function renderLigasUI(puntos) {
  const container = document.getElementById('ligas-list');
  if (!container) return;
  
  const ligas = [
    { name: 'Diamante', icon: '💎', color: '#0dcaf0', pts: 1500 },
    { name: 'Platino', icon: '🌟', color: '#20c997', pts: 1000 },
    { name: 'Oro', icon: '🥇', color: '#ffc107', pts: 600 },
    { name: 'Plata', icon: '🥈', color: '#adb5bd', pts: 300 },
    { name: 'Bronce', icon: '🥉', color: '#fd7e14', pts: 100 },
    { name: 'Hierro', icon: '⚪', color: '#6c757d', pts: 0 }
  ];
  
  container.innerHTML = ligas.map((liga, i) => {
    const isCurrent = puntos >= liga.pts && (i === 0 || puntos < ligas[i-1].pts);
    const isUnlocked = puntos >= liga.pts;
    const nextPts = i > 0 ? ligas[i-1].pts : liga.pts;
    let progressHtml = '';
    
    if (isCurrent && i > 0) {
      const needed = nextPts - puntos;
      const pct = ((puntos - liga.pts) / (nextPts - liga.pts)) * 100;
      progressHtml = `
        <div class="mt-2">
          <div class="d-flex justify-content-between small text-muted mb-1" style="font-size:0.7rem">
            <span>Progreso hacia ${ligas[i-1].name}</span>
            <span>Te faltan ${needed} pts</span>
          </div>
          <div class="progress" style="height: 6px; background:#1e293b">
            <div class="progress-bar" style="width: ${pct}%; background-color: ${ligas[i-1].color}"></div>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="d-flex flex-column p-2 border rounded ${isCurrent ? 'border-info bg-dark' : 'border-secondary'} ${!isUnlocked ? 'opacity-50' : ''}" style="${isCurrent ? 'box-shadow: 0 0 10px rgba(13,202,240,0.2)' : ''}">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <span class="fs-5 me-2">${liga.icon}</span>
            <span class="fw-bold" style="color: ${isUnlocked ? liga.color : '#6c757d'}">${liga.name}</span>
            ${isCurrent ? '<span class="badge bg-info ms-2">Actual</span>' : ''}
          </div>
          <div class="small fw-bold text-secondary">${liga.pts} pts</div>
        </div>
        ${progressHtml}
      </div>
    `;
  }).join('');
}

function renderLogrosUI() {
  const container = document.getElementById('logros-list');
  if (!container) return;
  
  const userLogros = userDoc.logros || [];
  const catalogo = window.MEDALLAS_CATALOGO || [];
  
  const hasLogro = (id) => userLogros.some(l => l.id === id);
  
  // Filtramos: 
  // - Queremos mostrar todas las medallas públicas.
  // - De las medallas ocultas, SOLO mostramos las que el alumno ya haya desbloqueado.
  const aMostrar = catalogo.filter(m => m.public || hasLogro(m.id));
  
  if (aMostrar.length === 0) {
    container.innerHTML = '<div class="text-center text-muted">Aún no hay medallas disponibles.</div>';
    return;
  }
  
  container.innerHTML = aMostrar.map(m => {
    const unlocked = hasLogro(m.id);
    const dateStr = unlocked ? new Date(userLogros.find(l => l.id === m.id).ts).toLocaleDateString() : '';
    
    return `
      <div class="d-flex align-items-center p-3 border rounded ${unlocked ? 'border-warning bg-black' : 'border-secondary opacity-50'}">
        <div class="fs-1 me-3" style="${unlocked ? '' : 'filter: grayscale(1); opacity: 0.5;'}">${m.icon}</div>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-center">
            <h6 class="mb-1 fw-bold ${unlocked ? 'text-warning' : 'text-secondary'}">${m.name} ${m.public && !unlocked ? '<span class="badge bg-secondary ms-2" style="font-size:0.6rem">Pública</span>' : ''} ${!m.public && unlocked ? '<span class="badge bg-danger ms-2" style="font-size:0.6rem">Oculta</span>' : ''}</h6>
            ${unlocked ? `<span class="badge bg-dark text-muted" style="font-size:0.7rem">${dateStr}</span>` : ''}
          </div>
          <div class="small ${unlocked ? 'text-light' : 'text-muted'}">${m.desc}</div>
        </div>
      </div>
    `;
  }).join('');
}



window.showGolfLeaderboard = async function() {
  if (!currentExId) return;
  const tbody = document.getElementById('golf-tbody');
  tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-4"><i class="fas fa-spinner fa-spin"></i> Cargando podio...</td></tr>';
  new bootstrap.Modal(document.getElementById('golf-modal')).show();
  
  try {
    const claseIds = currentClase?.alumnosIds || [user.uid];
    
    // Optimizamos consultando el top global y filtrando en memoria por los alumnos de la clase.
    // Hacerlo directamente con 'in' requeriría índices compuestos complejos en Firebase.
    const q = fb.query(
      fb.collection(db, 'intentos'),
      fb.where('ejercicioId', '==', currentExId),
      fb.where('success', '==', true),
      fb.orderBy('queryLength', 'asc'),
      fb.limit(100) // Límite razonable para no saturar lecturas
    );
    const snap = await fb.getDocs(q);
    
    const usersSeen = new Set();
    const top3 = [];
    
    snap.forEach(d => {
      const data = d.data();
      if (!usersSeen.has(data.uid) && claseIds.includes(data.uid)) {
        usersSeen.add(data.uid);
        if (top3.length < 3) {
          top3.push(data);
        }
      }
    });
    
    if (top3.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-4">Ningún alumno de esta clase ha superado el ejercicio aún.</td></tr>';
      return;
    }
    
    tbody.innerHTML = top3.map((d, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      const name = d.email ? d.email.split('@')[0] : 'Alumno';
      return `
        <tr>
          <td>${medal}</td>
          <td class="fw-bold">${name}</td>
          <td><span class="badge bg-secondary">${d.queryLength} carácteres</span></td>
        </tr>
      `;
    }).join('');
    
  } catch(e) {
    console.error('Error fetching golf leaderboard:', e);
    tbody.innerHTML = '<tr><td colspan="3" class="text-danger py-4">Error al cargar el ranking.</td></tr>';
  }
}


async function loadExercise(id) {
  const ex = currentEjercicios.find(e => e.id === id);
  if (!ex) return;
  currentExId = id;

  // Activar btn list
  document.querySelectorAll('#ex-list button').forEach(b => b.classList.remove('active', 'bg-primary'));
  const activeBtn = document.getElementById(`btn-ex-${id}`);
  if (activeBtn) activeBtn.classList.add('active');

  // UI
  const idx = currentEjercicios.findIndex(e => e.id === id);
  exTitleEl.textContent = currentModo === 'examen' ? `Ejercicio ${idx + 1}` : ex.titulo;
  exBadgeEl.textContent = currentModo === 'examen' ? `Oculto` : `Ejercicio #${ex.id}`;
  exTextEl.innerHTML = ex.enunciado;
  let previousSql = '';
  if (currentModo === 'examen' && window.examAnswers && window.examAnswers[ex.id]) {
    previousSql = window.examAnswers[ex.id].query || window.examAnswers[ex.id].sql || '';
  } else if (currentModo === 'practica' && ex._respuesta_sql) {
    previousSql = ex._respuesta_sql;
  }
  sqlEditor.value = previousSql;
  resultsContainer.innerHTML = '<div class="text-center text-muted mt-4 small">Ejecuta tu consulta SQL.</div>';
  rowCountBadge.textContent = '0 filas';
  document.getElementById('feedback-panel').style.display = 'none';

  btnRun.disabled = true;
  document.getElementById('run-spinner').style.display = 'inline-block';

  // Restaurar la base de datos limpia para este ejercicio
  await loadDatabase(ex.bd);
  currentDatabaseName = ex.bd;
  
  btnRun.disabled = isExamSubmitted ? true : false;
  if (isExamSubmitted) sqlEditor.disabled = true;
  document.getElementById('run-spinner').style.display = 'none';
}

async function resetCurrentDatabase() {
  const ex = currentEjercicios.find(e => e.id === currentExId);
  const bd = ex?.bd || currentDatabaseName;
  if (!bd) return;
  await loadDatabase(bd);
  showToast('🔄', 'Base de datos reiniciada al estado inicial.', 'info');
}

async function loadDatabase(bdName, forceFetch = false) {
  try {
    if (!window.initSqlJs) throw new Error('sql.js no cargado');
    if (!SQL_ENGINE) {
      SQL_ENGINE = await window.initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
    }

    if (DB_CACHE[bdName] && !forceFetch) {
      sqlDb = new SQL_ENGINE.Database(DB_CACHE[bdName]);
      registerCustomFunctions(sqlDb);
      updateSchemaSidebar();
      return;
    }
    
    // Cargar desde los scripts .sql en la carpeta bds
    const path = `bds/${bdName}.sql`;
    
    const res = await fetch(`../${path}`);
    sqlDb = new SQL_ENGINE.Database(); // Siempre inicializar vacía
    registerCustomFunctions(sqlDb);
    
    if (!res.ok) {
      console.warn(`No se encontró el script ${path}, iniciando la BD totalmente vacía (ideal para DDL).`);
    } else {
      let sqlText = await res.text();
      
      // Adaptar sintaxis MySQL a SQLite
      sqlText = adaptSqlScriptForSqlite(sqlText);

      try {
        sqlDb.exec(sqlText); // Volcar el script SQL a la base de datos en memoria
      } catch (sqlErr) {
        console.error(`Error ejecutando el script ${path}:`, sqlErr);
      }
    }
    
    DB_CACHE[bdName] = sqlDb.export();
    updateSchemaSidebar();
  } catch (e) {
    showToast('❌', 'Error cargando BD: ' + e.message, 'error');
  }
}

let currentNomnomlSource = '';

function updateSchemaSidebar() {
  if (!sqlDb) return;
  const listEl = document.getElementById('schema-tables-list');
  if(!listEl) return;
  
  listEl.innerHTML = '';
  currentNomnomlSource = '#direction: right\n#spacing: 40\n#padding: 12\n#fill: #ffffff\n#stroke: #333333\n';

  const tablesRes = sqlDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  if (!tablesRes.length) {
    listEl.innerHTML = '<div class="text-center text-muted p-3">Base de datos vacía</div>';
    return;
  }

  const tables = tablesRes[0].values.map(row => row[0]);
  
  tables.forEach(tableName => {
    const colRes = sqlDb.exec(`PRAGMA table_info('${tableName}')`);
    if (!colRes.length) return;
    
    const tableDiv = document.createElement('div');
    tableDiv.className = 'mb-3';
    let html = `<div class="fw-bold text-info border-bottom border-secondary mb-1 pb-1"><i class="fas fa-table me-1"></i>${tableName}</div>`;
    
    currentNomnomlSource += `[${tableName}|\n`;
    
    const cols = colRes[0].values;
    cols.forEach((col, idx) => {
      const name = col[1];
      const type = col[2];
      const isPk = col[5] > 0;
      
      html += `<div class="d-flex justify-content-between text-light px-1">
                 <span>${isPk ? '<i class="fas fa-key text-warning me-1" style="font-size:0.7rem"></i>' : '<span style="width:14px;display:inline-block"></span>'} ${name}</span>
                 <span class="text-secondary" style="font-size:0.75rem">${type.toLowerCase()}</span>
               </div>`;
      
      currentNomnomlSource += `  ${isPk ? '*' : ''}${name}: ${type}${idx < cols.length - 1 ? ';\n' : ''}`;
    });
    
    currentNomnomlSource += ']\n';
    tableDiv.innerHTML = html;
    listEl.appendChild(tableDiv);
    
    const fkRes = sqlDb.exec(`PRAGMA foreign_key_list('${tableName}')`);
    if (fkRes.length) {
      fkRes[0].values.forEach(fk => {
        const targetTable = fk[2];
        currentNomnomlSource += `[${tableName}] -:> [${targetTable}]\n`;
      });
    }
  });
}

function showSchema() {
  if (!currentNomnomlSource) return;
  const canvas = document.getElementById('schema-canvas');
  try {
    nomnoml.draw(canvas, currentNomnomlSource);
  } catch(e) {
    console.error("Nomnoml error", e);
  }
  new bootstrap.Modal(document.getElementById('schema-modal')).show();
}

async function runQuery() {
  if (isExamSubmitted) {
    showToast('🔒', 'El examen ya ha sido entregado.', 'warning');
    return;
  }
  if (!sqlDb || !currentExId) return;
  const query = sqlEditor.value.trim();
  if (!query) return;

  const ex = currentEjercicios.find(e => e.id === currentExId);
  // isDDL: CREATE/ALTER/DROP/RENAME/TRUNCATE  → estructura de tabla
  // isDML: INSERT/UPDATE/DELETE               → aceptar si no hay error SQL
  const isDDL = /^\s*(CREATE|ALTER|DROP|RENAME|TRUNCATE)/i.test(query);
  const isDML = !isDDL && /^\s*(INSERT|UPDATE|DELETE)/i.test(query);

  btnRun.disabled = true;
  try {
    // 1. Ejecutar query del alumno
    let resAlumno = [];
    const adaptedQuery = adaptSqlForSqlite(query);
    if (isDDL || isDML) {
      try {
        sqlDb.exec(adaptedQuery);
        resAlumno = [{ columns: ['Resultado'], values: [['Comando ejecutado correctamente']] }];
      } catch (err) {
        if (/^\s*ALTER\s+TABLE\s+\w+\s+(MODIFY|CHANGE|ALTER\s+COLUMN|RENAME\s+COLUMN|ADD\s+(CONSTRAINT|CHECK|FOREIGN\s+KEY|PRIMARY\s+KEY|UNIQUE)|DROP\s+(PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|INDEX)|ADD\s+.*,)/i.test(query) || (err.message && err.message.includes('in foreign key definition'))) {
          resAlumno = [{ columns: ['Resultado', 'Aviso'], values: [['Comando aceptado', 'El comando es válido en MariaDB/MySQL, pero no se modificará la tabla por limitación del motor de SQLite en el navegador.']] }];
          showToast('⚠️', 'Comando correcto. No se modifica la BD por limitación del motor.', 'warning');
        } else {
          window._lastSqlError = true;
          throw err;
        }
      }
    } else {
      try {
        resAlumno = sqlDb.exec(adaptedQuery);
      } catch (err) {
        window._lastSqlError = true;
        throw err;
      }
    }
    
    renderResults(resAlumno);

    // Para SELECT/DML: dbCopy con el estado tras la query del alumno para ejecutar la solución
    // Para DDL: compareDDL crea su propia BD limpia internamente
    const dbCopy = new sqlDb.constructor(sqlDb.export());
    registerCustomFunctions(dbCopy);
    let resSolucion = [];
    if (!isDDL) {
      try {
        const adaptedSolucion = adaptSqlForSqlite(ex.query_solucion);
        resSolucion = dbCopy.exec(adaptedSolucion);
      } catch(e) { console.error('Error en solución oficial:', e); }
    }

    const isCorrect = compareResults(resAlumno, resSolucion, isDML, isDDL, sqlDb, ex.query_solucion, query);
    
    if (currentModo === 'practica') {
      if (isCorrect) {
        showFeedback(true, '¡Consulta Correcta!', 'Buen trabajo.');
        if (!ex._superado && userDoc.rol === 'alumno') {
          await registerAttempt(true);
          showConfetti();
        }
      } else {
        showFeedback(false, 'Consulta Incorrecta', 'Revisa tu sintaxis y los datos devueltos.');
        if (userDoc.rol === 'alumno') await registerAttempt(false);
      }
    } else if (currentModo === 'examen') {
      if (!window.examAnswers) window.examAnswers = {};
      window.examAnswers[ex.id] = { query, isCorrect, puntos: isCorrect ? (ex.puntos || 10) : 0 };
      showToast('💾', 'Respuesta guardada temporalmente', 'success');
      const btnLista = document.getElementById(`btn-ex-${ex.id}`);
      if(btnLista) btnLista.classList.add('border-primary', 'border-2');
    }
    
  } catch (e) {
    renderError(e.message);
    if (currentModo === 'practica') {
      showFeedback(false, 'Error SQL', e.message);
      if (userDoc.rol === 'alumno') await registerAttempt(false);
    } else {
      if (!window.examAnswers) window.examAnswers = {};
      window.examAnswers[currentExId] = { query, isCorrect: false, puntos: 0 };
      showToast('💾', 'Respuesta guardada con error sintáctico', 'warning');
      const btnLista = document.getElementById(`btn-ex-${currentExId}`);
      if(btnLista) btnLista.classList.add('border-warning', 'border-2');
    }
  } finally {
    if (isDDL || isDML) updateSchemaSidebar();
    btnRun.disabled = false;
  }
}

function renderResults(res) {
  if (!res || res.length === 0) {
    resultsContainer.innerHTML = '<div class="text-center text-muted mt-4">La consulta no devolvió resultados.</div>';
    rowCountBadge.textContent = '0 filas';
    return;
  }
  const { columns, values } = res[0];
  rowCountBadge.textContent = `${values.length} fila${values.length!==1?'s':''}`;
  
  let html = '<table class="table table-dark table-sm table-bordered text-center align-middle" style="font-size:0.85rem"><thead><tr>';
  columns.forEach(c => html += `<th class="text-info">${c}</th>`);
  html += '</tr></thead><tbody>';
  values.forEach(row => {
    html += '<tr>';
    row.forEach(val => html += `<td>${val === null ? '<span class="text-muted">NULL</span>' : val}</td>`);
    html += '</tr>';
  });
  html += '</tbody></table>';
  resultsContainer.innerHTML = html;
}

function renderError(msg) {
  resultsContainer.innerHTML = `<div class="alert alert-danger mx-2 mt-2" style="font-family:monospace; font-size:0.85rem">${msg}</div>`;
  rowCountBadge.textContent = 'Error';
}

function showFeedback(isSuccess, title, msg) {
  const p = document.getElementById('feedback-panel');
  p.style.display = 'block';
  p.className = `alert mt-3 mb-0 border ${isSuccess ? 'bg-success border-success text-white' : 'bg-danger border-danger text-white'}`;
  p.style.setProperty('--bs-bg-opacity', '0.2');
  
  document.getElementById('feedback-icon').innerHTML = isSuccess ? '<i class="fas fa-check-circle text-success"></i>' : '<i class="fas fa-times-circle text-danger"></i>';
  document.getElementById('feedback-title').textContent = title;
  document.getElementById('feedback-title').className = `d-block ${isSuccess ? 'text-success' : 'text-danger'}`;
  document.getElementById('feedback-message').textContent = msg;
}

window._consecutiveSuccess = window._consecutiveSuccess || 0;
window._consecutiveFails = window._consecutiveFails || 0;
window._lastExId = window._lastExId || null;

async function registerAttempt(isSuccess) {
  try {
    const pts = isSuccess ? 10 : 0; // simplificado
    const ts = fb.serverTimestamp();
    const queryTxt = sqlEditor.value.trim();
    const ex = currentEjercicios.find(e => e.id === currentExId);
    
    // Seguimiento para rachas
    if (window._lastExId !== currentExId) {
      window._consecutiveFails = 0;
      window._lastExId = currentExId;
    }

    if (isSuccess) {
      window._consecutiveSuccess++;
      window._consecutiveFails = 0;
    } else {
      window._consecutiveSuccess = 0;
      window._consecutiveFails++;
    }
    
    // Lógica medallas delegada a script externo
    window._lastSqlError = false; // asumiendo sin errores
    const resultLogros = evaluarLogros(isSuccess, queryTxt, ex, userDoc, window);
    let nuevosLogros = resultLogros.nuevosLogros;
    let userLogros = resultLogros.userLogros;

    // Registrar intento
    await fb.addDoc(fb.collection(db, 'intentos'), {
      ejercicioId: currentExId, uid: user.uid, email: user.email,
      success: isSuccess, query: queryTxt, queryLength: queryTxt.length,
      puntosGanados: pts, timestamp: ts
    });

    if (nuevosLogros.length > 0) {
      userDoc.logros = userLogros;
      await fb.updateDoc(fb.doc(db, 'usuarios', user.uid), { logros: userLogros });
      if(typeof renderLogrosUI === 'function') renderLogrosUI();
      
      // Mostrar modal súper chulo para la primera medalla ganada en este intento
      const med = nuevosLogros[0]; 
      document.getElementById('medalla-ganada-icon').textContent = med.icon;
      document.getElementById('medalla-ganada-name').textContent = med.name;
      document.getElementById('medalla-ganada-desc').textContent = med.desc;
      new bootstrap.Modal(document.getElementById('modal-medalla-ganada')).show();
      
      // Si hay más de una, las otras salen por toast normal para no saturar modals
      for (let i = 1; i < nuevosLogros.length; i++) {
        showToast(nuevosLogros[i].icon, `¡Logro Desbloqueado! ${nuevosLogros[i].name}`, 'success');
      }
    }

    if (isSuccess) {
      // Actualizar estado usuario
      const exRef = fb.doc(db, 'usuarios', user.uid, 'ejercicios', String(currentExId));
      await fb.setDoc(exRef, { superado: true, puntosObtenidos: pts, fecha: ts, respuesta_sql: sqlEditor.value.trim() }, { merge:true });
      
      const incrPts = (userDoc.puntosTotal || 0) + pts;
      const incrExs = (userDoc.ejerciciosOK || 0) + 1;
      await fb.updateDoc(fb.doc(db, 'usuarios', user.uid), { puntosTotal: incrPts, ejerciciosOK: incrExs });
      
      userDoc.puntosTotal = incrPts; userDoc.ejerciciosOK = incrExs;
      await updateProgressUI(); // refrescar ui
    }
  } catch(e) { console.error('Error registrando intento:', e); }
}

function showConfetti() {
  const overlay = document.getElementById('success-overlay');
  overlay.style.setProperty('display', 'flex', 'important');
  confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  
  const btnNext = document.getElementById('btn-next-overlay');
  btnNext.onclick = () => {
    overlay.style.setProperty('display', 'none', 'important');
    const idx = currentEjercicios.findIndex(e => e.id === currentExId);
    if (idx < currentEjercicios.length - 1) loadExercise(currentEjercicios[idx+1].id);
  };
}

function setupExamAntiCheat(claseId, tandaIdentifier) {
  if (antiCheatInitialized) return;
  antiCheatInitialized = true;

  if (currentModo !== 'examen' || userDoc?.rol !== 'alumno' || isExamSubmitted) return;

  const storageKey = `cheat_warn_${user.uid}_${claseId || 'clase'}_${tandaIdentifier || currentTanda}`;
  let warnings = parseInt(sessionStorage.getItem(storageKey) || '0', 10);

  if (warnings >= 2) {
    submitExam(true, 'Examen cerrado por cambio de ventana reiterado (2 avisos acumulados).');
    return;
  }

  let lastViolationTs = 0;

  const handleViolation = () => {
    if (isExamSubmitted || isWarningModalOpen || isConfirmingSubmit) return;
    if (currentModo !== 'examen' || userDoc?.rol !== 'alumno') return;

    const now = Date.now();
    if (now - lastViolationTs < 2500) return; // Debounce 2.5s para no contar blur y visibilitychange juntos
    lastViolationTs = now;

    warnings = parseInt(sessionStorage.getItem(storageKey) || '0', 10) + 1;
    sessionStorage.setItem(storageKey, warnings.toString());

    if (warnings === 1) {
      isWarningModalOpen = true;
      const modalEl = document.getElementById('modal-anti-cheat-warning');
      if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modalEl.addEventListener('hidden.bs.modal', () => {
          setTimeout(() => { isWarningModalOpen = false; }, 1000);
        }, { once: true });
        modal.show();
      } else {
        alert('⚠️ PRIMER AVISO: Está prohibido cambiar de ventana o pestaña durante el examen. Si sales de la pantalla una segunda vez, tu examen se cerrará y se entregará automáticamente.');
        setTimeout(() => { isWarningModalOpen = false; }, 1000);
      }
    } else if (warnings >= 2) {
      const modalEl = document.getElementById('modal-anti-cheat-warning');
      if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      submitExam(true, 'Examen cerrado y entregado automáticamente por cambio de ventana (2 avisos).');
    }
  };

  setTimeout(() => {
    window.addEventListener('blur', handleViolation);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleViolation();
      }
    });
  }, 1500);
}

async function submitExam(forced = false, forcedReason = '') {
  if (isExamSubmitted) return;
  forced = (forced === true);

  if (!forced) {
    isConfirmingSubmit = true;
    let respondidas = 0;
    currentEjercicios.forEach(ex => {
      if (window.examAnswers && window.examAnswers[ex.id]) respondidas++;
    });
    if (respondidas < currentEjercicios.length) {
      const conf = confirm(`Faltan ${currentEjercicios.length - respondidas} preguntas por responder. ¿Seguro que quieres entregar?`);
      setTimeout(() => { isConfirmingSubmit = false; }, 600);
      if (!conf) return;
    } else {
      const conf = confirm('¿Seguro que quieres entregar el examen? No podrás cambiar las respuestas.');
      setTimeout(() => { isConfirmingSubmit = false; }, 600);
      if (!conf) return;
    }
  }

  isExamSubmitted = true;
  if (!window.examAnswers) window.examAnswers = {};

  // Si había algo escrito en el editor para el ejercicio actual y no se había guardado, guardarlo
  if (currentExId && sqlEditor && sqlEditor.value.trim() && !window.examAnswers[currentExId]) {
    window.examAnswers[currentExId] = { query: sqlEditor.value.trim(), isCorrect: false, puntos: 0 };
  }

  let totalPuntosPosibles = 0;
  let puntosConseguidos = 0;
  
  currentEjercicios.forEach(ex => {
    totalPuntosPosibles += (ex.puntos || 10);
    const ans = window.examAnswers[ex.id];
    if (ans) {
      if (ans.isCorrect) puntosConseguidos += ans.puntos;
    }
  });

  const btnSubmit = document.getElementById('btn-submit-tanda');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entregando...';
  }

  if (sqlEditor) sqlEditor.disabled = true;
  if (btnRun) btnRun.disabled = true;

  const claseIdParam = new URLSearchParams(window.location.search).get('claseId');

  // Guardar en firestore si es alumno
  if (userDoc.rol === 'alumno') {
    try {
      const examData = {
        claseId: claseIdParam,
        tandaId: currentTanda,
        fecha: new Date().toISOString(),
        respuestas: window.examAnswers,
        puntuacion: puntosConseguidos,
        puntosMaximos: totalPuntosPosibles,
        ...(forced ? { cerradoAutomatico: true, motivoCierre: forcedReason } : {})
      };
      await fb.setDoc(fb.doc(db, 'usuarios', user.uid, 'examenes', `examen_${Date.now()}`), examData);
      
      // Actualizar puntos totales
      await fb.updateDoc(fb.doc(db, 'usuarios', user.uid), {
        puntosTotal: (userDoc.puntosTotal || 0) + puntosConseguidos
      });
    } catch(e) {
      console.error(e);
      if (!forced) alert('Error guardando el examen: ' + e.message);
    }
  }

  // Mostrar nota final
  const nota = totalPuntosPosibles > 0 ? (puntosConseguidos / totalPuntosPosibles) * 10 : 0;
  const overlay = document.getElementById('success-overlay');
  
  if (forced) {
    overlay.innerHTML = `
        <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 5rem; text-shadow: 0 4px 15px rgba(239, 68, 68, 0.5)"></i>
        <h2 class="text-white fw-bold">Examen Finalizado</h2>
        <div class="alert alert-danger mx-auto my-3 text-start px-4 py-3" style="max-width: 520px; background: rgba(220, 38, 38, 0.25); border-color: #ef4444;">
          <h6 class="fw-bold text-danger mb-2"><i class="fas fa-shield-alt me-2"></i>Examen cerrado por cambio de ventana (2 avisos)</h6>
          <p class="mb-0 small text-light">Has salido de la pantalla del examen en dos ocasiones. Se ha cerrado el examen y se han entregado automáticamente tus respuestas registradas hasta este momento.</p>
        </div>
        <p class="text-white-50 fs-4 mb-2">Nota: <strong class="text-white">${nota.toFixed(1)} / 10</strong></p>
        <p class="text-white-50 mb-4">${puntosConseguidos} de ${totalPuntosPosibles} puntos</p>
        <button class="btn btn-danger btn-lg fw-bold px-5 rounded-pill shadow" onclick="window.close(); window.location.href='tandas.html?claseId=${claseIdParam}'">
          Volver a la clase <i class="fas fa-arrow-right ms-2"></i>
        </button>
    `;
    overlay.style.background = 'rgba(15, 23, 42, 0.98)';
  } else {
    overlay.innerHTML = `
        <i class="fas fa-clipboard-check text-white mb-3" style="font-size: 5rem; text-shadow: 0 4px 15px rgba(0,0,0,0.2)"></i>
        <h2 class="text-white fw-bold">Examen Entregado</h2>
        <p class="text-white-50 fs-4 mb-2">Nota: ${nota.toFixed(1)} / 10</p>
        <p class="text-white-50 mb-4">${puntosConseguidos} de ${totalPuntosPosibles} puntos</p>
        <button class="btn btn-light btn-lg fw-bold px-5 rounded-pill shadow" onclick="window.close(); window.location.href='tandas.html?claseId=${claseIdParam}'">
          Volver a la clase <i class="fas fa-arrow-right ms-2"></i>
        </button>
    `;
    overlay.style.background = 'rgba(15, 23, 42, 0.95)';
  }
  overlay.style.setProperty('display', 'flex', 'important');
}
async function loadGremioLeaderboard() {
  const container = document.getElementById('gremio-bars');
  container.innerHTML = '<div class="text-center text-muted"><i class="fas fa-spinner fa-spin"></i> Calculando puntos globales...</div>';
  
  try {
    const claseIds = currentClase?.alumnosIds || [user.uid];
    const allUsers = [];
    
    // Batch queries of 10 for users in the class
    for (let i = 0; i < claseIds.length; i += 10) {
      const chunk = claseIds.slice(i, i + 10);
      const snap = await fb.getDocs(fb.query(fb.collection(db, 'usuarios'), fb.where('__name__', 'in', chunk)));
      snap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
    }
    
    const scores = {
      'La Orden del JOIN': { icon: '🛡️', pts: 0, color: 'bg-primary', mvp: null },
      'El Cártel del SELECT': { icon: '🗡️', pts: 0, color: 'bg-success', mvp: null },
      'La Hermandad del DROP': { icon: '🧙‍♂️', pts: 0, color: 'bg-danger', mvp: null },
      'Los Ninjas del WHERE': { icon: '🦂', pts: 0, color: 'bg-warning', mvp: null }
    };
    
    let totalGlobalPts = 0;
    
    allUsers.forEach(u => {
      if (u.gremio && scores[u.gremio]) {
        const uPts = u.puntosTotal || 0;
        scores[u.gremio].pts += uPts;
        totalGlobalPts += uPts;
        
        if (!scores[u.gremio].mvp || uPts > scores[u.gremio].mvp.pts) {
          scores[u.gremio].mvp = { name: u.displayName || u.email || 'Anónimo', pts: uPts };
        }
      }
    });
    
    const sorted = Object.entries(scores).sort((a,b) => b[1].pts - a[1].pts);
    
    if (totalGlobalPts === 0) totalGlobalPts = 1; 
    
    container.innerHTML = sorted.map(([name, data], idx) => {
      let gapHtml = '';
      if (idx > 0) {
        const prevData = sorted[idx - 1][1];
        const ptsNeeded = prevData.pts - data.pts + 1; // +1 to surpass
        gapHtml = `<div class="text-danger small mt-1" style="font-size: 0.8rem;"><i class="fas fa-arrow-up"></i> ${ptsNeeded} pts para superar a ${sorted[idx - 1][0]}</div>`;
      }
      
      let mvpHtml = '';
      if (data.mvp) {
        mvpHtml = `<div class="text-muted small mt-1" style="font-size: 0.8rem;"><i class="fas fa-star text-warning"></i> MVP: <strong class="text-light">${data.mvp.name}</strong> (${data.mvp.pts} pts)</div>`;
      }

      return `
      <div class="mb-4 p-3 rounded shadow-sm" style="background: rgba(255,255,255,0.05); border-left: 4px solid var(--bs-${data.color.replace('bg-', '')}); transition: transform 0.2s ease-in-out;">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="fs-5 fw-bold">${idx === 0 && data.pts > 0 ? '👑 ' : ''}${data.icon} <span class="text-light">${name}</span></span>
          <span class="fs-5 fw-bold text-info">${data.pts} <span class="text-secondary fs-6">pts</span></span>
        </div>
        <div class="progress mb-2" style="height: 12px; background: #1e293b; border-radius: 6px;">
          <div class="progress-bar ${data.color} progress-bar-striped ${idx === 0 ? 'progress-bar-animated' : ''}" style="width: ${(data.pts / totalGlobalPts) * 100}%; border-radius: 6px;"></div>
        </div>
        <div class="d-flex justify-content-between">
          ${mvpHtml}
          ${gapHtml}
        </div>
      </div>
      `;
    }).join('');
  } catch(e) { console.error('Error leaderboard gremios:', e); }
}
window.showGremioModal = async function() {
  const modal = new bootstrap.Modal(document.getElementById('gremio-modal'));
  modal.show();
  
  if (!userDoc.gremio) {
    document.getElementById('gremio-selector').style.display = 'block';
    document.getElementById('gremio-leaderboard').style.display = 'none';
    
    const selectorDiv = document.getElementById('gremio-selector');
    const container = document.getElementById('gremio-cards-container');
    if(container) container.innerHTML = '<div class="col-12 text-center py-4"><i class="fas fa-spinner fa-spin fa-2x text-primary"></i><p class="text-muted mt-2">Cargando facciones...</p></div>';

    try {
      const claseIds = currentClase?.alumnosIds || [user.uid];
      const maxPerGuild = Math.ceil(claseIds.length / 4);
      
      const allUsers = [];
      for (let i = 0; i < claseIds.length; i += 10) {
        const chunk = claseIds.slice(i, i + 10);
        const uSnap = await fb.getDocs(fb.query(fb.collection(db, 'usuarios'), fb.where('__name__', 'in', chunk)));
        uSnap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
      }
      
      const guildMembers = {
        'La Orden del JOIN': { icon: '🛡️', color: 'primary', members: [] },
        'El Cártel del SELECT': { icon: '🗡️', color: 'success', members: [] },
        'La Hermandad del DROP': { icon: '🧙‍♂️', color: 'danger', members: [] },
        'Los Ninjas del WHERE': { icon: '🦂', color: 'warning', members: [] }
      };

      allUsers.forEach(u => {
        if (claseIds.includes(u.id) && u.gremio && guildMembers[u.gremio]) {
          guildMembers[u.gremio].members.push(u.displayName || u.nombre || u.email || 'Anónimo');
        }
      });

      const container = document.getElementById('gremio-cards-container');
      container.innerHTML = Object.entries(guildMembers).map(([name, data]) => {
        const count = data.members.length;
        const isFull = count >= maxPerGuild;
        
        const memberList = data.members.length > 0 
          ? data.members.map(m => `<li><i class="fas fa-user text-secondary me-2" style="font-size:0.7rem;"></i>${m}</li>`).join('') 
          : `<li class="text-muted fst-italic">Sin miembros aún</li>`;

        return `
        <div class="col-md-6">
          <div class="card bg-dark shadow-sm border-${data.color} h-100" style="border-color: var(--bs-${data.color}) !important; background: rgba(255,255,255,0.02) !important;">
            <div class="card-body d-flex flex-column">
              <h6 class="card-title fw-bold text-${data.color} mb-3 border-bottom border-secondary pb-2">
                ${data.icon} ${name}
                <span class="badge bg-secondary float-end">${count}/${maxPerGuild}</span>
              </h6>
              <ul class="small mb-3 text-light list-unstyled flex-grow-1" style="min-height: 50px;">
                ${memberList}
              </ul>
              <button class="btn btn-outline-${data.color} w-100 fw-bold" 
                onclick="joinGremio('${name}', '${data.icon}')" 
                ${isFull ? 'disabled' : ''}>
                ${isFull ? 'FACCION LLENA' : 'UNIRSE A ESTA FACCIÓN'}
              </button>
            </div>
          </div>
        </div>
        `;
      }).join('');
      
    } catch(e) {
      console.error('Error calculando límites de gremio:', e);
      document.getElementById('gremio-cards-container').innerHTML = '<div class="text-danger">Error al cargar las facciones.</div>';
    }
  } else {
    document.getElementById('gremio-selector').style.display = 'none';
    document.getElementById('gremio-leaderboard').style.display = 'block';
    await loadGremioLeaderboard();
  }
}
window.joinGremio = async function(nombre, icono) {
  try {
    await fb.updateDoc(fb.doc(db, 'usuarios', user.uid), { gremio: nombre, gremioIcono: icono });
    userDoc.gremio = nombre;
    userDoc.gremioIcono = icono;
    document.getElementById('user-gremio-icon').textContent = icono;
    document.getElementById('user-gremio-text').textContent = nombre;
    showToast(icono, `¡Te has unido a ${nombre}!`, 'success');
    
    document.getElementById('gremio-selector').style.display = 'none';
    document.getElementById('gremio-leaderboard').style.display = 'block';
    await loadGremioLeaderboard();
  } catch(e) { console.error('Error al unirse al gremio:', e); }
}
