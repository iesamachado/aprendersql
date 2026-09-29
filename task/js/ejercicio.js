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
    const q = fb.query(
      fb.collection(db, 'intentos'),
      fb.where('ejercicioId', '==', currentExId),
      fb.where('success', '==', true),
      fb.orderBy('queryLength', 'asc'),
      fb.limit(10) // fetch more in case of duplicates
    );
    const snap = await fb.getDocs(q);
    
    // Deduplicate by email/uid
    const usersSeen = new Set();
    const top3 = [];
    snap.forEach(d => {
      const data = d.data();
      if (!usersSeen.has(data.email) && top3.length < 3) {
        usersSeen.add(data.email);
        top3.push(data);
      }
    });

    if (top3.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-4">Nadie ha resuelto este ejercicio aún. ¡Sé el primero!</td></tr>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    tbody.innerHTML = top3.map((t, i) => `
      <tr>
        <td class="fs-4">${medals[i]}</td>
        <td>${t.email ? t.email.split('@')[0] : 'Anónimo'}</td>
        <td class="fw-bold text-info">${t.queryLength}</td>
      </tr>
    `).join('');

  } catch(e) {
    console.error('Error fetching golf leaderboard:', e);
    tbody.innerHTML = '<tr><td colspan="3" class="text-danger py-4">Falta índice en Firestore para esta consulta.</td></tr>';
  }
}

window.showGremioModal = async function() {
  const modal = new bootstrap.Modal(document.getElementById('gremio-modal'));
  modal.show();
  
  if (!userDoc.gremio) {
    document.getElementById('gremio-selector').style.display = 'block';
    document.getElementById('gremio-leaderboard').style.display = 'none';
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

async function loadGremioLeaderboard() {
  const container = document.getElementById('gremio-bars');
  container.innerHTML = '<div class="text-center text-muted"><i class="fas fa-spinner fa-spin"></i> Calculando puntos globales...</div>';
  
  try {
    const q = fb.query(fb.collection(db, 'usuarios')); // Consultamos todos los usuarios (en clases reales no son muchos)
    const snap = await fb.getDocs(q);
    
    const scores = {
      'La Orden del JOIN': { icon: '🛡️', pts: 0, color: 'bg-primary' },
      'El Cártel del SELECT': { icon: '🗡️', pts: 0, color: 'bg-success' },
      'La Hermandad del DROP': { icon: '🧙‍♂️', pts: 0, color: 'bg-danger' },
      'Los Ninjas del WHERE': { icon: '🦂', pts: 0, color: 'bg-warning' }
    };
    
    let totalGlobalPts = 0;
    
    snap.forEach(d => {
      const u = d.data();
      if (u.gremio && scores[u.gremio]) {
        scores[u.gremio].pts += (u.puntosTotal || 0);
        totalGlobalPts += (u.puntosTotal || 0);
      }
    });
    
    const sorted = Object.entries(scores).sort((a,b) => b[1].pts - a[1].pts);
    
    // Si nadie tiene puntos
    if (totalGlobalPts === 0) totalGlobalPts = 1; 
    
    container.innerHTML = sorted.map(([name, data], idx) => `
      <div>
        <div class="d-flex justify-content-between small fw-bold mb-1 align-items-end">
          <span class="fs-6">${idx === 0 && data.pts > 0 ? '👑 ' : ''}${data.icon} <span class="text-light">${name}</span></span>
          <span class="text-info fs-6">${data.pts} <span class="text-secondary" style="font-size:0.75rem">pts</span></span>
        </div>
        <div class="progress border border-secondary" style="height: 12px; background:#1e293b">
          <div class="progress-bar ${data.color} progress-bar-striped ${idx === 0 ? 'progress-bar-animated' : ''}" style="width: ${(data.pts / totalGlobalPts) * 100}%"></div>
        </div>
      </div>
    `).join('');
    
  } catch(e) {
    console.error('Error cargando leaderboard gremios:', e);
    container.innerHTML = '<div class="text-danger text-center">Error al cargar ranking de Gremios.</div>';
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
      try {
        sqlDb.run(query);
        resAlumno = [{ columns: ['Resultado'], values: [['Comando ejecutado correctamente']] }];
      } catch (err) {
        if (/^\s*ALTER\s+TABLE\s+\w+\s+(MODIFY|CHANGE|ALTER\s+COLUMN|ADD\s+(CONSTRAINT|CHECK|FOREIGN\s+KEY|PRIMARY\s+KEY|UNIQUE)|DROP\s+(PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|INDEX))/i.test(query)) {
          resAlumno = [{ columns: ['Resultado', 'Aviso'], values: [['Comando aceptado', 'El comando es válido en MariaDB/MySQL, pero no se modificará la tabla por limitación del motor de SQLite en el navegador.']] }];
          showToast('⚠️', 'Comando correcto. No se modifica la BD por limitación del motor.', 'warning');
        } else {
          throw err;
        }
      }
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
    
    // Evaluar logros
    let nuevosLogros = [];
    const userLogros = userDoc.logros || [];
    const hasLogro = (id) => userLogros.some(l => l.id === id);
    const checkAddLogro = (id) => {
      if (!hasLogro(id)) {
        const cat = window.MEDALLAS_CATALOGO.find(m => m.id === id);
        if (cat) {
          const l = { id: cat.id, name: cat.name, desc: cat.desc, icon: cat.icon, ts: new Date().toISOString() };
          userLogros.push(l);
          nuevosLogros.push(l);
        }
      }
    };

    // Lógica medallas
    if (isSuccess && userDoc.ejerciciosOK === 0) checkAddLogro('first_blood');
    if (isSuccess && window._consecutiveSuccess === 3) checkAddLogro('racha_3');
    
    const h = new Date().getHours();
    if (isSuccess && h >= 6 && h <= 8) checkAddLogro('madrugador');
    if (isSuccess && (h >= 0 && h <= 4)) checkAddLogro('nocturno');

    if (isSuccess && queryTxt === queryTxt.toUpperCase() && queryTxt.match(/[A-Z]/)) checkAddLogro('grita_sql');
    if (isSuccess && ex && ex.query_solucion && queryTxt.length < ex.query_solucion.length * 0.7) checkAddLogro('minimalista');
    if (!isSuccess && /DROP\s+TABLE/i.test(queryTxt) && !/DROP\s+TABLE/i.test(ex?.query_solucion || '')) checkAddLogro('bobby_tables');
    if (!isSuccess && window._consecutiveFails === 6) checkAddLogro('persistente');

    // Registrar intento
    await fb.addDoc(fb.collection(db, 'intentos'), {
      ejercicioId: currentExId, uid: user.uid, email: user.email,
      success: isSuccess, query: queryTxt, queryLength: queryTxt.length,
      puntosGanados: pts, timestamp: ts
    });

    if (nuevosLogros.length > 0) {
      userDoc.logros = userLogros;
      await fb.updateDoc(fb.doc(db, 'usuarios', user.uid), { logros: userLogros });
      nuevosLogros.forEach(l => showToast(l.icon, `¡Logro Desbloqueado! ${l.name}`, 'success'));
      if(typeof renderLogrosUI === 'function') renderLogrosUI();
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
