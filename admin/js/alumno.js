let currentUser = null;
let userDoc = null;
const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get('uid');
const claseId = urlParams.get('claseId');

document.addEventListener('DOMContentLoaded', async () => {
  if (!uid) {
    window.location.href = 'index.html';
    return;
  }
  
  if (!window.FIREBASE_CONFIG || window.FIREBASE_CONFIG.apiKey.includes('TU-API-KEY')) {
    document.body.innerHTML = '<h2>Firebase no configurado</h2>';
    return;
  }

  const { initializeApp }   = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getAuth, onAuthStateChanged, signOut } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, setDoc } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const firebaseApp = initializeApp(window.FIREBASE_CONFIG);
  const auth = getAuth(firebaseApp);
  const db   = getFirestore(firebaseApp);

  window._fb = { doc, getDoc, setDoc, collection, query, where, getDocs, signOut, auth, db };
  if(window.loadGlobalExercisesDB) await window.loadGlobalExercisesDB();


  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      const snap = await window._fb.getDoc(window._fb.doc(window._fb.db, 'usuarios', user.uid));
      if (snap.exists()) {
        userDoc = snap.data();
        if (userDoc.rol === 'admin' || userDoc.rol === 'docente') {
          document.getElementById('admin-user-name').textContent = userDoc.nombre || 'Docente';
          document.getElementById('admin-user-email').textContent = userDoc.email;
          document.getElementById('admin-user-avatar').src = userDoc.foto || '';
          
          document.getElementById('admin-app').classList.add('visible');
          loadAlumno();
          
          document.getElementById('btn-admin-logout').addEventListener('click', async () => {
            await window._fb.signOut(window._fb.auth);
            window.location.href = 'index.html';
          });
          return;
        }
      }
    }
    window.location.href = 'index.html';
  });
});

