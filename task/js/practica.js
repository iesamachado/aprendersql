import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initTaskPage, showToast } from "./auth.js";

let db, auth, user, userDoc, ctxFb;
let examen = null;
let practicaDoc = null;
let currentQIndex = 0;

initTaskPage().then(async (ctx) => {
  db = ctx.db; auth = ctx.auth; user = ctx.user; userDoc = ctx.userDoc; ctxFb = ctx.fb;
  
  const urlParams = new URLSearchParams(window.location.search);
  const modulo = urlParams.get('modulo');
  const ra = parseInt(urlParams.get('ra'));
  
  if (!modulo || isNaN(ra)) {
    showFinished("Error: Parámetros inválidos.");
    return;
  }

  try {
    const q = query(collection(db, "preguntas"), where("modulo", "==", modulo));
    const snap = await getDocs(q);
    let allQ = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(p => p.ra === ra);
    
    if (allQ.length === 0) {
      showFinished("No hay preguntas disponibles para este bloque.");
      return;
    }
    
    // Pick up to 20 random questions
    allQ.sort(() => 0.5 - Math.random());
    const preguntas = allQ.slice(0, 20);
    
    // Configurar estado local del test
    const ordenOpciones = {};
    preguntas.forEach(p => {
      const optIndices = p.opciones.map((_, i) => i);
      optIndices.sort(() => Math.random() - 0.5);
      ordenOpciones[p.id] = optIndices;
    });
    
    practicaDoc = {
      ordenPreguntas: Array.from({length: preguntas.length}, (_, i) => i),
      ordenOpciones: ordenOpciones,
      respuestas: {},
      entregadoEn: false
    };
    
    examen = {
      titulo: `Práctica RA${ra}`,
      modulo: modulo,
      ra: ra,
      preguntas: preguntas
    };
    
    document.getElementById('ex-title').innerText = examen.titulo;
    document.getElementById('ex-student').innerText = user.displayName;
    document.getElementById('timer').innerText = "Práctica";
    document.getElementById('timer').nextElementSibling.innerText = "Modo";
    
    renderNav();
    showQuestion(0);
    
    document.getElementById('loading-ui').classList.add('d-none');
    document.getElementById('exam-ui').style.setProperty('display', 'flex', 'important');
    
  } catch(e) {
    console.error(e);
    showFinished("Error cargando preguntas: " + e.message);
  }
});

function renderNav() {
  const nav = document.getElementById('q-nav');
  let html = '';
  practicaDoc.ordenPreguntas.forEach((origIdx, renderIdx) => {
    const qId = examen.preguntas[origIdx].id;
    const isAns = practicaDoc.respuestas[qId] !== undefined;
    html += `<div class="q-btn ${isAns ? 'answered' : ''}" id="nav-btn-${renderIdx}" onclick="window.showQuestion(${renderIdx})">${renderIdx + 1}</div>`;
  });
  nav.innerHTML = html;
  updateCounts();
}

function updateCounts() {
  const total = examen.preguntas.length;
  const ans = Object.keys(practicaDoc.respuestas).length;
  document.getElementById('count-ans').innerText = ans;
  document.getElementById('count-pend').innerText = total - ans;
  document.getElementById('q-total-num').innerText = total;
}

window.showQuestion = (renderIdx) => {
  if (renderIdx < 0 || renderIdx >= examen.preguntas.length) return;
  
  document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`nav-btn-${renderIdx}`).classList.add('active');
  
  currentQIndex = renderIdx;
  document.getElementById('q-current-num').innerText = renderIdx + 1;
  
  const origIdx = practicaDoc.ordenPreguntas[renderIdx];
  const q = examen.preguntas[origIdx];
  
  document.getElementById('q-tema-badge').innerText = `Tema ${q.ra || '?'}`;
  document.getElementById('q-text').innerText = q.enunciado;
  
  const optsHtml = practicaDoc.ordenOpciones[q.id].map(optOrigIdx => {
    const texto = q.opciones[optOrigIdx].texto;
    const isChecked = practicaDoc.respuestas[q.id] === optOrigIdx ? 'checked' : '';
    const selClass = isChecked ? 'selected' : '';
    return `
      <label class="opt-label ${selClass}" onclick="window.toggleOption('${q.id}', ${optOrigIdx}, this, event)">
        <input type="radio" name="current_q_opt" class="d-none" value="${optOrigIdx}" ${isChecked}>
        <span>${texto}</span>
      </label>
    `;
  }).join('');
  
  document.getElementById('q-options').innerHTML = optsHtml;
  
  document.getElementById('btn-prev').disabled = renderIdx === 0;
  document.getElementById('btn-next').disabled = renderIdx === examen.preguntas.length - 1;
};

