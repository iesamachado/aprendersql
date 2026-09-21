import { initAdminPage, showAdminToast } from './shared.js';
import { initGradebook } from './gradebook.js';

const { db, fb } = await initAdminPage();

const claseId = new URLSearchParams(window.location.search).get('id');
if (!claseId) window.location.href = 'clases.html';

let claseActual = null;
let currentBloquesActivos = [];
let currentExamenesActivos = [];
let currentTandasModo = {};
let currentTandasIds = [];
let claseCurriculum = null;

await loadClase();

// Exponer funciones globales para onclick
window._syncPendingStudents = syncPendingStudents;
window._addAlumnoToClass = addAlumnoToClass;
window._removeFromClass = removeFromClass;
window._saveBloques = saveBloques;
window._saveTandas = saveTandas;
window._verResultados = verResultados;

window._openClassroomSyncModal = async () => {
  const token = localStorage.getItem('gclassroom_token');
  if (!token) {
    showAdminToast('⚠️', 'Falta autorización. Cierra sesión y entra con Google para dar permisos a Classroom.', 'warning');
    return;
  }
  
  const modalEl = document.getElementById('classroom-sync-modal');
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  modal.show();

  const coursesList = document.getElementById('classroom-sync-courses-list');
  coursesList.innerHTML = '<div class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin"></i> Cargando tus cursos...</div>';
  document.getElementById('classroom-sync-options').style.display = 'none';
  document.getElementById('btn-execute-sync').style.display = 'none';
  document.getElementById('classroom-sync-status').style.display = 'none';

  try {
    const res = await fetch('https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Token expirado. Vuelve a iniciar sesión.');
    const data = await res.json();
    
    if (!data.courses || data.courses.length === 0) {
      coursesList.innerHTML = '<div class="text-muted p-2">No se encontraron cursos activos.</div>';
      return;
    }

    let html = '';
    data.courses.forEach(c => {
      html += `
        <label class="list-group-item bg-dark border-secondary text-white d-flex align-items-center gap-2" style="cursor:pointer">
          <input class="form-check-input" type="radio" name="classroom_course" value="${c.id}" onchange="window._selectClassroomCourse()">
          <div>
            <div>${c.name}</div>
            <div class="text-muted small">${c.section || ''}</div>
          </div>
        </label>
      `;
    });
    coursesList.innerHTML = html;
  } catch (e) {
    coursesList.innerHTML = `<div class="text-danger p-2">Error: ${e.message}</div>`;
  }
};

window._selectClassroomCourse = () => {
  document.getElementById('classroom-sync-options').style.display = 'block';
  document.getElementById('btn-execute-sync').style.display = 'block';
};

