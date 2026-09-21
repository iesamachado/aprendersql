import { getFirestore, collection, getDocs, addDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initAdminPage, showAdminToast } from "./shared.js";

let db, auth;
let currentPreviewPreguntas = [];

initAdminPage().then((fb) => {
  db = fb.db;
  auth = fb.auth;
  setupExamenGenerador();
  loadTestExamsForClass();
});

function setupExamenGenerador() {
  const btnPreview = document.getElementById('btn-preview-examen');
  const btnSave = document.getElementById('btn-save-examen');
  
  if (!btnPreview || !btnSave) return;

  btnPreview.addEventListener('click', async () => {
    const modulo = document.getElementById('gen-modulo').value;
    const rasChecked = Array.from(document.querySelectorAll('#gen-ras .form-check-input:checked')).map(cb => parseInt(cb.value));
    const num = parseInt(document.getElementById('gen-num').value);

    if (rasChecked.length === 0) {
      showAdminToast('Debes seleccionar al menos un RA', 'warning');
      return;
    }

    try {
      btnPreview.disabled = true;
      btnPreview.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generando...';

      // Load questions from DB matching criteria
      const q = query(collection(db, "preguntas"), where("modulo", "==", modulo));
      const snap = await getDocs(q);
      let validQuestions = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => rasChecked.includes(p.ra));

      if (validQuestions.length === 0) {
        showAdminToast('No hay preguntas en el banco para estos criterios.', 'warning');
        btnPreview.disabled = false;
        btnPreview.innerHTML = '<i class="fas fa-random me-2"></i>Generar Borrador';
        return;
      }

      // Shuffle and slice
      validQuestions.sort(() => Math.random() - 0.5);
      currentPreviewPreguntas = validQuestions.slice(0, num);

      // Render preview
      document.getElementById('gen-preview-container').classList.remove('d-none');
      document.getElementById('gen-preview-count').innerText = currentPreviewPreguntas.length;
      document.getElementById('gen-preview-list').innerHTML = currentPreviewPreguntas.map((p, i) => `
        <div class="mb-2 pb-2 border-bottom border-secondary">
          <strong>${i+1}.</strong> [RA${p.ra}] ${p.enunciado}
        </div>
      `).join('');

      btnSave.disabled = false;
    } catch (e) {
      console.error(e);
      showAdminToast('Error al cargar preguntas', 'danger');
    } finally {
      btnPreview.disabled = false;
      btnPreview.innerHTML = '<i class="fas fa-random me-2"></i>Generar Borrador';
    }
  });

  btnSave.addEventListener('click', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const claseId = urlParams.get('id');
    const titulo = document.getElementById('gen-titulo').value || 'Examen Test';
    const tiempo = parseInt(document.getElementById('gen-tiempo').value);

    if (!claseId) {
      showAdminToast('No se detecta el ID de la clase', 'danger');
      return;
    }

    try {
      btnSave.disabled = true;
      btnSave.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Guardando...';

      const examenData = {
        claseId,
        titulo,
        tiempoMinutos: tiempo,
        preguntas: currentPreviewPreguntas, // Store full questions to avoid extra reads for students, or just IDs? Full questions without 'correcta' flag? 
        estado: 'oculto',
        resultadosPublicados: false,
        creadoPor: auth.currentUser.uid,
        creadoEn: serverTimestamp()
      };

      // Strip 'correcta' flags so students can't see them if they inspect the network
      const preguntasSeguras = currentPreviewPreguntas.map(p => {
        return {
          id: p.id,
          enunciado: p.enunciado,
          tema: p.tema,
          ra: p.ra,
          opciones: p.opciones.map(o => ({ texto: o.texto })) // NO 'correcta' field
        };
      });
      examenData.preguntas = preguntasSeguras;
      
      // Store full config for grading in a subcollection or private field? 
      // Actually, since students can read examenes_test, we MUST NOT store the correct answers there.
      // We'll just grade on the server side (Cloud Function) OR grade on the client side when the teacher views results.
      // Since we don't have a backend, the teacher's browser will grade it by reading 'preguntas' collection.

      await addDoc(collection(db, "examenes_test"), examenData);
      showAdminToast('Examen lanzado con éxito', 'success');
      
      // close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalExamenTest'));
      modal.hide();

      // reload page to show in UI
      setTimeout(() => window.location.reload(), 1500);

    } catch (e) {
      console.error(e);
      showAdminToast('Error al guardar examen', 'danger');
      btnSave.disabled = false;
      btnSave.innerHTML = 'Guardar y Lanzar a la Clase';
    }
  });
}

