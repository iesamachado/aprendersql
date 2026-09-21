/**
 * admin/js/shared.js
 * Módulo compartido por todas las páginas del panel admin.
 * - initAdminPage(roles) → verifica auth + renderiza sidebar
 * - showAdminToast(icon, msg, type)
 * - getBadgeForDB(bd)
 */

import { initFirebase } from '../../js/shared-firebase.js';

// ── Navegación del sidebar ──────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'General',
    items: [
      { icon: 'fa-chart-line',         label: 'Dashboard',   href: 'dashboard.html' },
      { icon: 'fa-chalkboard-teacher', label: 'Mis Clases',  href: 'clases.html'   },
    ]
  },
  {
    label: 'Administración',
    adminOnly: true,
    items: [
      { icon: 'fa-user-tie', label: 'Docentes',   href: 'docentes.html',   adminOnly: true },
    ]
  },
  {
    label: 'Currículum',
    items: [
      { icon: 'fa-dumbbell',  label: 'Ejercicios',         href: 'ejercicios.html' },
      { icon: 'fa-map-signs', label: 'Roadmap Curricular', href: 'roadmap.html'    },
      { icon: 'fa-balance-scale', label: 'Criterios Evaluación', href: 'criterios.html' },
      { icon: 'fa-list-ol', label: 'Banco Test', href: 'banco-preguntas.html' }
    ]
  },

];

// ── Render sidebar ──────────────────────────────────────────
export function renderAdminSidebar(user, userDoc) {
  const aside = document.getElementById('admin-sidebar');
  if (!aside) return;

  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  const isAdmin = userDoc?.rol === 'admin';

  let navHTML = '';
  for (const section of NAV_SECTIONS) {
    if (section.adminOnly && !isAdmin) continue;
    if (section.label) {
      navHTML += `<div class="nav-label">${section.label}</div>`;
    }
    for (const item of section.items) {
      if (item.adminOnly && !isAdmin) continue;
      const active = currentPage === item.href ? 'active' : '';
      navHTML += `
        <a href="${item.href}" class="admin-nav-item ${active}">
          <i class="fas ${item.icon}" style="width:16px"></i> ${item.label}
        </a>`;
    }
  }

  aside.innerHTML = `
    <div class="sidebar-brand">
      <div class="icon">🛡️</div>
      <div>
        <div style="font-weight:700">Admin Panel</div>
        <div style="font-size:0.65rem;color:#64748b">AprenderSQL</div>
      </div>
    </div>
    <nav class="admin-nav">${navHTML}</nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <img src="${user?.photoURL || ''}" alt="avatar"
             style="width:36px;height:36px;border-radius:50%;object-fit:cover">
        <div class="user-info">
          <div class="name">${user?.displayName || user?.email || 'Admin'}</div>
          <div class="email">${user?.email || ''}</div>
        </div>
      </div>
      <button class="btn-logout-admin" id="btn-admin-logout">
        <i class="fas fa-sign-out-alt"></i> Cerrar sesión
      </button>
    </div>
  `;

  document.getElementById('btn-admin-logout')?.addEventListener('click', async () => {
    const { signOut, auth } = window._fb;
    await signOut(auth);
    window.location.href = '../index.html';
  });
}

// ── initAdminPage ───────────────────────────────────────────
export async function initAdminPage(roles = ['admin', 'docente']) {
  const fb = await initFirebase();

  return new Promise((resolve, reject) => {
    fb.onAuthStateChanged(fb.auth, async (user) => {
      if (!user) { window.location.href = 'index.html'; return; }
      try {
        const snap = await fb.getDoc(fb.doc(fb.db, 'usuarios', user.uid));
        if (!snap.exists()) { window.location.href = 'index.html'; return; }

        const userDoc = snap.data();
        if (!roles.includes(userDoc.rol)) {
          window.location.href = '../task/clases.html'; return;
        }

        renderAdminSidebar(user, userDoc);
        resolve({ user, userDoc, db: fb.db, auth: fb.auth, fb });
      } catch (e) { reject(e); }
    });
  });
}

// ── showAdminToast ──────────────────────────────────────────
export function showAdminToast(icon, msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }

  const colorMap = { success: 'success', error: 'danger', warning: 'warning', info: 'dark' };
  const toastEl  = document.createElement('div');
  toastEl.className = `toast align-items-center text-white bg-${colorMap[type] || 'dark'} border-0 mb-2`;
  toastEl.setAttribute('role', 'alert');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${icon} ${msg}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(toastEl);

  if (window.bootstrap?.Toast) {
    const t = new bootstrap.Toast(toastEl, { delay: 3500 });
    t.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  } else {
    toastEl.classList.add('show');
    setTimeout(() => { toastEl.classList.remove('show'); setTimeout(() => toastEl.remove(), 300); }, 3500);
  }
}

// ── getBadgeForDB ───────────────────────────────────────────
export function getBadgeForDB(bd) {
  const badges = {
    'arepazo':    { color: 'bg-warning text-dark',                      icon: '🍽️', label: 'Arepazo'    },
    'nba':        { color: 'bg-info text-dark',                         icon: '🏀', label: 'NBA'        },
    'mmorpg':     { color: 'bg-danger text-white',                      icon: '⚔️', label: 'MMORPG'     },
    'dungeon':    { color: 'bg-dark text-white border border-secondary', icon: '📺', label: 'Dungeon'    },
    'baloncesto': { color: 'bg-primary text-white',                     icon: '🏀', label: 'Baloncesto' },
    'cosmere':    { color: 'bg-secondary text-white',                   icon: '🌌', label: 'Cosmere'    },
    'futbol':     { color: 'bg-success text-white',                     icon: '⚽', label: 'Blue Lock'  },
    'refugio':    { color: 'bg-success text-dark',                      icon: '☢️', label: 'Refugio'    },
    'heroes':     { color: 'bg-primary text-white',                     icon: '🦸‍♂️', label: 'Heroes'   },
    'hogwarts':   { color: 'bg-warning text-dark',                      icon: '🏰', label: 'Hogwarts'   },
    'arkham':     { color: 'bg-dark text-white border border-danger',   icon: '🦇', label: 'Arkham'     },
    'dnd':        { color: 'bg-danger text-white',                      icon: '🎲', label: 'D&D'        },
  };
  const b = badges[bd] || { color: 'bg-secondary text-white', icon: '📁', label: bd };
  return `<span class="badge ${b.color} mb-2">${b.icon} ${b.label}</span>`;
}