window._executeClassroomSync = async () => {
  const token = localStorage.getItem('gclassroom_token');
  const courseRadio = document.querySelector('input[name="classroom_course"]:checked');
  if (!courseRadio || !token) return;
  const courseId = courseRadio.value;
  const policy = document.getElementById('classroom-sync-policy').value;
  
  // Guardar el curso vinculado si no estaba
  if (claseActual.classroomCourseId !== courseId) {
    try {
      await fb.updateDoc(fb.doc(db, 'clases', claseId), { classroomCourseId: courseId });
      claseActual.classroomCourseId = courseId;
    } catch(e) { console.error(e); }
  }
  
  const statusDiv = document.getElementById('classroom-sync-status');
  statusDiv.style.display = 'block';
  statusDiv.className = 'alert alert-info mt-3';
  statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Sincronizando notas...';

  try {
    if (!currentTandasIds || currentTandasIds.length === 0) {
       statusDiv.className = 'alert alert-warning mt-3';
       statusDiv.innerHTML = 'No hay tandas asignadas para sincronizar.';
       return;
    }
    
    let processed = 0;
    
    // Obtenemos los alumnos de Classroom para mapear email -> studentId
    const studentsRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/students`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (studentsRes.status === 401) {
      statusDiv.style.display = 'none';
      if (confirm('La sesión de Google Classroom ha caducado. ¿Quieres renovarla ahora?')) {
        await window._renewClassroomToken();
      }
      return;
    }
    const studentsData = await studentsRes.json();
    const studentsMap = {};
    if (studentsData.students) {
      studentsData.students.forEach(s => {
        if (s.profile && s.profile.emailAddress) {
          studentsMap[s.profile.emailAddress.toLowerCase()] = s.userId;
        }
      });
    }

    // 1. Conseguir CourseWorks y Topics de Classroom
    const [cwRes, topRes] = await Promise.all([
      fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/topics`, { headers: { Authorization: `Bearer ${token}` } })
    ]);
    const cwData = await cwRes.json();
    const topData = await topRes.json();
    
    const existingCW = cwData.courseWork || [];
    const existingTopics = topData.topic || [];

    for (const tId of currentTandasIds) {
      const title = `AprenderSQL: Ejercicios ${tId}`;
      let cwId = null;
      
      const found = existingCW.find(c => c.title === title);
      if (found) {
        cwId = found.id;
      } else {
        // Encontrar/crear el Topic
        const bloqueData = window.BLOQUES.find(b => String(b.id) === String(tId));
        const topicName = getTopicNameForClassroom(bloqueData);
        let topicId = null;
        
        const foundTopic = existingTopics.find(t => t.name.toLowerCase() === topicName.toLowerCase());
        if (foundTopic) {
          topicId = foundTopic.topicId;
        } else {
          try {
            const createTopRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/topics`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: topicName })
            });
            const createTopData = await createTopRes.json();
            if (createTopData.topicId) {
              topicId = createTopData.topicId;
              existingTopics.push({ name: topicName, topicId: topicId });
            }
          } catch(e) {}
        }

        // Crear CourseWork
        const bodyData = {
          title: title,
          description: `Tanda de ejercicios generada desde AprenderSQL.`,
          state: 'PUBLISHED',
          workType: 'ASSIGNMENT',
          maxPoints: 10
        };
        if (topicId) bodyData.topicId = topicId;

        const createRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyData)
        });
        const createData = await createRes.json();
        if (createData.id) cwId = createData.id;
      }

      if (!cwId) continue;

      // 2. Volcar notas
      const q = fb.query(fb.collection(db, 'intentos_tandas'), fb.where('claseId', '==', claseId), fb.where('tandaId', '==', tId));
      const snap = await fb.getDocs(q);
      const userGrades = {};
      
      snap.forEach(doc => {
        const d = doc.data();
        if (!userGrades[d.email]) userGrades[d.email] = [];
        userGrades[d.email].push(d);
      });

      for (const [email, intentos] of Object.entries(userGrades)) {
        const studentId = studentsMap[email.toLowerCase()];
        if (!studentId) continue;

        let notaToSync = 0;
        if (policy === 'best') {
           notaToSync = Math.max(...intentos.map(i => i.nota || 0));
        } else if (policy === 'first') {
           const sorted = intentos.sort((a,b) => (a.fecha?.seconds || 0) - (b.fecha?.seconds || 0));
           notaToSync = sorted[0].nota || 0;
        } else {
           const sorted = intentos.sort((a,b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
           notaToSync = sorted[0].nota || 0;
        }

        // Obtener la submission del alumno
        const subRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${cwId}/studentSubmissions?userId=${studentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const subData = await subRes.json();
        if (subData.studentSubmissions && subData.studentSubmissions.length > 0) {
          const subId = subData.studentSubmissions[0].id;
          // Actualizar nota (solo acepta updateMask)
          await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${cwId}/studentSubmissions/${subId}?updateMask=assignedGrade,draftGrade`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedGrade: parseFloat(notaToSync.toFixed(2)), draftGrade: parseFloat(notaToSync.toFixed(2)) })
          });
        }
      }
      processed++;
    }

    statusDiv.className = 'alert alert-success mt-3';
    statusDiv.innerHTML = `<i class="fas fa-check-circle me-2"></i>Sincronizadas ${processed} tandas de ejercicios en Classroom.`;
  } catch (e) {
    statusDiv.className = 'alert alert-danger mt-3';
    statusDiv.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>Error: ${e.message}`;
  }
};

function getTopicNameForClassroom(bloque) {
  if (!bloque) return 'General';
  let numStr = null;
  
  // Buscar a qué tema pertenece (Tema X.Y o a través de temaRef)
  const match = bloque.nombre.match(/^Tema\s+(\d+)/i);
  if (match) {
    numStr = match[1];
  } else if (bloque.temaRef) {
    const parent = window.BLOQUES.find(b => b.id === bloque.temaRef);
    if (parent) {
      const pMatch = parent.nombre.match(/^Tema\s+(\d+)/i);
      if (pMatch) numStr = pMatch[1];
    }
  }

  if (numStr) {
    const isSegundo = claseActual && claseActual.modulo === '0377';
    if (!isSegundo) { // 1º ASIR
      if (numStr === '1') return 'U1: Introducción a los SGBD';
      if (numStr === '2') return 'U2: Diseño Lógico y Conceptual';
      if (numStr === '3') return 'U3: Modelo Físico de Datos (DDL)';
      if (numStr === '4') return 'U4: Consultas en SQL (DML)';
      if (numStr === '5') return 'U5: Programación y Modificación de Datos';
      return `U${numStr}: Bases de Datos`;
    } else { // 2º ASIR
      if (numStr === '1') return 'U1: Instalación de SGBD';
      if (numStr === '2') return 'U2: Configuración y Arquitectura';
      if (numStr === '3') return 'U3: Seguridad y Control de Acceso';
      if (numStr === '4') return 'U4: Automatización Avanzada';
      if (numStr === '5') return 'U5: Optimización de Rendimiento';
      if (numStr === '6') return 'U6: Alta Disponibilidad';
      return `U${numStr}: Administración SGBD`;
    }
  }
  
  if (bloque.tipo === 'tarea') return 'Proyectos y Tareas';
  return 'Ejercicios Prácticos';
}

window._publishTaskToClassroom = async (bloqueId, bloqueNombre, bloqueDesc, tipo) => {
  const token = localStorage.getItem('gclassroom_token');
  if (!token) {
    showAdminToast('⚠️', 'Inicia sesión con Google para usar Classroom.', 'warning');
    return;
  }
  
  let courseId = claseActual.classroomCourseId;
  
  if (!courseId) {
    try {
      const res = await fetch('https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.courses && data.courses.length > 0) {
        let text = 'Para vincular esta clase de AprenderSQL, elige el número del curso de Classroom:\n\n';
        data.courses.forEach((c, index) => {
          text += `${index + 1}. ${c.name} ${c.section ? '('+c.section+')' : ''}\n`;
        });
        const selection = prompt(text);
        if (!selection) return;
        const idx = parseInt(selection) - 1;
        if (!isNaN(idx) && data.courses[idx]) {
          courseId = data.courses[idx].id;
          await fb.updateDoc(fb.doc(db, 'clases', claseId), { classroomCourseId: courseId });
          claseActual.classroomCourseId = courseId;
          showAdminToast('✅', 'Clase vinculada correctamente.', 'success');
        } else {
          return;
        }
      } else {
        alert("No tienes cursos activos en Classroom.");
        return;
      }
    } catch(e) {
      showAdminToast('❌', 'Error obteniendo cursos: ' + e.message, 'error');
      return;
    }
  }

  // Extraer el nombre del Tema para agruparlo en Classroom
  const bloqueData = window.BLOQUES.find(b => String(b.id) === String(bloqueId)) || { nombre: bloqueNombre, tipo: tipo };
  const topicName = getTopicNameForClassroom(bloqueData);
  let topicId = null;

  try {
    // Obtener topics existentes
    const topRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/topics`, { headers: { Authorization: `Bearer ${token}` } });
    const topData = await topRes.json();
    const existingTopics = topData.topic || [];
    const foundTopic = existingTopics.find(t => t.name.toLowerCase() === topicName.toLowerCase());
    
    if (foundTopic) {
      topicId = foundTopic.topicId;
    } else {
      // Crear nuevo topic
      const createTopRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/topics`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: topicName })
      });
      const createTopData = await createTopRes.json();
      if (createTopData.topicId) topicId = createTopData.topicId;
    }
  } catch (e) {
    console.warn("No se pudo manejar el topic de classroom", e);
  }

  try {
    const isTeoria = tipo === 'teoria';
    const endpoint = isTeoria 
      ? `https://classroom.googleapis.com/v1/courses/${courseId}/courseWorkMaterials`
      : `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`;

    const bodyData = {
      title: `AprenderSQL: ${bloqueNombre}`,
      description: `${bloqueDesc}\n\nEnlace directo a las instrucciones detalladas en la plataforma.`,
      state: 'PUBLISHED',
      materials: [{ link: { url: `https://iesamachado.github.io/aprendersql/task/teoria.html?bloqueId=${bloqueId}&claseId=${claseId}` } }]
    };

    if (topicId) {
      bodyData.topicId = topicId;
    }

    if (!isTeoria) {
      bodyData.workType = 'ASSIGNMENT';
      bodyData.maxPoints = 100;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });
    
    if (res.status === 401) {
      if (confirm('La sesión de Google Classroom ha caducado. ¿Quieres renovarla ahora?')) {
        await window._renewClassroomToken();
      }
      return;
    }
    if (!res.ok) throw new Error("No se pudo crear. Verifica tus permisos de Classroom.");
    showAdminToast('✅', `Publicado en Classroom bajo el tema "${topicName || 'General'}"`, 'success');
  } catch (e) {
    showAdminToast('❌', e.message, 'error');
  }
};