// Fetch and render existing test exams for the class
function loadTestExamsForClass() {
  const urlParams = new URLSearchParams(window.location.search);
  const claseId = urlParams.get('id');
  if (!claseId) return;

  const tbody = document.getElementById('examenes-test-list');
  if (!tbody) return;

  const q = query(collection(db, "examenes_test"), where("claseId", "==", claseId));
  
  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(({ onSnapshot }) => {
    onSnapshot(q, (snap) => {
      if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3 text-muted">No hay exámenes test para esta clase.</td></tr>';
        return;
      }
      
      let html = '';
      snap.forEach(docSnap => {
        const d = docSnap.data();
        const stateBadge = d.estado === 'activo' ? '<span class="badge bg-success">Activo (En curso)</span>' : 
                          d.estado === 'cerrado' ? '<span class="badge bg-secondary">Cerrado</span>' : 
                          d.estado === 'oculto' ? '<span class="badge bg-warning text-dark">Oculto (Borrador)</span>' : 
                          `<span class="badge bg-warning text-dark">${d.estado}</span>`;
                          
        const dateStr = d.creadoEn ? d.creadoEn.toDate().toLocaleString() : 'Recién creado';
        
        html += `
          <tr>
            <td class="fw-bold">${d.titulo}</td>
            <td>${d.preguntas ? d.preguntas.length : 0} <span class="text-muted small">preguntas</span></td>
            <td>${d.tiempoMinutos} <span class="text-muted small">min</span></td>
            <td>${stateBadge}</td>
            <td class="small text-muted">${dateStr}</td>
            <td class="text-end">
              ${d.estado === 'oculto' ? `<button class="btn btn-sm btn-outline-success me-1" onclick="window._activarExamenTest('${docSnap.id}')" title="Publicar/Activar Examen"><i class="fas fa-eye"></i></button>` : ''}
              <a href="examen-resultados.html?id=${docSnap.id}" class="btn btn-sm btn-outline-info" title="Ver Resultados e Imprimir"><i class="fas fa-chart-bar"></i></a>
              ${d.estado === 'activo' ? `<button class="btn btn-sm btn-outline-danger ms-1" onclick="window._cerrarExamenTest('${docSnap.id}')" title="Cerrar Examen"><i class="fas fa-lock"></i></button>` : ''}
              <button class="btn btn-sm btn-outline-danger ms-1" onclick="window._deleteExamenTest('${docSnap.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    });
  });
}

// Global actions
window._activarExamenTest = async (id) => {
  if (confirm('¿Activar este examen? Los alumnos de la clase empezarán a verlo en su panel y el tiempo empezará a contar cuando entren.')) {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(doc(db, "examenes_test", id), { estado: 'activo' });
    showAdminToast('Examen activado y visible', 'success');
  }
};

window._cerrarExamenTest = async (id) => {
  if (confirm('¿Cerrar el examen? Los alumnos no podrán entregar más respuestas.')) {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(doc(db, "examenes_test", id), { estado: 'cerrado' });
    showAdminToast('Examen cerrado', 'warning');
  }
};

window._deleteExamenTest = async (id) => {
  if (confirm('¿Eliminar examen por completo? Se perderán las notas.')) {
    const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(doc(db, "examenes_test", id));
    showAdminToast('Examen eliminado', 'warning');
  }
};