async function loadAlumno() {
  const { doc, getDoc, setDoc, collection, getDocs, query, where } = window._fb;
  const { db } = window._fb;

  const btnVolver = document.getElementById('btn-volver-clase');
  if (claseId) {
    btnVolver.href = `clase.html?id=${claseId}`;
  } else {
    btnVolver.href = `index.html`;
  }
  
  // Note: we can't use onclick with href if we want standard behavior, or we remove onclick if href exists.
  // We used an anchor in the HTML? No, btnVolver is a button in the HTML.
  // Wait, in admin/index.html it was <button id="btn-volver-clase">. We'll set an onclick.
  btnVolver.onclick = () => {
    window.location.href = claseId ? `clase.html?id=${claseId}` : 'index.html';
  };

  try {
    const userSnap = await getDoc(doc(db, 'usuarios', uid));
    if (!userSnap.exists()) {
      showAdminToast('❌', 'Usuario no encontrado', 'error');
      setTimeout(() => window.location.href = 'index.html', 1500);
      return;
    }
    const userData = userSnap.data();

    document.getElementById('alumno-detalle-nombre').textContent = userData.nombre || userData.email;
    document.getElementById('alumno-detalle-email').textContent  = userData.email;
    document.getElementById('alumno-detalle-puntos').textContent = `⭐ ${userData.puntosTotal || 0}`;
    document.getElementById('alumno-detalle-ejercicios').textContent = userData.ejerciciosOK || 0;

    const exsSnap = await getDocs(collection(db, 'usuarios', uid, 'ejercicios'));
    const exDataMap = {};
    exsSnap.forEach(d => {
      const data = d.data();
      exDataMap[data.ejercicioId] = data;
    });

    const intentosSnap = await getDocs(query(collection(db, 'intentos'), where('uid', '==', uid)));
    
    const intentosPorEx = {};
    intentosSnap.forEach(d => {
      const data = d.data();
      if (!intentosPorEx[data.ejercicioId]) intentosPorEx[data.ejercicioId] = [];
      intentosPorEx[data.ejercicioId].push(data);
    });

    Object.keys(intentosPorEx).forEach(exId => {
      intentosPorEx[exId].sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return timeB - timeA;
      });
    });

    // Calcular notas por bloque
    const ptsPorBloque = {};
    window.BLOQUES?.forEach(b => {
      ptsPorBloque[b.id] = { conseguidos: 0, max: b.max_pts, nombre: b.nombre };
    });

    Object.keys(exDataMap).forEach(exId => {
      const exMeta = exDataMap[exId];
      const exData = window.EJERCICIOS.find(e => e.id == exId);
      if (exData && ptsPorBloque[exData.bloque_id]) {
        ptsPorBloque[exData.bloque_id].conseguidos += (exMeta.puntoObtenido || 0);
      }
    });

    // Renderizar notas por bloque
    const gradesContainer = document.getElementById('notas-bloques-container');
    if (gradesContainer && window.BLOQUES) {
      let gradesHtml = '<h5 class="text-warning mb-3"><i class="fas fa-chart-pie me-2"></i>Notas por Bloque</h5><div class="row g-2">';
      window.BLOQUES.forEach(b => {
        const stats = ptsPorBloque[b.id];
        const nota = stats.max > 0 ? ((stats.conseguidos / stats.max) * 10).toFixed(1) : '0.0';
        gradesHtml += `
          <div class="col-md-6 col-lg-3">
            <div class="bg-dark border border-secondary rounded p-3 text-center h-100">
              <div class="small text-muted mb-1 text-truncate" title="${b.nombre}">${b.nombre}</div>
              <div class="fs-4 fw-bold text-${nota >= 5 ? 'success' : 'danger'}">${nota}</div>
              <div class="small text-secondary mt-1">${stats.conseguidos} / ${stats.max} pts</div>
            </div>
          </div>
        `;
      });
      gradesHtml += '</div>';
      gradesContainer.innerHTML = gradesHtml;
    }

    
    // Cargar Intentos de Tandas
    const tandasSnap = await getDocs(query(collection(db, 'intentos_tandas'), where('uid', '==', uid)));
    const accordionTandas = document.getElementById('accordion-tandas');
    accordionTandas.innerHTML = '';
    
    if (tandasSnap.empty) {
      accordionTandas.innerHTML = '<div class="alert bg-dark text-muted border-secondary text-center">No hay intentos de tandas registrados.</div>';
    } else {
      let tandasArr = [];
      tandasSnap.forEach(d => tandasArr.push(d.data()));
      tandasArr.sort((a,b) => b.fechaInicio.toMillis() - a.fechaInicio.toMillis());
      
      tandasArr.forEach((tanda, i) => {
        const idCol = `tanda-col-${i}`;
        const fecha = tanda.fechaFin ? tanda.fechaFin.toDate().toLocaleString('es-ES') : 'En curso';
        const isFin = !!tanda.fechaFin;
        const notaStr = isFin ? parseFloat(tanda.nota).toFixed(1) : '-';
        const color = notaStr >= 5 ? 'success' : (isFin ? 'danger' : 'warning');
        
        let detalleHtml = '';
        if (tanda.respuestas && tanda.respuestas.length > 0) {
          detalleHtml = `<table class="table table-dark table-sm mt-3">
            <thead><tr><th>Ejercicio</th><th>Estado</th><th>Intentos</th><th>Ptos</th></tr></thead>
            <tbody>
              ${tanda.respuestas.map(r => `
                <tr>
                  <td>#${r.ejercicioId}</td>
                  <td>${r.resuelto ? '<span class="text-success"><i class="fas fa-check"></i> Correcto</span>' : '<span class="text-danger"><i class="fas fa-times"></i> Fallo</span>'}</td>
                  <td>${r.intentos_gastados || 1}</td>
                  <td>${r.ptos || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>`;
        } else {
          detalleHtml = '<div class="text-muted small mt-2">No hay respuestas registradas (tanda vacía o antigua).</div>';
        }
        
        accordionTandas.innerHTML += `
          <div class="accordion-item bg-dark border-secondary mb-2 rounded">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed bg-dark text-light border-0 rounded shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#${idCol}">
                <div class="d-flex align-items-center w-100 me-3">
                  <span class="fw-bold me-auto">${tanda.tandaId}</span>
                  <span class="text-muted small me-3">${fecha}</span>
                  <span class="badge bg-${color} fs-6">Nota: ${notaStr}</span>
                </div>
              </button>
            </h2>
            <div id="${idCol}" class="accordion-collapse collapse" data-bs-parent="#accordion-tandas">
              <div class="accordion-body p-3 border-top border-secondary">
                ${detalleHtml}
              </div>
            </div>
          </div>
        `;
      });
    }

    const accordion = document.getElementById('accordion-intentos');
    accordion.innerHTML = '';

    if (Object.keys(exDataMap).length === 0) {
      accordion.innerHTML = '<div class="alert bg-dark text-muted border-secondary text-center">Este alumno aún no ha intentado ningún ejercicio.</div>';
      return;
    }

    const sortedExIds = Object.keys(exDataMap).map(Number).sort((a,b) => a - b);

    sortedExIds.forEach((exId) => {
      const exMeta = exDataMap[exId];
      const intentos = intentosPorEx[exId] || [];
      const isSuperado = exMeta.superado;
      
      const headerClass = isSuperado ? 'text-success' : 'text-warning';
      const headerIcon = isSuperado ? '✅' : '⏳';
      
      let baseEx = window.EJERCICIOS.find(e => e.id == exId);
      let expectedSolution = 'Solución no disponible';
      let expectedTitle = exMeta.titulo || 'Ejercicio ' + exId;
      if (baseEx && window.getVariationForStudent) {
        baseEx = window.getVariationForStudent(baseEx, uid);
        expectedSolution = baseEx.query_solucion;
        // Optionally show the student's variation title
      }

      const accordionItem = document.createElement('div');
      accordionItem.className = 'accordion-item bg-dark border-secondary mb-2 rounded';
      accordionItem.innerHTML = `
        <h2 class="accordion-header" id="heading-${exId}">
          <button class="accordion-button collapsed bg-dark text-light border-0 rounded shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${exId}">
            <div class="d-flex align-items-center w-100 me-3">
              <span class="badge bg-secondary me-2">#${exId}</span>
              <span class="${headerClass} fw-bold me-auto">${headerIcon} ${expectedTitle}</span>
              <span class="text-muted small me-3">${intentos.length} intentos</span>
              <span class="badge ${isSuperado ? 'bg-success' : 'bg-secondary'} me-3">Pts: ${exMeta.puntoObtenido || 0}</span>
              <button class="btn btn-sm btn-outline-danger ms-2 reset-btn" onclick="resetearEjercicio('${uid}', ${exId}, ${exMeta.puntoObtenido || 0}); event.stopPropagation();" title="Borrar intentos y resetear estado">
                <i class="fas fa-undo-alt"></i> Reset
              </button>
            </div>
          </button>
        </h2>
        <div id="collapse-${exId}" class="accordion-collapse collapse" data-bs-parent="#accordion-intentos">
          <div class="accordion-body p-0 border-top border-secondary">
            <div class="bg-dark p-3 border-bottom border-secondary">
              <div class="text-success small fw-bold mb-2"><i class="fas fa-check-circle me-1"></i>Solución del sistema (variación asignada):</div>
              <pre class="bg-black p-2 rounded border border-secondary text-success mb-0" style="font-size:0.85rem;white-space:pre-wrap;word-break:break-all;">${expectedSolution}</pre>
            </div>
            ${intentos.length === 0 ? '<div class="p-3 text-muted small">No hay registro detallado de intentos.</div>' : ''}
            <div class="list-group list-group-flush rounded-bottom">
              ${intentos.map((intento, i) => {
                const date = intento.timestamp?.toDate ? intento.timestamp.toDate().toLocaleString('es-ES') : 'Fecha desconocida';
                let successBadge = intento.success 
                  ? '<span class="badge bg-success">✅ Éxito</span>' 
                  : '<span class="badge bg-danger">❌ Fallo</span>';
                
                let reasonHtml = '';
                if (!intento.success && intento.reason) {
                  reasonHtml = `<div class="text-danger small mt-2 bg-danger bg-opacity-10 p-2 rounded"><i class="fas fa-exclamation-triangle me-1"></i>${intento.reason}</div>`;
                }

                let hintBadge = '';
                if (intento.reason === 'requested_hint') {
                  hintBadge = '<span class="badge bg-info text-dark ms-2"><i class="fas fa-lightbulb"></i> Pidió pista</span>';
                  successBadge = ''; 
                  reasonHtml = '';
                }

                return `
                  <div class="list-group-item bg-dark border-secondary p-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <span class="text-muted small fw-bold">Intento ${intentos.length - i}</span>
                        <span class="text-secondary small ms-2">${date}</span>
                      </div>
                      <div>
                        ${successBadge}
                        ${hintBadge}
                      </div>
                    </div>
                    <div class="bg-black p-2 rounded border border-secondary" style="font-family:monospace;font-size:0.85rem;color:#a78bfa;white-space:pre-wrap;word-break:break-all;">${intento.query || '—'}</div>
                    ${reasonHtml}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
      accordion.appendChild(accordionItem);
    });

  } catch (e) {
    document.getElementById('accordion-intentos').innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

function showAdminToast(icon, msg, type = 'info') {
  const colors = { success:'#10b981', error:'#ef4444', warning:'#f59e0b', info:'#4f8ef7' };
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed; bottom:1.5rem; right:1.5rem; z-index:9999;
    background:rgba(15,23,42,0.95); border:1px solid ${colors[type]}44;
    border-radius:10px; padding:0.75rem 1.25rem;
    display:flex; align-items:center; gap:10px;
    backdrop-filter:blur(12px); box-shadow:0 8px 30px rgba(0,0,0,0.4);
    font-family:Inter,sans-serif; color:#f1f5f9;
    font-size:0.85rem; min-width:220px;
    animation: slideIn 0.3s ease-out;
  `;
  toast.innerHTML = `<span style="font-size:1.1rem">${icon}</span><span>${msg}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

window.resetearEjercicio = async function(alumnoUid, exId, puntosARestar) {
  if (!confirm(`¿Estás seguro de resetear el ejercicio #${exId} para este alumno? Perderá los puntos y se borrarán todos sus intentos.`)) return;

  const { doc, deleteDoc, collection, query, where, getDocs, updateDoc, increment } = window._fb;
  const { db } = window._fb;

  try {
    showAdminToast('⏳', 'Borrando intentos...', 'info');

    // 1. Borrar documento de progreso del ejercicio
    await deleteDoc(doc(db, 'usuarios', alumnoUid, 'ejercicios', String(exId)));

    // 2. Borrar todos los intentos de la colección global `intentos`
    const intentosSnap = await getDocs(query(collection(db, 'intentos'), where('uid', '==', alumnoUid), where('ejercicioId', '==', exId)));
    const batch = [];
    intentosSnap.forEach(d => {
      batch.push(deleteDoc(d.ref));
    });
    await Promise.all(batch);

    // 3. Restar puntos y ejercicios completados del total del usuario
    if (puntosARestar > 0) {
      await updateDoc(doc(db, 'usuarios', alumnoUid), {
        puntosTotal: increment(-puntosARestar),
        ejerciciosOK: increment(-1)
      });
    }

    showAdminToast('✅', 'Ejercicio reseteado correctamente', 'success');
    loadAlumno(); // Recargar la vista
  } catch (e) {
    console.error(e);
    showAdminToast('❌', 'Error al resetear: ' + e.message, 'error');
  }
};
