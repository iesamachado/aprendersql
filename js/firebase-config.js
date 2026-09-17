/**
 * firebase-config.js
 * Configuración de Firebase para el módulo de ejercicios interactivos.
 *
 * ⚠️ INSTRUCCIONES DE CONFIGURACIÓN:
 * 1. Ve a https://console.firebase.google.com/
 * 2. Crea un nuevo proyecto (ej: "aprender-sql-iesamachado")
 * 3. En el proyecto: Configuración → Aplicaciones web → Añadir app
 * 4. Copia el objeto firebaseConfig y pégalo abajo
 * 5. En Authentication: Activar proveedor "Google"
 * 6. En Firestore: Crear base de datos en modo producción
 * 7. En Firestore Rules, usar las reglas del archivo firestore.rules
 */

// ============================================================
// ⬇️ REEMPLAZA ESTO CON TU CONFIGURACIÓN DE FIREBASE ⬇️
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCff9ntNz9GPAlV0SbaQOMb8LJQUkrFCwE",
  authDomain: "aprendersql-3b872.firebaseapp.com",
  projectId: "aprendersql-3b872",
  storageBucket: "aprendersql-3b872.firebasestorage.app",
  messagingSenderId: "1037070098455",
  appId: "1:1037070098455:web:9e7b276ec16ff5e558fc52"
};
// ============================================================

// ============================================================
// CONFIGURACIÓN DE LA APLICACIÓN (no tocar)
// ============================================================
const APP_CONFIG = {
  // Email del superadministrador
  ADMIN_EMAIL: 'bernatcosta@iesamachado.org',

  // Dominio autorizado (opcional - si quieres restringir a emails del centro)
  // Pon null para permitir cualquier cuenta Google
  DOMINIO_AUTORIZADO: null, // Ej: 'iesamachado.org'

  // Puntos base por ejercicio completado en primer intento
  BONUS_PRIMER_INTENTO: 1.5, // Multiplicador de puntos si resuelve a la primera

  // Máximo de intentos antes de desbloquear la solución
  MAX_INTENTOS_SIN_PISTA: 3,

  // Versión del esquema de Firestore
  SCHEMA_VERSION: 1
};

// Exportar
if (typeof module !== 'undefined') {
  module.exports = { FIREBASE_CONFIG, APP_CONFIG };
}