window.toggleOption = (qId, origOptIdx, labelEl, event) => {
  event.preventDefault(); 
  if (practicaDoc.respuestas[qId] === origOptIdx) {
    delete practicaDoc.respuestas[qId];
    document.querySelectorAll('.opt-label').forEach(l => l.classList.remove('selected'));
    const radio = labelEl.querySelector('input');
    if (radio) radio.checked = false;
    document.getElementById(`nav-btn-${currentQIndex}`).classList.remove('answered');
  } else {
    practicaDoc.respuestas[qId] = origOptIdx;
    document.querySelectorAll('.opt-label').forEach(l => l.classList.remove('selected'));
    labelEl.classList.add('selected');
    const radio = labelEl.querySelector('input');
    if (radio) radio.checked = true;
    document.getElementById(`nav-btn-${currentQIndex}`).classList.add('answered');
  }
  updateCounts();
};

document.getElementById('btn-prev').addEventListener('click', () => window.showQuestion(currentQIndex - 1));
document.getElementById('btn-next').addEventListener('click', () => window.showQuestion(currentQIndex + 1));

document.getElementById('btn-entregar').addEventListener('click', () => { 
  if(!practicaDoc) return; 
  const ans = Object.keys(practicaDoc.respuestas).length;
  const total = examen.preguntas.length;
  if (ans < total) {
    if(!confirm(`Te faltan ${total - ans} preguntas por responder. ¿Seguro que quieres entregar ya?`)) return;
  } else {
    if(!confirm('¿Seguro que quieres terminar el test de práctica?')) return;
  }
  entregarExamen();
});

function entregarExamen() {
  document.getElementById('exam-ui').style.setProperty('display', 'none', 'important');
  document.getElementById('btn-entregar').style.display = 'none';
  practicaDoc.entregadoEn = true;
  showFinished();
}

