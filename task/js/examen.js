import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initTaskPage, showToast } from "./auth.js";

let db, auth, user, userDoc;
let examen = null;
let respuestaDoc = null;
let respuestaRef = null;

let currentQIndex = 0; // Index in the shuffled array
let timerInterval = null;

initTaskPage().then(async (ctx) => {
  db = ctx.db; auth = ctx.auth; user = ctx.user; userDoc = ctx.userDoc;
  
  const urlParams = new URLSearchParams(window.location.search);
  const exId = urlParams.get('id');
  if (!exId) {
    showFinished("Error: No se ha especificado el examen.");
    return;
  }

  // Escuchar el estado del examen (para saber si el profe lo cierra en vivo)
  onSnapshot(doc(db, "examenes_test", exId), async (snap) => {
    if (!snap.exists()) {
      showFinished("El examen no existe.");
      return;
    }
    examen = { id: snap.id, ...snap.data() };
    document.getElementById('ex-title').innerText = examen.titulo;
    document.getElementById('ex-student').innerText = user.displayName;

    // Load existing participation first
    if (!respuestaDoc) {
      respuestaRef = doc(db, "respuestas_test", `${exId}_${user.uid}`);
      const rSnap = await getDoc(respuestaRef);
      if (rSnap.exists()) {
        respuestaDoc = rSnap.data();
      }
    }

    if (examen.estado !== 'activo') {
      if (!respuestaDoc) {
        showFinished("El examen ha finalizado y no llegaste a participar.");
      } else {
        stopExamAndShowResults();
      }
      return;
    }
    
    // Solo inicializar si es la primera vez que carga y el examen está activo
    if (!respuestaDoc) {
      await initStudentState(exId);
      startTimer();
      renderNav();
      showQuestion(0);
      
      document.getElementById('loading-ui').classList.add('d-none');
      document.getElementById('exam-ui').style.setProperty('display', 'flex', 'important');
    } else if (!respuestaDoc.entregadoEn && !timerInterval) {
      // Re-start if they reload while active
      startTimer();
      renderNav();
      showQuestion(0);
      
      document.getElementById('loading-ui').classList.add('d-none');
      document.getElementById('exam-ui').style.setProperty('display', 'flex', 'important');
    }
    
    // Si el docente publica resultados en vivo
    if (examen.resultadosPublicados && respuestaDoc?.entregadoEn) {
      showFinished();
    }
  });
});

async function initStudentState(exId) {
  respuestaRef = doc(db, "respuestas_test", `${exId}_${user.uid}`);
  const snap = await getDoc(respuestaRef);
  
  if (snap.exists()) {
    respuestaDoc = snap.data();
    if (respuestaDoc.entregadoEn) {
      showFinished(); // Ya entregó
      throw new Error("Ya entregado");
    }
  } else {
    // Generar orden aleatorio de preguntas
    const indices = Array.from({length: examen.preguntas.length}, (_, i) => i);
    indices.sort(() => Math.random() - 0.5);
    
    // Generar orden de opciones para cada pregunta
    const ordenOpciones = {};
    examen.preguntas.forEach(p => {
      const optIndices = [0,1,2,3];
      optIndices.sort(() => Math.random() - 0.5);
      ordenOpciones[p.id] = optIndices;
    });

    respuestaDoc = {
      examenId: exId,
      uid: user.uid,
      claseId: examen.claseId,
      ordenPreguntas: indices,
      ordenOpciones: ordenOpciones,
      respuestas: {},
      empezadoEn: serverTimestamp()
    };
    await setDoc(respuestaRef, respuestaDoc);
  }
}

function startTimer() {
  // El tiempo límite lo calculamos desde que el PROFESOR lanzó el examen (creadoEn)
  // o si no está disponible, un fallback. Mejor desde que el profe lo creó para que todos acaben a la vez.
  const inicioMs = examen.creadoEn ? examen.creadoEn.toMillis() : Date.now();
  const finMs = inicioMs + (examen.tiempoMinutos * 60 * 1000);

  timerInterval = setInterval(() => {
    const ahora = Date.now();
    const rest = finMs - ahora;
    
    if (rest <= 0) {
      clearInterval(timerInterval);
      document.getElementById('timer').innerText = "00:00";
      entregarExamen();
      return;
    }

    const m = Math.floor(rest / 60000);
    const s = Math.floor((rest % 60000) / 1000);
    const el = document.getElementById('timer');
    el.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    
    if (rest < 300000) { // menos de 5 min
      el.classList.add('danger');
    }
  }, 1000);
}

