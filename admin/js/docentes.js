import { initAdminPage, showAdminToast } from './shared.js';

const { db, user, userDoc, fb } = await initAdminPage(['admin']); // Solo admin
let currentUser = user;

window._loadDocentes = loadDocentes;
window._addDocente   = addDocente;
await loadDocentes();

async function loadDocentes() {
  const tbody = document.getElementById('docentes-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4"><i class="fas fa-spinner fa-spin"></i></td></tr>';

  try {
    const snap  = await fb.getDocs(fb.collection(db, 'usuarios'));
    tbody.innerHTML = '';
    let count = 0;

    snap.forEach(d => {
      const data = d.data();
      if (!['docente','admin'].includes(data.rol)) return;
      count++;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${data.nombre || '—'}</td>
        <td class="text-secondary">${data.email}</td>
        <td><span class="badge ${data.rol === 'admin' ? 'bg-danger' : 'bg-info text-dark'}">${data.rol}</span></td>
        <td>
          ${data.rol !== 'admin'
            ? `<button class="btn btn-sm btn-outline-danger" onclick="window._removeDocente('${d.id}')">
                 <i class="fas fa-user-minus me-1"></i>Quitar
               </button>`
            : '<span class="text-muted small">Superadmin</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (!count) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay docentes registrados.</td></tr>';
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-danger py-4">${e.message}</td></tr>`;
  }
}

async function addDocente() {
  const email = document.getElementById('docente-email').value.trim().toLowerCase();
  if (!email) return;

  try {
    const snap = await fb.getDocs(
      fb.query(fb.collection(db, 'usuarios'), fb.where('email', '==', email))
    );

    if (snap.empty) {
      const ref = fb.doc(fb.collection(db, 'usuarios_pendientes'));
      await fb.setDoc(ref, { email, rol: 'docente', createdAt: fb.serverTimestamp(), creadoPor: currentUser.email });
      showAdminToast('📧', `${email} será docente cuando acceda por primera vez.`, 'info');
    } else {
      await fb.updateDoc(fb.doc(db, 'usuarios', snap.docs[0].id), { rol: 'docente' });
      showAdminToast('✅', `${email} es ahora docente.`);
    }

    document.getElementById('docente-email').value = '';
    loadDocentes();
  } catch (e) {
    showAdminToast('❌', e.message, 'error');
  }
}

window._removeDocente = async function(uid) {
  if (!confirm('¿Quitar permisos de docente?')) return;
  try {
    await fb.updateDoc(fb.doc(db, 'usuarios', uid), { rol: 'alumno' });
    showAdminToast('✅', 'Permisos retirados');
    loadDocentes();
  } catch (e) {
    showAdminToast('❌', e.message, 'error');
  }
};
