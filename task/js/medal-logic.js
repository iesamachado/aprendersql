// Archivo auxiliar para no saturar ejercicio.js
export function evaluarLogros(isSuccess, queryTxt, ex, userDoc, windowContext) {
  let nuevosLogros = [];
  const userLogros = userDoc.logros || [];
  const hasLogro = (id) => userLogros.some(l => l.id === id);
  const checkAddLogro = (id) => {
    if (!hasLogro(id)) {
      const cat = windowContext.MEDALLAS_CATALOGO.find(m => m.id === id);
      if (cat) {
        const l = { id: cat.id, name: cat.name, desc: cat.desc, icon: cat.icon, ts: new Date().toISOString() };
        userLogros.push(l);
        nuevosLogros.push(l);
      }
    }
  };

  const Q = queryTxt.toUpperCase();
  const exsCount = (userDoc.ejerciciosOK || 0) + (isSuccess ? 1 : 0);

  // Hitos de ejercicios
  if (isSuccess) {
    if (exsCount >= 1) checkAddLogro('first_blood');
    if (exsCount >= 10) checkAddLogro('novato_sql');
    if (exsCount >= 25) checkAddLogro('aprendiz_sql');
    if (exsCount >= 50) checkAddLogro('experto_sql');
    if (exsCount >= 100) checkAddLogro('maestro_sql');

    // Rachas
    if (windowContext._consecutiveSuccess >= 3) checkAddLogro('racha_3');
    if (windowContext._consecutiveSuccess >= 5) checkAddLogro('racha_5');
    if (windowContext._consecutiveSuccess >= 10) checkAddLogro('racha_10');
    if (windowContext._consecutiveSuccess >= 20) checkAddLogro('racha_20');

    // Tiempo
    const date = new Date();
    const h = date.getHours();
    const day = date.getDay();
    if (h >= 6 && h <= 8) checkAddLogro('madrugador');
    if (h >= 0 && h <= 4) checkAddLogro('nocturno');
    if (day === 0 || day === 6) checkAddLogro('fin_de_semana');

    // Cláusulas (basado en regex simple, propenso a fallos menores pero útil en gamificación)
    if (/ORDER\s+BY/.test(Q)) checkAddLogro('order_by');
    if (/GROUP\s+BY/.test(Q)) checkAddLogro('group_by');
    if (/HAVING/.test(Q)) checkAddLogro('having');
    if (/JOIN/.test(Q)) checkAddLogro('join');
    if (/LEFT\s+(OUTER\s+)?JOIN/.test(Q)) checkAddLogro('left_join');
    if (/\bSELECT\b.*\bSELECT\b/.test(Q)) checkAddLogro('subconsulta');
    if (/\bLIKE\b/.test(Q)) checkAddLogro('like');
    if (/\bIN\s*\(/.test(Q)) checkAddLogro('in');
    if (/\bBETWEEN\b/.test(Q)) checkAddLogro('between');
    if (/\bCOUNT\s*\(/.test(Q)) checkAddLogro('count');
    if (/\bSUM\s*\(/.test(Q)) checkAddLogro('sum');
    if (/\bAVG\s*\(/.test(Q)) checkAddLogro('avg');
    if (/\bMAX\s*\(|\bMIN\s*\(/.test(Q)) checkAddLogro('max_min');
    if (/\bLIMIT\b/.test(Q)) checkAddLogro('limit');
    if (/\bDISTINCT\b/.test(Q)) checkAddLogro('distinct');
    if (/\bUNION\b/.test(Q)) checkAddLogro('union');
    if (/\bINSERT\s+INTO\b/.test(Q)) checkAddLogro('insert');
    if (/\bUPDATE\b/.test(Q)) checkAddLogro('update');
    if (/\bDELETE\s+FROM\b/.test(Q)) checkAddLogro('delete');

    // Ocultas - Éxitos
    if (queryTxt === Q && queryTxt.match(/[A-Z]/)) checkAddLogro('grita_sql');
    if (ex && ex.query_solucion && queryTxt.length < ex.query_solucion.length * 0.7) checkAddLogro('minimalista');
    if (windowContext._consecutiveFails >= 5) checkAddLogro('persistente');
  } else {
    // Ocultas - Errores
    if (/DROP\s+TABLE/i.test(queryTxt) && !/DROP\s+TABLE/i.test(ex?.query_solucion || '')) checkAddLogro('bobby_tables');
    if (windowContext._consecutiveFails === 10) checkAddLogro('cabezota');
    if (queryTxt.length === 0) checkAddLogro('que_pesado');
    if (windowContext._lastSqlError) { checkAddLogro('error_sintaxis'); windowContext._lastSqlError = false; }
  }

  if (queryTxt.includes('--') || queryTxt.includes('/*')) checkAddLogro('comentario');
  if (/\bAS\s+["']?(WEY|BRO|TIO|LOL|XD)/.test(Q)) checkAddLogro('spanglish'); // Easter egg absurdo

  return { nuevosLogros, userLogros };
}