function renderNav() {
  const nav = document.getElementById('q-nav');
  let html = '';
  respuestaDoc.ordenPreguntas.forEach((origIdx, renderIdx) => {
    const qId = examen.preguntas[origIdx].id;
    const isAns = respuestaDoc.respuestas[qId] !== undefined;
    html += `<div class="q-btn ${isAns ? 'answered' : ''}" id="nav-btn-${renderIdx}" onclick="window.showQuestion(${renderIdx})">${renderIdx + 1}</div>`;
  });
  nav.innerHTML = html;
  updateCounts();
}

function updateCounts() {
  const total = examen.preguntas.length;
  const ans = Object.keys(respuestaDoc.respuestas).length;
  document.getElementById('count-ans').innerText = ans;
  document.getElementById('count-pend').innerText = total - ans;
  document.getElementById('q-total-num').innerText = total;
}

window.showQuestion = (renderIdx) => {
  if (renderIdx < 0 || renderIdx >= examen.preguntas.length) return;
  
  // Actualizar UI botones nav
  document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`nav-btn-${renderIdx}`).classList.add('active');
  
  currentQIndex = renderIdx;
  document.getElementById('q-current-num').innerText = renderIdx + 1;
  
  const origIdx = respuestaDoc.ordenPreguntas[renderIdx];
  const q = examen.preguntas[origIdx];
  
  document.getElementById('q-tema-badge').innerText = `Tema ${q.tema}`;
  document.getElementById('q-text').innerText = q.enunciado;
  
  // Render opciones en el orden aleatorio guardado
  const optsHtml = respuestaDoc.ordenOpciones[q.id].map(optOrigIdx => {
    const texto = q.opciones[optOrigIdx].texto;
    const isChecked = respuestaDoc.respuestas[q.id] === optOrigIdx ? 'checked' : '';
    const selClass = isChecked ? 'selected' : '';
    return `
      <label class="opt-label ${selClass}">
        <input type="radio" name="current_q_opt" class="d-none" value="${optOrigIdx}" ${isChecked} onchange="window.selectOption('${q.id}', ${optOrigIdx})">
        <span>${texto}</span>
      </label>
    `;
  }).join('');
  
  document.getElementById('q-options').innerHTML = optsHtml;
  
  // Botones prev/next
  document.getElementById('btn-prev').disabled = renderIdx === 0;
  document.getElementById('btn-next').disabled = renderIdx === examen.preguntas.length - 1;
};

window.selectOption = async (qId, origOptIdx) => {
  respuestaDoc.respuestas[qId] = origOptIdx;
  
  // Update UI immediately
  const labels = document.querySelectorAll('.opt-label');
  labels.forEach(l => l.classList.remove('selected'));
  const checked = document.querySelector(`input[value="${origOptIdx}"]`);
  if(checked) checked.parentElement.classList.add('selected');
  
  document.getElementById(`nav-btn-${currentQIndex}`).classList.add('answered');
  updateCounts();
  
  // Guardar en Firestore en background
  try {
    await updateDoc(respuestaRef, {
      [`respuestas.${qId}`]: origOptIdx
    });
  } catch (e) {
    console.error("Error guardando respuesta", e);
    showToast('error', 'Error de conexión. Se guardará cuando vuelva.');
  }
};

document.getElementById('btn-prev').addEventListener('click', () => window.showQuestion(currentQIndex - 1));
document.getElementById('btn-next').addEventListener('click', () => window.showQuestion(currentQIndex + 1));

document.getElementById('btn-entregar').addEventListener('click', () => { if(!respuestaDoc) return; 
  const ans = Object.keys(respuestaDoc.respuestas).length;
  const total = examen.preguntas.length;
  if (ans < total) {
    if(!confirm(`Te faltan ${total - ans} preguntas por responder. ¿Seguro que quieres entregar ya?`)) return;
  } else {
    if(!confirm('¿Seguro que quieres entregar el examen? No podrás cambiar las respuestas.')) return;
  }
  entregarExamen();
});