async function loadClase() {
  const snap = await fb.getDoc(fb.doc(db, 'clases', claseId));
  if (!snap.exists()) {
    showAdminToast('❌', 'Clase no encontrada', 'error');
    setTimeout(() => window.location.href = 'clases.html', 1500);
    return;
  }
  
  claseActual = snap.data();
  claseActual.id = claseId;
  currentBloquesActivos = claseActual.bloquesActivos || [];
  currentExamenesActivos = claseActual.examenesActivos || [];
  currentTandasModo = claseActual.tandasModo || {};
  currentTandasIds = claseActual.tandasIds || [];
  
  claseCurriculum = claseActual.curriculum;
  if (!claseCurriculum) {
    try {
      const tmplSnap = await fb.getDoc(fb.doc(db, 'usuarios', claseActual.docenteId, 'curriculum', 'plantilla'));
      if (tmplSnap.exists()) claseCurriculum = tmplSnap.data();
    } catch(e) { console.error("Could not load curriculum template", e); }
  }

  document.getElementById('clase-detalle-titulo').textContent = claseActual.nombre;
  document.getElementById('clase-detalle-id').value = claseId;

  await renderAlumnos(claseActual);
  renderBloques(claseActual);
  renderExamenes(claseActual);
  renderGrid(claseActual);
  
  // Iniciar Cuaderno de Notas
  await initGradebook(claseActual, claseCurriculum, currentTandasIds, currentTandasModo, currentBloquesActivos, currentExamenesActivos);
}

function isTaskMapped(taskId) {
  if (!claseCurriculum) return false;
  
  const mods = ['0372', '0377'];
  for (const mod of mods) {
    if (claseCurriculum[mod] && claseCurriculum[mod].mapeo) {
      for (const ra in claseCurriculum[mod].mapeo) {
        for (const c in claseCurriculum[mod].mapeo[ra]) {
          if (claseCurriculum[mod].mapeo[ra][c].includes(taskId)) return true;
        }
      }
    }
  }
  return false;
}

async function renderAlumnos(clase) {
  const container = document.getElementById('clase-detalle-alumnos');
  container.innerHTML = '';

  const registradosIds = clase.alumnosIds || [];
  if (registradosIds.length === 0 && (clase.alumnosEmails || []).length === 0) {
    container.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay alumnos en esta clase.</td></tr>';
    return;
  }

  const registradosEmails = [];
  
  for (const uid of registradosIds) {
    const alumnoSnap = await fb.getDoc(fb.doc(db, 'usuarios', uid));
    if (alumnoSnap.exists()) {
      const alumno = alumnoSnap.data();
      registradosEmails.push(alumno.email);
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="d-flex align-items-center gap-2">
            ${alumno.foto ? `<img src="${alumno.foto}" style="width:28px;height:28px;border-radius:50%">` : '<div style="width:28px;height:28px;border-radius:50%;background:#1e293b;display:flex;align-items:center;justify-content:center">👤</div>'}
            <div>
              <div class="small fw-bold text-info">${alumno.nombre || '—'}</div>
              <div class="text-muted" style="font-size:0.7rem">${alumno.email}</div>
            </div>
          </div>
        </td>
        <td><span class="badge bg-warning text-dark">⭐ ${alumno.puntosTotal || 0}</span></td>
        <td class="small"><span class="badge bg-success">${alumno.ejerciciosOK || 0} ej. superados</span></td>
        <td>
          <button class="btn btn-sm btn-outline-danger" onclick="window._removeFromClass('${uid}')"><i class="fas fa-times"></i></button>
        </td>
      `;
      container.appendChild(tr);
    }
  }

  const pendingEmails = (clase.alumnosEmails || []).filter(e => !registradosEmails.includes(e));
  if (pendingEmails.length > 0) {
    const pendingRow = document.createElement('tr');
    pendingRow.innerHTML = `<td colspan="4" class="bg-dark text-muted small fw-bold py-2"><i class="fas fa-envelope me-2"></i>Pendientes de registro:</td>`;
    container.appendChild(pendingRow);
    
    pendingEmails.forEach(email => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="4">
          <div class="d-flex align-items-center gap-2">
            <div style="width:28px;height:28px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.7rem"><i class="fas fa-envelope"></i></div>
            <div class="text-muted small">${email} <span class="badge bg-secondary ms-2">Pendiente</span></div>
          </div>
        </td>
      `;
      container.appendChild(tr);
    });
  }
}