function showFinished(msgOverride) {
  document.getElementById('exam-ui').style.setProperty('display', 'none', 'important');
  document.getElementById('btn-entregar').style.display = 'none';
  document.getElementById('loading-ui').classList.add('d-none');
  const endUi = document.getElementById('finished-ui');
  endUi.classList.remove('d-none');
  
  if (msgOverride) {
    endUi.querySelector('p').innerText = msgOverride;
    return;
  }
  
  // Calcular nota localmente
  let cRight = 0;
  let cWrong = 0;
  let cBlank = 0;
  
  let reviewHtml = '';
  
  examen.preguntas.forEach((q, idx) => {
    const studentAnsIdx = practicaDoc.respuestas[q.id];
    let correctOrigIdx = -1;
    q.opciones.forEach((op, oIdx) => {
      if(op.correcta) correctOrigIdx = oIdx;
    });
    
    const isCorrect = studentAnsIdx === correctOrigIdx;
    const noAnswer = studentAnsIdx === undefined;
    
    if (noAnswer) cBlank++;
    else if (isCorrect) cRight++;
    else cWrong++;
    
    let headerColor = isCorrect ? 'text-success' : (noAnswer ? 'text-warning' : 'text-danger');
    let headerIcon = isCorrect ? 'fa-check' : (noAnswer ? 'fa-minus' : 'fa-times');
    let blankBadge = noAnswer ? '<span class="badge bg-warning text-dark ms-2"><i class="fas fa-ban me-1"></i>En blanco</span>' : '';
    
    reviewHtml += `<div class="card bg-dark border-secondary mb-4">
      <div class="card-header border-secondary ${headerColor}">
        <i class="fas ${headerIcon} me-2"></i><strong>Pregunta ${idx + 1}</strong>${blankBadge}: ${q.enunciado}
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
  
  const aciertosNetos = Math.max(0, cRight - (cWrong / 3));
  const nota = (aciertosNetos / examen.preguntas.length) * 10;
  
  document.getElementById('grade-container').classList.remove('d-none');
  document.getElementById('final-grade').innerText = nota.toFixed(2);
  document.getElementById('final-aciertos').innerText = `Tu nota de práctica`;
  
  document.getElementById('stats-summary').style.setProperty('display', 'flex', 'important');
  document.getElementById('stat-correct').innerText = cRight;
  document.getElementById('stat-incorrect').innerText = cWrong;
  document.getElementById('stat-blank').innerText = cBlank;
  
  const reviewContainer = document.getElementById('review-container');
  const reviewList = document.getElementById('review-list');
  reviewContainer.classList.remove('d-none');
  reviewList.innerHTML = reviewHtml;
  
  // Procesar medallas y XP
  procesarGamificacion(nota);
}

async function procesarGamificacion(nota) {
  if (!user || !userDoc || !ctxFb) return;
  const testKey = `${examen.modulo}_${examen.ra}`;
  const practicasRealizadas = userDoc.practicasRealizadas || [];
  
  let xpGanado = 2; // participation / failing grade
  if (nota >= 5) {
    if (!practicasRealizadas.includes(testKey)) {
      xpGanado = 5; // pass first time
      if (nota >= 9) {
          xpGanado += 5; // excellent bonus
      }
      practicasRealizadas.push(testKey);
    } else {
      xpGanado = 3; // repetition with passing grade
    }
  }
  
  const nuevosPts = (userDoc.puntosTotal || 0) + xpGanado;
  const repasosCount = (userDoc.repasosCount || 0) + 1;
  let updateData = { 
    puntosTotal: nuevosPts, 
    practicasRealizadas: practicasRealizadas,
    repasosCount: repasosCount 
  };
  
  const userLogros = userDoc.logros || [];
  let logrosNuevos = [];
  
  const checkAdd = (id) => {
    if (!userLogros.some(l => l.id === id)) {
      const med = window.MEDALLAS_CATALOGO?.find(m => m.id === id);
      if (med) {
        userLogros.push({ id: med.id, name: med.name, desc: med.desc, icon: med.icon, ts: new Date().toISOString() });
        logrosNuevos.push(med);
      }
    }
  };

  if (repasosCount >= 1) checkAdd('repaso_test');
  if (repasosCount >= 5) checkAdd('repaso_5');
  if (repasosCount >= 10) checkAdd('repaso_10');
  if (repasosCount >= 25) checkAdd('repaso_25');

  if (logrosNuevos.length > 0) {
    updateData.logros = userLogros;
  }
  
  try {
    await ctxFb.updateDoc(ctxFb.doc(db, 'usuarios', user.uid), updateData);
    userDoc.puntosTotal = nuevosPts;
    userDoc.practicasRealizadas = practicasRealizadas;
    userDoc.logros = userLogros;
    userDoc.repasosCount = repasosCount;
    
    const headerPts = document.getElementById('user-points');
    if (headerPts) headerPts.innerText = nuevosPts;
    
    if (logrosNuevos.length > 0) {
       // Show toast for the first new medal
       const l = logrosNuevos[0];
       showToast(l.icon, `¡Logro desbloqueado! ${l.name} (+${xpGanado} XP)`, 'success');
       // If multiple, show extra toast or just let them discover in profile
       if (logrosNuevos.length > 1) {
           setTimeout(() => showToast('🏅', `¡Has desbloqueado ${logrosNuevos.length} logros nuevos!`, 'success'), 3000);
       }
    } else {
       showToast('⭐', `+${xpGanado} XP por práctica de repaso`, 'success');
    }
  } catch(e) {
    console.error("Error updating gamification", e);
  }

  // Guardar el intento SIEMPRE para que el profesor lo vea
  try {
    const examData = {
      tandaId: `Repaso RA ${examen.ra}`,
      fecha: new Date().toISOString(),
      respuestas: {},
      puntuacion: nota * 10,
      puntosMaximos: 100
    };
    
    examen.preguntas.forEach(q => {
      const isCorrect = practicaDoc.respuestas[q.id] !== undefined && q.opciones[practicaDoc.respuestas[q.id]]?.correcta;
      const respuestaMarcada = practicaDoc.respuestas[q.id] !== undefined ? q.opciones[practicaDoc.respuestas[q.id]]?.texto : 'En blanco';
      examData.respuestas[q.id] = { 
        isCorrect, 
        puntos: isCorrect ? 10 : 0, 
        query: `Respuesta: ${respuestaMarcada}`,
        enunciado: q.enunciado 
      };
    });
    
    await ctxFb.setDoc(ctxFb.doc(db, 'usuarios', user.uid, 'examenes', `practica_${Date.now()}`), examData);
  } catch(e) {
    console.error("Error saving attempt", e);
  }
}
