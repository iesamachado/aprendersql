import { initTaskPage } from './auth.js';

let user, userDoc, db, fb;

document.addEventListener('DOMContentLoaded', async () => {
  const authData = await initTaskPage();
  if (!authData) return;
  ({ user, userDoc, db, fb } = authData);

  renderMedallero();
  renderLigaHorizontal();
  renderGremioPodium();
});

function renderMedallero() {
  const grid = document.getElementById('medallero-grid');
  const countSpan = document.getElementById('medals-count');
  
  const userLogros = userDoc.logros || [];
  const catalogo = window.MEDALLAS_CATALOGO || [];
  
  const unlockedIds = new Set(userLogros.map(l => l.id));
  countSpan.textContent = `${unlockedIds.size} / ${catalogo.length}`;

  if (catalogo.length === 0) {
    grid.innerHTML = '<div class="col-12 text-center text-muted">No hay medallas configuradas.</div>';
    return;
  }

  let html = '';
  catalogo.forEach(m => {
    const isUnlocked = unlockedIds.has(m.id);
    let icon = m.icon;
    let name = m.name;
    let desc = m.desc;
    
    let borderClass = 'border-secondary opacity-75';
    let bgClass = 'bg-transparent';
    let textClass = 'text-muted';
    let filterStyle = 'filter: grayscale(1); opacity: 0.5;';
    let typeBadge = m.public ? '<span class="badge bg-secondary ms-2" style="font-size:0.6rem">Pública</span>' : '';
    let dateStr = '';

    if (isUnlocked) {
      borderClass = 'border-warning shadow-sm';
      bgClass = 'bg-dark';
      textClass = 'text-warning';
      filterStyle = '';
      typeBadge = m.public ? '' : '<span class="badge bg-danger ms-2" style="font-size:0.6rem">Oculta</span>';
      const userL = userLogros.find(l => l.id === m.id);
      dateStr = userL ? `<div class="badge bg-secondary mt-2" style="font-size:0.7rem"><i class="fas fa-calendar-alt me-1"></i>${new Date(userL.ts).toLocaleDateString()}</div>` : '';
    } else {
      // Si está bloqueada y es oculta, escondemos la info
      if (!m.public) {
        icon = '❓';
        name = 'Logro Oculto';
        desc = 'Sigue practicando para descubrir cómo desbloquear esta medalla secreta.';
        typeBadge = '<span class="badge bg-danger ms-2" style="font-size:0.6rem">Oculta</span>';
      }
    }

    html += `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="d-flex align-items-center p-3 border rounded h-100 ${borderClass} ${bgClass}" style="transition: all 0.3s;">
          <div class="fs-1 me-3" style="${filterStyle}">${icon}</div>
          <div class="flex-grow-1">
            <h6 class="mb-1 fw-bold ${textClass}">${name} ${typeBadge}</h6>
            <div class="small ${isUnlocked ? 'text-light' : 'text-muted'}">${desc}</div>
            ${dateStr}
          </div>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

// --- RENDERIZAR LIGAS (Horizontal) ---
function renderLigaHorizontal() {
  const container = document.getElementById('liga-container');
  const pts = userDoc.puntosTotal || 0;
  
  const ligas = [
    { name: 'Hierro', icon: '⚪', color: '#6c757d', pts: 0 },
    { name: 'Bronce', icon: '🥉', color: '#fd7e14', pts: 100 },
    { name: 'Plata', icon: '🥈', color: '#adb5bd', pts: 300 },
    { name: 'Oro', icon: '🥇', color: '#ffc107', pts: 600 },
    { name: 'Platino', icon: '🌟', color: '#20c997', pts: 1000 },
    { name: 'Diamante', icon: '💎', color: '#0dcaf0', pts: 1500 }
  ];
  
  let html = `<div class="d-flex justify-content-between position-relative mt-4 mb-4">`;
  html += `<div class="position-absolute top-50 start-0 end-0 translate-middle-y" style="height: 4px; background: #334155; z-index: 0;"></div>`;
  
  let currentLigaIndex = 0;
  for(let i=0; i<ligas.length; i++) {
    if (pts >= ligas[i].pts) currentLigaIndex = i;
  }
  
  ligas.forEach((liga, i) => {
    const isUnlocked = pts >= liga.pts;
    const isCurrent = (i === currentLigaIndex);
    
    html += `
      <div class="position-relative text-center" style="z-index: 1; width: 60px;">
        <div class="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-2 ${isCurrent ? 'border border-2 border-info shadow' : ''}" 
             style="width: 40px; height: 40px; background: ${isUnlocked ? 'rgba(0,0,0,0.8)' : '#1e293b'}; opacity: ${isUnlocked ? '1' : '0.4'};">
          <span class="fs-5" style="${!isUnlocked ? 'filter: grayscale(1);' : ''}">${liga.icon}</span>
        </div>
        <div class="small fw-bold" style="font-size: 0.65rem; color: ${isUnlocked ? liga.color : '#64748b'};">${liga.name}</div>
        <div class="text-secondary" style="font-size: 0.6rem;">${liga.pts}</div>
      </div>
    `;
  });
  html += `</div>`;
  
  // Progress to next
  if (currentLigaIndex < ligas.length - 1) {
    const nextL = ligas[currentLigaIndex + 1];
    const currL = ligas[currentLigaIndex];
    const pct = ((pts - currL.pts) / (nextL.pts - currL.pts)) * 100;
    html += `
      <div class="mt-4 px-2">
        <div class="d-flex justify-content-between small text-muted mb-1">
          <span>Progreso a ${nextL.name}</span>
          <span>${pts} / ${nextL.pts} pts</span>
        </div>
        <div class="progress" style="height: 8px; background: #1e293b;">
          <div class="progress-bar" style="width: ${pct}%; background-color: ${currL.color};"></div>
        </div>
      </div>
    `;
  } else {
    html += `<div class="mt-4 px-2 text-center text-info fw-bold small">¡Has alcanzado la liga máxima!</div>`;
  }
  
  container.innerHTML = html;
}

// --- RENDERIZAR GREMIOS ---
window.joinGremio = async function(nombre, icono) {
  try {
    await fb.updateDoc(fb.doc(db, 'usuarios', user.uid), { gremio: nombre, gremioIcono: icono });
    userDoc.gremio = nombre;
    userDoc.gremioIcono = icono;
    renderGremioPodium();
  } catch(e) { console.error(e); }
}
window.leaveGremio = async function() {
  if (!confirm('¿Seguro que quieres abandonar tu facción actual? Perderán tus puntos y tendrás que buscar hueco en otra.')) return;
  try {
    await fb.updateDoc(fb.doc(db, 'usuarios', user.uid), { 
      gremio: null, 
      gremioIcono: null 
    });
    userDoc.gremio = null;
    userDoc.gremioIcono = null;
    renderGremioPodium();
  } catch(e) { console.error(e); }
}

async function renderGremioPodium() {
  const container = document.getElementById('gremio-container');
  
  const snap = await fb.getDocs(fb.query(fb.collection(db, 'clases'), fb.where('alumnosIds', 'array-contains', user.uid)));
  let claseIds = [user.uid];
  if (!snap.empty) {
    claseIds = snap.docs[0].data().alumnosIds || [user.uid];
  }
  
  container.innerHTML = '<div class="text-muted"><i class="fas fa-spinner fa-spin"></i> Calculando plazas...</div>';

  const allUsers = [];
  for (let i = 0; i < claseIds.length; i += 10) {
    const chunk = claseIds.slice(i, i + 10);
    const uSnap = await fb.getDocs(fb.query(fb.collection(db, 'usuarios'), fb.where('__name__', 'in', chunk)));
    uSnap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
  }

  const maxPerGuild = Math.ceil(claseIds.length / 4);
  
  const guildMembers = {
    'La Orden del JOIN': { icon: '🛡️', color: 'primary', pts: 0, members: [] },
    'El Cártel del SELECT': { icon: '🗡️', color: 'success', pts: 0, members: [] },
    'La Hermandad del DROP': { icon: '🧙‍♂️', color: 'danger', pts: 0, members: [] },
    'Los Ninjas del WHERE': { icon: '🦂', color: 'warning', pts: 0, members: [] }
  };
  
  let totalGlobalPts = 0;
  
  allUsers.forEach(u => {
    if (claseIds.includes(u.id) && u.gremio && guildMembers[u.gremio]) {
      const uPts = u.puntosTotal || 0;
      guildMembers[u.gremio].pts += uPts;
      totalGlobalPts += uPts;
      guildMembers[u.gremio].members.push(u.displayName || u.nombre || u.email || 'Anónimo');
      
      if (!guildMembers[u.gremio].mvp || uPts > guildMembers[u.gremio].mvp.pts) {
        guildMembers[u.gremio].mvp = { name: u.displayName || u.nombre || u.email || 'Anónimo', pts: uPts };
      }
    }
  });

  if (!userDoc.gremio) {
    let html = `
      <div class="small text-light mb-3">No tienes gremio. ¡Únete a una facción!</div>
      <div class="row g-3 text-start">
    `;
    
    Object.entries(guildMembers).forEach(([name, data]) => {
      const count = data.members.length;
      const isFull = count >= maxPerGuild;
      
      const memberList = data.members.length > 0 
        ? data.members.map(m => `<li><i class="fas fa-user text-secondary me-1" style="font-size:0.6rem;"></i>${m}</li>`).join('') 
        : `<li class="text-muted fst-italic">Sin miembros</li>`;
      
      html += `
        <div class="col-12">
          <div class="card bg-dark shadow-sm h-100" style="border: 1px solid var(--bs-${data.color}); border-left: 4px solid var(--bs-${data.color}); background: rgba(255,255,255,0.02) !important;">
            <div class="card-body p-2 d-flex flex-column">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="card-title fw-bold text-${data.color} mb-0" style="font-size: 0.9rem;">
                  ${data.icon} ${name}
                </h6>
                <span class="badge bg-secondary" style="font-size: 0.7rem;">${count}/${maxPerGuild} <i class="fas fa-users"></i></span>
              </div>
              <div class="small mb-2 text-light overflow-auto flex-grow-1" style="max-height: 70px; font-size: 0.75rem;">
                <ul class="list-unstyled mb-0">${memberList}</ul>
              </div>
              <div class="d-flex gap-2 mt-auto">
                <button class="btn btn-sm btn-outline-${data.color} fw-bold flex-grow-1" 
                  onclick="joinGremio('${name}', '${data.icon}')" 
                  ${isFull ? 'disabled' : ''}>
                  ${isFull ? 'LLENO' : 'UNIRSE'}
                </button>
                <button class="btn btn-sm btn-outline-secondary px-2" onclick="window.showGremioLore('${name}')" title="Historia"><i class="fas fa-info-circle"></i></button>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    container.innerHTML = html;
    
  } else {
    // Ya tiene gremio, cargar ranking local de la clase
    const sorted = Object.entries(guildMembers).sort((a,b) => b[1].pts - a[1].pts);
    if (totalGlobalPts === 0) totalGlobalPts = 1; 
    
    let html = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="small fw-bold text-light">Perteneces a: <span class="fs-5">${userDoc.gremioIcono}</span> <span class="text-warning">${userDoc.gremio}</span></div>
        <button class="btn btn-sm btn-outline-danger" onclick="leaveGremio()" title="Abandonar Gremio"><i class="fas fa-sign-out-alt"></i></button>
      </div>
    `;
    
    html += `<div class="d-flex flex-column gap-3">`;
    sorted.forEach(([name, data], idx) => {
      const isMine = (name === userDoc.gremio);
      const pct = (data.pts / totalGlobalPts) * 100;
      const count = data.members.length;
      const plazasBadge = `<span class="badge bg-dark border border-secondary text-secondary ms-2" style="font-size:0.65rem">${count}/${maxPerGuild} <i class="fas fa-users"></i></span>`;
      
      let gapHtml = '';
      if (idx > 0) {
        const prevData = sorted[idx - 1][1];
        const ptsNeeded = prevData.pts - data.pts + 1;
        gapHtml = `<div class="text-danger mt-1" style="font-size: 0.7rem;"><i class="fas fa-arrow-up"></i> ${ptsNeeded} pts para superar a ${sorted[idx - 1][0]}</div>`;
      }
      
      let mvpHtml = '';
      if (data.mvp) {
        mvpHtml = `<div class="text-muted mt-1" style="font-size: 0.7rem;"><i class="fas fa-star text-warning"></i> MVP: <strong class="text-light">${data.mvp.name}</strong> (${data.mvp.pts})</div>`;
      }

      html += `
        <div class="p-2 rounded shadow-sm" style="background: rgba(255,255,255,0.03); border-left: 3px solid var(--bs-${data.color});">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span>
              <span class="small fw-bold ${isMine ? 'text-light' : 'text-secondary'}">${idx === 0 && data.pts > 0 ? '👑 ' : ''}${data.icon} ${name} ${isMine ? '(Tú)' : ''}</span>
              <i class="fas fa-info-circle text-secondary ms-1 cursor-pointer" onclick="window.showGremioLore('${name}')" title="Leer historia" style="cursor:pointer"></i>
              ${plazasBadge}
            </span>
            <span class="text-info small fw-bold">${data.pts} pts</span>
          </div>
          <div class="progress" style="height: 10px; background: #1e293b; border-radius: 4px;">
            <div class="progress-bar bg-${data.color} ${idx === 0 ? 'progress-bar-striped progress-bar-animated' : ''}" style="width: ${pct}%; border-radius: 4px;"></div>
          </div>
          <div class="d-flex justify-content-between">
            ${mvpHtml}
            ${gapHtml}
          </div>
        </div>
      `;
    });
    html += `</div>`;
    container.innerHTML = html;
  }
}

window.showGremioLore = function(nombre) {
  const lores = {
    'La Orden del JOIN': {
      icon: '🛡️',
      lema: "Nuestra fuerza reside en la unión.",
      desc: "Paladines de la integridad referencial. Creen que ningún dato debe estar aislado. Su misión sagrada es enlazar tablas separadas para revelar la verdad completa que yace en la base de datos. Maestros de la clave primaria y foránea, defienden que juntos, los datos son invencibles."
    },
    'El Cártel del SELECT': {
      icon: '🗡️',
      lema: "Si existe, nosotros lo encontramos.",
      desc: "Mercenarios de la extracción de datos. Son rápidos, letales y muy precisos. Nadie extrae información de forma más eficiente que ellos. Se especializan en llevarse solo las columnas y datos exactos que necesitan sin dejar rastro, dominando el arte de las proyecciones complejas."
    },
    'La Hermandad del DROP': {
      icon: '🧙‍♂️',
      lema: "De las cenizas, construimos el futuro.",
      desc: "Temidos y respetados a partes iguales. Magos del caos que creen que para mantener una base de datos limpia, a veces hay que destruirla y empezar de cero. Son los señores del DDL, aquellos que no tiemblan al alterar esquemas de producción. Un solo error suyo puede ser fatal."
    },
    'Los Ninjas del WHERE': {
      icon: '🦂',
      lema: "Silenciosos, exactos e infalibles.",
      desc: "Asesinos en la sombra especializados en el filtrado de datos. Capaces de aislar un único registro de entre millones en milisegundos. Sus armas favoritas son los operadores lógicos. Cuando un dato intenta esconderse, un ninja siempre lo encuentra con un predicado letal."
    }
  };
  
  const data = lores[nombre];
  if (!data) return;
  
  document.getElementById('lore-title').textContent = nombre;
  document.getElementById('lore-icon').textContent = data.icon;
  document.getElementById('lore-lema').textContent = `"${data.lema}"`;
  document.getElementById('lore-desc').textContent = data.desc;
  
  new bootstrap.Modal(document.getElementById('modal-gremio-lore')).show();
}
