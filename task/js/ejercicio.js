import { initTaskPage, showToast } from './auth.js';

let user, userDoc, db, fb;
let currentClase = null;
let currentTanda = null;
let currentModo = 'practica'; // o 'examen'
let currentEjercicios = [];
let currentDatabaseName = '';
let currentExId = null;

let sqlDb = null;
let sqlWorker = null;

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
  const tandaId = params.get('tandaId');
  const bloqueId = params.get('bloqueId'); // Si viene por bloque (nuevo sistema)
  const testExId = params.get('testExId');
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
    document.getElementById('btn-hint').style.display = 'none';
  }

  // Cargar Ejercicios
  if (bloqueId) {
    // Nuevo sistema: por bloque entero
    const bloque = window.BLOQUES?.find(b => b.id == parseInt(bloqueId));
    if(!bloque) { alert('Bloque no encontrado'); return; }
    currentTanda = bloque.nombre;
    titleBadge.textContent = bloque.nombre;
    currentEjercicios = window.EJERCICIOS.filter(e => e.grupo === bloque.nombre);
  } else if (tandaId) {
    // Sistema legacy: por bd (ej: "1:nba")
    const [bId, bd] = tandaId.split(':');
    const bloque = window.BLOQUES?.find(b => b.id == parseInt(bId));
    currentTanda = `Bloque ${bId} - ${bd.toUpperCase()}`;
    titleBadge.textContent = currentTanda;
    currentEjercicios = window.EJERCICIOS.filter(e => e.grupo === bloque?.nombre && (e.bd === bd || e.tanda === bd));
  }

  if (currentEjercicios.length === 0) {
    exListEl.innerHTML = '<div class="p-3 text-warning">No hay ejercicios para esta selección.</div>';
    return;
  }

  // Comprobar estado del usuario en estos ejercicios (si ya superó alguno)
  await updateProgressUI();
  
  // Seleccionar el primero o el primer no superado
  let firstPending = currentEjercicios.find(e => !e._superado);
  loadExercise(firstPending ? firstPending.id : currentEjercicios[0].id);

  btnRun.onclick = runQuery;
  document.getElementById('btn-show-schema').onclick = showSchema;
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
    
    const icon = ex._superado ? '<i class="fas fa-check-circle text-success me-2"></i>' : '<i class="far fa-circle text-secondary me-2"></i>';
    btn.innerHTML = `
      <div class="d-flex align-items-start">
        ${icon}
        <div>
          <div class="small fw-bold mb-1">#${ex.id} - ${ex.titulo}</div>
          <div class="text-muted" style="font-size:0.7rem">${ex.tema || ''}</div>
        </div>
      </div>
    `;
    exListEl.appendChild(btn);
  });

  const total = currentEjercicios.length;
  document.getElementById('tanda-counter').textContent = `${completados}/${total}`;
  document.getElementById('tanda-progress-bar').style.width = `${(completados/total)*100}%`;
  document.getElementById('puntos-actuales').textContent = userDoc.puntosTotal || 0;
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
  exTitleEl.textContent = ex.titulo;
  exBadgeEl.textContent = `Ejercicio #${ex.id}`;
  exTextEl.innerHTML = ex.enunciado;
  sqlEditor.value = '';
  resultsContainer.innerHTML = '<div class="text-center text-muted mt-4 small">Ejecuta tu consulta SQL.</div>';
  rowCountBadge.textContent = '0 filas';
  document.getElementById('feedback-panel').style.display = 'none';

  btnRun.disabled = true;
  document.getElementById('run-spinner').style.display = 'inline-block';

  // Si cambia la BD, cargar el motor sqlite
  if (currentDatabaseName !== ex.bd) {
    await loadDatabase(ex.bd);
    currentDatabaseName = ex.bd;
  }
  
  btnRun.disabled = false;
  document.getElementById('run-spinner').style.display = 'none';
}

async function loadDatabase(bdName) {
  try {
    if (!window.initSqlJs) throw new Error('sql.js no cargado');
    const SQL = await window.initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
    
    const bdMap = {
      'arepazo': 'bd/arepazo.sqlite',
      'nba': 'bd/nba.sqlite',
      'alquiler': 'bd/alquiler.sqlite',
      'pokemon': 'bd/pokemon.sqlite'
    };
    
    const path = bdMap[bdName];
    if (!path) throw new Error('Ruta DB desconocida: ' + bdName);
    
    const res = await fetch(`../${path}`);
    const buf = await res.arrayBuffer();
    sqlDb = new SQL.Database(new Uint8Array(buf));
  } catch (e) {
    showToast('❌', 'Error cargando BD: ' + e.message, 'error');
  }
}

function showSchema() {
  if (!currentDatabaseName) return;
  document.getElementById('schema-img').src = `../img/schema_${currentDatabaseName}.png`;
  new bootstrap.Modal(document.getElementById('schema-modal')).show();
}

async function runQuery() {
  if (!sqlDb || !currentExId) return;
  const query = sqlEditor.value.trim();
  if (!query) return;

  const ex = currentEjercicios.find(e => e.id === currentExId);
  const isDML = /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(query);

  btnRun.disabled = true;
  try {
    // 1. Ejecutar query del alumno
    let resAlumno = [];
    if (isDML) {
      sqlDb.run(query);
      resAlumno = [{ columns: ['Resultado'], values: [['Comando ejecutado correctamente']] }];
    } else {
      resAlumno = sqlDb.exec(query);
    }
    
    renderResults(resAlumno);

    // 2. Validar (solo en modo práctica por ahora, en examen se hace al final)
    if (currentModo === 'practica') {
      const dbCopy = new sqlDb.constructor(sqlDb.export()); // Clonar DB para probar solución ideal
      let resSolucion = [];
      try {
        resSolucion = dbCopy.exec(ex.query_solucion);
      } catch(e) { console.error('Error en solución oficial:', e); }

      const isCorrect = compareResults(resAlumno, resSolucion, isDML, dbCopy);
      
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
    }
    
  } catch (e) {
    renderError(e.message);
    showFeedback(false, 'Error SQL', e.message);
    if (userDoc.rol === 'alumno') await registerAttempt(false);
  } finally {
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

// Comparación estricta de DataFrames (solo SELECT por ahora)
function compareResults(resA, resS, isDML, dbCopy) {
  if (isDML) return true; // TODO: Lógica DML (comparar tablas post-ejecución)
  if (!resA.length && !resS.length) return true;
  if (!resA.length || !resS.length) return false;
  
  const vA = resA[0].values, vS = resS[0].values;
  if (vA.length !== vS.length) return false;
  if (vA[0].length !== vS[0].length) return false;

  for (let i = 0; i < vS.length; i++) {
    for (let j = 0; j < vS[i].length; j++) {
      if (String(vA[i][j]) !== String(vS[i][j])) return false;
    }
  }
  return true;
}

async function registerAttempt(isSuccess) {
  try {
    const pts = isSuccess ? 10 : 0; // simplificado
    const ts = fb.serverTimestamp();
    
    // Registrar intento
    await fb.addDoc(fb.collection(db, 'intentos'), {
      ejercicioId: currentExId, uid: user.uid, email: user.email,
      success: isSuccess, query: sqlEditor.value.trim(),
      puntosGanados: pts, timestamp: ts
    });

    if (isSuccess) {
      // Actualizar estado usuario
      const exRef = fb.doc(db, 'usuarios', user.uid, 'ejercicios', String(currentExId));
      await fb.setDoc(exRef, { superado: true, puntosObtenidos: pts, fecha: ts }, { merge:true });
      
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
