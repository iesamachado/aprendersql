// js/sql-engine-utils.js
// Utilidades compartidas de compatibilidad y evaluación SQL (SQLite / sql.js)
// Usado por task/js/ejercicio.js, admin/js/ejercicios.js y scripts/audit_ejercicios.js

/**
 * Registra funciones de compatibilidad con MariaDB / MySQL en la instancia de SQLite.
 */
export function registerCustomFunctions(db) {
  if (!db || !db.create_function) return;

  // CONCAT: Si algún argumento es NULL en MariaDB devuelve NULL
  const concatCore = (...args) => {
    if (args.some(a => a === null || a === undefined)) return null;
    return args.map(String).join('');
  };

  // Registrar con aridad -1 (variadic nativo de SQLite)
  try {
    const varConcat = (...args) => concatCore(...args);
    Object.defineProperty(varConcat, 'length', { value: -1 });
    db.create_function('CONCAT', varConcat);
  } catch(e) {}

  // Registrar sobrecargas de aridad explícitas (1 a 8 argumentos) para sql.js
  db.create_function('CONCAT', (a) => concatCore(a));
  db.create_function('CONCAT', (a, b) => concatCore(a, b));
  db.create_function('CONCAT', (a, b, c) => concatCore(a, b, c));
  db.create_function('CONCAT', (a, b, c, d) => concatCore(a, b, c, d));
  db.create_function('CONCAT', (a, b, c, d, e) => concatCore(a, b, c, d, e));
  db.create_function('CONCAT', (a, b, c, d, e, f) => concatCore(a, b, c, d, e, f));
  db.create_function('CONCAT', (a, b, c, d, e, f, g) => concatCore(a, b, c, d, e, f, g));
  db.create_function('CONCAT', (a, b, c, d, e, f, g, h) => concatCore(a, b, c, d, e, f, g, h));

  // CONCAT_WS: Ignora NULLs y concatena con el separador
  const concatWsCore = (sep, ...args) => {
    if (sep === null || sep === undefined) return null;
    return args.filter(a => a !== null && a !== undefined).map(String).join(String(sep));
  };

  try {
    const varConcatWs = (...args) => concatWsCore(...args);
    Object.defineProperty(varConcatWs, 'length', { value: -1 });
    db.create_function('CONCAT_WS', varConcatWs);
  } catch(e) {}

  db.create_function('CONCAT_WS', (s, a) => concatWsCore(s, a));
  db.create_function('CONCAT_WS', (s, a, b) => concatWsCore(s, a, b));
  db.create_function('CONCAT_WS', (s, a, b, c) => concatWsCore(s, a, b, c));
  db.create_function('CONCAT_WS', (s, a, b, c, d) => concatWsCore(s, a, b, c, d));
  db.create_function('CONCAT_WS', (s, a, b, c, d, e) => concatWsCore(s, a, b, c, d, e));
  db.create_function('CONCAT_WS', (s, a, b, c, d, e, f) => concatWsCore(s, a, b, c, d, e, f));

  // MONTH: Extrae el mes de una fecha (1-12)
  db.create_function('MONTH', (dateStr) => {
    if (!dateStr) return null;
    const m = String(dateStr).match(/\d{4}-(\d{2})/);
    if (m) return parseInt(m[1], 10);
    const d = new Date(dateStr);
    return isNaN(d) ? null : d.getMonth() + 1;
  });

  // YEAR: Extrae el año (4 dígitos)
  db.create_function('YEAR', (dateStr) => {
    if (!dateStr) return null;
    const m = String(dateStr).match(/^(\d{4})/);
    if (m) return parseInt(m[1], 10);
    const d = new Date(dateStr);
    return isNaN(d) ? null : d.getFullYear();
  });

  // DAY / DAYOFMONTH: Extrae el día del mes (1-31)
  const dayFn = (dateStr) => {
    if (!dateStr) return null;
    const m = String(dateStr).match(/\d{4}-\d{2}-(\d{2})/);
    if (m) return parseInt(m[1], 10);
    const d = new Date(dateStr);
    return isNaN(d) ? null : d.getDate();
  };
  db.create_function('DAY', dayFn);
  db.create_function('DAYOFMONTH', dayFn);

  // NOW / CURRENT_TIMESTAMP
  const nowFn = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  db.create_function('NOW', nowFn);

  // CURDATE / CURRENT_DATE
  const curdateFn = () => new Date().toISOString().slice(0, 10);
  db.create_function('CURDATE', curdateFn);

  // DATEDIFF: Diferencia en días entre d1 y d2
  db.create_function('DATEDIFF', (d1, d2) => {
    if (!d1 || !d2) return null;
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    return Math.round((t1 - t2) / (1000 * 60 * 60 * 24));
  });

  // IF: Operador condicional escalar
  db.create_function('IF', (cond, trueVal, falseVal) => {
    return cond ? trueVal : falseVal;
  });

  // IFNULL: Devuelve defaultVal si val es NULL
  db.create_function('IFNULL', (val, defaultVal) => {
    return (val !== null && val !== undefined) ? val : defaultVal;
  });

  // LENGTH / CHAR_LENGTH
  db.create_function('LENGTH', (str) => (str !== null && str !== undefined) ? String(str).length : null);
  db.create_function('CHAR_LENGTH', (str) => (str !== null && str !== undefined) ? String(str).length : null);

  // DATE_FORMAT básico para formatos habituales
  db.create_function('DATE_FORMAT', (dateStr, format) => {
    if (!dateStr || !format) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return String(dateStr);
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return String(format).replace(/%Y/g, y).replace(/%m/g, m).replace(/%d/g, day);
  });
}