function renderBloques(clase) {
  const containerTeoria = document.getElementById('bloques-toggles-container');
  const containerTareas = document.getElementById('tareas-toggles-container');
  
  containerTeoria.innerHTML = '';
  containerTareas.innerHTML = '';
  
  if (typeof window.BLOQUES === 'undefined') {
    containerTeoria.innerHTML = '<div class="text-danger p-3">Error: data de bloques no cargada.</div>';
    return;
  }

  const mod = clase.modulo || '0372';
  let modBloques = window.BLOQUES.filter(b => b.modulo === mod);
  if (mod === '0377') {
    const bloques1o = window.BLOQUES.filter(b => b.modulo === '0372');
    modBloques = modBloques.concat(bloques1o);
  }
  
  if (modBloques.length === 0) {
    containerTeoria.innerHTML = '<div class="text-muted p-3">No hay bloques definidos para este módulo.</div>';
    return;
  }

  const theoryByRa = {};
  const tasksByRa = {};

  modBloques.forEach(bloque => {
    if (bloque.tipo !== 'teoria' && bloque.tipo !== 'tarea') return;
    let ra = bloque.ra || '0';
    if (bloque.modulo !== mod) {
      ra = `REPASO_${ra}`;
    }
    const targetMap = bloque.tipo === 'tarea' ? tasksByRa : theoryByRa;
    if (!targetMap[ra]) targetMap[ra] = [];
    targetMap[ra].push(bloque);
  });

  const buildListHTML = (groupedData, container, isTaskMode) => {
    if (Object.keys(groupedData).length === 0) {
      container.innerHTML = '<div class="text-muted p-3">No hay contenido configurado.</div>';
      return;
    }

    const ras = Object.keys(groupedData).sort((a,b) => {
      const isRepasoA = a.startsWith('REPASO');
      const isRepasoB = b.startsWith('REPASO');
      if (isRepasoA && !isRepasoB) return 1;
      if (!isRepasoA && isRepasoB) return -1;
      
      const numA = parseInt(a.replace('REPASO_', ''));
      const numB = parseInt(b.replace('REPASO_', ''));
      return numA - numB;
    });
    let html = '<div class="list-group list-group-flush w-100 px-2">';
    
    ras.forEach(ra => {
      const isRepasoGroup = ra.startsWith('REPASO');
      const displayRa = isRepasoGroup ? ra.replace('REPASO_', '') : ra;
      
      const headerHtml = isRepasoGroup
        ? `<h6 class="text-warning border-bottom border-warning pb-2 mb-3 mt-4" style="opacity: 0.8;"><i class="fas fa-history me-2"></i>Repaso (1º ASIR) — RA ${displayRa}</h6>`
        : `<h6 class="text-info border-bottom border-secondary pb-2 mb-3"><i class="fas fa-layer-group me-2"></i>RA ${displayRa}</h6>`;

      html += `
        <div class="mb-4">
          ${headerHtml}
          <div class="list-group">
      `;
      
      groupedData[ra].forEach(bloque => {
        const isRepaso = isRepasoGroup;
        const isActive = currentBloquesActivos.includes(bloque.id);
        const disabled = !bloque.implementado ? 'disabled' : '';
        const badgeColor = bloque.implementado ? (isRepaso ? 'warning' : 'success') : 'secondary';
        const badgeText = bloque.implementado ? 'Implementado' : 'En desarrollo';
        
        const btnClass = isTaskMode ? 'btn-outline-warning' : 'btn-outline-info';
        const btnText = isTaskMode ? 'Ver Tarea' : 'Ver Teoría';
        
        const activeClass = isActive 
           ? (isRepaso ? 'bg-warning bg-opacity-10 border-warning' : 'bg-primary bg-opacity-10 border-primary')
           : (isRepaso ? 'bg-black border-dark' : 'bg-dark border-secondary');
        
        const titleFontSize = isRepaso ? 'font-size: 0.95rem;' : '';
        
        let rubricaHtml = '';
        if (bloque.rubricaDocente && bloque.rubricaDocente.length > 0) {
          rubricaHtml = `
            <div class="mt-2 pt-2 border-top border-secondary small" style="border-color: rgba(255,255,255,0.1)!important;">
              <strong class="text-warning"><i class="fas fa-clipboard-check me-1"></i> Rúbrica sugerida (Sólo visible para ti):</strong>
              <ul class="mb-0 ps-3 mt-1 text-muted" style="list-style-type: square;">
                ${bloque.rubricaDocente.map(r => `<li>${r}</li>`).join('')}
              </ul>
            </div>
          `;
        }
        
        const previewBtn = bloque.implementado ? 
          `<a href="../task/teoria.html?bloqueId=${bloque.id}&claseId=${claseId}" class="btn btn-sm ${btnClass} text-nowrap">
             <i class="fas fa-eye"></i> ${btnText}
           </a>` : '';
           
        const classroomBtn = (bloque.implementado) ? 
          `<button class="btn btn-sm btn-outline-success text-nowrap ms-2" onclick="window._publishTaskToClassroom('${bloque.id}', '${bloque.nombre.replace(/'/g, "\\'")}', '${bloque.desc.replace(/'/g, "\\'")}', '${bloque.tipo}')" title="Publicar en Classroom">
             <i class="fab fa-google"></i> Publicar
           </button>` : '';

        const mappedWarning = (bloque.implementado && bloque.tipo === 'tarea' && !isTaskMapped(`bloque:${bloque.id}`))
          ? `<i class="fas fa-exclamation-triangle text-warning ms-2" title="Esta tarea no tiene criterios BOJA asignados en tu Mapeo Curricular"></i>`
          : '';

        html += `
          <div class="list-group-item ${activeClass} ${disabled} border-start border-4 mb-2 rounded d-flex flex-column flex-md-row justify-content-between align-items-md-center p-3" style="transition: all 0.2s;">
            <div class="flex-grow-1 pe-3 mb-3 mb-md-0" ${isRepaso ? 'style="font-size: 0.85rem; opacity: 0.85;"' : ''}>
              <div class="d-flex align-items-center gap-2 mb-1">
                ${isRepaso ? '<span class="badge bg-secondary text-light" style="font-size:0.6rem">REPASO</span>' : ''}
                <span class="badge bg-${badgeColor}" style="font-size:0.7rem">${badgeText}</span>
                <h6 class="mb-0 text-white" style="${titleFontSize}">${bloque.nombre}${mappedWarning}</h6>
              </div>
              <div class="text-muted ${isRepaso ? '' : 'small'}">${bloque.desc}</div>
              ${rubricaHtml}
            </div>
            <div class="d-flex align-items-center gap-2 ${isRepaso ? 'opacity-75' : ''}">
              ${previewBtn}
              ${classroomBtn}
              <div class="form-check form-switch m-0 fs-4 ms-2">
                <input class="form-check-input block-toggle-input" type="checkbox" role="switch" 
                       value="${bloque.id}" ${isActive ? 'checked' : ''} ${disabled}
                       style="cursor:pointer;" onchange="
                         const item = this.closest('.list-group-item');
                         if(this.checked) {
                           item.classList.remove('bg-dark', 'border-secondary', 'bg-black', 'border-dark');
                           item.classList.add('${isRepaso ? 'bg-warning' : 'bg-primary'}', 'bg-opacity-10', '${isRepaso ? 'border-warning' : 'border-primary'}');
                         } else {
                           item.classList.remove('bg-primary', 'bg-warning', 'bg-opacity-10', 'border-primary', 'border-warning');
                           item.classList.add('${isRepaso ? 'bg-black' : 'bg-dark'}', '${isRepaso ? 'border-dark' : 'border-secondary'}');
                         }
                       ">
              </div>
            </div>
          </div>
        `;
      });
      html += `</div></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  };

  buildListHTML(theoryByRa, containerTeoria, false);
  buildListHTML(tasksByRa, containerTareas, true);
}

async function saveBloques() {
  const checkboxes = document.querySelectorAll('.block-toggle-input:checked');
  const nuevosActivos = Array.from(checkboxes).map(cb => parseInt(cb.value));
  
  try {
    await fb.updateDoc(fb.doc(db, 'clases', claseId), { bloquesActivos: nuevosActivos });
    currentBloquesActivos = nuevosActivos;
    showAdminToast('✅', 'Bloques actualizados correctamente');
  } catch (e) {
    showAdminToast('❌', 'Error al guardar bloques: ' + e.message, 'error');
  }
}

async function addAlumnoToClass() {
  const email = document.getElementById('clase-modal-add-email').value.trim().toLowerCase();
  if (!email) return;

  try {
    const claseRef = fb.doc(db, 'clases', claseId);
    const q = fb.query(fb.collection(db, 'usuarios'), fb.where('email', '==', email));
    const snap = await fb.getDocs(q);

    if (!snap.empty) {
      const uid = snap.docs[0].id;
      if (!claseActual.alumnosIds?.includes(uid)) {
        const nuevosIds = [...(claseActual.alumnosIds || []), uid];
        await fb.updateDoc(claseRef, { alumnosIds: nuevosIds });
        await fb.updateDoc(fb.doc(db, 'usuarios', uid), { claseId });
        showAdminToast('✅', 'Alumno vinculado a la clase');
      }
    } else {
      if (!claseActual.alumnosEmails?.includes(email)) {
        const nuevosEmails = [...(claseActual.alumnosEmails || []), email];
        await fb.updateDoc(claseRef, { alumnosEmails: nuevosEmails });
        showAdminToast('📧', 'Invitación enviada por email');
      }
    }
    document.getElementById('clase-modal-add-email').value = '';
    loadClase();
  } catch (e) {
    showAdminToast('❌', e.message, 'error');
  }
}

async function removeFromClass(uid) {
  if (!confirm('¿Quitar alumno de esta clase? Sus intentos no se borrarán, pero perderá acceso a la clase.')) return;
  try {
    const nuevosIds = (claseActual.alumnosIds || []).filter(id => id !== uid);
    await fb.updateDoc(fb.doc(db, 'clases', claseId), { alumnosIds: nuevosIds });
    await fb.updateDoc(fb.doc(db, 'usuarios', uid), { claseId: fb.deleteField() });
    showAdminToast('✅', 'Alumno quitado');
    loadClase();
  } catch (e) {
    showAdminToast('❌', e.message, 'error');
  }
}

async function syncPendingStudents() {
  if (!claseActual || !(claseActual.alumnosEmails?.length)) {
    showAdminToast('ℹ️', 'No hay correos pendientes', 'info');
    return;
  }
  
  showAdminToast('⏳', 'Buscando usuarios...', 'info');
  let count = 0;
  try {
    const registrados = claseActual.alumnosIds || [];
    for (const email of claseActual.alumnosEmails) {
      const q = fb.query(fb.collection(db, 'usuarios'), fb.where('email', '==', email));
      const snap = await fb.getDocs(q);
      if (!snap.empty) {
        const uid = snap.docs[0].id;
        if (!registrados.includes(uid)) {
          registrados.push(uid);
          await fb.updateDoc(fb.doc(db, 'usuarios', uid), { claseId });
          count++;
        }
      }
    }
    
    if (count > 0) {
      await fb.updateDoc(fb.doc(db, 'clases', claseId), { alumnosIds: registrados });
      showAdminToast('✅', `${count} alumnos vinculados`);
      loadClase();
    } else {
      showAdminToast('ℹ️', 'Ningún alumno nuevo ha accedido', 'info');
    }
  } catch (e) {
    showAdminToast('❌', e.message, 'error');
  }
}


function renderGrid(clase) {
  const thead = document.getElementById('grid-header');
  const tbody = document.getElementById('grid-body');
  if (!thead || !tbody) return;

  const bdsDisponibles = new Set();
  const matrizEjercicios = {};
  
  for (let i = 1; i <= 6; i++) {
    matrizEjercicios[i] = {};
  }

  if (window.EJERCICIOS) {
    window.EJERCICIOS.forEach(ex => {
      if (!ex.bloque_id || !ex.bd) return;
      bdsDisponibles.add(ex.bd);
      if (!matrizEjercicios[ex.bloque_id]) matrizEjercicios[ex.bloque_id] = {};
      if (!matrizEjercicios[ex.bloque_id][ex.bd]) matrizEjercicios[ex.bloque_id][ex.bd] = 0;
      matrizEjercicios[ex.bloque_id][ex.bd]++;
    });
  }

  const bds = Array.from(bdsDisponibles).sort();
  
  const bloquesMap = {};
  if (window.BLOQUES) {
    window.BLOQUES.forEach(b => {
      if (b.tipo === 'ejercicios') {
        let name = b.nombre.replace('Ejercicios: ', '');
        if (name === 'Modelo Físico (DDL)') name = 'DDL';
        bloquesMap[b.id] = `RA${b.ra}: ${name}`;
      }
    });
  }
  if (!bloquesMap[1]) bloquesMap[1] = 'RA3: DDL';
  if (!bloquesMap[2]) bloquesMap[2] = 'RA4: Consultas Básicas';
  if (!bloquesMap[3]) bloquesMap[3] = 'RA4: Consultas Avanzadas';
  if (!bloquesMap[4]) bloquesMap[4] = 'RA4: Subconsultas';
  if (!bloquesMap[5]) bloquesMap[5] = 'RA5: Modificación DML';
  if (!bloquesMap[6]) bloquesMap[6] = 'RA5: Programación SQL';

  const isRepasoGrid = clase.modulo === '0377';
  const gridTitleContainer = thead.closest('.admin-table-wrapper').querySelector('h5');
  
  if (isRepasoGrid) {
    if (gridTitleContainer) {
      gridTitleContainer.innerHTML = '<i class="fas fa-history me-2 text-warning"></i>Ejercicios de Repaso (1º ASIR)';
      gridTitleContainer.classList.remove('text-primary');
      gridTitleContainer.classList.add('text-warning');
      gridTitleContainer.style.opacity = '0.9';
    }
  } else {
    if (gridTitleContainer) {
      gridTitleContainer.innerHTML = '<i class="fas fa-tasks me-2 text-primary"></i>Asignar Tandas de Ejercicios (BD específicas)';
      gridTitleContainer.classList.remove('text-warning');
      gridTitleContainer.classList.add('text-primary');
      gridTitleContainer.style.opacity = '1';
    }
  }

  thead.innerHTML = '<th class="align-middle border-bottom border-2 text-start px-3">Bloque de Ejercicios</th>' + bds.map(bd => `<th class="align-middle border-bottom border-2">${bd.toUpperCase()}</th>`).join('');

  let tbodyHtml = '';
  for (let b = 1; b <= 6; b++) {
    const rowBgClass = isRepasoGrid ? 'bg-black opacity-75' : '';
    const nameColorClass = isRepasoGrid ? 'text-warning' : 'text-light';
    
    tbodyHtml += `<tr class="${rowBgClass} border-bottom border-secondary"><td class="fw-bold text-start text-nowrap align-middle ps-3 ${nameColorClass}" ${isRepasoGrid ? 'style="font-size:0.9rem;"' : ''}>${isRepasoGrid ? '<span class="badge bg-secondary text-light me-2" style="font-size:0.6rem">REPASO</span>' : ''}${bloquesMap[b]}</td>`;
    
    bds.forEach(bd => {
      const count = matrizEjercicios[b][bd] || 0;
      const tId = `${b}:${bd}`;
      const isActivo = currentTandasIds.includes(tId);
      const modo = currentTandasModo[tId] || 'practica';
      
      const mappedWarning = isTaskMapped(`tanda:${b}:${modo}`) 
        ? '' 
        : `<i class="fas fa-exclamation-triangle text-warning ms-1" title="Esta tanda no tiene criterios BOJA asignados en tu Mapeo Curricular para el modo ${modo}"></i>`;

      tbodyHtml += `
        <td style="min-width: 150px; padding: 0.5rem; vertical-align: top;" class="${isRepasoGrid ? 'border-dark' : ''}">
          <div class="d-flex flex-column gap-1 align-items-center">
            <div class="form-check form-switch m-0 d-flex justify-content-center w-100 align-items-center mb-1">
              <input class="form-check-input tanda-toggle" type="checkbox" data-tid="${tId}" ${isActivo ? 'checked' : ''}>
              ${mappedWarning}
            </div>
            
            <select class="form-select form-select-sm dark-input text-center w-100 tanda-modo" data-tid="${tId}" ${isActivo ? '' : 'disabled'}>
              <option value="practica" ${modo === 'practica' ? 'selected' : ''}>Práctica</option>
              <option value="examen" ${modo === 'examen' ? 'selected' : ''}>Examen</option>
            </select>
            
            ${isActivo ? `
            <button class="btn btn-sm btn-outline-info w-100 mt-1" onclick="window._verResultados('${tId}')">
              <i class="fas fa-chart-bar"></i> Ver Notas
            </button>
            <div class="d-flex gap-1 w-100 mt-1">
              <button class="btn btn-sm btn-outline-success flex-grow-1 p-1" onclick="window._publishTanda('${tId}', '${bloquesMap[b]}', '${bd}')" title="Publicar Tarea en Classroom">
                <i class="fab fa-google"></i> Pub.
              </button>
              <button class="btn btn-sm btn-outline-warning flex-grow-1 p-1" onclick="window._syncTanda('${tId}', '${bloquesMap[b]}', '${bd}')" title="Volcar Notas a Classroom">
                <i class="fas fa-sync-alt"></i> Sync
              </button>
            </div>` : ''}
            
            <div class="small text-muted mt-1 text-center" style="font-size: 0.75rem;">
              ${count > 0 ? `${count} ej.` : `<i class="fas fa-hammer"></i> En constr.`}
            </div>
          </div>
        </td>
      `;
    });
    tbodyHtml += `</tr>`;
  }
  tbody.innerHTML = tbodyHtml;

  document.querySelectorAll('.tanda-toggle').forEach(el => {
    el.addEventListener('change', (e) => {
      const select = document.querySelector(`.tanda-modo[data-tid="${e.target.dataset.tid}"]`);
      if (select) select.disabled = !e.target.checked;
    });
  });
}

async function saveTandas() {
  const toggles = document.querySelectorAll('.tanda-toggle:checked');
  const nuevosIds = [];
  const nuevosModos = {};
  
  toggles.forEach(t => {
    const tId = t.dataset.tid;
    nuevosIds.push(tId);
    const select = document.querySelector(`.tanda-modo[data-tid="${tId}"]`);
    nuevosModos[tId] = select ? select.value : 'practica';
  });
  
  try {
    await fb.updateDoc(fb.doc(db, 'clases', claseId), { 
      tandasIds: nuevosIds,
      tandasModo: nuevosModos
    });
    currentTandasIds = nuevosIds;
    currentTandasModo = nuevosModos;
    showAdminToast('✅', 'Tandas guardadas correctamente');
  } catch(e) {
    showAdminToast('❌', 'Error al guardar tandas: ' + e.message, 'error');
  }
}

async function verResultados(tId) {
  document.getElementById('resultados-tanda-title').textContent = `Resultados: ${tId}`;
  document.getElementById('resultados-tanda-body').innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin fa-2x text-primary"></i></div>';
  
  const modalEl = document.getElementById('modal-resultados');
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  modal.show();

  try {
    const modo = currentTandasModo[tId] || 'practica';
    const [bId, bd] = tId.split(':');
    const currentTandaName = `Bloque ${bId} - ${bd.toUpperCase()}`;
    
    // Obtener los ejercicios que componen esta tanda
    const ejerciciosTanda = window.EJERCICIOS.filter(e => e.bloque_id == parseInt(bId) && (e.bd === bd || e.tanda === bd));
    const ptsTotales = ejerciciosTanda.reduce((acc, e) => acc + (e.puntos || 10), 0);
    
    const registradosIds = claseActual.alumnosIds || [];
    if (registradosIds.length === 0) {
      document.getElementById('resultados-tanda-body').innerHTML = '<div class="alert alert-info">No hay alumnos en la clase.</div>';
      return;
    }

    let html = `
      <div class="table-responsive">
        <table class="table table-dark table-sm table-striped table-hover mb-0" style="vertical-align: middle;">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Progreso / Nota</th>
              <th>Detalle de Consultas</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const uid of registradosIds) {
      const snapUser = await fb.getDoc(fb.doc(db, 'usuarios', uid));
      if (!snapUser.exists()) continue;
      const alumno = snapUser.data();
      
      let nota = 0;
      let completados = 0;
      let queries = {};
      
      if (modo === 'examen') {
        const qEx = fb.query(fb.collection(db, 'usuarios', uid, 'examenes'), fb.where('tandaId', '==', currentTandaName));
        const snapEx = await fb.getDocs(qEx);
        if (!snapEx.empty) {
          const lastExam = snapEx.docs.sort((a,b) => b.data().fecha.localeCompare(a.data().fecha))[0].data();
          nota = lastExam.puntuacion || 0;
          Object.keys(lastExam.respuestas || {}).forEach(k => {
             queries[k] = lastExam.respuestas[k].sql;
             if(lastExam.respuestas[k].isCorrect) completados++;
          });
        }
      } else {
        const snapExs = await fb.getDocs(fb.collection(db, 'usuarios', uid, 'ejercicios'));
        snapExs.forEach(d => {
          const exData = d.data();
          if (exData.superado && ejerciciosTanda.find(e => e.id == d.id)) {
            completados++;
            nota += (exData.puntosObtenidos || 10);
            queries[d.id] = exData.respuesta_sql || '(Consulta no guardada)';
          }
        });
      }

      const totalEj = ejerciciosTanda.length;
      const progressPct = totalEj === 0 ? 0 : (completados / totalEj) * 100;
      const progressColor = progressPct === 100 ? 'bg-success' : (progressPct > 0 ? 'bg-warning' : 'bg-secondary');
      
      // Construir listado de SQL (oculto en un modal colapsable o simple string)
      let queriesHtml = '';
      if (completados > 0) {
        ejerciciosTanda.forEach(e => {
          if (queries[e.id]) {
             queriesHtml += `<div class="mb-2 pb-2 border-bottom border-secondary">
               <div class="small text-info fw-bold mb-1">Ej #${e.id}: ${e.titulo}</div>
               <pre class="mb-0 bg-black p-2 rounded text-light" style="font-size:0.75rem; white-space: pre-wrap;">${queries[e.id]}</pre>
             </div>`;
          }
        });
      } else {
        queriesHtml = '<span class="text-muted small">Sin actividad</span>';
      }

      html += `
        <tr>
          <td style="min-width: 150px;">
            <div class="fw-bold">${alumno.nombre || '—'}</div>
            <div class="text-secondary" style="font-size:0.7rem">${alumno.email}</div>
          </td>
          <td style="min-width: 150px;">
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="badge ${progressColor}">${completados}/${totalEj} ej.</span>
              <span class="badge bg-primary">${nota} pts</span>
            </div>
            <div class="progress" style="height: 4px;">
              <div class="progress-bar ${progressColor}" role="progressbar" style="width: ${progressPct}%"></div>
            </div>
          </td>
          <td>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#queries-${uid}-${bId}-${bd}">
              Ver Consultas <i class="fas fa-chevron-down ms-1"></i>
            </button>
            <div class="collapse mt-2" id="queries-${uid}-${bId}-${bd}">
              <div class="card card-body bg-dark border-secondary p-2">
                ${queriesHtml}
              </div>
            </div>
          </td>
        </tr>
      `;
    }
    
    html += '</tbody></table></div>';
    document.getElementById('resultados-tanda-body').innerHTML = html;
  } catch (e) {
    document.getElementById('resultados-tanda-body').innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
  }
}

window._publishTanda = async (tId, bName, bd) => {
  const token = localStorage.getItem('gclassroom_token');
  if (!token) { showAdminToast('⚠️', 'Inicia sesión con Google.', 'warning'); return; }
  
  let courseId = claseActual.classroomCourseId;
  if (!courseId) {
    showAdminToast('⚠️', 'Primero debes vincular la clase en el panel principal (Sincronizar Notas).', 'warning');
    return;
  }

  const title = `AprenderSQL: ${bName} (${bd.toUpperCase()})`;
  document.getElementById('publish-tanda-name').textContent = title;
  
  const modalEl = document.getElementById('modal-publish-date');
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  document.getElementById('publish-due-date').value = '';
  modal.show();

  const btnConfirm = document.getElementById('btn-confirm-publish');
  
  btnConfirm.onclick = async () => {
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Publicando...';

    const modo = currentTandasModo[tId] || 'practica';
    const url = `https://iesamachado.github.io/aprendersql/task/ejercicio.html?tandaId=${tId}&claseId=${claseId}&modo=${modo}`;
    
    const dueDateStr = document.getElementById('publish-due-date').value;
    let dueDate = null;
    let dueTime = null;
    if (dueDateStr) {
      const parts = dueDateStr.split('-');
      if (parts.length === 3) {
        dueDate = { year: parseInt(parts[0]), month: parseInt(parts[1]), day: parseInt(parts[2]) };
        dueTime = { hours: 23, minutes: 59, seconds: 59 };
      }
    }

    try {
      const bodyData = {
        title: title,
        description: `Tanda de ${modo} generada desde AprenderSQL.\n\nAccede a la plataforma para realizarla.`,
        state: 'PUBLISHED',
        workType: 'ASSIGNMENT',
        maxPoints: 10,
        materials: [{ link: { url: url } }]
      };
      if (dueDate) {
        bodyData.dueDate = dueDate;
        bodyData.dueTime = dueTime;
      }

      const res = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      
      if (res.status === 401) {
        if (confirm('La sesión de Google Classroom ha caducado. ¿Quieres renovarla ahora?')) {
          await window._renewClassroomToken();
        }
        return;
      }
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(`No se pudo publicar. ${errData.error?.message || res.statusText}`);
      }
      
      showAdminToast('✅', `Publicado en Classroom exitosamente.`, 'success');
      modal.hide();
    } catch(e) {
      showAdminToast('❌', e.message, 'error');
    } finally {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = '<i class="fas fa-check me-2"></i>Publicar en Classroom';
    }
  };
};

