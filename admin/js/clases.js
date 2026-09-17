import { initAdminPage, showAdminToast } from './shared.js';

const { db, user, userDoc, fb } = await initAdminPage();

let currentUser = user;
let classroomToken = null;

await loadClases();

// ── Exponer globalmente (llamados desde HTML onclick) ────────
window._loadClases          = loadClases;
window._createClase         = createClase;
window._startClassroomImport = startClassroomImport;

// ── Cargar lista de clases ───────────────────────────────────
async function loadClases() {
  const tbody = document.getElementById('clases-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4"><i class="fas fa-spinner fa-spin"></i></td></tr>';

  try {
    let clasesQuery;
    if (userDoc.rol === 'docente') {
      clasesQuery = fb.query(fb.collection(db, 'clases'), fb.where('docenteId', '==', currentUser.uid));
    } else {
      clasesQuery = fb.collection(db, 'clases');
    }

    const snap = await fb.getDocs(clasesQuery);
    tbody.innerHTML = '';

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay clases creadas aún.</td></tr>';
      return;
    }

    snap.forEach(d => {
      const data      = d.data();
      const registr   = (data.alumnosIds || []).length;
      const total     = (data.alumnosEmails || []).length;
      const pendient  = total > registr ? total - registr : 0;
      const moduloBadge = data.modulo === '0377'
        ? '<span class="badge" style="background:rgba(167,139,250,0.2);color:#a78bfa;border:1px solid rgba(167,139,250,0.4)">0377 · 2º</span>'
        : '<span class="badge" style="background:rgba(79,142,247,0.2);color:#4f8ef7;border:1px solid rgba(79,142,247,0.4)">0372 · 1º</span>';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-bold text-info">${data.nombre}</td>
        <td>${moduloBadge}</td>
        <td class="text-secondary small">${data.curso || '—'}</td>
        <td class="text-secondary small">${data.docenteEmail || '—'}</td>
        <td>
          <span class="badge bg-primary">${registr} registrados</span>
          ${pendient > 0 ? `<br><span class="badge bg-warning text-dark mt-1">${pendient} pendientes</span>` : ''}
        </td>
        <td>
          <a href="clase.html?id=${d.id}" class="btn btn-sm btn-outline-primary me-2">
            <i class="fas fa-eye me-1"></i>Ver
          </a>
          <button class="btn btn-sm btn-outline-danger" onclick="window._deleteClase('${d.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center py-4">${e.message}</td></tr>`;
  }
}

// ── Crear clase ──────────────────────────────────────────────
async function createClase() {
  const nombre = document.getElementById('clase-nombre').value.trim();
  const curso  = document.getElementById('clase-curso').value.trim();
  const modulo = document.getElementById('clase-modulo').value;

  if (!nombre) { showAdminToast('⚠️', 'El nombre de la clase es obligatorio', 'warning'); return; }

  try {
    await fb.addDoc(fb.collection(db, 'clases'), {
      nombre, curso, modulo,
      docenteId:     currentUser.uid,
      docenteEmail:  currentUser.email,
      alumnosIds:    [],
      alumnosEmails: [],
      tareasIds:     [],
      bloquesActivos: [],
      createdAt:     fb.serverTimestamp()
    });

    document.getElementById('clase-nombre').value = '';
    document.getElementById('clase-curso').value  = '';
    showAdminToast('✅', `Clase "${nombre}" creada`);
    loadClases();
  } catch (e) {
    showAdminToast('❌', e.message, 'error');
  }
}

// ── Borrar clase ─────────────────────────────────────────────
window._deleteClase = async function(claseId) {
  if (!confirm('¿Eliminar esta clase? Esta acción no se puede deshacer.')) return;
  try {
    await fb.deleteDoc(fb.doc(db, 'clases', claseId));
    showAdminToast('✅', 'Clase eliminada');
    loadClases();
  } catch (e) {
    showAdminToast('❌', e.message, 'error');
  }
};

// ── Google Classroom Import ───────────────────────────────────
async function startClassroomImport() {
  const { GoogleAuthProvider, signInWithPopup } = fb;
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/classroom.courses.readonly');
  provider.addScope('https://www.googleapis.com/auth/classroom.rosters.readonly');
  provider.addScope('https://www.googleapis.com/auth/classroom.profile.emails');

  try {
    const result    = await signInWithPopup(fb.auth, provider);
    const cred      = GoogleAuthProvider.credentialFromResult(result);
    classroomToken  = cred.accessToken;
    new bootstrap.Modal(document.getElementById('classroom-modal')).show();
    fetchClassroomCourses();
  } catch (e) {
    showAdminToast('❌', 'Error con Classroom: ' + e.message, 'error');
  }
}

async function fetchClassroomCourses() {
  const list = document.getElementById('classroom-courses-list');
  list.innerHTML = '<div class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin"></i> Obteniendo clases...</div>';

  try {
    const res  = await fetch('https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE',
      { headers: { Authorization: `Bearer ${classroomToken}` } });
    const data = await res.json();
    list.innerHTML = '';

    if (!data.courses?.length) {
      list.innerHTML = '<div class="text-center py-4 text-warning">No se encontraron clases activas.</div>';
      return;
    }

    data.courses.forEach(course => {
      const btn = document.createElement('button');
      btn.className = 'list-group-item list-group-item-action text-white d-flex justify-content-between align-items-center mb-2 rounded border border-secondary';
      btn.style.background = 'rgba(255,255,255,0.05)';
      btn.innerHTML = `
        <div>
          <div class="fw-bold">${course.name}</div>
          <div class="small text-muted">${course.section || 'Sin sección'}</div>
        </div>
        <i class="fas fa-download text-primary"></i>`;
      btn.onclick = () => importCourse(course.id, course.name, course.section);
      list.appendChild(btn);
    });
  } catch (e) {
    list.innerHTML = `<div class="text-center py-4 text-danger">Error con la API de Classroom.</div>`;
  }
}

async function importCourse(courseId, courseName, courseSection) {
  if (!confirm(`¿Importar "${courseName}"?`)) return;
  bootstrap.Modal.getInstance(document.getElementById('classroom-modal')).hide();
  showAdminToast('⏳', 'Importando alumnos...', 'info');

  try {
    let students = [], pageToken = '';
    do {
      const url = `https://classroom.googleapis.com/v1/courses/${courseId}/students${pageToken ? `?pageToken=${pageToken}` : ''}`;
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${classroomToken}` } });
      const data = await res.json();
      if (data.students) students = students.concat(data.students.map(s => s.profile?.emailAddress).filter(Boolean));
      pageToken = data.nextPageToken;
    } while (pageToken);

    if (!students.length) { showAdminToast('⚠️', 'Sin alumnos con correo visible', 'warning'); return; }

    const alumnosIds = [];
    for (let i = 0; i < students.length; i += 10) {
      const batch = students.slice(i, i + 10);
      const q     = fb.query(fb.collection(db, 'usuarios'), fb.where('email', 'in', batch));
      const snap  = await fb.getDocs(q);
      snap.forEach(d => alumnosIds.push(d.id));
    }

    const nombre = courseSection ? `${courseName} (${courseSection})` : courseName;
    await fb.addDoc(fb.collection(db, 'clases'), {
      nombre, curso: 'Classroom Import', modulo: '0372',
      docenteId:     currentUser.uid,
      docenteEmail:  currentUser.email,
      alumnosIds, alumnosEmails: students,
      tareasIds: [], bloquesActivos: [],
      createdAt: fb.serverTimestamp()
    });

    showAdminToast('✅', `Importados ${students.length} alumnos de "${nombre}"`);
    loadClases();
  } catch (e) {
    showAdminToast('❌', 'Error importando: ' + e.message, 'error');
  }
}
