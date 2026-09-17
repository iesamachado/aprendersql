/**
 * task/js/auth.js
 * Módulo compartido por todas las páginas del área de alumnos.
 * Uso: import { initTaskPage, showToast } from './auth.js';
 *      const { user, userDoc, db } = await initTaskPage();
 */

import { initFirebase } from '../../js/shared-firebase.js';

/**
 * Inicializa una página del área de alumnos:
 * 1. Verifica Firebase
 * 2. Comprueba sesión → redirige a index.html si no hay
 * 3. Si es docente/admin → redirige al panel admin
 * 4. Renderiza navbar (avatar, nombre, puntos)
 * 5. Devuelve { user, userDoc, db }
 */
export async function initTaskPage() {
  const fb = await initFirebase();

  return new Promise((resolve, reject) => {
    fb.onAuthStateChanged(fb.auth, async (user) => {
      if (!user) {
        window.location.href = 'index.html';
        return;
      }

      try {
        const snap = await fb.getDoc(fb.doc(fb.db, 'usuarios', user.uid));

        // Usuario no registrado → redirigir al login
        if (!snap.exists()) {
          window.location.href = 'index.html';
          return;
        }

        const userDoc = snap.data();

        // Allow teachers to preview student views without being kicked out.
        // The redirection at login is handled in task/index.html.

        // Actualizar última actividad (sin await para no bloquear)
        fb.updateDoc(fb.doc(fb.db, 'usuarios', user.uid), {
          ultimaActividad: fb.serverTimestamp()
        }).catch(() => {});

        // Autoasignación de clase por email si no tiene claseId
        if (!userDoc.claseId) {
          await autoAssignClass(fb, user, userDoc);
        }

        // Renderizar navbar
        renderNavbar(user, userDoc);

        // Logout
        document.getElementById('btn-logout')?.addEventListener('click', async () => {
          await fb.signOut(fb.auth);
          window.location.href = 'index.html';
        });

        // Enlace admin para admin/docente
        const adminLink = document.getElementById('admin-link');
        if (adminLink) {
          if (['admin', 'docente'].includes(userDoc.rol)) {
            adminLink.style.display = 'block';
          } else {
            adminLink.style.display = 'none';
          }
        }

        resolve({ user, userDoc, db: fb.db, auth: fb.auth, fb });

      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Intenta autoasignar clase al alumno si su email está en alumnosEmails
 */
async function autoAssignClass(fb, user, userDoc) {
  try {
    const clasesSnap = await fb.getDocs(
      fb.query(
        fb.collection(fb.db, 'clases'),
        fb.where('alumnosEmails', 'array-contains', user.email)
      )
    );

    if (!clasesSnap.empty) {
      const claseDoc  = clasesSnap.docs[0];
      const claseId   = claseDoc.id;
      const claseData = claseDoc.data();

      await fb.updateDoc(fb.doc(fb.db, 'usuarios', user.uid), { claseId });
      userDoc.claseId = claseId;

      const nuevosUids = claseData.alumnosIds || [];
      if (!nuevosUids.includes(user.uid)) {
        nuevosUids.push(user.uid);
        await fb.updateDoc(fb.doc(fb.db, 'clases', claseId), { alumnosIds: nuevosUids });
      }
    }
  } catch (e) {
    console.warn('Error en autoasignación de clase:', e);
  }
}

/**
 * Renderiza los datos del usuario en la navbar.
 * Requiere elementos: #user-avatar, #user-name, #user-points
 */
function renderNavbar(user, userDoc) {
  const avatarEl = document.getElementById('user-avatar');
  const nameEl   = document.getElementById('user-name');
  const pointsEl = document.getElementById('user-points');

  if (avatarEl && user.photoURL) avatarEl.src = user.photoURL;
  if (nameEl) nameEl.textContent = userDoc.nombre || user.email.split('@')[0];
  if (pointsEl) pointsEl.textContent = userDoc.puntosTotal || 0;
}

/**
 * Muestra un toast en la esquina inferior derecha.
 */
export function showToast(icon, msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#4f8ef7' };
  const toast  = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${msg}</span>`;
  toast.style.borderColor = (colors[type] || colors.info) + '44';
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fadeout');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