window._syncTanda = async (tId, bName, bd) => {
  const token = localStorage.getItem('gclassroom_token');
  if (!token) { showAdminToast('⚠️', 'Inicia sesión con Google.', 'warning'); return; }
  let courseId = claseActual.classroomCourseId;
  if (!courseId) { showAdminToast('⚠️', 'No hay clase vinculada.', 'warning'); return; }

  const title = `AprenderSQL: ${bName} (${bd.toUpperCase()})`;
  const modo = currentTandasModo[tId] || 'practica';
  
  try {
    showAdminToast('🔄', 'Sincronizando...', 'info');
    // Buscar la tarea en Classroom
    const cwRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, { headers: { Authorization: `Bearer ${token}` } });
    if (cwRes.status === 401) {
      if (confirm('La sesión de Google Classroom ha caducado. ¿Quieres renovarla ahora?')) {
        await window._renewClassroomToken();
      }
      return;
    }
    const cwData = await cwRes.json();
    const foundCW = (cwData.courseWork || []).find(c => c.title === title || c.title === `AprenderSQL: Ejercicios ${tId}`);
    
    if (!foundCW) {
      alert("No se ha encontrado esta tarea en Classroom. Pulsa el botón 'Pub.' primero.");
      return;
    }

    // Obtener submissions
    const subsRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${foundCW.id}/studentSubmissions`, { headers: { Authorization: `Bearer ${token}` } });
    const subsData = await subsRes.json();
    const submissions = subsData.studentSubmissions || [];

    // Mapear alumnos del classroom
    const studentsRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/students`, { headers: { Authorization: `Bearer ${token}` } });
    const studentsData = await studentsRes.json();
    const studentsMap = {};
    (studentsData.students || []).forEach(s => {
      if (s.profile && s.profile.emailAddress) studentsMap[s.profile.emailAddress.toLowerCase()] = s.userId;
    });

    const [bId, bdd] = tId.split(':');
    const ejerciciosTanda = window.EJERCICIOS.filter(e => e.bloque_id == parseInt(bId) && (e.bd === bd || e.tanda === bd));
    const maxPts = ejerciciosTanda.reduce((acc, e) => acc + (e.puntos || 10), 0);
    const registradosIds = claseActual.alumnosIds || [];
    
    let volcados = 0;

    for (const uid of registradosIds) {
      const snapUser = await fb.getDoc(fb.doc(db, 'usuarios', uid));
      if (!snapUser.exists()) continue;
      const alumno = snapUser.data();
      const cUserId = studentsMap[alumno.email.toLowerCase()];
      if (!cUserId) continue; // No está en classroom
      
      const sub = submissions.find(s => s.userId === cUserId);
      if (!sub) continue;

      let nota = 0;
      if (modo === 'examen') {
        const qEx = fb.query(fb.collection(db, 'usuarios', uid, 'examenes'), fb.where('tandaId', '==', `Bloque ${bId} - ${bd.toUpperCase()}`));
        const snapEx = await fb.getDocs(qEx);
        if (!snapEx.empty) {
          const lastExam = snapEx.docs.sort((a,b) => b.data().fecha.localeCompare(a.data().fecha))[0].data();
          nota = lastExam.puntuacion || 0;
        }
      } else {
        const snapExs = await fb.getDocs(fb.collection(db, 'usuarios', uid, 'ejercicios'));
        snapExs.forEach(d => {
          const exData = d.data();
          if (exData.superado && ejerciciosTanda.find(e => e.id == d.id)) {
            nota += (exData.puntosObtenidos || 10);
          }
        });
      }

      // Convertir nota sobre 10 a maxPoints del assignment de Classroom (100 por defecto pero pusimos 10 al publicar)
      let finalGrade = (nota / maxPts) * (foundCW.maxPoints || 10);
      if (isNaN(finalGrade)) finalGrade = 0;
      
      await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${foundCW.id}/studentSubmissions/${sub.id}?updateMask=assignedGrade,draftGrade`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedGrade: finalGrade, draftGrade: finalGrade })
      });
      volcados++;
    }
    showAdminToast('✅', `Notas volcadas con éxito para ${volcados} alumnos.`, 'success');
  } catch (e) {
    showAdminToast('❌', e.message, 'error');
  }
};

window._renewClassroomToken = async () => {
  try {
    const provider = new fb.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/classroom.courses.readonly');
    provider.addScope('https://www.googleapis.com/auth/classroom.coursework.students');
    provider.addScope('https://www.googleapis.com/auth/classroom.coursework.me');
    provider.addScope('https://www.googleapis.com/auth/classroom.topics');
    
    const result = await fb.signInWithPopup(fb.auth, provider);
    const credential = fb.GoogleAuthProvider.credentialFromResult(result);
    if (credential && credential.accessToken) {
      localStorage.setItem('gclassroom_token', credential.accessToken);
      showAdminToast('✅', 'Sesión renovada. Ya puedes reintentar la acción.', 'success');
      return true;
    }
    return false;
  } catch(e) {
    showAdminToast('❌', 'Error al renovar sesión: ' + e.message, 'error');
    return false;
  }
};

function renderExamenes(clase) {
  const container = document.getElementById('examenes-toggles-container');
  if (!claseCurriculum) {
    container.innerHTML = '<div class="col-12"><div class="alert alert-warning">No hay currículum configurado. Configura el mapeo primero.</div></div>';
    return;
  }
  
  const allMapped = new Set();
  ['0372', '0377'].forEach(mod => {
    if (claseCurriculum[mod] && claseCurriculum[mod].mapeo) {
      for (const ra in claseCurriculum[mod].mapeo) {
        for (const c in claseCurriculum[mod].mapeo[ra]) {
          claseCurriculum[mod].mapeo[ra][c].forEach(t => allMapped.add(t));
        }
      }
    }
  });

  const exams = [];
  allMapped.forEach(taskId => {
    if (taskId.startsWith('examen:')) {
      const [_, mod, ra] = taskId.split(':');
      exams.push({ id: taskId, label: `Examen Oficial RA ${ra} (${mod})` });
    }
    if (taskId.startsWith('custom_')) {
      const custom = (claseCurriculum.customTasks || []).find(t => t.id === taskId);
      exams.push({ id: taskId, label: custom ? custom.nombre : taskId });
    }
  });

  if (exams.length === 0) {
    container.innerHTML = '<div class="col-12"><div class="alert bg-dark text-muted">No hay exámenes ni tareas personalizadas en el currículum.</div></div>';
    return;
  }

  container.innerHTML = exams.map(ex => {
    const isChecked = currentExamenesActivos.includes(ex.id) ? 'checked' : '';
    return `
      <div class="col-md-6 col-lg-4">
        <div class="card bg-dark border-secondary h-100">
          <div class="card-body p-3 d-flex justify-content-between align-items-center">
            <div>
              <h6 class="mb-1 text-light">${ex.label}</h6>
              <div class="text-muted small">${ex.id.startsWith('custom_') ? 'Tarea Personalizada' : 'Examen Oficial BOJA'}</div>
            </div>
            <div class="form-check form-switch ms-3">
              <input class="form-check-input" type="checkbox" style="transform: scale(1.3);" 
                     id="chk_ex_${ex.id}" ${isChecked}>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window._saveExamenes = async function() {
  if (!currentClaseId) return;
  const btn = document.querySelector('button[onclick="window._saveExamenes()"]');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  btn.disabled = true;

  try {
    const checks = document.querySelectorAll('input[id^="chk_ex_"]');
    const nuevos = [];
    checks.forEach(chk => {
      if (chk.checked) nuevos.push(chk.id.replace('chk_ex_', ''));
    });
    
    await fb.updateDoc(fb.doc(db, 'clases', currentClaseId), { examenesActivos: nuevos });
    currentExamenesActivos = nuevos;
    showAdminToast('✅', 'Exámenes activados actualizados');
    
    // Refresh gradebook to reflect changes
    await window._refreshGradebookTasks();
  } catch(e) {
    console.error(e);
    showAdminToast('❌', 'Error al guardar', 'error');
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
};
