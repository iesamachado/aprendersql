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
    const nomnomlBtnTest = document.getElementById('btn-show-nomnoml');
    if (nomnomlBtnTest) nomnomlBtnTest.onclick = showSchema;
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
    document.getElementById('btn-submit-tanda').onclick = submitExam;
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
        // Ya lo entregó
        const lastExam = snapEx.docs.sort((a,b) => b.data().fecha.localeCompare(a.data().fecha))[0].data();
        window.examAnswers = lastExam.respuestas || {};
        const btnSubmit = document.getElementById('btn-submit-tanda');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-lock"></i> Examen Entregado';
        btnSubmit.classList.replace('btn-success', 'btn-secondary');
        showToast('ℹ️', 'Estás revisando un examen ya entregado.', 'info');
      }
    } catch(e) { console.error('Error cargando examen previo:', e); }
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
    const icon = ex._superado ? '<i class="fas fa-check-circle text-success me-2"></i>' : '<i class="far fa-circle text-secondary me-2"></i>';
    btn.innerHTML = `
      <div class="d-flex align-items-start">
        ${icon}
        <div>
          <div class="small fw-bold mb-1">${displayTitle}</div>
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
  const idx = currentEjercicios.findIndex(e => e.id === id);
  exTitleEl.textContent = currentModo === 'examen' ? `Ejercicio ${idx + 1}` : ex.titulo;
  exBadgeEl.textContent = currentModo === 'examen' ? `Oculto` : `Ejercicio #${ex.id}`;
  exTextEl.innerHTML = ex.enunciado;
  let previousSql = '';
  if (currentModo === 'examen' && window.examAnswers && window.examAnswers[ex.id]) {
    previousSql = window.examAnswers[ex.id].sql || '';
  } else if (currentModo === 'practica' && ex._respuesta_sql) {
    previousSql = ex._respuesta_sql;
  }
  sqlEditor.value = previousSql;
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
    
    // Cargar desde los scripts .sql en la carpeta bds
    const path = `bds/${bdName}.sql`;
    
    const res = await fetch(`../${path}`);
    sqlDb = new SQL.Database(); // Siempre inicializar vacía
    
    if (!res.ok) {
      console.warn(`No se encontró el script ${path}, iniciando la BD totalmente vacía (ideal para DDL).`);
    } else {
      let sqlText = await res.text();
      
      // Adaptar sintaxis MySQL a SQLite
      sqlText = sqlText
        .replace(/drop\s+database\s+if\s+exists\s+\w+\s*;/gi, '')
        .replace(/CREATE\s+DATABASE\s+(IF\s+NOT\s+EXISTS\s+)?\w+\s*;/gi, '')
        .replace(/use\s+\w+\s*;/gi, '')
        .replace(/INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/UNIQUE\s+KEY\s+\w+\s*\(([^)]+)\)/gi, 'UNIQUE($1)');

      try {
        sqlDb.run(sqlText); // Volcar el script SQL a la base de datos en memoria
      } catch (sqlErr) {
        console.error(`Error ejecutando el script ${path}:`, sqlErr);
      }
    }
    
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

    const dbCopy = new sqlDb.constructor(sqlDb.export());
    let resSolucion = [];
    try {
      resSolucion = dbCopy.exec(ex.query_solucion);
    } catch(e) { console.error('Error en solución oficial:', e); }

    const isCorrect = compareResults(resAlumno, resSolucion, isDML, dbCopy);
    
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
    if (isDML) updateSchemaSidebar();
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

async function submitExam() {
  if (!window.examAnswers) window.examAnswers = {};
  
  let totalPuntosPosibles = 0;
  let puntosConseguidos = 0;
  let respondidas = 0;
  
  currentEjercicios.forEach(ex => {
    totalPuntosPosibles += (ex.puntos || 10);
    const ans = window.examAnswers[ex.id];
    if (ans) {
      respondidas++;
      if (ans.isCorrect) puntosConseguidos += ans.puntos;
    }
  });

  if (respondidas < currentEjercicios.length) {
    if (!confirm(`Faltan ${currentEjercicios.length - respondidas} preguntas por responder. ¿Seguro que quieres entregar?`)) {
      return;
    }
  }

  const btnSubmit = document.getElementById('btn-submit-tanda');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entregando...';

  // Guardar en firestore si es alumno
  if (userDoc.rol === 'alumno') {
    try {
      const claseIdParam = new URLSearchParams(window.location.search).get('claseId');
      const examData = {
        claseId: claseIdParam,
        tandaId: currentTanda,
        fecha: new Date().toISOString(),
        respuestas: window.examAnswers,
        puntuacion: puntosConseguidos,
        puntosMaximos: totalPuntosPosibles
      };
      await fb.setDoc(fb.doc(db, 'usuarios', user.uid, 'examenes', `examen_${Date.now()}`), examData);
      
      // Actualizar puntos totales
      await fb.updateDoc(fb.doc(db, 'usuarios', user.uid), {
        puntosTotal: (userDoc.puntosTotal || 0) + puntosConseguidos
      });
    } catch(e) {
      console.error(e);
      alert('Error guardando el examen: ' + e.message);
    }
  }

  // Mostrar nota final
  const nota = (puntosConseguidos / totalPuntosPosibles) * 10;
  const overlay = document.getElementById('success-overlay');
  
  overlay.innerHTML = `
      <i class="fas fa-clipboard-check text-white mb-3" style="font-size: 5rem; text-shadow: 0 4px 15px rgba(0,0,0,0.2)"></i>
      <h2 class="text-white fw-bold">Examen Entregado</h2>
      <p class="text-white-50 fs-4 mb-2">Nota: ${nota.toFixed(1)} / 10</p>
      <p class="text-white-50 mb-4">${puntosConseguidos} de ${totalPuntosPosibles} puntos</p>
      <button class="btn btn-light btn-lg fw-bold px-5 rounded-pill shadow" onclick="window.close(); window.location.href='tandas.html?claseId=${new URLSearchParams(window.location.search).get('claseId')}'">
        Volver a la clase <i class="fas fa-arrow-right ms-2"></i>
      </button>
  `;
  overlay.style.background = 'rgba(15, 23, 42, 0.95)';
  overlay.style.setProperty('display', 'flex', 'important');
}
