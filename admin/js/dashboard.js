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
        <td class="text-warning fw-bold">⭐ ${u.puntosTotal || 0}</td>
        <td class="text-success">${u.ejerciciosOK || 0}</td>
      `;
      rankBody.appendChild(tr);
    });

  } catch (e) {
    showAdminToast('❌', 'Error cargando dashboard: ' + e.message, 'error');
    console.error(e);
  }
}