/**
 * Adapta sentencias de carga DDL desde scripts .sql MySQL a SQLite.
 */
export function adaptSqlScriptForSqlite(sqlText) {
  if (!sqlText) return '';
  return sqlText
    .replace(/drop\s+database\s+if\s+exists\s+\w+\s*;/gi, '')
    .replace(/CREATE\s+DATABASE\s+(IF\s+NOT\s+EXISTS\s+)?\w+\s*;/gi, '')
    .replace(/use\s+\w+\s*;/gi, '')
    .replace(/(INT|INTEGER)\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/(INT|INTEGER)\s+PRIMARY\s+KEY\s+AUTO_INCREMENT/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/INT\s+AUTO_INCREMENT/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/AUTO_INCREMENT/gi, '')
    .replace(/UNIQUE\s+KEY\s+\w+\s*\(([^)]+)\)/gi, 'UNIQUE($1)')
    .replace(/ENGINE\s*=\s*\w+/gi, '')
    .replace(/DEFAULT\s+CHARSET\s*=\s*[\w-]+/gi, '')
    .replace(/COLLATE\s*=\s*[\w-]+/gi, '');
}

/**
 * Transforma operadores MariaDB/MySQL no nativos en SQLite (ej. subconsultas ALL/ANY).
 */
export function adaptSqlForSqlite(sql) {
  if (!sql) return sql;
  
  // Adaptar RENAME TABLE a ALTER TABLE RENAME TO (soportado por SQLite)
  sql = sql.replace(/RENAME\s+TABLE\s+(\w+)\s+TO\s+(\w+)/gi, 'ALTER TABLE $1 RENAME TO $2');
  // Adaptar ALTER TABLE CHANGE [COLUMN] a RENAME COLUMN (soportado por SQLite 3.25+)
  sql = sql.replace(/ALTER\s+TABLE\s+([a-zA-Z0-9_`"']+)\s+CHANGE(?:\s+COLUMN)?\s+([a-zA-Z0-9_`"']+)\s+([a-zA-Z0-9_`"']+)(?:\s+[^;]*)?/gi, 'ALTER TABLE $1 RENAME COLUMN $2 TO $3');
  // Adaptar TRUNCATE TABLE a DELETE FROM
  sql = sql.replace(/TRUNCATE\s+(TABLE\s+)?(\w+)/gi, 'DELETE FROM $2');
  // Adaptar AUTO_INCREMENT para CREATE TABLE
  sql = sql
    .replace(/(INT|INTEGER)\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/(INT|INTEGER)\s+PRIMARY\s+KEY\s+AUTO_INCREMENT/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/INT\s+AUTO_INCREMENT/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/AUTO_INCREMENT/gi, '');

  // Si es un CREATE TABLE sin IF NOT EXISTS, anteponer DROP TABLE IF EXISTS para permitir idempotencia en ejercicios DDL aislados
  const createMatch = sql.match(/^\s*CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS\s+)([a-zA-Z0-9_`"']+)/i);
  if (createMatch) {
    const tbl = createMatch[1].replace(/[`"']/g, '');
    sql = `DROP TABLE IF EXISTS ${tbl};\n` + sql;
  }

  let res = '';
  let i = 0;
  const regex = /([><]=?|!=|=)\s*(ALL|ANY|SOME)\s*\(/gi;
  let match;
  while ((match = regex.exec(sql)) !== null) {
    res += sql.slice(i, match.index);
    const op = match[1].trim();
    const quantifier = match[2].toUpperCase();
    const startIdx = match.index + match[0].length;
    let depth = 1;
    let endIdx = startIdx;
    while (endIdx < sql.length && depth > 0) {
      if (sql[endIdx] === '(') depth++;
      else if (sql[endIdx] === ')') depth--;
      endIdx++;
    }
    if (depth !== 0) {
      res += match[0];
      i = startIdx;
      continue;
    }
    const subquery = sql.slice(startIdx, endIdx - 1).trim();
    i = endIdx;
    regex.lastIndex = endIdx;
    if ((op === '=' || op === '==') && (quantifier === 'ANY' || quantifier === 'SOME')) {
      res += 'IN (' + subquery + ')';
    } else if ((op === '!=' || op === '<>') && quantifier === 'ALL') {
      res += 'NOT IN (' + subquery + ')';
    } else {
      let orderDir = 'DESC';
      if (op === '>' || op === '>=') {
        orderDir = (quantifier === 'ALL') ? 'DESC' : 'ASC';
      } else if (op === '<' || op === '<=') {
        orderDir = (quantifier === 'ALL') ? 'ASC' : 'DESC';
      }
      res += op + ' (SELECT * FROM (' + subquery + ') AS _sub ORDER BY 1 ' + orderDir + ' LIMIT 1)';
    }
  }
  res += sql.slice(i);
  return res;
}

/**
 * Normaliza valores de celda para comparación robusta.
 */
export function normalizeCell(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return Math.round(val * 10000) / 10000;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = parseFloat(trimmed);
      if (!isNaN(num)) return Math.round(num * 10000) / 10000;
    }
    return trimmed;
  }
  return val;
}

export function cellEquals(c1, c2) {
  const n1 = normalizeCell(c1);
  const n2 = normalizeCell(c2);
  if (n1 === null && n2 === null) return true;
  if (n1 === null || n2 === null) return false;
  if (typeof n1 === 'number' && typeof n2 === 'number') {
    return Math.abs(n1 - n2) < 0.0001;
  }
  return String(n1).toLowerCase() === String(n2).toLowerCase();
}

export function rowToKey(row) {
  return row.map(normalizeCell).map(c => {
    if (c === null) return '__NULL__';
    if (typeof c === 'number') return `N:${c}`;
    return `S:${String(c).toLowerCase()}`;
  }).join('|||');
}

/**
 * Normaliza un tipo SQL a su forma canónica para comparación tolerante.
 * INT, INTEGER, TINYINT, SMALLINT, MEDIUMINT, BIGINT → 'integer'
 * VARCHAR(n), CHAR(n) → 'varchar'
 * TEXT, LONGTEXT, MEDIUMTEXT, TINYTEXT → 'text'
 * DECIMAL(p,s), NUMERIC(p,s), FLOAT, DOUBLE, REAL → 'real'
 * BOOLEAN, BOOL → 'integer'  (SQLite los almacena como integer)
 * DATE, DATETIME, TIMESTAMP → 'text'  (SQLite los almacena como text)
 */
function normalizeSqlType(type) {
  if (!type) return '';
  const t = String(type).trim().toLowerCase();
  if (/^(int|integer|tinyint|smallint|mediumint|bigint|boolean|bool)/.test(t)) return 'integer';
  if (/^(varchar|char)/.test(t)) return 'varchar';
  if (/^(text|longtext|mediumtext|tinytext)/.test(t)) return 'text';
  if (/^(decimal|numeric|float|double|real)/.test(t)) return 'real';
  if (/^(date|datetime|timestamp)/.test(t)) return 'text';
  return t.replace(/\(.*\)/, '').trim(); // quita parámetros para tipos desconocidos
}

/**
 * Extrae los nombres de tablas mencionados en una query DDL (CREATE/ALTER/DROP TABLE).
 */
function extractTableNames(sql) {
  const tables = new Set();
  const patterns = [
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"']?[\w]+[`"']?)/gi,
    /ALTER\s+TABLE\s+([`"']?[\w]+[`"']?)/gi,
    /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([`"']?[\w]+[`"']?)/gi,
    /RENAME\s+TABLE\s+([`"']?[\w]+[`"']?)/gi,
    /ALTER\s+TABLE\s+([`"']?[\w]+[`"']?)\s+RENAME\s+TO\s+([`"']?[\w]+[`"']?)/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(sql)) !== null) {
      // m[1] es siempre la tabla; m[2] existe en RENAME TO
      [m[1], m[2]].filter(Boolean).forEach(t => tables.add(t.replace(/[`"']/g, '')));
    }
  }
  return [...tables];
}

/**
 * Obtiene la info de columnas de una tabla con PRAGMA table_info.
 * Devuelve null si la tabla no existe.
 */
function getTableInfo(db, tableName) {
  try {
    const res = db.exec(`PRAGMA table_info("${tableName}")`);
    if (!res.length || !res[0].values.length) return null;
    // columns: cid, name, type, notnull, dflt_value, pk
    return res[0].values.map(row => ({
      name: String(row[1]).toLowerCase(),
      type: normalizeSqlType(row[2]),
      notnull: Number(row[3]),
      dflt_value: row[4] !== null && row[4] !== undefined ? String(row[4]).trim() : null,
      pk: Number(row[5]),
    }));
  } catch (e) {
    return null;
  }
}

/**
 * Compara la estructura DDL resultante en dbAlumno vs dbSolucion.
 * Ejecuta la query_solucion en dbSolucion y compara PRAGMA table_info de cada tabla.
 */
export function compareDDL(dbAlumno, querySolucion) {
  if (!dbAlumno || !querySolucion) return false;

  // Crear una BD limpia donde ejecutar la solución oficial
  const dbSol = new dbAlumno.constructor();
  try {
    const adaptedSol = adaptSqlForSqlite(querySolucion);
    dbSol.exec(adaptedSol);
  } catch (e) {
    console.error('Error ejecutando solución DDL:', e);
    return false;
  }

  // Extraer tablas de la query solución
  const tables = extractTableNames(querySolucion);
  if (!tables.length) return false;

  for (const table of tables) {
    const colsAlumno = getTableInfo(dbAlumno, table);
    const colsSol = getTableInfo(dbSol, table);

    // Si la solución crea la tabla pero el alumno no la tiene → incorrecto
    if (!colsAlumno && colsSol) return false;
    // Si la solución la elimina (DROP) y el alumno tampoco la tiene → correcto
    if (!colsAlumno && !colsSol) continue;
    // Si la solución la elimina pero el alumno aún la tiene → incorrecto
    if (colsAlumno && !colsSol) return false;

    // Comparar columnas (conjunto, insensible al orden)
    if (colsAlumno.length !== colsSol.length) return false;

    const byName = arr => Object.fromEntries(arr.map(c => [c.name, c]));
    const mapA = byName(colsAlumno);
    const mapS = byName(colsSol);

    for (const name of Object.keys(mapS)) {
      const cA = mapA[name];
      const cS = mapS[name];
      if (!cA) return false; // columna de la solución no existe en el alumno
      if (cA.type !== cS.type) return false;
      if (cA.notnull !== cS.notnull) return false;
      if (cA.pk !== cS.pk) return false;
      // dflt_value: comparar como strings normalizados
      const dA = cA.dflt_value !== null ? cA.dflt_value.toLowerCase().replace(/^'|'$/g, '') : null;
      const dS = cS.dflt_value !== null ? cS.dflt_value.toLowerCase().replace(/^'|'$/g, '') : null;
      if (dA !== dS) return false;
    }
  }
  return true;
}

/**
 * Compara dos resultados de ejecución SQL (SELECT).
 * isDDL: la query del alumno es DDL (CREATE/ALTER/DROP); en ese caso se compara la estructura.
 * isDML: la query es DML puro (INSERT/UPDATE/DELETE); se acepta si no hay error SQL.
 */
export function compareResults(resA, resS, isDML, isDDL, dbAlumno, querySolucion) {
  if (isDDL) return compareDDL(dbAlumno, querySolucion);
  if (isDML) return true;
  if (!resA.length && !resS.length) return true;
  if (!resA.length || !resS.length) return false;
  
  const vA = resA[0].values, vS = resS[0].values;
  if (vA.length !== vS.length) return false;
  if (vA.length === 0 && vS.length === 0) return true;
  if (vA[0].length !== vS[0].length) return false;

  // 1. Coincidencia directa fila por fila
  let directMatch = true;
  for (let i = 0; i < vS.length; i++) {
    for (let j = 0; j < vS[i].length; j++) {
      if (!cellEquals(vA[i][j], vS[i][j])) {
        directMatch = false;
        break;
      }
    }
    if (!directMatch) break;
  }
  if (directMatch) return true;

  // 2. Coincidencia como multiconjunto
  const keysA = vA.map(rowToKey).sort();
  const keysS = vS.map(rowToKey).sort();
  for (let i = 0; i < keysS.length; i++) {
    if (keysA[i] !== keysS[i]) return false;
  }
  return true;
}

// Para entornos no modulares (si se requiere)
if (typeof window !== 'undefined') {
  window.SqlEngineUtils = {
    registerCustomFunctions,
    adaptSqlScriptForSqlite,
    adaptSqlForSqlite,
    normalizeCell,
    cellEquals,
    rowToKey,
    compareDDL,
    compareResults
  };
}