async function entregarExamen() {
  if (timerInterval) clearInterval(timerInterval);
  document.getElementById('exam-ui').style.setProperty('display', 'none', 'important');
  document.getElementById('btn-entregar').style.display = 'none';
  document.getElementById('loading-ui').classList.remove('d-none');
  
  try {
    await updateDoc(respuestaRef, {
      entregadoEn: serverTimestamp()
    });
    respuestaDoc.entregadoEn = true;
    showFinished();
  } catch(e) {
    console.error(e);
    alert('Error al entregar. Comprueba tu conexión.');
    document.getElementById('exam-ui').style.setProperty('display', 'flex', 'important');
    document.getElementById('loading-ui').classList.add('d-none');
  }
}

function stopExamAndShowResults() {
  if (timerInterval) clearInterval(timerInterval);
  if (!respuestaDoc?.entregadoEn && respuestaRef) {
    // Auto-entregar si el profe lo cierra y el alumno estaba a medias
    updateDoc(respuestaRef, { entregadoEn: serverTimestamp() }).catch(console.error);
  }
  showFinished("El examen ha finalizado.");
}

async function showFinished(msgOverride) {
  if (timerInterval) clearInterval(timerInterval);
  document.getElementById('exam-ui').style.setProperty('display', 'none', 'important');
  document.getElementById('btn-entregar').style.display = 'none';
  document.getElementById('loading-ui').classList.add('d-none');
  const endUi = document.getElementById('finished-ui');
  endUi.classList.remove('d-none');
  
  if (msgOverride) {
    endUi.querySelector('p').innerText = msgOverride;
  }
  
  // Si el profe ya ha publicado las notas, las mostramos
  if (examen.resultadosPublicados && respuestaDoc) {
    // El frontend alumno no tiene las correctas, las tiene que calcular pidiendo un Cloud Function o el admin_side.
    // COMO NO TENEMOS CLOUD FUNCTIONS, y el alumno NO TIENE permisos para leer `preguntas/`,
    // El profe tiene que calcular la nota y escribirla en `respuestas_test/{id}.nota`
    // Vamos a escuchar la nota en el onSnapshot (ya estamos suscritos arriba? no, a examen).
    const docSnap = await getDoc(respuestaRef);
    const data = docSnap.data();
    if (data.nota !== undefined) {
      document.getElementById('grade-container').classList.remove('d-none');
      document.getElementById('final-grade').innerText = parseFloat(data.nota).toFixed(2);
      document.getElementById('final-aciertos').innerText = `Calificación oficial`;
    } else {
      document.getElementById('grade-container').classList.remove('d-none');
      document.getElementById('final-grade').innerText = '...';
      document.getElementById('final-aciertos').innerText = `El profesor está calculando las notas.`;
    }

    if (examen.correcciones && data.respuestas) {
      const reviewContainer = document.getElementById('review-container');
      const reviewList = document.getElementById('review-list');
      reviewContainer.classList.remove('d-none');
      
      let reviewHtml = '';
      
      examen.preguntas.forEach((q, idx) => {
        const studentAnsIdx = data.respuestas[q.id];
        const correctOrigIdx = examen.correcciones[q.id];
        const isCorrect = studentAnsIdx === correctOrigIdx;
        const noAnswer = studentAnsIdx === undefined;
        
        let headerColor = isCorrect ? 'text-success' : (noAnswer ? 'text-warning' : 'text-danger');
        let headerIcon = isCorrect ? 'fa-check' : (noAnswer ? 'fa-minus' : 'fa-times');
        
        reviewHtml += `<div class="card bg-dark border-secondary mb-4">
          <div class="card-header border-secondary ${headerColor}">
            <i class="fas ${headerIcon} me-2"></i><strong>Pregunta ${idx + 1}:</strong> ${q.enunciado}
          </div>
          <div class="card-body py-2">`;
          
        q.opciones.forEach((opt, optIdx) => {
           let badge = '';
           let textClass = 'text-secondary';
           if (optIdx === correctOrigIdx) {
             badge = '<span class="badge bg-success ms-2">Correcta</span>';
             textClass = 'text-success fw-bold';
           } else if (optIdx === studentAnsIdx) {
             badge = '<span class="badge bg-danger ms-2">Tu respuesta</span>';
             textClass = 'text-danger fw-bold';
           }
           reviewHtml += `<div class="mb-2 ${textClass}"><i class="fas fa-circle ms-2 me-2" style="font-size:8px;"></i> ${opt.texto} ${badge}</div>`;
        });
        
        reviewHtml += `</div></div>`;
      });
      
      reviewList.innerHTML = reviewHtml;
    }
  }
}
