-- NBA Mini - Base de datos simplificada para ejercicios interactivos
-- Solo esquema + datos esenciales (~50 registros por tabla)

CREATE TABLE equipos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre VARCHAR(30) NOT NULL,
  conferencia VARCHAR(10) NOT NULL,
  ciudad VARCHAR(30) NOT NULL
);

CREATE TABLE jugadores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre VARCHAR(25) NOT NULL,
  apellido VARCHAR(25) NOT NULL,
  nacionalidad VARCHAR(20),
  posicion VARCHAR(5),
  id_equipo INTEGER NOT NULL,
  salario DECIMAL(10,2),
  FOREIGN KEY (id_equipo) REFERENCES equipos(id)
);

CREATE TABLE partidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_equipo_local INTEGER NOT NULL,
  id_equipo_visitante INTEGER NOT NULL,
  puntos_local INTEGER,
  puntos_visitante INTEGER,
  fecha DATE NOT NULL,
  FOREIGN KEY (id_equipo_local) REFERENCES equipos(id),
  FOREIGN KEY (id_equipo_visitante) REFERENCES equipos(id)
);

CREATE TABLE estadisticas (
  id_jugador INTEGER NOT NULL,
  id_partido INTEGER NOT NULL,
  puntos INTEGER DEFAULT 0,
  rebotes INTEGER DEFAULT 0,
  asistencias INTEGER DEFAULT 0,
  tapones INTEGER DEFAULT 0,
  robos INTEGER DEFAULT 0,
  PRIMARY KEY (id_jugador, id_partido),
  FOREIGN KEY (id_jugador) REFERENCES jugadores(id),
  FOREIGN KEY (id_partido) REFERENCES partidos(id)
);

-- EQUIPOS (8 equipos icónicos)
INSERT INTO equipos VALUES
(1, 'Lakers', 'Oeste', 'Los Angeles'),
(2, 'Warriors', 'Oeste', 'San Francisco'),
(3, 'Celtics', 'Este', 'Boston'),
(4, 'Heat', 'Este', 'Miami'),
(5, 'Bulls', 'Este', 'Chicago'),
(6, 'Spurs', 'Oeste', 'San Antonio'),
(7, 'Nets', 'Este', 'Brooklyn'),
(8, 'Nuggets', 'Oeste', 'Denver');

-- JUGADORES (24 jugadores)
INSERT INTO jugadores VALUES
(1,  'LeBron',    'James',     'EEUU',    'SF',  1, 45000000),
(2,  'Anthony',   'Davis',     'EEUU',    'C',   1, 38000000),
(3,  'Austin',    'Reaves',    'EEUU',    'SG',  1, 13000000),
(4,  'Rui',       'Hachimura', 'Japón',   'PF',  1, 17000000),
(5,  'Stephen',   'Curry',     'EEUU',    'PG',  2, 51000000),
(6,  'Klay',      'Thompson',  'EEUU',    'SG',  2, 43000000),
(7,  'Draymond',  'Green',     'EEUU',    'PF',  2, 22000000),
(8,  'Andrew',    'Wiggins',   'Canadá',  'SF',  2, 24000000),
(9,  'Jayson',    'Tatum',     'EEUU',    'SF',  3, 32000000),
(10, 'Jaylen',    'Brown',     'EEUU',    'SG',  3, 30000000),
(11, 'Al',        'Horford',   'D.Rep.',  'C',   3, 26000000),
(12, 'Marcus',    'Smart',     'EEUU',    'PG',  3, 18000000),
(13, 'Bam',       'Adebayo',   'EEUU',    'C',   4, 32000000),
(14, 'Jimmy',     'Butler',    'EEUU',    'SF',  4, 48000000),
(15, 'Tyler',     'Herro',     'EEUU',    'SG',  4, 27000000),
(16, 'Kyle',      'Lowry',     'Canadá',  'PG',  4, 29000000),
(17, 'Zach',      'LaVine',    'EEUU',    'SG',  5, 43000000),
(18, 'DeMar',     'DeRozan',   'EEUU',    'SF',  5, 26000000),
(19, 'Nikola',    'Vucevic',   'Montenegro','C', 5, 22000000),
(20, 'Keldon',    'Johnson',   'EEUU',    'SF',  6, 14000000),
(21, 'Devin',     'Vassell',   'EEUU',    'SG',  6, 19000000),
(22, 'Mikal',     'Bridges',   'EEUU',    'SF',  7, 24000000),
(23, 'Ben',       'Simmons',   'Australia','PG', 7, 35000000),
(24, 'Nikola',    'Jokic',     'Serbia',  'C',   8, 47000000);

-- PARTIDOS (10 partidos recientes)
INSERT INTO partidos VALUES
(1,  1, 2, 115, 108, '2025-01-10'),
(2,  3, 4, 102, 99,  '2025-01-11'),
(3,  5, 1, 98,  112, '2025-01-12'),
(4,  8, 3, 120, 115, '2025-01-13'),
(5,  2, 4, 110, 105, '2025-01-14'),
(6,  1, 3, 107, 99,  '2025-01-15'),
(7,  4, 8, 103, 118, '2025-01-16'),
(8,  6, 2, 95,  125, '2025-01-17'),
(9,  7, 1, 88,  105, '2025-01-18'),
(10, 3, 5, 121, 110, '2025-01-19');

-- ESTADÍSTICAS (representativas)
INSERT INTO estadisticas VALUES
-- Partido 1: Lakers vs Warriors
(1,  1, 32, 8, 10, 1, 2),
(2,  1, 28, 14, 3, 3, 1),
(5,  1, 35, 5, 7,  0, 2),
(6,  1, 22, 4, 3,  0, 1),
(7,  1, 8,  11, 8, 2, 3),
-- Partido 2: Celtics vs Heat
(9,  2, 38, 7, 6,  1, 2),
(10, 2, 24, 5, 4,  0, 3),
(13, 2, 19, 12, 4, 2, 1),
(14, 2, 31, 6, 5,  1, 2),
-- Partido 3: Bulls vs Lakers
(1,  3, 40, 10, 9, 0, 1),
(17, 3, 28, 4, 6,  0, 2),
(18, 3, 22, 5, 4,  0, 1),
-- Partido 4: Nuggets vs Celtics
(24, 4, 36, 15, 11, 1, 3),
(9,  4, 30, 8,  5,  0, 2),
-- Partido 5: Warriors vs Heat
(5,  5, 42, 6,  8, 0, 4),
(14, 5, 25, 7,  6, 1, 2),
-- Partido 6: Lakers vs Celtics
(1,  6, 28, 9,  8, 1, 2),
(9,  6, 35, 6,  7, 0, 1),
(10, 6, 20, 4,  3, 0, 2),
-- Partido 7: Heat vs Nuggets
(14, 7, 33, 8,  6, 0, 3),
(24, 7, 40, 12, 9, 2, 1),
-- Partido 8: Spurs vs Warriors
(5,  8, 45, 7,  10,0, 3),
(21, 8, 18, 4,  3, 0, 1),
-- Partido 9: Nets vs Lakers
(1,  9, 38, 11, 9, 1, 2),
(22, 9, 20, 5,  4, 0, 1),
-- Partido 10: Celtics vs Bulls
(9,  10, 36, 8, 6, 1, 2),
(10, 10, 28, 5, 4, 0, 1),
(17, 10, 30, 6, 5, 0, 2);
