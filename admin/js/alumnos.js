import { initAdminPage } from './shared.js';

const { db, fb } = await initAdminPage();
window._loadAlumnos = loadAlumnos;
await loadAlumnos();

async function loadAlumnos() {
  const tbody = document.getElementById('alumnos-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4"><i class="fas fa-spinner fa-spin"></i></td></tr>';

  try {
    const snap    = await fb.getDocs(fb.query(fb.collection(db, 'usuarios'), fb.where('rol', '==', 'alumno')));
    const alumnos = [];
    snap.forEach(d => alumnos.push({ id: d.id, ...d.data() }));
    alumnos.sort((a, b) => (b.puntosTotal || 0) - (a.puntosTotal || 0));

    tbody.innerHTML = '';
    if (!alumnos.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay alumnos registrados.</td></tr>';
      return;
    }

    alumnos.forEach((a, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      const tr    = document.createElement('tr');
      tr.innerHTML = `
        <td>${medal || (i+1)}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            ${a.foto ? `<img src="${a.foto}" style="width:28px;height:28px;border-radius:50%">` : '<div style="width:28px;height:28px;border-radius:50%;background:#1e293b;display:flex;align-items:center;justify-content:center;font-size:0.75rem">👤</div>'}
            <div>
              <div class="small fw-bold">${a.nombre || '—'}</div>
              <div class="text-muted" style="font-size:0.7rem">${a.email}</div>
            </div>
          </div>
        </td>
        <td class="text-muted small">${a.claseId || '—'}</td>
        <td><span class="badge bg-warning text-dark fw-bold">⭐ ${a.puntosTotal || 0}</span></td>
        <td><span class="badge bg-success">${a.ejerciciosOK || 0} ej.</span></td>
        <td class="text-muted small">${a.ultimaActividad?.toDate ? a.ultimaActividad.toDate().toLocaleDateString('es-ES') : '—'}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger py-4 text-center">${e.message}</td></tr>`;
  }
}
