import { initTaskPage } from './auth.js';

const { user, userDoc, db, fb } = await initTaskPage();
loadClases();

async function loadClases() {
  const container = document.getElementById('clases-container');
  const noClassAlert = document.getElementById('no-class-alert');
  
  if (!userDoc.claseId) {
    container.innerHTML = '';
    noClassAlert.style.display = 'block';
    return;
  }

  try {
    const q = fb.query(fb.collection(db, 'clases'), fb.where('alumnosIds', 'array-contains', user.uid));
    const snap = await fb.getDocs(q);

    if (snap.empty) {
      container.innerHTML = '';
      noClassAlert.style.display = 'block';
      // Limpiar claseId si la clase ya no existe o lo han quitado
      await fb.updateDoc(fb.doc(db, 'usuarios', user.uid), { claseId: fb.deleteField() });
      return;
    }

    container.innerHTML = '';
    snap.forEach(d => {
      const c = d.data();
      const col = document.createElement('div');
      col.className = 'col-md-6 col-lg-4';
      col.innerHTML = `
        <div class="task-card h-100 cursor-pointer" onclick="window.location.href='tandas.html?claseId=${d.id}&cName=${encodeURIComponent(c.nombre)}'">
          <div class="icon-circle mb-3"><i class="fas fa-chalkboard text-primary"></i></div>
          <h5 class="text-white fw-bold mb-1">${c.nombre}</h5>
          <div class="text-secondary small mb-3"><i class="fas fa-user-tie me-1"></i>${c.docenteEmail || 'Profesor'}</div>
          
          <div class="d-flex justify-content-between align-items-center mt-auto pt-3 border-top" style="border-color:rgba(255,255,255,0.1)!important">
            <span class="badge bg-primary text-dark fw-bold">Entrar a la clase</span>
            <i class="fas fa-arrow-right text-muted"></i>
          </div>
        </div>
      `;
      container.appendChild(col);
    });
  } catch (e) {
    container.innerHTML = `<div class="col-12"><div class="alert alert-danger">Error cargando clases: ${e.message}</div></div>`;
  }
}
