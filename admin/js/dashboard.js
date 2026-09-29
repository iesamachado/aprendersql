import { initAdminPage, showAdminToast } from './shared.js';

const { db, userDoc, fb } = await initAdminPage();

// Poner número total de ejercicios en stat
document.getElementById('stat-ejercicios').textContent =
  (typeof EJERCICIOS !== 'undefined') ? EJERCICIOS.length : '—';

await loadDashboard(db, fb, userDoc);

async function loadDashboard(db, fb, userDoc) {
  try {
    // Contar usuarios
    const usuariosSnap = await fb.getDocs(fb.collection(db, 'usuarios'));
    let totalAlumnos = 0, totalDocentes = 0;
    const allUsers = [];
    usuariosSnap.forEach(d => {
      const data = d.data();
      if (data.rol === 'alumno')  totalAlumnos++;
      if (data.rol === 'docente') totalDocentes++;
      allUsers.push({ id: d.id, ...data });
    });

    // Contar clases
    const clasesSnap = await fb.getDocs(fb.collection(db, 'clases'));

    // Stats
    document.getElementById('stat-alumnos').textContent  = totalAlumnos;
    document.getElementById('stat-docentes').textContent = totalDocentes;
    document.getElementById('stat-clases').textContent   = clasesSnap.size;

    // Últimos intentos
    const intentosSnap = await fb.getDocs(
      fb.query(fb.collection(db, 'intentos'), fb.orderBy('timestamp', 'desc'), fb.limit(10))
    );
    const tbody = document.getElementById('dash-intentos-tbody');
    tbody.innerHTML = '';
    if (intentosSnap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Sin intentos registrados</td></tr>';
    }
    intentosSnap.forEach(d => {
      const data = d.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-secondary small">${data.email || '—'}</td>
        <td><span class="badge bg-secondary">#${data.ejercicioId}</span></td>
        <td>${data.success
          ? '<span class="badge bg-success">✅ Éxito</span>'
          : '<span class="badge bg-danger">❌ Fallo</span>'}</td>
        <td class="text-warning small">${data.puntosGanados ? '+'+data.puntosGanados : '0'}</td>
        <td class="text-muted small">${data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString('es-ES') : '—'}</td>
      `;
      tbody.appendChild(tr);
    });

    // Ranking
    const top = allUsers
      .filter(u => u.rol === 'alumno')
      .sort((a, b) => (b.puntosTotal || 0) - (a.puntosTotal || 0))
      .slice(0, 10);

    const rankBody = document.getElementById('dash-ranking-tbody');
    rankBody.innerHTML = '';
    if (top.length === 0) {
      rankBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Sin alumnos</td></tr>';
    }
    top.forEach((u, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${medal}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            ${u.foto ? `<img src="${u.foto}" style="width:24px;height:24px;border-radius:50%">` : ''}
            <span class="small">${u.nombre || u.email}</span>
          </div>
        </td>
        <td class="text-warning fw-bold">⭐ ${u.puntosTotal || 0} <span class="badge bg-danger ms-1 text-white" style="font-size:0.6rem">🏅 ${u.logros?.length || 0}</span></td>
        <td class="text-success">${u.ejerciciosOK || 0}</td>
      `;
      rankBody.appendChild(tr);
    });

  } catch (e) {
    showAdminToast('❌', 'Error cargando dashboard: ' + e.message, 'error');
    console.error(e);
  }
}

// --- Lógica del Pop-up de Sincronización ---
const btnSync = document.getElementById('btn-sync-medallas');
if (btnSync) {
  btnSync.addEventListener('click', async () => {
    if (!confirm('¿Seguro que quieres revisar todos los alumnos y asignarles las medallas de Hitos de forma retroactiva?')) return;
    
    const syncModal = new bootstrap.Modal(document.getElementById('modal-sync'));
    const logBox = document.getElementById('sync-log');
    const progressBar = document.getElementById('sync-progress-bar');
    const statusText = document.getElementById('sync-status-text');
    const footer = document.getElementById('sync-footer');
    
    // Reset modal
    logBox.innerHTML = '';
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    progressBar.classList.add('progress-bar-animated');
    statusText.textContent = 'Obteniendo lista de usuarios...';
    footer.style.display = 'none';
    
    const addLog = (msg, color='text-secondary') => {
      const p = document.createElement('div');
      p.className = color;
      p.textContent = `> ${msg}`;
      logBox.appendChild(p);
      logBox.scrollTop = logBox.scrollHeight;
    };
    
    syncModal.show();
    addLog('Conectando con la base de datos...', 'text-info');
    
    try {
      const snap = await fb.getDocs(fb.collection(db, 'usuarios'));
      const alumnos = snap.docs.filter(d => d.data().rol === 'alumno');
      const total = alumnos.length;
      
      addLog(`Se encontraron ${total} alumnos. Evaluando medallas...`, 'text-success');
      
      const catalogo = window.MEDALLAS_CATALOGO || [];
      let updatedCount = 0;
      
      for (let i = 0; i < total; i++) {
        const userDocSnap = alumnos[i];
        const u = userDocSnap.data();
        let modified = false;
        let gainedStr = [];
        
        const userLogros = u.logros || [];
        const hasLogro = (id) => userLogros.some(l => l.id === id);
        
        const checkAdd = (id) => {
          if (!hasLogro(id)) {
            const cat = catalogo.find(m => m.id === id);
            if (cat) {
              userLogros.push({ id: cat.id, name: cat.name, desc: cat.desc, icon: cat.icon, ts: new Date().toISOString() });
              gainedStr.push(cat.name);
              modified = true;
            }
          }
        };

        const exs = u.ejerciciosOK || 0;
        if (exs >= 1) checkAdd('first_blood');
        if (exs >= 10) checkAdd('novato_sql');
        if (exs >= 25) checkAdd('aprendiz_sql');
        if (exs >= 50) checkAdd('experto_sql');
        if (exs >= 100) checkAdd('maestro_sql');

        if (modified) {
          await fb.updateDoc(fb.doc(db, 'usuarios', userDocSnap.id), { logros: userLogros });
          updatedCount++;
          addLog(`${u.nombre || u.email} ha ganado: ${gainedStr.join(', ')}`, 'text-warning');
        } else {
          // addLog(`${u.nombre || u.email}: Al día.`, 'text-muted'); // Muy verboso si hay cientos
        }
        
        // Actualizar progreso
        const pct = Math.round(((i + 1) / total) * 100);
        progressBar.style.width = pct + '%';
        progressBar.textContent = pct + '%';
        statusText.textContent = `Evaluando: ${i+1} de ${total}`;
      }
      
      progressBar.classList.remove('progress-bar-animated');
      progressBar.classList.add('bg-success');
      statusText.textContent = '¡Sincronización Completada!';
      statusText.classList.add('text-success');
      addLog('---', 'text-light');
      addLog(`Proceso finalizado. ${updatedCount} alumnos han recibido nuevas medallas.`, 'text-success');
      
    } catch (e) {
      console.error(e);
      addLog(`ERROR FATAL: ${e.message}`, 'text-danger');
      statusText.textContent = 'Error durante la sincronización';
      statusText.classList.add('text-danger');
      progressBar.classList.remove('progress-bar-animated');
      progressBar.classList.replace('bg-warning', 'bg-danger');
    } finally {
      footer.style.display = 'block'; // Mostrar botón de cerrar
    }
  });
}
