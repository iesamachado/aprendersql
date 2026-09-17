/**
 * shared-firebase.js
 * Inicialización de Firebase compartida por todas las páginas de AprenderSQL.
 * Exporta: initFirebase(), checkAuth()
 */

'use strict';

/**
 * Inicializa Firebase y devuelve { db, auth, ...helpers }
 * Solo inicializa una vez (si ya está en window._fb, lo reutiliza).
 */
export async function initFirebase() {
  if (window._fb && window._fb.db) return window._fb;

  if (!window.FIREBASE_CONFIG || window.FIREBASE_CONFIG.apiKey.includes('TU-API-KEY')) {
    throw new Error('Firebase no configurado. Edita js/firebase-config.js con tus credenciales.');
  }

  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const {
    getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
  } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const {
    getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, increment,
    collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit
  } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const app  = initializeApp(window.FIREBASE_CONFIG);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  window._fb = {
    auth, db,
    doc, getDoc, setDoc, updateDoc, deleteDoc, increment,
    collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit,
    signOut, GoogleAuthProvider, signInWithPopup, onAuthStateChanged,
  };

  return window._fb;
}

/**
 * Comprueba si hay sesión activa.
 * Devuelve una promesa que resuelve con { user, userDoc } si todo va bien.
 * Si no hay sesión o el rol no está en `rolesPermitidos`, redirige.
 *
 * @param {string[]} rolesPermitidos - roles que tienen acceso (ej: ['admin','docente'])
 * @param {string}   redirectUrl     - URL a la que redirigir si no hay acceso
 */
export function checkAuth(rolesPermitidos = [], redirectUrl = '../task/index.html') {
  return new Promise(async (resolve, reject) => {
    try {
      const { auth, onAuthStateChanged, doc, getDoc, db } = await initFirebase();

      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          window.location.href = redirectUrl;
          return;
        }

        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (!snap.exists()) {
          window.location.href = redirectUrl;
          return;
        }

        const userDoc = snap.data();

        if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(userDoc.rol)) {
          // Si es alumno intentando acceder al admin, lo manda a task/
          if (['admin','docente'].includes(userDoc.rol)) {
            window.location.href = '../admin/dashboard.html';
          } else {
            window.location.href = '../task/clases.html';
          }
          return;
        }

        resolve({ user, userDoc, db, auth });
      });
    } catch (e) {
      reject(e);
    }
  });
}
